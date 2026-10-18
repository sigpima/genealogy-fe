// The areas of the superadmin console (same idea as lib/admin/sections.ts): `ready: true` only once the page exists.
import type { AdminIcon } from '../admin/sections';

export type PlatformSection = { id: string; href: string; label: string; hint: string; icon: AdminIcon; ready: boolean };

export const PLATFORM_SECTIONS: PlatformSection[] = [
  { id: 'trees', href: '/he-thong/ho', label: 'Các họ', hint: 'Tạo, đổi tên, tạm ngưng hoặc xoá một họ', icon: 'families', ready: true },
  { id: 'audit', href: '/he-thong/nhat-ky', label: 'Nhật ký nền tảng', hint: 'Những gì bạn đã làm với các họ', icon: 'audit', ready: true },
  { id: 'system', href: '/he-thong/he-thong', label: 'Hệ thống', hint: 'Cơ sở dữ liệu, bộ nhắc việc, đĩa, sao lưu', icon: 'health', ready: true },
];

export function visiblePlatformSections(): PlatformSection[] {
  return PLATFORM_SECTIONS.filter((s) => s.ready);
}

/** The to-do key that puts a count badge on a section's tile. */
export const PLATFORM_BADGE_KEY: Record<string, string> = { trees: 'trees_without_admin', system: 'worker_stale' };

export type PlatformOverview = {
  items: { key: string; count: number; text: string; href: string; kind: 'task' | 'notice' }[];
  numbers: Record<string, number>;
};
