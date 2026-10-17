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

/** Profile fields as the API returns them (snake_case). Months/days may be known without a year. */
export type MemberProfile = {
  courtesy_name: string | null;
  title: string | null;
  residence: string | null;
  burial_place: string | null;
  burial_latitude: number | null;
  burial_longitude: number | null;
  hometown: string | null;
  /** Hidden from guests by the API. */
  phone: string | null;
  email: string | null;
  birth_month: number | null;
  birth_day: number | null;
  death_month: number | null;
  death_day: number | null;
  birth_is_lunar: boolean;
  birth_leap_month: boolean;
  death_is_lunar: boolean;
  death_leap_month: boolean;
  /** Manual sibling order (1 = eldest); null = fall back to birth year. */
  birth_order: number | null;
  is_adopted: boolean;
  /** A recorded spouse of the father, or null. */
  mother_id: number | null;
};

export const EMPTY_API_PROFILE: MemberProfile = {
  courtesy_name: null,
  title: null,
  residence: null,
  burial_place: null,
  burial_latitude: null,
  burial_longitude: null,
  hometown: null,
  phone: null,
  email: null,
  birth_month: null,
  birth_day: null,
  death_month: null,
  death_day: null,
  birth_is_lunar: false,
  birth_leap_month: false,
  death_is_lunar: true,
  death_leap_month: false,
  birth_order: null,
  is_adopted: false,
  mother_id: null,
};

/** The same fields in the panel's camelCase. */
export type PanelProfile = {
  courtesyName: string | null;
  title: string | null;
  residence: string | null;
  burialPlace: string | null;
  burialLatitude: number | null;
  burialLongitude: number | null;
  hometown: string | null;
  phone: string | null;
  email: string | null;
  birthMonth: number | null;
  birthDay: number | null;
  deathMonth: number | null;
  deathDay: number | null;
  birthIsLunar: boolean;
  birthLeapMonth: boolean;
  deathIsLunar: boolean;
  deathLeapMonth: boolean;
  birthOrder: number | null;
  isAdopted: boolean;
  motherId: number | null;
};

import type { BranchRef } from '@/lib/branches/branches';

export type MemberDetail = MemberProfile & {
  id: number;
  birth_year: number | null;
  death_year: number | null;
  gender: Gender | null;
  notes: string | null;
  avatar_url: string | null;
  /** "Trưởng nam", "Thứ nữ", "Út nam"... computed by the API from siblings. */
  sibling_rank: string | null;
  /** The deepest branch (chi/phái) the member belongs to, if any. */
  branch?: BranchRef | null;
  spouses: Spouse[];
};
