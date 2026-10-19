import { useEffect, useRef, useState } from 'react';
import type { ArticleSummary, GenerationWord } from '@/lib/chronicles/chronicles';

/**
 * Esc closes the panel, but never throws away typing: it is ignored in form fields, while any edit is open and while a
 * dialog sits on top of the panel (photo viewer, propose-an-edit), which owns Esc itself.
 */
export function useEscapeToClose(onClose: () => void, blocked: boolean) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select')) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (blocked) return;
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, blocked]);
}

/**
 * Below xl the panel is a modal overlay (dimmed backdrop): move focus into it, keep Tab inside it and give focus back
 * to whatever opened it. On desktop it is a plain side panel and focus is left alone.
 */
export function useModalFocus() {
  const panelRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !window.matchMedia('(max-width: 1279px)').matches) return;
    const opener = document.activeElement as HTMLElement | null;
    panel.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>('button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])')
      ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    panel.addEventListener('keydown', onKeyDown);
    return () => {
      panel.removeEventListener('keydown', onKeyDown);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, []);
  return panelRef;
}

/** Fetches a list for the panel; a failure just shows nothing. */
function useFetchedList<T>(url: string | null): T[] {
  const [rows, setRows] = useState<T[]>([]);
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetch(url, { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<T[]>) : []))
      .then((list) => {
        if (!cancelled) setRows(list);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [url]);
  return rows;
}

/**
 * "Được nhắc trong…" (published articles that mention this person) and the bài đệm, which is only used to hint a new
 * child's middle name, so only admins fetch it.
 */
export function usePanelExtras(memberId: number, canEdit: boolean) {
  const mentions = useFetchedList<ArticleSummary>(`/api/members/${memberId}/articles`);
  const poem = useFetchedList<GenerationWord>(canEdit ? '/api/generation-poem' : null);
  return { mentions, poem };
}
