'use client';

import { useEffect, useRef, useState } from 'react';
import { generationTier, toRoman } from '@/lib/tree/generations';
import { formatPartialDate, hasDayOrMonth, maxDayFor } from '@/lib/tree/dates';
import { lifespanLabel, memberStatus } from '@/lib/tree/member-status';
import {
  contactError,
  coordinatesFromInputs,
  formatCoordinates,
  mapsUrl,
  parseBoundedInt,
  toNullableText,
} from '@/lib/tree/profile';
import Link from 'next/link';
import { ProposeDialog } from '@/components/requests/ProposeDialog';
import type { BranchRef } from '@/lib/branches/branches';
import { formFromPanel } from '@/lib/requests/requests';
import { MediaGallery } from '@/components/media/MediaGallery';
import { wordHint, type ArticleSummary, type GenerationWord } from '@/lib/chronicles/chronicles';
import { directionsUrl } from '@/lib/places/places';
import type { Place } from '@/lib/places/places';
import type { Gender, PanelProfile, RestingPlace } from '@/lib/tree/types';

export type { PanelProfile };

export type MemberDetailPanelChild = {
  name: string;
  onSelect: () => void;
};

export type MutationResult = { ok: boolean; error?: string };
export type AvatarUploadResult = { ok: boolean; error?: string; avatarUrl?: string };

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
  memberId: number;
  /** False = read-only: every edit/add/delete control is hidden. */
  canEdit: boolean;
  /** A signed-in non-admin may propose a change instead (an admin reviews it). */
  canPropose?: boolean;
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
  /** The member's chi/phái, if any. */
  branch: BranchRef | null;
  /** The place record where the person rests (signed-in users only). */
  restingPlace?: RestingPlace | null;
  /** Not a guest: the gallery is only for signed-in users. */
  signedIn?: boolean;
  parentId: number | null;
  parentOptions: ParentOption[];
  /** The father's recorded spouses: the only valid choices for "Mẹ". */
  motherOptions: ParentOption[];
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

/** Text/boolean mirror of the profile fields that the edit form binds to. */
type ProfileDraft = {
  hometown: string;
  phone: string;
  email: string;
  birthMonth: string;
  birthDay: string;
  birthIsLunar: boolean;
  birthLeapMonth: boolean;
  deathMonth: string;
  deathDay: string;
  deathIsLunar: boolean;
  deathLeapMonth: boolean;
  birthOrder: string;
  isAdopted: boolean;
  motherId: string;
};

function draftFromProfile(profile: PanelProfile): ProfileDraft {
  return {
    hometown: profile.hometown ?? '',
    phone: profile.phone ?? '',
    email: profile.email ?? '',
    birthMonth: toInputValue(profile.birthMonth),
    birthDay: toInputValue(profile.birthDay),
    birthIsLunar: profile.birthIsLunar,
    birthLeapMonth: profile.birthLeapMonth,
    deathMonth: toInputValue(profile.deathMonth),
    deathDay: toInputValue(profile.deathDay),
    deathIsLunar: profile.deathIsLunar,
    deathLeapMonth: profile.deathLeapMonth,
    birthOrder: toInputValue(profile.birthOrder),
    isAdopted: profile.isAdopted,
    motherId: toInputValue(profile.motherId),
  };
}

type DateFieldsProps = {
  label: string;
  year: string;
  month: string;
  day: string;
  isLunar: boolean;
  leapMonth: boolean;
  onChange: (patch: { month?: string; day?: string; isLunar?: boolean; leapMonth?: boolean }) => void;
};

/** Month/day (the year is the field above) plus the calendar: a lunar date is what a giỗ is kept by. */
function DateFields({ label, year, month, day, isLunar, leapMonth, onChange }: DateFieldsProps) {
  const monthValue = parseBoundedInt(month, 1, 12);
  const yearValue = parseBoundedInt(year, 1, 9999);
  const maxDay = maxDayFor(monthValue ?? null, isLunar, yearValue ?? null);
  return (
    <fieldset className="rounded-lg border-default border p-3">
      <legend className="px-1 text-xs text-muted">{label}</legend>
      <div className="flex gap-x-2">
        <label className="block flex-1">
          <span className="text-xs text-muted">Tháng</span>
          <input
            type="number"
            min={1}
            max={12}
            value={month}
            onChange={(e) => onChange({ month: e.target.value })}
            className={fieldClass}
          />
        </label>
        <label className="block flex-1">
          <span className="text-xs text-muted">Ngày</span>
          <input
            type="number"
            min={1}
            max={maxDay}
            value={day}
            onChange={(e) => onChange({ day: e.target.value })}
            className={fieldClass}
          />
        </label>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-default">
        <label className="flex min-h-11 items-center gap-x-2">
          <input type="checkbox" checked={isLunar} onChange={(e) => onChange({ isLunar: e.target.checked })} />
          Âm lịch
        </label>
        {isLunar && month.trim() !== '' && (
          <label className="flex min-h-11 items-center gap-x-2">
            <input type="checkbox" checked={leapMonth} onChange={(e) => onChange({ leapMonth: e.target.checked })} />
            Tháng nhuận
          </label>
        )}
      </div>
    </fieldset>
  );
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
  memberId,
  canEdit,
  canPropose = false,
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
  branch,
  restingPlace = null,
  signedIn = false,
  parentId,
  parentOptions,
  motherOptions,
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
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromProfile(profile));
  const [newChildName, setNewChildName] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProposing, setIsProposing] = useState(false);
  const [placeId, setPlaceId] = useState(toInputValue(profile.burialPlaceId));
  const [plot, setPlot] = useState(profile.burialPlot ?? '');
  const [placeChoices, setPlaceChoices] = useState<Place[]>([]);
  const [mentions, setMentions] = useState<ArticleSummary[]>([]);
  const [poem, setPoem] = useState<GenerationWord[]>([]);

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
      // A dialog on top of the panel (photo viewer, propose-an-edit) owns Esc: it closes itself, the panel stays.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
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

  // "Được nhắc trong…": published articles that mention this person (a failure just shows nothing).
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/members/${memberId}/articles`, { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<ArticleSummary[]>) : []))
      .then((rows) => {
        if (!cancelled) setMentions(rows);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  // The bài đệm is only used to hint a new child's middle name, which only admins add.
  useEffect(() => {
    if (!canEdit) return;
    let cancelled = false;
    fetch('/api/generation-poem', { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<GenerationWord[]>) : []))
      .then((rows) => {
        if (!cancelled) setPoem(rows);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [canEdit]);

  // The places to choose from are only needed while an admin edits.
  useEffect(() => {
    if (!isEditing || !canEdit) return;
    let cancelled = false;
    fetch('/api/places', { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<Place[]>) : []))
      .then((rows) => {
        if (!cancelled) setPlaceChoices(rows);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isEditing, canEdit]);

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
    setDraft(draftFromProfile(profile));
    setPlaceId(toInputValue(profile.burialPlaceId));
    setPlot(profile.burialPlot ?? '');
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
    const birthMonth = parseBoundedInt(draft.birthMonth, 1, 12);
    const birthDay = parseBoundedInt(draft.birthDay, 1, 31);
    const deathMonth = parseBoundedInt(draft.deathMonth, 1, 12);
    const deathDay = parseBoundedInt(draft.deathDay, 1, 31);
    const birthOrder = parseBoundedInt(draft.birthOrder, 1, 99);
    if (birthMonth === undefined || deathMonth === undefined) {
      setActionError('Tháng phải là số từ 1 đến 12.');
      return;
    }
    if (birthDay === undefined || deathDay === undefined) {
      setActionError('Ngày phải là số từ 1 đến 31.');
      return;
    }
    if (birthOrder === undefined) {
      setActionError('Thứ tự anh chị em phải là số nguyên từ 1 trở lên.');
      return;
    }
    if ((birthDay !== null && birthMonth === null) || (deathDay !== null && deathMonth === null)) {
      setActionError('Nhập tháng trước khi nhập ngày.');
      return;
    }
    const contact = contactError(draft.phone, draft.email);
    if (contact) {
      setActionError(contact);
      return;
    }
    const newParentId = parentOptions.length > 0 ? Number(editedParentId) : parentId;
    // A mother is one of the father's spouses, so changing the father always clears her.
    const motherId = newParentId === parentId && draft.motherId ? Number(draft.motherId) : null;
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
      hometown: toNullableText(draft.hometown),
      phone: toNullableText(draft.phone),
      email: toNullableText(draft.email),
      birthMonth,
      birthDay: birthMonth === null ? null : birthDay,
      birthIsLunar: draft.birthIsLunar,
      birthLeapMonth: draft.birthIsLunar && birthMonth !== null && draft.birthLeapMonth,
      deathMonth,
      deathDay: deathMonth === null ? null : deathDay,
      deathIsLunar: draft.deathIsLunar,
      deathLeapMonth: draft.deathIsLunar && deathMonth !== null && draft.deathLeapMonth,
      birthOrder,
      isAdopted: draft.isAdopted,
      motherId,
      burialPlaceId: placeId ? Number(placeId) : null,
      burialPlot: toNullableText(plot),
      parentId: newParentId,
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
  const birthDate = formatPartialDate({
    year: birthYear,
    month: profile.birthMonth,
    day: profile.birthDay,
    isLunar: profile.birthIsLunar,
    leapMonth: profile.birthLeapMonth,
  });
  const deathDate = formatPartialDate({
    year: deathYear,
    month: profile.deathMonth,
    day: profile.deathDay,
    isLunar: profile.deathIsLunar,
    leapMonth: profile.deathLeapMonth,
  });
  const showBirthDate = hasDayOrMonth({ month: profile.birthMonth, day: profile.birthDay });
  const showDeathDate = hasDayOrMonth({ month: profile.deathMonth, day: profile.deathDay });
  const motherName = profile.motherId === null ? null : (motherOptions.find((o) => o.id === profile.motherId)?.name ?? null);
  const hasProfileInfo = Boolean(
    profile.courtesyName ||
      profile.title ||
      profile.residence ||
      profile.hometown ||
      profile.phone ||
      profile.email ||
      profile.burialPlace ||
      profile.burialLatitude !== null ||
      showBirthDate ||
      showDeathDate ||
      branch !== null ||
      restingPlace !== null ||
      Boolean(profile.burialPlot) ||
      profile.birthOrder !== null ||
      profile.isAdopted ||
      motherName
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
          {actionError && (
            <p role="alert" className="mb-4 text-sm text-danger">
              {actionError}
            </p>
          )}

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
                  <DateFields
                    label="Ngày sinh (ngoài năm)"
                    year={editedBirthYear}
                    month={draft.birthMonth}
                    day={draft.birthDay}
                    isLunar={draft.birthIsLunar}
                    leapMonth={draft.birthLeapMonth}
                    onChange={(patch) =>
                      setDraft((d) => ({
                        ...d,
                        ...(patch.month !== undefined && { birthMonth: patch.month }),
                        ...(patch.day !== undefined && { birthDay: patch.day }),
                        ...(patch.isLunar !== undefined && { birthIsLunar: patch.isLunar }),
                        ...(patch.leapMonth !== undefined && { birthLeapMonth: patch.leapMonth }),
                      }))
                    }
                  />
                  <DateFields
                    label="Ngày mất / ngày giỗ (ngoài năm)"
                    year={editedDeathYear}
                    month={draft.deathMonth}
                    day={draft.deathDay}
                    isLunar={draft.deathIsLunar}
                    leapMonth={draft.deathLeapMonth}
                    onChange={(patch) =>
                      setDraft((d) => ({
                        ...d,
                        ...(patch.month !== undefined && { deathMonth: patch.month }),
                        ...(patch.day !== undefined && { deathDay: patch.day }),
                        ...(patch.isLunar !== undefined && { deathIsLunar: patch.isLunar }),
                        ...(patch.leapMonth !== undefined && { deathLeapMonth: patch.leapMonth }),
                      }))
                    }
                  />
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
                    <span className="text-xs text-muted">Quê quán</span>
                    <input value={draft.hometown} onChange={(e) => setDraft({ ...draft, hometown: e.target.value })} maxLength={255} className={fieldClass} />
                  </label>
                  <label className="block">
                    <span className="text-xs text-muted">Nơi ở</span>
                    <input value={editedResidence} onChange={(e) => setEditedResidence(e.target.value)} maxLength={255} className={fieldClass} />
                  </label>
                  <div className="flex gap-x-2">
                    <label className="block flex-1">
                      <span className="text-xs text-muted">Điện thoại</span>
                      <input
                        type="tel"
                        value={draft.phone}
                        onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                        maxLength={30}
                        className={fieldClass}
                      />
                    </label>
                    <label className="block flex-1">
                      <span className="text-xs text-muted">Email</span>
                      <input
                        type="email"
                        value={draft.email}
                        onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                        maxLength={255}
                        className={fieldClass}
                      />
                    </label>
                  </div>
                  <p className="-mt-1 text-xs text-muted">Điện thoại và email chỉ hiện với người đã đăng nhập.</p>
                  <div className="flex gap-x-2">
                    <label className="block flex-1">
                      <span className="text-xs text-muted">Con thứ (trong anh chị em)</span>
                      <input
                        type="number"
                        min={1}
                        value={draft.birthOrder}
                        onChange={(e) => setDraft({ ...draft, birthOrder: e.target.value })}
                        placeholder="Tự theo năm sinh"
                        className={fieldClass}
                      />
                    </label>
                    {motherOptions.length > 0 && Number(editedParentId) === parentId && (
                      <label className="block flex-1">
                        <span className="text-xs text-muted">Mẹ</span>
                        <select value={draft.motherId} onChange={(e) => setDraft({ ...draft, motherId: e.target.value })} className={fieldClass}>
                          <option value="">Không rõ</option>
                          {motherOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                  <label className="flex min-h-11 items-center gap-x-2 text-sm text-default">
                    <input type="checkbox" checked={draft.isAdopted} onChange={(e) => setDraft({ ...draft, isAdopted: e.target.checked })} />
                    Con nuôi
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
                    <span className="text-xs text-muted">Nơi an nghỉ (địa điểm đã tạo ở mục Địa điểm)</span>
                    <select value={placeId} onChange={(e) => setPlaceId(e.target.value)} aria-label="Nơi an nghỉ" className={fieldClass}>
                      <option value="">Chưa chọn</option>
                      {placeChoices.map((choice) => (
                        <option key={choice.id} value={choice.id}>
                          {choice.name}
                        </option>
                      ))}
                      {placeId && !placeChoices.some((c) => String(c.id) === placeId) && <option value={placeId}>{restingPlace?.name ?? `#${placeId}`}</option>}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs text-muted">Vị trí mộ (khu, hàng, số)</span>
                    <input value={plot} onChange={(e) => setPlot(e.target.value)} maxLength={100} aria-label="Vị trí mộ" className={fieldClass} />
                  </label>
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
                      {showBirthDate && <InfoRow label="Ngày sinh" value={birthDate} />}
                      {showDeathDate && <InfoRow label="Ngày mất" value={deathDate} />}
                      {branch && (
                        <InfoRow
                          label="Thuộc chi"
                          value={
                            <span className="inline-flex items-center gap-x-2">
                              <span aria-hidden="true" className="inline-block size-3 rounded-full" style={{ backgroundColor: branch.color }} />
                              {branch.name}
                            </span>
                          }
                        />
                      )}
                      {(restingPlace || profile.burialPlot) && (
                        <InfoRow
                          label="An nghỉ"
                          value={
                            <>
                              {restingPlace && (
                                <Link href={`/dia-diem?place=${restingPlace.id}`} className="accent-text underline">
                                  {restingPlace.name}
                                </Link>
                              )}
                              {restingPlace && profile.burialPlot && ' · '}
                              {profile.burialPlot}
                              {restingPlace && restingPlace.latitude !== null && restingPlace.longitude !== null && (
                                <>
                                  <br />
                                  <a
                                    href={directionsUrl(restingPlace.latitude, restingPlace.longitude)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="accent-text underline"
                                  >
                                    Chỉ đường
                                  </a>
                                </>
                              )}
                            </>
                          }
                        />
                      )}
                      {profile.hometown && <InfoRow label="Quê quán" value={profile.hometown} />}
                      {profile.residence && <InfoRow label="Nơi ở" value={profile.residence} />}
                      {motherName && <InfoRow label="Mẹ" value={motherName} />}
                      {(profile.birthOrder !== null || profile.isAdopted) && (
                        <InfoRow
                          label="Thứ bậc"
                          value={[profile.birthOrder !== null ? `Con thứ ${profile.birthOrder}` : null, profile.isAdopted ? 'Con nuôi' : null]
                            .filter(Boolean)
                            .join(' · ')}
                        />
                      )}
                      {profile.phone && (
                        <InfoRow
                          label="Điện thoại"
                          value={
                            <a href={`tel:${profile.phone.replace(/[^0-9+]/g, '')}`} className="accent-text underline">
                              {profile.phone}
                            </a>
                          }
                        />
                      )}
                      {profile.email && (
                        <InfoRow
                          label="Email"
                          value={
                            <a href={`mailto:${profile.email}`} className="accent-text underline">
                              {profile.email}
                            </a>
                          }
                        />
                      )}
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
                      <div className="flex items-center">
                        <Link href={`/nhat-ky?member=${memberId}`} className={`${ghostButton} flex items-center`}>
                          Lịch sử
                        </Link>
                        <button type="button" onClick={startEditing} className={ghostButton}>
                          Sửa
                        </button>
                      </div>
                    )}
                    {detailReady && !canEdit && canPropose && (
                      <button type="button" onClick={() => setIsProposing(true)} className={ghostButton}>
                        Đề xuất chỉnh sửa
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

              {signedIn && detailReady && (
                <section className="mt-6" aria-label="Tư liệu và bút tích">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Tư liệu &amp; bút tích</h3>
                  <MediaGallery ownerKind="members" ownerId={memberId} canEdit={canEdit} />
                </section>
              )}

              {mentions.length > 0 && (
                <section className="mt-6" aria-label="Được nhắc trong">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Được nhắc trong</h3>
                  <ul className="mt-2 space-y-1">
                    {mentions.map((a) => (
                      <li key={a.id}>
                        <Link href={`/su-ky/${a.slug}`} className="text-sm text-primary underline">
                          {a.title}
                        </Link>
                        {a.status === 'draft' && <span className="ms-2 text-xs text-muted">(bản nháp)</span>}
                      </li>
                    ))}
                  </ul>
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
                {canEdit && wordHint(poem, generation + 1) && (
                  <p className="mt-1 text-xs text-muted">{wordHint(poem, generation + 1)}</p>
                )}
              </section>
            </>
          )}
        </div>
      </aside>
      {isProposing && (
        <ProposeDialog
          memberId={memberId}
          memberName={name}
          initial={formFromPanel(name, { birthYear, deathYear, gender, notes, profile })}
          onClose={() => setIsProposing(false)}
        />
      )}
    </>
  );
}
