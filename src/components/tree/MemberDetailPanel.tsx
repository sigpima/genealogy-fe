'use client';

export type MemberDetailPanelChild = {
  name: string;
  onSelect: () => void;
};

export type MemberDetailPanelProps = {
  name: string;
  generation: number;
  ancestorPath: string[];
  childMembers: MemberDetailPanelChild[];
  onClose: () => void;
};

export function MemberDetailPanel({
  name,
  generation,
  ancestorPath,
  childMembers,
  onClose,
}: MemberDetailPanelProps) {
  const ancestors = ancestorPath.slice(0, -1);

  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-80 overflow-y-auto border-default border-l bg-surface p-4 shadow-lg">
      <button type="button" onClick={onClose} className="mb-4 text-sm text-muted hover:text-default">
        Đóng ✕
      </button>
      <h2 className="text-lg font-semibold text-default">{name}</h2>
      <p className="mt-1 text-sm text-muted">Đời thứ {generation}</p>

      {ancestors.length > 0 && <p className="mt-4 text-xs text-muted">{ancestors.join(' → ')}</p>}

      {childMembers.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-default">Con ({childMembers.length})</h3>
          <ul className="mt-2 space-y-1">
            {childMembers.map((child) => (
              <li key={child.name}>
                <button type="button" onClick={child.onSelect} className="text-sm text-default hover:accent-text">
                  {child.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
