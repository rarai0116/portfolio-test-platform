/** biome-ignore-all lint/style/useNodejsImportProtocol: backend utility script */

const fs = require('node:fs/promises');

const admin = require('firebase-admin');

const TESTDATA_COLLECTIONS = [
  {
    collectionPath: 'firstGrade',
    indexCollectionPath: 'cacheIndex',
    indexDocIdPrefix: 'firstGrade',
    shardCount: 16,
  },
  {
    collectionPath: 'secondGrade',
    indexCollectionPath: 'cacheIndex',
    indexDocIdPrefix: 'secondGrade',
    shardCount: 16,
  },
  {
    collectionPath: 'storageList/firstGrade/images',
    indexCollectionPath: 'cacheIndex',
    indexDocIdPrefix: 'storageList_firstGrade_images',
    shardCount: 16,
  },
  {
    collectionPath: 'storageList/secondGrade/images',
    indexCollectionPath: 'cacheIndex',
    indexDocIdPrefix: 'storageList_secondGrade_images',
    shardCount: 16,
  },
];

function getGradeNumber(gradeId) {
  if (gradeId === 'firstGrade') return 0;
  if (gradeId === 'secondGrade') return 1;
  throw new Error(`unsupported grade: ${gradeId}`);
}

function getAdminApp(projectId) {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const useEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

  if (useEmulator) {
    if (!projectId) {
      throw new Error(
        'FIRESTORE_EMULATOR_HOST 利用時は --project または GCLOUD_PROJECT が必要です',
      );
    }

    return admin.initializeApp({ projectId });
  }

  if (!projectId) {
    throw new Error('--project is required when using production Firestore');
  }

  return admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId,
  });
}

function parseScalar(raw) {
  const value = raw.trim();

  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function parseFilter(expression) {
  const operators = [' not-in ', ' in ', '==', '!='];

  for (const operator of operators) {
    const index = expression.indexOf(operator);
    if (index < 0) continue;

    const field = expression.slice(0, index).trim();
    const rawValue = expression.slice(index + operator.length).trim();

    if (!field) {
      throw new Error(`invalid where expression: ${expression}`);
    }

    if (operator === ' in ' || operator === ' not-in ') {
      const values = rawValue
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map(parseScalar);

      if (values.length === 0) {
        throw new Error(`invalid where expression: ${expression}`);
      }

      return {
        field,
        operator: operator.trim(),
        value: values,
      };
    }

    return {
      field,
      operator,
      value: parseScalar(rawValue),
    };
  }

  throw new Error(`unsupported where expression: ${expression}`);
}

function matchesFilter(item, filter) {
  const left = item[filter.field];

  if (filter.operator === '==') {
    return left === filter.value;
  }

  if (filter.operator === '!=') {
    return left !== filter.value;
  }

  if (filter.operator === 'in') {
    return filter.value.includes(left);
  }

  if (filter.operator === 'not-in') {
    return !filter.value.includes(left);
  }

  return false;
}

function sanitizeRecord(record, expectedGrade) {
  const out = { ...record };
  delete out.id;
  delete out.key;
  delete out.createdAt;
  delete out.updatedAt;
  out.deleted = false;
  out.grade = expectedGrade;
  return out;
}

function validateRecord(record, index) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return `row[${index}] is not an object`;
  }

  if (
    typeof record.no !== 'number' ||
    !Number.isInteger(record.no) ||
    record.no < 0
  ) {
    return `row[${index}] has invalid no`;
  }

  if (
    typeof record.grade !== 'number' ||
    (record.grade !== 0 && record.grade !== 1)
  ) {
    return `row[${index}] has invalid grade`;
  }

  return null;
}

async function readJsonArray(inputPath) {
  const text = await fs.readFile(inputPath, 'utf8');
  const parsed = JSON.parse(text);

  if (!Array.isArray(parsed)) {
    throw new Error('input JSON must be an array');
  }

  return parsed;
}

async function selectRecordsForGrade({ inputPath, expectedGrade, filters }) {
  const records = await readJsonArray(inputPath);
  const invalidReasons = [];
  const filteredRecords = [];
  let filteredOutCount = 0;

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const reason = validateRecord(record, index);

    if (reason) {
      invalidReasons.push(reason);
      continue;
    }

    if (record.grade !== expectedGrade) {
      filteredOutCount += 1;
      continue;
    }

    const passes = filters.every((filter) => matchesFilter(record, filter));
    if (!passes) {
      filteredOutCount += 1;
      continue;
    }

    filteredRecords.push(record);
  }

  return {
    records,
    invalidReasons,
    filteredRecords,
    filteredOutCount,
  };
}

function getCollectionDefinition(collectionPath) {
  const definition = TESTDATA_COLLECTIONS.find(
    (item) => item.collectionPath === collectionPath,
  );

  if (!definition) {
    throw new Error(`unsupported collectionPath: ${collectionPath}`);
  }

  return definition;
}

function hashDocId(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function toShardSuffix(docId, shardCount) {
  const shard = hashDocId(docId) % shardCount;
  return shard.toString(16).padStart(2, '0');
}

function buildIndexDocId(definition, shardSuffix) {
  return `${definition.indexDocIdPrefix}_${shardSuffix}`;
}

module.exports = {
  admin,
  buildIndexDocId,
  getAdminApp,
  getCollectionDefinition,
  getGradeNumber,
  matchesFilter,
  parseFilter,
  readJsonArray,
  sanitizeRecord,
  selectRecordsForGrade,
  toShardSuffix,
};