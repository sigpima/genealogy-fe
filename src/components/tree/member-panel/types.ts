import type { BranchRef } from '@/lib/branches/branches';
import type { Gender, PanelProfile, RestingPlace } from '@/lib/tree/types';

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

/** The signed-in account as the panel needs it: for "Đây là tôi" and "Xem với tôi". */
export type PanelMe = { userId: number; role: string; member: { id: number; name: string } | null };

export type MemberDetailPanelProps = {
  me?: PanelMe | null;
  onMeChanged?: () => void;
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
  /** Show only this person's descendants on the tree. */
  onViewBranch?: () => void;
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

/** What the edit form asks of the portrait on save. */
export type AvatarChange = { file: File | null; remove: boolean };

export type { BranchRef, Gender, PanelProfile, RestingPlace };
