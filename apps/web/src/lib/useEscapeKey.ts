import { useEffect, useRef } from 'react';

/** Run `onEscape` when Escape is pressed while `active` (e.g. close a dialog). */
export function useEscapeKey(active: boolean, onEscape: () => void) {
  const callback = useRef(onEscape);
  callback.current = onEscape;
  useEffect(() => {
    if (!active) return;
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') callback.current(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active]);
}
