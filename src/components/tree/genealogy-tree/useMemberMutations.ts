import type { Dispatch, SetStateAction } from 'react';
import type {
  AvatarUploadResult,
  MemberUpdateInput,
  MutationResult,
  SpouseAddInput,
  SpouseUpdateInput,
} from '@/components/tree/MemberDetailPanel';
import { profileToPayload, toPanelProfile } from '@/lib/tree/profile';
import type { MemberDetail, Spouse } from '@/lib/tree/types';
import { toPanelSpouses, type SelectedMember } from './selectedMember';

type MemberMutationDeps = {
  selectedMember: SelectedMember | null;
  setSelectedMember: Dispatch<SetStateAction<SelectedMember | null>>;
  setCollapsedIds: Dispatch<SetStateAction<Set<number>>>;
  detailsById: Map<number, MemberDetail>;
  patchMemberDetail: (id: number, patch: Partial<Omit<MemberDetail, 'id'>>) => void;
  refetchDetails: (alsoMemberId?: number) => void;
  onDataChanged: () => void;
};

/**
 * Everything the panel can change about the open person (profile, children, spouses, portrait, deletion): each call
 * talks to the API, then brings the open panel, the details cache and the tree up to date.
 */
export function useMemberMutations({
  selectedMember,
  setSelectedMember,
  setCollapsedIds,
  detailsById,
  patchMemberDetail,
  refetchDetails,
  onDataChanged,
}: MemberMutationDeps) {
  async function handleUpdateMember(input: MemberUpdateInput): Promise<MutationResult> {
    if (!selectedMember) return { ok: false, error: 'Không tìm thấy thành viên.' };
    try {
      const response = await fetch(`/api/members/${selectedMember.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: input.name,
          parent_id: input.parentId,
          birth_year: input.birthYear,
          death_year: input.deathYear,
          gender: input.gender,
          notes: input.notes,
          ...profileToPayload(input),
        }),
      });
      if (!response.ok) {
        if (response.status === 400) {
          return { ok: false, error: 'Không thể lưu: cha/mẹ không hợp lệ (vòng lặp trong cây, hoặc mẹ không phải vợ của cha).' };
        }
        if (response.status === 422) {
          return { ok: false, error: 'Dữ liệu chưa hợp lệ: kiểm tra ngày tháng, điện thoại, email.' };
        }
        return { ok: false, error: 'Không thể lưu. Vui lòng thử lại.' };
      }

      // the server may derive the burial position from the Google Maps link, so take those fields from its answer
      const saved = (await response.json().catch(() => null)) as {
        burial_latitude?: number | null;
        burial_longitude?: number | null;
        burial_map_url?: string | null;
      } | null;
      const savedProfile = {
        ...profileToPayload(input),
        ...(saved
          ? {
              burial_latitude: saved.burial_latitude ?? null,
              burial_longitude: saved.burial_longitude ?? null,
              burial_map_url: saved.burial_map_url ?? null,
            }
          : {}),
      };
      patchMemberDetail(selectedMember.id, {
        birth_year: input.birthYear,
        death_year: input.deathYear,
        gender: input.gender,
        notes: input.notes,
        ...savedProfile,
      });

      if (input.parentId !== selectedMember.parentId) {
        // Re-parenting changes this member's position in the tree, so ancestorPath and
        // generation would be stale if the panel stayed open - close it instead and let
        // onDataChanged()'s refetch reflect the new structure the next time it's opened.
        setSelectedMember(null);
        refetchDetails();
        onDataChanged();
        return { ok: true };
      }

      // ancestorPath's last entry is this member's own (old) name - update it too, or
      // handleSelectChild's name-based path lookup would silently fail for any child
      // navigated to after a rename.
      const newAncestorPath = [...selectedMember.ancestorPath.slice(0, -1), input.name];
      setSelectedMember((prev) =>
        prev
          ? {
              ...prev,
              name: input.name,
              ancestorPath: newAncestorPath,
              birthYear: input.birthYear,
              deathYear: input.deathYear,
              gender: input.gender,
              notes: input.notes,
              profile: toPanelProfile(savedProfile),
            }
          : prev
      );
      refetchDetails(selectedMember.id);
      onDataChanged();
      return { ok: true };
    } catch {
      return { ok: false, error: 'Không thể kết nối tới máy chủ.' };
    }
  }

  async function handleAddChildMember(childName: string): Promise<MutationResult> {
    if (!selectedMember) return { ok: false, error: 'Không tìm thấy thành viên.' };
    try {
      const response = await fetch('/api/members', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: childName, parent_id: selectedMember.id }),
      });
      if (!response.ok) return { ok: false, error: 'Không thể thêm. Vui lòng thử lại.' };
      setSelectedMember((prev) =>
        prev ? { ...prev, childrenNames: [...prev.childrenNames, childName] } : prev
      );
      const parentId = selectedMember.id;
      setCollapsedIds((prev) => {
        if (!prev.has(parentId)) return prev;
        const next = new Set(prev);
        next.delete(parentId);
        return next;
      });
      refetchDetails(selectedMember.id);
      onDataChanged();
      return { ok: true };
    } catch {
      return { ok: false, error: 'Không thể kết nối tới máy chủ.' };
    }
  }

  async function handleDeleteMember(): Promise<MutationResult> {
    if (!selectedMember) return { ok: false, error: 'Không tìm thấy thành viên.' };
    try {
      const response = await fetch(`/api/members/${selectedMember.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (response.status === 409) {
        return { ok: false, error: 'Không thể xoá vì còn con. Hãy xoá hoặc chuyển con trước.' };
      }
      if (!response.ok) return { ok: false, error: 'Không thể xoá. Vui lòng thử lại.' };
      setSelectedMember(null);
      refetchDetails();
      onDataChanged();
      return { ok: true };
    } catch {
      return { ok: false, error: 'Không thể kết nối tới máy chủ.' };
    }
  }

  async function handleAddSpouse(input: SpouseAddInput): Promise<MutationResult> {
    if (!selectedMember) return { ok: false, error: 'Không tìm thấy thành viên.' };
    try {
      const response = await fetch(`/api/members/${selectedMember.id}/marriages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spouse_full_name: input.name, marriage_year: input.marriageYear }),
      });
      if (!response.ok) return { ok: false, error: 'Không thể thêm. Vui lòng thử lại.' };
      const body: Spouse = await response.json();
      setSelectedMember((prev) =>
        prev ? { ...prev, spouses: [...prev.spouses, ...toPanelSpouses([body])] } : prev
      );
      patchMemberDetail(selectedMember.id, {
        spouses: [...(detailsById.get(selectedMember.id)?.spouses ?? []), body],
      });
      onDataChanged();
      return { ok: true };
    } catch {
      return { ok: false, error: 'Không thể kết nối tới máy chủ.' };
    }
  }

  async function handleUpdateSpouse(
    marriageId: number,
    input: SpouseUpdateInput
  ): Promise<MutationResult> {
    if (!selectedMember) return { ok: false, error: 'Không tìm thấy thành viên.' };
    try {
      const response = await fetch(`/api/members/marriages/${marriageId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spouse_full_name: input.name,
          spouse_birth_year: input.birthYear,
          spouse_death_year: input.deathYear,
          spouse_gender: input.gender,
          spouse_notes: input.notes,
          marriage_year: input.marriageYear,
        }),
      });
      if (!response.ok) return { ok: false, error: 'Không thể lưu. Vui lòng thử lại.' };
      setSelectedMember((prev) =>
        prev
          ? {
              ...prev,
              spouses: prev.spouses.map((spouse) =>
                spouse.marriageId === marriageId
                  ? {
                      ...spouse,
                      name: input.name,
                      birthYear: input.birthYear,
                      deathYear: input.deathYear,
                      gender: input.gender,
                      notes: input.notes,
                      marriageYear: input.marriageYear,
                    }
                  : spouse
              ),
            }
          : prev
      );
      patchMemberDetail(selectedMember.id, {
        spouses: (detailsById.get(selectedMember.id)?.spouses ?? []).map((spouse) =>
          spouse.marriage_id === marriageId
            ? {
                ...spouse,
                full_name: input.name,
                birth_year: input.birthYear,
                death_year: input.deathYear,
                gender: input.gender,
                notes: input.notes,
                marriage_year: input.marriageYear,
              }
            : spouse
        ),
      });
      onDataChanged();
      return { ok: true };
    } catch {
      return { ok: false, error: 'Không thể kết nối tới máy chủ.' };
    }
  }

  async function handleDeleteSpouse(spouseId: number): Promise<MutationResult> {
    if (!selectedMember) return { ok: false, error: 'Không tìm thấy thành viên.' };
    try {
      const response = await fetch(`/api/members/${spouseId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) return { ok: false, error: 'Không thể xoá. Vui lòng thử lại.' };
      setSelectedMember((prev) =>
        prev
          ? { ...prev, spouses: prev.spouses.filter((spouse) => spouse.spouseId !== spouseId) }
          : prev
      );
      patchMemberDetail(selectedMember.id, {
        spouses: (detailsById.get(selectedMember.id)?.spouses ?? []).filter(
          (spouse) => spouse.id !== spouseId
        ),
      });
      onDataChanged();
      return { ok: true };
    } catch {
      return { ok: false, error: 'Không thể kết nối tới máy chủ.' };
    }
  }

  async function handleUploadAvatar(file: File): Promise<AvatarUploadResult> {
    if (!selectedMember) return { ok: false, error: 'Không tìm thấy thành viên.' };
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`/api/members/${selectedMember.id}/avatar`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!response.ok) return { ok: false, error: 'Không thể tải ảnh lên. Vui lòng thử lại.' };
      const body: { avatar_url: string } = await response.json();
      setSelectedMember((prev) => (prev ? { ...prev, avatarUrl: body.avatar_url } : prev));
      patchMemberDetail(selectedMember.id, { avatar_url: body.avatar_url });
      onDataChanged();
      return { ok: true, avatarUrl: body.avatar_url };
    } catch {
      return { ok: false, error: 'Không thể kết nối tới máy chủ.' };
    }
  }

  async function handleDeleteAvatar(): Promise<MutationResult> {
    if (!selectedMember) return { ok: false, error: 'Không tìm thấy thành viên.' };
    try {
      const response = await fetch(`/api/members/${selectedMember.id}/avatar`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) return { ok: false, error: 'Không thể xoá ảnh. Vui lòng thử lại.' };
      setSelectedMember((prev) => (prev ? { ...prev, avatarUrl: null } : prev));
      patchMemberDetail(selectedMember.id, { avatar_url: null });
      onDataChanged();
      return { ok: true };
    } catch {
      return { ok: false, error: 'Không thể kết nối tới máy chủ.' };
    }
  }

  return {
    handleUpdateMember,
    handleAddChildMember,
    handleDeleteMember,
    handleAddSpouse,
    handleUpdateSpouse,
    handleDeleteSpouse,
    handleUploadAvatar,
    handleDeleteAvatar,
  };
}
