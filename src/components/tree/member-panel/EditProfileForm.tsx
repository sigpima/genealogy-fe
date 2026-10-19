import { useEffect, useRef, useState } from 'react';
import { canBeAdopted } from '@/lib/tree/memberRules';
import { contactError, parseBoundedInt, toNullableText } from '@/lib/tree/profile';
import { looksLikeMapLink } from '@/lib/places/mapLink';
import { MapLinkField } from '@/components/places/MapLinkField';
import type { Place } from '@/lib/places/places';
import { DateFields } from './DateFields';
import { draftFromProfile, parseYear, toInputValue, type ProfileDraft } from './draft';
import { AvatarOrInitial } from './PanelParts';
import { dangerButton, fieldClass, ghostButton, primaryButton } from './styles';
import type { AvatarChange, Gender, MemberUpdateInput, PanelProfile, ParentOption, RestingPlace } from './types';

type EditProfileFormProps = {
  name: string;
  birthYear: number | null;
  deathYear: number | null;
  gender: Gender | null;
  notes: string | null;
  avatarUrl: string | null;
  profile: PanelProfile;
  parentId: number | null;
  parentOptions: ParentOption[];
  motherOptions: ParentOption[];
  restingPlace: RestingPlace | null;
  isSubmitting: boolean;
  onError: (message: string | null) => void;
  /** Resolves true when the change was saved (the panel then closes the form). */
  onSave: (input: MemberUpdateInput, avatar: AvatarChange) => Promise<boolean>;
  onCancel: () => void;
};

/**
 * The profile edit form. It is mounted when editing starts and unmounted when it ends, so every field starts from the
 * person as they are now and a cancelled edit leaves nothing behind.
 */
export function EditProfileForm({
  name,
  birthYear,
  deathYear,
  gender,
  notes,
  avatarUrl,
  profile,
  parentId,
  parentOptions,
  motherOptions,
  restingPlace,
  isSubmitting,
  onError,
  onSave,
  onCancel,
}: EditProfileFormProps) {
  const [editedName, setEditedName] = useState(name);
  const [editedBirthYear, setEditedBirthYear] = useState(toInputValue(birthYear));
  const [editedDeathYear, setEditedDeathYear] = useState(toInputValue(deathYear));
  const [editedGender, setEditedGender] = useState<string>(gender ?? '');
  const [editedNotes, setEditedNotes] = useState(notes ?? '');
  const [editedCourtesyName, setEditedCourtesyName] = useState(profile.courtesyName ?? '');
  const [editedTitle, setEditedTitle] = useState(profile.title ?? '');
  const [editedResidence, setEditedResidence] = useState(profile.residence ?? '');
  const [editedBurialPlace, setEditedBurialPlace] = useState(profile.burialPlace ?? '');
  const [editedMapUrl, setEditedMapUrl] = useState(profile.burialMapUrl ?? '');
  const [editedParentId, setEditedParentId] = useState(toInputValue(parentId));
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromProfile(profile));
  const [placeId, setPlaceId] = useState(toInputValue(profile.burialPlaceId));
  const [plot, setPlot] = useState(profile.burialPlot ?? '');
  const [placeChoices, setPlaceChoices] = useState<Place[]>([]);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  // The places to choose from are only needed while editing.
  useEffect(() => {
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
  }, []);

  // A chosen portrait is previewed through a blob URL: release it when the form goes away.
  const previewRef = useRef<string | null>(null);
  previewRef.current = avatarPreviewUrl;
  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    []
  );

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
    if (!looksLikeMapLink(editedMapUrl)) {
      onError('Link bản đồ phải là link Google Maps (https).');
      return;
    }
    const birthMonth = parseBoundedInt(draft.birthMonth, 1, 12);
    const birthDay = parseBoundedInt(draft.birthDay, 1, 31);
    const deathMonth = parseBoundedInt(draft.deathMonth, 1, 12);
    const deathDay = parseBoundedInt(draft.deathDay, 1, 31);
    const birthOrder = parseBoundedInt(draft.birthOrder, 1, 99);
    if (birthMonth === undefined || deathMonth === undefined) {
      onError('Tháng phải là số từ 1 đến 12.');
      return;
    }
    if (birthDay === undefined || deathDay === undefined) {
      onError('Ngày phải là số từ 1 đến 31.');
      return;
    }
    if (birthOrder === undefined) {
      onError('Thứ tự anh chị em phải là số nguyên từ 1 trở lên.');
      return;
    }
    if ((birthDay !== null && birthMonth === null) || (deathDay !== null && deathMonth === null)) {
      onError('Nhập tháng trước khi nhập ngày.');
      return;
    }
    const contact = contactError(draft.phone, draft.email);
    if (contact) {
      onError(contact);
      return;
    }
    const newParentId = parentOptions.length > 0 ? Number(editedParentId) : parentId;
    // A mother is one of the father's spouses, so changing the father always clears her.
    const motherId = newParentId === parentId && draft.motherId ? Number(draft.motherId) : null;

    await onSave(
      {
        name: editedName.trim(),
        birthYear: parseYear(editedBirthYear),
        deathYear: parseYear(editedDeathYear),
        gender: editedGender ? (editedGender as Gender) : null,
        notes: editedNotes.trim() ? editedNotes.trim() : null,
        courtesyName: toNullableText(editedCourtesyName),
        title: toNullableText(editedTitle),
        residence: toNullableText(editedResidence),
        burialPlace: toNullableText(editedBurialPlace),
        // the position follows the link on the server; old coordinates are kept until the link is cleared
        burialLatitude: profile.burialLatitude,
        burialLongitude: profile.burialLongitude,
        burialMapUrl: toNullableText(editedMapUrl),
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
        isAdopted: canBeAdopted({ parent_id: newParentId }) ? draft.isAdopted : false,
        motherId,
        burialPlaceId: placeId ? Number(placeId) : null,
        burialPlot: toNullableText(plot),
        parentId: newParentId,
      },
      { file: avatarFile, remove: removeAvatar }
    );
  }

  const editAvatarSrc = removeAvatar ? null : (avatarPreviewUrl ?? avatarUrl);
  const canRemoveAvatar = !removeAvatar && Boolean(avatarPreviewUrl || avatarUrl);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-x-3">
        <AvatarOrInitial src={editAvatarSrc} initial={editedName.charAt(0)} size={64} />
        <div className="flex flex-col gap-y-1">
          <input
            type="file"
            accept="image/*"
            aria-label="Chọn ảnh chân dung"
            onChange={handleAvatarFileChange}
            className="text-sm text-muted file:me-3 file:min-h-11 file:cursor-pointer file:rounded-lg file:border file:border-default file:bg-surface file:px-3 file:text-sm file:text-default"
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
      {canBeAdopted({ parent_id: parentOptions.length > 0 ? Number(editedParentId) : parentId }) && (
        <label className="flex min-h-11 items-center gap-x-2 text-sm text-default">
          <input type="checkbox" checked={draft.isAdopted} onChange={(e) => setDraft({ ...draft, isAdopted: e.target.checked })} />
          Con nuôi
        </label>
      )}
      <label className="block">
        <span className="text-xs text-muted">Mộ phần</span>
        <input value={editedBurialPlace} onChange={(e) => setEditedBurialPlace(e.target.value)} maxLength={500} className={fieldClass} />
      </label>
      <MapLinkField label="Link Google Maps của mộ" value={editedMapUrl} onChange={setEditedMapUrl} />
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
        <button type="button" onClick={onCancel} className={ghostButton}>
          Huỷ
        </button>
      </div>
    </div>
  );
}
