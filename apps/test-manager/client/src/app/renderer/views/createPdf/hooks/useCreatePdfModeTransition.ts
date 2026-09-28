import {
  closeCreatePdfPreviewWindow,
  getCreatePdfPreviewWindowStatus,
} from '@renderer/api/createPdfExportBridge';
import useGlobalLoadingStore from '@stores/useGlobalLoadingStore';
import type { CreatePdfModeTransitionPath } from '@views/createPdf/store/createPdfModeTransitionStore';
import { createPdfModeTransitionStore } from '@views/createPdf/store/createPdfModeTransitionStore';
import { createPdfPreviewOrderStore } from '@views/createPdf/store/createPdfPreviewOrderStore';
import useCreatePdfStatusRuntimeStore, {
  CLOSED_CREATE_PDF_PREVIEW_WINDOW_STATUS,
} from '@views/createPdf/store/useCreatePdfStatusRuntimeStore';
import type { CreationType } from '@views/createPdf/types/viewState';
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';

export type CreatePdfModeTransitionResult =
  | { ok: true; reason: 'navigated' | 'same-path' | 'not-create-pdf-mode' }
  | {
      ok: false;
      reason:
        | 'exporting'
        | 'already-transitioning'
        | 'status-failed'
        | 'close-failed';
    };

type CreatePdfModeTransitionOptions = {
  targetPath: CreatePdfModeTransitionPath;
  state?: unknown;
  replace?: boolean;
};

const MODE_TRANSITION_TIMEOUT_MS = 30_000;

const toModePath = (pathname: string): CreatePdfModeTransitionPath | null => {
  if (pathname === '/createPdf/exam' || pathname === '/createPdf/workbook') {
    return pathname;
  }
  return null;
};

const resolveCreationTypeFromPath = (
  path: CreatePdfModeTransitionPath,
): CreationType => (path === '/createPdf/workbook' ? 'workbook' : 'exam');

export const useCreatePdfModeTransition = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return useCallback(
    async ({
      targetPath,
      state,
      replace,
    }: CreatePdfModeTransitionOptions): Promise<CreatePdfModeTransitionResult> => {
      const sourcePath = toModePath(location.pathname);
      if (sourcePath === targetPath) {
        return { ok: true, reason: 'same-path' };
      }

      if (!sourcePath) {
        navigate(targetPath, { replace, state });
        return { ok: true, reason: 'not-create-pdf-mode' };
      }

      if (useCreatePdfStatusRuntimeStore.getState().isExporting) {
        return { ok: false, reason: 'exporting' };
      }

      if (createPdfModeTransitionStore.getState().isTransitioning) {
        return { ok: false, reason: 'already-transitioning' };
      }

      const targetCreationType = resolveCreationTypeFromPath(targetPath);
      const loadingId = useGlobalLoadingStore
        .getState()
        .show('PDF作成モードを切り替えています…');
      const transitionId = createPdfModeTransitionStore
        .getState()
        .actions.begin({
          sourcePath,
          targetPath,
          targetCreationType,
          loadingId,
        });

      window.setTimeout(() => {
        if (
          createPdfModeTransitionStore.getState().transitionId === transitionId
        ) {
          createPdfModeTransitionStore.getState().actions.reset();
        }
      }, MODE_TRANSITION_TIMEOUT_MS);

      const statusResult = await getCreatePdfPreviewWindowStatus();
      if (!statusResult.ok) {
        createPdfModeTransitionStore.getState().actions.reset();
        return { ok: false, reason: 'status-failed' };
      }

      const shouldRestorePreviewWindow = statusResult.status.isOpen;
      createPdfModeTransitionStore
        .getState()
        .actions.setShouldRestorePreviewWindow(
          transitionId,
          shouldRestorePreviewWindow,
        );

      if (shouldRestorePreviewWindow) {
        const closeResult = await closeCreatePdfPreviewWindow();
        if (!closeResult.ok) {
          createPdfModeTransitionStore.getState().actions.reset();
          return { ok: false, reason: 'close-failed' };
        }
        useCreatePdfStatusRuntimeStore
          .getState()
          .actions.setPreviewWindowStatus(
            CLOSED_CREATE_PDF_PREVIEW_WINDOW_STATUS,
          );
      }

      createPdfPreviewOrderStore.clearSession();
      createPdfPreviewOrderStore.setActiveCreationType(targetCreationType);
      navigate(targetPath, { replace, state });
      return { ok: true, reason: 'navigated' };
    },
    [location.pathname, navigate],
  );
};
