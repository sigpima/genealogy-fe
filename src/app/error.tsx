'use client';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-y-4 bg-app text-center">
      <h1 className="text-2xl font-semibold text-default">Đã có lỗi xảy ra</h1>
      <p className="text-sm text-muted">Vui lòng thử lại.</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:opacity-90"
      >
        Thử lại
      </button>
    </div>
  );
}
