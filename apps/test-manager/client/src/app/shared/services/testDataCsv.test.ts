import crypto from 'node:crypto';
import type { TestData } from '@shared/types/contracts';
import { describe, expect, it } from 'vitest';
import {
  buildFirestorePatchFromCsvV1,
  CSV_CELL_LIMIT,
  CSV_IMPORT_FORMAT_ERROR_MESSAGE,
  OVER_LIMIT_FIELDS_COLUMN,
  OVER_LIMIT_PLACEHOLDER,
  parseTestDataCsvV1Bytes,
  stringifyTestDataCsvV1Bytes,
  validateCsvImportBytesFormat,
} from './testDataCsv';

function md5Base16(bytes: Uint8Array): string {
  return crypto.createHash('md5').update(bytes).digest('hex');
}

function baseTestData(overrides?: Partial<TestData>): TestData {
  const base: TestData = {
    active: true,
    answerNumber: '1',
    answerText: 'A',
    answerText1: '',
    answerText2: '',
    answerText3: '',
    answerText4: '',
    answerText5: '',
    bigCategoryTag: '大',
    ch1: 'c1',
    ch2: 'c2',
    ch3: 'c3',
    ch4: 'c4',
    ch5: 'c5',
    difficult: '1',
    grade: 0,
    isConvertibleQaa: false,
    isNegativeAnswer: false,
    nengo: '令和',
    no: 1,
    parentNo: 0,
    smallCategoryTag: '',
    status: '準備完了',
    subject: '学科Ⅰ',
    testNo: '1',
    text: '',
    themeTag: '',
    year: '1',
  };
  return { ...base, ...(overrides ?? {}) };
}

describe('TestData CSV v1', () => {
  it('UTF-16LE(BOM) bytes を出力できる', () => {
    const bytes = stringifyTestDataCsvV1Bytes([
      { key: 'firstGrade/1', data: baseTestData() },
    ]);
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xfe);
  });

  it('UTF-16LE(BOM) かつ CRLF のCSVだけインポート形式チェックを通す', () => {
    const bytes = stringifyTestDataCsvV1Bytes([
      { key: 'firstGrade/1', data: baseTestData() },
    ]);

    expect(validateCsvImportBytesFormat(bytes)).toEqual({
      ok: true,
      text: new TextDecoder('utf-16le').decode(bytes.slice(2)),
    });
  });

  it('BOMが無いCSVはインポート形式エラーにする', () => {
    const bytes = new TextEncoder().encode('key,grade\r\nfirstGrade/1,0\r\n');

    expect(validateCsvImportBytesFormat(bytes)).toEqual({
      ok: false,
      message: CSV_IMPORT_FORMAT_ERROR_MESSAGE,
    });
  });

  it('LF改行のCSVはインポート形式エラーにする', () => {
    const bytes = encodeUtf16LeWithBomForTest('key,grade\nfirstGrade/1,0\n');

    expect(validateCsvImportBytesFormat(bytes)).toEqual({
      ok: false,
      message: CSV_IMPORT_FORMAT_ERROR_MESSAGE,
    });
  });

  it('30,000文字超はプレースホルダに置換され、__over_limit_fields に記録される', () => {
    const long = 'a'.repeat(CSV_CELL_LIMIT + 1);
    const d = baseTestData({ answerText: long });

    const bytes = stringifyTestDataCsvV1Bytes([
      { key: 'firstGrade/1', data: d },
    ]);
    const text = new TextDecoder('utf-16le').decode(bytes.slice(2)); // テスト内での確認用（BOM除去）
    expect(text).toContain(OVER_LIMIT_PLACEHOLDER);
    expect(text).toContain(OVER_LIMIT_FIELDS_COLUMN);
    expect(text).toContain('"answerText"');
  });

  it('parse→patch生成で、grade/no/testNo/subject は更新されない（subject不一致はエラー）', () => {
    const existing = baseTestData({ subject: '学科Ⅳ' });

    const bytes = stringifyTestDataCsvV1Bytes([
      { key: 'firstGrade/1', data: existing },
    ]);
    const parsed = parseTestDataCsvV1Bytes(bytes);
    expect(parsed.errors).toHaveLength(0);

    const row = parsed.rows[0];
    const editedRow = { ...row, subject: '新科目' };

    const patch = buildFirestorePatchFromCsvV1({ row: editedRow, existing });
    expect(patch.ok).toBe(false);
  });

  it('MD5: export(bytes)→import(疑似適用)→export(bytes) で一致する', () => {
    const existing = baseTestData();

    const db = new Map<string, TestData>();
    db.set('firstGrade/1', existing);

    const data = db.get('firstGrade/1');
    if (!data) throw new Error('Data not found in DB');
    const bytes1 = stringifyTestDataCsvV1Bytes([{ key: 'firstGrade/1', data }]);
    const md5_1 = md5Base16(bytes1);

    const parsed = parseTestDataCsvV1Bytes(bytes1);
    expect(parsed.errors).toHaveLength(0);

    const row = parsed.rows[0];
    const current = db.get('firstGrade/1');
    if (!current) throw new Error('Current data not found in DB');
    const patch = buildFirestorePatchFromCsvV1({ row, existing: current });
    expect(patch.ok).toBe(true);

    if (patch.ok) {
      db.set(patch.path, { ...current, ...patch.data });
    }

    const after = db.get('firstGrade/1');
    if (!after) throw new Error('After data not found in DB');

    const bytes2 = stringifyTestDataCsvV1Bytes([
      { key: 'firstGrade/1', data: after },
    ]);
    const md5_2 = md5Base16(bytes2);

    expect(md5_2).toBe(md5_1);
  });
});

function encodeUtf16LeWithBomForTest(text: string): Uint8Array {
  const out = new Uint8Array(2 + text.length * 2);
  out[0] = 0xff;
  out[1] = 0xfe;
  for (let i = 0; i < text.length; i++) {
    const codeUnit = text.charCodeAt(i);
    out[2 + i * 2] = codeUnit & 0xff;
    out[2 + i * 2 + 1] = (codeUnit >> 8) & 0xff;
  }
  return out;
}
