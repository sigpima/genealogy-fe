'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MediaGallery } from '@/components/media/MediaGallery';
import { MapLinkField } from '@/components/places/MapLinkField';
import {
  directionsUrl,
  EMPTY_PLACE_FORM,
  filterPlaces,
  hasCoordinates,
  migrationLine,
  PLACE_KIND_COLORS,
  PLACE_KIND_LABELS,
  placeErrorMessage,
  placePayload,
  placeToForm,
  type MigrationResult,
  type Place,
  type PlaceDetail,
  type PlaceForm,
  type PlaceKind,
} from '@/lib/places/places';

const PlaceMap = dynamic(() => import('./PlaceMap'), {
  ssr: false,
  loading: () => <div className="flex size-full min-h-[320px] items-center justify-center rounded-xl border-default border bg-surface-muted text-sm text-muted">Đang tải bản đồ...</div>,
});

const field =
  'mt-1 w-full min-h-11 rounded-lg border-default border bg-app px-3 text-sm text-default placeholder:text-muted focus:border-[var(--color-primary)] focus:outline-none';
const primary =
  'min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';
const ghost =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-sm text-muted hover:text-default focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';
const danger =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-sm text-danger hover:underline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]';

/** Places of the family on a map and in a list; admins add/edit them (picking the point on the map) and migrate the old text. */
export function PlacesView({ isAdmin, onUnauthorized }: { isAdmin: boolean; onUnauthorized: () => void }) {
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [kind, setKind] = useState<'' | PlaceKind>('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<PlaceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ id: number | null; values: PlaceForm } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/places', { credentials: 'include' });
      if (response.status === 401) return onUnauthorized();
      if (!response.ok) throw new Error(String(response.status));
      setPlaces((await response.json()) as Place[]);
      setError(null);
    } catch {
      setError('Không tải được danh sách địa điểm. Vui lòng thử lại.');
    }
  }, [onUnauthorized]);

  useEffect(() => {
    void load();
  }, [load]);

  // /dia-diem?place=ID (from a profile's "An nghỉ") opens that place.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('place');
    if (raw && /^\d+$/.test(raw)) setSelectedId(Number(raw));
  }, []);

  useEffect(() => {
    if (selectedId === null) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/places/${selectedId}`, { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<PlaceDetail>) : null))
      .then((body) => {
        if (!cancelled) setDetail(body);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [selectedId, places]);

  const visible = useMemo(() => filterPlaces(places ?? [], kind, query), [places, kind, query]);
  const picked = useMemo(() => {
    if (!form) return null;
    const lat = Number(form.values.latitude.replace(',', '.'));
    const lng = Number(form.values.longitude.replace(',', '.'));
    return form.values.latitude.trim() && form.values.longitude.trim() && Number.isFinite(lat) && Number.isFinite(lng)
      ? { latitude: lat, longitude: lng }
      : null;
  }, [form]);

  function openForm(place?: Place) {
    setForm({ id: place?.id ?? null, values: place ? placeToForm(place) : EMPTY_PLACE_FORM });
    setFormError(null);
    setPicking(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const result = placePayload(form.values);
    if (!result.ok) return setFormError(result.error);
    try {
      const response = await fetch(form.id === null ? '/api/places' : `/api/places/${form.id}`, {
        method: form.id === null ? 'POST' : 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.payload),
      });
      if (!response.ok) return setFormError(placeErrorMessage(response.status));
      const saved = (await response.json()) as Place;
      setForm(null);
      setPicking(false);
      setSelectedId(saved.id);
      await load();
    } catch {
      setFormError('Không thể kết nối tới máy chủ.');
    }
  }

  async function remove(place: Place) {
    if (!window.confirm(`Xoá địa điểm “${place.name}”? Những người an nghỉ ở đây vẫn còn trong gia phả, chỉ mất liên kết.`)) return;
    const response = await fetch(`/api/places/${place.id}`, { method: 'DELETE', credentials: 'include' });
    if (!response.ok) return setError(placeErrorMessage(response.status));
    setSelectedId(null);
    await load();
  }

  const set = <K extends keyof PlaceForm>(key: K, value: PlaceForm[K]) => setForm((f) => (f ? { ...f, values: { ...f.values, [key]: value } } : f));

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold text-default">Địa điểm</h1>
          <p className="mt-1 text-sm text-muted">Nhà thờ họ, từ đường, lăng mộ, nghĩa trang, đền — và những người an nghỉ ở đó.</p>
        </div>
        {isAdmin && !form && (
          <button type="button" className={primary} onClick={() => openForm()}>
            Thêm địa điểm
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="space-y-4">
          {form && (
            <form onSubmit={save} className="space-y-3 rounded-xl border-default border bg-surface p-4" aria-label="Biểu mẫu địa điểm">
              <h2 className="text-sm font-semibold text-default">{form.id === null ? 'Thêm địa điểm' : 'Sửa địa điểm'}</h2>
              <label className="block text-sm">
                <span className="text-xs text-muted">Tên</span>
                <input required value={form.values.name} onChange={(e) => set('name', e.target.value)} maxLength={150} aria-label="Tên địa điểm" className={field} />
              </label>
              <label className="block text-sm">
                <span className="text-xs text-muted">Loại</span>
                <select value={form.values.kind} onChange={(e) => set('kind', e.target.value as PlaceKind)} aria-label="Loại địa điểm" className={field}>
                  {(Object.keys(PLACE_KIND_LABELS) as PlaceKind[]).map((k) => (
                    <option key={k} value={k}>
                      {PLACE_KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-xs text-muted">Địa chỉ</span>
                <input value={form.values.address} onChange={(e) => set('address', e.target.value)} maxLength={500} aria-label="Địa chỉ" className={field} />
              </label>
              <MapLinkField label="Link Google Maps" value={form.values.map_url} onChange={(value) => set('map_url', value)} />
              <button type="button" className={ghost} aria-pressed={picking} onClick={() => setPicking((v) => !v)}>
                {picking ? 'Đang chọn: bấm lên bản đồ…' : 'Hoặc chọn vị trí trên bản đồ'}
              </button>
              {form.values.latitude.trim() && form.values.longitude.trim() && (
                <p className="text-sm text-muted">
                  Đã có vị trí trên bản đồ.{' '}
                  <button
                    type="button"
                    className="min-h-11 text-default underline"
                    onClick={() => {
                      set('latitude', '');
                      set('longitude', '');
                    }}
                  >
                    Bỏ vị trí
                  </button>
                </p>
              )}
              <label className="block text-sm">
                <span className="text-xs text-muted">Người trông coi</span>
                <input value={form.values.caretaker} onChange={(e) => set('caretaker', e.target.value)} maxLength={255} aria-label="Người trông coi" className={field} />
              </label>
              <label className="block text-sm">
                <span className="text-xs text-muted">Lưu ý khi đến thăm</span>
                <textarea value={form.values.visit_notes} onChange={(e) => set('visit_notes', e.target.value)} rows={2} aria-label="Lưu ý khi thăm" className={`${field} py-2`} />
              </label>
              <label className="block text-sm">
                <span className="text-xs text-muted">Mô tả</span>
                <textarea value={form.values.description} onChange={(e) => set('description', e.target.value)} rows={3} aria-label="Mô tả địa điểm" className={`${field} py-2`} />
              </label>
              {formError && (
                <p role="alert" className="text-sm text-danger">
                  {formError}
                </p>
              )}
              <div className="flex gap-x-2">
                <button type="submit" className={primary}>
                  Lưu
                </button>
                <button
                  type="button"
                  className={ghost}
                  onClick={() => {
                    setForm(null);
                    setPicking(false);
                  }}
                >
                  Huỷ
                </button>
              </div>
            </form>
          )}

          <div className="flex flex-wrap gap-2">
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm tên, địa chỉ..." aria-label="Tìm địa điểm" className={`${field} mt-0 w-44 flex-1`} />
            <select value={kind} onChange={(e) => setKind(e.target.value as '' | PlaceKind)} aria-label="Lọc theo loại" className={`${field} mt-0 w-auto`}>
              <option value="">Mọi loại</option>
              {(Object.keys(PLACE_KIND_LABELS) as PlaceKind[]).map((k) => (
                <option key={k} value={k}>
                  {PLACE_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>

          {places && visible.length === 0 && <p className="text-sm text-muted">{places.length === 0 ? 'Chưa có địa điểm nào.' : 'Không có địa điểm khớp bộ lọc.'}</p>}
          <ul className="space-y-2" aria-label="Danh sách địa điểm">
            {visible.map((place) => (
              <li key={place.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(place.id)}
                  aria-current={place.id === selectedId}
                  className={`flex min-h-14 w-full items-center gap-x-3 rounded-xl border bg-surface px-4 py-2 text-left hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] ${
                    place.id === selectedId ? 'border-[var(--color-primary)]' : 'border-default'
                  }`}
                >
                  <span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ backgroundColor: PLACE_KIND_COLORS[place.kind] }} />
                  <span className="min-w-0 flex-1">
                    <span className="font-display block truncate font-semibold text-default">{place.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {PLACE_KIND_LABELS[place.kind]}
                      {place.address ? ` · ${place.address}` : ''}
                      {!hasCoordinates(place) ? ' · chưa có toạ độ' : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">{place.resting_count} người</span>
                </button>
              </li>
            ))}
          </ul>

          {detail && !form && (
            <article className="space-y-3 rounded-xl border-default border bg-surface p-4" aria-label={`Địa điểm ${detail.name}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-bold text-default">{detail.name}</h2>
                  <p className="text-xs text-muted">
                    {PLACE_KIND_LABELS[detail.kind]}
                    {detail.address ? ` · ${detail.address}` : ''}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex">
                    <button type="button" className={ghost} onClick={() => openForm(detail)}>
                      Sửa
                    </button>
                    <button type="button" className={danger} onClick={() => void remove(detail)}>
                      Xoá
                    </button>
                  </div>
                )}
              </div>
              {hasCoordinates(detail) && (
                <a
                  href={directionsUrl(detail.latitude!, detail.longitude!)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-on-primary hover:opacity-90"
                >
                  Chỉ đường
                </a>
              )}
              {detail.map_url && (
                <a
                  href={detail.map_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center rounded-lg border-default border px-4 text-sm font-medium text-default hover:bg-surface-muted"
                >
                  Mở trên Google Maps
                </a>
              )}
              {detail.caretaker && (
                <p className="text-sm text-default">
                  <span className="text-muted">Người trông coi: </span>
                  {detail.caretaker}
                </p>
              )}
              {detail.visit_notes && (
                <p className="whitespace-pre-wrap rounded-lg bg-surface-muted p-3 text-sm text-default">
                  <b className="font-semibold">Lưu ý khi đến thăm: </b>
                  {detail.visit_notes}
                </p>
              )}
              {detail.description && <p className="whitespace-pre-wrap text-sm text-default">{detail.description}</p>}
              <section aria-label="Người an nghỉ">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">An nghỉ tại đây ({detail.residents.length})</h3>
                {detail.residents.length === 0 && <p className="mt-1 text-sm text-muted">Chưa gắn người nào. Chọn “Nơi an nghỉ” trong hồ sơ của họ.</p>}
                <ul className="mt-1 space-y-0.5">
                  {detail.residents.map((r) => (
                    <li key={r.id} className="text-sm text-default">
                      <Link href={`/?focus=${r.id}`} className="text-primary underline">
                        {r.full_name}
                      </Link>
                      <span className="text-xs text-muted">
                        {r.death_year ? ` · mất ${r.death_year}` : ''}
                        {r.plot ? ` · ${r.plot}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
              <section aria-label="Ảnh địa điểm">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Ảnh &amp; tài liệu</h3>
                <MediaGallery key={detail.id} ownerKind="places" ownerId={detail.id} canEdit={isAdmin} />
              </section>
            </article>
          )}

          {isAdmin && <MigrationCard onDone={load} />}
        </div>

        <div className="min-h-[420px] lg:sticky lg:top-4 lg:h-[calc(100vh-9rem)]">
          <PlaceMap
            places={places ?? []}
            selectedId={selectedId}
            onSelect={setSelectedId}
            picking={picking}
            picked={picked}
            onPick={(lat, lng) => {
              set('latitude', lat.toFixed(6));
              set('longitude', lng.toFixed(6));
              setPicking(false);
            }}
          />
        </div>
      </div>
    </div>
  );
}

/** Turn the old free-text "mộ phần" of each person into places: a preview first, then apply. */
function MigrationCard({ onDone }: { onDone: () => Promise<void> }) {
  const [preview, setPreview] = useState<MigrationResult | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(dryRun: boolean) {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const response = await fetch(`/api/places/migrate-burials?dry_run=${dryRun}`, { method: 'POST', credentials: 'include' });
      if (!response.ok) return setError('Không thực hiện được. Vui lòng thử lại.');
      const result = (await response.json()) as MigrationResult;
      if (dryRun) {
        setPreview(result);
      } else {
        setPreview(null);
        setDone(`Đã tạo ${result.created} địa điểm và gắn ${result.linked} người.`);
        await onDone();
      }
    } catch {
      setError('Không thể kết nối tới máy chủ.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border-default border bg-surface p-4" aria-label="Chuyển dữ liệu mộ phần cũ">
      <h2 className="text-sm font-semibold text-default">Chuyển từ ô “Mộ phần” cũ</h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Gom các ô “Mộ phần” đã nhập (không phân biệt hoa/thường, dấu) thành địa điểm và gắn người vào. Ô cũ được giữ nguyên.
      </p>
      <button type="button" className={`${ghost} -ms-3`} disabled={busy} onClick={() => void run(true)}>
        Xem trước
      </button>
      {preview && (
        <div className="mt-1">
          {preview.groups.length === 0 ? (
            <p role="status" className="text-sm text-muted">Không có gì cần chuyển.</p>
          ) : (
            <>
              <ul className="max-h-48 list-disc space-y-0.5 overflow-y-auto ps-5 text-xs text-default">
                {preview.groups.map((g) => (
                  <li key={g.name}>{migrationLine(g)}</li>
                ))}
              </ul>
              <button type="button" className={`${primary} mt-2`} disabled={busy} onClick={() => void run(false)}>
                Áp dụng ({preview.created} địa điểm mới, {preview.linked} người)
              </button>
            </>
          )}
        </div>
      )}
      {done && (
        <p role="status" className="mt-2 text-sm text-default">
          {done}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
