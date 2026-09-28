import useGlobalLoadingStore from '@stores/useGlobalLoadingStore';
import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';

export function useGlobalLoading() {
  const { show, hide, setMessage } = useGlobalLoadingStore(
    useShallow((s) => ({
      show: s.show,
      hide: s.hide,
      setMessage: s.setMessage,
    })),
  );

  const run = useCallback(
    async <T>(fn: () => Promise<T>, message?: string) => {
      const id = show(message);
      try {
        return await fn();
      } finally {
        hide(id);
      }
    },
    [show, hide],
  );

  return { show, hide, run, setMessage };
}
