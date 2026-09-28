import type {
  answerEditorType,
  questionEditorType,
  TestData,
} from '@shared/types/contracts';

export const CSV_CELL_LIMIT = 30_000;
export const OVER_LIMIT_PLACEHOLDER = '<<文字数オーバー>>';
export const CSV_IMPORT_FORMAT_ERROR_MESSAGE =
  'CSVは UTF-16 LE with BOM / 改行コード CRLF 形式のみインポートできます。エクスポートしたCSVをその形式のまま使用してください。';

export const OVER_LIMIT_FIELDS_COLUMN = '__over_limit_fields' as const;

// v1の列順（MD5同一性のため固定）
export const TEST_DATA_CSV_V1_COLUMNS = [
  'key',
  'grade',
  'subject',
  'no',
  'testNo',

  'active',

  'answerNumber',
  'answerText',
  'answerText1',
  'answerText2',
  'answerText3',
  'answerText4',
  'answerText5',
  'answerOld',

  'bigCategoryTag',
  'smallCategoryTag',
  'themeTag',

  'text',
  'questionOld',

  'ch1',
  'ch2',
  'ch3',
  'ch4',
  'ch5',
  'difficult',
  'nengo',
  'year',
  'status',

  'isConvertibleQaa',
  'isShuffleable',
  'isNegativeAnswer',

  'parentNo',
  'parentbNo',

  'otherTags',
  'isOriginal',
  'publicationYear',
  'publicationNo',
  'questionEditorType',
  'answerEditorType',
  'autoCheck',
  'calibrationCheck',

  'questionMetaFileName',
  'answerMetaFileName',
  'id',
  'uuid',

  OVER_LIMIT_FIELDS_COLUMN,
] as const;

export type TestDataCsvV1Column = (typeof TEST_DATA_CSV_V1_COLUMNS)[number];

// CSV上の1行（すべて文字列で保持）
export type TestDataCsvV1Record = Record<TestDataCsvV1Column, string>;

export type ValidationError = {
  rowIndex1: number; // 1始まり（ヘッダ除く）
  key?: string;
  message: string;
};

export type ParsedCsv = {
  headers: string[];
  rows: TestDataCsvV1Record[];
  errors: ValidationError[];
};

// 更新不可（検証のみ、パッチには入れない）
const IMMUTABLE_COLUMNS: ReadonlySet<TestDataCsvV1Column> = new Set([
  'grade',
  'no',
  'testNo',
  'subject',
  // uuid はインポート時に読み捨てる（既存 uuid を上書きしない）
  'uuid',
]);

// uuid は旧形式CSVとの互換のため必須列から除外する
const OPTIONAL_COLUMNS: ReadonlySet<TestDataCsvV1Column> = new Set([
  'uuid',
  OVER_LIMIT_FIELDS_COLUMN,
]);

const REQUIRED_COLUMNS: ReadonlyArray<TestDataCsvV1Column> =
  TEST_DATA_CSV_V1_COLUMNS.filter((c) => !OPTIONAL_COLUMNS.has(c));

const V1_COLUMN_SET: ReadonlySet<string> = new Set(TEST_DATA_CSV_V1_COLUMNS);

function escapeCsvCell(raw: string): string {
  const v = raw.replaceAll('"', '""');
  return `"${v}"`;
}

function toCellString(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

function recordToCsvLine(rec: TestDataCsvV1Record): string {
  return TEST_DATA_CSV_V1_COLUMNS.map((c) => escapeCsvCell(rec[c] ?? '')).join(
    ',',
  );
}

function stripBomChar(s: string): string {
  return s.replace(/^\uFEFF/, '');
}

function required(rec: Record<string, string>, k: string): string | null {
  const v = rec[k];
  if (typeof v !== 'string' || v.length === 0) return null;
  return v;
}

function parseIntStrict(s: string): number | null {
  if (!/^-?\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

function toRecord(headers: string[], row: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < headers.length; i++) {
    out[headers[i]] = row[i] ?? '';
  }
  return out;
}

function parseBooleanOrEmpty(s: string): boolean | undefined | null {
  if (s === '') return undefined;
  if (s === 'true') return true;
  if (s === 'false') return false;
  return null;
}

function parseStringArrayJsonOrEmpty(s: string): string[] | undefined | null {
  if (s === '') return undefined;
  try {
    const v = JSON.parse(s);
    if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return v;
    return null;
  } catch {
    return null;
  }
}

function parseOverLimitFieldsJson(cell: string): string[] | null {
  if (cell === '') return [];
  try {
    const v = JSON.parse(cell);
    if (!Array.isArray(v) || !v.every((x) => typeof x === 'string'))
      return null;

    for (const x of v) {
      if (!V1_COLUMN_SET.has(x)) return null;
      if (x === 'key' || x === OVER_LIMIT_FIELDS_COLUMN) return null;
    }
    return v;
  } catch {
    return null;
  }
}

export function makeTestDataCsvV1Record(input: {
  key: string;
  data: TestData;
}): TestDataCsvV1Record {
  const { key, data } = input;

  const otherTags =
    Array.isArray(data.otherTags) && data.otherTags.length > 0
      ? JSON.stringify(data.otherTags)
      : '';

  const out: TestDataCsvV1Record = {
    key: toCellString(key),
    grade: toCellString(data.grade),
    subject: toCellString(data.subject),
    no: toCellString(data.no),
    testNo: toCellString(data.testNo),

    active: toCellString(Boolean(data.active)),

    answerNumber: toCellString(data.answerNumber),
    answerText: toCellString(data.answerText),
    answerText1: toCellString(data.answerText1),
    answerText2: toCellString(data.answerText2),
    answerText3: toCellString(data.answerText3),
    answerText4: toCellString(data.answerText4),
    answerText5: toCellString(data.answerText5),
    answerOld: toCellString(data.answerOld),

    bigCategoryTag: toCellString(data.bigCategoryTag),
    smallCategoryTag: toCellString(data.smallCategoryTag),
    themeTag: toCellString(data.themeTag),

    text: toCellString(data.text),
    questionOld: toCellString(data.questionOld),

    ch1: toCellString(data.ch1),
    ch2: toCellString(data.ch2),
    ch3: toCellString(data.ch3),
    ch4: toCellString(data.ch4),
    ch5: toCellString(data.ch5),
    difficult: toCellString(data.difficult),
    nengo: toCellString(data.nengo),
    year: toCellString(data.year),
    status: toCellString(data.status),

    isConvertibleQaa: toCellString(Boolean(data.isConvertibleQaa)),
    isShuffleable:
      data.isShuffleable === undefined
        ? ''
        : toCellString(Boolean(data.isShuffleable)),
    isNegativeAnswer: toCellString(Boolean(data.isNegativeAnswer)),

    parentNo: toCellString(data.parentNo),
    parentbNo: toCellString(data.parentbNo),

    otherTags,
    isOriginal:
      data.isOriginal === undefined
        ? ''
        : toCellString(Boolean(data.isOriginal)),
    publicationYear: toCellString(data.publicationYear),
    publicationNo: toCellString(data.publicationNo),
    questionEditorType: toCellString(data.questionEditorType),
    answerEditorType: toCellString(data.answerEditorType),
    autoCheck:
      data.autoCheck === undefined ? '' : toCellString(Boolean(data.autoCheck)),
    calibrationCheck:
      data.calibrationCheck === undefined
        ? ''
        : toCellString(Boolean(data.calibrationCheck)),

    questionMetaFileName: toCellString(data.questionMetaFileName),
    answerMetaFileName: toCellString(data.answerMetaFileName),
    id: toCellString(data.id),
    uuid: toCellString(data.uuid),

    [OVER_LIMIT_FIELDS_COLUMN]: '[]',
  };

  // 30,000文字超置換 + __over_limit_fields 生成（列順に従い決定的に）
  const overLimitFields: string[] = [];
  for (const c of TEST_DATA_CSV_V1_COLUMNS) {
    if (c === 'key' || c === OVER_LIMIT_FIELDS_COLUMN) continue;
    const raw = out[c] ?? '';
    if (raw.length > CSV_CELL_LIMIT) {
      out[c] = OVER_LIMIT_PLACEHOLDER;
      overLimitFields.push(c);
    }
  }
  out[OVER_LIMIT_FIELDS_COLUMN] = JSON.stringify(overLimitFields);

  return out;
}

export function stringifyTestDataCsvV1(
  items: Array<{ key: string; data: TestData }>,
): string {
  const header = TEST_DATA_CSV_V1_COLUMNS.join(',');
  const lines = items
    .slice()
    .map((it) => recordToCsvLine(makeTestDataCsvV1Record(it)));

  return `${[header, ...lines].join('\r\n')}\r\n`;
}

// UTF-16LE(BOM)（Buffer非依存）
export function encodeUtf16LeBom(text: string): Uint8Array {
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

export function decodeUtf16LeBom(bytes: Uint8Array): string {
  let start = 0;
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) start = 2;
  if ((bytes.length - start) % 2 !== 0) {
    throw new Error('UTF-16LEとして不正なバイト長です');
  }

  const codes: number[] = [];
  for (let i = start; i < bytes.length; i += 2) {
    codes.push(bytes[i] | (bytes[i + 1] << 8));
  }

  let out = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < codes.length; i += CHUNK) {
    out += String.fromCharCode(...codes.slice(i, i + CHUNK));
  }
  return out;
}

function hasInvalidLineBreak(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n' && text[i - 1] !== '\r') return true;
    if (ch === '\r' && text[i + 1] !== '\n') return true;
  }
  return false;
}

export type CsvImportFormatValidationResult =
  | { ok: true; text: string }
  | { ok: false; message: string };

export function validateCsvImportBytesFormat(
  bytes: Uint8Array,
): CsvImportFormatValidationResult {
  if (bytes.length < 2 || bytes[0] !== 0xff || bytes[1] !== 0xfe) {
    return { ok: false, message: CSV_IMPORT_FORMAT_ERROR_MESSAGE };
  }

  let text = '';
  try {
    text = decodeUtf16LeBom(bytes);
  } catch {
    return { ok: false, message: CSV_IMPORT_FORMAT_ERROR_MESSAGE };
  }

  if (hasInvalidLineBreak(text)) {
    return { ok: false, message: CSV_IMPORT_FORMAT_ERROR_MESSAGE };
  }

  return { ok: true, text };
}

export function stringifyTestDataCsvV1Bytes(
  items: Array<{ key: string; data: TestData }>,
): Uint8Array {
  return encodeUtf16LeBom(stringifyTestDataCsvV1(items));
}

// 最小CSVパーサ（クォート/改行/カンマ/"" に対応）
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let i = 0;
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = '';
  };
  const pushRow = () => {
    if (row.length === 1 && row[0] === '' && rows.length > 0) return;
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1];
        if (next === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (ch === ',') {
      pushCell();
      i += 1;
      continue;
    }

    if (ch === '\r') {
      if (text[i + 1] === '\n') {
        pushCell();
        pushRow();
        i += 2;
        continue;
      }
      pushCell();
      pushRow();
      i += 1;
      continue;
    }

    if (ch === '\n') {
      pushCell();
      pushRow();
      i += 1;
      continue;
    }

    cell += ch;
    i += 1;
  }

  pushCell();
  if (row.some((v) => v !== '')) pushRow();

  return rows;
}

export function parseTestDataCsvV1(text: string): ParsedCsv {
  const table = parseCsv(text);
  const errors: ValidationError[] = [];
  if (table.length === 0) {
    return {
      headers: [],
      rows: [],
      errors: [{ rowIndex1: 0, message: 'CSVが空です' }],
    };
  }

  const headers = table[0].map((h, i) =>
    (i === 0 ? stripBomChar(h) : h).trim(),
  );
  const headerSet = new Set(headers);

  // 必須列（v1契約） ※ __over_limit_fields は「無い場合は[]扱い」で許容
  for (const col of REQUIRED_COLUMNS) {
    if (!headerSet.has(col)) {
      errors.push({ rowIndex1: 0, message: `必須列 ${col} が見つかりません` });
    }
  }
  if (errors.length > 0) return { headers, rows: [], errors };

  const rows: TestDataCsvV1Record[] = [];
  for (let r = 1; r < table.length; r++) {
    const recAny = toRecord(headers, table[r]);
    const rowIndex1 = r;

    const key = required(recAny, 'key');
    const gradeStr = required(recAny, 'grade');
    const noStr = required(recAny, 'no');
    const testNo = required(recAny, 'testNo');

    if (!key) {
      errors.push({ rowIndex1, message: 'key が空です' });
      continue;
    }
    if (!gradeStr) {
      errors.push({ rowIndex1, key, message: 'grade が空です' });
      continue;
    }
    if (!noStr) {
      errors.push({ rowIndex1, key, message: 'no が空です' });
      continue;
    }
    if (!testNo) {
      errors.push({ rowIndex1, key, message: 'testNo が空です' });
      continue;
    }

    const grade = parseIntStrict(gradeStr);
    const no = parseIntStrict(noStr);
    if (grade === null || (grade !== 0 && grade !== 1)) {
      errors.push({ rowIndex1, key, message: `grade が不正です: ${gradeStr}` });
      continue;
    }
    if (no === null || no < 0) {
      errors.push({ rowIndex1, key, message: `no が不正です: ${noStr}` });
      continue;
    }

    const prefix = key.split('/')[0];
    const expectedGrade =
      prefix === 'firstGrade' ? 0 : prefix === 'secondGrade' ? 1 : null;
    if (expectedGrade === null) {
      errors.push({
        rowIndex1,
        key,
        message: `key のコレクションが不正です: ${key}`,
      });
      continue;
    }
    if (expectedGrade !== grade) {
      errors.push({
        rowIndex1,
        key,
        message: `key と grade が不一致です: key=${key}, grade=${grade}`,
      });
      continue;
    }

    const docId = key.split('/').at(-1) ?? '';
    if (docId !== String(no)) {
      errors.push({
        rowIndex1,
        key,
        message: `key のdocIdと no が不一致です: docId=${docId}, no=${no}`,
      });
      continue;
    }

    const rawMeta = recAny[OVER_LIMIT_FIELDS_COLUMN] ?? '';
    const overLimitFields = parseOverLimitFieldsJson(rawMeta);
    if (overLimitFields === null) {
      errors.push({
        rowIndex1,
        key,
        message: `${OVER_LIMIT_FIELDS_COLUMN} のJSONが不正です: ${rawMeta}`,
      });
      continue;
    }

    const out = {} as TestDataCsvV1Record;
    for (const c of TEST_DATA_CSV_V1_COLUMNS) {
      if (c === OVER_LIMIT_FIELDS_COLUMN) {
        out[c] = JSON.stringify(overLimitFields);
      } else {
        out[c] = recAny[c] ?? '';
      }
    }
    rows.push(out);
  }

  return { headers, rows, errors };
}

export function parseTestDataCsvV1Bytes(bytes: Uint8Array): ParsedCsv {
  return parseTestDataCsvV1(decodeUtf16LeBom(bytes));
}

export type BuildPatchResult =
  | {
      ok: true;
      path: string;
      data: Partial<TestData>;
      skippedColumns: string[];
    }
  | { ok: false; message: string; skippedColumns: string[] };

export function buildFirestorePatchFromCsvV1(params: {
  row: TestDataCsvV1Record;
  existing: TestData;
}): BuildPatchResult {
  const { row, existing } = params;
  const path = row.key;
  const skippedColumns: string[] = [];

  // immutable一致検証（既存と一致していること）
  const grade = parseIntStrict(row.grade);
  const no = parseIntStrict(row.no);
  if (grade === null) {
    return { ok: false, message: 'grade が不正です', skippedColumns };
  }
  if (no === null) {
    return { ok: false, message: 'no が不正です', skippedColumns };
  }
  if (existing.grade !== grade) {
    return {
      ok: false,
      message: `grade が既存と不一致です: csv=${grade}, existing=${existing.grade}`,
      skippedColumns,
    };
  }
  if (existing.no !== no) {
    return {
      ok: false,
      message: `no が既存と不一致です: csv=${no}, existing=${existing.no}`,
      skippedColumns,
    };
  }
  if (existing.testNo !== row.testNo) {
    return {
      ok: false,
      message: `testNo が既存と不一致です: csv=${row.testNo}, existing=${existing.testNo}`,
      skippedColumns,
    };
  }
  if (existing.subject !== row.subject) {
    return {
      ok: false,
      message: `subject が既存と不一致です: csv=${row.subject}, existing=${existing.subject}`,
      skippedColumns,
    };
  }

  const meta = row[OVER_LIMIT_FIELDS_COLUMN] ?? '';
  const overLimitFields = parseOverLimitFieldsJson(meta);
  if (overLimitFields === null) {
    return {
      ok: false,
      message: `${OVER_LIMIT_FIELDS_COLUMN} のJSONが不正です: ${meta}`,
      skippedColumns,
    };
  }
  const overLimitSet = new Set(overLimitFields);

  const data: Partial<TestData> = {};

  for (const c of TEST_DATA_CSV_V1_COLUMNS) {
    if (c === 'key' || c === OVER_LIMIT_FIELDS_COLUMN) continue;
    if (IMMUTABLE_COLUMNS.has(c)) continue;

    if (overLimitSet.has(c)) {
      skippedColumns.push(c);
      continue;
    }

    const cell = row[c] ?? '';

    // metaが無いCSVでも安全側に倒す（プレースホルダは更新不可）
    if (cell === OVER_LIMIT_PLACEHOLDER) {
      skippedColumns.push(c);
      continue;
    }

    if (c === 'otherTags') {
      const parsed = parseStringArrayJsonOrEmpty(cell);
      if (parsed === null) {
        return {
          ok: false,
          message: `otherTags のJSONが不正です: ${cell}`,
          skippedColumns,
        };
      }
      if (parsed !== undefined) data.otherTags = parsed;
      continue;
    }

    if (c === 'isOriginal') {
      const b = parseBooleanOrEmpty(cell);
      if (b === null) {
        return {
          ok: false,
          message: `isOriginal が不正です: ${cell}`,
          skippedColumns,
        };
      }
      if (b !== undefined) data.isOriginal = b;
      continue;
    }

    if (c === 'autoCheck') {
      const b = parseBooleanOrEmpty(cell);
      if (b === null) {
        return {
          ok: false,
          message: `autoCheck が不正です: ${cell}`,
          skippedColumns,
        };
      }
      if (b !== undefined) data.autoCheck = b;
      continue;
    }

    if (c === 'calibrationCheck') {
      const b = parseBooleanOrEmpty(cell);
      if (b === null) {
        return {
          ok: false,
          message: `calibrationCheck が不正です: ${cell}`,
          skippedColumns,
        };
      }
      if (b !== undefined) data.calibrationCheck = b;
      continue;
    }

    if (c === 'questionEditorType') {
      if (cell !== '') data.questionEditorType = cell as questionEditorType;
      continue;
    }
    if (c === 'answerEditorType') {
      if (cell !== '') data.answerEditorType = cell as answerEditorType;
      continue;
    }

    // optional string（空は更新しない）
    if (c === 'answerOld' || c === 'publicationYear' || c === 'publicationNo') {
      if (cell !== '') data[c] = cell;
      continue;
    }
    if (c === 'active') {
      const b = parseBooleanOrEmpty(cell);
      if (b === null || b === undefined) {
        return {
          ok: false,
          message: `active が不正です: ${cell}`,
          skippedColumns,
        };
      }
      data.active = b;
      continue;
    }

    if (c === 'isConvertibleQaa') {
      const b = parseBooleanOrEmpty(cell);
      if (b === null || b === undefined) {
        return {
          ok: false,
          message: `isConvertibleQaa が不正です: ${cell}`,
          skippedColumns,
        };
      }
      data.isConvertibleQaa = b;
      continue;
    }

    if (c === 'isShuffleable') {
      const b = parseBooleanOrEmpty(cell);
      if (b === null) {
        return {
          ok: false,
          message: `isShuffleable が不正です: ${cell}`,
          skippedColumns,
        };
      }
      if (b !== undefined) data.isShuffleable = b;
      continue;
    }

    if (c === 'isNegativeAnswer') {
      const b = parseBooleanOrEmpty(cell);
      if (b === null || b === undefined) {
        return {
          ok: false,
          message: `isNegativeAnswer が不正です: ${cell}`,
          skippedColumns,
        };
      }
      data.isNegativeAnswer = b;
      continue;
    }

    if (c === 'parentNo') {
      if (cell === '') {
        return { ok: false, message: 'parentNo が空です', skippedColumns };
      }
      const n = parseIntStrict(cell);
      if (n === null) {
        return {
          ok: false,
          message: `parentNo が不正です: ${cell}`,
          skippedColumns,
        };
      }
      data.parentNo = n;
      continue;
    }

    // optional string（空は更新しない）に追加
    if (
      c === 'questionOld' ||
      c === 'parentbNo' ||
      c === 'questionMetaFileName' ||
      c === 'answerMetaFileName' ||
      c === 'id'
    ) {
      if (cell !== '') data[c] = cell;
      continue;
    }

    // required string（空文字も更新値として許容）
    data[c as keyof Partial<TestData>] = cell;
  }

  return { ok: true, path, data, skippedColumns };
}
