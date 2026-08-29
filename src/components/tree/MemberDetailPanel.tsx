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

export type MemberDetailPanelProps = {
  name: string;
  generation: number;
  ancestorPath: string[];
  birthYear: number | null;
  deathYear: number | null;
  gender: Gender | null;
  notes: string | null;
  childMembers: MemberDetailPanelChild[];
  onClose: () => void;
  onUpdate: (input: MemberUpdateInput) => Promise<MutationResult>;
  onAddChild: (name: string) => Promise<MutationResult>;
  onDelete: () => Promise<MutationResult>;
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

export function MemberDetailPanel({
  name,
  generation,
  ancestorPath,
  birthYear,
  deathYear,
  gender,
  notes,
  childMembers,
  onClose,
  onUpdate,
  onAddChild,
  onDelete,
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

  const lifespan =
    birthYear !== null || deathYear !== null
      ? `${birthYear ?? '?'} – ${deathYear ?? 'nay'}`
      : null;

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
