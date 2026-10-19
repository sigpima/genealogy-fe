import type { PanelProfile, PanelSpouse } from '@/components/tree/MemberDetailPanel';
import { toPanelProfile } from '@/lib/tree/profile';
import { EMPTY_API_PROFILE } from '@/lib/tree/types';
import type { BranchRef } from '@/lib/branches/branches';
import type { Gender, MemberDetail, RestingPlace, Spouse } from '@/lib/tree/types';

/** The person whose panel is open: what the tree knows at once (name, place in the tree) plus what the detail request adds. */
export type SelectedMember = {
  id: number;
  parentId: number | null;
  name: string;
  generation: number;
  ancestorPath: string[];
  childrenNames: string[];
  birthYear: number | null;
  deathYear: number | null;
  gender: Gender | null;
  notes: string | null;
  avatarUrl: string | null;
  profile: PanelProfile;
  siblingRank: string | null;
  branch: BranchRef | null;
  restingPlace: RestingPlace | null;
  /** The father's recorded spouses: the choices for "Mẹ". */
  motherOptions: { id: number; name: string }[];
  spouses: PanelSpouse[];
  isDetailLoading: boolean;
  detailLoadError: boolean;
};

const EMPTY_PROFILE: PanelProfile = toPanelProfile(EMPTY_API_PROFILE);

export function toPanelSpouses(spouses: Spouse[] | undefined): PanelSpouse[] {
  return (spouses ?? []).map((spouse) => ({
    marriageId: spouse.marriage_id,
    spouseId: spouse.id,
    name: spouse.full_name,
    birthYear: spouse.birth_year,
    deathYear: spouse.death_year,
    gender: spouse.gender,
    notes: spouse.notes,
    marriageYear: spouse.marriage_year,
  }));
}

/** The panel as it first opens, before the detail request answers. */
export function loadingMember(
  id: number,
  parentId: number | null,
  name: string,
  ancestorPath: string[],
  childrenNames: string[]
): SelectedMember {
  return {
    id,
    parentId,
    name,
    generation: ancestorPath.length,
    ancestorPath,
    childrenNames,
    birthYear: null,
    deathYear: null,
    gender: null,
    notes: null,
    avatarUrl: null,
    profile: EMPTY_PROFILE,
    siblingRank: null,
    branch: null,
    restingPlace: null,
    motherOptions: [],
    spouses: [],
    isDetailLoading: true,
    detailLoadError: false,
  };
}

/** The same person once the detail request has answered (null = it failed). */
export function withDetail(member: SelectedMember, detail: MemberDetail | null): SelectedMember {
  if (!detail) return { ...member, isDetailLoading: false, detailLoadError: true };
  return {
    ...member,
    isDetailLoading: false,
    detailLoadError: false,
    birthYear: detail.birth_year,
    deathYear: detail.death_year,
    gender: detail.gender,
    notes: detail.notes,
    avatarUrl: detail.avatar_url,
    profile: toPanelProfile(detail),
    siblingRank: detail.sibling_rank,
    branch: detail.branch ?? null,
    restingPlace: detail.resting_place ?? null,
    spouses: toPanelSpouses(detail.spouses),
  };
}
