import { commitCreatePdfPreviewDocument } from '@renderer/api/pdfPreviewBridge';
import type {
  CreatePdfPersistedDocument,
  CreatePdfPersistScope,
  CreatePdfPreviewCacheMeta,
  CreatePdfPreviewSnapshot,
} from '@shared/types/pdfPreview';
import { buildSlotKey } from '@shared/types/pdfPreview';
import { buildCreatePdfPreviewSnapshot } from '@views/createPdf/api/buildCreatePdfPreviewSnapshot';
import {
  buildExamConditionJson,
  buildWorkbookConditionJson,
} from '@views/createPdf/api/conditionJsonConverter';
import useCreatePdfImageAsset from '@views/createPdf/hooks/useCreatePdfImageAsset';
import useCreatePdfResourceStore from '@views/createPdf/store/useCreatePdfResourceStore';
import useCreatePdfViewStore from '@views/createPdf/store/useCreatePdfViewStore';
import useExamDraftStore from '@views/createPdf/store/useExamDraftStore';
import useTestTableStore from '@views/createPdf/store/useTestTableStore';
import useWorkbookDraftStore from '@views/createPdf/store/useWorkbookDraftStore';
import { useCallback, useState } from 'react';

type CommitResult =
  | { ok: true; meta: CreatePdfPreviewCacheMeta }
  | { ok: false; error: string };

/**
 * createPdf View の現在 state からローカル保存文書を構成し commit するフック。
 * TestData と画像メタを購読し、snapshot builder へ渡す。
 * 保存文書の構成責務はここに閉じ、previewPanel や mainPanel には置かない。
 */
const useCreatePdfPreviewCommit = () => {
  const [lastMeta, setLastMeta] = useState<CreatePdfPreviewCacheMeta | null>(
    null,
  );
  const [isCommitting, setIsCommitting] = useState(false);

  const creationType = useCreatePdfViewStore((s) => s.creationType);
  const gradeFromExamDraft = useExamDraftStore((s) => s.basic.grade);
  const gradeFromWorkbookDraft = useWorkbookDraftStore((s) => s.basic.grade);
  const grade =
    creationType === 'exam' ? gradeFromExamDraft : gradeFromWorkbookDraft;
  const isLoadingTestData = useCreatePdfResourceStore(
    (s) => s.testData.isLoading,
  );
  const {
    imageItems,
    isLoadingImageMeta = false,
    imageMetaSignature = '',
  } = useCreatePdfImageAsset(grade);

  const commit = useCallback(async (): Promise<CommitResult> => {
    setIsCommitting(true);
    try {
      const { creationType } = useCreatePdfViewStore.getState();
      // commit 内で getState() で取得することで、testDataByNo をクロージャ依存から除外し commit を安定させる
      const testDataByNo =
        useCreatePdfResourceStore.getState().testData.maps.byNo;
      let scope: CreatePdfPersistScope;
      let restoreState: ReturnType<
        typeof buildWorkbookConditionJson | typeof buildExamConditionJson
      >;

      if (creationType === 'workbook') {
        const workbookDraft = useWorkbookDraftStore.getState();
        const testTableState = useTestTableStore.getState();
        const currentGrade = workbookDraft.basic.grade;
        scope = {
          grade: currentGrade,
          workbookMode: workbookDraft.stepTwo.workbookMode,
        };
        restoreState = buildWorkbookConditionJson(
          workbookDraft,
          testTableState,
          testDataByNo,
        );
      } else {
        // exam は新ドラフトストアを正本とする
        const examDraft = useExamDraftStore.getState();
        const testTableState = useTestTableStore.getState();
        scope = { grade: examDraft.basic.grade, workbookMode: null };
        restoreState = buildExamConditionJson(
          examDraft,
          testTableState,
          testDataByNo,
        );
      }

      const slotKey = buildSlotKey(scope);
      const now = new Date().toISOString();

      let previewSnapshot: CreatePdfPreviewSnapshot;
      if (creationType === 'workbook') {
        console.log('[createPdf:preview] building snapshot for workbook', {
          testDataByNo,
        });
        const workbookDraft = useWorkbookDraftStore.getState();
        const testTableState = useTestTableStore.getState();
        const result = buildCreatePdfPreviewSnapshot({
          grade: workbookDraft.basic.grade,
          title: workbookDraft.basic.title,
          creationType,
          workbookMode: workbookDraft.stepTwo.workbookMode,
          tableRows: testTableState.sections[0]?.rows ?? [],
          testDataByNo,
          imageItems,
          generatedAt: now,
          isShuffleChoices: workbookDraft.stepTwo.options.isShuffleChoices,
          shuffleSeed: workbookDraft.stepTwo.options.shuffleSeed,
        });
        previewSnapshot = result.snapshot;
        if (result.warnings.length > 0) {
          console.warn(
            '[createPdf:preview] snapshot warnings',
            result.warnings,
          );
        }
      } else {
        const examDraft = useExamDraftStore.getState();
        const testTableState = useTestTableStore.getState();
        const result = buildCreatePdfPreviewSnapshot({
          grade: examDraft.basic.grade,
          title: examDraft.basic.title,
          creationType,
          tableSections: testTableState.sections,
          testDataByNo,
          imageItems,
          generatedAt: now,
          isShuffleChoices: examDraft.stepTwo.options.isShuffleChoices,
          shuffleSeed: examDraft.stepTwo.options.shuffleSeed,
          examDate: examDraft.stepThree.examDate,
        });
        previewSnapshot = result.snapshot;
      }

      console.log('[createPdf:preview] snapshot built', {
        creationType,
        grade,
        testDataCount: testDataByNo.size,
        imageMetaCount: imageItems.length,
        itemCount: previewSnapshot.items.length,
        imageRefCount: previewSnapshot.imageRefs.length,
      });

      const document: CreatePdfPersistedDocument = {
        schemaVersion: 1,
        creationType,
        // revision は main 側で採番するため、ここでは 0 を仮置きする
        revision: 0,
        updatedAt: now,
        slots: {
          [slotKey]: {
            scope,
            restoreState,
            previewSnapshot,
            updatedAt: now,
          },
        },
      };

      const result = await commitCreatePdfPreviewDocument({
        creationType,
        slotKey,
        document,
      });

      if (result.ok) {
        setLastMeta(result.meta);
        console.log('[createPdf:preview] commit success', {
          result,
          creationType,
          slotKey,
          revision: result.meta.revision,
          updatedAt: result.meta.updatedAt,
        });
      } else {
        console.error('[createPdf:preview] commit failed', {
          creationType,
          slotKey,
          error: result.error,
        });
      }
      return result;
    } finally {
      setIsCommitting(false);
    }
  }, [grade, imageItems]);

  return {
    commit,
    lastMeta,
    isCommitting,
    isLoadingTestData,
    isLoadingImageMeta,
    imageMetaSignature,
  };
};

export default useCreatePdfPreviewCommit;
