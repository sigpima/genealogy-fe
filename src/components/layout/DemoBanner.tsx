import { isDemoTree } from '@/lib/auth/tree';

/** A strip above the header while a guest is looking at the fake demo family (/guest). Nothing for any other family. */
export function DemoBanner({ slug }: { slug: string | null }) {
  if (!isDemoTree(slug)) return null;
  return (
    <div role="status" className="bg-primary text-on-primary px-4 py-1.5 text-center text-sm font-medium">
      Bản demo — toàn bộ dữ liệu trên trang này là giả
    </div>
  );
}
