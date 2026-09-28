// APP_ENV=local の Firebase Auth Emulator 専用の模擬アカウント定義。
// ここに置く値は秘密情報ではなく、Emulator にシードしたテストアカウントと一致させる。
// - teacher は email 先頭が `t-` のため、既存の setInitialCustomClaims で teacher ロールになる。
// - admin の email は backend の ADMIN_EMAILS secret と一致させ、管理者 callable の認可確認に使う。
// シード手順は apps/backend/scripts/auth-seed/README.md を参照。

export type MockAccountKey = 'student' | 'teacher' | 'admin';

export type MockAccount = {
  email: string;
  password: string;
  displayName: string;
};

export const MOCK_ACCOUNTS: Record<MockAccountKey, MockAccount> = {
  student: {
    email: 'student@demoschool.ac.jp',
    password: 'password123',
    displayName: 'Local Student',
  },
  teacher: {
    email: 't-teacher@demoschool.ac.jp',
    password: 'password123',
    displayName: 'Local Teacher',
  },
  admin: {
    email: 'admin@demoschool.ac.jp',
    password: 'password123',
    displayName: 'Local Admin',
  },
};

const isMockAccountKey = (key: string | undefined): key is MockAccountKey =>
  key === 'student' || key === 'teacher' || key === 'admin';

// extra.MOCK_ACCOUNT の値を MockAccount に解決する。未指定/不正値は student。
export const resolveMockAccount = (key: string | undefined): MockAccount =>
  isMockAccountKey(key) ? MOCK_ACCOUNTS[key] : MOCK_ACCOUNTS.student;
