'use client';

import { useState } from 'react';
import type { Gender } from '@/lib/tree/types';

export type MemberDetailPanelChild = {
  name: string;
  onSelect: () => void;
};

export type MutationResult = { ok: boolean; error?: string };

export type MemberUpdateInput = {
  name: string;
  birthYear: number | null;
  deathYear: number | null;
  gender: Gender | null;
  notes: string | null;
};

export type PanelSpouse = {
  marriageId: number;
  spouseId: number;
  name: string;
  birthYear: number | null;
  deathYear: number | null;
  gender: Gender | null;
  notes: string | null;
  marriageYear: number | null;
};

export type SpouseAddInput = {
  name: string;
  marriageYear: number | null;
};

export type SpouseUpdateInput = {
  name: string;
  birthYear: number | null;
  deathYear: number | null;
  gender: Gender | null;
  notes: string | null;
  marriageYear: number | null;
};

export type MemberDetailPanelProps = {
  name: string;
  generation: number;
  ancestorPath: string[];
  birthYear: number | null;
  deathYear: number | null;
  gender: Gender | null;
  notes: string | null;
  childMembers: MemberDetailPanelChild[];
  spouses: PanelSpouse[];
  onClose: () => void;
  onUpdate: (input: MemberUpdateInput) => Promise<MutationResult>;
  onAddChild: (name: string) => Promise<MutationResult>;
  onDelete: () => Promise<MutationResult>;
  onAddSpouse: (input: SpouseAddInput) => Promise<MutationResult>;
  onUpdateSpouse: (marriageId: number, input: SpouseUpdateInput) => Promise<MutationResult>;
  onDeleteSpouse: (spouseId: number) => Promise<MutationResult>;
};

const GENDER_LABELS: Record<Gender, string> = {
  male: 'Nam',
  female: 'Nữ',
  other: 'Khác',
};

function toInputValue(value: number | null): string {
  return value === null ? '' : String(value);
}

function parseYear(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function lifespanOf(birthYear: number | null, deathYear: number | null): string | null {
  if (birthYear === null && deathYear === null) return null;
  return `${birthYear ?? '?'} – ${deathYear ?? 'nay'}`;
}

type SpouseDraft = {
  name: string;
  birthYear: string;
  deathYear: string;
  gender: string;
  notes: string;
  marriageYear: string;
};

function draftFromSpouse(spouse: PanelSpouse): SpouseDraft {
  return {
    name: spouse.name,
    birthYear: toInputValue(spouse.birthYear),
    deathYear: toInputValue(spouse.deathYear),
    gender: spouse.gender ?? '',
    marriageYear: toInputValue(spouse.marriageYear),
    notes: spouse.notes ?? '',
  };
}

export function MemberDetailPanel({
  name,
  generation,
  ancestorPath,
  birthYear,
  deathYear,
  gender,
  notes,
  childMembers,
  spouses,
  onClose,
  onUpdate,
  onAddChild,
  onDelete,
  onAddSpouse,
  onUpdateSpouse,
  onDeleteSpouse,
}: MemberDetailPanelProps) {
  const ancestors = ancestorPath.slice(0, -1);

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(name);
  const [editedBirthYear, setEditedBirthYear] = useState(toInputValue(birthYear));
  const [editedDeathYear, setEditedDeathYear] = useState(toInputValue(deathYear));
  const [editedGender, setEditedGender] = useState<string>(gender ?? '');
  const [editedNotes, setEditedNotes] = useState(notes ?? '');
  const [newChildName, setNewChildName] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingSpouseId, setEditingSpouseId] = useState<number | null>(null);
  const [spouseDraft, setSpouseDraft] = useState<SpouseDraft | null>(null);
  const [newSpouseName, setNewSpouseName] = useState('');
  const [newSpouseMarriageYear, setNewSpouseMarriageYear] = useState('');

  function startEditing() {
    setEditedName(name);
    setEditedBirthYear(toInputValue(birthYear));
    setEditedDeathYear(toInputValue(deathYear));
    setEditedGender(gender ?? '');
    setEditedNotes(notes ?? '');
    setIsEditing(true);
  }

  async function handleSave() {
    if (!editedName.trim()) return;
    setIsSubmitting(true);
    setActionError(null);
    const result = await onUpdate({
      name: editedName.trim(),
      birthYear: parseYear(editedBirthYear),
      deathYear: parseYear(editedDeathYear),
      gender: editedGender ? (editedGender as Gender) : null,
      notes: editedNotes.trim() ? editedNotes.trim() : null,
    });
    setIsSubmitting(false);
    if (result.ok) {
      setIsEditing(false);
    } else {
      setActionError(result.error ?? 'Không thể lưu. Vui lòng thử lại.');
    }
  }

  async function handleAddChild() {
    if (!newChildName.trim()) return;
    setIsSubmitting(true);
    setActionError(null);
    const result = await onAddChild(newChildName.trim());
    setIsSubmitting(false);
    if (result.ok) {
      setNewChildName('');
    } else {
      setActionError(result.error ?? 'Không thể thêm. Vui lòng thử lại.');
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Xoá "${name}"? Hành động này không thể hoàn tác.`)) return;
    setIsSubmitting(true);
    setActionError(null);
    const result = await onDelete();
    setIsSubmitting(false);
    if (!result.ok) {
      setActionError(result.error ?? 'Không thể xoá. Vui lòng thử lại.');
    }
  }

  function startEditingSpouse(spouse: PanelSpouse) {
    setEditingSpouseId(spouse.marriageId);
    setSpouseDraft(draftFromSpouse(spouse));
  }

  async function handleSaveSpouse(marriageId: number) {
    if (!spouseDraft || !spouseDraft.name.trim()) return;
    setIsSubmitting(true);
    setActionError(null);
    const result = await onUpdateSpouse(marriageId, {
      name: spouseDraft.name.trim(),
      birthYear: parseYear(spouseDraft.birthYear),
      deathYear: parseYear(spouseDraft.deathYear),
      gender: spouseDraft.gender ? (spouseDraft.gender as Gender) : null,
      notes: spouseDraft.notes.trim() ? spouseDraft.notes.trim() : null,
      marriageYear: parseYear(spouseDraft.marriageYear),
    });
    setIsSubmitting(false);
    if (result.ok) {
      setEditingSpouseId(null);
      setSpouseDraft(null);
    } else {
      setActionError(result.error ?? 'Không thể lưu. Vui lòng thử lại.');
    }
  }

  async function handleDeleteSpouse(spouse: PanelSpouse) {
    if (!window.confirm(`Xoá "${spouse.name}" khỏi danh sách vợ/chồng?`)) return;
    setIsSubmitting(true);
    setActionError(null);
    const result = await onDeleteSpouse(spouse.spouseId);
    setIsSubmitting(false);
    if (!result.ok) {
      setActionError(result.error ?? 'Không thể xoá. Vui lòng thử lại.');
    }
  }

  async function handleAddSpouse() {
    if (!newSpouseName.trim()) return;
    setIsSubmitting(true);
    setActionError(null);
    const result = await onAddSpouse({
      name: newSpouseName.trim(),
      marriageYear: parseYear(newSpouseMarriageYear),
    });
    setIsSubmitting(false);
    if (result.ok) {
      setNewSpouseName('');
      setNewSpouseMarriageYear('');
    } else {
      setActionError(result.error ?? 'Không thể thêm. Vui lòng thử lại.');
    }
  }

  const lifespan = lifespanOf(birthYear, deathYear);

  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-80 overflow-y-auto border-default border-l bg-surface p-4 shadow-lg">
      <button type="button" onClick={onClose} className="mb-4 text-sm text-muted hover:text-default">
        Đóng ✕
      </button>

      {isEditing ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted">Họ tên</label>
            <input
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              className="mt-1 w-full rounded-lg border-default border bg-app px-2 py-1 text-sm text-default focus:outline-none"
            />
          </div>
          <div className="flex gap-x-2">
            <div className="flex-1">
              <label className="text-xs text-muted">Năm sinh</label>
              <input
                type="number"
                value={editedBirthYear}
                onChange={(e) => setEditedBirthYear(e.target.value)}
                className="mt-1 w-full rounded-lg border-default border bg-app px-2 py-1 text-sm text-default focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted">Năm mất</label>
              <input
                type="number"
                value={editedDeathYear}
                onChange={(e) => setEditedDeathYear(e.target.value)}
                className="mt-1 w-full rounded-lg border-default border bg-app px-2 py-1 text-sm text-default focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted">Giới tính</label>
            <select
              value={editedGender}
              onChange={(e) => setEditedGender(e.target.value)}
              className="mt-1 w-full rounded-lg border-default border bg-app px-2 py-1 text-sm text-default focus:outline-none"
            >
              <option value="">Không rõ</option>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
              <option value="other">Khác</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted">Ghi chú</label>
            <textarea
              value={editedNotes}
              onChange={(e) => setEditedNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border-default border bg-app px-2 py-1 text-sm text-default focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-x-2">
            <button type="button" onClick={handleSave} disabled={isSubmitting} className="whitespace-nowrap text-sm accent-text hover:underline disabled:opacity-50">
              Lưu
            </button>
            <button type="button" onClick={() => setIsEditing(false)} className="whitespace-nowrap text-sm text-muted hover:text-default">
              Huỷ
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between gap-x-2">
            <h2 className="text-lg font-semibold text-default">{name}</h2>
            <button type="button" onClick={startEditing} className="whitespace-nowrap text-sm text-muted hover:text-default">
              Sửa
            </button>
          </div>
          {lifespan && <p className="mt-1 text-sm text-muted">{lifespan}</p>}
          {gender && <p className="mt-1 text-sm text-muted">{GENDER_LABELS[gender]}</p>}
          {notes && <p className="mt-2 whitespace-pre-wrap text-sm text-default">{notes}</p>}
        </div>
      )}

      <p className="mt-1 text-sm text-muted">Đời thứ {generation}</p>

      {ancestors.length > 0 && <p className="mt-4 text-xs text-muted">{ancestors.join(' → ')}</p>}

      {actionError && <p className="mt-4 text-sm text-danger">{actionError}</p>}

      <div className="mt-6">
        <h3 className="text-sm font-medium text-default">Vợ/chồng ({spouses.length})</h3>
        {spouses.length > 0 && (
          <ul className="mt-2 space-y-3">
            {spouses.map((spouse) =>
              editingSpouseId === spouse.marriageId && spouseDraft ? (
                <li key={spouse.marriageId} className="space-y-2 rounded-lg border-default border p-2">
                  <input
                    value={spouseDraft.name}
                    onChange={(e) => setSpouseDraft({ ...spouseDraft, name: e.target.value })}
                    className="w-full rounded-lg border-default border bg-app px-2 py-1 text-sm text-default focus:outline-none"
                  />
                  <div className="flex gap-x-2">
                    <input
                      type="number"
                      value={spouseDraft.birthYear}
                      onChange={(e) => setSpouseDraft({ ...spouseDraft, birthYear: e.target.value })}
                      placeholder="Năm sinh"
                      className="w-full rounded-lg border-default border bg-app px-2 py-1 text-sm text-default placeholder:text-muted focus:outline-none"
                    />
                    <input
                      type="number"
                      value={spouseDraft.deathYear}
                      onChange={(e) => setSpouseDraft({ ...spouseDraft, deathYear: e.target.value })}
                      placeholder="Năm mất"
                      className="w-full rounded-lg border-default border bg-app px-2 py-1 text-sm text-default placeholder:text-muted focus:outline-none"
                    />
                  </div>
                  <select
                    value={spouseDraft.gender}
                    onChange={(e) => setSpouseDraft({ ...spouseDraft, gender: e.target.value })}
                    className="w-full rounded-lg border-default border bg-app px-2 py-1 text-sm text-default focus:outline-none"
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
                    className="w-full rounded-lg border-default border bg-app px-2 py-1 text-sm text-default placeholder:text-muted focus:outline-none"
                  />
                  <textarea
                    value={spouseDraft.notes}
                    onChange={(e) => setSpouseDraft({ ...spouseDraft, notes: e.target.value })}
                    rows={2}
                    placeholder="Ghi chú"
                    className="w-full rounded-lg border-default border bg-app px-2 py-1 text-sm text-default placeholder:text-muted focus:outline-none"
                  />
                  <div className="flex items-center gap-x-2">
                    <button type="button" onClick={() => handleSaveSpouse(spouse.marriageId)} disabled={isSubmitting} className="whitespace-nowrap text-sm accent-text hover:underline disabled:opacity-50">
                      Lưu
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSpouseId(null);
                        setSpouseDraft(null);
                      }}
                      className="whitespace-nowrap text-sm text-muted hover:text-default"
                    >
                      Huỷ
                    </button>
                  </div>
                </li>
              ) : (
                <li key={spouse.marriageId} className="text-sm text-default">
                  <div className="flex items-center justify-between gap-x-2">
                    <span>{spouse.name}</span>
                    <div className="flex items-center gap-x-2">
                      <button type="button" onClick={() => startEditingSpouse(spouse)} className="whitespace-nowrap text-xs text-muted hover:text-default">
                        Sửa
                      </button>
                      <button type="button" onClick={() => handleDeleteSpouse(spouse)} className="whitespace-nowrap text-xs text-danger hover:underline">
                        Xoá
                      </button>
                    </div>
                  </div>
                  {(lifespanOf(spouse.birthYear, spouse.deathYear) || spouse.marriageYear !== null) && (
                    <p className="text-xs text-muted">
                      {lifespanOf(spouse.birthYear, spouse.deathYear)}
                      {spouse.marriageYear !== null && ` · Cưới năm ${spouse.marriageYear}`}
                    </p>
                  )}
                </li>
              )
            )}
          </ul>
        )}
        <div className="mt-3 flex items-center gap-x-2">
          <input
            value={newSpouseName}
            onChange={(e) => setNewSpouseName(e.target.value)}
            placeholder="Tên vợ/chồng..."
            className="w-full rounded-lg border-default border bg-app px-2 py-1 text-sm text-default placeholder:text-muted focus:outline-none"
          />
          <input
            type="number"
            value={newSpouseMarriageYear}
            onChange={(e) => setNewSpouseMarriageYear(e.target.value)}
            placeholder="Năm cưới"
            className="w-24 shrink-0 rounded-lg border-default border bg-app px-2 py-1 text-sm text-default placeholder:text-muted focus:outline-none"
          />
          <button type="button" onClick={handleAddSpouse} disabled={isSubmitting || !newSpouseName.trim()} className="whitespace-nowrap text-sm accent-text hover:underline disabled:opacity-50">
            Thêm
          </button>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-medium text-default">Con ({childMembers.length})</h3>
        {childMembers.length > 0 && (
          <ul className="mt-2 space-y-1">
            {childMembers.map((child) => (
              <li key={child.name}>
                <button type="button" onClick={child.onSelect} className="text-sm text-default hover:accent-text">
                  {child.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex items-center gap-x-2">
          <input value={newChildName} onChange={(e) => setNewChildName(e.target.value)} placeholder="Tên con mới..." className="w-full rounded-lg border-default border bg-app px-2 py-1 text-sm text-default placeholder:text-muted focus:outline-none" />
          <button type="button" onClick={handleAddChild} disabled={isSubmitting || !newChildName.trim()} className="whitespace-nowrap text-sm accent-text hover:underline disabled:opacity-50">
            Thêm con
          </button>
        </div>
      </div>

      <button type="button" onClick={handleDelete} disabled={isSubmitting} className="mt-6 text-sm text-danger hover:underline disabled:opacity-50">
        Xoá thành viên
      </button>
    </aside>
  );
}
