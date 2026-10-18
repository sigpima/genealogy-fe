/** "Con nuôi" means adopted by a father, so a person without one (the root) cannot be marked so. The API refuses it too. */
export function canBeAdopted(member: { parent_id: number | null }): boolean {
  return member.parent_id !== null;
}
