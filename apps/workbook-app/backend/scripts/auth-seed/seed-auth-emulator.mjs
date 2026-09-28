// APP_ENV=local 用の模擬アカウントを Firebase Auth Emulator に作成するローカル専用ツール。
//
// Emulator 起動中に実行すると、accounts:signUp REST endpoint で email/password
// ユーザーを作成する。`emulators:start` は --export-on-exit 付きなので、
// 終了時に data/auth_export へ書き出され、次回以降は --import で復元される。
//
// 使い方:
//   1. 別ターミナルで `pnpm emulators:start` を起動する。
//   2. `pnpm auth-seed` を実行する(必要なら EMULATOR_HOST を指定)。
//   3. emulator を Ctrl+C で終了すると data/auth_export に永続化される。
//
// custom claims(grade / role)はアプリ側の initilizeCustomClaims callable で
// 付与されるため、ここでは作成しない。
//
// 注意: ここに置く値は秘密情報ではない。client 側 mockAccounts.ts と一致させること。

const HOST = process.env.EMULATOR_HOST ?? '127.0.0.1';
const PORT = process.env.AUTH_EMULATOR_PORT ?? '9599';
const BASE = `http://${HOST}:${PORT}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`;

// client(apps/client/components/functionals/mockAccounts.ts)と一致させる。
// admin の email は backend の ADMIN_EMAILS secret と一致させること。
const MOCK_ACCOUNTS = [
  {
    email: 'student@demoschool.ac.jp',
    password: 'password123',
    displayName: 'Local Student',
  },
  {
    email: 't-teacher@demoschool.ac.jp',
    password: 'password123',
    displayName: 'Local Teacher',
  },
  {
    email: 'admin@demoschool.ac.jp',
    password: 'password123',
    displayName: 'Local Admin',
  },
];

const updateDisplayName = async (idToken, displayName) => {
  const response = await fetch(
    `http://${HOST}:${PORT}/identitytoolkit.googleapis.com/v1/accounts:update?key=fake-api-key`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({idToken, displayName, returnSecureToken: false}),
    },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `profile update failed: ${response.status}`);
  }
};

const signIn = async (account) => {
  const response = await fetch(
    `http://${HOST}:${PORT}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        email: account.email,
        password: account.password,
        returnSecureToken: true,
      }),
    },
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.idToken) {
    throw new Error(body?.error?.message ?? `sign in failed: ${response.status}`);
  }
  return body.idToken;
};

const seed = async () => {
  for (const account of MOCK_ACCOUNTS) {
    // eslint-disable-next-line no-await-in-loop
    const response = await fetch(BASE, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        email: account.email,
        password: account.password,
        displayName: account.displayName,
        returnSecureToken: true,
      }),
    });

    if (response.ok) {
      const body = await response.json();
      await updateDisplayName(body.idToken, account.displayName);
      console.info();
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const body = await response.json().catch(() => ({}));
    const reason = body?.error?.message ?? `${response.status}`;
    if (reason === 'EMAIL_EXISTS') {
      const idToken = await signIn(account);
      await updateDisplayName(idToken, account.displayName);
      console.info();
    } else {
      console.error();
    }
  }
};

seed().catch((error) => {
  console.error('auth-seed failed', error);
  process.exitCode = 1;
});
