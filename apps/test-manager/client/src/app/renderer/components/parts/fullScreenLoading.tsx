import useGlobalLoadingStore from '@stores/useGlobalLoadingStore';
import { useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';

const FullScreenLoading = () => {
  const { items } = useGlobalLoadingStore(
    useShallow((s) => ({ items: s.items })),
  );
  const active = items.length > 0;

  const message = useMemo(() => {
    for (let i = items.length - 1; i >= 0; i--) {
      const m = items[i]?.message;
      if (m?.trim()) return m;
    }
    return undefined;
  }, [items]);

  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;

    const prevActive = document.activeElement as HTMLElement | null;
    prevActive?.blur?.();
    overlayRef.current?.focus({ preventScroll: true });
  }, [active]);

  useEffect(() => {
    if (!active) return;

    const blockKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    };

    const keepFocus = (e: FocusEvent) => {
      const overlay = overlayRef.current;
      if (!overlay) return;

      const t = e.target as Node | null;
      if (t && overlay.contains(t)) return;

      overlay.focus({ preventScroll: true });
    };

    window.addEventListener('keydown', blockKey, true);
    window.addEventListener('keyup', blockKey, true);
    window.addEventListener('keypress', blockKey, true);

    document.addEventListener('focusin', keepFocus, true);

    return () => {
      window.removeEventListener('keydown', blockKey, true);
      window.removeEventListener('keyup', blockKey, true);
      window.removeEventListener('keypress', blockKey, true);
      document.removeEventListener('focusin', keepFocus, true);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div
      ref={overlayRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-live="polite"
      aria-busy="true"
      onKeyDownCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onKeyUpCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className="fixed inset-0 z-999 flex items-center justify-center bg-foreground/80 pointer-events-auto"
    >
      <div className="rounded-lg border bg-background px-6 py-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-foreground" />
          <div className="text-sm text-foreground">{message ?? '処理中…'}</div>
        </div>
      </div>
    </div>
  );
};

export default FullScreenLoading;
