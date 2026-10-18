/** Where the home page sends somebody whose tree could not be shown: a fresh install's superadmin has no family yet, so the platform console is the place to start. */
export function landingPath(user: { role: string } | null, treeCount: number | null): '/' | '/he-thong' | '/login' {
  if (user === null) return '/login';
  if (user.role === 'superadmin' && treeCount === 0) return '/he-thong';
  return '/';
}
