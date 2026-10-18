import { useEffect, type RefObject } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
}

/**
 * A modal dialog's focus manners: focus moves in on open (to `initial`, else the first control), Tab and Shift+Tab stay inside,
 * and focus goes back to whatever opened the dialog when it closes.
 */
export function useDialogFocus(container: RefObject<HTMLElement | null>, initial?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = container.current;
    if (!root) return;
    const opener = document.activeElement as HTMLElement | null;
    (initial?.current ?? focusables(root)[0] ?? root).focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      // dialogs can stack (a confirmation over a dialog): only the one opened last — the last in the DOM — handles Tab
      const open = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if (open.length > 0 && open[open.length - 1] !== root) return;
      const items = focusables(root);
      if (items.length === 0) return event.preventDefault();
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !root.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !root.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
    // the dialog's content changes while open (a form turns into a result); the focus manners are set once per open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
