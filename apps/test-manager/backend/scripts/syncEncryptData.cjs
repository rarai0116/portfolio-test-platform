/**
 * このスクリプトは、指定した baseUrl を暗号化して署名し、Firestore の update-config/global ドキュメントに保存します。
 *  K_ENC_B64 と K_SIG_B64 はそれぞれ暗号化キーと署名キーの base64 で、どちらも 32 バイト（base64 で 44 文字）でなければなりません。
 * 使用例:
 * cd apps/backend
 * set GOOGLE_APPLICATION_CREDENTIALS=（サービスアカウントjsonのパス）
 * set K_ENC_B64=（32bytesのbase64）
 * set K_SIG_B64=（32bytesのbase64）
 * pnpm update-config:set -- --project demo-test-manager --base-url https://<project-id>.web.app/updates/<RANDOM>/
 * 
 * Emulator向けに動かす場合は
 * $env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
 * $env:GCLOUD_PROJECT="demo-test-manager"          # または --project で渡すなら必須ではない
 * $env:K_ENC_B64="(32bytesのkeyをbase64にしたもの)"
 * $env:K_SIG_B64="(32bytesのkeyをbase64にしたもの)"
 *
 * pnpm update-config:set -- --project demo-test-manager --base-url "http://127.0.0.1:5000/updates/<RANDOM>/"
 */
const crypto = require('node:crypto');
const path = require('node:path');

const admin = require('firebase-admin');

function b64(buf) {
  return Buffer.from(buf).toString('base64');
}

function encryptAndSign({ baseUrl, v, kEncB64, kSigB64 }) {
  const kEnc = Buffer.from(kEncB64, 'base64');
  const kSig = Buffer.from(kSigB64, 'base64');
  if (kEnc.length !== 32) throw new Error('K_ENC_B64 must be 32 bytes (base64)');
  if (kSig.length !== 32) throw new Error('K_SIG_B64 must be 32 bytes (base64)');

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', kEnc, iv);
  const ciphertext = Buffer.concat([cipher.update(baseUrl, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag(); // 16 bytes

  // ciphertextB64 に ciphertext||tag を詰める（復号側は末尾16byteをtagとして扱う）
  const payload = Buffer.concat([ciphertext, tag]);

  const ivB64 = b64(iv);
  const ciphertextB64 = b64(payload);

  const message = `${v}.${ivB64}.${ciphertextB64}`;
  const sig = crypto.createHmac('sha256', kSig).update(message, 'utf8').digest();
  const sigB64 = b64(sig);

  return { v, ivB64, ciphertextB64, sigB64 };
}

function parseArgs(argv) {
  // 使い方:
  // node ... --base-url https://.../updates/<RANDOM>/ --project demo-test-manager
  const out = { baseUrl: '', projectId: '', v: 1 };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--base-url') out.baseUrl = argv[i + 1] || '';
    if (a === '--project') out.projectId = argv[i + 1] || '';
    if (a === '--v') out.v = Number(argv[i + 1] || '1');
  }
  return out;
}

async function main() {
  const { baseUrl, projectId, v } = parseArgs(process.argv.slice(2));
  if (!baseUrl) throw new Error('--base-url is required');
  if (!baseUrl.endsWith('/')) throw new Error('baseUrl must end with "/"');
  if (!projectId) throw new Error('--project is required');

  const kEncB64 = process.env.K_ENC_B64 || '';
  const kSigB64 = process.env.K_SIG_B64 || '';
  if (!kEncB64 || !kSigB64) throw new Error('K_ENC_B64 and K_SIG_B64 are required');

  // 認証: 推奨は GOOGLE_APPLICATION_CREDENTIALS でパス指定（CIならSecretに置く）
  // service account JSON を直接読む場合は fs で読んで admin.credential.cert に渡す
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId,
  });

  const payload = encryptAndSign({ baseUrl, v, kEncB64, kSigB64 });

  const doc = admin.firestore().collection('update-config').doc('global');
  await doc.set(
    {
      ...payload,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: false },
  );

  console.log('ok: updated update-config/global');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});