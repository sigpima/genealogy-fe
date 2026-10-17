'use client';

import { useEffect, useRef, useState } from 'react';
import { generationTier, toRoman } from '@/lib/tree/generations';
import { lifespanLabel, memberStatus } from '@/lib/tree/member-status';
import { coordinatesFromInputs, formatCoordinates, mapsUrl, toNullableText } from '@/lib/tree/profile';
import type { Gender } from '@/lib/tree/types';

export type MemberDetailPanelChild = {
  name: string;
  onSelect: () => void;
};

export type MutationResult = { ok: boolean; error?: string };
export type AvatarUploadResult = { ok: boolean; error?: string; avatarUrl?: string };

export type PanelProfile = {
  courtesyName: string | null;
  title: string | null;
  residence: string | null;
  burialPlace: string | null;
  burialLatitude: number | null;
  burialLongitude: number | null;
};

export type MemberUpdateInput = PanelProfile & {
  name: string;
  birthYear: number | null;
  deathYear: number | null;
  gender: Gender | null;
  notes: string | null;
  parentId: number | null;
};

export type ParentOption = { id: number; name: string };

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
  /** False = read-only: every edit/add/delete control is hidden. */
  canEdit: boolean;
  name: string;
  generation: number;
  ancestorPath: string[];
  birthYear: number | null;
  deathYear: number | null;
  gender: Gender | null;
  notes: string | null;
  avatarUrl: string | null;
  profile: PanelProfile;
  siblingRank: string | null;
  parentId: number | null;
  parentOptions: ParentOption[];
  childMembers: MemberDetailPanelChild[];
  spouses: PanelSpouse[];
  isDetailLoading: boolean;
  detailLoadError: boolean;
  onRetryLoadDetail: () => void;
  onViewAncestors: () => void;
  onClose: () => void;
  onUpdate: (input: MemberUpdateInput) => Promise<MutationResult>;
  onAddChild: (name: string) => Promise<MutationResult>;
  onDelete: () => Promise<MutationResult>;
  onAddSpouse: (input: SpouseAddInput) => Promise<MutationResult>;
  onUpdateSpouse: (marriageId: number, input: SpouseUpdateInput) => Promise<MutationResult>;
  onDeleteSpouse: (spouseId: number) => Promise<MutationResult>;
  onUploadAvatar: (file: File) => Promise<AvatarUploadResult>;
  onDeleteAvatar: () => Promise<MutationResult>;
};

const GENDER_LABELS: Record<Gender, string> = {
  male: 'Nam',
  female: 'Nữ',
  other: 'Khác',
};

const fieldClass =
  'mt-1 w-full rounded-lg border-default border bg-app px-3 py-2 text-sm text-default placeholder:text-muted focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(197,155,39,0.2)]';
const primaryButton =
  'min-h-11 shrink-0 whitespace-nowrap rounded-lg bg-primary px-4 text-sm font-medium text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';
const ghostButton =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-sm text-muted hover:text-default focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';
const dangerButton =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-sm text-danger hover:underline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';

function toInputValue(value: number | null): string {
  return value === null ? '' : String(value);
}

function parseYear(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
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

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-x-3">
      <dt className="w-20 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-default">{value}</dd>
    </div>
  );
}

function AvatarOrInitial({ src, initial, size }: { src: string | null; initial: string; size: number }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        style={{ width: size, height: size }}
        className="rounded-full object-cover"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="font-display flex items-center justify-center rounded-full bg-primary text-on-primary"
    >
      {initial.toUpperCase() || '?'}
    </div>
  );
}

export function MemberDetailPanel({
  canEdit,
  name,
  generation,
  ancestorPath,
  birthYear,
  deathYear,
  gender,
  notes,
  avatarUrl,
  profile,
  siblingRank,
  parentId,
  parentOptions,
  childMembers,
  spouses,
  isDetailLoading,
  detailLoadError,
  onRetryLoadDetail,
  onViewAncestors,
  onClose,
  onUpdate,
  onAddChild,
  onDelete,
  onAddSpouse,
  onUpdateSpouse,
  onDeleteSpouse,
  onUploadAvatar,
  onDeleteAvatar,
}: MemberDetailPanelProps) {
  const ancestors = ancestorPath.slice(0, -1);

  const [tab, setTab] = useState<'bio' | 'family'>('bio');
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(name);
  const [editedBirthYear, setEditedBirthYear] = useState(toInputValue(birthYear));
  const [editedDeathYear, setEditedDeathYear] = useState(toInputValue(deathYear));
  const [editedGender, setEditedGender] = useState<string>(gender ?? '');
  const [editedNotes, setEditedNotes] = useState(notes ?? '');
  const [editedCourtesyName, setEditedCourtesyName] = useState(profile.courtesyName ?? '');
  const [editedTitle, setEditedTitle] = useState(profile.title ?? '');
  const [editedResidence, setEditedResidence] = useState(profile.residence ?? '');
  const [editedBurialPlace, setEditedBurialPlace] = useState(profile.burialPlace ?? '');
  const [editedLatitude, setEditedLatitude] = useState(profile.burialLatitude === null ? '' : String(profile.burialLatitude));
  const [editedLongitude, setEditedLongitude] = useState(profile.burialLongitude === null ? '' : String(profile.burialLongitude));
  const [editedParentId, setEditedParentId] = useState(toInputValue(parentId));
  const [newChildName, setNewChildName] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  const [editingSpouseId, setEditingSpouseId] = useState<number | null>(null);
  const [spouseDraft, setSpouseDraft] = useState<SpouseDraft | null>(null);
  const [newSpouseName, setNewSpouseName] = useState('');
  const [newSpouseMarriageYear, setNewSpouseMarriageYear] = useState('');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Esc must never throw away typing: ignore it in form fields and while any edit is open.
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select')) return;
      if (isEditing || editingSpouseId !== null) return;
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, isEditing, editingSpouseId]);

  // Below xl the panel is a modal overlay (dimmed backdrop): move focus into it, keep Tab inside it
  // and give focus back to whatever opened it. On desktop it is a plain side panel and focus is left alone.
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

  function resetAvatarDraft() {
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    setAvatarFile(null);
    setAvatarPreviewUrl(null);
    setRemoveAvatar(false);
  }

  function startEditing() {
    setEditedName(name);
    setEditedBirthYear(toInputValue(birthYear));
    setEditedDeathYear(toInputValue(deathYear));
    setEditedGender(gender ?? '');
    setEditedNotes(notes ?? '');
    setEditedCourtesyName(profile.courtesyName ?? '');
    setEditedTitle(profile.title ?? '');
    setEditedResidence(profile.residence ?? '');
    setEditedBurialPlace(profile.burialPlace ?? '');
    setEditedLatitude(profile.burialLatitude === null ? '' : String(profile.burialLatitude));
    setEditedLongitude(profile.burialLongitude === null ? '' : String(profile.burialLongitude));
    setEditedParentId(toInputValue(parentId));
    resetAvatarDraft();
    setIsEditing(true);
  }

  function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    setAvatarFile(file);
    setRemoveAvatar(false);
    setAvatarPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  function handleRemoveAvatarClick() {
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    setAvatarFile(null);
    setAvatarPreviewUrl(null);
    setRemoveAvatar(true);
  }

  async function handleSave() {
    if (!editedName.trim()) return;
    const coordinates = coordinatesFromInputs(editedLatitude, editedLongitude);
    if (!coordinates.ok) {
      setActionError(coordinates.error);
      return;
    }
    setIsSubmitting(true);
    setActionError(null);

    if (removeAvatar) {
      const avatarResult = await onDeleteAvatar();
      if (!avatarResult.ok) {
        setIsSubmitting(false);
        setActionError(avatarResult.error ?? 'Không thể xoá ảnh. Vui lòng thử lại.');
        return;
      }
    } else if (avatarFile) {
      const avatarResult = await onUploadAvatar(avatarFile);
      if (!avatarResult.ok) {
        setIsSubmitting(false);
        setActionError(avatarResult.error ?? 'Không thể tải ảnh lên. Vui lòng thử lại.');
        return;
      }
    }

    const result = await onUpdate({
      name: editedName.trim(),
      birthYear: parseYear(editedBirthYear),
      deathYear: parseYear(editedDeathYear),
      gender: editedGender ? (editedGender as Gender) : null,
      notes: editedNotes.trim() ? editedNotes.trim() : null,
      courtesyName: toNullableText(editedCourtesyName),
      title: toNullableText(editedTitle),
      residence: toNullableText(editedResidence),
      burialPlace: toNullableText(editedBurialPlace),
      burialLatitude: coordinates.latitude,
      burialLongitude: coordinates.longitude,
      parentId: parentOptions.length > 0 ? Number(editedParentId) : parentId,
    });
    setIsSubmitting(false);
    if (result.ok) {
      setIsEditing(false);
      resetAvatarDraft();
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

  const lifespan = lifespanLabel(birthYear, deathYear);
  const status = memberStatus(birthYear, deathYear);
  const tier = generationTier(generation);
  const editAvatarSrc = removeAvatar ? null : (avatarPreviewUrl ?? avatarUrl);
  const canRemoveAvatar = !removeAvatar && Boolean(avatarPreviewUrl || avatarUrl);
  const detailReady = !isDetailLoading && !detailLoadError;
  const hasProfileInfo = Boolean(
    profile.courtesyName || profile.title || profile.residence || profile.burialPlace || profile.burialLatitude !== null
  );

  return (
    <>
      <div
        className="fixed inset-0 z-30 bg-black/30 xl:hidden"
        onClick={() => {
          // A stray tap on the backdrop must not throw away an edit in progress.
          if (isEditing || editingSpouseId !== null) return;
          onClose();
        }}
        aria-hidden="true"
      />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="complementary"
        aria-label={`Hồ sơ ${name}`}
        className="shadow-float fixed inset-x-0 bottom-0 z-40 flex max-h-[90vh] flex-col outline-none overflow-hidden rounded-t-2xl border-default border-t bg-surface md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[400px] md:rounded-none md:border-l md:border-t-0"
      >
        <div className="flex items-center justify-between px-5 pt-4">
          <span
            className="rounded px-2.5 py-1 text-[11px] font-semibold tracking-wide"
            style={{ backgroundColor: `var(--color-tier-${tier})`, color: `var(--color-on-tier-${tier})` }}
          >
            ĐỜI {toRoman(generation)}
          </span>
          {siblingRank && <span className="ms-2 me-auto text-xs font-medium text-muted">{siblingRank}</span>}
          <button type="button" onClick={onClose} className={`${ghostButton} -me-2`}>
            Đóng <span aria-hidden="true">✕</span>
          </button>
        </div>

        <div className="flex items-center gap-x-4 px-5 pb-4 pt-3">
          <AvatarOrInitial src={avatarUrl} initial={name.charAt(0)} size={72} />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-bold text-default">{name}</h2>
            {(profile.courtesyName || profile.title) && (
              <p className="mt-0.5 text-sm text-muted">
                {profile.courtesyName && <>Tự: {profile.courtesyName}</>}
                {profile.courtesyName && profile.title && ' · '}
                {profile.title}
              </p>
            )}
            {isDetailLoading && <p className="mt-1 text-sm text-muted">Đang tải chi tiết...</p>}
            {detailLoadError && (
              <p className="mt-1 text-sm text-danger">
                Không thể tải chi tiết.{' '}
                <button type="button" onClick={onRetryLoadDetail} className="underline">
                  Thử lại
                </button>
              </p>
            )}
            {detailReady && (
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                {status === 'living' && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{ backgroundColor: 'var(--color-living)', color: 'var(--color-on-living)' }}
                  >
                    Đang sống
                  </span>
                )}
                {lifespan && <span>{lifespan}</span>}
                {gender && <span>· {GENDER_LABELS[gender]}</span>}
              </div>
            )}
          </div>
        </div>

        <div role="tablist" aria-label="Nội dung hồ sơ" className="flex border-default border-b px-5">
          {(
            [
              ['bio', 'Tiểu sử'],
              ['family', 'Hôn phối & con'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`panel-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={tab === id ? `panel-tabpanel-${id}` : undefined}
              onClick={() => setTab(id)}
              className={`min-h-11 border-b-2 px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] ${
                tab === id ? 'border-[var(--color-primary)] text-primary' : 'border-transparent text-muted hover:text-default'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`panel-tabpanel-${tab}`}
          aria-labelledby={`panel-tab-${tab}`}
          className="flex-1 overflow-y-auto px-5 py-4"
        >
          {actionError && <p className="mb-4 text-sm text-danger">{actionError}</p>}

          {tab === 'bio' && (
            <>
              {isEditing ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-x-3">
                    <AvatarOrInitial src={editAvatarSrc} initial={editedName.charAt(0)} size={64} />
                    <div className="flex flex-col gap-y-1">
                      <input
                        type="file"
                        accept="image/*"
                        aria-label="Chọn ảnh chân dung"
                        onChange={handleAvatarFileChange}
                        className="text-xs text-muted"
                      />
                      {canRemoveAvatar && (
                        <button type="button" onClick={handleRemoveAvatarClick} className={`${dangerButton} text-left`}>
                          Xoá ảnh
                        </button>
                      )}
                    </div>
                  </div>
                  <label className="block">
                    <span className="text-xs text-muted">Họ tên</span>
                    <input value={editedName} onChange={(e) => setEditedName(e.target.value)} className={fieldClass} />
                  </label>
                  {parentOptions.length > 0 && (
                    <label className="block">
                      <span className="text-xs text-muted">Cha/Mẹ</span>
                      <select value={editedParentId} onChange={(e) => setEditedParentId(e.target.value)} className={fieldClass}>
                        {parentOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div className="flex gap-x-2">
                    <label className="block flex-1">
                      <span className="text-xs text-muted">Năm sinh</span>
                      <input type="number" value={editedBirthYear} onChange={(e) => setEditedBirthYear(e.target.value)} className={fieldClass} />
                    </label>
                    <label className="block flex-1">
                      <span className="text-xs text-muted">Năm mất</span>
                      <input type="number" value={editedDeathYear} onChange={(e) => setEditedDeathYear(e.target.value)} className={fieldClass} />
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-xs text-muted">Giới tính</span>
                    <select value={editedGender} onChange={(e) => setEditedGender(e.target.value)} className={fieldClass}>
                      <option value="">Không rõ</option>
                      <option value="male">Nam</option>
                      <option value="female">Nữ</option>
                      <option value="other">Khác</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs text-muted">Tên tự</span>
                    <input value={editedCourtesyName} onChange={(e) => setEditedCourtesyName(e.target.value)} maxLength={100} className={fieldClass} />
                  </label>
                  <label className="block">
                    <span className="text-xs text-muted">Chức vị / tước vị</span>
                    <input value={editedTitle} onChange={(e) => setEditedTitle(e.target.value)} maxLength={150} className={fieldClass} />
                  </label>
                  <label className="block">
                    <span className="text-xs text-muted">Nơi ở / quê quán</span>
                    <input value={editedResidence} onChange={(e) => setEditedResidence(e.target.value)} maxLength={255} className={fieldClass} />
                  </label>
                  <label className="block">
                    <span className="text-xs text-muted">Mộ phần</span>
                    <input value={editedBurialPlace} onChange={(e) => setEditedBurialPlace(e.target.value)} maxLength={500} className={fieldClass} />
                  </label>
                  <div className="flex gap-x-2">
                    <label className="block flex-1">
                      <span className="text-xs text-muted">Vĩ độ mộ</span>
                      <input inputMode="decimal" value={editedLatitude} onChange={(e) => setEditedLatitude(e.target.value)} placeholder="21.0285" className={fieldClass} />
                    </label>
                    <label className="block flex-1">
                      <span className="text-xs text-muted">Kinh độ mộ</span>
                      <input inputMode="decimal" value={editedLongitude} onChange={(e) => setEditedLongitude(e.target.value)} placeholder="105.8542" className={fieldClass} />
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-xs text-muted">Ghi chú</span>
                    <textarea value={editedNotes} onChange={(e) => setEditedNotes(e.target.value)} rows={4} className={fieldClass} />
                  </label>
                  <div className="flex items-center gap-x-2">
                    <button type="button" onClick={handleSave} disabled={isSubmitting} className={primaryButton}>
                      Lưu
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        resetAvatarDraft();
                        setIsEditing(false);
                      }}
                      className={ghostButton}
                    >
                      Huỷ
                    </button>
                  </div>
                </div>
              ) : (
                <section>
                  {detailReady && hasProfileInfo && (
                    <dl className="mb-5 space-y-2 text-sm">
                      {profile.courtesyName && <InfoRow label="Tên tự" value={profile.courtesyName} />}
                      {profile.title && <InfoRow label="Chức vị" value={profile.title} />}
                      {profile.residence && <InfoRow label="Nơi ở" value={profile.residence} />}
                      {(profile.burialPlace || profile.burialLatitude !== null) && (
                        <InfoRow
                          label="Mộ phần"
                          value={
                            <>
                              {profile.burialPlace}
                              {profile.burialLatitude !== null && profile.burialLongitude !== null && (
                                <>
                                  {profile.burialPlace && <br />}
                                  <a
                                    href={mapsUrl(profile.burialLatitude, profile.burialLongitude)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="accent-text underline"
                                  >
                                    {formatCoordinates(profile.burialLatitude, profile.burialLongitude)} · Xem bản đồ
                                  </a>
                                </>
                              )}
                            </>
                          }
                        />
                      )}
                    </dl>
                  )}
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Hành trạng &amp; công đức</h3>
                    {detailReady && canEdit && (
                      <button type="button" onClick={startEditing} className={ghostButton}>
                        Sửa
                      </button>
                    )}
                  </div>
                  <div className="mt-2 rounded-lg bg-surface-muted p-4 text-sm leading-6 text-default">
                    {detailReady && notes ? (
                      <p className="whitespace-pre-wrap">{notes}</p>
                    ) : (
                      <p className="text-muted">{detailReady ? 'Chưa có ghi chú.' : 'Đang chờ dữ liệu...'}</p>
                    )}
                  </div>
                </section>
              )}

              {ancestors.length > 0 && (
                <section className="mt-6">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Dòng tổ tiên</h3>
                  <p className="mt-2 text-xs leading-5 text-muted">{ancestors.join(' → ')}</p>
                  <button type="button" onClick={onViewAncestors} className={`${ghostButton} mt-1 -ms-2`}>
                    Xem tổ tiên 4 đời
                  </button>
                </section>
              )}

              {canEdit && (
                <button type="button" onClick={handleDelete} disabled={isSubmitting} className={`${dangerButton} mt-6 -ms-2`}>
                  Xoá thành viên
                </button>
              )}
            </>
          )}

          {tab === 'family' && (
            <>
              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Vợ/chồng ({spouses.length})</h3>
                {isDetailLoading && <p className="mt-2 text-sm text-muted">Đang tải...</p>}
                {detailLoadError && <p className="mt-2 text-sm text-muted">Không thể tải.</p>}
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
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSpouseId(null);
                                setSpouseDraft(null);
                              }}
                              className={ghostButton}
                            >
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
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      value={newSpouseName}
                      onChange={(e) => setNewSpouseName(e.target.value)}
                      placeholder="Tên vợ/chồng..."
                      aria-label="Tên vợ/chồng mới"
                      className={`${fieldClass} min-w-40 flex-1`}
                    />
                    <input
                      type="number"
                      value={newSpouseMarriageYear}
                      onChange={(e) => setNewSpouseMarriageYear(e.target.value)}
                      placeholder="Năm cưới"
                      aria-label="Năm cưới"
                      className={`${fieldClass} w-28 shrink-0`}
                    />
                    <button type="button" onClick={handleAddSpouse} disabled={isSubmitting || !newSpouseName.trim()} className={primaryButton}>
                      Thêm
                    </button>
                  </div>
                )}
              </section>

              <section className="mt-6">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Con ({childMembers.length})</h3>
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
                      Thêm con
                    </button>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
