/** The name the header shows on every page: the family of a signed-in member, the family a superadmin is acting in, or the one a guest is looking at. */
export function familyNameFor(
  user: { role: string; tree_name: string | null } | null,
  trees: { name: string; is_current: boolean }[] | null,
  siteTreeName: string | null,
): string | null {
  if (user === null) return siteTreeName;
  if (user.tree_name) return user.tree_name;
  if (user.role === 'superadmin') return (trees?.find((t) => t.is_current) ?? trees?.[0])?.name ?? null;
  return null;
}
