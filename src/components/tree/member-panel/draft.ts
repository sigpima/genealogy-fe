import type { PanelProfile, PanelSpouse } from './types';

export function toInputValue(value: number | null): string {
  return value === null ? '' : String(value);
}

export function parseYear(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export type SpouseDraft = {
  name: string;
  birthYear: string;
  deathYear: string;
  gender: string;
  notes: string;
  marriageYear: string;
};

export function draftFromSpouse(spouse: PanelSpouse): SpouseDraft {
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
export type ProfileDraft = {
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

export function draftFromProfile(profile: PanelProfile): ProfileDraft {
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
