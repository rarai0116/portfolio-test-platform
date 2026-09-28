/** biome-ignore-all lint/style/useNodejsImportProtocol: backend utility script */

/**
 * seedTeacherUser.cjs
 *
 * test-manager（teacher）向けの仮想ユーザーを Auth emulator に作成し、
 * 問題編集に必要なカスタムクレームを直接付与する seed スクリプト。
 *
 * firestore.rules の権限ゲートは以下の 2 条件（backend/firestore.rules）:
 *   - isAllowedDomain(): email が @demoschool.ac.jp または @demoschool.jp
 *   - atpAllowRead / atpAllowWrite claim == true
 * 接頭辞（t-）は rules 判定には無関係（login callable の判定のみ）。
 * よって本 seed では email をドメイン準拠にし、claim を直接付与する
 * （設計が認める Issue #16 前の「手動対応」に相当）。
 *
 * test-manager client は `users` コレクションを参照しないため、teacher 編集に
 * users doc は不要。必要なら別途作成する。
 *
 * 本タスクは emulator 専用。本番 Auth 接続時は --allow-prod を必須にする。
 */

const admin = require('firebase-admin');

const ALLOWED_DOMAINS = ['demoschool.ac.jp', 'demoschool.jp'];

function log(...args) {
  console.log('[seed-teacher-user]', ...args);
}

function getAdminApp(projectId) {
  if (admin.apps.length > 0) return admin.app();
  if (!projectId) {
    throw new Error('--project または GCLOUD_PROJECT が必要です');
  }
  return admin.initializeApp({ projectId });
}

function isAllowedDomain(email) {
  return ALLOWED_DOMAINS.some((domain) => email.endsWith(`@${domain}`));
}

function buildClaims({ readOnly }) {
  return readOnly
    ? { atpAllowRead: true }
    : { atpAllowRead: true, atpAllowWrite: true };
}

function parseArgs(argv) {
  const out = {
    projectId:
      process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '',
    email: 't-dummy@demoschool.ac.jp',
    password: 'dummy-teacher-pass',
    uid: '',
    displayName: 'ダミー教員',
    readOnly: false,
    dryRun: false,
    yes: false,
    allowProd: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1] || '';
      index += 1;
      return value;
    };

    switch (arg) {
      case '--project':
        out.projectId = next();
        break;
      case '--email':
        out.email = next();
        break;
      case '--password':
        out.password = next();
        break;
      case '--uid':
        out.uid = next();
        break;
      case '--display-name':
        out.displayName = next();
        break;
      case '--read-only':
        out.readOnly = true;
        break;
      case '--dry-run':
        out.dryRun = true;
        break;
      case '--yes':
        out.yes = true;
        break;
      case '--allow-prod':
        out.allowProd = true;
        break;
      case '--help':
      case '-h':
        out.help = true;
        break;
      default:
        break;
    }
  }

  return out;
}

function printHelp() {
  console.log(`Usage:
  node ./scripts/seedTeacherUser.cjs --project <id> [options]

Options:
  --project <id>        Firebase project id（emulator でも推奨。emulator は demo-test-manager）
  --email <email>       teacher の email。@demoschool.ac.jp か @demoschool.jp が必須
                        既定 t-dummy@demoschool.ac.jp
  --password <pass>     初期パスワード。既定 dummy-teacher-pass
  --uid <uid>           固定 uid（省略時は自動採番）
  --display-name <s>    表示名。既定 ダミー教員
  --read-only           atpAllowRead のみ付与（既定は read+write）
  --dry-run             作成せず、計画のみ出力
  --yes                 実作成の確認を省略
  --allow-prod          Auth emulator 未接続（本番）での実行を許可
  --help, -h            Show this help

Examples:
  # dry-run
  node ./scripts/seedTeacherUser.cjs --project demo-test-manager --dry-run
  # 実作成
  node ./scripts/seedTeacherUser.cjs --project demo-test-manager --yes`);
}

async function getUserByUidOrNull(auth, uid) {
  if (!uid) return null;
  try {
    return await auth.getUser(uid);
  } catch (_e) {
    return null;
  }
}

async function getUserByEmailOrNull(auth, email) {
  try {
    return await auth.getUserByEmail(email);
  } catch (_e) {
    return null;
  }
}

async function upsertUser(auth, args) {
  const claims = buildClaims({ readOnly: args.readOnly });
  const setClaims = async (user) => {
    await auth.setCustomUserClaims(user.uid, {
      ...(user.customClaims ?? {}),
      ...claims,
    });
  };

  // uid を明示した場合（t-方式で LOCAL_AUTH_SUBJECT と一致させる用途）は uid を優先。
  if (args.uid) {
    const byUid = await getUserByUidOrNull(auth, args.uid);
    if (byUid) {
      if (byUid.email && byUid.email !== args.email) {
        throw new Error(
          `uid=${args.uid} は既に別 email(${byUid.email}) で存在します。--email を合わせるか uid を変えてください。`,
        );
      }
      await setClaims(byUid);
      return { uid: byUid.uid, created: false, claims };
    }

    const byEmail = await getUserByEmailOrNull(auth, args.email);
    if (byEmail && byEmail.uid !== args.uid) {
      throw new Error(
        `email=${args.email} は既に別 uid(${byEmail.uid}) で存在します。` +
          `そのユーザーを削除するか、LOCAL_AUTH_SUBJECT=${byEmail.uid} に合わせてください。`,
      );
    }

    const user = await auth.createUser({
      uid: args.uid,
      email: args.email,
      emailVerified: true,
      password: args.password,
      displayName: args.displayName,
    });
    await setClaims(user);
    return { uid: user.uid, created: true, claims };
  }

  // uid 未指定は email ベースの冪等（自動採番）。
  const existing = await getUserByEmailOrNull(auth, args.email);
  if (existing) {
    await setClaims(existing);
    return { uid: existing.uid, created: false, claims };
  }

  const user = await auth.createUser({
    email: args.email,
    emailVerified: true,
    password: args.password,
    displayName: args.displayName,
  });
  await setClaims(user);
  return { uid: user.uid, created: true, claims };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (!isAllowedDomain(args.email)) {
    throw new Error(
      `--email は ${ALLOWED_DOMAINS.map((d) => `@${d}`).join(' / ')} のいずれかで終わる必要があります: ${args.email}`,
    );
  }

  const useAuthEmulator = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);
  if (!useAuthEmulator && !args.allowProd) {
    throw new Error(
      'Auth emulator 未接続です。FIREBASE_AUTH_EMULATOR_HOST を設定してください（例 127.0.0.1:9099）。本番実行が必要な場合のみ --allow-prod。',
    );
  }

  const claims = buildClaims({ readOnly: args.readOnly });
  const summary = {
    mode: useAuthEmulator ? 'emulator' : 'production',
    project: args.projectId || '(auto)',
    email: args.email,
    displayName: args.displayName,
    uid: args.uid || '(auto)',
    claims,
    dryRun: args.dryRun,
  };

  log('summary');
  console.log(JSON.stringify(summary));

  if (args.dryRun) {
    log('dry-run: no user written');
    return;
  }

  if (!args.yes) {
    throw new Error('実作成には --yes が必要です。まず --dry-run で確認してください。');
  }

  const app = getAdminApp(args.projectId);
  const auth = admin.auth(app);
  const result = await upsertUser(auth, args);

  log(
    `teacher user ${result.created ? 'created' : 'updated'} uid=${result.uid} claims=${JSON.stringify(result.claims)}`,
  );
  console.log(
    JSON.stringify({ ...summary, uid: result.uid, created: result.created }),
  );

  log(
    'note: test-manager 側の権限は email ドメイン + atpAllow* claim で成立します。' +
      'workbook 側 student は別プロジェクト emulator へ別途 seed してください。',
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[seed-teacher-user] fatal:', error);
    process.exit(1);
  });
}

module.exports = {
  buildClaims,
  isAllowedDomain,
  parseArgs,
};
