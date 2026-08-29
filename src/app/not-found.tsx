import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-y-4 bg-app text-center">
      <h1 className="text-2xl font-semibold text-default">Không tìm thấy trang</h1>
      <p className="text-sm text-muted">Trang bạn tìm không tồn tại.</p>
      <Link href="/" className="text-sm font-medium accent-text hover:underline">
        Về trang chủ
      </Link>
    </div>
  );
}
