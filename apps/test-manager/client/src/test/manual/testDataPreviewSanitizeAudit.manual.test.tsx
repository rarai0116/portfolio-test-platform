import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  type SanitizerRejectionReport,
  sanitizeForPreviewRender,
} from '@api/htmlSanitizer';
import type { TestData } from '@shared/types/contracts';
import { HTML_FIELDS } from '@views/testDataEditor/api/testDataUtils';
import { FirebaseError, getApp, getApps, initializeApp } from 'firebase/app';
import {
  type Auth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  type Firestore,
  getDocs,
  getFirestore,
} from 'firebase/firestore';
import {
  connectFunctionsEmulator,
  type Functions,
  getFunctions,
  httpsCallable,
} from 'firebase/functions';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

type LoadedTestData = {
  collectionPath: 'firstGrade' | 'secondGrade';
  id: string;
  data: TestData;
};

type HtmlFieldTarget = {
  collectionPath: LoadedTestData['collectionPath'];
  docId: string;
  field: keyof TestData;
  html: string;
};

type AuditSeverity = 'notification' | 'warning';

type AuditFinding = SanitizerRejectionReport & {
  severity: AuditSeverity;
  collectionPath: LoadedTestData['collectionPath'];
  docId: string;
  changed: boolean;
  originalLength: number;
  sanitizedLength: number;
};

type AuditRuleSummary = {
  severity: AuditSeverity;
  ruleCode: SanitizerRejectionReport['ruleCode'];
  count: number;
  docCount: number;
  fieldCount: number;
};

type AuditFieldSummary = {
  fieldName: string;
  count: number;
  docCount: number;
};

type AuditSummary = {
  totalDocCount: number;
  totalPossibleHtmlFieldCount: number;
  totalNonEmptyHtmlFieldCount: number;
  scannedHtmlFieldCount: number;
  changedFieldCount: number;
  changedWithoutReportFieldCount: number;
  reportEntryCount: number;
  rejectionTotalCount: number;
  notificationEntryCount: number;
  notificationTotalCount: number;
  warningEntryCount: number;
  warningTotalCount: number;
  docWithIssueCount: number;
  fieldWithIssueCount: number;
  durationMs: number;
};

type AuditReport = {
  meta: {
    tool: 'preview-sanitize-audit';
    generatedAt: string;
    profile: 'preview-render';
    boundary: 'preview';
    route: string;
    batchSize: number | null;
    batchIndex: number;
    selectedFieldCount: number;
    failLevel: 'warning' | 'notification' | 'none';
    reportOut: string;
    logOut: string;
  };
  summary: AuditSummary;
  byRule: AuditRuleSummary[];
  byField: AuditFieldSummary[];
  alertFindings: AuditFinding[];
  noticeFindings: AuditFinding[];
  fatalError: {
    message: string;
  } | null;
};

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY ?? 'fake',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'localhost',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID ?? 'demo-test-manager',
  storageBucket:
    process.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'demo-test-manager.appspot.com',
  messagingSenderId:
    process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '1234567890',
  appId: process.env.VITE_FIREBASE_APP_ID ?? '1:123:web:abc',
};

const parsePositiveInt = (value: string | undefined): number | null => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const parseFailLevel = (
  value: string | undefined,
): 'warning' | 'notification' | 'none' => {
  if (value === 'notification' || value === 'none' || value === 'warning') {
    return value;
  }
  return 'warning';
};

const manualBatchSize = parsePositiveInt(
  process.env.MANUAL_SANITIZE_AUDIT_BATCH_SIZE,
);
const manualBatchIndex = Math.max(
  0,
  parsePositiveInt(process.env.MANUAL_SANITIZE_AUDIT_BATCH_INDEX) ?? 0,
);
const manualFailLevel = parseFailLevel(
  process.env.MANUAL_SANITIZE_AUDIT_FAIL_LEVEL,
);
const manualRoute =
  process.env.MANUAL_SANITIZE_AUDIT_ROUTE ??
  '#/__manual__/preview-sanitize-audit';

const defaultReportOut = path.resolve(
  process.cwd(),
  '../backend/_tmp/preview-sanitize-audit.json',
);
const defaultLogOut = path.resolve(
  process.cwd(),
  '../backend/_tmp/preview-sanitize-audit.log',
);

const reportOutPath = path.resolve(
  process.cwd(),
  process.env.MANUAL_SANITIZE_AUDIT_REPORT_OUT ?? defaultReportOut,
);
const logOutPath = path.resolve(
  process.cwd(),
  process.env.MANUAL_SANITIZE_AUDIT_LOG_OUT ?? defaultLogOut,
);

const createFirebaseClients = () => {
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const functions = getFunctions(
    app,
    process.env.FIREBASE_REGION ?? 'asia-northeast1',
  );

  connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
    disableWarnings: true,
  });
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);

  return { auth, firestore, functions };
};

const ensureReadClaims = async (auth: Auth, functions: Functions) => {
  const email = 't-ci@demoschool.ac.jp';
  const password = 'password';

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error: unknown) {
    const code = error instanceof FirebaseError ? error.code : undefined;
    if (
      code?.includes('auth/invalid-credential') ||
      code?.includes('auth/user-not-found')
    ) {
      await createUserWithEmailAndPassword(auth, email, password);
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      throw error;
    }
  }

  const wait = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));
  const callSetClaims = httpsCallable(functions, 'setCustomClaims');
  const callStart = Date.now();
  while (true) {
    try {
      await callSetClaims({});
      break;
    } catch (error: unknown) {
      const code = error instanceof FirebaseError ? error.code : undefined;
      if (code !== 'functions/not-found' || Date.now() - callStart > 20000) {
        throw error;
      }
      await wait(500);
    }
  }

  const start = Date.now();
  while (true) {
    const result = await auth.currentUser?.getIdTokenResult(true);
    const claims = result?.claims ?? {};
    if (claims.atpAllowRead || claims.atpAllowWrite) return;
    if (Date.now() - start > 10000) {
      throw new Error('custom claims が 10 秒以内に反映されませんでした');
    }
    await wait(300);
  }
};

const loadAllTestData = async (
  firestore: Firestore,
): Promise<LoadedTestData[]> => {
  const collections: Array<LoadedTestData['collectionPath']> = [
    'firstGrade',
    'secondGrade',
  ];
  const entries: LoadedTestData[] = [];

  for (const collectionPath of collections) {
    const snapshot = await getDocs(collection(firestore, collectionPath));
    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data() as TestData;
      entries.push({
        collectionPath,
        id: docSnapshot.id,
        data: { ...data, id: data.id ?? docSnapshot.id },
      });
    });
  }

  return entries;
};

const collectHtmlFieldTargets = (
  records: LoadedTestData[],
): HtmlFieldTarget[] => {
  const targets: HtmlFieldTarget[] = [];

  for (const record of records) {
    for (const field of HTML_FIELDS) {
      const html = record.data[field];
      if (typeof html !== 'string' || html.length === 0) continue;

      targets.push({
        collectionPath: record.collectionPath,
        docId: record.id,
        field,
        html,
      });
    }
  }

  return targets;
};

const sliceByBatch = <T,>(items: T[]): T[] => {
  if (!manualBatchSize) return items;
  const start = manualBatchIndex * manualBatchSize;
  return items.slice(start, start + manualBatchSize);
};

const getSeverity = (report: SanitizerRejectionReport): AuditSeverity => {
  if (report.ruleCode === 'stripped-src') {
    return 'notification';
  }

  if (
    report.ruleCode === 'blocked-class' &&
    (report.className === 'active' || report.className === 'ql-cursor')
  ) {
    return 'notification';
  }

  if (
    report.ruleCode === 'blocked-style-property' &&
    report.tagName === 'img' &&
    ['zoom', 'white-space', 'color', 'background-color'].includes(
      report.styleProperty ?? '',
    )
  ) {
    return 'notification';
  }

  if (
    report.ruleCode === 'blocked-attribute' &&
    report.attributeName === 'style' &&
    ['span', 'strong', 'em', 'u', 's', 'sub', 'sup'].includes(
      report.tagName ?? '',
    )
  ) {
    return 'notification';
  }

  if (
    report.ruleCode === 'blocked-attribute' &&
    report.tagName === 'img' &&
    (report.attributeName === 'width' || report.attributeName === 'height') &&
    /^(width|height)=null$/i.test(report.sampleText ?? '')
  ) {
    return 'notification';
  }

  return 'warning';
};

const createEmptySummary = (): AuditSummary => ({
  totalDocCount: 0,
  totalPossibleHtmlFieldCount: 0,
  totalNonEmptyHtmlFieldCount: 0,
  scannedHtmlFieldCount: 0,
  changedFieldCount: 0,
  changedWithoutReportFieldCount: 0,
  reportEntryCount: 0,
  rejectionTotalCount: 0,
  notificationEntryCount: 0,
  notificationTotalCount: 0,
  warningEntryCount: 0,
  warningTotalCount: 0,
  docWithIssueCount: 0,
  fieldWithIssueCount: 0,
  durationMs: 0,
});

const buildRuleSummaries = (findings: AuditFinding[]): AuditRuleSummary[] => {
  const grouped = new Map<
    string,
    AuditRuleSummary & {
      docIds: Set<string>;
      fieldKeys: Set<string>;
    }
  >();

  for (const finding of findings) {
    const key = `${finding.severity}|${finding.ruleCode}`;
    const current = grouped.get(key);
    if (current) {
      current.count += finding.rejectionCount;
      current.docIds.add(`${finding.collectionPath}/${finding.docId}`);
      current.fieldKeys.add(
        `${finding.collectionPath}/${finding.docId}/${finding.fieldName ?? 'unknown'}`,
      );
      continue;
    }

    grouped.set(key, {
      severity: finding.severity,
      ruleCode: finding.ruleCode,
      count: finding.rejectionCount,
      docCount: 0,
      fieldCount: 0,
      docIds: new Set([`${finding.collectionPath}/${finding.docId}`]),
      fieldKeys: new Set([
        `${finding.collectionPath}/${finding.docId}/${finding.fieldName ?? 'unknown'}`,
      ]),
    });
  }

  return [...grouped.values()]
    .map((entry) => ({
      severity: entry.severity,
      ruleCode: entry.ruleCode,
      count: entry.count,
      docCount: entry.docIds.size,
      fieldCount: entry.fieldKeys.size,
    }))
    .sort((a, b) => {
      if (a.severity !== b.severity) {
        return a.severity === 'warning' ? -1 : 1;
      }
      return b.count - a.count;
    });
};

const buildFieldSummaries = (findings: AuditFinding[]): AuditFieldSummary[] => {
  const grouped = new Map<
    string,
    AuditFieldSummary & { docIds: Set<string> }
  >();

  for (const finding of findings) {
    const fieldName = finding.fieldName ?? 'unknown';
    const current = grouped.get(fieldName);
    if (current) {
      current.count += finding.rejectionCount;
      current.docIds.add(`${finding.collectionPath}/${finding.docId}`);
      continue;
    }

    grouped.set(fieldName, {
      fieldName,
      count: finding.rejectionCount,
      docCount: 0,
      docIds: new Set([`${finding.collectionPath}/${finding.docId}`]),
    });
  }

  return [...grouped.values()]
    .map((entry) => ({
      fieldName: entry.fieldName,
      count: entry.count,
      docCount: entry.docIds.size,
    }))
    .sort((a, b) => b.count - a.count);
};

const buildLogText = (report: AuditReport): string => {
  const lines: string[] = [];

  lines.push('[summary]');
  lines.push(`generatedAt=${report.meta.generatedAt}`);
  lines.push(`route=${report.meta.route}`);
  lines.push(`failLevel=${report.meta.failLevel}`);
  lines.push(`totalDocCount=${report.summary.totalDocCount}`);
  lines.push(
    `totalPossibleHtmlFieldCount=${report.summary.totalPossibleHtmlFieldCount}`,
  );
  lines.push(
    `totalNonEmptyHtmlFieldCount=${report.summary.totalNonEmptyHtmlFieldCount}`,
  );
  lines.push(`scannedHtmlFieldCount=${report.summary.scannedHtmlFieldCount}`);
  lines.push(`changedFieldCount=${report.summary.changedFieldCount}`);
  lines.push(
    `changedWithoutReportFieldCount=${report.summary.changedWithoutReportFieldCount}`,
  );
  lines.push(`alertEntryCount=${report.summary.warningEntryCount}`);
  lines.push(`alertTotalCount=${report.summary.warningTotalCount}`);
  lines.push(`noticeEntryCount=${report.summary.notificationEntryCount}`);
  lines.push(`noticeTotalCount=${report.summary.notificationTotalCount}`);
  lines.push(`warningEntryCount=${report.summary.warningEntryCount}`);
  lines.push(`warningTotalCount=${report.summary.warningTotalCount}`);
  lines.push(`notificationEntryCount=${report.summary.notificationEntryCount}`);
  lines.push(`notificationTotalCount=${report.summary.notificationTotalCount}`);
  lines.push(`durationMs=${report.summary.durationMs}`);
  lines.push(`reportOut=${report.meta.reportOut}`);
  lines.push(`logOut=${report.meta.logOut}`);
  lines.push('');

  lines.push('[by-rule]');
  if (report.byRule.length === 0) {
    lines.push('none');
  } else {
    for (const item of report.byRule) {
      lines.push(
        `${item.severity} rule=${item.ruleCode} count=${item.count} docCount=${item.docCount} fieldCount=${item.fieldCount}`,
      );
    }
  }
  lines.push('');

  lines.push('[by-field]');
  if (report.byField.length === 0) {
    lines.push('none');
  } else {
    for (const item of report.byField) {
      lines.push(
        `field=${item.fieldName} count=${item.count} docCount=${item.docCount}`,
      );
    }
  }
  lines.push('');

  lines.push('[findings]');
  lines.push('[alert-findings]');
  if (report.alertFindings.length === 0) {
    lines.push('none');
  } else {
    for (const finding of report.alertFindings) {
      lines.push(
        [
          `${finding.collectionPath}/${finding.docId}`,
          `field=${finding.fieldName ?? 'unknown'}`,
          `severity=${finding.severity}`,
          `rule=${finding.ruleCode}`,
          `tag=${finding.tagName ?? 'unknown'}`,
          `attribute=${finding.attributeName ?? '-'}`,
          `styleProperty=${finding.styleProperty ?? '-'}`,
          `count=${finding.rejectionCount}`,
          `changed=${finding.changed}`,
          `reason=${finding.reasonText}`,
          `sample=${finding.sampleText ?? '-'}`,
        ].join(' | '),
      );
    }
  }
  lines.push('');
  lines.push('[notice-findings]');
  if (report.noticeFindings.length === 0) {
    lines.push('none');
  } else {
    for (const finding of report.noticeFindings) {
      lines.push(
        [
          `${finding.collectionPath}/${finding.docId}`,
          `field=${finding.fieldName ?? 'unknown'}`,
          `severity=${finding.severity}`,
          `rule=${finding.ruleCode}`,
          `tag=${finding.tagName ?? 'unknown'}`,
          `attribute=${finding.attributeName ?? '-'}`,
          `styleProperty=${finding.styleProperty ?? '-'}`,
          `count=${finding.rejectionCount}`,
          `changed=${finding.changed}`,
          `reason=${finding.reasonText}`,
          `sample=${finding.sampleText ?? '-'}`,
        ].join(' | '),
      );
    }
  }

  if (report.fatalError) {
    lines.push('');
    lines.push('[fatal-error]');
    lines.push(report.fatalError.message);
  }

  return `${lines.join('\n')}\n`;
};

const writeAuditOutputs = async (report: AuditReport): Promise<void> => {
  await mkdir(path.dirname(report.meta.reportOut), { recursive: true });
  await mkdir(path.dirname(report.meta.logOut), { recursive: true });

  await writeFile(
    report.meta.reportOut,
    `${JSON.stringify(report, null, 2)}\n`,
  );
  await writeFile(report.meta.logOut, buildLogText(report));
};

const shouldFail = (report: AuditReport): boolean => {
  switch (report.meta.failLevel) {
    case 'none': {
      return false;
    }
    case 'notification': {
      return report.summary.reportEntryCount > 0;
    }
    default: {
      return report.summary.warningEntryCount > 0;
    }
  }
};

const buildBatchLabel = (totalCount: number, selectedCount: number): string => {
  if (!manualBatchSize) {
    return `全件実行: ${selectedCount}/${totalCount}`;
  }
  const start = manualBatchIndex * manualBatchSize;
  const end = Math.min(start + manualBatchSize, totalCount);
  return `分割実行: batchIndex=${manualBatchIndex}, batchSize=${manualBatchSize}, range=${start}-${Math.max(start, end - 1)}, selected=${selectedCount}/${totalCount}`;
};

const buildFailureMessage = (report: AuditReport): string => {
  const lines = report.alertFindings.slice(0, 20).map((finding) => {
    return [
      `${finding.collectionPath}/${finding.docId}`,
      `field=${finding.fieldName ?? 'unknown'}`,
      `severity=${finding.severity}`,
      `rule=${finding.ruleCode}`,
      `count=${finding.rejectionCount}`,
      `reason=${finding.reasonText}`,
    ].join(' | ');
  });

  const omittedCount = Math.max(report.alertFindings.length - lines.length, 0);
  if (omittedCount > 0) {
    lines.push(`... 省略 ${omittedCount} 件`);
  }

  return [
    'Preview 全件サニタイズ監査で warning が検出されました',
    buildBatchLabel(
      report.summary.totalNonEmptyHtmlFieldCount,
      report.summary.scannedHtmlFieldCount,
    ),
    `warningEntryCount=${report.summary.warningEntryCount}`,
    `warningTotalCount=${report.summary.warningTotalCount}`,
    `reportOut=${report.meta.reportOut}`,
    `logOut=${report.meta.logOut}`,
    ...lines,
  ].join('\n');
};

describe('Preview全件サニタイズ監査手動検証', () => {
  let records: LoadedTestData[] = [];

  beforeAll(async () => {
    const { auth, firestore, functions } = createFirebaseClients();
    await ensureReadClaims(auth, functions);
    records = await loadAllTestData(firestore);
  }, 60000);

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it(
    'Preview profile で全HTMLフィールドのサニタイズ監査結果を出力できる',
    async () => {
      const startedAt = Date.now();
      const allTargets = collectHtmlFieldTargets(records);
      const targets = sliceByBatch(allTargets);

      expect(targets.length).toBeGreaterThan(0);

      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const consoleInfo = vi
        .spyOn(console, 'info')
        .mockImplementation(() => undefined);

      const changedFieldKeys = new Set<string>();
      const changedWithoutReportFieldKeys = new Set<string>();
      const findings: AuditFinding[] = [];

      const report: AuditReport = {
        meta: {
          tool: 'preview-sanitize-audit',
          generatedAt: new Date().toISOString(),
          profile: 'preview-render',
          boundary: 'preview',
          route: manualRoute,
          batchSize: manualBatchSize,
          batchIndex: manualBatchIndex,
          selectedFieldCount: targets.length,
          failLevel: manualFailLevel,
          reportOut: reportOutPath,
          logOut: logOutPath,
        },
        summary: createEmptySummary(),
        byRule: [],
        byField: [],
        alertFindings: [],
        noticeFindings: [],
        fatalError: null,
      };

      let fatalError: Error | null = null;

      try {
        for (const target of targets) {
          const fieldKey = `${target.collectionPath}/${target.docId}/${String(target.field)}`;
          const result = sanitizeForPreviewRender(target.html, {
            boundary: 'preview',
            itemId: target.docId,
            fieldName: String(target.field),
            route: manualRoute,
          });

          const changed = result.sanitizedHtml !== target.html;
          if (changed) {
            changedFieldKeys.add(fieldKey);
          }
          if (changed && result.rejectionReport.length === 0) {
            changedWithoutReportFieldKeys.add(fieldKey);
          }

          for (const entry of result.rejectionReport) {
            findings.push({
              ...entry,
              severity: getSeverity(entry),
              collectionPath: target.collectionPath,
              docId: target.docId,
              changed,
              originalLength: target.html.length,
              sanitizedLength: result.sanitizedHtml.length,
            });
          }
        }
      } catch (error) {
        fatalError = error instanceof Error ? error : new Error(String(error));
        report.fatalError = { message: fatalError.message };
      } finally {
        consoleError.mockRestore();
        consoleInfo.mockRestore();

        const warningFindings = findings.filter(
          (finding) => finding.severity === 'warning',
        );
        const notificationFindings = findings.filter(
          (finding) => finding.severity === 'notification',
        );
        const docKeys = new Set(
          findings.map(
            (finding) => `${finding.collectionPath}/${finding.docId}`,
          ),
        );
        const fieldKeys = new Set(
          findings.map(
            (finding) =>
              `${finding.collectionPath}/${finding.docId}/${finding.fieldName ?? 'unknown'}`,
          ),
        );

        report.summary = {
          totalDocCount: records.length,
          totalPossibleHtmlFieldCount: records.length * HTML_FIELDS.length,
          totalNonEmptyHtmlFieldCount: allTargets.length,
          scannedHtmlFieldCount: targets.length,
          changedFieldCount: changedFieldKeys.size,
          changedWithoutReportFieldCount: changedWithoutReportFieldKeys.size,
          reportEntryCount: findings.length,
          rejectionTotalCount: findings.reduce(
            (sum, finding) => sum + finding.rejectionCount,
            0,
          ),
          notificationEntryCount: notificationFindings.length,
          notificationTotalCount: notificationFindings.reduce(
            (sum, finding) => sum + finding.rejectionCount,
            0,
          ),
          warningEntryCount: warningFindings.length,
          warningTotalCount: warningFindings.reduce(
            (sum, finding) => sum + finding.rejectionCount,
            0,
          ),
          docWithIssueCount: docKeys.size,
          fieldWithIssueCount: fieldKeys.size,
          durationMs: Date.now() - startedAt,
        };
        report.byRule = buildRuleSummaries(findings);
        report.byField = buildFieldSummaries(findings);
        report.alertFindings = findings.filter(
          (finding) => finding.severity === 'warning',
        );
        report.noticeFindings = findings.filter(
          (finding) => finding.severity === 'notification',
        );

        await writeAuditOutputs(report);
      }

      if (fatalError) {
        throw fatalError;
      }

      if (shouldFail(report)) {
        throw new Error(buildFailureMessage(report));
      }
    },
    manualBatchSize ? 300000 : 900000,
  );
});
