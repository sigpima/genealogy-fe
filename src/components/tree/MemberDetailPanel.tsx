'use client';

import { useState } from 'react';

export type MemberDetailPanelChild = {
  name: string;
  onSelect: () => void;
};

export type MutationResult = { ok: boolean; error?: string };

export type MemberDetailPanelProps = {
  name: string;
  generation: number;
  ancestorPath: string[];
  childMembers: MemberDetailPanelChild[];
  onClose: () => void;
  onRename: (newName: string) => Promise<MutationResult>;
  onAddChild: (name: string) => Promise<MutationResult>;
  onDelete: () => Promise<MutationResult>;
};

export function MemberDetailPanel({
  name,
  generation,
  ancestorPath,
  childMembers,
  onClose,
  onRename,
  onAddChild,
  onDelete,
}: MemberDetailPanelProps) {
  const ancestors = ancestorPath.slice(0, -1);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(name);
  const [newChildName, setNewChildName] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSaveName() {
    if (!editedName.trim()) return;
    setIsSubmitting(true);
    setActionError(null);
    const result = await onRename(editedName.trim());
    setIsSubmitting(false);
    if (result.ok) {
      setIsEditingName(false);
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

  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-80 overflow-y-auto border-default border-l bg-surface p-4 shadow-lg">
      <button type="button" onClick={onClose} className="mb-4 text-sm text-muted hover:text-default">
        Đóng ✕
      </button>

      {isEditingName ? (
        <div className="flex items-center gap-x-2">
          <input
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            className="w-full rounded-lg border-default border bg-app px-2 py-1 text-lg font-semibold text-default focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSaveName}
            disabled={isSubmitting}
            className="whitespace-nowrap text-sm accent-text hover:underline disabled:opacity-50"
          >
            Lưu
          </button>
          <button
            type="button"
            onClick={() => {
              setIsEditingName(false);
              setEditedName(name);
            }}
            className="whitespace-nowrap text-sm text-muted hover:text-default"
          >
            Huỷ
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-x-2">
          <h2 className="text-lg font-semibold text-default">{name}</h2>
          <button
            type="button"
            onClick={() => {
              setEditedName(name);
              setIsEditingName(true);
            }}
            className="whitespace-nowrap text-sm text-muted hover:text-default"
          >
            Sửa
          </button>
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
          <input
            value={newChildName}
            onChange={(e) => setNewChildName(e.target.value)}
            placeholder="Tên con mới..."
            className="w-full rounded-lg border-default border bg-app px-2 py-1 text-sm text-default placeholder:text-muted focus:outline-none"
          />
          <button
            type="button"
            onClick={handleAddChild}
            disabled={isSubmitting || !newChildName.trim()}
            className="whitespace-nowrap text-sm accent-text hover:underline disabled:opacity-50"
          >
            Thêm con
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={handleDelete}
        disabled={isSubmitting}
        className="mt-6 text-sm text-danger hover:underline disabled:opacity-50"
      >
        Xoá thành viên
      </button>
    </aside>
  );
}
