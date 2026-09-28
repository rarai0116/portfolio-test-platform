import {
  getPreviewImagesMap,
  patchPreviewImages,
  sendPreviewFull,
  sendPreviewPatch,
} from '@api/previewBridge';
import { buildPreviewCoreData } from '@api/previewItemBuilder';
import type { TestData } from '@shared/types/contracts';
import type {
  PreviewChangedFields,
  PreviewFullPayload,
  PreviewPatchPayload,
} from '@shared/types/preview';
import { useCallback, useEffect, useRef } from 'react';

export type PreviewHtmlSnapshot = {
  text: string;
  questionChoices: string[];
  answerText: string;
  answerChoices: string[];
};

type PreviewDispatchOptions = {
  forceFlush?: boolean;
};

type ResumePreviewPatchOptions = PreviewDispatchOptions & {
  source?: TestData;
  dispatchFull?: boolean;
};

type SuspendPreviewPatchOptions = {
  clearPendingPatch?: boolean;
};

type UsePreviewDispatcherParams = {
  selectedDataId?: string;
  getCurrentPreviewSource: () => TestData | undefined;
};

const areStringArraysEqual = (left: string[] = [], right: string[] = []) => {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
};

const areOptionalStringArraysEqual = (
  left?: string[],
  right?: string[],
): boolean => {
  return areStringArraysEqual(left ?? [], right ?? []);
};

const areOptionsEqual = (
  left: PreviewFullPayload['options'],
  right: PreviewFullPayload['options'],
): boolean => {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
};

const buildPreviewFullPayload = (
  source: TestData,
  selectedDataId: string,
): PreviewFullPayload => {
  const core = buildPreviewCoreData(source, String(selectedDataId));
  return {
    ...core,
    type: 'full',
    images: getPreviewImagesMap(),
    options: {
      mode: 'both',
      hasCover: false,
      questionCount: 1,
      meta: {
        title: '',
        subject: source.subject,
        grade: String(source.grade ?? ''),
      },
      page: { size: 'A4', pxPerMm: 0.2645, baseHeightMm: 235 },
      questionEditorType: source.questionEditorType ?? 'normal',
      answerEditorType: source.answerEditorType ?? 'normal',
      hasSubCategoryHeading: false,
      hasNoNengoAndYear: source.isOriginal,
      hasNoDifficult: false,
      isOriginal: source.isOriginal ?? false,
    },
  };
};

const buildPreviewPatchPayload = (
  prev: PreviewFullPayload,
  next: PreviewFullPayload,
): PreviewPatchPayload | null => {
  const changed: PreviewChangedFields = {};
  const patch: PreviewPatchPayload = {
    type: 'patch',
    id: next.id,
    changed,
  };

  const question: NonNullable<PreviewPatchPayload['question']> = {};
  const answer: NonNullable<PreviewPatchPayload['answer']> = {};

  let hasPatch = false;

  const mark = (key: keyof PreviewChangedFields) => {
    changed[key] = true;
    hasPatch = true;
  };

  if (prev.subject !== next.subject) {
    patch.subject = next.subject;
    mark('subject');
  }
  if (prev.bigCategoryTag !== next.bigCategoryTag) {
    patch.bigCategoryTag = next.bigCategoryTag;
    mark('bigCategoryTag');
  }
  if (prev.smallCategoryTag !== next.smallCategoryTag) {
    patch.smallCategoryTag = next.smallCategoryTag;
    mark('smallCategoryTag');
  }
  if (prev.nengo !== next.nengo) {
    patch.nengo = next.nengo;
    mark('nengo');
  }
  if (prev.year !== next.year) {
    patch.year = next.year;
    mark('year');
  }
  if (prev.testNo !== next.testNo) {
    patch.testNo = next.testNo;
    mark('testNo');
  }
  if (prev.difficult !== next.difficult) {
    patch.difficult = next.difficult;
    mark('difficult');
  }

  if (prev.question.textHtml !== next.question.textHtml) {
    question.textHtml = next.question.textHtml;
    mark('questionTextHtml');
  }
  if (!areStringArraysEqual(prev.question.choices, next.question.choices)) {
    question.choices = next.question.choices;
    mark('questionChoices');
  }

  if (prev.answer.textHtml !== next.answer.textHtml) {
    answer.textHtml = next.answer.textHtml;
    mark('answerTextHtml');
  }
  if (!areStringArraysEqual(prev.answer.choices, next.answer.choices)) {
    answer.choices = next.answer.choices;
    mark('answerChoices');
  }
  if (!!prev.answer.answerBool !== !!next.answer.answerBool) {
    answer.answerBool = next.answer.answerBool;
    mark('answerBool');
  }
  if (prev.answer.answerNo !== next.answer.answerNo) {
    answer.answerNo = next.answer.answerNo;
    mark('answerNo');
  }

  if (prev.questionEditorType !== next.questionEditorType) {
    patch.questionEditorType = next.questionEditorType;
    mark('questionEditorType');
  }
  if (prev.answerEditorType !== next.answerEditorType) {
    patch.answerEditorType = next.answerEditorType;
    mark('answerEditorType');
  }
  if (prev.publicationYear !== next.publicationYear) {
    patch.publicationYear = next.publicationYear;
    mark('publicationYear');
  }
  if (prev.publicationNo !== next.publicationNo) {
    patch.publicationNo = next.publicationNo;
    mark('publicationNo');
  }
  if (!areOptionalStringArraysEqual(prev.otherTags, next.otherTags)) {
    patch.otherTags = next.otherTags;
    mark('otherTags');
  }
  if (!areOptionsEqual(prev.options, next.options)) {
    patch.options = next.options;
    mark('options');
  }

  if (Object.keys(question).length > 0) {
    patch.question = question;
  }
  if (Object.keys(answer).length > 0) {
    patch.answer = answer;
  }

  return hasPatch ? patch : null;
};

export const usePreviewDispatcher = ({
  selectedDataId,
  getCurrentPreviewSource,
}: UsePreviewDispatcherParams) => {
  const frameIdRef = useRef<number | null>(null);
  const pendingFullRef = useRef<PreviewFullPayload | null>(null);
  const pendingPatchRef = useRef<PreviewPatchPayload | null>(null);
  const lastCommittedFullRef = useRef<PreviewFullPayload | null>(null);
  const nextCommittedFullRef = useRef<PreviewFullPayload | null>(null);
  const isPatchSuspendedRef = useRef(false);

  const cancelScheduledFlush = useCallback(() => {
    if (frameIdRef.current == null) return;
    window.cancelAnimationFrame(frameIdRef.current);
    frameIdRef.current = null;
  }, []);

  const flushPreview = useCallback(() => {
    cancelScheduledFlush();

    if (pendingFullRef.current) {
      const nextFull = pendingFullRef.current;
      pendingFullRef.current = null;
      pendingPatchRef.current = null;
      nextCommittedFullRef.current = nextFull;
      lastCommittedFullRef.current = nextFull;
      sendPreviewFull(nextFull);
      return;
    }

    if (isPatchSuspendedRef.current) {
      return;
    }

    if (pendingPatchRef.current) {
      const nextPatch = pendingPatchRef.current;
      pendingPatchRef.current = null;
      sendPreviewPatch(nextPatch);

      if (nextCommittedFullRef.current) {
        lastCommittedFullRef.current = nextCommittedFullRef.current;
      }
    }
  }, [cancelScheduledFlush]);

  const scheduleFlush = useCallback(() => {
    if (frameIdRef.current != null) return;

    frameIdRef.current = window.requestAnimationFrame(() => {
      frameIdRef.current = null;
      flushPreview();
    });
  }, [flushPreview]);

  const buildFullPayload = useCallback(
    (source?: TestData): PreviewFullPayload | undefined => {
      const resolvedSource = source ?? getCurrentPreviewSource();
      if (!selectedDataId || !resolvedSource) return undefined;

      return buildPreviewFullPayload(resolvedSource, String(selectedDataId));
    },
    [getCurrentPreviewSource, selectedDataId],
  );

  const fullBuildPreview = useCallback(
    (source?: TestData, options?: PreviewDispatchOptions): boolean => {
      const nextFull = buildFullPayload(source);
      if (!nextFull) return false;

      pendingFullRef.current = nextFull;
      pendingPatchRef.current = null;
      nextCommittedFullRef.current = nextFull;

      if (options?.forceFlush) {
        flushPreview();
      } else {
        scheduleFlush();
      }

      return true;
    },
    [buildFullPayload, flushPreview, scheduleFlush],
  );

  const batchBuildPreview = useCallback(
    (source?: TestData, options?: PreviewDispatchOptions): boolean => {
      const nextFull = buildFullPayload(source);
      if (!nextFull) return false;

      nextCommittedFullRef.current = nextFull;

      if (pendingFullRef.current) {
        pendingFullRef.current = nextFull;

        if (options?.forceFlush) {
          flushPreview();
        } else {
          scheduleFlush();
        }
        return true;
      }

      const committed = lastCommittedFullRef.current;
      if (!committed || String(committed.id) !== String(nextFull.id)) {
        pendingFullRef.current = nextFull;
        pendingPatchRef.current = null;

        if (options?.forceFlush) {
          flushPreview();
        } else {
          scheduleFlush();
        }
        return true;
      }

      const nextPatch = buildPreviewPatchPayload(committed, nextFull);
      if (!nextPatch) {
        return false;
      }

      pendingPatchRef.current = nextPatch;

      if (isPatchSuspendedRef.current) {
        return true;
      }

      if (options?.forceFlush) {
        flushPreview();
      } else {
        scheduleFlush();
      }

      return true;
    },
    [buildFullPayload, flushPreview, scheduleFlush],
  );

  const suspendPreviewPatch = useCallback(
    (options?: SuspendPreviewPatchOptions) => {
      isPatchSuspendedRef.current = true;

      if (options?.clearPendingPatch !== false) {
        pendingPatchRef.current = null;
      }
    },
    [],
  );

  const resumePreviewPatch = useCallback(
    (options?: ResumePreviewPatchOptions) => {
      isPatchSuspendedRef.current = false;

      if (options?.dispatchFull) {
        pendingPatchRef.current = null;
        fullBuildPreview(options.source, {
          forceFlush: options.forceFlush,
        });
        return;
      }

      if (options?.forceFlush) {
        flushPreview();
      } else {
        scheduleFlush();
      }
    },
    [flushPreview, fullBuildPreview, scheduleFlush],
  );

  const clearPendingPreview = useCallback(() => {
    cancelScheduledFlush();
    pendingFullRef.current = null;
    pendingPatchRef.current = null;
    nextCommittedFullRef.current = null;
  }, [cancelScheduledFlush]);

  const dispatchPreviewImagePatch = useCallback(
    async (id?: string) => {
      const targetId = String(id ?? selectedDataId ?? '');
      if (!targetId) return;
      await patchPreviewImages(targetId);
    },
    [selectedDataId],
  );

  const getLastCommittedPreview = useCallback(() => {
    return lastCommittedFullRef.current;
  }, []);

  useEffect(() => {
    return () => {
      cancelScheduledFlush();
    };
  }, [cancelScheduledFlush]);

  return {
    fullBuildPreview,
    batchBuildPreview,
    flushPreview,
    suspendPreviewPatch,
    resumePreviewPatch,
    clearPendingPreview,
    dispatchPreviewImagePatch,
    getLastCommittedPreview,
  };
};
