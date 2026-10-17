'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { completenessLink, formatNumber, percentOf, searchLinks, widths, type Overview } from '@/lib/stats/overview';
import { focusHref } from '@/lib/search/search';

const card = 'rounded-xl border-default border bg-surface p-4';
const heading = 'text-[11px] font-semibold uppercase tracking-wider text-muted';

/** The family in numbers. Bars are links (to the search, pre-filtered) with their figures written out, so nothing depends on colour. */
export function StatsView({ isAdmin, onUnauthorized }: { isAdmin: boolean; onUnauthorized: () => void }) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/stats/overview', { credentials: 'include' });
        if (response.status === 401) return onUnauthorized();
        if (!response.ok) throw new Error(String(response.status));
        if (!cancelled) setData((await response.json()) as Overview);
      } catch {
        if (!cancelled) setError('Không tải được số liệu. Vui lòng thử lại.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onUnauthorized]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-default">Thống kê &amp; phân tích</h1>
        <p className="mt-1 text-sm text-muted">Bấm vào một cột hay một con số để xem danh sách người tương ứng.</p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {data && data.totals.members === 0 && <p className="text-sm text-muted">Chưa có dữ liệu để thống kê.</p>}
      {data && data.totals.members > 0 && <Body data={data} isAdmin={isAdmin} />}
    </div>
  );
}

function Body({ data, isAdmin }: { data: Overview; isAdmin: boolean }) {
  const t = data.totals;
  const generationBars = widths(data.by_generation.map((g) => g.count));
  const decadeBars = widths(data.birth_decades.map((d) => d.count));
  return (
    <>
      <section aria-label="Số liệu chính" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Nhân khẩu" value={String(t.members)} hint={t.spouses > 0 ? `+ ${t.spouses} vợ/chồng` : undefined} />
        <Stat label="Số đời" value={String(t.generations)} hint={`dòng dài nhất ${data.longest_line.generations} đời`} />
        <Stat label="Còn sống" value={String(t.living)} href={searchLinks.status('living')} hint={`${percentOf(t.living, t.members)}%`} />
        <Stat label="Đã mất" value={String(t.deceased)} href={searchLinks.status('deceased')} hint={`${percentOf(t.deceased, t.members)}%`} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={card} aria-label="Theo đời">
          <h2 className={heading}>Số người mỗi đời</h2>
          <ul className="mt-2 max-h-80 space-y-1 overflow-y-auto pe-1">
            {data.by_generation.map((g, i) => (
              <li key={g.generation}>
                <Link
                  href={searchLinks.generation(g.generation)}
                  aria-label={`Đời ${g.generation}: ${g.count} người (nam ${g.male}, nữ ${g.female})`}
                  className="flex min-h-9 items-center gap-x-2 rounded text-xs text-default hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                >
                  <span className="w-12 shrink-0 text-muted">Đời {g.generation}</span>
                  <span className="h-3 flex-1 overflow-hidden rounded bg-surface-muted">
                    <span className="block h-full rounded bg-primary" style={{ width: `${generationBars[i]}%` }} />
                  </span>
                  <span className="w-24 shrink-0 text-right tabular-nums">
                    {g.count} <span className="text-muted">({g.male}♂ {g.female}♀)</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className={card} aria-label="Năm sinh theo thập niên">
          <h2 className={heading}>Sinh theo thập niên</h2>
          {data.birth_decades.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Chưa có năm sinh nào.</p>
          ) : (
            <ul className="mt-2 max-h-80 space-y-1 overflow-y-auto pe-1">
              {data.birth_decades.map((d, i) => (
                <li key={d.decade}>
                  <Link
                    href={searchLinks.decade(d.decade)}
                    aria-label={`Thập niên ${d.decade}: ${d.count} người`}
                    className="flex min-h-9 items-center gap-x-2 rounded text-xs text-default hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                  >
                    <span className="w-12 shrink-0 text-muted">{d.decade}s</span>
                    <span className="h-3 flex-1 overflow-hidden rounded bg-surface-muted">
                      <span className="block h-full rounded bg-[var(--color-accent)]" style={{ width: `${decadeBars[i]}%` }} />
                    </span>
                    <span className="w-10 shrink-0 text-right tabular-nums">{d.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={card} aria-label="Giới tính">
          <h2 className={heading}>Giới tính</h2>
          <ul className="mt-2 space-y-1 text-sm text-default">
            {(
              [
                ['male', 'Nam'],
                ['female', 'Nữ'],
                ['other', 'Khác'],
                ['unknown', 'Chưa rõ'],
              ] as const
            )
              .filter(([key]) => data.gender[key] > 0)
              .map(([key, label]) => (
                <li key={key}>
                  <Link href={searchLinks.gender(key)} className="inline-flex min-h-9 items-center text-primary underline">
                    {label}: {data.gender[key]} ({percentOf(data.gender[key], t.members)}%)
                  </Link>
                </li>
              ))}
          </ul>
        </section>

        <section className={card} aria-label="Tuổi thọ">
          <h2 className={heading}>Tuổi thọ</h2>
          {data.lifespan.count === 0 ? (
            <p className="mt-2 text-sm text-muted">Cần người có cả năm sinh và năm mất.</p>
          ) : (
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-default">
              <dt className="text-muted">Trung bình</dt>
              <dd>{formatNumber(data.lifespan.average)} tuổi</dd>
              <dt className="text-muted">Trung vị</dt>
              <dd>{formatNumber(data.lifespan.median)} tuổi</dd>
              <dt className="text-muted">Thấp nhất / cao nhất</dt>
              <dd>
                {formatNumber(data.lifespan.shortest)} / {formatNumber(data.lifespan.longest)} tuổi
              </dd>
              <dt className="text-muted">Nam / nữ</dt>
              <dd>
                {formatNumber(data.lifespan.male_average)} / {formatNumber(data.lifespan.female_average)}
              </dd>
              <dt className="text-muted">Tính trên</dt>
              <dd>{data.lifespan.count} người</dd>
            </dl>
          )}
        </section>

        <section className={card} aria-label="Con cái">
          <h2 className={heading}>Con cái</h2>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-default">
            <dt className="text-muted">Người có con</dt>
            <dd>{data.children.parents}</dd>
            <dt className="text-muted">Trung bình mỗi người có con</dt>
            <dd>{formatNumber(data.children.average_per_parent)}</dd>
            <dt className="text-muted">Chưa có con</dt>
            <dd>{data.children.childless}</dd>
            <dt className="text-muted">Đông con nhất</dt>
            <dd>
              {data.children.most ? (
                <Link href={focusHref(data.children.most.id)} className="text-primary underline">
                  {data.children.most.name} ({data.children.most.count} con)
                </Link>
              ) : (
                '–'
              )}
            </dd>
          </dl>
        </section>

        <section className={card} aria-label="Dòng dài nhất">
          <h2 className={heading}>Dòng dài nhất ({data.longest_line.generations} đời)</h2>
          <ol className="mt-2 space-y-0.5 text-sm text-default">
            {data.longest_line.names.slice(0, 12).map((name, i) => (
              <li key={i}>
                <span className="text-muted">Đời {i + 1}: </span>
                {name}
              </li>
            ))}
            {data.longest_line.names.length > 12 && <li className="text-muted">… và {data.longest_line.names.length - 12} đời nữa</li>}
          </ol>
        </section>

        <section className={card} aria-label="Chữ đệm phổ biến">
          <h2 className={heading}>Chữ đệm phổ biến</h2>
          <Words items={data.middle_names} />
        </section>
        <section className={card} aria-label="Tên gọi phổ biến">
          <h2 className={heading}>Tên gọi phổ biến</h2>
          <Words items={data.given_names} />
        </section>

        {data.by_branch.length > 0 && (
          <section className={card} aria-label="Theo chi">
            <h2 className={heading}>Theo chi</h2>
            <ul className="mt-2 space-y-1 text-sm text-default">
              {data.by_branch.map((b) => (
                <li key={b.id}>
                  <Link href={searchLinks.branch(b.id)} className="inline-flex min-h-9 items-center gap-x-2 text-primary underline">
                    <span aria-hidden="true" className="inline-block size-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                    {b.name}: {b.count}
                  </Link>
                </li>
              ))}
              {data.without_branch > 0 && <li className="text-muted">Chưa thuộc chi nào: {data.without_branch}</li>}
            </ul>
          </section>
        )}
      </div>

      <section className={card} aria-label="Độ đầy đủ dữ liệu">
        <h2 className={heading}>Độ đầy đủ dữ liệu</h2>
        <p className="mt-1 text-xs text-muted">Bao nhiêu người đã có từng thông tin. {isAdmin ? 'Bấm “Bổ sung” để mở bảng nhập liệu đã lọc sẵn những người còn thiếu.' : ''}</p>
        <ul className="mt-3 space-y-2">
          {data.completeness.map((row) => {
            const pct = percentOf(row.have, row.total);
            const link = isAdmin ? completenessLink(row.field) : null;
            return (
              <li key={row.field} className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-x-3 text-sm text-default">
                <span>{row.label}</span>
                <span
                  role="progressbar"
                  aria-label={row.label}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  className="h-2.5 overflow-hidden rounded-full bg-surface-muted"
                >
                  <span className="block h-full bg-primary" style={{ width: `${pct}%` }} />
                </span>
                <span className="flex items-center gap-x-2 tabular-nums">
                  {row.have}/{row.total} ({pct}%)
                  {link && row.have < row.total && (
                    <Link href={link} className="text-primary underline">
                      Bổ sung
                    </Link>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

function Stat({ label, value, hint, href }: { label: string; value: string; hint?: string; href?: string }) {
  const inner = (
    <>
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</span>
      <span className="font-display mt-1 block text-3xl font-bold text-default">{value}</span>
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </>
  );
  const cls = 'block rounded-xl border-default border bg-surface p-4';
  return href ? (
    <Link href={href} className={`${cls} hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function Words({ items }: { items: { word: string; count: number }[] }) {
  if (items.length === 0) return <p className="mt-2 text-sm text-muted">Chưa đủ dữ liệu.</p>;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {items.map((w) => (
        <li key={w.word} className="rounded-full bg-surface-muted px-3 py-1 text-sm text-default">
          {w.word} <span className="text-xs text-muted">×{w.count}</span>
        </li>
      ))}
    </ul>
  );
}
