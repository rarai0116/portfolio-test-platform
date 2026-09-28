'use strict';
/*
 * TestManager の TestData を WorkbookApp の形式へ変換する。
 *
 * 読む: TestManager の Firestore（firstGrade / secondGrade）と Storage（original/<grade>/<key>.png）
 * 書く: WorkbookApp の RTDB（test/<grade>、assets/<grade>/b64、assets/<grade>/bzip）と
 *       Storage（assets/<grade>/b64/<key>、assets/<grade>/bzip/_.zip）
 *
 * 実プロジェクト名・bucket 名・host は一切直書きしない。すべて引数か環境変数で受ける。
 * 本ディレクトリは公開リポジトリへ運ばれる一方、サニタイズ辞書は apps/<app> 配下しか
 * 処理しないため、ここに実名を書くと素通りで公開される。
 *
 * 使い方は README.md を参照。
 */

const fs = require('node:fs');
const path = require('node:path');

const { toMobilePng } = require('./pngToMobile.cjs');
const { renderFormulasInFields } = require('./renderFormulas.cjs');
const { buildStoredZip } = require('./zipBundle.cjs');
const { seedAppState } = require('./seedAppState.cjs');

const GRADES = ['firstGrade', 'secondGrade'];
// grade ごとの選択肢数。firstGrade は 4 択、secondGrade は 5 択。
const CHOICE_COUNT = { firstGrade: 4, secondGrade: 5 };

/** WorkbookApp の doc がそのまま引き継ぐフィールド（実データ 30 フィールドの射影）。 */
const CARRY_FIELDS = [
  'active', 'answerNumber', 'answerText', 'bigCategoryTag', 'difficult', 'grade',
  'isConvertibleQaa', 'isNegativeAnswer', 'nengo', 'no', 'parentNo',
  'smallCategoryTag', 'subject', 'testNo', 'text', 'themeTag', 'year',
];

/** KaTeX の事前描画をかける HTML フィールド。 */
const HTML_FIELDS = [
  'text', 'answerText', 'parentHonbun', 'parentAnswerHonbun',
  'ch1', 'ch2', 'ch3', 'ch4', 'ch5',
  'answerText1', 'answerText2', 'answerText3', 'answerText4', 'answerText5',
];

const IMG_ALT_RE = /<img[^>]*\balt="([^"]+)"/g;

function fieldValue(fields, name) {
  const f = fields?.[name];
  if (!f) return undefined;
  if (f.stringValue !== undefined) return f.stringValue;
  if (f.integerValue !== undefined) return Number(f.integerValue);
  if (f.booleanValue !== undefined) return f.booleanValue;
  if (f.doubleValue !== undefined) return f.doubleValue;
  return undefined;
}

/** parentbNo = <publicationYear>_<subject>_<publicationNo を 3 桁ゼロ埋め>。 */
function buildParentbNo(publicationYear, subject, publicationNo) {
  const no = String(publicationNo).padStart(3, '0');
  return `${publicationYear}_${subject}_${no}`;
}

/** 移行前チェック。落ちた理由を返す（空配列なら移行可能）。 */
function validateDoc(doc, grade) {
  const reasons = [];
  const text = String(doc.text ?? '');
  if (text.trim().length === 0) reasons.push('本文が空');

  const need = CHOICE_COUNT[grade];
  const choices = [];
  for (let i = 1; i <= need; i += 1) {
    const v = String(doc[`ch${i}`] ?? '').trim();
    if (v) choices.push(v);
  }
  if (choices.length !== need) reasons.push(`選択肢が ${choices.length}/${need}`);

  if (!doc.publicationYear) reasons.push('publicationYear が無い');
  if (!doc.publicationNo) reasons.push('publicationNo が無い');
  if (!doc.subject) reasons.push('subject が無い');
  return reasons;
}

/** HTML から <img alt> の key を集める。alt は 33 文字 key で、変換せずそのまま使う。 */
function collectImageKeys(doc) {
  const keys = new Set();
  for (const field of HTML_FIELDS) {
    const value = doc[field];
    if (typeof value !== 'string') continue;
    for (const match of value.matchAll(IMG_ALT_RE)) keys.add(match[1]);
  }
  return [...keys];
}

/**
 * TestManager の doc を WorkbookApp の doc へ射影する。
 * status は WorkbookApp 側が一律 `正常` のため固定する。
 */
function projectDoc(source, grade) {
  const out = {};
  for (const field of CARRY_FIELDS) {
    if (source[field] !== undefined) out[field] = source[field];
  }
  const need = CHOICE_COUNT[grade];
  for (let i = 1; i <= need; i += 1) {
    if (source[`ch${i}`] !== undefined) out[`ch${i}`] = source[`ch${i}`];
    if (source[`answerText${i}`] !== undefined) out[`answerText${i}`] = source[`answerText${i}`];
  }
  // 派生。answer は answerNumber を文字列にしたもの（実データで一致を確認）。
  out.answer = String(source.answerNumber ?? '');
  out.parentHonbun = source.parentHonbun ?? source.text ?? '';
  out.parentAnswerHonbun = source.parentAnswerHonbun ?? source.answerText ?? '';
  out.parentbNo = buildParentbNo(source.publicationYear, source.subject, source.publicationNo);
  out.status = '正常';
  return out;
}

/**
 * RTDB の test/<grade> は 0 始まりの連番キーで、JSON では配列になる。
 * 1 始まりのオブジェクトにすると型が変わり、Array 前提のコードが壊れうる。
 *
 * **no は配列の添字に一致させる。** クライアントは testDataList[i].no === i を前提に
 * しており、カテゴリ一覧が持つ添字から取り出したオブジェクトの no で再び索く
 * （usePracticeQuestionSetting の totalList._total → createTestDataNolist の sort）。
 * TestManager の seed は 1 始まりなので、詰め直しに合わせて振り直さないと 1 ずれ、
 * 最後の問題で testDataList[length] が undefined になって出題開始が落ちる。
 *
 * 表示上の問題番号は no ではなく testNo（generateTestDataId も testNo を使う）。
 * ここを変えても表示は変わらない。
 */
function packAsArray(docs) {
  return docs.map((doc, index) => ({ ...doc, no: index }));
}

/** Storage オブジェクトのメタデータ（asset ノードの値）を組み立てる。 */
function assetMetadata({ bucket, grade, folder, name, size, contentType, objectPath }) {
  const now = Math.floor(Date.now() / 1000);
  return {
    bucket,
    contentType,
    folder,
    generation: now * 1000000,
    grade,
    name,
    // クライアントは folder が html のとき、path の最後のセグメントをファイル名として使う
    // （URL としては使わない。実データでは URL が入っていたが参照箇所はコメントアウト済み）。
    // 実プロジェクトの URL を書かないよう、Storage 内の相対パスをそのまま入れる。
    path: objectPath || `assets/${grade}/${folder}/${name}`,
    size,
    status: 'active',
    createdAt: { _seconds: now, _nanoseconds: 0 },
    updatedAt: { _seconds: now, _nanoseconds: 0 },
  };
}

/**
 * 変換本体。I/O は呼び出し側から渡す（emulator でも実プロジェクトでも動かせるように）。
 *
 * io.listDocs(grade)        -> [{ id, fields }]
 * io.readImage(grade, key)  -> Buffer | null
 * io.writeStorage(path, buf, contentType)
 * io.writeDatabase(path, value)
 */
/**
 * 出題画面の webview を配置する。
 *
 * クライアントは assets/common/html/ を読み、folder が html のときは
 * path の最後のセグメントをファイル名として使う（useImageAssetContext の name 導出）。
 * これが無いと出題画面そのものが表示されない。TestManager 側に対応物が無いため、
 * 呼び出し側から中身を渡してもらう。
 *
 * webviews: [{ name, html }]  name は questionWebview / answerWebview
 */
async function placeWebviews({ io, bucket, webviews, dryRun, report }) {
  for (const { name, html } of webviews) {
    const fileName = `${name}.html`;
    const objectPath = `assets/common/html/${fileName}`;
    const buffer = Buffer.from(html, 'utf8');
    report.webviews.push(`${name} (${buffer.length} bytes)`);
    if (dryRun) continue;
    await io.writeStorage(objectPath, buffer, 'text/html');
    await io.writeDatabase(`assets/common/html/${name}`, assetMetadata({
      bucket, grade: 'common', folder: 'html', name,
      size: buffer.length, contentType: 'text/html', objectPath,
    }));
  }
}

async function convert({
  io, bucket, grades = GRADES, dryRun = false, webviews = [],
  mockAccountsPath = '', appVersion, log = console.log,
}) {
  if (!bucket) throw new Error('bucket is required（実名を直書きしないため引数で受ける）');
  const report = {
    bucket, dryRun, grades: {}, skipped: [], errors: [], formulasRendered: 0,
    images: { converted: 0, bytesIn: 0, bytesOut: 0, missing: [] },
    webviews: [], firestore: [], authAccounts: [],
  };

  // 問題データだけでは起動しない。Firestore の状態と模擬アカウントが要る
  // （理由は seedAppState.cjs を参照）。
  if (mockAccountsPath) {
    await seedAppState({ io, mockAccountsPath, appVersion, dryRun, report });
  } else {
    report.errors.push('mockAccounts のパスが渡されていない（起動に必要な seed を作れない）');
  }

  if (webviews.length > 0) await placeWebviews({ io, bucket, webviews, dryRun, report });
  else report.errors.push('webview が渡されていない（出題画面が表示できない）');

  for (const grade of grades) {
    const docs = await io.listDocs(grade);
    const converted = [];
    const imageKeys = new Set();

    for (const { id, fields } of docs) {
      const source = {};
      for (const key of Object.keys(fields || {})) source[key] = fieldValue(fields, key);

      const reasons = validateDoc(source, grade);
      if (reasons.length > 0) {
        report.skipped.push(`${grade}/${id}: ${reasons.join(', ')}`);
        continue;
      }

      const rendered = renderFormulasInFields(source, HTML_FIELDS, { location: `${grade}/${id}` });
      report.formulasRendered += rendered.rendered;
      report.errors.push(...rendered.errors);
      if (rendered.errors.length > 0) {
        report.skipped.push(`${grade}/${id}: 数式の描画に失敗`);
        continue;
      }

      for (const key of collectImageKeys(rendered.doc)) imageKeys.add(key);
      converted.push(projectDoc(rendered.doc, grade));
    }

    // 画像: グレースケール 1/2 へ落とし、b64 テキストとして Storage へ。
    const b64Entries = [];
    for (const key of [...imageKeys].sort()) {
      const original = await io.readImage(grade, key);
      if (!original) {
        report.images.missing.push(`${grade}/${key}`);
        continue;
      }
      const mobile = toMobilePng(original);
      const b64 = mobile.buffer.toString('base64');
      report.images.converted += 1;
      report.images.bytesIn += original.length;
      report.images.bytesOut += mobile.buffer.length;
      b64Entries.push({ key, b64 });
      if (!dryRun) {
        // クライアントは Storage のパスをメタデータから組み立てる:
        //   assets/<grade>/<folder>/<name>  で、folder が b64 のとき name は `${name}.b64`。
        // 拡張子を落とすとダウンロードが 404 になる（useImageAssetContext の name 導出）。
        await io.writeStorage(`assets/${grade}/b64/${key}.b64`, Buffer.from(b64, 'utf8'), 'text/plain');
        await io.writeDatabase(`assets/${grade}/b64/${key}`, assetMetadata({
          bucket, grade, folder: 'b64', name: key, size: b64.length, contentType: 'text/plain',
        }));
      }
    }

    // 画像配信の主経路は個別取得ではなく、この zip バンドル。
    // 生成しないとクライアントは画像を一枚も表示できない。
    if (!dryRun) {
      const zip = buildStoredZip(b64Entries.map((e) => ({ name: e.key, data: Buffer.from(e.b64, 'utf8') })));
      await io.writeStorage(`assets/${grade}/bzip/_.zip`, zip, 'application/zip');
      await io.writeDatabase(`assets/${grade}/bzip/_`, assetMetadata({
        bucket, grade, folder: 'bzip', name: '_', size: zip.length, contentType: 'application/zip',
      }));
      await io.writeDatabase(`test/${grade}`, packAsArray(converted));
    }

    report.grades[grade] = {
      source: docs.length,
      converted: converted.length,
      images: b64Entries.length,
    };
    log(`[convert] ${grade}: ${converted.length}/${docs.length} docs, ${b64Entries.length} images`);
  }
  return report;
}

module.exports = {
  CARRY_FIELDS, CHOICE_COUNT, HTML_FIELDS,
  assetMetadata, buildParentbNo, collectImageKeys, convert, packAsArray,
  placeWebviews, projectDoc, validateDoc,
};
