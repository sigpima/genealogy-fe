# Auth Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire login/signup to the real `genealogy-api`, require login to view the tree, and add a logout action.

**Architecture:** A Next.js rewrite proxies `/api/:path*` to the backend so the httpOnly auth cookie is same-origin with the frontend; `middleware.ts` redirects unauthenticated visitors away from the tree routes based on cookie presence; the login/signup forms call the proxied endpoints and show inline errors.

**Tech Stack:** Same as the existing frontend (Next.js 15 App Router, React 19). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-29-auth-integration-design.md`

## Global Constraints

- Every frontend fetch to the backend goes through `/api/...` (the proxy) — never `http://localhost:8000` directly from browser code.
- `middleware.ts` checks cookie *presence* only — no JWT decoding/verification in the frontend (`JWT_SECRET` stays backend-only).
- New colors go through the existing CSS-variable/semantic-class convention (`--color-danger` / `.text-danger`) — never a raw Tailwind color utility.
- This plan requires `genealogy-api` running locally to verify the actual login/signup/logout flow — its own test suite and cookie behavior are already covered by that repo's own plan; don't re-test backend behavior here, only that the frontend calls it correctly.

---

## File Structure

```
genealogy-web/
  next.config.ts                                     # modified: + rewrites()
  .env.example                                         # new
  src/
    middleware.ts                                       # new
    app/
      globals.css                                        # modified: + --color-danger, .text-danger
      page.tsx                                            # modified: + logout handler, passes onLogout
      login/components/loginForm.tsx                       # modified: real submit, error state
      signup/components/signupForm.tsx                      # modified: real submit, error state, password-match check
    components/
      layout/Header.tsx                                      # modified: + onLogout prop/button
    constants/
      formFields.tsx                                          # modified: signup "Username" -> "Full name"
```

---

### Task 1: Danger color token + API proxy + env

**Files:**
- Modify: `src/app/globals.css`, `next.config.ts`
- Create: `.env.example`

- [ ] **Step 1: Add `--color-danger` to each theme + a `.text-danger` utility**

In `src/app/globals.css`, add `--color-danger: #dc2626;` to the `:root, :root[data-theme='modern']` block and the `:root[data-theme='warm']` block; add `--color-danger: #f87171;` to the `:root[data-theme='elegant']` block (verified ≥4.5:1 contrast against each theme's `bg`/`surface` via the relative-luminance formula before writing this step). Add to the `@layer components` block:

```css
  .text-danger {
    color: var(--color-danger);
  }
```

- [ ] **Step 2: Add the API proxy rewrite**

Replace `next.config.ts`:

```ts
import type { NextConfig } from 'next';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:8000';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_BASE_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 3: Add `.env.example`**

```
API_BASE_URL=http://localhost:8000
```

- [ ] **Step 4: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

- [ ] **Step 5: Verify the proxy actually reaches the backend**

Start the backend: `cd ../genealogy-api && uv run uvicorn app.main:app --reload` (background). Start this project's dev server: `npm run dev` (background). Then:

Run: `curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d "{\"email\":\"proxytest@example.com\",\"password\":\"longenough\",\"full_name\":\"Proxy Test\"}"`
Expected: `201` (proves the frontend's own origin successfully proxied the request through to the FastAPI backend and got its real response back).

Stop both dev servers (kill the port 3000 and 8000 listeners) before continuing to the next task — don't leave them running across tasks, to avoid the `.next` corruption this project has hit before when a build runs concurrently with dev.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css next.config.ts .env.example
git commit -m "feat: add danger color token and API proxy rewrite"
```

---

### Task 2: Route protection middleware

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Write the middleware**

```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PATHS = ['/', '/genealogy-tree'];

export function middleware(request: NextRequest) {
  if (!PROTECTED_PATHS.includes(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get('access_token');
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/genealogy-tree'],
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Verify redirect behavior with Playwright (no backend needed — this only checks cookie presence)**

Start the dev server: `npm run dev`, wait for it to serve.

```js
// scratch script, not committed
import { chromium } from 'playwright';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

const resp1 = await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
console.log('no cookie -> final URL:', page.url());
console.log('no cookie -> status:', resp1.status());

await context.addCookies([
  { name: 'access_token', value: 'fake-for-presence-check', domain: 'localhost', path: '/' },
]);
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
console.log('with cookie -> final URL:', page.url());

await browser.close();
```

Expected: first navigation's final URL ends in `/login`; second navigation's final URL is `http://localhost:3000/` (no redirect).

Stop the dev server before continuing.

- [ ] **Step 4: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add auth route protection middleware"
```

---

### Task 3: Wire login and signup forms to the real API

**Files:**
- Modify: `src/constants/formFields.tsx`, `src/app/login/components/loginForm.tsx`, `src/app/signup/components/signupForm.tsx`

**Interfaces:**
- Consumes: `/api/auth/login`, `/api/auth/register` (proxied, Task 1).

- [ ] **Step 1: Replace the signup "Username" field with "Full name"**

In `src/constants/formFields.tsx`, replace the first entry of `signupFields`:

```ts
  {
    labelText: 'Full name',
    labelFor: 'full-name',
    id: 'full-name',
    name: 'fullName',
    type: 'text',
    autoComplete: 'name',
    isRequired: true,
    placeholder: 'Full name',
  },
```

Also fix the password/confirm-password entries' `autoComplete` values, which were wrong for a signup form (`"current-password"` and the invalid `"confirm-password"` token) — both should be `"new-password"`.

- [ ] **Step 2: Wire the login form**

Replace `src/app/login/components/loginForm.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { loginFields } from '@/constants/formFields';
import FormAction from '@/components/FormAction';
import FormExtra from '@/components/FormExtra';
import Input from '@/components/Input';

const fields = loginFields;
const fieldsState: { [key: string]: string } = {};
fields.forEach((field) => (fieldsState[field.id] = ''));

export default function Login() {
  const router = useRouter();
  const [loginState, setLoginState] = useState(fieldsState);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoginState({ ...loginState, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginState['email-address'],
          password: loginState['password'],
        }),
      });
      if (!response.ok) {
        setError('Email hoặc mật khẩu không đúng.');
        return;
      }
      router.push('/');
    } catch {
      setError('Không thể kết nối tới máy chủ. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
      <div className="-space-y-px">
        {fields.map((field) => (
          <Input
            key={field.id}
            handleChange={handleChange}
            value={loginState[field.id]}
            labelText={field.labelText}
            labelFor={field.labelFor}
            id={field.id}
            name={field.name}
            type={field.type}
            isRequired={field.isRequired}
            placeholder={field.placeholder}
          />
        ))}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <FormExtra />
      <FormAction text={isSubmitting ? 'Đang đăng nhập...' : 'Login'} />
    </form>
  );
}
```

Note `FormAction` no longer receives `handleSubmit` — it was wired to the button's `onClick` *in addition to* the `<form>`'s `onSubmit`, so a real submit fired the handler twice (invisible before this feature since the handler only called `e.preventDefault()`, but would have double-submitted the login/register request). The `<form onSubmit>` alone is sufficient for a `type="submit"` button.

- [ ] **Step 3: Wire the signup form**

Replace `src/app/signup/components/signupForm.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { signupFields } from '@/constants/formFields';
import FormAction from '@/components/FormAction';
import Input from '@/components/Input';

const fields = signupFields;
const fieldsState: { [key: string]: string } = {};
fields.forEach((field) => (fieldsState[field.id] = ''));

export default function Signup() {
  const router = useRouter();
  const [signupState, setSignupState] = useState(fieldsState);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSignupState({ ...signupState, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (signupState['password'] !== signupState['confirm-password']) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: signupState['email-address'],
          password: signupState['password'],
          full_name: signupState['full-name'],
        }),
      });
      if (response.status === 409) {
        setError('Email này đã được đăng ký.');
        return;
      }
      if (!response.ok) {
        setError('Đăng ký thất bại. Vui lòng thử lại.');
        return;
      }
      router.push('/login');
    } catch {
      setError('Không thể kết nối tới máy chủ. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
      <div>
        {fields.map((field) => (
          <Input
            key={field.id}
            handleChange={handleChange}
            value={signupState[field.id]}
            labelText={field.labelText}
            labelFor={field.labelFor}
            id={field.id}
            name={field.name}
            type={field.type}
            isRequired={field.isRequired}
            placeholder={field.placeholder}
          />
        ))}
        {error && <p className="text-sm text-danger">{error}</p>}
        <FormAction text={isSubmitting ? 'Đang đăng ký...' : 'Signup'} />
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

- [ ] **Step 5: Manual browser verification (backend + frontend both running)**

Start `genealogy-api` (`uv run uvicorn app.main:app --reload`) and this project's dev server (`npm run dev`). Then, in a browser (or Playwright): go to `/signup`, submit with mismatched passwords → inline "Mật khẩu xác nhận không khớp." appears, no network call made; fix it and submit → redirected to `/login`; log in with those same credentials on `/login` → redirected to `/`; log in again with a wrong password → inline "Email hoặc mật khẩu không đúng." appears. Confirm no double-submission (only one `POST /auth/register` / `POST /auth/login` per submit — check the backend's terminal log or the browser Network tab).

Stop both dev servers before continuing.

- [ ] **Step 6: Commit**

```bash
git add src/constants/formFields.tsx src/app/login/components/loginForm.tsx src/app/signup/components/signupForm.tsx
git commit -m "feat: wire login/signup forms to genealogy-api, fix double-submit"
```

---

### Task 4: Logout

**Files:**
- Modify: `src/components/layout/Header.tsx`, `src/app/page.tsx`

**Interfaces:**
- Consumes: `/api/auth/logout` (proxied, Task 1).
- Produces: `HeaderProps.onLogout: () => void`.

- [ ] **Step 1: Add the logout button to `Header`**

In `src/components/layout/Header.tsx`, add `onLogout: () => void` to `HeaderProps`, destructure it in the component signature, and change the trailing `<div className="ml-auto">` to:

```tsx
      <div className="ml-auto flex items-center gap-x-3">
        <button type="button" onClick={onLogout} className="text-sm text-muted hover:text-default">
          Đăng xuất
        </button>
        <ThemeSettingsPopover />
      </div>
```

- [ ] **Step 2: Wire the handler in `page.tsx`**

In `src/app/page.tsx`, add `import { useRouter } from 'next/navigation';`, call `const router = useRouter();` inside `Home`, add:

```tsx
  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    router.push('/login');
  }
```

and pass `onLogout={handleLogout}` to `<Header ... />`.

- [ ] **Step 3: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

- [ ] **Step 4: Manual browser verification (backend + frontend both running)**

Log in, land on `/`, click "Đăng xuất" → redirected to `/login`; try to navigate back to `/` directly → middleware redirects back to `/login` (cookie is gone).

Stop both dev servers before continuing.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Header.tsx src/app/page.tsx
git commit -m "feat: add logout"
```

---

### Task 5: Full verification + CLAUDE.md refresh

- [ ] **Step 1: Typecheck, lint, unit tests, build**

Run: `npx tsc --noEmit && npm run lint && npx vitest run && npm run build`
Expected: all four succeed.

- [ ] **Step 2: Full end-to-end walkthrough**

With both `genealogy-api` and this project's dev server running: sign up a new user, get redirected to `/login`, log in, land on `/` with the tree visible, reload `/` (confirm no redirect loop), log out, confirm `/` now redirects to `/login`. Stop both dev servers afterward.

- [ ] **Step 3: Refresh CLAUDE.md**

Invoke the `init` skill (Skill tool, `skill: "init"`) for this repository — it should mention the API proxy, the middleware's cookie-presence-only check, and that login/signup now call the real backend.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: refresh CLAUDE.md for auth integration"
```

---

## Self-Review Notes

- **Spec coverage:** proxy ✓ (Task 1), middleware route protection ✓ (Task 2), login/signup wiring + inline errors ✓ (Task 3), full-name field swap ✓ (Task 3), double-submit fix ✓ (Task 3), logout ✓ (Task 4), danger color token ✓ (Task 1). Non-goals (edge JWT verification, remember-me, user menu) untouched.
- **Placeholder scan:** none — every step has literal code, an exact command, or a concrete manual-verification checklist with expected results.
- **Type consistency:** `HeaderProps.onLogout` (Task 4) matches how `page.tsx` passes it; field ids (`email-address`, `password`, `confirm-password`, `full-name`) are used identically across `formFields.tsx` and both form components.
