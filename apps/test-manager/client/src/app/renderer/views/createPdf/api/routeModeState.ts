import {
  createInitialExamState,
  createInitialWorkbookState,
} from '@views/createPdf/api/createPdfDraftFactory';
import { createInitialCreatePdfViewState } from '@views/createPdf/store/useCreatePdfViewStore';
import {
  type CreatePdfInitialLoadSource,
  type CreatePdfRouteMode,
  type CreatePdfRouteSnapshot,
  createPdfInitialLoadPriority,
  isWorkbookRouteMode,
} from '@views/createPdf/types/viewState';

const resolveCreationTypeFromRouteMode = (
  mode: CreatePdfRouteMode,
): 'exam' | 'workbook' => (isWorkbookRouteMode(mode) ? 'workbook' : 'exam');

export const resolveCreatePdfModeFromPathname = (
  pathname: string,
): CreatePdfRouteMode => {
  if (pathname.endsWith('/tempWorkbook')) return 'tempWorkbook';
  if (pathname.endsWith('/main')) return 'tempExam';
  if (pathname.endsWith('/workbook')) return 'workbook';
  return 'exam';
};

export const createInitialCreatePdfRouteSnapshot = (
  mode: CreatePdfRouteMode,
): CreatePdfRouteSnapshot => {
  if (isWorkbookRouteMode(mode)) {
    return {
      common: createInitialCreatePdfViewState('workbook'),
      workbook: createInitialWorkbookState(),
    };
  }

  return {
    common: createInitialCreatePdfViewState(
      resolveCreationTypeFromRouteMode(mode),
    ),
    exam: createInitialExamState(),
  };
};

type ResolveCreatePdfInitialLoadInput = {
  mode: CreatePdfRouteMode;
  jsonSnapshot?: CreatePdfRouteSnapshot | null;
  savedSnapshot?: CreatePdfRouteSnapshot | null;
};

export type CreatePdfInitialLoadResult = {
  source: CreatePdfInitialLoadSource;
  snapshot: CreatePdfRouteSnapshot;
};

export const resolveCreatePdfInitialLoad = ({
  mode,
  jsonSnapshot = null,
  savedSnapshot = null,
}: ResolveCreatePdfInitialLoadInput): CreatePdfInitialLoadResult => {
  const candidates: Array<{
    source: CreatePdfInitialLoadSource;
    snapshot: CreatePdfRouteSnapshot | null;
  }> = createPdfInitialLoadPriority.map((source) => {
    if (source === 'json') {
      return { source, snapshot: jsonSnapshot };
    }

    if (source === 'savedState') {
      return { source, snapshot: savedSnapshot };
    }

    return {
      source,
      snapshot: createInitialCreatePdfRouteSnapshot(mode),
    };
  });

  const resolved = candidates.find((candidate) => candidate.snapshot !== null);
  if (!resolved?.snapshot) {
    return {
      source: 'initialState',
      snapshot: createInitialCreatePdfRouteSnapshot(mode),
    };
  }

  return {
    source: resolved.source,
    snapshot: resolved.snapshot,
  };
};
