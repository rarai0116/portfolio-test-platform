import {
  buildExamAnswerPdfFileName,
  buildExamQuestionPdfFileName,
  normalizeExamPdfTitle,
  normalizeExamSubject,
} from '@api/buildExamPdfFileNames';
import {
  buildWorkbookPdfFileName,
  normalizeWorkbookPdfTitle,
} from '@api/buildWorkbookPdfFileName';
import type { TestSubject } from '@shared/types/contracts';
import type {
  CreatePdfExportManifestOptions,
  CreatePdfExportManifestResult,
  CreatePdfExportPagesRange,
  CreatePdfExportUnit,
} from '@shared/types/createPdfExport';
import type { CreatePdfPreviewSnapshot } from '@shared/types/pdfPreview';

const RENDERED_PAGE_SELECTOR = 'section.print-page, section.print-firstpage';

type RenderedExamGroup = {
  groupId: string;
  kind: 'question' | 'answer';
  pages: number[];
  subjects: TestSubject[];
  subjectSet: Set<TestSubject>;
};

type RenderedPage = {
  pageNumber: number;
  element: HTMLElement;
  containerId: string;
};

const collectRenderedPagesInOrder = (
  root: Document,
  containerIds: readonly string[],
): RenderedPage[] => {
  const pages: RenderedPage[] = [];

  for (const containerId of containerIds) {
    const container = root.getElementById(containerId);
    if (!(container instanceof HTMLElement)) {
      continue;
    }

    const elements = Array.from(
      container.querySelectorAll(RENDERED_PAGE_SELECTOR),
    ) as HTMLElement[];

    for (const element of elements) {
      pages.push({
        pageNumber: pages.length + 1,
        element,
        containerId,
      });
    }
  }

  return pages;
};

const toPagesRanges = (
  pageNumbers: readonly number[],
): CreatePdfExportPagesRange[] => {
  const sorted = [...new Set(pageNumbers)].sort((a, b) => a - b);
  const ranges: CreatePdfExportPagesRange[] = [];

  for (const pageNumber of sorted) {
    const last = ranges.at(-1);
    if (last && last.end + 1 === pageNumber) {
      last.end = pageNumber;
      continue;
    }

    ranges.push({ start: pageNumber, end: pageNumber });
  }

  return ranges;
};

const toRangeFields = (
  pages: readonly number[],
  preferRangesArray: boolean,
):
  | { pagesRange: CreatePdfExportPagesRange; pagesRanges?: never }
  | { pagesRange?: never; pagesRanges: CreatePdfExportPagesRange[] } => {
  const pagesRanges = toPagesRanges(pages);
  if (!preferRangesArray && pagesRanges.length === 1) {
    return { pagesRange: pagesRanges[0] };
  }

  return { pagesRanges };
};

const buildExamExportUnits = (
  root: Document,
  grade: 1 | 2,
  options: Required<CreatePdfExportManifestOptions>,
): CreatePdfExportManifestResult | CreatePdfExportUnit[] => {
  const orderedPages = collectRenderedPagesInOrder(root, [
    'question-container',
    'answer-container',
  ]);
  const groups = new Map<string, RenderedExamGroup>();

  for (const page of orderedPages) {
    const groupId = page.element.dataset.previewGroupId;
    const kind = page.element.dataset.previewGroupKind;
    if (!groupId || (kind !== 'question' && kind !== 'answer')) {
      return {
        ok: false,
        error:
          'PreviewWindow の exam ページに export 用の group 情報がありません。',
      };
    }

    const coverRole = page.element.dataset.previewCoverRole;
    if (
      (!options.includeCover &&
        (coverRole === 'cover' || coverRole === 'blank')) ||
      (!options.includeMiddleCover && coverRole === 'middle')
    ) {
      continue;
    }

    const pageNumber = page.pageNumber;
    const existing = groups.get(groupId);
    const normalizedSubject = normalizeExamSubject(
      page.element.dataset.previewSubject,
    );

    if (!existing) {
      const nextGroup: RenderedExamGroup = {
        groupId,
        kind,
        pages: [pageNumber],
        subjects: normalizedSubject ? [normalizedSubject] : [],
        subjectSet: normalizedSubject
          ? new Set([normalizedSubject])
          : new Set(),
      };
      groups.set(groupId, nextGroup);
      continue;
    }

    if (existing.kind !== kind) {
      return {
        ok: false,
        error: `出力単位 ${groupId} の種別がページ途中で変化しています。`,
      };
    }

    existing.pages.push(pageNumber);
    if (normalizedSubject && !existing.subjectSet.has(normalizedSubject)) {
      existing.subjectSet.add(normalizedSubject);
      existing.subjects.push(normalizedSubject);
    }
  }

  const units: CreatePdfExportUnit[] = [];
  const preferRangesArray =
    !options.includeCover || !options.includeMiddleCover;

  for (const group of groups.values()) {
    if (group.kind === 'question') {
      if (group.subjects.length === 0) {
        return {
          ok: false,
          error: `問題用紙グループ ${group.groupId} の学科情報を取得できませんでした。`,
        };
      }

      units.push({
        unitId: group.groupId,
        kind: 'exam-question',
        groupId: group.groupId,
        fileName: buildExamQuestionPdfFileName({ subjects: group.subjects }),
        ...toRangeFields(group.pages, preferRangesArray),
      });
      continue;
    }

    const [subject] = group.subjects;
    if (!subject || group.subjects.length !== 1) {
      return {
        ok: false,
        error: `解説用紙グループ ${group.groupId} の学科情報を特定できませんでした。`,
      };
    }

    units.push({
      unitId: group.groupId,
      kind: 'exam-answer',
      groupId: group.groupId,
      fileName: buildExamAnswerPdfFileName({ grade, subject }),
      ...toRangeFields(group.pages, preferRangesArray),
    });
  }

  return units;
};

export const buildCreatePdfExportManifest = ({
  slotKey,
  revision,
  snapshot,
  root,
  options = {},
}: {
  slotKey: string;
  revision: number;
  snapshot: CreatePdfPreviewSnapshot;
  root?: Document;
  options?: CreatePdfExportManifestOptions;
}): CreatePdfExportManifestResult => {
  const resolvedOptions: Required<CreatePdfExportManifestOptions> = {
    includeCover: options.includeCover ?? true,
    includeMiddleCover: options.includeMiddleCover ?? true,
  };

  if (snapshot.creationType === 'workbook') {
    const pagesRanges =
      !resolvedOptions.includeCover && root
        ? toPagesRanges(
            collectRenderedPagesInOrder(root, [
              'title-container',
              'question-container',
              'answer-container',
            ])
              .filter((page) => page.containerId !== 'title-container')
              .map((page) => page.pageNumber),
          )
        : undefined;

    if (!resolvedOptions.includeCover) {
      if (!root) {
        return {
          ok: false,
          error: 'PreviewWindow の render document を取得できませんでした。',
        };
      }

      if (!pagesRanges || pagesRanges.length === 0) {
        return { ok: false, error: '出力対象のページが見つかりません。' };
      }
    }

    const unit: CreatePdfExportUnit = {
      unitId: 'workbook',
      kind: 'workbook',
      groupId: 'workbook',
      fileName: buildWorkbookPdfFileName({
        grade: snapshot.grade,
        title: snapshot.title,
        workbookMode: snapshot.workbookMode,
      }),
      ...(pagesRanges ? { pagesRanges } : {}),
    };

    return {
      ok: true,
      manifest: {
        creationType: snapshot.creationType,
        slotKey,
        revision,
        title: normalizeWorkbookPdfTitle(snapshot.title),
        units: [unit],
      },
    };
  }

  if (!root) {
    return {
      ok: false,
      error: 'PreviewWindow の render document を取得できませんでした。',
    };
  }

  const units = buildExamExportUnits(root, snapshot.grade, resolvedOptions);
  if (!Array.isArray(units)) {
    return units;
  }

  if (units.length === 0) {
    return { ok: false, error: '出力対象のページが見つかりません。' };
  }

  return {
    ok: true,
    manifest: {
      creationType: snapshot.creationType,
      slotKey,
      revision,
      title: normalizeExamPdfTitle(snapshot.title),
      units,
    },
  };
};
