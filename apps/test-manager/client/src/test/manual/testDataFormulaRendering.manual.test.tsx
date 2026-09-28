import { exportHtmlForPreview } from '@api/quillUtils';
import Editor, { type EditorHandle } from '@parts/editor';
import viewerHtml from '@renderer/components/templates/preview/viewer.html?raw';
import type { TestData } from '@shared/types/contracts';
import type { PreviewSetPayload } from '@shared/types/preview';
import { act, cleanup, render } from '@testing-library/react';
import {
  applyCommonRulesToTestData,
  HTML_FIELDS,
  normalizeEditorTypesInTestData,
} from '@views/testDataEditor/api/testDataUtils';
import {
  type PreviewUiOptions,
  renderPreviewToDocument,
} from '@views/testDataEditor/templates/previewRenderShared';
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
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type ManualStage = 'all' | 'quill' | 'preview';

type LoadedTestData = {
  collectionPath: 'firstGrade' | 'secondGrade';
  id: string;
  data: TestData;
};

type FormulaFieldTarget = {
  collectionPath: LoadedTestData['collectionPath'];
  docId: string;
  field: keyof TestData;
  html: string;
  expectedFormulaCount: number;
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

const previewUiOptions: PreviewUiOptions = {
  mode: 'both',
  hasCover: false,
  questionCount: 1,
  page: { size: 'A4', pxPerMm: 0.2645, baseHeightMm: 235 },
  meta: { title: '' },
};

const parseManualStage = (value: string | undefined): ManualStage => {
  if (value === 'quill' || value === 'preview' || value === 'all') {
    return value;
  }
  return 'all';
};

const parsePositiveInt = (value: string | undefined): number | null => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const manualStage = parseManualStage(process.env.MANUAL_FORMULA_STAGE);
const manualBatchSize = parsePositiveInt(process.env.MANUAL_FORMULA_BATCH_SIZE);
const manualBatchIndex = Math.max(
  0,
  parsePositiveInt(process.env.MANUAL_FORMULA_BATCH_INDEX) ?? 0,
);
const manualEditorInitTimeoutMs =
  parsePositiveInt(process.env.MANUAL_FORMULA_EDITOR_INIT_TIMEOUT_MS) ?? 5000;

const createViewerDocument = (): Document => {
  return new DOMParser().parseFromString(viewerHtml, 'text/html');
};

const countFormulaNodesInHtml = (html: string): number => {
  if (!html) return 0;
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content.querySelectorAll('.ql-formula[data-value]').length;
};

const countRenderedFormulaNodes = (root: ParentNode): number => {
  return root.querySelectorAll('.ql-formula .katex, .ql-formula .katex-error')
    .length;
};

const normalizeTestData = (src: TestData): TestData => {
  const normalized = applyCommonRulesToTestData({ ...src });
  const [withEditorTypes] = normalizeEditorTypesInTestData(normalized);
  return withEditorTypes;
};

const buildPreviewPayload = (src: TestData): PreviewSetPayload => {
  const normalized = normalizeTestData(src);
  return {
    type: 'full',
    id: String(normalized.id ?? normalized.no ?? ''),
    subject: String(normalized.subject ?? ''),
    bigCategoryTag: String(normalized.bigCategoryTag ?? ''),
    smallCategoryTag: String(normalized.smallCategoryTag ?? ''),
    nengo: String(normalized.nengo ?? ''),
    year: String(normalized.year ?? ''),
    difficult: Number(normalized.difficult ?? '0') || 0,
    testNo: String(normalized.testNo ?? ''),
    question: {
      textHtml: exportHtmlForPreview(normalized.text ?? ''),
      choices: [
        exportHtmlForPreview(normalized.ch1 ?? ''),
        exportHtmlForPreview(normalized.ch2 ?? ''),
        exportHtmlForPreview(normalized.ch3 ?? ''),
        exportHtmlForPreview(normalized.ch4 ?? ''),
        exportHtmlForPreview(normalized.ch5 ?? ''),
      ],
    },
    answer: {
      textHtml: exportHtmlForPreview(normalized.answerText ?? ''),
      choices: [
        exportHtmlForPreview(normalized.answerText1 ?? ''),
        exportHtmlForPreview(normalized.answerText2 ?? ''),
        exportHtmlForPreview(normalized.answerText3 ?? ''),
        exportHtmlForPreview(normalized.answerText4 ?? ''),
        exportHtmlForPreview(normalized.answerText5 ?? ''),
      ],
      answerBool: normalized.isNegativeAnswer
        ? !normalized.answer
        : Boolean(normalized.answer),
      answerNo: String(normalized.answerNumber ?? ''),
    },
    questionEditorType: normalized.questionEditorType ?? 'normal',
    answerEditorType: normalized.answerEditorType ?? 'normal',
    publicationYear: normalized.publicationYear ?? '',
    publicationNo: String(normalized.publicationNo ?? ''),
    otherTags: normalized.otherTags ?? [],
    options: {
      mode: 'both',
      hasCover: false,
      questionCount: 1,
      meta: {
        title: '',
        subject: String(normalized.subject ?? ''),
        grade: String(normalized.grade ?? ''),
      },
      page: { size: 'A4', pxPerMm: 0.2645, baseHeightMm: 235 },
      questionEditorType: normalized.questionEditorType ?? 'normal',
      answerEditorType: normalized.answerEditorType ?? 'normal',
      hasSubCategoryHeading: false,
      hasNoNengoAndYear: normalized.isOriginal,
      hasNoDifficult: false,
      isOriginal: normalized.isOriginal ?? false,
    },
  };
};

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

const collectFormulaFieldTargets = (
  records: LoadedTestData[],
): FormulaFieldTarget[] => {
  const targets: FormulaFieldTarget[] = [];

  for (const record of records) {
    const normalized = normalizeTestData(record.data);
    for (const field of HTML_FIELDS) {
      const html = normalized[field];
      if (typeof html !== 'string') continue;
      const expectedFormulaCount = countFormulaNodesInHtml(html);
      if (expectedFormulaCount === 0) continue;
      targets.push({
        collectionPath: record.collectionPath,
        docId: record.id,
        field,
        html,
        expectedFormulaCount,
      });
    }
  }

  return targets;
};

const buildFailureMessage = (
  title: string,
  failures: string[],
  summary: string,
) => {
  const lines = failures.slice(0, 20);
  const suffix =
    failures.length > 20 ? `\n... 省略 ${failures.length - 20} 件` : '';
  return `${title}\n${summary}\n${lines.join('\n')}${suffix}`;
};

const buildBatchLabel = (totalCount: number, selectedCount: number): string => {
  if (!manualBatchSize) {
    return `全件実行: ${selectedCount}/${totalCount}`;
  }
  const start = manualBatchIndex * manualBatchSize;
  const end = Math.min(start + manualBatchSize, totalCount);
  return `分割実行: batchIndex=${manualBatchIndex}, batchSize=${manualBatchSize}, range=${start}-${Math.max(start, end - 1)}, selected=${selectedCount}/${totalCount}`;
};

const sliceByBatch = <T,>(items: T[]): T[] => {
  if (!manualBatchSize) return items;
  const start = manualBatchIndex * manualBatchSize;
  return items.slice(start, start + manualBatchSize);
};

const buildEditorInitTimeoutMessage = () => {
  return [
    'QuillEditor の初期化待ちがタイムアウトしました',
    `timeoutMs=${manualEditorInitTimeoutMs}`,
    'onReady が返ってきていません。resize module 初期化または Quill mount を確認してください。',
  ].join('\n');
};

const renderEditorHandle = async (): Promise<{
  handle: EditorHandle;
  unmount: () => void;
}> => {
  let editorHandle: EditorHandle | null = null;
  const editorId = `manual-formula-render-editor-${crypto.randomUUID()}`;
  let unmount: () => void = () => {};

  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    await act(async () => {
      await new Promise<void>((resolve, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(buildEditorInitTimeoutMessage()));
        }, manualEditorInitTimeoutMs);

        const view = render(
          <Editor
            id={editorId}
            ref={(value) => {
              editorHandle = value;
            }}
            disableResizeModule
            value=""
            onInitError={(error) => {
              reject(
                new Error(
                  `QuillEditor の初期化で resize module の準備に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
                ),
              );
            }}
            onReady={() => resolve()}
          />,
        );
        unmount = view.unmount;
      });
    });
  } catch (error) {
    await act(async () => {
      unmount();
    });
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }

  if (!editorHandle) {
    throw new Error('EditorHandle を取得できませんでした');
  }

  return { handle: editorHandle, unmount };
};

describe('KaTeX全件レンダリング手動検証', () => {
  let records: LoadedTestData[] = [];

  beforeAll(async () => {
    const { auth, firestore, functions } = createFirebaseClients();
    await ensureReadClaims(auth, functions);
    records = await loadAllTestData(firestore);
  }, 60000);

  afterAll(() => {
    cleanup();
  });

  const quillIt = manualStage === 'preview' ? it.skip : it;
  const previewIt = manualStage === 'quill' ? it.skip : it;

  quillIt(
    'QuillEditorが_data_next由来の数式HTMLを全件描画できる',
    async () => {
      const allTargets = collectFormulaFieldTargets(records);
      const targets = sliceByBatch(allTargets);
      expect(targets.length).toBeGreaterThan(0);

      const { handle, unmount } = await renderEditorHandle();

      const failures: string[] = [];
      let checkedFormulaCount = 0;

      try {
        for (const target of targets) {
          checkedFormulaCount += target.expectedFormulaCount;

          try {
            await act(async () => {
              handle.setHtml(target.html);
              await Promise.resolve();
            });
          } catch (error) {
            failures.push(
              `${target.collectionPath}/${target.docId} ${String(target.field)}: setHtml 失敗: ${error instanceof Error ? error.message : String(error)}`,
            );
            continue;
          }

          const root = handle.getQuill()?.root;
          if (!root) {
            failures.push(
              `${target.collectionPath}/${target.docId} ${String(target.field)}: Quill root を取得できません`,
            );
            continue;
          }

          const renderedFormulaCount = countRenderedFormulaNodes(root);
          if (renderedFormulaCount < target.expectedFormulaCount) {
            failures.push(
              `${target.collectionPath}/${target.docId} ${String(target.field)}: 期待 ${target.expectedFormulaCount} 個, 実際 ${renderedFormulaCount} 個`,
            );
          }
        }
      } finally {
        await act(async () => {
          unmount();
        });
      }

      const summary = `${buildBatchLabel(allTargets.length, targets.length)}, 対象数式数: ${checkedFormulaCount}`;
      if (failures.length > 0) {
        throw new Error(
          buildFailureMessage(
            'QuillEditor の数式レンダリング検証で失敗がありました',
            failures,
            summary,
          ),
        );
      }
    },
    manualBatchSize ? 300000 : 900000,
  );

  previewIt(
    'PreviewPanel経路が_data_next由来の数式HTMLを全件描画できる',
    async () => {
      const allTargets = records
        .map((record) => ({
          record,
          payload: buildPreviewPayload(record.data),
        }))
        .filter(({ payload }) => {
          const formulaCount =
            countFormulaNodesInHtml(payload?.question?.textHtml ?? '') +
            (payload?.question?.choices ?? []).reduce(
              (count, html) => count + countFormulaNodesInHtml(html ?? ''),
              0,
            ) +
            countFormulaNodesInHtml(payload?.answer?.textHtml ?? '') +
            (payload?.answer?.choices ?? []).reduce(
              (count, html) => count + countFormulaNodesInHtml(html ?? ''),
              0,
            );
          return formulaCount > 0;
        });

      const targets = sliceByBatch(allTargets);

      expect(targets.length).toBeGreaterThan(0);

      const failures: string[] = [];
      let checkedFormulaCount = 0;

      for (const { record, payload } of targets) {
        const expectedFormulaCount =
          countFormulaNodesInHtml(payload?.question?.textHtml ?? '') +
          (payload?.question?.choices ?? []).reduce(
            (count, html) => count + countFormulaNodesInHtml(html ?? ''),
            0,
          ) +
          countFormulaNodesInHtml(payload?.answer?.textHtml ?? '') +
          (payload?.answer?.choices ?? []).reduce(
            (count, html) => count + countFormulaNodesInHtml(html ?? ''),
            0,
          );
        checkedFormulaCount += expectedFormulaCount;

        try {
          const doc = createViewerDocument();
          await renderPreviewToDocument({
            doc,
            payload,
            uiOptions: previewUiOptions,
            displayMode: 'patch',
          });

          const renderedFormulaCount = countRenderedFormulaNodes(doc);
          const renderedItem = doc.querySelector(
            `[data-item-id="${String(payload.id)}"]`,
          );
          if (!renderedItem) {
            failures.push(
              `${record.collectionPath}/${record.id}: プレビューDOMに item 要素が生成されませんでした`,
            );
            continue;
          }

          if (renderedFormulaCount < expectedFormulaCount) {
            failures.push(
              `${record.collectionPath}/${record.id}: 期待 ${expectedFormulaCount} 個, 実際 ${renderedFormulaCount} 個`,
            );
          }
        } catch (error) {
          failures.push(
            `${record.collectionPath}/${record.id}: Preview render 失敗: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      const summary = `${buildBatchLabel(allTargets.length, targets.length)}, 対象数式数: ${checkedFormulaCount}`;
      if (failures.length > 0) {
        throw new Error(
          buildFailureMessage(
            'PreviewPanel 経路の数式レンダリング検証で失敗がありました',
            failures,
            summary,
          ),
        );
      }
    },
    manualBatchSize ? 300000 : 900000,
  );
});
