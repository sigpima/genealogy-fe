import { looksLikeMapLink } from '@/lib/places/mapLink';

const field =
  'mt-1 h-11 w-full rounded-lg border-default border bg-app px-3 text-base text-default focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(197,155,39,0.2)]';

/** One box for a Google Maps link (instead of latitude/longitude): hint, inline check, and a "open" link once it looks right. */
export function MapLinkField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const valid = looksLikeMapLink(value);
  const filled = value.trim() !== '';
  const hintId = `map-link-hint-${label.replace(/\W+/g, '-')}`;
  return (
    <div>
      <label className="block">
        <span className="text-sm text-default">{label}</span>
        <input
          type="url"
          inputMode="url"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={500}
          placeholder="https://maps.app.goo.gl/…"
          aria-invalid={!valid}
          aria-describedby={hintId}
          className={field}
        />
      </label>
      <p id={hintId} className={`mt-1 text-sm ${valid ? 'text-muted' : 'text-danger'}`} role={valid ? undefined : 'alert'}>
        {valid
          ? 'Mở Google Maps, bấm Chia sẻ → Sao chép liên kết, dán vào đây.'
          : 'Đây chưa phải link Google Maps (https://maps.app.goo.gl/… hoặc https://www.google.com/maps/…).'}
      </p>
      {filled && valid && (
        <a
          href={value.trim()}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex min-h-11 items-center text-sm text-default underline"
        >
          Mở trên Google Maps
        </a>
      )}
    </div>
  );
}
