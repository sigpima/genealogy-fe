# Auth Integration — Design Spec

Date: 2026-08-29
Status: Approved for implementation planning

## Context

`genealogy-web`'s login/signup forms are currently visual-only
(`e.preventDefault()` and nothing else). `genealogy-api` now sets an
httpOnly `access_token` cookie on `POST /auth/login` and exposes
`POST /auth/register`, `POST /auth/logout`, and `GET /auth/me` (see
`genealogy-api`'s `docs/superpowers/specs/2026-08-29-auth-cookie-support-design.md`).

The API runs on a different origin (`http://localhost:8000`) than the
frontend (`http://localhost:3000`). An httpOnly cookie set directly by a
cross-origin API call would only ever be sent back to that API's own
origin — Next.js's own server (middleware, Server Components) would never
see it, because the browser only attaches a cookie to requests going to
the domain that set it. To let Next.js enforce "must be logged in to view
the tree" at the server/edge layer, the frontend proxies API calls
through its own origin first, per the earlier discussion in this
conversation.

## Goals

- Login/signup call the real API and handle success/failure.
- The tree (`/` and `/genealogy-tree`) requires being logged in;
  unauthenticated visitors are redirected to `/login`.
- A visible way to log out.
- Fix a latent double-submit bug noticed while wiring this up (see
  Design).

## Non-goals

- Verifying the JWT's signature/expiry in Next.js middleware — it only
  checks whether the `access_token` cookie is *present*. A present-but-
  expired-or-invalid cookie passes the middleware check and only fails
  once a real API call (e.g. loading Member/Family data, in a later
  phase) actually needs it. Real validation always happens on the API,
  which is the only place holding `JWT_SECRET`.
- "Remember me" / persistent sessions beyond the existing
  `JWT_EXPIRE_MINUTES`-based cookie lifetime.
- A user menu / profile display — just a logout action.

## Design

**Proxy (`next.config.ts`)**: `rewrites()` forwards `/api/:path*` to
`${API_BASE_URL}/:path*`, where `API_BASE_URL` (default
`http://localhost:8000`) is a server-only env var (no `NEXT_PUBLIC_`
prefix — it's read by `next.config.ts`/the Next.js server, never sent to
the browser bundle). All frontend fetches target `/api/...`, never the
backend's origin directly, so the browser only ever talks to its own
origin — this is what makes the `access_token` cookie set by the (proxied)
login response belong to `localhost:3000`.

**Route protection (`src/middleware.ts`)**: redirects to `/login` for
requests to `/` or `/genealogy-tree` that don't carry an `access_token`
cookie. Presence-only check (see Non-goals).

**Login (`src/app/login/components/loginForm.tsx`)**: `onSubmit` calls
`fetch('/api/auth/login', { method: 'POST', credentials: 'include', ... })`
with `{email, password}` (mapped from the existing `loginFields` state
keys). On success, `router.push('/')`. On a non-2xx response, an inline
error message renders under the fields ("Email hoặc mật khẩu không
đúng."). Network failures (`fetch` throwing) show a generic
"can't reach the server" message.

**Signup (`src/app/signup/components/signupForm.tsx` +
`src/constants/formFields.tsx`)**: the backend's `UserCreate` schema has
no username field — it's `email` + `password` + `full_name`. The
signup form's "Username" field is replaced with "Full name" (`id:
"full-name"`) to match, rather than inventing a fake mapping. Before
submitting, the form checks the password and confirm-password fields
match client-side (that field has existed since before this redesign but
was never actually validated) and shows an inline error if not. On
submit, calls `fetch('/api/auth/register', ...)` with
`{email, password, full_name}`. A 409 response shows "Email này đã được
đăng ký."; other failures show a generic error. On success,
`router.push('/login')` (no auto-login — matches the existing UX where
signup and login are separate steps).

**Double-submit bug fix**: `FormAction` renders a `type="submit"` button
whose `onClick` is *also* wired to the same `handleSubmit` the `<form>`'s
`onSubmit` already calls — clicking submit fires it twice. Both
`loginForm.tsx` and `signupForm.tsx` stop passing `handleSubmit` to
`<FormAction>`; the form's `onSubmit` is the only trigger. (This bug
existed before this feature — it was invisible when `handleSubmit` only
called `e.preventDefault()`, since firing that twice has no visible
effect — but a real API call fired twice is a real bug, so it's fixed as
part of touching this code.)

**Logout**: `Header` (`src/components/layout/Header.tsx`) gains an
`onLogout: () => void` prop rendering a small text button next to the
theme settings gear. `page.tsx` implements the handler: `fetch('/api/auth/logout',
{method: 'POST', credentials: 'include'})` then `router.push('/login')`.

**Error text color**: inline error messages need a color the current
theme tokens don't have — `--color-danger`, added per-theme in
`globals.css` (`#DC2626` for `warm`/`modern`, `#F87171` for `elegant` —
verified ≥4.5:1 contrast against that theme's `bg`/`surface` via the same
luminance-contrast method used for the original 3 themes), plus a
`.text-danger` semantic utility class, following the existing
CSS-variable/semantic-class convention (no raw Tailwind color utility).

## Testing

No new pure logic worth a Vitest unit test (the password-match check is
a one-line comparison inline in the submit handler). This is verified by
running `npm run dev` (with `genealogy-api` also running) and exercising
the flow in a browser: register a new user, log in, get redirected away
from `/login` to `/`, reload `/` and confirm no redirect loop, log out
and confirm `/` now redirects to `/login`, and confirm wrong-password /
duplicate-email show the right inline errors.

## Repo/setup notes

- New `.env.example` for this repo: `API_BASE_URL=http://localhost:8000`.
- Running this end-to-end requires `genealogy-api` running locally (`uv
  run uvicorn app.main:app --reload`) with its `FRONTEND_ORIGIN` set to
  `http://localhost:3000` (already the default).
- After implementation, re-run the `init` skill to refresh `CLAUDE.md`.
