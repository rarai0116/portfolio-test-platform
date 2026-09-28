/*
 * ツールチェーンの不変条件を確かめる。
 *
 * 移植元 demo-workbook-app の scripts/verify-toolchain.mjs を、移植後の構成へ
 * 合わせたもの。移植では scripts/ が overlay ごと差し替わるため、移植元の版は
 * 運ばれない。package.json の verify:toolchain だけが残って実体が無い状態に
 * なっていたのを 2026-09-22 に直した。
 *
 * 移植元との違いは 2 つ。
 *
 * 1. パスに apps/ が付かない。移植先は <repo>/apps/workbook-app/ が根で、
 *    その下が client / backend / backend/functions。
 * 2. backend の engines.node は "22.23.2" ではなく "22"。移植では
 *    scaffold/workbook/backend/package.json が backend の package.json を
 *    丸ごと置き換えており、そちらが "22" を宣言している（emulator と
 *    functions を動かすだけの薄い package にしてある）。
 *
 * 宣言の突き合わせなので、実際に入っている Node / pnpm は見ない。ただし新しい
 * 環境で最初に叩くコマンドなので、動いている版が宣言と食い違う場合だけ警告を出す。
 * 警告は失敗にしない（Corepack が各ディレクトリの packageManager で pnpm を
 * 切り替えるため、ここで見える版が実際の install 版とは限らない）。
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// cwd ではなくスクリプトの位置から解く。pnpm -C や別ディレクトリからの実行でも動く。
const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (...segments) => readFileSync(join(appRoot, ...segments), 'utf8');
const readJson = (...segments) => JSON.parse(read(...segments));

const expectedNode = '22.23.2';
const expectedPnpm = '10.34.5';
const failures = [];

const root = readJson('package.json');
const client = readJson('client', 'package.json');
const backend = readJson('backend', 'package.json');
const functions = readJson('backend', 'functions', 'package.json');
const eas = readJson('client', 'eas.json');
const workspace = read('pnpm-workspace.yaml');

const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

expect(root.packageManager === `pnpm@${expectedPnpm}`, 'root packageManager');
expect(root.engines?.node === expectedNode, 'root Node version');
expect(client.engines?.node === expectedNode, 'client Node version');
// backend は scaffold の薄い package。メジャーだけを固定している。
expect(backend.engines?.node === '22', 'backend Node major version');
expect(!client.packageManager, 'client must not declare packageManager');
expect(functions.engines?.node === '22', 'Functions runtime major version');
expect(functions.engines?.pnpm === expectedPnpm, 'Functions pnpm version');
// functions は workspace 外。emulator と deploy が functions 直下の node_modules に
// 実体を要求するため、isolated を崩すと起動しない。
expect(workspace.includes('nodeLinker: isolated'), 'isolated node linker');
expect(eas.build?.base?.node === expectedNode, 'EAS Node version');
expect(eas.build?.base?.pnpm === expectedPnpm, 'EAS pnpm version');
// EAS は固定版の pnpm を直接入れる。先に Corepack を有効にすると EEXIST で落ちる。
expect(eas.build?.base?.corepack === false, 'EAS direct pnpm installation');

if (failures.length > 0) {
  throw new Error(`Toolchain invariant failed: ${failures.join(', ')}`);
}

console.log(`Toolchain OK: Node ${expectedNode}, pnpm ${expectedPnpm}`);

const runningNode = process.versions.node;
if (runningNode !== expectedNode) {
  console.warn(`  警告: 実行中の Node は ${runningNode} です（宣言は ${expectedNode}）。`);
  console.warn('  install 時に engines の WARN が出ます。動きますが版を揃えることを勧めます。');
}
