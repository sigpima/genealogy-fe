export type Gender = 'male' | 'female' | 'other';

export type Spouse = {
  marriage_id: number;
  marriage_year: number | null;
  id: number;
  full_name: string;
  birth_year: number | null;
  death_year: number | null;
  gender: Gender | null;
  notes: string | null;
};

export type FamilyMember = {
  id?: number;
  name: string;
  children?: FamilyMember[];
};

export type MemberProfile = {
  courtesy_name: string | null;
  title: string | null;
  residence: string | null;
  burial_place: string | null;
  burial_latitude: number | null;
  burial_longitude: number | null;
};

export type MemberDetail = MemberProfile & {
  id: number;
  birth_year: number | null;
  death_year: number | null;
  gender: Gender | null;
  notes: string | null;
  avatar_url: string | null;
  /** "Trưởng nam", "Thứ nữ", "Út nam"... computed by the API from siblings. */
  sibling_rank: string | null;
  spouses: Spouse[];
};
