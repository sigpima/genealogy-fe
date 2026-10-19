import { useState } from 'react';
import { wordHint, type GenerationWord } from '@/lib/chronicles/chronicles';
import { PanelSection } from './PanelParts';
import { fieldClass, primaryButton } from './styles';
import type { MemberDetailPanelChild, MutationResult } from './types';

type ChildrenSectionProps = {
  childMembers: MemberDetailPanelChild[];
  canEdit: boolean;
  /** The generation the new child would be in: the poem's word for it is shown as a hint. */
  childGeneration: number;
  poem: GenerationWord[];
  isSubmitting: boolean;
  run: (action: () => Promise<MutationResult>, fallbackError: string) => Promise<boolean>;
  onAddChild: (name: string) => Promise<MutationResult>;
};

export function ChildrenSection({ childMembers, canEdit, childGeneration, poem, isSubmitting, run, onAddChild }: ChildrenSectionProps) {
  const [newChildName, setNewChildName] = useState('');
  const hint = canEdit ? wordHint(poem, childGeneration) : null;

  async function handleAddChild() {
    if (!newChildName.trim()) return;
    const ok = await run(() => onAddChild(newChildName.trim()), 'Không thể thêm. Vui lòng thử lại.');
    if (ok) setNewChildName('');
  }

  return (
    <PanelSection title={`Con (${childMembers.length})`}>
      {childMembers.length > 0 && (
        <ul className="mt-2 space-y-1">
          {childMembers.map((child) => (
            <li key={child.name}>
              <button
                type="button"
                onClick={child.onSelect}
                className="min-h-11 w-full rounded-lg px-3 text-left text-sm text-default hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
              >
                {child.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="mt-3 flex items-center gap-x-2">
          <input
            value={newChildName}
            onChange={(e) => setNewChildName(e.target.value)}
            placeholder="Tên con mới..."
            aria-label="Tên con mới"
            className={`${fieldClass} min-w-0 flex-1`}
          />
          <button type="button" onClick={handleAddChild} disabled={isSubmitting || !newChildName.trim()} className={primaryButton}>
            Thêm
          </button>
        </div>
      )}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </PanelSection>
  );
}
