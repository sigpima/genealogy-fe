export type Gender = 'male' | 'female' | 'other';

export type FamilyMember = {
  id?: number;
  name: string;
  birth_year?: number | null;
  death_year?: number | null;
  gender?: Gender | null;
  notes?: string | null;
  children?: FamilyMember[];
};
