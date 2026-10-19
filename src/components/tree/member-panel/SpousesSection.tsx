import { useEffect, useState } from 'react';
import { lifespanLabel } from '@/lib/tree/member-status';
import { draftFromSpouse, parseYear, type SpouseDraft } from './draft';
import { PanelSection } from './PanelParts';
import { dangerButton, fieldClass, ghostButton, primaryButton } from './styles';
import type { Gender, MutationResult, PanelSpouse, SpouseAddInput, SpouseUpdateInput } from './types';

type SpousesSectionProps = {
  spouses: PanelSpouse[];
  canEdit: boolean;
  isDetailLoading: boolean;
  detailLoadError: boolean;
  isSubmitting: boolean;
  /** Runs a mutation with the panel's busy flag and error line; true when it succeeded. */
  run: (action: () => Promise<MutationResult>, fallbackError: string) => Promise<boolean>;
  onAddSpouse: (input: SpouseAddInput) => Promise<MutationResult>;
  onUpdateSpouse: (marriageId: number, input: SpouseUpdateInput) => Promise<MutationResult>;
  onDeleteSpouse: (spouseId: number) => Promise<MutationResult>;
  /** Tells the panel that a row is open for editing (Esc and the backdrop must not discard it). */
  onEditingChange: (editing: boolean) => void;
};

export function SpousesSection({
  spouses,
  canEdit,
  isDetailLoading,
  detailLoadError,
  isSubmitting,
  run,
  onAddSpouse,
  onUpdateSpouse,
  onDeleteSpouse,
  onEditingChange,
}: SpousesSectionProps) {
  const detailReady = !isDetailLoading && !detailLoadError;
  const [editingSpouseId, setEditingSpouseId] = useState<number | null>(null);
  const [spouseDraft, setSpouseDraft] = useState<SpouseDraft | null>(null);
  const [newSpouseName, setNewSpouseName] = useState('');
  const [newSpouseMarriageYear, setNewSpouseMarriageYear] = useState('');

  const editing = editingSpouseId !== null;
  useEffect(() => {
    onEditingChange(editing);
    return () => onEditingChange(false);
  }, [editing, onEditingChange]);

  function startEditingSpouse(spouse: PanelSpouse) {
    setEditingSpouseId(spouse.marriageId);
    setSpouseDraft(draftFromSpouse(spouse));
  }

  function stopEditingSpouse() {
    setEditingSpouseId(null);
    setSpouseDraft(null);
  }

  async function handleSaveSpouse(marriageId: number) {
    if (!spouseDraft || !spouseDraft.name.trim()) return;
    const ok = await run(
      () =>
        onUpdateSpouse(marriageId, {
          name: spouseDraft.name.trim(),
          birthYear: parseYear(spouseDraft.birthYear),
          deathYear: parseYear(spouseDraft.deathYear),
          gender: spouseDraft.gender ? (spouseDraft.gender as Gender) : null,
          notes: spouseDraft.notes.trim() ? spouseDraft.notes.trim() : null,
          marriageYear: parseYear(spouseDraft.marriageYear),
        }),
      'Không thể lưu. Vui lòng thử lại.'
    );
    if (ok) stopEditingSpouse();
  }

  async function handleDeleteSpouse(spouse: PanelSpouse) {
    if (!window.confirm(`Xoá "${spouse.name}" khỏi danh sách vợ/chồng?`)) return;
    await run(() => onDeleteSpouse(spouse.spouseId), 'Không thể xoá. Vui lòng thử lại.');
  }

  async function handleAddSpouse() {
    if (!newSpouseName.trim()) return;
    const ok = await run(
      () => onAddSpouse({ name: newSpouseName.trim(), marriageYear: parseYear(newSpouseMarriageYear) }),
      'Không thể thêm. Vui lòng thử lại.'
    );
    if (ok) {
      setNewSpouseName('');
      setNewSpouseMarriageYear('');
    }
  }

  return (
    <PanelSection title={`Vợ/chồng (${spouses.length})`} first>
      {isDetailLoading && <p className="text-sm text-muted">Đang tải...</p>}
      {detailLoadError && <p className="text-sm text-muted">Không thể tải.</p>}
      {detailReady && spouses.length > 0 && (
        <ul className="mt-2 space-y-3">
          {spouses.map((spouse) =>
            editingSpouseId === spouse.marriageId && spouseDraft ? (
              <li key={spouse.marriageId} className="space-y-2 rounded-lg border-default border p-3">
                <input
                  aria-label="Tên vợ/chồng"
                  value={spouseDraft.name}
                  onChange={(e) => setSpouseDraft({ ...spouseDraft, name: e.target.value })}
                  className={fieldClass}
                />
                <div className="flex gap-x-2">
                  <input
                    type="number"
                    value={spouseDraft.birthYear}
                    onChange={(e) => setSpouseDraft({ ...spouseDraft, birthYear: e.target.value })}
                    placeholder="Năm sinh"
                    aria-label="Năm sinh"
                    className={fieldClass}
                  />
                  <input
                    type="number"
                    value={spouseDraft.deathYear}
                    onChange={(e) => setSpouseDraft({ ...spouseDraft, deathYear: e.target.value })}
                    placeholder="Năm mất"
                    aria-label="Năm mất"
                    className={fieldClass}
                  />
                </div>
                <select
                  aria-label="Giới tính"
                  value={spouseDraft.gender}
                  onChange={(e) => setSpouseDraft({ ...spouseDraft, gender: e.target.value })}
                  className={fieldClass}
                >
                  <option value="">Không rõ</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                  <option value="other">Khác</option>
                </select>
                <input
                  type="number"
                  value={spouseDraft.marriageYear}
                  onChange={(e) => setSpouseDraft({ ...spouseDraft, marriageYear: e.target.value })}
                  placeholder="Năm cưới"
                  aria-label="Năm cưới"
                  className={fieldClass}
                />
                <textarea
                  value={spouseDraft.notes}
                  onChange={(e) => setSpouseDraft({ ...spouseDraft, notes: e.target.value })}
                  rows={2}
                  placeholder="Ghi chú"
                  aria-label="Ghi chú"
                  className={fieldClass}
                />
                <div className="flex items-center gap-x-2">
                  <button type="button" onClick={() => handleSaveSpouse(spouse.marriageId)} disabled={isSubmitting} className={primaryButton}>
                    Lưu
                  </button>
                  <button type="button" onClick={stopEditingSpouse} className={ghostButton}>
                    Huỷ
                  </button>
                </div>
              </li>
            ) : (
              <li key={spouse.marriageId} className="rounded-lg bg-surface-muted p-3 text-sm text-default">
                <div className="flex items-center justify-between gap-x-2">
                  <span className="font-display font-semibold">{spouse.name}</span>
                  {canEdit && (
                    <div className="flex items-center">
                      <button type="button" onClick={() => startEditingSpouse(spouse)} className={ghostButton}>
                        Sửa
                      </button>
                      <button type="button" onClick={() => handleDeleteSpouse(spouse)} className={dangerButton}>
                        Xoá
                      </button>
                    </div>
                  )}
                </div>
                {(lifespanLabel(spouse.birthYear, spouse.deathYear) || spouse.marriageYear !== null) && (
                  <p className="text-xs text-muted">
                    {lifespanLabel(spouse.birthYear, spouse.deathYear)}
                    {spouse.marriageYear !== null && ` · Cưới năm ${spouse.marriageYear}`}
                  </p>
                )}
              </li>
            )
          )}
        </ul>
      )}
      {detailReady && canEdit && (
        <div className="mt-3 flex items-center gap-x-2">
          <input
            value={newSpouseName}
            onChange={(e) => setNewSpouseName(e.target.value)}
            placeholder="Tên vợ/chồng..."
            aria-label="Tên vợ/chồng mới"
            className={`${fieldClass} min-w-0 flex-1`}
          />
          <input
            type="number"
            value={newSpouseMarriageYear}
            onChange={(e) => setNewSpouseMarriageYear(e.target.value)}
            placeholder="Năm cưới"
            aria-label="Năm cưới"
            className={`${fieldClass} w-24! shrink-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
          />
          <button type="button" onClick={handleAddSpouse} disabled={isSubmitting || !newSpouseName.trim()} className={primaryButton}>
            Thêm
          </button>
        </div>
      )}
    </PanelSection>
  );
}
