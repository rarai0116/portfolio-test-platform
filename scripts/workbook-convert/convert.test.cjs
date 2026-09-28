#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const zlib = require('node:zlib');

const {
  buildParentbNo, collectImageKeys, convert, packAsArray, projectDoc, validateDoc,
} = require('./convertTestData.cjs');
const { renderFormulas } = require('./renderFormulas.cjs');
const { toMobilePng } = require('./pngToMobile.cjs');
const { buildStoredZip, readStoredZip } = require('./zipBundle.cjs');
const { buildDocuments, readMockAccounts } = require('./seedAppState.cjs');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function temporaryDirectory(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbook-convert-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

// ---- テスト用の素材 ----

/** 単色の 8bit RGB PNG を作る（フィルタは None のみ）。 */
function makePng(width, height, rgb = [10, 20, 30]) {
  const stride = width * 3;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    for (let x = 0; x < width; x += 1) {
      const o = y * (stride + 1) + 1 + x * 3;
      raw[o] = rgb[0]; raw[o + 1] = rgb[1]; raw[o + 2] = rgb[2];
    }
  }
  const crc = (buf) => {
    let c = -1;
    for (let i = 0; i < buf.length; i += 1) {
      c ^= buf[i];
      for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    return (c ^ -1) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const s = (v) => ({ stringValue: String(v) });

function sourceDoc(overrides = {}) {
  const base = {
    no: s(1), grade: s(0), subject: s('学科Ⅰ'), testNo: s('1'), year: s('2024'),
    text: s('<p>本文です。十分な長さがあります。</p>'),
    answerText: s('<p>解説</p>'), answerNumber: s('2'),
    publicationYear: s('2024'), publicationNo: s('7'),
    ch1: s('<p>選択肢1</p>'), ch2: s('<p>選択肢2</p>'),
    ch3: s('<p>選択肢3</p>'), ch4: s('<p>選択肢4</p>'),
    active: s('true'), uuid: s('捨てられるはず'),
  };
  return { ...base, ...overrides };
}

function mockIo(docs, images = {}) {
  const writes = { storage: [], database: {} };
  return {
    writes,
    async listDocs() { return docs; },
    async readImage(grade, key) { return images[key] || null; },
    async writeStorage(p, buffer, contentType) { writes.storage.push({ path: p, size: buffer.length, contentType }); },
    async writeDatabase(p, value) { writes.database[p] = value; },
  };
}

// ---- 射影と検証 ----

test('projectDoc carries, derives and drops the expected fields', () => {
  const source = {
    no: 1, grade: 0, subject: '学科Ⅰ', text: '本文', answerText: '解説', answerNumber: '2',
    publicationYear: '2024', publicationNo: '7', ch1: 'a', ch2: 'b', ch3: 'c', ch4: 'd',
    uuid: 'x', autoCheck: true, deleted: false, createdAt: 'y',
  };
  const out = projectDoc(source, 'firstGrade');
  assert.equal(out.status, '正常');
  assert.equal(out.answer, '2');
  assert.equal(out.parentbNo, '2024_学科Ⅰ_007');
  assert.equal(out.parentHonbun, '本文');
  assert.equal(out.parentAnswerHonbun, '解説');
  // 捨てるフィールドが混ざらない
  for (const dropped of ['uuid', 'autoCheck', 'deleted', 'createdAt', 'publicationYear', 'publicationNo']) {
    assert.equal(out[dropped], undefined, `${dropped} が残っている`);
  }
});

test('parentbNo zero-pads the publication number to three digits', () => {
  assert.equal(buildParentbNo('2024', '学科Ⅰ', 7), '2024_学科Ⅰ_007');
  assert.equal(buildParentbNo('2024', '学科Ⅴ', 123), '2024_学科Ⅴ_123');
});

test('validateDoc rejects the cases that cannot be migrated', () => {
  const ok = {
    text: '本文です。十分な長さ', ch1: 'a', ch2: 'b', ch3: 'c', ch4: 'd',
    publicationYear: '2024', publicationNo: '1', subject: '学科Ⅰ',
  };
  assert.deepEqual(validateDoc(ok, 'firstGrade'), []);
  // secondGrade は 5 択なので 4 択では落ちる
  assert.ok(validateDoc(ok, 'secondGrade').some((r) => /選択肢/.test(r)));
  assert.ok(validateDoc({ ...ok, text: '' }, 'firstGrade').some((r) => /本文/.test(r)));
  assert.ok(validateDoc({ ...ok, publicationNo: '' }, 'firstGrade').some((r) => /publicationNo/.test(r)));
});

test('collectImageKeys reads the 33 character key from img alt without transforming it', () => {
  const key = 'DeF69FCI-AE53f9E6J7iQtM1oLi5mUMAe';
  assert.equal(key.length, 33);
  const doc = { text: `<p><img alt="${key}" height="10"></p>`, answerText: `<img alt="${key}">` };
  assert.deepEqual(collectImageKeys(doc), [key]);
});

// ---- 数式 ----

test('renderFormulas fills the empty ql-formula span that the webview cannot render', () => {
  const input = '<p>式は<span class="ql-formula" data-value="\\dfrac{N}{B}"></span>である。</p>';
  const result = renderFormulas(input);
  assert.equal(result.rendered, 1);
  assert.equal(result.errors.length, 0);
  assert.match(result.html, /<span class="katex">/);
  assert.match(result.html, /contenteditable="false"/);
});

test('renderFormulas reports broken latex and leaves the html untouched', () => {
  const input = '<span class="ql-formula" data-value="\\nosuchcommand{x}"></span>';
  const result = renderFormulas(input);
  assert.equal(result.rendered, 0);
  assert.equal(result.errors.length, 1);
  assert.equal(result.html, input);
});

// ---- 画像 ----

test('toMobilePng halves the dimensions and emits 8bit grayscale', () => {
  const out = toMobilePng(makePng(40, 20, [255, 0, 0]));
  assert.deepEqual(out.from, { width: 40, height: 20 });
  assert.deepEqual(out.to, { width: 20, height: 10 });
  // IHDR のデータは 署名8 + 長さ4 + 型4 = 16 バイト目から始まる。
  // width(4) height(4) の後が bitDepth、その次が colorType。
  const IHDR_DATA = 16;
  assert.equal(out.buffer[IHDR_DATA + 8], 8, 'bitDepth が 8 でない');
  assert.equal(out.buffer[IHDR_DATA + 9], 0, 'colorType が grayscale(0) でない');
});

test('toMobilePng refuses formats it cannot handle instead of producing a broken image', () => {
  const png = makePng(4, 4);
  png[16 + 8] = 16; // bitDepth を 16 に書き換える
  assert.throws(() => toMobilePng(png), /未対応の PNG/);
});

// ---- バンドル ----

test('buildStoredZip produces a reproducible archive that reads back', () => {
  const entries = [{ name: 'k1', data: Buffer.from('abc') }, { name: 'k2', data: Buffer.from('日本語') }];
  const zip = buildStoredZip(entries);
  assert.ok(buildStoredZip(entries).equals(zip), '同じ入力から同じ書庫にならない');
  const back = readStoredZip(zip);
  assert.deepEqual(back.map((e) => e.name), ['k1', 'k2']);
  assert.equal(back[1].data.toString('utf8'), '日本語');
});

// ---- 統合 ----

test('convert skips invalid docs and writes the nodes the client reads', async () => {
  const key = 'DeF69FCI-AE53f9E6J7iQtM1oLi5mUMAe';
  const docs = [
    { id: '1', fields: sourceDoc({ text: s(`<p>本文<img alt="${key}"></p>`) }) },
    { id: '2', fields: sourceDoc({ text: s(''), publicationNo: s('') }) }, // 不備
  ];
  const io = mockIo(docs, { [key]: makePng(20, 10) });
  const report = await convert({ io, bucket: 'example-bucket', grades: ['firstGrade'] });

  assert.equal(report.grades.firstGrade.converted, 1);
  assert.equal(report.skipped.length, 1);
  assert.match(report.skipped[0], /firstGrade\/2/);

  // クライアントが読むノードが揃っていること
  assert.ok(io.writes.database['test/firstGrade'], 'test/<grade> が無い');
  assert.ok(Array.isArray(io.writes.database['test/firstGrade']), '配列でない（0 始まりで詰める）');
  assert.ok(io.writes.database[`assets/firstGrade/b64/${key}`], 'b64 メタデータが無い');
  assert.ok(io.writes.database['assets/firstGrade/bzip/_'], 'bzip メタデータが無い');
  assert.ok(io.writes.storage.some((w) => w.path === 'assets/firstGrade/bzip/_.zip'), 'bzip 本体が無い');
  // Storage 側は .b64 拡張子つき。クライアントが `${name}.b64` で組み立てるため。
  assert.ok(io.writes.storage.some((w) => w.path === `assets/firstGrade/b64/${key}.b64`), 'b64 本体が無い');
  // RTDB のメタデータ側は拡張子なしの key
  assert.ok(io.writes.database[`assets/firstGrade/b64/${key}`], 'b64 メタデータの key が違う');

  // メタデータの bucket は引数で受けたものを使う（実名を持たない）
  assert.equal(io.writes.database[`assets/firstGrade/b64/${key}`].bucket, 'example-bucket');
});

test('convert in dry-run mode writes nothing', async () => {
  const io = mockIo([{ id: '1', fields: sourceDoc() }]);
  const report = await convert({ io, bucket: 'example-bucket', grades: ['firstGrade'], dryRun: true });
  assert.equal(report.grades.firstGrade.converted, 1);
  assert.equal(io.writes.storage.length, 0);
  assert.deepEqual(io.writes.database, {});
});

test('convert requires an explicit bucket so no real name is baked in', async () => {
  const io = mockIo([]);
  await assert.rejects(() => convert({ io, grades: ['firstGrade'] }), /bucket is required/);
});

// ---- クライアントのパス導出との整合 ----

// WorkbookApp は Storage のパスをメタデータから組み立てる（useImageAssetContext）:
//   assets/<grade>/<folder>/<name>
//   folder が b64  … name は `${metadata.name}.b64`
//   folder が html … name は metadata.path の最後のセグメント（_lib_ 接頭辞なら lib/ を付ける）
// ここがずれると実行時に 404 になるだけで、変換自体は成功したように見える。
// 実際に .b64 の拡張子を落として 36 枚すべてが取得できない状態を作ってしまった。
function clientUri(metadata) {
  const name = metadata.folder === 'b64'
    ? `${metadata.name}.b64`
    : (() => {
      const last = /\/([^/]+)$/.exec(String(metadata.path).replaceAll('%2F', '/'))?.[1] ?? '';
      if (last === '') return '';
      return metadata.name.startsWith('_lib_') ? `lib/${last}` : last;
    })();
  return name === '' ? '' : `assets/${metadata.grade}/${metadata.folder}/${name}`;
}

test('written storage paths match what the client derives from the metadata', async () => {
  const key = 'DeF69FCI-AE53f9E6J7iQtM1oLi5mUMAe';
  const io = mockIo(
    [{ id: '1', fields: sourceDoc({ text: s(`<p>本文<img alt="${key}"></p>`) }) }],
    { [key]: makePng(20, 10) },
  );
  await convert({
    io,
    bucket: 'example-bucket',
    grades: ['firstGrade'],
    webviews: [{ name: 'questionWebview', html: '<html></html>' }],
  });

  const written = new Set(io.writes.storage.map((w) => w.path));
  const metadataNodes = Object.entries(io.writes.database)
    .filter(([p]) => p.startsWith('assets/') && !p.includes('/bzip/'))
    .map(([, v]) => v);

  assert.ok(metadataNodes.length > 0, 'asset メタデータが書かれていない');
  for (const metadata of metadataNodes) {
    const uri = clientUri(metadata);
    assert.notEqual(uri, '', `パスを導出できない: ${JSON.stringify(metadata)}`);
    assert.ok(written.has(uri), `クライアントが要求する ${uri} に実体が無い`);
  }
});

test('webview metadata carries a path whose last segment names the stored file', async () => {
  const io = mockIo([]);
  await convert({
    io,
    bucket: 'example-bucket',
    grades: [],
    webviews: [
      { name: 'questionWebview', html: '<html>q</html>' },
      { name: 'answerWebview', html: '<html>a</html>' },
    ],
  });
  for (const name of ['questionWebview', 'answerWebview']) {
    const metadata = io.writes.database[`assets/common/html/${name}`];
    assert.ok(metadata, `${name} のメタデータが無い`);
    assert.equal(metadata.grade, 'common');
    assert.equal(metadata.folder, 'html');
    assert.equal(clientUri(metadata), `assets/common/html/${name}.html`);
    assert.ok(io.writes.storage.some((w) => w.path === `assets/common/html/${name}.html`));
    // 実プロジェクトの URL を持ち込まない
    assert.doesNotMatch(metadata.path, /https?:\/\//);
  }
});

test('convert reports when no webview is supplied because the question screen needs it', async () => {
  const io = mockIo([]);
  const report = await convert({ io, bucket: 'example-bucket', grades: [] });
  assert.ok(report.errors.some((e) => /webview/.test(e)), 'webview 未指定が報告されない');
});

// ---- 起動に必要な seed ----

// 問題データ（RTDB）だけ入れても WorkbookApp は起動しない。Firestore の値が無いと
// useLoadingContext が isVersionChecked を立てずに抜け、例外もログも出さずに止まる。
// 何を入れるかは移植元の実データから決めた。
test('app state seed covers the documents the client blocks on', () => {
  const docs = buildDocuments();
  const ids = docs.map((d) => `${d.collection}/${d.id}`);
  assert.ok(ids.includes('metadata/appVersion'), 'appVersion が無いとローディングから進まない');
  assert.ok(ids.includes('app/status'));
  for (const grade of ['firstGrade', 'secondGrade']) {
    assert.ok(ids.includes(`metadata/${grade}LastUpdate`), `${grade}LastUpdate が無いと state を設定しない`);
  }
  // 本番にも存在しないものは入れない
  assert.ok(!ids.includes('metadata/mode'), 'metadata/mode は本番に無いので入れない');

  // LastUpdate はクライアントが assets / html / test の 3 つを条件にしている
  const lastUpdate = docs.find((d) => d.id === 'firstGradeLastUpdate');
  for (const field of ['assets', 'html', 'test']) {
    assert.ok(lastUpdate.fields[field], `${field} が無いと state が設定されない`);
  }
});

// appVersion はアプリ側の CURRENT_VERSION と文字列比較される。大きいと更新モーダルが
// 出て、やはり先へ進めない。既定は常に通る "0"。
test('default app version never triggers the update modal', () => {
  const appVersion = buildDocuments().find((d) => d.id === 'appVersion');
  assert.equal(appVersion.fields.required.stringValue, '0');
  assert.equal(appVersion.fields.recommended.stringValue, '0');
});

// 移植元の auth-seed はコメントで「mockAccounts.ts と一致させること」と書いているだけで
// 実際は二重管理だった。ここでは正本を直接読む。
test('mock accounts are read from the client source of truth', (t) => {
  const root = temporaryDirectory(t);
  const file = path.join(root, 'mockAccounts.ts');
  fs.writeFileSync(file, `
export const MOCK_ACCOUNTS = {
  student: { email: 'student@example.test', password: 'pw-student' },
  teacher: { email: 't-teacher@example.test', password: 'pw-teacher' },
};
`);
  const accounts = readMockAccounts(file);
  assert.deepEqual(accounts.map((a) => a.key), ['student', 'teacher']);
  assert.equal(accounts[0].email, 'student@example.test');
  assert.equal(accounts[1].password, 'pw-teacher');
});

test('mock accounts parsing fails loudly instead of seeding nothing', (t) => {
  const root = temporaryDirectory(t);
  const file = path.join(root, 'mockAccounts.ts');
  fs.writeFileSync(file, 'export const MOCK_ACCOUNTS = {};');
  assert.throws(() => readMockAccounts(file), /読み取れませんでした/);
  assert.throws(() => readMockAccounts(path.join(root, 'missing.ts')), /見つかりません/);
});

test('convert reports when the seed cannot run', async () => {
  const io = mockIo([]);
  const report = await convert({ io, bucket: 'example-bucket', grades: [] });
  assert.ok(report.errors.some((e) => /mockAccounts/.test(e)), 'seed 不可が報告されない');
});

// ---- no と配列添字の一致 ----

// クライアントは testDataList[i].no === i を前提にしている。カテゴリ一覧は添字を持ち、
// そこから取り出したオブジェクトの no で再び testDataList を索くため、ずれると
// 別の問題が出題され、最後の 1 問では undefined になって出題開始が落ちる。
// TestManager の seed は 1 始まりなので、詰め直しに合わせて振り直す必要がある。
test('packed questions use their array index as no', () => {
  const docs = [
    { no: 1, testNo: '101', text: 'a' },
    { no: 2, testNo: '102', text: 'b' },
    { no: 3, testNo: '103', text: 'c' },
  ];
  const packed = packAsArray(docs);

  assert.deepEqual(packed.map((doc) => doc.no), [0, 1, 2]);
  for (const [index, doc] of packed.entries()) {
    assert.equal(doc.no, index, `添字 ${index} の no がずれている`);
  }

  // 末尾が範囲外を指さないこと（これが出題開始のクラッシュだった）
  assert.equal(packed[packed.length - 1].no, packed.length - 1);
  assert.equal(packed[packed[packed.length - 1].no], packed[packed.length - 1]);
});

// 表示用の番号は testNo であって no ではない。振り直しで表示が変わらないことを固定する。
test('renumbering no leaves the displayed question number untouched', () => {
  const docs = [{ no: 7, testNo: '101' }, { no: 8, testNo: '102' }];
  assert.deepEqual(packAsArray(docs).map((doc) => doc.testNo), ['101', '102']);
});

// 入力は壊さない（変換は何度流しても同じ結果になること）
test('packing does not mutate the source documents', () => {
  const docs = [{ no: 1 }, { no: 2 }];
  packAsArray(docs);
  assert.deepEqual(docs.map((doc) => doc.no), [1, 2]);
});
