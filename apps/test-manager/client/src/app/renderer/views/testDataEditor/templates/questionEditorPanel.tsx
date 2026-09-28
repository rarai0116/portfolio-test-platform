/*
import {
  type PreviewSendArgs,
  patchPreviewImages,
  sendPreviewFull,
  sendPreviewPatch,
} from '@api/previewBridge';
*/
import { extractImageIdsFromHtml, parseImgTagAttributes } from '@api/utils';
import ImageIcon from '@components/icons/imageIcon';
import LeftArrowIcon from '@components/icons/leftArrowIcon';
import PreviewIcon from '@components/icons/previewIcon';
import { randomId } from '@hooks/useFirestoreHandler';
import BasicDialog from '@parts/basicDialog'; // 確認ダイアログ
import BasicTabs from '@parts/basicTabs';
import type { EditorHandle } from '@parts/editor';
import { EDITOR_DUMMY_IMG } from '@renderer/api/dummyImage';
import {
  buildReadyAssetUrl,
  mergeImageMetaState,
  mergeReadyImageState,
  readImageDimensionsFromAsset,
} from '@renderer/api/imageAssetCache';
import { ASSET_LOAD_FAILED_ATTRIBUTE } from '@renderer/api/imageErrorRecovery';
import { buildTestDataDisplayName } from '@renderer/api/testDataDisplayName';
import type { AssetKey } from '@shared/types/assets';
import type {
  AutoCheckResult,
  EditorKeyName,
  GradeId,
  TestData,
} from '@shared/types/contracts';
import { META_KEYS } from '@shared/types/contracts';
import type { EditorInsertPayload } from '@shared/types/editor';
import useAssetCacheStore from '@stores/useAssetCacheStore';
import useImageAssetStore from '@stores/useImageAssetStore';
import { Button } from '@ui/button.tsx';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@ui/resizable';
import {
  autoCheck,
  shouldRunAutoCheck,
} from '@views/testDataEditor/api/autoCheck';
import {
  clonePastExamDuplicateIndex,
  createEmptyPastExamDuplicateIndex,
  getPastExamDuplicateIds,
  PAST_EXAM_DUPLICATE_FAILED_KEY,
  PAST_EXAM_DUPLICATE_TARGET_KEYS,
  type PastExamDuplicateIndex,
  upsertPastExamDuplicateIndexEntry,
} from '@views/testDataEditor/api/pastExamDuplicate';
import {
  deriveTestDataStatus,
  deriveTestDataStatusAfterResume,
  HTML_FIELDS,
  stripEmbeddedImagesFromHtml,
  stripEmbeddedImagesFromTestData,
} from '@views/testDataEditor/api/testDataUtils';
import useDockviewPanelManager from '@views/testDataEditor/hooks/useDockviewPanelManager';
import useTestDataObserver from '@views/testDataEditor/hooks/useTestDataObserver';
import useSaveActionsStore from '@views/testDataEditor/store/useSaveActionsStore';
import useSelectedDataDisplayStore from '@views/testDataEditor/store/useSelectedDataDisplayStore';
import useSelectedIdStore from '@views/testDataEditor/store/useSelectedIdStore';
import useTestDataStore, {
  type EditDataEntry,
} from '@views/testDataEditor/store/useTestDataStore';
import { panel } from '@views/testDataEditor/types/dockviewType';
import type { Range } from 'quill';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router';
import {
  type JudgeResultWithReason,
  judgeIsConvertibleQaa,
  judgeIsConvertibleQaaWithReason,
  judgeIsNegativeAnswer,
  judgeIsNegativeAnswerWithWord,
  judgeIsShuffleable,
  judgeIsShuffleableWithReason,
  type NegativeAnswerJudge,
} from '../../../api/judgeTestData';
import { useCategoryTagOptions } from '../hooks/useCategoryTagOptions';
import { useDirtyIdHooks } from '../hooks/useDirtyIdHooks';
import { useOtherTagOptions } from '../hooks/useOtherTagOptions';
import { usePreviewDispatcher } from '../hooks/usePreviewDispatcher';
import useTestDataList from '../hooks/useTestDataList';
import AnswerEditor from '../organism/answerEditor';
import BasicInfoAccordion from '../organism/basicInfoAccordion';
import DataList from '../organism/dataList';
import DetailInfoAccordion from '../organism/detailInfoAccordion';
import QuestionEditor from '../organism/questionEditor';
import StatusBar from '../organism/statusBar';

// updater配列と対応するキー名（順序を厳密に一致）
const updaterNames: EditorKeyName[] = [
  'text',
  'ch1',
  'ch2',
  'ch3',
  'ch4',
  'ch5',
  'answerText',
  'answerText1',
  'answerText2',
  'answerText3',
  'answerText4',
  'answerText5',
];

const createEmptyEditorUpdateMarks = (): Record<
  EditorKeyName,
  string | null
> => ({
  text: null,
  ch1: null,
  ch2: null,
  ch3: null,
  ch4: null,
  ch5: null,
  answerText: null,
  answerText1: null,
  answerText2: null,
  answerText3: null,
  answerText4: null,
  answerText5: null,
});

// 既存の表示契約を保つため、問題エディタ用の16pxダミーを使う。
const DUMMY_IMG = EDITOR_DUMMY_IMG;

// nameからEditorHandleを取得するヘルパー
const handleByName = (
  name: EditorKeyName,
  refs: {
    questionRef: React.RefObject<EditorHandle | null>;
    questionChoiceRefs: Array<React.RefObject<EditorHandle | null>>;
    answerRef: React.RefObject<EditorHandle | null>;
    answerChoiceRefs: Array<React.RefObject<EditorHandle | null>>;
  },
): EditorHandle | null => {
  switch (name) {
    case 'text':
      return refs.questionRef.current;
    case 'ch1':
      return refs.questionChoiceRefs[0].current;
    case 'ch2':
      return refs.questionChoiceRefs[1].current;
    case 'ch3':
      return refs.questionChoiceRefs[2].current;
    case 'ch4':
      return refs.questionChoiceRefs[3].current;
    case 'ch5':
      return refs.questionChoiceRefs[4].current;
    case 'answerText':
      return refs.answerRef.current;
    case 'answerText1':
      return refs.answerChoiceRefs[0].current;
    case 'answerText2':
      return refs.answerChoiceRefs[1].current;
    case 'answerText3':
      return refs.answerChoiceRefs[2].current;
    case 'answerText4':
      return refs.answerChoiceRefs[3].current;
    case 'answerText5':
      return refs.answerChoiceRefs[4].current;
    default:
      return null;
  }
};

const META_KEY_OPTIONS = META_KEYS.concat([
  'textStrong',
  'answerChoicesAllEmpty',
  PAST_EXAM_DUPLICATE_FAILED_KEY,
]);
type META_KEYS_TYPE = (typeof META_KEY_OPTIONS)[number];
const AUTO_CHECK_LABEL_MAP: Record<META_KEYS_TYPE, string> = {
  text: '[問題]本文が未入力です',
  textStrong: '[問題]本文に強調文が含まれていません',
  ch1: '[問題]選択肢1が未入力です',
  ch2: '[問題]選択肢2が未入力です',
  ch3: '[問題]選択肢3が未入力です',
  ch4: '[問題]選択肢4が未入力です',
  ch5: '[問題]選択肢5が未入力です',
  answerText: '[解説]本文が未入力です',
  answerText1: '[解説]選択肢1が未入力です',
  answerText2: '[解説]選択肢2が未入力です',
  answerText3: '[解説]選択肢3が未入力です',
  answerText4: '[解説]選択肢4が未入力です',
  answerText5: '[解説]選択肢5が未入力です',
  answerChoicesAllEmpty: '[解説]選択肢が全て未入力です',
  pastExamDuplicate: '出題年度(年号+年度)/学科/問題No が重複しています',

  subject: '科目が未入力です',
  answerNumber: '答えが未入力です',
  nengo: '元号が未入力です',
  year: '年度が未入力です',
  testNo: '問題No.が未入力です',
  publicationYear: '出典元発行年が未入力です',
  publicationNo: '出典元Noが未入力です',
  difficult: '難易度が未入力です',
  grade: '級が未入力です',
  bigCategoryTag: '大分類が未入力です',
  smallCategoryTag: '小分類が未入力です',
  themeTag: 'テーマが未入力です',

  questionEditorType: '問題エディタ種別が未選択です',
  answerEditorType: '解説エディタ種別が未選択です',
};

const editorIdToKeyName = (id: string): EditorKeyName | null => {
  // question_ → 本文
  if (id.startsWith('question_')) return 'text';
  // choice_ → ch1..ch5
  if (id.startsWith('choice_')) {
    const m = id.match(/_(\d+)$/);
    const n = m ? Number(m[1]) : NaN;
    if (Number.isInteger(n) && n >= 1 && n <= 5) {
      return `ch${n}` as EditorKeyName;
    }
    return null;
  }
  // answer_（数字なし）→ 解説本文
  if (id.startsWith('answer_') && !/_\d+$/.test(id)) return 'answerText';
  // answer_1..5 → 解答1..5
  if (id.startsWith('answer_')) {
    const m = id.match(/_(\d+)$/);
    const n = m ? Number(m[1]) : NaN;
    if (Number.isInteger(n) && n >= 1 && n <= 5) {
      return `answerText${n}` as EditorKeyName;
    }
    return null;
  }
  // old_ はEditorKeyName管理対象ではない（return null）
  return null;
};

/*
const normalizeMetaValue = (
  key: keyof TestData,
  v: unknown,
): string | number => {
  switch (key) {
    case 'grade':
      return typeof v === 'number' ? v : Number(v ?? -1);
    case 'testNo': {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? String(n) : '-1';
    }
    default:
      return String(v ?? '');
  }
};
*/
function kOf(it: AssetKey) {
  return `${it.grade}/${it.key}`;
}

function formatDuplicatePastExamMessage(ids: string[]): string {
  if (ids.length === 0) {
    return '出題年度(年号+年度)/学科/問題No が重複しています';
  }

  const visibleIds = ids.slice(0, 10);
  const hiddenCount = ids.length - visibleIds.length;
  const suffix = hiddenCount > 0 ? `, 他 ${hiddenCount} 件` : '';

  return `出題年度(年号+年度)/学科/問題No が重複しています: ID ${visibleIds.join(', ')}${suffix}`;
}

function formatRemoteSyncTargetNos(nos: Array<number | null>): string {
  const resolvedNos = nos.filter((no): no is number => typeof no === 'number');

  if (resolvedNos.length === 0) {
    return '問題No 不明';
  }

  const visibleNos = resolvedNos.slice(0, 10);
  const hiddenCount = resolvedNos.length - visibleNos.length;
  const suffix = hiddenCount > 0 ? `, 他 ${hiddenCount} 件` : '';

  return `問題No ${visibleNos.join(', ')}${suffix}`;
}

const imgTagRe = /<img\b[^>]*>/gi; // 元: /<img\s[^>]*>/gi
const PATCH_PREVIEW_META_KEYS = new Set<keyof TestData>([
  'grade',
  'subject',
  'answerNumber',
  'nengo',
  'year',
  'testNo',
  'difficult',
  'bigCategoryTag',
  'smallCategoryTag',
]);

const PREVIEW_DETACH_EVENT = 'preview:detach-request';
const REMOTE_SYNC_QUIET_MS = 1_000;
const REMOTE_SYNC_MAX_WAIT_MS = 5_000;

type Props = {
  onInitialEditorsReady?: () => void;
  onInitialEmbeddedImagesReady?: () => void;
};

const QuestionEditorPanel = React.memo(
  ({ onInitialEditorsReady, onInitialEmbeddedImagesReady }: Props) => {
    const navigate = useNavigate();
    const {
      selectedDataIdList,
      selectedDataId,
      setSelectedDataId,
      selectedGrade,
    } = useSelectedIdStore();
    const updateDisplayEntry = useSelectedDataDisplayStore(
      (state) => state.updateDisplayEntry,
    );
    const {
      editMap,
      pastExamDuplicateIndex,
      initializeFromTestData,
      mergeFromTestData,
      applyQuillHtml,
      applyEditPatch,
    } = useTestDataStore();
    const { committedSelectedTokens } = useTestDataList({
      selectedDataIdList,
      grade: selectedGrade,
    });

    const { addPanelWithPosition, closePanel, isPanelOpen } =
      useDockviewPanelManager();
    const { testDataMap } = useTestDataObserver({
      idList: selectedDataIdList,
    });
    // T47: imagesStateMap はインフラ層 useAssetCacheStore、imageItems は UI 層 useImageAssetStore から取得
    const { imagesStateMap, setImagesStateMap } = useAssetCacheStore();
    const { imageItems } = useImageAssetStore();
    const { save } = useSaveActionsStore();

    const [readyKeySet, setReadyKeySet] = useState<Set<EditorKeyName>>(
      new Set(),
    );
    const [isPreviewWindowOpen, setIsPreviewWindowOpen] = useState(false);

    const questionRef = useRef<EditorHandle | null>(null);
    const questionChoiceRefs = [
      useRef<EditorHandle | null>(null),
      useRef<EditorHandle | null>(null),
      useRef<EditorHandle | null>(null),
      useRef<EditorHandle | null>(null),
      useRef<EditorHandle | null>(null),
    ];
    const answerRef = useRef<EditorHandle | null>(null);
    const answerChoiceRefs = [
      useRef<EditorHandle | null>(null),
      useRef<EditorHandle | null>(null),
      useRef<EditorHandle | null>(null),
      useRef<EditorHandle | null>(null),
      useRef<EditorHandle | null>(null),
    ];
    const oldRef = useRef<EditorHandle | null>(null);
    const answerOldRef = useRef<EditorHandle | null>(null);
    const panelBodyRef = useRef<HTMLDivElement | null>(null);
    const effectivePastExamDuplicateIndexRef = useRef<PastExamDuplicateIndex>(
      createEmptyPastExamDuplicateIndex(),
    );
    const editMapRef = useRef(editMap);
    editMapRef.current = editMap;

    const [activeEditorTab, setActiveEditorTab] = useState<
      'questionEditorTab' | 'answerEditorTab'
    >('questionEditorTab');

    // 最後にカーソルが存在したエディタと位置を保持する
    const lastSelectionRef = useRef<{
      name: EditorKeyName;
      range: Range;
    } | null>(null);

    const editorUpdateMarksRef = useRef<Record<EditorKeyName, string | null>>(
      createEmptyEditorUpdateMarks(),
    );
    const currentDisplayedIdRef = useRef<string | null>(null);
    const previousCommittedTokensRef = useRef<Record<string, string>>({});
    const pendingRemoteSyncIdsRef = useRef<Set<string>>(new Set());
    const remoteSyncQuietTimerRef = useRef<number | null>(null);
    const remoteSyncMaxTimerRef = useRef<number | null>(null);
    const remoteSyncStartedAtRef = useRef<number | null>(null);
    const remoteConflictIdsRef = useRef<string[]>([]);
    const remoteDialogActiveRef = useRef(false);
    const pendingHtmlPreviewFrameRef = useRef<number | null>(null);

    const requestingImageKeys = useRef<string[]>([]);
    const hasReportedInitialEditorsReadyRef = useRef(false);
    const hasReportedInitialEmbeddedImagesReadyRef = useRef(false);
    const waitingInitialEmbeddedImagesRef = useRef(false);
    const initialPendingImageKeysRef = useRef<Set<string>>(new Set());

    const [revertDialogOpen, setRevertDialogOpen] = useState(false);
    const [backDialogOpen, setBackDialogOpen] = useState(false);
    const [saveErrorOpen, setSaveErrorOpen] = useState(false);
    const [saveErrorNo, setSaveErrorNo] = useState<number | null>(null);
    const [stopConfirmDialogOpen, setStopConfirmDialogOpen] = useState(false);
    const [remoteConflictDialogOpen, setRemoteConflictDialogOpen] =
      useState(false);
    const [remoteNoticeDialogOpen, setRemoteNoticeDialogOpen] = useState(false);
    const [remoteDialogTargetNos, setRemoteDialogTargetNos] = useState('');

    const [saving, setSaving] = useState<'one' | 'all' | null>(null);
    const [autoCheckOk, setAutoCheckOk] = useState<boolean>(false); // 自動チェック
    const [calibrationLocked, setCalibrationLocked] = useState<boolean>(false); // 校正ロック
    const [stopped, setStopped] = useState<boolean>(false); // 出題停止
    const [autoCheckDetail, setAutoCheckDetail] =
      useState<AutoCheckResult | null>(null);
    const [judgeDetail, setJudgeDetail] = useState<{
      shuffleable: JudgeResultWithReason;
      convertibleQaa: JudgeResultWithReason;
      negativeAnswer: NegativeAnswerJudge;
    } | null>(null);
    const [activeEditorKey, setActiveEditorKey] =
      useState<EditorKeyName | null>(null);

    const {
      dirtyIdSet,
      evaluateDirtyNext,
      initializeDirtyState,
      markIdsClean,
    } = useDirtyIdHooks({
      selectedDataId,
      selectedDataIdList,
      selectedGrade,
      editMap,
      testDataMap,
    });

    const testStatus = useMemo(() => {
      if (stopped) return 'stopped';
      if (!autoCheckOk) return 'error';
      return autoCheckOk && calibrationLocked ? 'ok' : 'waiting';
    }, [autoCheckOk, calibrationLocked, stopped]);

    const buildDuplicateCheckEntry = useCallback(
      (id: string, data: TestData) => {
        return {
          id,
          data: {
            grade: data.grade,
            nengo: data.nengo,
            year: data.year,
            subject: data.subject,
            testNo: data.testNo,
            isOriginal: data.isOriginal,
          },
        };
      },
      [],
    );

    const rebuildEffectivePastExamDuplicateIndex = useCallback(
      (overrideMap?: Record<string, TestData | undefined>) => {
        let nextIndex = clonePastExamDuplicateIndex(pastExamDuplicateIndex);

        for (const id of selectedDataIdList) {
          const data = overrideMap?.[id] ?? editMapRef.current[id]?.data;
          if (!data) continue;

          nextIndex = upsertPastExamDuplicateIndexEntry(
            nextIndex,
            buildDuplicateCheckEntry(id, data),
          );
        }

        effectivePastExamDuplicateIndexRef.current = nextIndex;
        return nextIndex;
      },
      [buildDuplicateCheckEntry, pastExamDuplicateIndex, selectedDataIdList],
    );

    const runAutoCheck = useCallback(
      (next?: TestData, targetId?: string) => {
        const id = String(targetId ?? selectedDataId ?? '');
        if (!id) return;

        const data = next ?? editMap[id]?.data;
        if (!data) return;

        const res = autoCheck(data, {
          duplicatePastExamIds: getPastExamDuplicateIds(
            effectivePastExamDuplicateIndexRef.current,
            buildDuplicateCheckEntry(id, data),
          ),
        });
        setAutoCheckDetail(res);

        const ok = res.status === 'success';
        setAutoCheckOk(ok);

        const nextStatus = deriveTestDataStatus({
          currentStatus: data.status,
          autoCheckOk: ok,
          calibrationCheck: data.calibrationCheck ?? false,
        });

        const prev = editMap[id]?.data;
        const prevAuto = prev?.autoCheck === true;
        const prevStatus = prev?.status;

        if (prev && (prevAuto !== ok || prevStatus !== nextStatus)) {
          applyEditPatch(id, { autoCheck: ok, status: nextStatus });
        }

        console.log('Auto-check result for ID:', id, res);

        setJudgeDetail({
          shuffleable: judgeIsShuffleableWithReason(data),
          convertibleQaa: judgeIsConvertibleQaaWithReason(data),
          negativeAnswer: judgeIsNegativeAnswerWithWord(data),
        });
      },
      [selectedDataId, editMap, applyEditPatch, buildDuplicateCheckEntry],
    );

    const answerFormBadge = useMemo(() => {
      if (!judgeDetail) return undefined;
      /*
      if (!judgeDetail.convertibleQaa.result) {
        return { type: 'not-applicable' } as const;
      }
        */
      if (judgeDetail.negativeAnswer.result) {
        return {
          type: 'negative',
          matchedWord: judgeDetail.negativeAnswer.matchedWord,
        } as const;
      }
      return { type: 'positive' } as const;
    }, [judgeDetail]);

    /*
    const comparedKeys = useMemo(() => {
      return selectedGrade === 'secondGrade'
        ? HTML_FIELDS
        : HTML_FIELDS.filter((k) => k !== 'ch5' && k !== 'answerText5');
    }, [selectedGrade]);

    // 原因確認のため、理由を全て洗うようにしているが、将来的には適宜continueするなどして効率化しても良いかもしれない
    const dirtyIdSet = useMemo(() => {
      const dirty = new Set<string>();

      for (const id of selectedDataIdList) {
        const edit = editMap[id]?.data;
        const baseEntry = testDataMap[id];
        const base = baseEntry?.raw;
        console.log({ id, edit, base });
        if (!edit || !base) continue;

        const [normalizedBase] = normalizeEditorTypesInTestData({ ...base });
        const strippedBase = applyCommonRulesToTestData(normalizedBase);

        // HTML差分
        const diffKeys = comparedKeys.filter((key) => {
          const ev = typeof edit[key] === 'string' ? (edit[key] as string) : '';
          const bv =
            typeof strippedBase[key] === 'string'
              ? (strippedBase[key] as string)
              : '';

          return ev !== bv;
        });

        // メタ差分
        const diffMetaKeys = META_KEYS.filter((key) => {
          const ev = normalizeMetaValue(key, edit[key]);
          const bv = normalizeMetaValue(key, base[key]);
          return ev !== bv;
        });

        const diffEditorTypeKeys = (
          ['questionEditorType', 'answerEditorType'] as const
        ).filter((key) => {
          return String(edit[key] ?? '') !== String(strippedBase[key] ?? '');
        });

        // calibrationCheck差分
        const calibrationEditValue =
          selectedDataId === id
            ? calibrationLocked
            : (edit.calibrationCheck ?? false);
        const calibrationBaseValue = Boolean(strippedBase.calibrationCheck);
        const hasCalibrationDiff =
          calibrationEditValue !== calibrationBaseValue;

        // status差分は停止中かどうかのみを判定

        const statusEditValue = String(edit.status ?? '');
        const statusBaseValue = String(base.status ?? '');
        const hasStatusDiff =
          statusEditValue === '停止中'
            ? statusBaseValue !== '停止中'
            : statusBaseValue === '停止中';

        const dirtyReasons = {
          html: diffKeys,
          meta: diffMetaKeys,
          editorType: diffEditorTypeKeys,
          calibrationCheck: hasCalibrationDiff
            ? {
                editValue: calibrationEditValue,
                baseValue: calibrationBaseValue,
              }
            : null,
          status: hasStatusDiff
            ? {
                editValue: statusEditValue,
                baseValue: statusBaseValue,
              }
            : null,
        };

        const hasDirty =
          dirtyReasons.html.length > 0 ||
          dirtyReasons.meta.length > 0 ||
          dirtyReasons.editorType.length > 0 ||
          dirtyReasons.calibrationCheck !== null ||
          dirtyReasons.status !== null;

        if (hasDirty) {
          dirty.add(id);

          console.debug('[dirty-summary]', {
            id,
            no: edit.no ?? base.no ?? '',
            reasons: dirtyReasons,
          });
        }
      }

      return dirty;
    }, [
      selectedDataIdList,
      editMap,
      testDataMap,
      comparedKeys,
      calibrationLocked,
      selectedDataId,
    ]);
    */
    // 現在選択中のIDに編集差分があるか
    const isCurrentDirty = useMemo(() => {
      return selectedDataId ? dirtyIdSet.has(selectedDataId) : false;
    }, [dirtyIdSet, selectedDataId]);

    // 必須キーの判定（未マウントのEditorHandleは対象外）
    // biome-ignore lint/correctness/useExhaustiveDependencies: useRefは不要
    const getRequiredKeys = useCallback((): EditorKeyName[] => {
      const baseNames =
        selectedGrade === 'secondGrade'
          ? updaterNames
          : updaterNames.filter((n) => n !== 'ch5' && n !== 'answerText5');

      return baseNames.filter((name) => {
        const h = handleByName(name, {
          questionRef,
          questionChoiceRefs,
          answerRef,
          answerChoiceRefs,
        });
        return !!h;
      });
    }, [selectedGrade]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: useRefは不要
    const getEditorHandleByName = useCallback(
      (name: EditorKeyName): EditorHandle | null => {
        return handleByName(name, {
          questionRef,
          questionChoiceRefs,
          answerRef,
          answerChoiceRefs,
        });
      },
      [],
    );

    const isEditorInTab = useCallback(
      (
        name: EditorKeyName,
        tab: 'questionEditorTab' | 'answerEditorTab',
      ): boolean => {
        if (tab === 'questionEditorTab') {
          return name === 'text' || name.startsWith('ch');
        }
        return name === 'answerText' || name.startsWith('answerText');
      },
      [],
    );

    const handleEditorSelectionChange = useCallback(
      (id: string, range: Range | null) => {
        const name = editorIdToKeyName(id);
        if (!name || !range) return;

        lastSelectionRef.current = { name, range };
        setActiveEditorKey(name);
      },
      [],
    );
    const invalidEditorKeySet = useMemo(
      () => new Set<EditorKeyName>(autoCheckDetail?.missingEditorKeys ?? []),
      [autoCheckDetail],
    );

    const invalidMetaKeySet = useMemo(
      () => new Set<keyof TestData>(autoCheckDetail?.missingMetaKeys ?? []),
      [autoCheckDetail],
    );

    const invalidEditorTypeSet = useMemo(
      () =>
        new Set<'questionEditorType' | 'answerEditorType'>(
          autoCheckDetail?.missingEditorType ?? [],
        ),
      [autoCheckDetail],
    );

    const autoCheckDetailMessages = useMemo(() => {
      if (!autoCheckDetail) return [];

      return autoCheckDetail.failedKeys.map((key) => {
        if (key === PAST_EXAM_DUPLICATE_FAILED_KEY) {
          return formatDuplicatePastExamMessage(
            autoCheckDetail.duplicatePastExamIds,
          );
        }
        return AUTO_CHECK_LABEL_MAP[key] ?? `${key} にエラーがあります`;
      });
    }, [autoCheckDetail]);

    // エラー件数の文言生成
    const autoCheckMessage = useMemo(() => {
      if (!autoCheckDetail) return '未判定';

      const errorCount = autoCheckDetail.failedKeys.length;
      return errorCount === 0 ? '正常' : `エラー ${errorCount}件`;
    }, [autoCheckDetail]);

    // エラー有無の判定
    const autoCheckHasError = useMemo(() => {
      return (autoCheckDetail?.failedKeys.length ?? 0) > 0;
    }, [autoCheckDetail]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: useRef入れられないため
    const getQuestionFieldPatchFromId = useCallback(
      (id: string): { key: keyof TestData; html: string } | null => {
        const name = editorIdToKeyName(id);
        if (name === 'text') {
          return { key: 'text', html: questionRef.current?.getHtml() || '' };
        }
        if (name?.startsWith('ch')) {
          const idx = Number(name.replace('ch', '')); // 1..5
          const ref = questionChoiceRefs[idx - 1]?.current;
          return {
            key: `ch${idx}` as keyof TestData,
            html: ref?.getHtml() || '',
          };
        }
        // 旧（質問側）
        if (id.startsWith('old_')) {
          return { key: 'old', html: oldRef.current?.getHtml() || '' };
        }
        return null;
      },
      [],
    );

    // biome-ignore lint/correctness/useExhaustiveDependencies: useRefは依存に含められないため
    const getAnswerFieldPatchFromId = useCallback(
      (id: string): { key: keyof TestData; html: string } | null => {
        const name = editorIdToKeyName(id);
        if (name === 'answerText') {
          return {
            key: 'answerText',
            html: answerRef.current?.getHtml() || '',
          };
        }
        if (name?.startsWith('answerText')) {
          const idx = Number(name.replace('answerText', '')); // 1..5
          const ref = answerChoiceRefs[idx - 1]?.current;
          return {
            key: `answerText${idx}` as keyof TestData,
            html: ref?.getHtml() || '',
          };
        }
        // 旧（解説側）
        if (id.startsWith('old_')) {
          return { key: 'old', html: answerOldRef.current?.getHtml() || '' };
        }
        return null;
      },
      [],
    );

    // 全必須エディタが現在IDで更新済みかをチェック
    const areAllEditorsUpdatedFor = useCallback(
      (id: string): boolean => {
        const req = getRequiredKeys();
        console.log(
          'Checking if all editors are updated for ID:',
          id,
          editorUpdateMarksRef.current,
        );
        return req.every((name) => editorUpdateMarksRef.current[name] === id);
      },
      [getRequiredKeys],
    );

    // １エディタ更新完了マーク
    const markEditorUpdated = useCallback(
      (name: EditorKeyName, id: string): void => {
        editorUpdateMarksRef.current[name] = id;
      },
      [],
    );

    // biome-ignore lint/correctness/useExhaustiveDependencies: useRefは依存に含めない
    const getEditorHandles = useCallback((): Array<EditorHandle | null> => {
      return [
        questionRef.current,
        questionChoiceRefs[0].current,
        questionChoiceRefs[1].current,
        questionChoiceRefs[2].current,
        questionChoiceRefs[3].current,
        questionChoiceRefs[4].current,
        answerRef.current,
        answerChoiceRefs[0].current,
        answerChoiceRefs[1].current,
        answerChoiceRefs[2].current,
        answerChoiceRefs[3].current,
        answerChoiceRefs[4].current,
      ];
    }, []);

    const buildEditorUpdater = useCallback(
      (source: TestData): Array<[EditorHandle | null, string]> => {
        const handles = getEditorHandles();

        return [
          [handles[0], source.text],
          [handles[1], source.ch1],
          [handles[2], source.ch2],
          [handles[3], source.ch3],
          [handles[4], source.ch4],
          [handles[5], source.ch5],
          [handles[6], source.answerText],
          [handles[7], source.answerText1],
          [handles[8], source.answerText2],
          [handles[9], source.answerText3],
          [handles[10], source.answerText4],
          [handles[11], source.answerText5],
        ];
      },
      [getEditorHandles],
    );

    // demo-asset URL の生成には grade が要るため、状態と一緒に解決元の id も返す
    const resolveImageEntryByKey = useCallback(
      (key: string, gradeOverride?: string) => {
        const idFromOverride = gradeOverride
          ? `${gradeOverride}/${key}`
          : undefined;
        const idFromSelected = selectedGrade
          ? `${selectedGrade}/${key}`
          : undefined;

        const directId =
          (idFromOverride && imagesStateMap[idFromOverride]
            ? idFromOverride
            : undefined) ??
          (idFromSelected && imagesStateMap[idFromSelected]
            ? idFromSelected
            : undefined);

        const id =
          directId ??
          Object.keys(imagesStateMap).find((candidate) =>
            candidate.endsWith(`/${key}`),
          );
        if (!id) return undefined;

        const [grade] = id.split('/');
        if (grade !== 'firstGrade' && grade !== 'secondGrade') return undefined;
        return { grade: grade as GradeId, key, state: imagesStateMap[id] };
      },
      [imagesStateMap, selectedGrade],
    );

    const getImageStateByKey = useCallback(
      (key: string, gradeOverride?: string) =>
        resolveImageEntryByKey(key, gradeOverride)?.state,
      [resolveImageEntryByKey],
    );

    // ready アセットを 1 つの img へ適用する。src が既に一致するなら false を返す。
    // contentType は png/jpeg/jpg/gif/webp のみサニタイザで許可される（注意1）。
    const applyReadyAssetToImg = useCallback(
      (img: HTMLImageElement, key: string): boolean => {
        const entry = resolveImageEntryByKey(key);
        const st = entry?.state;
        if (!entry || st?.status !== 'ready') return false;
        const url = buildReadyAssetUrl(entry.grade, key, st);
        // 同一URLでも表示失敗マーカーが残っていれば再適用する（設計10.5）
        const hasFailureMarker =
          img.getAttribute(ASSET_LOAD_FAILED_ATTRIBUTE) === '1';
        if (img.getAttribute('src') === url && !hasFailureMarker) return false;
        img.removeAttribute(ASSET_LOAD_FAILED_ATTRIBUTE);
        img.setAttribute('src', url);
        // 寸法未設定ならアセット寸法を補完（既存 replaceImageTagsInRaw と同等）
        if (!img.getAttribute('width') && st.width) {
          img.setAttribute('width', String(st.width));
        }
        if (!img.getAttribute('height') && st.height) {
          img.setAttribute('height', String(st.height));
        }
        return true;
      },
      [resolveImageEntryByKey],
    );

    // ready になった画像アセットを、各エディタ DOM 内の該当 img の src へ局所差し替えする。
    // 全体 setHtml（pickedUpdatingRawParts isForce）だと未確定の IME 入力やキャレットが
    // 壊れるため、属性のみ更新し silent flush で text-change / history を発生させない（欠陥B）。
    const realizeEditorImagesForReadyKeys = useCallback(
      (keys: string[]) => {
        if (keys.length === 0) return;
        for (const handle of getEditorHandles()) {
          const quill = handle?.getQuill();
          // 未マウントのエディタはスキップ。マウント時の初期化は editMap 由来の
          // realized html を流し込む既存経路でカバーされる。
          if (!quill) continue;
          let changed = false;
          for (const key of keys) {
            quill.root
              .querySelectorAll<HTMLImageElement>(
                `img[alt="${CSS.escape(key)}"]`,
              )
              .forEach((img) => {
                if (applyReadyAssetToImg(img, key)) changed = true;
              });
          }
          // 属性変更ミューテーションを silent で flush し、user 扱いの
          // text-change / history 記録を防ぐ（注意2）。
          if (changed) quill.update('silent');
        }
      },
      [getEditorHandles, applyReadyAssetToImg],
    );

    // undo/redo は Delta から img を再構築するため src が DUMMY に戻り得る（注意3）。
    // text-change 後に rAF で、src が DUMMY のままの img[alt] を ready アセットへ
    // 再差し替えする軽量チェックを予約する（複数 text-change は 1 フレームに合流）。
    const reRealizeDummyFrameRef = useRef<number | null>(null);
    const scheduleReRealizeDummyImages = useCallback(() => {
      if (reRealizeDummyFrameRef.current != null) return;
      reRealizeDummyFrameRef.current = window.requestAnimationFrame(() => {
        reRealizeDummyFrameRef.current = null;
        for (const handle of getEditorHandles()) {
          const quill = handle?.getQuill();
          if (!quill) continue;
          let changed = false;
          quill.root
            .querySelectorAll<HTMLImageElement>('img[alt]')
            .forEach((img) => {
              const src = img.getAttribute('src');
              // 既に実データが入っているものは触らない（DUMMY のみ対象）
              if (src && src !== DUMMY_IMG) return;
              const key = img.getAttribute('alt');
              if (!key) return;
              if (applyReadyAssetToImg(img, key)) changed = true;
            });
          if (changed) quill.update('silent');
        }
      });
    }, [getEditorHandles, applyReadyAssetToImg]);

    // raw内にimgタグがあるかどうかをチェックし、画像をimagesStateMapにready状態で登録されているもの/ready状態以外のもの/未登録のものに分けて処理
    const checkRawImages = useCallback(
      (raw: string | undefined) => {
        if (!raw || typeof raw !== 'string')
          return { readyKeys: [], notReadyKeys: [], notRegisteredKeys: [] };

        // rawから画像キーを抽出
        const keysInRaw = extractImageIdsFromHtml(raw);
        // ready状態で登録されているもの
        const readyKeys: string[] = [];
        // ready状態以外のもの
        const notReadyKeys: string[] = [];
        // 未登録のもの
        const notRegisteredKeys: string[] = [];
        keysInRaw.forEach((key) => {
          const st = getImageStateByKey(key);
          console.log('Checking image key:', `${selectedGrade}/${key}`, st);
          if (st?.status === 'ready') {
            readyKeys.push(key);
          } else if (st) {
            notReadyKeys.push(key);
          } else {
            notRegisteredKeys.push(key);
          }
        });

        /*
      console.log('Image Keys in raw:', keysInRaw);
      console.log('Ready Keys:', readyKeys);
      console.log('Not Ready Keys:', notReadyKeys);
      console.log('Not registered Keys:', notRegisteredKeys);
      */
        return { readyKeys, notReadyKeys, notRegisteredKeys };
      },
      [getImageStateByKey, selectedGrade],
    );

    // 指定のidle状態の画像ID群をリクエストして監視対象に追加
    const requestAndWatchImageIds = useCallback(
      async (keys: string[]) => {
        if (!selectedGrade) return;

        const uniqueKeys = Array.from(new Set(keys.filter(Boolean)));
        if (uniqueKeys.length === 0) return;

        const assetKeys: AssetKey[] = uniqueKeys.map((key) => ({
          grade: selectedGrade,
          key,
        }));
        const res = await window.assets.request(assetKeys);
        console.log('Requested asset keys:', assetKeys, 'Response:', res);
        if (!res.ok) return;

        // 削除済み・不存在・状態確認不能・回復上限は failed として反映する（設計10.5）
        for (const f of res.failed) {
          const id = kOf(f);
          setImagesStateMap((prev) => ({
            ...prev,
            [id]: { status: 'failed', message: f.message },
          }));
        }

        // readyは即時state反映
        for (const r of res.ready) {
          const id = kOf(r); // `${grade}/${key}`
          setImagesStateMap((prev) => ({
            ...prev,
            [id]: mergeReadyImageState(prev[id], r),
          }));

          readImageDimensionsFromAsset({
            url: buildReadyAssetUrl(r.grade, r.key, r),
          }).then((dimensions) => {
            if (!dimensions) return;
            setImagesStateMap((prev) => ({
              ...prev,
              [id]: mergeImageMetaState(prev[id], dimensions),
            }));
          });
        }

        // pendingはqueuedに
        setImagesStateMap((prev) => {
          const next = { ...prev };
          for (const p of res.pending) {
            const id = kOf(p);
            const cur = next[id];
            if (!cur || cur.status === 'idle' || cur.status === 'failed') {
              next[id] = {
                status: 'queued',
                width: cur?.width,
                height: cur?.height,
              };
            }
          }
          return next;
        });

        const pendingKeys = res.pending.map((p) => p.key);
        const readyKeys = res.ready.map((r) => r.key);
        requestingImageKeys.current = Array.from(
          new Set([
            ...requestingImageKeys.current,
            ...pendingKeys,
            ...readyKeys,
          ]),
        );

        console.log('Requested and watching image keys:', uniqueKeys);
      },
      [selectedGrade, setImagesStateMap],
    );

    // HTML更新
    const updateHtml = useCallback(
      async (
        editorRef: EditorHandle | null,
        html: string,
        opts?: { resetHistory?: boolean },
      ): Promise<boolean> => {
        if (!editorRef) return false;
        try {
          editorRef.setHtml(html); // setHtmlはキャレット復元付き
          if (opts?.resetHistory) {
            editorRef.resetHistory(); // 履歴消去（問題切替・初期化時のみ）
          }
          return true;
        } catch (e) {
          console.error('Failed to update HTML in editor:', e);
          return false;
        }
      },
      [],
    );

    // quillデータ中に<img alt="画像キー" .../>があるか解析し、画像キーがkeysの中にある場合、imagesStateMapから画像IDをチェックし、<img src="Base64データ"alt="画像ID" .../>の形式に書き換える
    const replaceImageTagsInRaw = useCallback(
      (
        raw: string | undefined,
        keys: string[],
        gradeOverride?: string,
      ): { modifiedHtml: string; hasNotReadyForImages: boolean } => {
        if (!raw || typeof raw !== 'string')
          return { modifiedHtml: '', hasNotReadyForImages: false };

        // ここで一度のreplaceで安全に処理
        let hasNotReadyForImages = false;
        const modifiedHtml = raw.replace(imgTagRe, (tag) => {
          const attrs = parseImgTagAttributes(tag);
          const alt = attrs?.alt as string | undefined;
          console.log('Found image tag with alt value:', alt);

          const entry = alt
            ? resolveImageEntryByKey(alt, gradeOverride)
            : undefined;
          const st = entry?.state;
          const item = imageItems.find((item) => item.key === alt);
          const width = attrs?.width ?? item?.width ?? '';
          const height = attrs?.height ?? item?.height ?? '';

          // src/alt/width/height以外のタグ要素があれば復元する
          const other = attrs
            ? Object.keys(attrs).reduce((acc, key) => {
                if (
                  key !== 'src' &&
                  key !== 'alt' &&
                  key !== 'width' &&
                  key !== 'height'
                ) {
                  acc += ` ${key}="${attrs[key]}"`;
                }
                return acc;
              }, '')
            : '';

          if (entry && alt && keys.includes(alt) && st?.status === 'ready') {
            // 元のimgタグの属性は保持したい場合は、srcだけを追加する置換にする
            // ここでは最小変更としてタグ全体を差し替え
            const result = `<img src="${buildReadyAssetUrl(entry.grade, alt, st)}" alt="${alt}" width="${width}" height="${height}"${other} />`;
            return result;
          }
          if (
            st?.status === 'downloading' ||
            st?.status === 'queued' ||
            st?.status === 'idle'
          ) {
            hasNotReadyForImages = true;
          }
          // 画像がready状態でない場合は元のタグをそのまま返し、srcにダミーを指定する
          const result = `<img src="${DUMMY_IMG}" alt="${alt}" width="${width}" height="${height}"${other} />`;
          return result;
        });

        //      console.log('Modified HTML after replacing image tags:', modifiedHtml);

        return { modifiedHtml, hasNotReadyForImages };
      },
      [resolveImageEntryByKey, imageItems],
    );
    // フォーカス中のエディタを推定（Quill.getSelection があるもの）
    /*
    const getActiveEditor = useCallback((): EditorHandle | null => {
      const allRefs: (EditorHandle | null)[] = [
        questionRef.current,
        ...questionChoiceRefs.map((r) => r.current),
        answerRef.current,
        ...answerChoiceRefs.map((r) => r.current),
        oldRef.current,
        answerOldRef.current,
      ];
      for (const h of allRefs) {
        const q = h?.getQuill();
        try {
          const sel = q?.getSelection?.(false);
          if (sel) return h ?? null;
        } catch {
          // ignore
        }
      }
      return questionRef.current ?? null;
    }, []);
    */

    const initializeCheck = useCallback(
      (id: string, testData: TestData) => {
        console.log(
          'Updating calibration and auto-check state for ID:',
          testData,
        );
        setCalibrationLocked(testData.calibrationCheck ?? false);
        const res = autoCheck(testData, {
          duplicatePastExamIds: getPastExamDuplicateIds(
            effectivePastExamDuplicateIndexRef.current,
            buildDuplicateCheckEntry(id, testData),
          ),
        });
        setAutoCheckOk(res.status === 'success');
        setAutoCheckDetail(res);
        setStopped(testData.status === '停止中');
        setJudgeDetail({
          shuffleable: judgeIsShuffleableWithReason(testData),
          convertibleQaa: judgeIsConvertibleQaaWithReason(testData),
          negativeAnswer: judgeIsNegativeAnswerWithWord(testData),
        });
      },
      [buildDuplicateCheckEntry],
    );

    const initializedRef = useRef(false);

    // biome-ignore lint/correctness/useExhaustiveDependencies: selectedDataIdListとtestDataMap、各種Editorが準備完了時に一度だけ
    useEffect(() => {
      if (!selectedDataIdList.length) return;
      if (initializedRef.current) return;
      // testDataMapが揃ったら
      const hasSources = selectedDataIdList.every((id) => {
        const src = testDataMap[id];
        return !!src?.raw;
      });
      if (!hasSources) return;
      // 各種Editorが準備完了したら
      const required = getRequiredKeys();
      const allReady = required.every((n) => readyKeySet.has(n));
      if (!allReady) return;

      console.log('init effect', {
        selectedDataIdList,
        selectedDataId,
        initialized: initializedRef.current,
        testDataMapKeys: Object.keys(testDataMap),
      });

      const fresh = initializeFromTestData({
        idList: selectedDataIdList,
        testDataMap,
        isOverWritten: true,
      });
      rebuildEffectivePastExamDuplicateIndex(
        Object.fromEntries(
          Object.entries(fresh).map(([id, entry]) => [id, entry.data]),
        ),
      );

      initializedRef.current = true;
      previousCommittedTokensRef.current = committedSelectedTokens;
      // プレビューのパッチ送信を一時停止
      suspendPreviewPatch();
      // 初期化直後のみ同期を実施（履歴はクリア）
      pickedUpdatingRawParts({ resetHistory: true, freshMap: fresh });
      initializeDirtyState(selectedDataIdList);
      initializeCheck(
        selectedDataIdList[0],
        fresh[selectedDataIdList[0]]?.data as TestData,
      );
      // プレビューのパッチ再開
      resumePreviewPatch({
        source: fresh[selectedDataIdList[0]]?.data as TestData,
        dispatchFull: true,
      });
      console.log('Initialized with fresh data:', fresh);
    }, [
      selectedDataId,
      testDataMap,
      readyKeySet,
      committedSelectedTokens,
      selectedDataIdList,
    ]);

    // 問題切替時のみ同期（履歴クリア）
    // biome-ignore lint/correctness/useExhaustiveDependencies: 問題切り替え時のみ
    useEffect(() => {
      if (!initializedRef.current) return;
      if (!selectedDataIdList.length) return;
      if (selectedDataId === undefined) return;

      const currentData = editMapRef.current[selectedDataId]?.data;
      if (!currentData) return;

      lastSelectionRef.current = null;
      setActiveEditorKey(null);

      console.log('Selected Data ID changed:', selectedDataId);
      suspendPreviewPatch();
      pickedUpdatingRawParts({ resetHistory: true });

      initializeCheck(selectedDataId, currentData);
      /*      if (editMap[selectedDataId]?.data)
        initializeCheck(selectedDataId, editMap[selectedDataId]?.data); */
    }, [selectedDataId]);

    /*
    // biome-ignore lint/correctness/useExhaustiveDependencies:問題切替時の自動チェック
    useEffect(() => {
      // rebuildEffectivePastExamDuplicateIndex();

      if (!selectedDataId) return;

      const currentData = editMapRef.current[selectedDataId]?.data;
      if (!currentData) return;

      runAutoCheck(currentData, selectedDataId);
    }, [selectedDataId]);
    */

    // IPCイベントの購読・初期化
    // biome-ignore lint/correctness/useExhaustiveDependencies: 初回マウント時のみ登録
    useEffect(() => {
      initializedRef.current = false;
      currentDisplayedIdRef.current = null;
      editorUpdateMarksRef.current = createEmptyEditorUpdateMarks();
      previousCommittedTokensRef.current = {};
      pendingRemoteSyncIdsRef.current.clear();
      remoteConflictIdsRef.current = [];
      remoteDialogActiveRef.current = false;
      remoteSyncStartedAtRef.current = null;
      setRemoteDialogTargetNos('');
      if (remoteSyncQuietTimerRef.current !== null) {
        clearTimeout(remoteSyncQuietTimerRef.current);
        remoteSyncQuietTimerRef.current = null;
      }
      if (remoteSyncMaxTimerRef.current !== null) {
        clearTimeout(remoteSyncMaxTimerRef.current);
        remoteSyncMaxTimerRef.current = null;
      }

      const el = panelBodyRef.current;
      if (!el) return;

      const applyToAllEditors = (w: number) => {
        const handles: (EditorHandle | null)[] = [
          questionRef.current,
          ...questionChoiceRefs.map((r) => r.current),
          answerRef.current,
          ...answerChoiceRefs.map((r) => r.current),
          oldRef.current,
          answerOldRef.current,
        ];
        handles.forEach((h) => {
          h?.setWidth(w);
        });
      };

      const update = () => {
        const rect = el.getBoundingClientRect();
        const width = Math.floor(rect.width);
        if (!Number.isFinite(width) || width <= 0) return;
        applyToAllEditors(width - 32);
      };

      // 初回 & 監視
      update();
      const ro = new ResizeObserver(update);
      ro.observe(el);
      const onWinResize = () => update();
      window.addEventListener('resize', onWinResize);

      return () => {
        if (remoteSyncQuietTimerRef.current !== null) {
          clearTimeout(remoteSyncQuietTimerRef.current);
          remoteSyncQuietTimerRef.current = null;
        }
        if (remoteSyncMaxTimerRef.current !== null) {
          clearTimeout(remoteSyncMaxTimerRef.current);
          remoteSyncMaxTimerRef.current = null;
        }
        ro.disconnect();
        window.removeEventListener('resize', onWinResize);
        // offReady?.();
      };
    }, []);

    // biome-ignore lint/correctness/useExhaustiveDependencies: imagesStateMapの変更を監視
    useEffect(() => {
      /* console.log(
        'imagesStateMap changed:',
        imagesStateMap,
        requestingImageKeys.current,
      );
 */
      // readyになったキー一覧（grade を外した key 部分を抽出）
      const readyKeys = Object.entries(imagesStateMap)
        .filter(([, st]) => st?.status === 'ready')
        .map(([id]) => id.split('/').slice(1).join('/'));

      // requestingImageKeys.current は「key」形式で保持
      const newReadyKeys = readyKeys.filter((key) =>
        requestingImageKeys.current.includes(key),
      );

      if (newReadyKeys.length === 0) return;

      // ready になった画像は、全エディタの該当 img の src だけを局所差し替えする（欠陥B）。
      // 旧実装の pickedUpdatingRawParts({ isForce: true }) は全エディタを丸ごと
      // setHtml し直すため、未確定の IME 入力やキャレット位置が壊れていた。
      realizeEditorImagesForReadyKeys(newReadyKeys);

      // プレビューの差分パッチ（画像だけの更新）
      /*
      patchPreviewImages(String(selectedDataId ?? '')).catch((e: unknown) =>
        console.warn('patchImages failed', e),
      );
      */

      dispatchPreviewImagePatch(String(selectedDataId ?? '')).catch(
        (e: unknown) => console.warn('patchImages failed', e),
      );

      // 初回待機中の画像キーから消し込む
      if (
        waitingInitialEmbeddedImagesRef.current &&
        !hasReportedInitialEmbeddedImagesReadyRef.current
      ) {
        for (const key of newReadyKeys) {
          initialPendingImageKeysRef.current.delete(key);
        }
      }
      // 処理済みのキーをキューから除外（key形式で一致）
      requestingImageKeys.current = requestingImageKeys.current.filter(
        (key) => !newReadyKeys.includes(key),
      );

      // 初回待機対象がなくなったら通知
      if (
        waitingInitialEmbeddedImagesRef.current &&
        !hasReportedInitialEmbeddedImagesReadyRef.current &&
        initialPendingImageKeysRef.current.size === 0
      ) {
        hasReportedInitialEmbeddedImagesReadyRef.current = true;
        waitingInitialEmbeddedImagesRef.current = false;
        onInitialEmbeddedImagesReady?.();
      }
    }, [imagesStateMap]);

    const getCurrentPreviewSource = useCallback(() => {
      if (!selectedDataId) return undefined;
      return editMapRef.current[selectedDataId]?.data;
    }, [selectedDataId]);

    /*
    // 初回・問題切替完了時に送るフルレンダ命令（payload構造は当面batchと同じ）
    // biome-ignore lint/correctness/useExhaustiveDependencies: useRefは不要
    const fullBuildPreview = useCallback(
      (source?: TestData) => {
        if (!selectedDataId) return;
        const src = source ?? editMap[selectedDataId]?.data;
        if (!src) return;

        console.log('Full building preview for ID:', selectedDataId, src);

        const payload: PreviewSendArgs = {
          id: String(src.id ?? src.no ?? selectedDataId),
          subject: String(src.subject || ''),
          bigCategoryTag: String(src.bigCategoryTag || ''),
          smallCategoryTag: String(src.smallCategoryTag || ''),
          nengo: String(src.nengo || ''),
          year: String(src.year || ''),
          difficult: src.difficult || '0',
          testNo: String(src.testNo || ''),
          answerNo: src.answerNumber,
          answerBool: src.isNegativeAnswer ? !src.answer : Boolean(src.answer),
          publicationYear: src.publicationYear || '',
          publicationNo: String(src.publicationNo || ''),
          otherTags: src.otherTags || [],
          html: {
            text: questionRef.current?.getPreviewHtml() || '',
            questionChoices: [
              questionChoiceRefs[0].current?.getPreviewHtml() || '',
              questionChoiceRefs[1].current?.getPreviewHtml() || '',
              questionChoiceRefs[2].current?.getPreviewHtml() || '',
              questionChoiceRefs[3].current?.getPreviewHtml() || '',
              questionChoiceRefs[4].current?.getPreviewHtml() || '',
            ],
            answerText: answerRef.current?.getPreviewHtml() || '',
            answerChoices: [
              answerChoiceRefs[0].current?.getPreviewHtml() || '',
              answerChoiceRefs[1].current?.getPreviewHtml() || '',
              answerChoiceRefs[2].current?.getPreviewHtml() || '',
              answerChoiceRefs[3].current?.getPreviewHtml() || '',
              answerChoiceRefs[4].current?.getPreviewHtml() || '',
            ],
          },
          options: {
            mode: 'both',
            hasCover: false,
            questionCount: 1,
            meta: {
              title: '',
              subject: src.subject,
              grade: String(src.grade ?? ''),
            },
            page: { size: 'A4', pxPerMm: 0.2645, baseHeightMm: 235 },
            questionEditorType: src.questionEditorType ?? 'normal',
            answerEditorType: src.answerEditorType ?? 'normal',
            hasSubCategoryHeading: false,
            hasNoNengoAndYear: src.isOriginal, // オリジナル問題は年号・難易度非表示
            hasNoDifficult: false,
            isOriginal: src.isOriginal ?? false,
          },
          questionEditorType: src.questionEditorType ?? 'normal',
          answerEditorType: src.answerEditorType ?? 'normal',
        };
        console.log('Sending full preview with payload:', payload);
        sendPreviewFull(payload);
      },
      [selectedDataId, editMap],
    );

    // 現在選択中のIDからプレビュー送信用ペイロードを構築
    // biome-ignore lint/correctness/useExhaustiveDependencies: useRefに依存しているため
    const batchBuildPreview = useCallback(
      (source?: TestData) => {
        if (!selectedDataId) return;
        const src = source ?? editMap[selectedDataId]?.data;
        if (!src) return;

        console.log('Batch building preview for ID:', selectedDataId, src);
        sendPreviewPatch({
          id: String(src.id ?? src.no ?? selectedDataId),
          subject: String(src.subject || ''),
          bigCategoryTag: String(src.bigCategoryTag || ''),
          smallCategoryTag: String(src.smallCategoryTag || ''),
          nengo: String(src.nengo || ''),
          year: String(src.year || ''),
          difficult: src.difficult || '0',
          testNo: String(src.testNo || ''),
          answerNo: src.answerNumber,
          answerBool: src.isNegativeAnswer ? !src.answer : Boolean(src.answer),
          publicationYear: src.publicationYear || '',
          publicationNo: String(src.publicationNo || ''),
          otherTags: src.otherTags || [],
          html: {
            text: questionRef.current?.getPreviewHtml() || '',
            questionChoices: [
              questionChoiceRefs[0].current?.getPreviewHtml() || '',
              questionChoiceRefs[1].current?.getPreviewHtml() || '',
              questionChoiceRefs[2].current?.getPreviewHtml() || '',
              questionChoiceRefs[3].current?.getPreviewHtml() || '',
              questionChoiceRefs[4].current?.getPreviewHtml() || '',
            ],
            answerText: answerRef.current?.getPreviewHtml() || '',
            answerChoices: [
              answerChoiceRefs[0].current?.getPreviewHtml() || '',
              answerChoiceRefs[1].current?.getPreviewHtml() || '',
              answerChoiceRefs[2].current?.getPreviewHtml() || '',
              answerChoiceRefs[3].current?.getPreviewHtml() || '',
              answerChoiceRefs[4].current?.getPreviewHtml() || '',
            ],
          },
          options: {
            mode: 'both',
            hasCover: false,
            questionCount: 1,
            meta: {
              title: '',
              subject: src.subject,
              grade: String(src.grade ?? ''),
            },
            page: { size: 'A4', pxPerMm: 0.2645, baseHeightMm: 235 },
            questionEditorType: src.questionEditorType ?? 'normal',
            answerEditorType: src.answerEditorType ?? 'normal',
            hasSubCategoryHeading: false,
            hasNoNengoAndYear: src.isOriginal, // オリジナル問題は年号・難易度非表示
            hasNoDifficult: false,
            isOriginal: src.isOriginal ?? false,
          },
        });
      },
      [selectedDataId, editMap],
    );
*/
    const {
      fullBuildPreview,
      batchBuildPreview,
      dispatchPreviewImagePatch,
      suspendPreviewPatch,
      resumePreviewPatch,
    } = usePreviewDispatcher({
      selectedDataId,
      getCurrentPreviewSource,
    });
    const scheduleLatestPreviewBuild = useCallback(
      (targetId: string) => {
        if (pendingHtmlPreviewFrameRef.current != null) {
          window.cancelAnimationFrame(pendingHtmlPreviewFrameRef.current);
        }

        pendingHtmlPreviewFrameRef.current = window.requestAnimationFrame(
          () => {
            pendingHtmlPreviewFrameRef.current = null;

            const currentSelectedId =
              useSelectedIdStore.getState().selectedDataId;
            if (String(currentSelectedId ?? '') !== targetId) return;

            const latest = useTestDataStore.getState().editMap[targetId]?.data;
            if (!latest) return;

            batchBuildPreview(latest);
          },
        );
      },
      [batchBuildPreview],
    );
    const handleOpenPreviewWindow = useCallback(async () => {
      const result = await window.preview.openWindow();

      if (!result.ok) {
        console.warn('Preview window open failed', result.error);
        return;
      }

      setIsPreviewWindowOpen(true);
      closePanel(panel.preview);

      // 子ウィンドウ起動直後の表示を安定させるため、現在の内容をフル同期する
      fullBuildPreview();
    }, [closePanel, fullBuildPreview]);

    useEffect(() => {
      const onDetachRequest = () => {
        void handleOpenPreviewWindow();
      };

      window.addEventListener(PREVIEW_DETACH_EVENT, onDetachRequest);

      return () => {
        window.removeEventListener(PREVIEW_DETACH_EVENT, onDetachRequest);
      };
    }, [handleOpenPreviewWindow]);

    useEffect(() => {
      return () => {
        if (pendingHtmlPreviewFrameRef.current != null) {
          window.cancelAnimationFrame(pendingHtmlPreviewFrameRef.current);
          pendingHtmlPreviewFrameRef.current = null;
        }
      };
    }, []);

    // biome-ignore lint/correctness/useExhaustiveDependencies: selectedDataId 変化時に予約済みプレビュー更新を破棄するため
    useEffect(() => {
      if (pendingHtmlPreviewFrameRef.current == null) return;

      window.cancelAnimationFrame(pendingHtmlPreviewFrameRef.current);
      pendingHtmlPreviewFrameRef.current = null;
    }, [selectedDataId]);

    // エディタの更新処理
    const pickedUpdatingRawParts = useCallback(
      (options?: {
        resetHistory?: boolean;
        freshMap?: Record<string, EditDataEntry>;
        isForce?: boolean;
      }): { usedFresh: boolean } => {
        if (selectedDataId === undefined) return { usedFresh: false };

        const curIdStr = String(selectedDataId);
        const freshEntry = options?.freshMap?.[curIdStr]?.data;
        const usedFresh = !!freshEntry;

        const markAndMaybeFull = (_name: EditorKeyName) => {
          if (currentDisplayedIdRef.current === curIdStr) return;
          markEditorUpdated(_name, curIdStr);
          if (areAllEditorsUpdatedFor(curIdStr)) {
            currentDisplayedIdRef.current = curIdStr;

            if (!hasReportedInitialEditorsReadyRef.current) {
              hasReportedInitialEditorsReadyRef.current = true;
              onInitialEditorsReady?.();
            }

            fullBuildPreview(freshEntry ?? editMap[curIdStr]?.data);
            resumePreviewPatch();
          }
        };

        const sourceData = freshEntry ?? editMap[selectedDataId]?.data;
        if (!sourceData) return { usedFresh: false };
        const updater = buildEditorUpdater(sourceData);

        console.log('pickedUpdatingRawParts start', {
          selectedDataId,
          usedFresh,
          hasFreshEntry: !!freshEntry,
          hasEditEntry: !!editMap[selectedDataId],
          updaterLength: updater.length,
        });

        updater.forEach(([editorRef, quillValue], idx) => {
          const name = updaterNames[idx];
          const fieldKey = HTML_FIELDS[idx];

          // 未来値を優先
          let latestHtml = usedFresh
            ? (freshEntry?.[fieldKey] as string)
            : quillValue;

          if (!editorRef) return;
          const currentHtml = stripEmbeddedImagesFromHtml(
            editorRef.getHtml() || '',
          );
          if (options?.isForce || currentHtml !== latestHtml) {
            const { readyKeys, notReadyKeys, notRegisteredKeys } =
              checkRawImages(latestHtml);
            const requestKeys = Array.from(
              new Set([...notReadyKeys, ...notRegisteredKeys]),
            );

            // 初回表示時に未取得画像を待機対象へ積む
            if (
              usedFresh &&
              !hasReportedInitialEmbeddedImagesReadyRef.current
            ) {
              for (const key of requestKeys) {
                initialPendingImageKeysRef.current.add(key);
              }
            }
            requestingImageKeys.current = Array.from(
              new Set([...requestingImageKeys.current, ...requestKeys]),
            );

            const { modifiedHtml } = replaceImageTagsInRaw(
              latestHtml,
              readyKeys,
              selectedGrade,
            );

            // 未登録画像でも img タグは消さず、ダミー src のまま保持する
            latestHtml = modifiedHtml;

            if (!editorRef) {
              console.error('EditorRef is not mounted yet', fieldKey);
              // 状態更新のみで抜け、マウント後の初期化に任せる
              markAndMaybeFull(name);
              // 未準備画像があれば監視キューへ
              if (requestKeys.length > 0) requestAndWatchImageIds(requestKeys);
              return;
            }

            // ★ マウント済み: 従来通り setHtml（キャレット復元付き）, 必要時のみ履歴クリア
            updateHtml(editorRef, latestHtml, {
              resetHistory: !!options?.resetHistory,
            }).then((result) => {
              if (result) {
                markAndMaybeFull(name);
              } else {
                console.warn('Failed to update HTML for', fieldKey);
              }
            });

            if (requestKeys.length > 0) requestAndWatchImageIds(requestKeys);
          } else {
            markAndMaybeFull(name);
          }
        });
        if (usedFresh) {
          //          runAutoCheck(freshEntry);
          //          evaluateDirtyNext(freshEntry);
        } else {
          runAutoCheck();
        }

        // 初回表示で待機対象画像が無ければここで完了通知
        if (usedFresh && !hasReportedInitialEmbeddedImagesReadyRef.current) {
          if (initialPendingImageKeysRef.current.size === 0) {
            hasReportedInitialEmbeddedImagesReadyRef.current = true;
            onInitialEmbeddedImagesReady?.();
          } else {
            waitingInitialEmbeddedImagesRef.current = true;
          }
        }

        return { usedFresh };
      },
      [
        selectedDataId,
        selectedGrade,
        checkRawImages,
        replaceImageTagsInRaw,
        requestAndWatchImageIds,
        updateHtml,
        fullBuildPreview,
        markEditorUpdated,
        areAllEditorsUpdatedFor,
        runAutoCheck,
        //        evaluateDirtyNext,
        resumePreviewPatch,
        buildEditorUpdater,
        editMap,
        onInitialEditorsReady,
        onInitialEmbeddedImagesReady,
      ],
    );

    const resetCurrentDisplayedEditorState = useCallback(() => {
      currentDisplayedIdRef.current = null;
      editorUpdateMarksRef.current = createEmptyEditorUpdateMarks();
    }, []);

    const clearRemoteSyncTimers = useCallback(() => {
      if (remoteSyncQuietTimerRef.current !== null) {
        clearTimeout(remoteSyncQuietTimerRef.current);
        remoteSyncQuietTimerRef.current = null;
      }

      if (remoteSyncMaxTimerRef.current !== null) {
        clearTimeout(remoteSyncMaxTimerRef.current);
        remoteSyncMaxTimerRef.current = null;
      }
    }, []);

    const applyRemoteFreshEntries = useCallback(
      (targetIds: string[]) => {
        if (targetIds.length === 0) return;

        const fresh = mergeFromTestData({
          idList: targetIds,
          testDataMap,
        });

        initializeDirtyState(targetIds);
        rebuildEffectivePastExamDuplicateIndex(
          Object.fromEntries(
            Object.entries(fresh).map(([id, entry]) => [id, entry.data]),
          ),
        );

        if (!selectedDataId || !targetIds.includes(selectedDataId)) {
          return;
        }

        const current = fresh[selectedDataId]?.data;
        if (!current) return;

        lastSelectionRef.current = null;
        setActiveEditorKey(null);
        resetCurrentDisplayedEditorState();
        suspendPreviewPatch();
        pickedUpdatingRawParts({
          resetHistory: true,
          freshMap: fresh,
        });
        initializeCheck(selectedDataId, current);
      },
      [
        initializeCheck,
        initializeDirtyState,
        mergeFromTestData,
        pickedUpdatingRawParts,
        rebuildEffectivePastExamDuplicateIndex,
        resetCurrentDisplayedEditorState,
        selectedDataId,
        suspendPreviewPatch,
        testDataMap,
      ],
    );

    const flushPendingRemoteSync = useCallback(() => {
      clearRemoteSyncTimers();

      if (
        !initializedRef.current ||
        remoteDialogActiveRef.current ||
        saving !== null
      ) {
        remoteSyncStartedAtRef.current = null;
        return;
      }

      const targetIds = Array.from(pendingRemoteSyncIdsRef.current).filter(
        (id) => selectedDataIdList.includes(id),
      );

      pendingRemoteSyncIdsRef.current.clear();
      remoteSyncStartedAtRef.current = null;

      if (targetIds.length === 0) return;

      const targetNosLabel = formatRemoteSyncTargetNos(
        targetIds.map((id) => {
          const no = editMap[id]?.data?.no ?? testDataMap[id]?.raw?.no;
          return typeof no === 'number' ? no : null;
        }),
      );

      const dirtyTargetIds = targetIds.filter((id) => dirtyIdSet.has(id));
      if (dirtyTargetIds.length === 0) {
        applyRemoteFreshEntries(targetIds);
        remoteDialogActiveRef.current = true;
        setRemoteDialogTargetNos(targetNosLabel);
        setRemoteNoticeDialogOpen(true);
        return;
      }

      remoteConflictIdsRef.current = targetIds;
      remoteDialogActiveRef.current = true;
      setRemoteDialogTargetNos(targetNosLabel);
      setRemoteConflictDialogOpen(true);
    }, [
      applyRemoteFreshEntries,
      clearRemoteSyncTimers,
      dirtyIdSet,
      editMap,
      saving,
      selectedDataIdList,
      testDataMap,
    ]);

    const schedulePendingRemoteSync = useCallback(() => {
      if (pendingRemoteSyncIdsRef.current.size === 0) {
        clearRemoteSyncTimers();
        remoteSyncStartedAtRef.current = null;
        return;
      }

      if (remoteDialogActiveRef.current || saving !== null) {
        clearRemoteSyncTimers();
        remoteSyncStartedAtRef.current = null;
        return;
      }

      const startedAt = remoteSyncStartedAtRef.current ?? Date.now();
      remoteSyncStartedAtRef.current = startedAt;

      if (remoteSyncQuietTimerRef.current !== null) {
        clearTimeout(remoteSyncQuietTimerRef.current);
      }

      remoteSyncQuietTimerRef.current = window.setTimeout(() => {
        flushPendingRemoteSync();
      }, REMOTE_SYNC_QUIET_MS);

      if (remoteSyncMaxTimerRef.current === null) {
        const remainingMs = Math.max(
          0,
          REMOTE_SYNC_MAX_WAIT_MS - (Date.now() - startedAt),
        );

        remoteSyncMaxTimerRef.current = window.setTimeout(() => {
          flushPendingRemoteSync();
        }, remainingMs);
      }
    }, [clearRemoteSyncTimers, flushPendingRemoteSync, saving]);

    const enqueueRemoteSyncIds = useCallback(
      (ids: string[]) => {
        ids.forEach((id) => {
          pendingRemoteSyncIdsRef.current.add(id);
        });
        schedulePendingRemoteSync();
      },
      [schedulePendingRemoteSync],
    );

    const closeRemoteNoticeDialog = useCallback(() => {
      remoteDialogActiveRef.current = false;
      setRemoteNoticeDialogOpen(false);
      setRemoteDialogTargetNos('');

      if (pendingRemoteSyncIdsRef.current.size > 0) {
        schedulePendingRemoteSync();
      }
    }, [schedulePendingRemoteSync]);

    const handleRemoteConflictAccept = useCallback(() => {
      const targetIds = [...remoteConflictIdsRef.current];
      remoteConflictIdsRef.current = [];
      remoteDialogActiveRef.current = false;
      setRemoteConflictDialogOpen(false);
      setRemoteDialogTargetNos('');

      applyRemoteFreshEntries(targetIds);

      if (pendingRemoteSyncIdsRef.current.size > 0) {
        schedulePendingRemoteSync();
      }
    }, [applyRemoteFreshEntries, schedulePendingRemoteSync]);

    const handleRemoteConflictReject = useCallback(() => {
      const targetIds = [...remoteConflictIdsRef.current];
      remoteConflictIdsRef.current = [];
      remoteDialogActiveRef.current = false;
      setRemoteConflictDialogOpen(false);
      setRemoteDialogTargetNos('');

      const cleanTargetIds = targetIds.filter((id) => !dirtyIdSet.has(id));
      applyRemoteFreshEntries(cleanTargetIds);

      if (pendingRemoteSyncIdsRef.current.size > 0) {
        schedulePendingRemoteSync();
      }
    }, [applyRemoteFreshEntries, dirtyIdSet, schedulePendingRemoteSync]);

    useEffect(() => {
      if (!initializedRef.current) {
        previousCommittedTokensRef.current = committedSelectedTokens;
        return;
      }

      const previousTokens = previousCommittedTokensRef.current;
      previousCommittedTokensRef.current = committedSelectedTokens;

      const changedIds = selectedDataIdList.filter((id) => {
        const previousToken = previousTokens[id];
        const nextToken = committedSelectedTokens[id];

        return !!previousToken && !!nextToken && previousToken !== nextToken;
      });

      if (changedIds.length === 0) return;

      enqueueRemoteSyncIds(changedIds);
    }, [committedSelectedTokens, enqueueRemoteSyncIds, selectedDataIdList]);

    useEffect(() => {
      if (saving !== null) return;
      if (remoteDialogActiveRef.current) return;
      if (pendingRemoteSyncIdsRef.current.size === 0) return;

      schedulePendingRemoteSync();
    }, [saving, schedulePendingRemoteSync]);

    const handleEditorTypeChange = useCallback(
      (
        key: 'questionEditorType' | 'answerEditorType',
        nextValue:
          | TestData['questionEditorType']
          | TestData['answerEditorType'],
      ) => {
        if (!selectedDataId) return;

        const prev = editMap[selectedDataId]?.data;
        if (!prev) return;
        if (prev[key] === nextValue) return;

        const nextData = applyEditPatch(String(selectedDataId), {
          [key]: nextValue,
        });
        if (!nextData) return;

        runAutoCheck(nextData);
        evaluateDirtyNext(nextData);
        fullBuildPreview(nextData);
      },
      [
        selectedDataId,
        editMap,
        runAutoCheck,
        fullBuildPreview,
        evaluateDirtyNext,
        applyEditPatch,
      ],
    );
    const patchCategoryTagsIfChanged = useCallback(
      (patch: Pick<TestData, 'bigCategoryTag' | 'smallCategoryTag'>) => {
        if (!selectedDataId) return;

        const prev = editMap[selectedDataId]?.data;
        if (!prev) return;

        const nextPatch: Partial<
          Pick<TestData, 'bigCategoryTag' | 'smallCategoryTag'>
        > = {};

        if (
          String(prev.bigCategoryTag ?? '') !==
          String(patch.bigCategoryTag ?? '')
        ) {
          nextPatch.bigCategoryTag = patch.bigCategoryTag;
        }

        if (
          String(prev.smallCategoryTag ?? '') !==
          String(patch.smallCategoryTag ?? '')
        ) {
          nextPatch.smallCategoryTag = patch.smallCategoryTag;
        }

        if (Object.keys(nextPatch).length === 0) return;

        applyEditPatch(String(selectedDataId), nextPatch);

        const nextData = {
          ...prev,
          ...nextPatch,
        } as TestData;

        runAutoCheck(nextData);
        evaluateDirtyNext(nextData);
        batchBuildPreview(nextData);
      },
      [
        selectedDataId,
        editMap,
        applyEditPatch,
        runAutoCheck,
        evaluateDirtyNext,
        batchBuildPreview,
      ],
    );
    const patchEditIfChanged = useCallback(
      <K extends keyof TestData>(key: K, nextValue: TestData[K]) => {
        if (!selectedDataId) return;
        console.log('Patching edit if changed:', key, nextValue);
        const prev = editMap[selectedDataId]?.data;
        if (!prev) return;

        const prevValue = prev[key] as TestData[K];
        const isSame = (() => {
          // otherTags など（string[]想定）
          if (Array.isArray(prevValue) || Array.isArray(nextValue)) {
            const a = Array.isArray(prevValue) ? prevValue : [];
            const b = Array.isArray(nextValue) ? nextValue : [];
            const sa = JSON.stringify([...a].sort());
            const sb = JSON.stringify([...b].sort());
            return sa === sb;
          }

          // isOriginal など
          if (typeof nextValue === 'boolean') {
            return typeof prevValue === 'boolean' && prevValue === nextValue;
          }

          // grade/no など
          if (typeof nextValue === 'number') {
            return typeof prevValue === 'number' && prevValue === nextValue;
          }

          return String(prevValue ?? '') === String(nextValue ?? '');
        })();

        if (isSame) return;

        // ストアへ部分更新
        applyEditPatch(String(selectedDataId), { [key]: nextValue });

        // 次のデータを構築してローカル autoCheck 実行
        const nextData = { ...prev, [key]: nextValue } as TestData;
        if (PAST_EXAM_DUPLICATE_TARGET_KEYS.has(key)) {
          effectivePastExamDuplicateIndexRef.current =
            upsertPastExamDuplicateIndexEntry(
              effectivePastExamDuplicateIndexRef.current,
              buildDuplicateCheckEntry(String(selectedDataId), nextData),
            );
        }
        evaluateDirtyNext(nextData);
        runAutoCheck(nextData);

        // メタ変更をプレビューへ反映
        if (PATCH_PREVIEW_META_KEYS.has(key)) {
          batchBuildPreview(nextData);
        }
      },
      [
        evaluateDirtyNext,
        selectedDataId,
        editMap,
        applyEditPatch,
        runAutoCheck,
        batchBuildPreview,
        buildDuplicateCheckEntry,
      ],
    );

    const handleRevert = useCallback(() => {
      if (!selectedDataId) return;
      const fresh = mergeFromTestData({
        idList: [selectedDataId],
        testDataMap,
      });

      pickedUpdatingRawParts({ resetHistory: true, freshMap: fresh });

      const reverted = fresh[selectedDataId]?.data;
      if (reverted) {
        rebuildEffectivePastExamDuplicateIndex({
          [selectedDataId]: reverted,
        });
        initializeCheck(selectedDataId, reverted);
        markIdsClean([selectedDataId]);
      }
    }, [
      markIdsClean,
      mergeFromTestData,
      selectedDataId,
      testDataMap,
      pickedUpdatingRawParts,
      rebuildEffectivePastExamDuplicateIndex,
      initializeCheck,
    ]);

    const handleConfirmStop = useCallback(() => {
      setStopConfirmDialogOpen(false);

      if (!selectedDataId) return;
      const cur = editMap[selectedDataId]?.data;
      if (!cur) return;

      setStopped(true);
      if (cur.status !== '停止中') {
        const nextTestData = applyEditPatch(selectedDataId, {
          status: '停止中',
        });
        if (!nextTestData) return;
        evaluateDirtyNext(nextTestData);
      }
    }, [selectedDataId, editMap, applyEditPatch, evaluateDirtyNext]);

    const handleStopClick = useCallback(() => {
      // 停止解除時：ダイアログは表示しない
      if (stopped) {
        setStopped(false);
        setCalibrationLocked(false);
        if (!selectedDataId) return;
        const cur = editMap[selectedDataId]?.data;
        if (!cur) return;

        const nextStatus = deriveTestDataStatusAfterResume({
          autoCheckOk: cur.autoCheck === true,
          calibrationCheck: false,
        });

        if (cur.status !== nextStatus) {
          const nextTestData = applyEditPatch(selectedDataId, {
            calibrationCheck: false,
            status: nextStatus,
          });
          if (!nextTestData) return;
          evaluateDirtyNext(nextTestData);
        }
        return;
      }

      // 出題停止時：確認ダイアログ
      setStopConfirmDialogOpen(true);
    }, [stopped, selectedDataId, editMap, applyEditPatch, evaluateDirtyNext]);

    const handleEditorReady = useCallback((id: string) => {
      const name = editorIdToKeyName(id);
      // console.log('エディタ準備完了:', name);
      if (!name) return;
      setReadyKeySet((prev) => {
        if (prev.has(name)) return prev;
        const next = new Set(prev);
        next.add(name);
        return next;
      });
    }, []);

    const getNoById = useCallback(
      (id: string): number | null => {
        const n = editMap[id]?.data?.no ?? testDataMap[id]?.raw?.no;
        return typeof n === 'number' ? n : null;
      },
      [editMap, testDataMap],
    );

    const saveOneById = useCallback(
      async (id: string): Promise<boolean> => {
        if (!save) return false;
        const entry = editMap[id];
        if (!entry?.data) {
          // dirty対象に入っているのに data が無いのは想定外 → No不明として失敗扱い
          setSaveErrorNo(null);
          setSaveErrorOpen(true);
          return false;
        }

        // IDごとの自動チェック再計算（全件保存でも安全）
        const ac = autoCheck(entry.data, {
          duplicatePastExamIds: getPastExamDuplicateIds(
            effectivePastExamDuplicateIndexRef.current,
            buildDuplicateCheckEntry(id, entry.data),
          ),
        });
        const autoOk = ac.status === 'success';
        const calibration = entry.data.calibrationCheck === true;

        const nextStatus = deriveTestDataStatus({
          currentStatus: entry.data.status,
          autoCheckOk: autoOk,
          calibrationCheck: calibration,
        });

        applyEditPatch(id, {
          autoCheck: autoOk,
          calibrationCheck: calibration,
          status: nextStatus,
        });

        const patch = stripEmbeddedImagesFromTestData({
          ...entry.data,
          autoCheck: autoOk,
          calibrationCheck: calibration,
          status: nextStatus,
          isShuffleable: judgeIsShuffleable(entry.data),
          isConvertibleQaa: judgeIsConvertibleQaa(entry.data),
          isNegativeAnswer: judgeIsNegativeAnswer(entry.data),
        });

        const res = await save({ id, patch });
        if (!res.ok) {
          setSaveErrorNo(getNoById(id));
          setSaveErrorOpen(true);
          return false; // ★以後中止（usedIds同期もしない）
        }

        markIdsClean([id]);

        updateDisplayEntry(id, {
          name: buildTestDataDisplayName(patch),
          status: nextStatus,
        });

        // usedIdsの同期処理
        if (imageItems.length === 0) return true;

        // Firestoreに書き込まれるpatchから参照画像キーを収集
        const referencedKeys = new Set<string>();
        for (const fieldKey of HTML_FIELDS) {
          const html = patch[fieldKey] as string | undefined;
          console.log('patch[fieldKey]', patch, fieldKey, html);
          for (const key of extractImageIdsFromHtml(html)) {
            referencedKeys.add(key);
          }
        }
        if (!selectedGrade) return true;

        const usedIdKey = `${selectedGrade === 'firstGrade' ? '0' : '1'}_${id}`;

        // 差分があるアイテムのみ mutate
        const syncPromises = imageItems
          .filter((item) => {
            const isReferenced = referencedKeys.has(item.key);
            const isInUsedIds = (item.usedIds ?? []).includes(usedIdKey);
            return isReferenced !== isInUsedIds;
          })
          .map((item) => {
            const isReferenced = referencedKeys.has(item.key);
            const prevUsedIds = item.usedIds ?? [];
            const nextUsedIds = isReferenced
              ? [...prevUsedIds, usedIdKey]
              : prevUsedIds.filter((id) => id !== usedIdKey);
            return window.fs.mutate({
              mutationId: randomId(),
              kind: 'update',
              path: `storageList/${selectedGrade}/images/${item.key}`,
              data: { usedIds: nextUsedIds },
            });
          });

        const results = await Promise.allSettled(syncPromises);
        const failures = results.filter((r) => r.status === 'rejected');
        if (failures.length > 0) {
          console.error('usedIds の outbox 受付失敗:', failures);
        }

        return true;
      },
      [
        save,
        editMap,
        applyEditPatch,
        buildDuplicateCheckEntry,
        getNoById,
        imageItems,
        selectedGrade,
        updateDisplayEntry,
        markIdsClean,
      ],
    );
    const handleSaveClick = useCallback(async () => {
      if (!selectedDataId) return;
      if (saving !== null) return;
      setSaving('one');
      try {
        await saveOneById(String(selectedDataId));
      } finally {
        setSaving(null);
      }
    }, [selectedDataId, saveOneById, saving]);

    const handleSaveAllClick = useCallback(async (): Promise<boolean> => {
      if (saving !== null) return false;
      const ids = Array.from(dirtyIdSet);
      if (ids.length === 0) return true;

      setSaving('all');
      try {
        for (const id of ids) {
          const ok = await saveOneById(id);
          if (!ok) return false; // ★失敗したら以後中止
        }
        return true;
      } finally {
        setSaving(null);
      }
    }, [dirtyIdSet, saveOneById, saving]);

    const navigateToTestDataList = useCallback(async () => {
      if (isPanelOpen(panel.preview)) {
        closePanel(panel.preview);
      }

      const closePreviewWindowResult = await window.preview.closeWindow();
      if (!closePreviewWindowResult.ok) {
        console.warn(
          'Preview window close failed',
          closePreviewWindowResult.error,
        );
      }

      navigate('/testDataList');
    }, [closePanel, isPanelOpen, navigate]);

    const handleBackClick = useCallback(async () => {
      if (saving !== null) return;

      if (dirtyIdSet.size === 0) {
        await navigateToTestDataList();
        return;
      }

      setBackDialogOpen(true);
    }, [dirtyIdSet, navigateToTestDataList, saving]);

    // クリック時
    const handleOnClick = useCallback(
      (event: React.MouseEvent<HTMLButtonElement, globalThis.MouseEvent>) => {
        if (typeof selectedDataId === 'string') {
          const cur = editMap[selectedDataId]?.data;

          const nextStatus = cur
            ? deriveTestDataStatus({
                currentStatus: cur.status,
                autoCheckOk: autoCheckOk,
                calibrationCheck: calibrationLocked,
              })
            : undefined;

          // calibrationLockedとautoCheckOkの状態をeditMapに反映
          console.log(
            'Applying calibration and auto-check state before switching:',
            {
              selectedDataId: selectedDataId,
              calibrationCheck: calibrationLocked,
              autoCheck: autoCheckOk,
              status: nextStatus,
            },
          );
          applyEditPatch(selectedDataId, {
            calibrationCheck: calibrationLocked,
            autoCheck: autoCheckOk,
            ...(nextStatus ? { status: nextStatus } : {}),
          });
        }
        setSelectedDataId(event.currentTarget.id);
      },
      [
        selectedDataId,
        editMap,
        calibrationLocked,
        autoCheckOk,
        applyEditPatch,
        setSelectedDataId,
      ],
    );

    useEffect(() => {
      const off = window.preview.onWindowClosed(() => {
        setIsPreviewWindowOpen(false);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            fullBuildPreview();
          });
        });
      });

      return () => off();
    }, [fullBuildPreview]);

    const currentSubject = useMemo(() => {
      if (!selectedDataId) return undefined;
      const v = editMap[selectedDataId]?.data?.subject;
      return typeof v === 'string' ? v : undefined;
    }, [selectedDataId, editMap]);

    const currentAnswerEditorType = useMemo(() => {
      if (!selectedDataId) return 'normal';
      return editMap[selectedDataId]?.data?.answerEditorType ?? 'normal';
    }, [selectedDataId, editMap]);

    const getTopVisibleEditorNameByTab = useCallback(
      (tab: 'questionEditorTab' | 'answerEditorTab'): EditorKeyName => {
        if (tab === 'questionEditorTab') {
          return 'text';
        }

        // 解説本文なしのときは、表示上いちばん上は解答1
        if (currentAnswerEditorType === 'noHonbun') {
          return 'answerText1';
        }

        return 'answerText';
      },
      [currentAnswerEditorType],
    );

    const insertImageAltOnly = useCallback(
      (key: string) => {
        console.log(
          'Attempting to insert image with key:',
          key,
          calibrationLocked,
        );

        if (!selectedDataId) return;
        if (calibrationLocked) return;

        const lastSelection = lastSelectionRef.current;

        // 同じタブ内で最後にカーソルがあったエディタなら、その位置に挿入する
        const canReuseLastSelection =
          !!lastSelection && isEditorInTab(lastSelection.name, activeEditorTab);

        // どのエディタも未選択扱いなら、現在タブ先頭エディタの末尾へ入れる
        const targetName = canReuseLastSelection
          ? lastSelection.name
          : getTopVisibleEditorNameByTab(activeEditorTab);

        const handle = getEditorHandleByName(targetName);
        const quill = handle?.getQuill();
        if (!handle || !quill) return;

        quill.focus();

        // focus 後は Quill が savedRange（入力のたびに更新される実カーソル位置）を
        // 復元するため、「最後に触っていたエディタと同じ」ときに限り実カーソルを最優先で使う。
        // 未選択（別エディタへの誤挿入防止）ケースでは実カーソルを使わず末尾へ入れる（欠陥A）。
        const liveRange = canReuseLastSelection ? quill.getSelection() : null;

        const fallbackRange: Range = {
          index: Math.max(0, quill.getLength() - 1),
          length: 0,
        };

        const baseRange =
          liveRange ??
          (canReuseLastSelection ? lastSelection.range : fallbackRange);

        const insertIndex = baseRange.index;
        const selectionLength = baseRange.length ?? 0;

        // 文字選択中なら選択範囲を置き換える
        if (selectionLength > 0) {
          quill.deleteText(insertIndex, selectionLength, 'user');
        }

        // カーソル位置へ直接画像を挿入する
        quill.clipboard.dangerouslyPasteHTML(
          insertIndex,
          `<img src="${DUMMY_IMG}" alt="${key}" />`,
          'user',
        );

        // 挿入直後の位置へキャレットを戻して、そのエディタをアクティブに保つ
        const nextRange: Range = {
          index: insertIndex + 1,
          length: 0,
        };

        quill.setSelection(nextRange.index, nextRange.length, 'silent');
        lastSelectionRef.current = {
          name: targetName,
          range: nextRange,
        };
        setActiveEditorKey(targetName);
      },
      [
        selectedDataId,
        calibrationLocked,
        activeEditorTab,
        isEditorInTab,
        getEditorHandleByName,
        getTopVisibleEditorNameByTab,
      ],
    );

    useEffect(() => {
      const offInsertImage = window.editor.onInsertImage(
        (payload: EditorInsertPayload) => {
          if (calibrationLocked) return;

          try {
            insertImageAltOnly(payload.key);
            requestAndWatchImageIds([payload.key]);
          } catch (e) {
            console.error('failed to insert image', e);
          }
        },
      );

      return () => {
        offInsertImage();
      };
    }, [calibrationLocked, insertImageAltOnly, requestAndWatchImageIds]);

    // 「現在の bigCategoryTag」を editMap から取り出す
    const currentBigCategoryTag = useMemo(() => {
      if (!selectedDataId) return '';
      const v = editMap[selectedDataId]?.data?.bigCategoryTag;
      return typeof v === 'string' ? v : '';
    }, [selectedDataId, editMap]);

    // 外部フックを呼ぶ（QuestionEditorPanelに残るロジックはこれだけ）
    const categoryOptions = useCategoryTagOptions({
      grade: selectedGrade,
      subject: currentSubject || undefined,
      bigCategoryTag: currentBigCategoryTag,
    });
    const otherTagOptions = useOtherTagOptions({
      grade: selectedGrade,
    });
    const isImageAssetPanelOpen = isPanelOpen(panel.imageAsset);
    const isPreviewPanelOpen =
      isPanelOpen(panel.preview) || isPreviewWindowOpen;

    return (
      <div className="bg-background flex w-full h-full min-h-full ">
        <BasicDialog
          open={revertDialogOpen}
          onOpenChange={setRevertDialogOpen}
          title="編集内容を破棄しますか？"
          description="現在の編集内容は破棄され、直前に保存した状態に戻ります。"
          secondaryButtonText="キャンセル"
          primaryButtonText="破棄する"
          onClickPrimaryButton={handleRevert}
        />
        <BasicDialog
          open={remoteConflictDialogOpen}
          onOpenChange={(open) => {
            if (open) {
              setRemoteConflictDialogOpen(true);
              return;
            }

            handleRemoteConflictReject();
          }}
          title="他端末の変更を反映しますか？"
          description={`編集中のデータが他端末によって修正されました。対象: ${remoteDialogTargetNos}。現在の編集中データを破棄して他端末の変更を反映しますか？`}
          secondaryButtonText="いいえ"
          onClickSecondaryButton={handleRemoteConflictReject}
          primaryButtonText="はい"
          onClickPrimaryButton={handleRemoteConflictAccept}
        />
        <BasicDialog
          open={remoteNoticeDialogOpen}
          onOpenChange={(open) => {
            if (open) {
              setRemoteNoticeDialogOpen(true);
              return;
            }

            closeRemoteNoticeDialog();
          }}
          title="他端末による更新を反映しました"
          description={`編集中データが他端末によって変更されました。対象: ${remoteDialogTargetNos}`}
          primaryButtonText="OK"
          onClickPrimaryButton={closeRemoteNoticeDialog}
        />
        <ResizablePanelGroup
          orientation="horizontal"
          groupid="questionEditorPanelGroup"
        >
          <div className="bg-background w-52.5 shrink-0 border-r flex flex-col">
            <div className="flex items-center justify-between px-2 py-2 border-b">
              <Button
                variant="ghost"
                onClick={handleBackClick}
                className="pl-0"
              >
                <LeftArrowIcon fill="var(--color-demoblue)" />
                <div className="mb-0.5">戻る</div>
              </Button>
              <div className="flex">
                <button
                  type="button"
                  className="w-8 h-full"
                  disabled={isImageAssetPanelOpen}
                  onClick={() => addPanelWithPosition(panel.imageAsset)}
                >
                  <ImageIcon
                    title="画像アセットパネルを開く"
                    fill={
                      isImageAssetPanelOpen
                        ? 'var(--color-icon-hover)'
                        : 'var(--color-icon)'
                    }
                    hoverFill="var(--color-icon-hover)"
                    size={24}
                  />
                </button>
                <button
                  type="button"
                  className="w-8 h-full"
                  disabled={isPreviewPanelOpen}
                  onClick={() => addPanelWithPosition(panel.preview)}
                >
                  <PreviewIcon
                    title="プレビューパネルを開く"
                    fill={
                      isPreviewPanelOpen
                        ? 'var(--color-icon-hover)'
                        : 'var(--color-icon)'
                    }
                    size={24}
                  />
                </button>
              </div>
            </div>

            <BasicDialog
              open={stopConfirmDialogOpen}
              onOpenChange={setStopConfirmDialogOpen}
              title="出題停止しますか？"
              description="問題集や模擬試験の作成時に、この問題は選出から外れます。停止してよろしいでしょうか？"
              secondaryButtonText="いいえ"
              primaryButtonText="はい"
              onClickPrimaryButton={handleConfirmStop}
            />
            <BasicDialog
              open={saveErrorOpen}
              onOpenChange={setSaveErrorOpen}
              title="保存に失敗しました"
              description={`失敗した問題No: ${saveErrorNo ?? '不明'}`}
              primaryButtonText="OK"
              onClickPrimaryButton={() => setSaveErrorOpen(false)}
            />
            <BasicDialog
              open={backDialogOpen}
              onOpenChange={setBackDialogOpen}
              description="変更を保存していないデータがあります。問題リストに戻りますか？"
              tertiaryButtonText="キャンセル"
              onClickTertiaryButton={() => setBackDialogOpen(false)}
              secondaryButtonText="変更を破棄して戻る"
              onClickSecondaryButton={() => {
                void navigateToTestDataList();
              }}
              primaryButtonText="変更を保存して戻る"
              onClickPrimaryButton={async () => {
                const ok = await handleSaveAllClick();
                if (ok) await navigateToTestDataList();
              }}
            />

            <div className="text-primary text-sm px-3 py-5 pb-2">
              編集リスト
            </div>
            <div className="h-full overflow-y-scroll">
              <DataList
                idList={selectedDataIdList}
                selectedId={selectedDataId}
                dirtyIdSet={dirtyIdSet}
                onClick={handleOnClick}
              />
            </div>
            <div className="flex items-center justify-end p-4 border-t">
              <Button
                variant="primary"
                disabled={dirtyIdSet.size === 0 || saving !== null}
                onClick={handleSaveAllClick}
                className="w-full"
              >
                すべて保存
              </Button>
            </div>
          </div>

          <ResizableHandle className="bg-secondary" />
          <ResizablePanel defaultSize={70}>
            <div
              ref={panelBodyRef}
              data-editor-bounds
              className="bg-secondary relative w-full  h-full overflow-y-scroll flex flex-col gap-6 min-w-96"
            >
              <StatusBar
                autoCheckMessage={autoCheckMessage}
                autoCheckHasError={autoCheckHasError}
                autoCheckDetails={autoCheckDetailMessages}
                status={testStatus}
                calibrationLocked={calibrationLocked}
                onChangeCalibrationLocked={(checked) => {
                  setCalibrationLocked(checked);

                  // ローカル一時セーブに calibrationCheck/status を同期
                  if (!selectedDataId) return;
                  const cur = editMap[selectedDataId]?.data;
                  if (!cur) return;

                  const nextStatus = deriveTestDataStatus({
                    currentStatus: cur.status,
                    autoCheckOk: autoCheckOk,
                    calibrationCheck: checked,
                  });

                  if (
                    cur.calibrationCheck !== checked ||
                    cur.status !== nextStatus
                  ) {
                    const nextTestData = applyEditPatch(selectedDataId, {
                      calibrationCheck: checked,
                      status: nextStatus,
                    });
                    if (!nextTestData) return;
                    evaluateDirtyNext(nextTestData);
                  }
                }}
                onSave={handleSaveClick}
                saveDisabled={isCurrentDirty === false || !selectedDataId}
                onStop={handleStopClick}
                stopped={stopped}
                revertDisabled={isCurrentDirty === false || !selectedDataId}
                onRevert={() => setRevertDialogOpen(true)}
                isShuffleableBadge={judgeDetail?.shuffleable}
                isConvertibleQaaBadge={judgeDetail?.convertibleQaa}
                answerFormBadge={answerFormBadge}
              />

              <div className="px-4 gap-4 flex flex-col">
                <BasicInfoAccordion
                  onPatchEdit={patchEditIfChanged}
                  disabled={calibrationLocked}
                  invalidMetaKeys={invalidMetaKeySet}
                />
                <DetailInfoAccordion
                  onPatchEdit={patchEditIfChanged}
                  onPatchCategoryTags={patchCategoryTagsIfChanged}
                  disabled={calibrationLocked}
                  invalidMetaKeys={invalidMetaKeySet}
                  subject={currentSubject}
                  bigOptions={categoryOptions.bigOptions}
                  smallOptions={categoryOptions.smallOptions}
                  otherTagOptions={otherTagOptions.options}
                  onCreateBigOption={categoryOptions.addLocalBigOption}
                  onCreateSmallOption={categoryOptions.addLocalSmallOption}
                  onCreateOtherTagOption={otherTagOptions.addLocalOption}
                />
              </div>
              <BasicTabs
                keepMounted
                value={activeEditorTab}
                onValueChange={(value) => {
                  if (
                    value !== 'questionEditorTab' &&
                    value !== 'answerEditorTab'
                  )
                    return;

                  setActiveEditorTab(value);
                  lastSelectionRef.current = null;
                  setActiveEditorKey(null);
                }}
                tabs={[
                  {
                    id: 'questionEditorTab',
                    label: '問題',
                    content: (
                      <QuestionEditor
                        questionRef={questionRef}
                        choiceRefs={questionChoiceRefs}
                        oldRef={oldRef}
                        isSecondGrade={selectedGrade === 'secondGrade'}
                        readonly={calibrationLocked}
                        disabled={calibrationLocked}
                        invalidEditorKeys={invalidEditorKeySet}
                        invalidEditorType={invalidEditorTypeSet.has(
                          'questionEditorType',
                        )}
                        activeEditorKey={activeEditorKey}
                        onEditorTypeChange={(nextType) => {
                          handleEditorTypeChange(
                            'questionEditorType',
                            nextType,
                          );
                        }}
                        onSelectionChange={handleEditorSelectionChange}
                        onTextChange={(_delta, id) => {
                          if (!selectedDataId) return;

                          const patch = getQuestionFieldPatchFromId(id);
                          if (!patch) return;

                          const prev =
                            useTestDataStore.getState().editMap[
                              String(selectedDataId)
                            ]?.data;
                          if (!prev) return;

                          const nextEntry = applyQuillHtml(
                            String(selectedDataId),
                            {
                              [patch.key]: patch.html,
                            },
                          );
                          if (!nextEntry) return;

                          const next = nextEntry.data;

                          // undo/redo で DUMMY に戻った img を ready アセットへ再差し替え（注意3）
                          scheduleReRealizeDummyImages();

                          scheduleLatestPreviewBuild(String(selectedDataId));
                          evaluateDirtyNext(next);

                          setJudgeDetail({
                            shuffleable: judgeIsShuffleableWithReason(next),
                            convertibleQaa:
                              judgeIsConvertibleQaaWithReason(next),
                            negativeAnswer: judgeIsNegativeAnswerWithWord(next),
                          });
                          if (
                            shouldRunAutoCheck({
                              reason: 'htmlChange',
                              prev,
                              next,
                              changedKey: patch.key,
                            })
                          ) {
                            runAutoCheck(next, selectedDataId);
                          }
                        }}
                        onEditorReady={handleEditorReady}
                      />
                    ),
                  },
                  {
                    id: 'answerEditorTab',
                    label: '解説',
                    content: (
                      <AnswerEditor
                        answerRef={answerRef}
                        answerChoiceRefs={answerChoiceRefs}
                        answerOldRef={answerOldRef}
                        isSecondGrade={selectedGrade === 'secondGrade'}
                        readonly={calibrationLocked}
                        disabled={calibrationLocked}
                        invalidEditorKeys={invalidEditorKeySet}
                        invalidEditorType={invalidEditorTypeSet.has(
                          'answerEditorType',
                        )}
                        onEditorTypeChange={(nextType) => {
                          handleEditorTypeChange('answerEditorType', nextType);
                        }}
                        onSelectionChange={handleEditorSelectionChange}
                        activeEditorKey={activeEditorKey}
                        onTextChange={(_delta, id) => {
                          if (!selectedDataId) return;

                          const patch = getAnswerFieldPatchFromId(id);
                          if (!patch) return;

                          const prev =
                            useTestDataStore.getState().editMap[
                              String(selectedDataId)
                            ]?.data;
                          if (!prev) return;

                          const nextEntry = applyQuillHtml(
                            String(selectedDataId),
                            {
                              [patch.key]: patch.html,
                            },
                          );
                          if (!nextEntry) return;

                          const next = nextEntry.data;

                          // undo/redo で DUMMY に戻った img を ready アセットへ再差し替え（注意3）
                          scheduleReRealizeDummyImages();

                          scheduleLatestPreviewBuild(String(selectedDataId));
                          evaluateDirtyNext(next);

                          setJudgeDetail({
                            shuffleable: judgeIsShuffleableWithReason(next),
                            convertibleQaa:
                              judgeIsConvertibleQaaWithReason(next),
                            negativeAnswer: judgeIsNegativeAnswerWithWord(next),
                          });

                          if (
                            shouldRunAutoCheck({
                              reason: 'htmlChange',
                              prev,
                              next,
                              changedKey: patch.key,
                            })
                          ) {
                            runAutoCheck(next, selectedDataId);
                          }
                        }}
                        onEditorReady={handleEditorReady}
                      />
                    ),
                  },
                ]}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    );
  },
);

export default QuestionEditorPanel;
