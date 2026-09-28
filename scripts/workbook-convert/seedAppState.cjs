'use strict';
/*
 * WorkbookApp が起動するために必要な Firestore の状態を作る。
 *
 * 問題データ（RTDB）だけ入れてもアプリは起動しない。クライアントは起動時に
 * Firestore を読み、値が無いと**例外もログも出さずに停止する**。
 *
 *   useLoadingContext: metadata/appVersion が無いと isVersionChecked を立てずに抜ける
 *                      → ローディング画面から進まない
 *   useSnapshotManagerContext: metadata/<grade>LastUpdate の assets / html / test が
 *                      揃わないと state を設定しない
 *
 * 何を入れるかは移植元の実データを読んで決めた（本番に無いものは入れない）。
 *   metadata/appVersion            required / recommended
 *   metadata/firstGradeLastUpdate  zip test html image bzip b64 assets（Timestamp）
 *   metadata/secondGradeLastUpdate 同上
 *   metadata/commonLastUpdate      同上
 *   app/status                     isMaintenance
 *   metadata/mode                  本番にも存在しない → 入れない
 */

const fs = require('node:fs');
const path = require('node:path');

// アプリ側の CURRENT_VERSION と文字列比較される。これより大きいと更新モーダルが出て
// やはり先へ進めないため、常に通る "0" を既定にする。
const DEFAULT_APP_VERSION = { required: '0', recommended: '0' };

// LastUpdate が持つフィールド。クライアントは assets / html / test の 3 つが
// 揃っていることを条件にしているが、実データに合わせて 7 つとも入れる。
const LAST_UPDATE_FIELDS = ['assets', 'b64', 'bzip', 'html', 'image', 'test', 'zip'];

/**
 * client の mockAccounts.ts を正本として模擬アカウントを読む。
 *
 * 移植元の auth-seed はコメントで「一致させること」と書いているだけで実際は
 * 二重管理だった。ここでは同じ轍を踏まず、正本を直接読む。
 * 読めなければ黙って既定値へ落ちずに throw する（ずれたまま seed されるより、
 * 止まって気付けるほうがよい）。
 */
function readMockAccounts(mockAccountsPath) {
  if (!fs.existsSync(mockAccountsPath)) {
    throw new Error(`mockAccounts.ts が見つかりません: ${mockAccountsPath}`);
  }
  const source = fs.readFileSync(mockAccountsPath, 'utf8');
  const accounts = [];
  // student: { email: '...', password: '...' } の形を拾う。
  const entryRe = /(\w+)\s*:\s*\{[^}]*?email\s*:\s*'([^']+)'[^}]*?password\s*:\s*'([^']+)'[^}]*?\}/g;
  for (const match of source.matchAll(entryRe)) {
    accounts.push({ key: match[1], email: match[2], password: match[3] });
  }
  if (accounts.length === 0) {
    throw new Error(`mockAccounts.ts から模擬アカウントを読み取れませんでした: ${mockAccountsPath}`);
  }
  return accounts;
}

function timestampFields(iso) {
  const out = {};
  for (const field of LAST_UPDATE_FIELDS) out[field] = { timestampValue: iso };
  return out;
}

/** Firestore REST の document 形式へ組み立てる。 */
function buildDocuments({ appVersion = DEFAULT_APP_VERSION, updatedAt = new Date().toISOString() } = {}) {
  return [
    {
      collection: 'metadata',
      id: 'appVersion',
      fields: {
        required: { stringValue: String(appVersion.required) },
        recommended: { stringValue: String(appVersion.recommended) },
      },
    },
    { collection: 'metadata', id: 'firstGradeLastUpdate', fields: timestampFields(updatedAt) },
    { collection: 'metadata', id: 'secondGradeLastUpdate', fields: timestampFields(updatedAt) },
    { collection: 'metadata', id: 'commonLastUpdate', fields: timestampFields(updatedAt) },
    { collection: 'app', id: 'status', fields: { isMaintenance: { booleanValue: false } } },
  ];
}

/**
 * 起動に必要な Firestore ドキュメントと Auth ユーザーを seed する。
 * io は writeFirestore / createAuthUser を持つこと。
 */
async function seedAppState({ io, mockAccountsPath, appVersion, dryRun = false, report }) {
  const documents = buildDocuments({ appVersion });
  const accounts = readMockAccounts(mockAccountsPath);

  report.firestore = documents.map((d) => `${d.collection}/${d.id}`);
  report.authAccounts = accounts.map((a) => a.email);

  if (dryRun) return { documents, accounts };

  for (const document of documents) {
    await io.writeFirestore(document.collection, document.id, document.fields);
  }
  for (const account of accounts) {
    await io.createAuthUser(account.email, account.password);
  }
  return { documents, accounts };
}

module.exports = {
  DEFAULT_APP_VERSION, LAST_UPDATE_FIELDS,
  buildDocuments, readMockAccounts, seedAppState,
};
