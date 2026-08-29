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
  birth_year?: number | null;
  death_year?: number | null;
  gender?: Gender | null;
  notes?: string | null;
  spouses?: Spouse[];
  children?: FamilyMember[];
};
