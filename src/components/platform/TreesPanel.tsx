'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminsDialog } from '@/components/platform/AdminsDialog';
import { TreeActions } from '@/components/platform/TreeActions';
import { filterTrees, lastActivityLabel, statusLabel } from '@/lib/platform/lifecycle';
import {
  enterFamily,
  familyLink,
  isValidSlug,
  slugify,
  treeErrorMessage,
  type PlatformTree,
  type TreeCreated,
} from '@/lib/platform/trees';

const field =
  'mt-1 w-full min-h-11 rounded-lg border-default border bg-app px-3 text-base text-default placeholder:text-muted focus:border-[var(--color-primary)] focus:outline-none';
const primary =
  'min-h-11 rounded-lg bg-primary px-4 text-base font-medium text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';
const ghost =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-base text-default hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';

async function problem(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  return treeErrorMessage(response.status, (body as { detail?: unknown } | null)?.detail);
}

/** Go into a family and somewhere in it (a full load, so nothing stale from the old family stays). The entry is logged first. */
async function actOn(treeId: number, path: string, onError: (message: string) => void) {
  if (!(await enterFamily(treeId))) return onError('Không ghi được nhật ký nên chưa vào họ này. Vui lòng thử lại.');
  window.location.assign(path);
}

export function TreesPanel() {
  const [trees, setTrees] = useState<PlatformTree[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<TreeCreated | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [adminsOf, setAdminsOf] = useState<number | null>(null);
  const [loc, setLoc] = useState<string | null>(null);
  useEffect(() => setLoc(new URLSearchParams(window.location.search).get('loc')), []);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/trees', { credentials: 'include' });
      if (!response.ok) throw new Error(String(response.status));
      setTrees((await response.json()) as PlatformTree[]);
    } catch {
      setError('Không tải được danh sách họ.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-8">
      {error && (
        <p role="alert" className="text-base text-danger">
          {error}
        </p>
      )}

      {message && (
        <p role="status" className="text-base text-default">
          {message}
        </p>
      )}

      <section aria-label="Danh sách họ">
        <h2 className="text-lg font-semibold text-default">
          Các họ ({trees ? filterTrees(trees, loc).length : '…'})
          {loc && (
            <button type="button" className="ms-3 min-h-11 text-base font-normal text-default underline" onClick={() => { setLoc(null); window.history.replaceState(null, '', window.location.pathname); }}>
              Xem tất cả
            </button>
          )}
        </h2>
        <ul className="mt-3 space-y-3">
          {filterTrees(trees ?? [], loc).map((tree) => (
            <li key={tree.id} className="rounded-xl border-default border bg-surface p-4">
              {editing === tree.id ? (
                <RenameForm
                  tree={tree}
                  onDone={async (changed) => {
                    setEditing(null);
                    if (changed) await load();
                  }}
                />
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-display text-base font-bold text-default">
                        {tree.name}{' '}
                        {tree.is_current && (
                          <span className="ms-1 rounded-full bg-surface-muted px-2 py-0.5 align-middle text-sm font-semibold text-default">
                            đang xem
                          </span>
                        )}{' '}
                        <span className={`ms-1 rounded-full border-2 px-2 py-0.5 align-middle text-sm font-semibold text-default ${tree.status === 'paused' ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'}`}>
                          {statusLabel(tree.status)}
                        </span>
                      </h3>
                      <p className="mt-0.5 text-sm text-muted">Hoạt động gần nhất: {lastActivityLabel(tree.last_activity, new Date())}</p>
                      <p className="mt-0.5 text-sm text-muted">
                        {tree.member_count} người · {tree.user_count} tài khoản · link:{' '}
                        <code>{familyLink(typeof window === 'undefined' ? '' : window.location.origin, tree.slug)}</code>
                      </p>
                      <p className="mt-0.5 text-sm text-muted">
                        Admin:{' '}
                        {tree.admins.length
                          ? tree.admins.map((a) => `${a.full_name} <${a.email}>${a.status === 'active' ? '' : ` (${a.status})`}`).join('; ')
                          : 'chưa có'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center">
                      <button type="button" className={ghost} onClick={() => void actOn(tree.id, '/', setError)}>
                        Xem cây
                      </button>
                      <button type="button" className={ghost} onClick={() => void actOn(tree.id, '/admin', setError)}>
                        Quản trị
                      </button>
                      <button type="button" className={ghost} onClick={() => setEditing(tree.id)}>
                        Đổi tên
                      </button>
                      <button type="button" className={ghost} onClick={() => setAdminsOf(tree.id)}>
                        Quản trị viên
                      </button>
                      <TreeActions
                        tree={tree}
                        onChanged={async (text) => {
                          await load(); // show the new state first, then say it worked
                          setMessage(text);
                        }}
                        onError={(text) => setError(text)}
                      />
                    </div>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      {adminsOf !== null && trees?.find((t) => t.id === adminsOf) && (
        <AdminsDialog tree={trees.find((t) => t.id === adminsOf)!} onClose={() => setAdminsOf(null)} onChanged={() => void load()} />
      )}

      <section aria-label="Tạo họ mới">
        <h2 className="text-lg font-semibold text-default">Tạo họ mới</h2>
        <CreateForm
          onCreated={async (result) => {
            setCreated(result);
            await load();
          }}
        />
        {created && (
          <div role="status" className="mt-4 rounded-xl border-default border bg-surface p-4 text-base text-default">
            <p>
              Đã tạo họ <b>{created.tree.name}</b>. Admin: <b>{created.admin.email}</b>.
            </p>
            {created.admin_password ? (
              <>
                <p className="mt-2">
                  Mật khẩu tạm (chỉ hiện <b>một lần</b>, hãy gửi cho họ ngay):
                </p>
                <p className="mt-1 select-all rounded bg-surface-muted px-3 py-2 font-mono">{created.admin_password}</p>
              </>
            ) : (
              <p className="mt-2 text-muted">Mật khẩu là mật khẩu bạn đã nhập.</p>
            )}
            <p className="mt-2 text-sm text-muted">
              Link cho họ hàng đăng ký/xem: {familyLink(window.location.origin, created.tree.slug)}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function CreateForm({ onCreated }: { onCreated: (result: TreeCreated) => Promise<void> }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [email, setEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const effectiveSlug = slugTouched ? slug : slugify(name);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidSlug(effectiveSlug)) {
      setMessage('Slug chỉ gồm chữ thường, số và dấu gạch ngang (vd: nguyen-toc).');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch('/api/trees', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug: effectiveSlug,
          admin_email: email,
          admin_name: adminName,
          admin_password: password || null,
        }),
      });
      if (!response.ok) {
        setMessage(await problem(response));
        return;
      }
      await onCreated((await response.json()) as TreeCreated);
      setName('');
      setSlug('');
      setSlugTouched(false);
      setEmail('');
      setAdminName('');
      setPassword('');
    } catch {
      setMessage('Không thể kết nối tới máy chủ.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 grid gap-3 rounded-xl border-default border bg-surface p-4 sm:grid-cols-2">
      <label className="block text-base sm:col-span-2">
        <span className="text-sm text-muted">Tên họ</span>
        <input required value={name} onChange={(e) => setName(e.target.value)} maxLength={255} className={field} placeholder="Nguyễn Tộc Làng Phú Ốc" />
      </label>
      <label className="block text-base sm:col-span-2">
        <span className="text-sm text-muted">Đường dẫn (slug) — link họ hàng vào sẽ là /t/{effectiveSlug || '…'}</span>
        <input
          required
          value={effectiveSlug}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugTouched(true);
          }}
          maxLength={60}
          className={field}
          aria-label="Slug"
        />
      </label>
      <label className="block text-base">
        <span className="text-sm text-muted">Email admin của họ</span>
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
      </label>
      <label className="block text-base">
        <span className="text-sm text-muted">Tên admin</span>
        <input required value={adminName} onChange={(e) => setAdminName(e.target.value)} className={field} />
      </label>
      <label className="block text-base sm:col-span-2">
        <span className="text-sm text-muted">Mật khẩu admin (để trống = tự sinh, hiện một lần)</span>
        <input type="text" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} className={field} />
      </label>
      {message && (
        <p role="alert" className="text-sm text-danger sm:col-span-2">
          {message}
        </p>
      )}
      <div className="sm:col-span-2">
        <button type="submit" disabled={busy} className={primary}>
          Tạo họ và admin
        </button>
      </div>
    </form>
  );
}

function RenameForm({ tree, onDone }: { tree: PlatformTree; onDone: (changed: boolean) => Promise<void> }) {
  const [name, setName] = useState(tree.name);
  const [slug, setSlug] = useState(tree.slug);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidSlug(slug)) {
      setMessage('Slug chỉ gồm chữ thường, số và dấu gạch ngang.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/trees/${tree.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug }),
      });
      if (!response.ok) {
        setMessage(await problem(response));
        return;
      }
      await onDone(true);
    } catch {
      setMessage('Không thể kết nối tới máy chủ.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <label className="block text-base">
        <span className="text-sm text-muted">Tên họ</span>
        <input required value={name} onChange={(e) => setName(e.target.value)} className={field} aria-label={`Tên họ ${tree.name}`} />
      </label>
      <label className="block text-base">
        <span className="text-sm text-muted">Slug (đổi thì link cũ /t/{tree.slug} ngừng dùng được)</span>
        <input required value={slug} onChange={(e) => setSlug(e.target.value)} className={field} aria-label={`Slug của ${tree.name}`} />
      </label>
      {message && (
        <p role="alert" className="text-base text-danger">
          {message}
        </p>
      )}
      <div className="flex gap-x-2">
        <button type="submit" disabled={busy} className={primary}>
          Lưu
        </button>
        <button type="button" onClick={() => void onDone(false)} className={ghost}>
          Huỷ
        </button>
      </div>
    </form>
  );
}
