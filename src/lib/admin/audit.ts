export type AuditKind = 'data' | 'people' | 'security' | 'settings';

export const KIND_LABELS: Record<AuditKind, string> = {
  data: 'Dữ liệu',
  people: 'Người dùng',
  security: 'Bảo mật',
  settings: 'Cài đặt',
};

/** Which group an audit action belongs to — the same prefixes as the API's `app/core/audit_kinds.py`. */
export function kindOfAction(action: string): AuditKind {
  if (action.startsWith('security.')) return 'security';
  if (action.startsWith('user.')) return 'people';
  if (action.startsWith('settings.') || action.startsWith('privacy.') || action.startsWith('calendar.')) return 'settings';
  return 'data';
}

export type AuditFilters = { kind?: string; since?: string; until?: string; memberId?: number | null; actorId?: number | null };

/** A small label next to a name in the log: the platform owner acting inside a family is marked, so the admin can tell. */
export function actorBadge(role: string | null | undefined): string | null {
  return role === 'superadmin' ? 'Quản trị hệ thống' : null;
}

export function buildAuditQuery(filters: AuditFilters, offset: number, limit = 50): string {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (filters.memberId != null) params.set('member_id', String(filters.memberId));
  if (filters.actorId != null) params.set('actor_id', String(filters.actorId));
  if (filters.kind) params.set('kind', filters.kind);
  if (filters.since) params.set('since', filters.since);
  if (filters.until) params.set('until', filters.until);
  return params.toString();
}
