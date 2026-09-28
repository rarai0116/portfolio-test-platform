import type { CallableRequest } from 'firebase-functions/v2/https';
import functionsTest from 'firebase-functions-test';
import { auth, initializeApp } from './admin';
import { setCustomClaims, setQaaReadClaims } from './index';

const tester = functionsTest({
  projectId: process.env.FUNCTIONS_SECRETS
    ? JSON.parse(process.env.FUNCTIONS_SECRETS).projectId
    : 'test-project-id',
});

describe('カスタムクレーム設定', () => {
  beforeAll(async () => {
    console.log('Setting up tests...');
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'; // 環境変数を直接設定
    initializeApp();
    console.log('Firebase Admin initialized');

    if (!auth) {
      throw new Error('Auth is not initialized');
    }
    // テスト用ユーザーを作成
    try {
      await auth.createUser({
        email: 't-user@demoschool.ac.jp',
        password: 'password123', // 任意のパスワード
      });
      console.log('Test user created: t-user@demoschool.ac.jp');
      // biome-ignore lint/suspicious/noExplicitAny: 値が不明かつ他の型を同定する方法がないため
    } catch (error: any) {
      if (error?.code === 'auth/email-already-exists') {
        console.log('Test user already exists: t-user@demoschool.ac.jp');
      } else {
        throw error;
      }
    }

    try {
      await auth.createUser({
        email: 't-qaa-user@demoschool.ac.jp',
        password: 'password123',
      });
      console.log('Test user created: t-qaa-user@demoschool.ac.jp');
      // biome-ignore lint/suspicious/noExplicitAny: 値が不明かつ他の型を同定する方法がないため
    } catch (error: any) {
      if (error?.code === 'auth/email-already-exists') {
        console.log(
          'Test user already exists: t-qaa-user@demoschool.ac.jp',
        );
      } else {
        throw error;
      }
    }
  });

  const wrappedSetCustomClaims = tester.wrap(setCustomClaims);
  const wrappedSetQaaReadClaims = tester.wrap(setQaaReadClaims);

  it('t-のつくemailを持つユーザーにカスタムクレームを設定する', async () => {
    console.log('start test setCustomClaims');

    const req = {
      auth: {
        token: { email: 't-user@demoschool.ac.jp' },
      },
    } as CallableRequest;

    const result = await wrappedSetCustomClaims(req);
    console.log('Result:', result);
    expect(result.success).toBe(true);
    expect(result.message).toBe('カスタムクレームを設定しました。');
  }, 5000);

  it('QAA用read claim追加時に既存claimsを保持する', async () => {
    if (!auth) {
      throw new Error('Auth is not initialized');
    }

    const user = await auth.getUserByEmail('t-qaa-user@demoschool.ac.jp');
    await auth.setCustomUserClaims(user.uid, {
      atpAllowWrite: true,
      existingFlag: true,
    });

    const req = {
      auth: {
        token: { email: 't-qaa-user@demoschool.ac.jp' },
      },
    } as CallableRequest;

    const result = await wrappedSetQaaReadClaims(req);
    expect(result.success).toBe(true);
    expect(result.message).toBe('QAA 読み取り権限を設定しました。');

    const updatedUser = await auth.getUserByEmail(
      't-qaa-user@demoschool.ac.jp',
    );
    expect(updatedUser.customClaims).toMatchObject({
      atpAllowRead: true,
      atpAllowWrite: true,
      existingFlag: true,
    });
  }, 5000);
});
