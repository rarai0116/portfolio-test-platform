import * as admin from 'firebase-admin';
import { defineSecret } from 'firebase-functions/params';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from './admin';

export const specialAdminEmailsSecret = defineSecret('SPECIAL_ADMIN_EMAILS');

export const getAllowedAdminEmails = () => {
  const raw =
    process.env.FUNCTIONS_EMULATOR === 'true'
      ? (process.env.LOCAL_SPECIAL_ADMIN_EMAILS ?? '')
      : specialAdminEmailsSecret.value();

  return raw
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);
};

const getAuthenticatedEmail = (req: CallableRequest) => {
  if (!req) throw new Error('Request is required');

  const auth = req.auth;
  if (!auth) {
    throw new HttpsError('unauthenticated', '認証されていません。');
  }

  const email = auth.token?.email;
  if (!email) {
    throw new HttpsError(
      'invalid-argument',
      'メールアドレスが取得できません。',
    );
  }

  return email;
};

const hasAllowedworkbookAccess = (email: string) => {
  const allowedEmails = getAllowedAdminEmails();
  return (
    email.endsWith('@demoschool.ac.jp') &&
    (email.startsWith('t-') || allowedEmails.includes(email))
  );
};

const mergeCustomClaimsByEmail = async (
  email: string,
  claimsPatch: Record<string, unknown>,
) => {
  const user = await admin.auth().getUserByEmail(email);
  const existingClaims = user.customClaims ?? {};

  await admin.auth().setCustomUserClaims(user.uid, {
    ...existingClaims,
    ...claimsPatch,
  });

  return user;
};

// import initializeApp from "./admin";

// setGlobalOptions({ region: 'asia-northeast1' });
export const setCustomClaimsHandler = async (req: CallableRequest) => {
  initializeApp();
  console.log('setCustomClaims called');
  const email = getAuthenticatedEmail(req);
  console.log('User email:', email);

  if (hasAllowedworkbookAccess(email)) {
    console.log('Setting admin custom claims for user:', email);
    await mergeCustomClaimsByEmail(email, {
      atpAllowWrite: true,
      atpAllowRead: true,
    });
    return { success: true, message: 'カスタムクレームを設定しました。' };
  }

  return {
    success: false,
    message: 'このアカウントにはアクセス権がありません。',
  };
};

export const setQaaReadClaimsHandler = async (req: CallableRequest) => {
  initializeApp();
  console.log('setQaaReadClaims called');
  const email = getAuthenticatedEmail(req);
  console.log('User email:', email);

  if (hasAllowedworkbookAccess(email)) {
    console.log('Setting QAA read claims for user:', email);
    await mergeCustomClaimsByEmail(email, {
      atpAllowRead: true,
    });
    return { success: true, message: 'QAA 読み取り権限を設定しました。' };
  }

  return {
    success: false,
    message: 'このアカウントにはアクセス権がありません。',
  };
};
