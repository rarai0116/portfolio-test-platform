import crypto from 'node:crypto';
import { ensureAuthClaims, firestore } from '@main/services/firebase';
import { doc, getDoc } from 'firebase/firestore';

type UpdateConfigDoc = {
  v: number;
  ivB64: string;
  ciphertextB64: string; // ciphertext||tag を base64
  sigB64: string;
};

const b64 = (buf: Buffer) => buf.toString('base64');

const mustEnv = (key: string) => {
  const v = process.env[key];
  if (!v) throw new Error(`${key} is not set`);
  return v;
};

export async function fetchAndDecryptUpdateBaseUrl(): Promise<string> {
  // 読み取り権限クレームが揃っている前提（なければ待つ/失敗）
  await ensureAuthClaims({ requireRead: true });

  const snap = await getDoc(doc(firestore, 'update-config', 'global'));
  if (!snap.exists()) throw new Error('update-config/global が存在しません');

  const data = snap.data() as Partial<UpdateConfigDoc>;
  if (typeof data.v !== 'number') throw new Error('update-config.v が不正です');
  if (typeof data.ivB64 !== 'string')
    throw new Error('update-config.ivB64 が不正です');
  if (typeof data.ciphertextB64 !== 'string')
    throw new Error('update-config.ciphertextB64 が不正です');
  if (typeof data.sigB64 !== 'string')
    throw new Error('update-config.sigB64 が不正です');

  // 鍵
  const kEnc = Buffer.from(mustEnv('UPDATER_K_ENC_B64'), 'base64');
  const kSig = Buffer.from(mustEnv('UPDATER_K_SIG_B64'), 'base64');
  if (kEnc.length !== 32)
    throw new Error('UPDATER_K_ENC_B64 は 32 bytes 必須です');
  if (kSig.length !== 32)
    throw new Error('UPDATER_K_SIG_B64 は 32 bytes 必須です');

  // HMAC検証
  const message = `${data.v}.${data.ivB64}.${data.ciphertextB64}`;
  const sig = crypto
    .createHmac('sha256', kSig)
    .update(message, 'utf8')
    .digest();
  const expectedSigB64 = b64(sig);
  if (expectedSigB64 !== data.sigB64)
    throw new Error('update-config の署名が不正です');

  // 復号（ciphertextB64 は ciphertext||tag を想定）
  const iv = Buffer.from(data.ivB64, 'base64');
  const payload = Buffer.from(data.ciphertextB64, 'base64');
  if (iv.length !== 12) throw new Error('iv は 12 bytes 想定です');
  if (payload.length < 17) throw new Error('ciphertext が短すぎます');

  const tag = payload.subarray(payload.length - 16);
  const ciphertext = payload.subarray(0, payload.length - 16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', kEnc, iv);
  decipher.setAuthTag(tag);

  const baseUrl = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
  if (!baseUrl.endsWith('/')) throw new Error('baseUrl は末尾 / 必須です');
  return baseUrl;
}
