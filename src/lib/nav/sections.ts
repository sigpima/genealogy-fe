export type NavGroup = 'user' | 'admin' | 'platform';

const ORDER: NavGroup[] = ['user', 'admin', 'platform'];

/** The menu in sections: what everyone sees, then what only admins see, then the platform owner's. Hidden items and empty sections are dropped. */
export function navSections<T extends { group: NavGroup; show: boolean }>(entries: T[]): T[][] {
  return ORDER.map((group) => entries.filter((entry) => entry.group === group && entry.show)).filter((section) => section.length > 0);
}
