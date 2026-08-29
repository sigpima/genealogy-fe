# Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `genealogy-web`'s UI (configurable color themes, restyled shell, restyled auth pages) and make the family tree genuinely interactive (styled nodes, zoom controls, expand/collapse affordance, name search with centering, a member detail panel) — while fixing the broken TypeScript build.

**Architecture:** Plain CSS custom properties per theme (`:root[data-theme="X"]`) mapped to a semantic Tailwind `@layer components` utility set, switched at runtime via a `ThemeProvider` + localStorage, with an inline FOUC-prevention script. The tree stays on `react-d3-tree`, driven through its documented `translate`/`zoom`/`onUpdate` props plus its (typed, if under-documented) `centerNode`/`generateTree` instance methods accessed via ref for search-driven centering. Pure logic (tree search/path lookups, theme storage) is unit-tested with Vitest; visual/interactive behavior is verified by running `next dev` in a browser.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, `react-d3-tree` (already installed, kept), Vitest (new, unit tests only).

**Spec:** `docs/superpowers/specs/2026-08-29-frontend-redesign-design.md`

## Global Constraints

- No backend integration in this plan — login/signup stay visual-only (`e.preventDefault()`), per the spec's Non-goals.
- No new fields on tree data — `new_treeData.json` only has `name`/`children`; the detail panel shows only what that data has.
- Search is exact, case-insensitive substring match — no diacritic-folding or fuzzy matching.
- All colors read from the 3 theme CSS variable blocks via the semantic utility classes defined in Task 3 (`bg-app`, `bg-surface`, `bg-primary`, `text-default`, `text-muted`, `text-on-primary`, `accent-text`, `border-default`, `fill-surface`, `fill-border`, `fill-primary`, `fill-on-primary`, `fill-text`, `stroke-border`, `stroke-accent`) — never a raw Tailwind color utility (`bg-purple-600`, `text-gray-900`, etc.) in touched files.
- Pure logic gets a Vitest unit test (`src/lib/**/*.test.ts`); visual/interaction behavior is checked by running `npm run dev` and using the feature in a browser — not automated in this plan.
- `npx tsc --noEmit` must pass (0 errors) from Task 1 onward — every later task must keep it passing.

---

## File Structure

```
genealogy-web/
  vitest.config.ts                                    # new
  package.json                                          # modified: name, test script, new devDependencies
  README.md                                              # modified
  src/
    app/
      layout.tsx                                          # modified: Inter font, theme init script, ThemeProvider
      globals.css                                          # modified: theme tokens + semantic utility layer
      page.tsx                                             # modified: shell layout, search state, wiring
      sidebar.tsx                                          # modified: redesigned nav
      loading.tsx, not-found.tsx, error.tsx                 # modified: real content
      global-error.tsx, template.tsx, default.tsx            # deleted
      route.tsx                                               # deleted
      page.module.css                                         # deleted
      genealogy-tree/
        page.tsx                                                # modified: full rewrite
        treeData.json                                            # deleted
        components/card.tsx                                       # deleted
        components/Link/index.tsx                                  # deleted
      login/page.tsx, login/components/loginForm.tsx                # modified: restyle
      signup/page.tsx, signup/components/signupForm.tsx               # modified: restyle
    components/
      auth/AuthHeader.tsx                                             # new (renamed from components/Header.tsx)
      Input.tsx, FormAction.tsx, FormExtra.tsx                         # modified: restyle
      layout/Header.tsx                                                # new
      theme/ThemeProvider.tsx, theme/ThemeSettingsPopover.tsx            # new
      tree/TreeControls.tsx, tree/MemberDetailPanel.tsx                   # new
    lib/
      parser.tsx, validators.tsx                                          # deleted
      theme/themes.ts, theme/storage.ts, theme/storage.test.ts              # new
      tree/types.ts, tree/search.ts, tree/search.test.ts                    # new
```

---

### Task 1: Fix the TypeScript build (delete dead code)

**Files:**
- Delete: `src/app/genealogy-tree/components/card.tsx`, `src/lib/parser.tsx`, `src/lib/validators.tsx`, `src/app/genealogy-tree/components/Link/index.tsx`, `src/app/route.tsx`, `src/app/genealogy-tree/treeData.json`, `src/app/page.module.css`, `src/app/global-error.tsx`, `src/app/template.tsx`, `src/app/default.tsx`
- Modify: `package.json`, `README.md`

- [ ] **Step 1: Confirm the current build failure**

Run: `npx tsc --noEmit`
Expected: FAIL with errors in `card.tsx`, `validators.tsx`, `parser.tsx`, `Link/index.tsx` about `@/types/common` not found.

- [ ] **Step 2: Delete the dead files**

```bash
rm src/app/genealogy-tree/components/card.tsx
rm src/lib/parser.tsx
rm src/lib/validators.tsx
rm -r src/app/genealogy-tree/components/Link
rm src/app/route.tsx
rm src/app/genealogy-tree/treeData.json
rm src/app/page.module.css
rm src/app/global-error.tsx
rm src/app/template.tsx
rm src/app/default.tsx
```

- [ ] **Step 3: Rename the package**

In `package.json`, change:
```json
  "name": "my-project",
```
to:
```json
  "name": "genealogy-web",
```

- [ ] **Step 4: Rewrite README.md**

```markdown
# genealogy-web

Next.js frontend for the genealogy app — an interactive family tree
(zoom/pan, expand/collapse, name search, a member detail panel) with a
runtime-switchable color theme, plus login/signup pages (visual only for
now; wiring to `genealogy-api` is a separate, later piece of work).

## Setup

    npm install

## Run

    npm run dev

## Test

    npm run test        # Vitest unit tests (pure logic only)
    npx tsc --noEmit     # typecheck
    npm run build         # production build
```

- [ ] **Step 5: Verify the build is fixed**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0 (0 errors).

- [ ] **Step 6: Verify production build succeeds**

Run: `npm run build`
Expected: build completes successfully (existing pages still compile — `page.tsx`'s unused `LoginPage` import is left as-is until Task 4, and does not break the build).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: delete dead code breaking the TS build, rename package"
```

---

### Task 2: Vitest + tree search/lookup logic (TDD)

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`
- Create: `src/lib/tree/types.ts`, `src/lib/tree/search.ts`, `src/lib/tree/search.test.ts`

**Interfaces:**
- Produces: `FamilyMember` type; `findMembersByName(root, query): SearchMatch[]`; `findPathToMember(root, target): string[] | null`; `generationOf(path): number`; `getMemberAtPath(root, path): FamilyMember | null`.

- [ ] **Step 1: Install Vitest**

Run: `npm install -D vitest`

- [ ] **Step 2: Add the test script and Vitest config**

In `package.json`'s `"scripts"`, add:
```json
    "test": "vitest run",
```

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 3: Write the failing tests**

```ts
// src/lib/tree/search.test.ts
import { describe, expect, it } from 'vitest';
import { findMembersByName, findPathToMember, generationOf, getMemberAtPath } from './search';
import type { FamilyMember } from './types';

const tree: FamilyMember = {
  name: 'nguyễn đại lan',
  children: [
    {
      name: 'nguyễn văn mít',
      children: [{ name: 'nguyễn văn lãng' }, { name: 'nguyễn văn an' }],
    },
  ],
};

describe('findMembersByName', () => {
  it('finds a case-insensitive substring match and returns its ancestor path', () => {
    const matches = findMembersByName(tree, 'LÃNG');
    expect(matches).toHaveLength(1);
    expect(matches[0].path).toEqual(['nguyễn đại lan', 'nguyễn văn mít', 'nguyễn văn lãng']);
  });

  it('returns multiple matches when the query matches more than one member', () => {
    const matches = findMembersByName(tree, 'văn');
    expect(matches.map((m) => m.member.name)).toEqual([
      'nguyễn văn mít',
      'nguyễn văn lãng',
      'nguyễn văn an',
    ]);
  });

  it('returns an empty array for a blank query', () => {
    expect(findMembersByName(tree, '   ')).toEqual([]);
  });

  it('returns an empty array when nothing matches', () => {
    expect(findMembersByName(tree, 'không tồn tại')).toEqual([]);
  });
});

describe('findPathToMember', () => {
  it('finds the path to a specific member object by reference', () => {
    const target = tree.children![0].children![1];
    expect(findPathToMember(tree, target)).toEqual([
      'nguyễn đại lan',
      'nguyễn văn mít',
      'nguyễn văn an',
    ]);
  });

  it('returns null when the member is not in the tree', () => {
    expect(findPathToMember(tree, { name: 'ai đó' })).toBeNull();
  });
});

describe('generationOf', () => {
  it('returns the 1-indexed generation number from a path', () => {
    expect(generationOf(['a', 'b', 'c'])).toBe(3);
    expect(generationOf(['a'])).toBe(1);
  });
});

describe('getMemberAtPath', () => {
  it('walks the tree by name path and returns the member at the end', () => {
    const member = getMemberAtPath(tree, ['nguyễn đại lan', 'nguyễn văn mít', 'nguyễn văn lãng']);
    expect(member?.name).toBe('nguyễn văn lãng');
  });

  it('returns null when the path does not match the tree', () => {
    expect(getMemberAtPath(tree, ['nguyễn đại lan', 'không tồn tại'])).toBeNull();
  });

  it('returns null when the path does not start at the root', () => {
    expect(getMemberAtPath(tree, ['nguyễn văn mít'])).toBeNull();
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run src/lib/tree/search.test.ts`
Expected: FAIL with `Cannot find module './search'` (or similar resolution error).

- [ ] **Step 5: Write the implementation**

```ts
// src/lib/tree/types.ts
export type FamilyMember = {
  name: string;
  children?: FamilyMember[];
};
```

```ts
// src/lib/tree/search.ts
import type { FamilyMember } from './types';

export type SearchMatch = {
  member: FamilyMember;
  path: string[];
};

export function findMembersByName(root: FamilyMember, query: string): SearchMatch[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  const matches: SearchMatch[] = [];

  function walk(node: FamilyMember, path: string[]) {
    const nextPath = [...path, node.name];
    if (normalize(node.name).includes(normalizedQuery)) {
      matches.push({ member: node, path: nextPath });
    }
    node.children?.forEach((child) => walk(child, nextPath));
  }

  walk(root, []);
  return matches;
}

export function findPathToMember(root: FamilyMember, target: FamilyMember): string[] | null {
  function walk(node: FamilyMember, path: string[]): string[] | null {
    const nextPath = [...path, node.name];
    if (node === target) return nextPath;
    for (const child of node.children ?? []) {
      const found = walk(child, nextPath);
      if (found) return found;
    }
    return null;
  }
  return walk(root, []);
}

export function generationOf(path: string[]): number {
  return path.length;
}

export function getMemberAtPath(root: FamilyMember, path: string[]): FamilyMember | null {
  if (path.length === 0 || path[0] !== root.name) return null;
  let current = root;
  for (const segment of path.slice(1)) {
    const next = current.children?.find((child) => child.name === segment);
    if (!next) return null;
    current = next;
  }
  return current;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/lib/tree/search.test.ts`
Expected: 9 passed

- [ ] **Step 7: Commit**

```bash
git add package.json vitest.config.ts src/lib/tree
git commit -m "feat: add tree search/lookup logic with Vitest"
```

---

### Task 3: Theme config/storage (TDD) + CSS tokens

**Files:**
- Create: `src/lib/theme/themes.ts`, `src/lib/theme/storage.ts`, `src/lib/theme/storage.test.ts`
- Modify: `src/app/globals.css`, `package.json`

**Interfaces:**
- Produces: `ThemeId`, `THEMES: ThemeOption[]`, `DEFAULT_THEME`, `isThemeId()`, `THEME_STORAGE_KEY`, `getStoredTheme(): ThemeId`, `setStoredTheme(id): void`; CSS custom properties `--color-bg/-surface/-primary/-accent/-text/-text-muted/-border/-on-primary` per `data-theme`, plus semantic classes listed in Global Constraints.

- [ ] **Step 1: Install jsdom (needed for the storage test's `window`/`localStorage`)**

Run: `npm install -D jsdom`

- [ ] **Step 2: Write the failing tests**

```ts
// src/lib/theme/storage.test.ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { THEME_STORAGE_KEY, getStoredTheme, setStoredTheme } from './storage';

beforeEach(() => {
  window.localStorage.clear();
});

describe('getStoredTheme', () => {
  it('returns the default theme when nothing is stored', () => {
    expect(getStoredTheme()).toBe('modern');
  });

  it('returns the stored theme when it is a valid id', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'warm');
    expect(getStoredTheme()).toBe('warm');
  });

  it('falls back to the default when the stored value is invalid', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'not-a-theme');
    expect(getStoredTheme()).toBe('modern');
  });
});

describe('setStoredTheme', () => {
  it('persists the theme id for later retrieval', () => {
    setStoredTheme('elegant');
    expect(getStoredTheme()).toBe('elegant');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/theme/storage.test.ts`
Expected: FAIL with `Cannot find module './storage'`.

- [ ] **Step 4: Write the implementation**

```ts
// src/lib/theme/themes.ts
export type ThemeId = 'warm' | 'modern' | 'elegant';

export type ThemeOption = {
  id: ThemeId;
  label: string;
  swatch: { bg: string; primary: string };
};

export const THEMES: ThemeOption[] = [
  { id: 'warm', label: 'Ấm / truyền thống', swatch: { bg: '#FBF7F2', primary: '#B85A34' } },
  { id: 'modern', label: 'Hiện đại tối giản', swatch: { bg: '#F8FAFC', primary: '#2563EB' } },
  { id: 'elegant', label: 'Sang trọng tối màu', swatch: { bg: '#14110F', primary: '#D4AF37' } },
];

export const DEFAULT_THEME: ThemeId = 'modern';

export function isThemeId(value: string | null): value is ThemeId {
  return value === 'warm' || value === 'modern' || value === 'elegant';
}
```

```ts
// src/lib/theme/storage.ts
import { DEFAULT_THEME, isThemeId, type ThemeId } from './themes';

export const THEME_STORAGE_KEY = 'genealogy-web:theme';

export function getStoredTheme(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function setStoredTheme(id: ThemeId): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    // localStorage unavailable (private browsing, disabled) - theme just won't persist
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/theme/storage.test.ts`
Expected: 4 passed

- [ ] **Step 6: Replace `globals.css` with the theme tokens and semantic utility layer**

These exact color values were verified to meet WCAG AA (4.5:1) for text/background and on-primary/primary pairs (computed via the relative-luminance formula) before writing this step.

```css
@import 'tailwindcss';

:root,
:root[data-theme='modern'] {
  --color-bg: #f8fafc;
  --color-surface: #ffffff;
  --color-primary: #2563eb;
  --color-accent: #2563eb;
  --color-text: #0f172a;
  --color-text-muted: #64748b;
  --color-border: #e2e8f0;
  --color-on-primary: #ffffff;
}

:root[data-theme='warm'] {
  --color-bg: #fbf7f2;
  --color-surface: #ffffff;
  --color-primary: #b85a34;
  --color-accent: #b85a34;
  --color-text: #2b211b;
  --color-text-muted: #7a6a5d;
  --color-border: #e8ddd0;
  --color-on-primary: #ffffff;
}

:root[data-theme='elegant'] {
  --color-bg: #14110f;
  --color-surface: #1f1b18;
  --color-primary: #d4af37;
  --color-accent: #d4af37;
  --color-text: #f5efe6;
  --color-text-muted: #b8aa98;
  --color-border: #332c25;
  --color-on-primary: #14110f;
}

@layer components {
  .bg-app {
    background-color: var(--color-bg);
  }
  .bg-surface {
    background-color: var(--color-surface);
  }
  .bg-primary {
    background-color: var(--color-primary);
  }
  .text-default {
    color: var(--color-text);
  }
  .text-muted {
    color: var(--color-text-muted);
  }
  .text-on-primary {
    color: var(--color-on-primary);
  }
  .accent-text {
    color: var(--color-accent);
  }
  .border-default {
    border-color: var(--color-border);
  }
  .fill-surface {
    fill: var(--color-surface);
  }
  .fill-border {
    fill: var(--color-border);
  }
  .fill-primary {
    fill: var(--color-primary);
  }
  .fill-on-primary {
    fill: var(--color-on-primary);
  }
  .fill-text {
    fill: var(--color-text);
  }
  .stroke-border {
    stroke: var(--color-border);
  }
  .stroke-accent {
    stroke: var(--color-accent);
  }
}

body {
  background-color: var(--color-bg);
  color: var(--color-text);
}
```

- [ ] **Step 7: Commit**

```bash
git add package.json src/lib/theme src/app/globals.css
git commit -m "feat: add 3 configurable color themes with CSS variable tokens"
```

---

### Task 4: Theme system UI + app shell (Header, Sidebar, layout wiring)

**Files:**
- Create: `src/components/theme/ThemeProvider.tsx`, `src/components/theme/ThemeSettingsPopover.tsx`, `src/components/layout/Header.tsx`
- Modify: `src/app/layout.tsx`, `src/app/sidebar.tsx`, `src/app/page.tsx`

**Interfaces:**
- Consumes: `THEMES`, `DEFAULT_THEME`, `ThemeId` (Task 3 `themes.ts`); `getStoredTheme`, `setStoredTheme` (Task 3 `storage.ts`).
- Produces: `ThemeProvider` (wraps the app, exposes `useTheme()`); `Header` component with props `searchQuery: string`, `onSearchQueryChange: (q: string) => void`, `searchResults: { key: string; label: string; onSelect: () => void }[]` (consumed for real in Task 6; passed empty/no-op here).

- [ ] **Step 1: Create the theme provider**

```tsx
// src/components/theme/ThemeProvider.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { DEFAULT_THEME, type ThemeId } from '@/lib/theme/themes';
import { getStoredTheme, setStoredTheme } from '@/lib/theme/storage';

type ThemeContextValue = {
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    setThemeState(getStoredTheme());
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  function setTheme(id: ThemeId) {
    setThemeState(id);
    setStoredTheme(id);
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
```

- [ ] **Step 2: Create the theme settings popover**

```tsx
// src/components/theme/ThemeSettingsPopover.tsx
'use client';

import { useState } from 'react';
import { THEMES } from '@/lib/theme/themes';
import { useTheme } from './ThemeProvider';

export function ThemeSettingsPopover() {
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Chọn giao diện màu"
        aria-expanded={open}
        className="flex size-9 items-center justify-center rounded-full border-default border text-default hover:bg-app"
      >
        <GearIcon />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border-default border bg-surface p-2 shadow-md">
          {THEMES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setTheme(option.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-x-3 rounded-lg px-3 py-2 text-left text-sm text-default hover:bg-app ${
                theme === option.id ? 'bg-app' : ''
              }`}
            >
              <span
                className="size-4 rounded-full border-default border"
                style={{ backgroundColor: option.swatch.bg }}
              />
              <span className="size-4 rounded-full" style={{ backgroundColor: option.swatch.primary }} />
              <span>{option.label}</span>
              {theme === option.id && <span className="ml-auto text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GearIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
```

- [ ] **Step 3: Create the app header**

```tsx
// src/components/layout/Header.tsx
'use client';

import { ThemeSettingsPopover } from '@/components/theme/ThemeSettingsPopover';

export type HeaderSearchResult = {
  key: string;
  label: string;
  onSelect: () => void;
};

export type HeaderProps = {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchResults: HeaderSearchResult[];
};

export function Header({ searchQuery, onSearchQueryChange, searchResults }: HeaderProps) {
  return (
    <header className="relative flex items-center gap-x-4 border-default border-b bg-surface px-4 py-3">
      <div className="relative w-full max-w-sm">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="Tìm theo tên..."
          className="w-full rounded-lg border-default border bg-app px-3 py-2 text-sm text-default placeholder:text-muted focus:outline-none"
        />
        {searchQuery && searchResults.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border-default border bg-surface shadow-md">
            {searchResults.map((result) => (
              <li key={result.key}>
                <button
                  type="button"
                  onClick={result.onSelect}
                  className="block w-full px-3 py-2 text-left text-sm text-default hover:bg-app"
                >
                  {result.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="ml-auto">
        <ThemeSettingsPopover />
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Redesign the sidebar**

```tsx
// src/app/sidebar.tsx
export default function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-default border-e bg-surface lg:flex">
      <div className="flex items-center gap-x-2 px-4 py-4">
        <span className="text-lg font-semibold text-default">Gia Phả</span>
      </div>
      <nav className="flex-1 px-2">
        <ul className="space-y-1">
          <li>
            <a
              href="/"
              className="flex min-h-9 items-center gap-x-3 rounded-lg bg-app px-3 py-2 text-sm text-default"
            >
              Cây gia phả
            </a>
          </li>
        </ul>
      </nav>
    </aside>
  );
}
```

- [ ] **Step 5: Wire the theme init script + ThemeProvider into the root layout**

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Gia Phả',
  description: 'Ứng dụng quản lý và xem cây gia phả',
};

// Keep this literal string in sync with THEME_STORAGE_KEY in src/lib/theme/storage.ts —
// it can't import that constant since it must run as a plain inline script, before hydration.
const THEME_INIT_SCRIPT = `
try {
  var t = window.localStorage.getItem('genealogy-web:theme');
  if (t === 'warm' || t === 'modern' || t === 'elegant') {
    document.documentElement.setAttribute('data-theme', t);
  }
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${inter.variable} bg-app text-default antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Wire the shell into the home page**

```tsx
// src/app/page.tsx
'use client';

import { Header } from '@/components/layout/Header';
import GenealogyTree from './genealogy-tree/page';
import Sidebar from './sidebar';

export default function Home() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header searchQuery="" onSearchQueryChange={() => {}} searchResults={[]} />
        <div className="flex-1 overflow-hidden">
          <GenealogyTree />
        </div>
      </div>
    </div>
  );
}
```

This drops the unused `LoginPage` import (was dead code — `LoginPage` was imported but never rendered).

- [ ] **Step 7: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed with no errors.

- [ ] **Step 8: Manual browser verification**

Run: `npm run dev`, open `http://localhost:3000`.
Confirm: sidebar shows only "Gia Phả" branding and "Cây gia phả" (no "Dashboard"/"Calendar"/"Documentation"); header shows a search input and a gear icon; clicking the gear opens a popover with 3 swatches; selecting a theme changes the background/accent colors immediately; reloading the page keeps the previously selected theme with no visible flash of the wrong theme.

- [ ] **Step 9: Commit**

```bash
git add src/components/theme src/components/layout src/app/layout.tsx src/app/sidebar.tsx src/app/page.tsx
git commit -m "feat: add configurable theme system and redesigned app shell"
```

---

### Task 5: Styled, interactive tree (node renderer + zoom controls)

**Files:**
- Create: `src/components/tree/TreeControls.tsx`
- Modify: `src/app/genealogy-tree/page.tsx`

**Interfaces:**
- Produces: `TreeControls` (props `onZoomIn`, `onZoomOut`, `onReset`); `GenealogyTree` gains `dimensions`, a `treeRef`, a real `onUpdate`-driven `zoom`/`translate`, and a styled `renderNode` with an expand/collapse affordance. (Search/detail-panel wiring is Task 6 — this task focuses on the visual/zoom half.)

- [ ] **Step 1: Create the zoom controls**

```tsx
// src/components/tree/TreeControls.tsx
'use client';

export type TreeControlsProps = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
};

export function TreeControls({ onZoomIn, onZoomOut, onReset }: TreeControlsProps) {
  return (
    <div className="absolute bottom-4 right-4 z-30 flex flex-col gap-y-2">
      <button
        type="button"
        onClick={onZoomIn}
        aria-label="Phóng to"
        className="size-9 rounded-full border-default border bg-surface text-default shadow-md hover:bg-app"
      >
        +
      </button>
      <button
        type="button"
        onClick={onZoomOut}
        aria-label="Thu nhỏ"
        className="size-9 rounded-full border-default border bg-surface text-default shadow-md hover:bg-app"
      >
        −
      </button>
      <button
        type="button"
        onClick={onReset}
        aria-label="Về vị trí ban đầu"
        className="size-9 rounded-full border-default border bg-surface text-default shadow-md hover:bg-app"
      >
        ⟳
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite the tree page with a styled node renderer and working zoom controls**

`react-d3-tree`'s `Tree` class re-applies its D3 zoom transform whenever its `zoom`/`translate` props change (confirmed by reading `node_modules/react-d3-tree/lib/esm/Tree/index.js`'s `componentDidUpdate`/`bindZoomListener`), and reports the live transform back via `onUpdate` on every pan/zoom/drag. Syncing `onUpdate`'s reported values back into the `zoom`/`translate` state we feed back as props keeps the two in sync without fighting the user's current pan position.

```tsx
// src/app/genealogy-tree/page.tsx
'use client';

import dynamic from 'next/dynamic';
import React, { useRef, useState } from 'react';
import type { CustomNodeElementProps } from 'react-d3-tree';
import treeData from './new_treeData.json';
import { TreeControls } from '@/components/tree/TreeControls';
import type { FamilyMember } from '@/lib/tree/types';

const Tree = dynamic(() => import('react-d3-tree'), { ssr: false });

const familyTree = treeData as FamilyMember;

const INITIAL_ZOOM = 0.9;
const SCALE_EXTENT = { min: 0.3, max: 2.5 };

export default function GenealogyTree() {
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [initialTranslate, setInitialTranslate] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const treeRef = useRef(null);

  const handleContainerRef = (containerRef: HTMLDivElement | null) => {
    if (containerRef && !dimensions) {
      const rect = containerRef.getBoundingClientRect();
      const centered = { x: rect.width / 2, y: rect.height / 6 };
      setTranslate(centered);
      setInitialTranslate(centered);
      setDimensions({ width: rect.width, height: rect.height });
    }
  };

  function renderNode({ nodeDatum, toggleNode }: CustomNodeElementProps) {
    const hasChildren = Boolean(nodeDatum.children && nodeDatum.children.length > 0);
    const isCollapsed = nodeDatum.__rd3t.collapsed;

    return (
      <g>
        <rect
          width={200}
          height={70}
          x={-100}
          y={-35}
          rx={14}
          ry={14}
          className="fill-surface stroke-border"
          style={{ strokeWidth: 1.5 }}
        />
        <text x={0} y={0} textAnchor="middle" dominantBaseline="middle" className="fill-text text-sm">
          {nodeDatum.name}
        </text>
        {hasChildren && (
          <g
            transform="translate(85, -25)"
            style={{ cursor: 'pointer' }}
            onClick={(event) => {
              event.stopPropagation();
              toggleNode();
            }}
          >
            <circle r={10} className="fill-primary" />
            <text
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-on-primary text-xs"
              style={{ pointerEvents: 'none' }}
            >
              {isCollapsed ? '+' : '−'}
            </text>
          </g>
        )}
      </g>
    );
  }

  return (
    <div ref={handleContainerRef} className="relative h-full w-full overflow-hidden bg-app">
      <Tree
        ref={treeRef}
        data={familyTree}
        dimensions={dimensions ?? undefined}
        renderCustomNodeElement={renderNode}
        nodeSize={{ x: 250, y: 150 }}
        translate={translate}
        zoomable
        zoom={zoom}
        scaleExtent={SCALE_EXTENT}
        orientation="vertical"
        collapsible
        separation={{ siblings: 0.8, nonSiblings: 1.5 }}
        pathFunc="step"
        draggable
        onUpdate={({ zoom: liveZoom, translate: liveTranslate }) => {
          setZoom(liveZoom);
          setTranslate(liveTranslate);
        }}
      />
      <TreeControls
        onZoomIn={() => setZoom((z) => Math.min(SCALE_EXTENT.max, z * 1.2))}
        onZoomOut={() => setZoom((z) => Math.max(SCALE_EXTENT.min, z / 1.2))}
        onReset={() => {
          setZoom(INITIAL_ZOOM);
          setTranslate(initialTranslate);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors. (`treeRef` is untyped here — Task 6 introduces its exact shape once it's actually used.)

- [ ] **Step 4: Manual browser verification**

Run: `npm run dev`, open the app.
Confirm: nodes render as rounded cards with visible borders following the current theme; nodes with children show a circular +/− badge; clicking the badge collapses/expands that branch; the +/−/⟳ buttons in the bottom-right zoom in, zoom out, and reset the view; scrolling/dragging on the canvas still works as before.

- [ ] **Step 5: Commit**

```bash
git add src/components/tree/TreeControls.tsx src/app/genealogy-tree/page.tsx
git commit -m "feat: styled tree node renderer and zoom controls"
```

---

### Task 6: Search wiring + member detail panel

**Files:**
- Create: `src/components/tree/MemberDetailPanel.tsx`
- Modify: `src/app/genealogy-tree/page.tsx`, `src/app/page.tsx`

**Interfaces:**
- Consumes: `findMembersByName`, `getMemberAtPath` (Task 2 `lib/tree/search.ts`); `Header` (Task 4, now used with real `searchQuery`/`searchResults`).
- Produces: `MemberDetailPanel` (props `name`, `generation`, `ancestorPath`, `children: {name, onSelect}[]`, `onClose`); `GenealogyTree` gains a `focusRequest?: { path: string[]; token: number } | null` prop that recenters the view on that path when it changes.

- [ ] **Step 1: Create the member detail panel**

```tsx
// src/components/tree/MemberDetailPanel.tsx
'use client';

export type MemberDetailPanelChild = {
  name: string;
  onSelect: () => void;
};

export type MemberDetailPanelProps = {
  name: string;
  generation: number;
  ancestorPath: string[];
  children: MemberDetailPanelChild[];
  onClose: () => void;
};

export function MemberDetailPanel({
  name,
  generation,
  ancestorPath,
  children,
  onClose,
}: MemberDetailPanelProps) {
  const ancestors = ancestorPath.slice(0, -1);

  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-80 overflow-y-auto border-default border-l bg-surface p-4 shadow-lg">
      <button type="button" onClick={onClose} className="mb-4 text-sm text-muted hover:text-default">
        Đóng ✕
      </button>
      <h2 className="text-lg font-semibold text-default">{name}</h2>
      <p className="mt-1 text-sm text-muted">Đời thứ {generation}</p>

      {ancestors.length > 0 && <p className="mt-4 text-xs text-muted">{ancestors.join(' → ')}</p>}

      {children.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-default">Con ({children.length})</h3>
          <ul className="mt-2 space-y-1">
            {children.map((child) => (
              <li key={child.name}>
                <button type="button" onClick={child.onSelect} className="text-sm text-default hover:accent-text">
                  {child.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
```

- [ ] **Step 2: Wire search, click-to-open-panel, and search-driven centering into the tree page**

```tsx
// src/app/genealogy-tree/page.tsx
'use client';

import dynamic from 'next/dynamic';
import React, { useEffect, useRef, useState } from 'react';
import type { HierarchyPointNode } from 'd3-hierarchy';
import type { CustomNodeElementProps, TreeNodeDatum } from 'react-d3-tree';
import treeData from './new_treeData.json';
import { MemberDetailPanel } from '@/components/tree/MemberDetailPanel';
import { TreeControls } from '@/components/tree/TreeControls';
import { getMemberAtPath } from '@/lib/tree/search';
import type { FamilyMember } from '@/lib/tree/types';

const Tree = dynamic(() => import('react-d3-tree'), { ssr: false });

const familyTree = treeData as FamilyMember;

export type FocusRequest = {
  path: string[];
  token: number;
};

type SelectedMember = {
  name: string;
  generation: number;
  ancestorPath: string[];
  childrenNames: string[];
};

type TreeInstanceHandle = {
  generateTree: () => { nodes: HierarchyPointNode<TreeNodeDatum>[] };
  centerNode: (node: HierarchyPointNode<TreeNodeDatum>) => void;
};

function pathOfHierarchyNode(node: HierarchyPointNode<TreeNodeDatum>): string[] {
  return node
    .ancestors()
    .reverse()
    .map((ancestor) => ancestor.data.name);
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

const INITIAL_ZOOM = 0.9;
const SCALE_EXTENT = { min: 0.3, max: 2.5 };

export default function GenealogyTree({ focusRequest }: { focusRequest?: FocusRequest | null }) {
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [initialTranslate, setInitialTranslate] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [highlightedName, setHighlightedName] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<SelectedMember | null>(null);
  // react-d3-tree doesn't export a clean ref-typed public API; `generateTree`/`centerNode`
  // are real (non-private) instance methods used here the same way the library uses them
  // internally to center a clicked node. Verified against node_modules/react-d3-tree source.
  const treeRef = useRef<TreeInstanceHandle | null>(null);

  const handleContainerRef = (containerRef: HTMLDivElement | null) => {
    if (containerRef && !dimensions) {
      const rect = containerRef.getBoundingClientRect();
      const centered = { x: rect.width / 2, y: rect.height / 6 };
      setTranslate(centered);
      setInitialTranslate(centered);
      setDimensions({ width: rect.width, height: rect.height });
    }
  };

  useEffect(() => {
    if (!focusRequest || !treeRef.current) return;
    const { nodes } = treeRef.current.generateTree();
    const target = nodes.find((node) => arraysEqual(pathOfHierarchyNode(node), focusRequest.path));
    if (!target) return;
    treeRef.current.centerNode(target);
    setHighlightedName(target.data.name);
    const timer = setTimeout(() => setHighlightedName(null), 2000);
    return () => clearTimeout(timer);
  }, [focusRequest]);

  function handleNodeClick(hierarchyPointNode: HierarchyPointNode<TreeNodeDatum>) {
    const ancestorPath = pathOfHierarchyNode(hierarchyPointNode);
    const childrenNames = hierarchyPointNode.data.children?.map((child) => child.name) ?? [];
    setSelectedMember({
      name: hierarchyPointNode.data.name,
      generation: ancestorPath.length,
      ancestorPath,
      childrenNames,
    });
  }

  function handleSelectChild(childName: string) {
    if (!selectedMember) return;
    const newPath = [...selectedMember.ancestorPath, childName];
    const member = getMemberAtPath(familyTree, newPath);
    if (!member) return;
    setSelectedMember({
      name: member.name,
      generation: newPath.length,
      ancestorPath: newPath,
      childrenNames: member.children?.map((child) => child.name) ?? [],
    });
  }

  function renderNode({ nodeDatum, hierarchyPointNode, toggleNode }: CustomNodeElementProps) {
    const hasChildren = Boolean(nodeDatum.children && nodeDatum.children.length > 0);
    const isCollapsed = nodeDatum.__rd3t.collapsed;
    const isHighlighted = nodeDatum.name === highlightedName;

    return (
      <g>
        <rect
          width={200}
          height={70}
          x={-100}
          y={-35}
          rx={14}
          ry={14}
          className="fill-surface stroke-border"
          style={{
            strokeWidth: isHighlighted ? 3 : 1.5,
            stroke: isHighlighted ? 'var(--color-accent)' : undefined,
          }}
          onClick={() => handleNodeClick(hierarchyPointNode)}
        />
        <text
          x={0}
          y={0}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-text text-sm"
          onClick={() => handleNodeClick(hierarchyPointNode)}
        >
          {nodeDatum.name}
        </text>
        {hasChildren && (
          <g
            transform="translate(85, -25)"
            style={{ cursor: 'pointer' }}
            onClick={(event) => {
              event.stopPropagation();
              toggleNode();
            }}
          >
            <circle r={10} className="fill-primary" />
            <text
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-on-primary text-xs"
              style={{ pointerEvents: 'none' }}
            >
              {isCollapsed ? '+' : '−'}
            </text>
          </g>
        )}
      </g>
    );
  }

  return (
    <div ref={handleContainerRef} className="relative h-full w-full overflow-hidden bg-app">
      <Tree
        // @ts-expect-error react-d3-tree's exported type doesn't model its class instance ref through next/dynamic
        ref={treeRef}
        data={familyTree}
        dimensions={dimensions ?? undefined}
        renderCustomNodeElement={renderNode}
        nodeSize={{ x: 250, y: 150 }}
        translate={translate}
        zoomable
        zoom={zoom}
        scaleExtent={SCALE_EXTENT}
        orientation="vertical"
        collapsible
        separation={{ siblings: 0.8, nonSiblings: 1.5 }}
        pathFunc="step"
        draggable
        onUpdate={({ zoom: liveZoom, translate: liveTranslate }) => {
          setZoom(liveZoom);
          setTranslate(liveTranslate);
        }}
      />
      <TreeControls
        onZoomIn={() => setZoom((z) => Math.min(SCALE_EXTENT.max, z * 1.2))}
        onZoomOut={() => setZoom((z) => Math.max(SCALE_EXTENT.min, z / 1.2))}
        onReset={() => {
          setZoom(INITIAL_ZOOM);
          setTranslate(initialTranslate);
        }}
      />
      {selectedMember && (
        <MemberDetailPanel
          name={selectedMember.name}
          generation={selectedMember.generation}
          ancestorPath={selectedMember.ancestorPath}
          children={selectedMember.childrenNames.map((childName) => ({
            name: childName,
            onSelect: () => handleSelectChild(childName),
          }))}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire real search state into the home page**

```tsx
// src/app/page.tsx
'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import GenealogyTree, { type FocusRequest } from './genealogy-tree/page';
import treeData from './genealogy-tree/new_treeData.json';
import Sidebar from './sidebar';
import { findMembersByName } from '@/lib/tree/search';
import type { FamilyMember } from '@/lib/tree/types';

const familyTree = treeData as FamilyMember;

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);

  const matches = findMembersByName(familyTree, searchQuery);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          searchResults={matches.map((match) => ({
            key: match.path.join(' > '),
            label: match.path.join(' → '),
            onSelect: () => setFocusRequest({ path: match.path, token: Date.now() }),
          }))}
        />
        <div className="flex-1 overflow-hidden">
          <GenealogyTree focusRequest={focusRequest} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Manual browser verification**

Run: `npm run dev`.
Confirm: (a) clicking a node's body (not its +/− badge) opens the right-side panel showing its name, generation number, ancestor breadcrumb, and a clickable list of children; clicking a listed child re-targets the panel to that child; (b) typing a name in the header search shows a results dropdown; selecting a result recenters the tree view on that person and briefly highlights their node border. If `treeRef.current` turns out to be `null` at runtime (check via a temporary `console.log` in the `focusRequest` effect) — meaning `next/dynamic` isn't forwarding the ref through to the `Tree` class instance — remove the centering call but keep the highlight/expand-nothing behavior as a documented fallback, and note this in the commit message.

- [ ] **Step 6: Commit**

```bash
git add src/components/tree/MemberDetailPanel.tsx src/app/genealogy-tree/page.tsx src/app/page.tsx
git commit -m "feat: wire name search with centering and a member detail panel"
```

---

### Task 7: Restyle login/signup + fill in Next.js special files

**Files:**
- Create: `src/components/auth/AuthHeader.tsx` (renamed from `src/components/Header.tsx`)
- Delete: `src/components/Header.tsx`
- Modify: `src/components/Input.tsx`, `src/components/FormAction.tsx`, `src/components/FormExtra.tsx`, `src/app/login/page.tsx`, `src/app/signup/page.tsx`, `src/app/signup/components/signupForm.tsx`, `src/app/loading.tsx`, `src/app/not-found.tsx`, `src/app/error.tsx`

- [ ] **Step 1: Rename `Header` to `AuthHeader` and restyle it**

```bash
git mv src/components/Header.tsx src/components/auth/AuthHeader.tsx
```

```tsx
// src/components/auth/AuthHeader.tsx
import Link from 'next/link';

type AuthHeaderProps = {
  heading: string;
  paragraph: string;
  linkName: string;
  linkUrl?: string;
};

export default function AuthHeader({ heading, paragraph, linkName, linkUrl = '#' }: AuthHeaderProps) {
  return (
    <div className="mb-10">
      <h2 className="mt-6 text-center text-3xl font-extrabold text-default">{heading}</h2>
      <p className="mt-2 text-center text-sm text-muted">
        {paragraph} <Link href={linkUrl} className="font-medium accent-text hover:underline">{linkName}</Link>
      </p>
    </div>
  );
}
```

This drops the broken external `ik.imagekit.io` placeholder logo entirely rather than replacing it with another placeholder — there's no real logo asset for this app yet.

- [ ] **Step 2: Restyle `Input.tsx`**

```tsx
// src/components/Input.tsx
const fixedInputClass =
  'rounded-lg appearance-none relative block w-full px-3 py-2 border border-default bg-surface placeholder:text-muted text-default focus:outline-none focus:ring-2 sm:text-sm ';

type InputProps = {
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  value: string;
  labelFor: string;
  labelText: string;
  id: string;
  name: string;
  type: string;
  isRequired?: boolean;
  placeholder?: string;
  customClass?: string;
};

export default function Input({
  handleChange,
  value,
  labelFor,
  labelText,
  id,
  name,
  type,
  isRequired = false,
  placeholder,
  customClass,
}: InputProps) {
  return (
    <div className="my-5">
      <label htmlFor={labelFor} className="sr-only">
        {labelText}
      </label>

      <input
        onChange={handleChange}
        value={value}
        id={id}
        name={name}
        type={type}
        required={isRequired}
        className={fixedInputClass + customClass}
        placeholder={placeholder}
      />
    </div>
  );
}
```

- [ ] **Step 3: Restyle `FormAction.tsx`**

```tsx
// src/components/FormAction.tsx
type FormActionProps = {
  handleSubmit?: React.MouseEventHandler<HTMLButtonElement>;
  type?: 'Button' | 'Link';
  action?: 'submit' | 'reset' | 'button';
  text: string;
};

export default function FormAction({ handleSubmit, type = 'Button', action = 'submit', text }: FormActionProps) {
  if (type !== 'Button') return null;
  return (
    <button
      type={action}
      className="group relative mt-10 flex w-full justify-center rounded-lg border border-transparent bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:opacity-90 focus:outline-none focus:ring-2"
      onClick={handleSubmit}
    >
      {text}
    </button>
  );
}
```

- [ ] **Step 4: Restyle `FormExtra.tsx`**

```tsx
// src/components/FormExtra.tsx
export default function FormExtra() {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <input id="remember-me" name="remember-me" type="checkbox" className="size-4 rounded border-default" />
        <label htmlFor="remember-me" className="ml-2 block text-sm text-default">
          Remember me
        </label>
      </div>

      <div className="text-sm">
        <a href="#" className="font-medium accent-text hover:underline">
          Forgot your password?
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Update the login/signup pages to use `AuthHeader` and the new page background**

```tsx
// src/app/login/page.tsx
import AuthHeader from '@/components/auth/AuthHeader';
import Login from './components/loginForm';

export default function LoginPage() {
  return (
    <div className="flex h-screen min-h-full items-center justify-center bg-app px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <AuthHeader
          heading="Login to your account"
          paragraph="Don't have an account yet? "
          linkName="Signup"
          linkUrl="/signup"
        />
        <Login />
      </div>
    </div>
  );
}
```

```tsx
// src/app/signup/page.tsx
import AuthHeader from '@/components/auth/AuthHeader';
import Signup from './components/signupForm';

export default function SignupPage() {
  return (
    <div className="flex h-screen min-h-full items-center justify-center bg-app px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <AuthHeader
          heading="Create a new account"
          paragraph="Already have an account? "
          linkName="Login"
          linkUrl="/login"
        />
        <Signup />
      </div>
    </div>
  );
}
```

(Adjust the exact `Signup` import name to whatever `signupForm.tsx` currently default-exports if different — check before editing.)

- [ ] **Step 6: Remove the stray `console.log` in `signupForm.tsx`**

Find and delete the line `console.log(signupState)` (or equivalent) in `src/app/signup/components/signupForm.tsx`.

- [ ] **Step 7: Fill in the empty Next.js special files**

```tsx
// src/app/loading.tsx
export default function Loading() {
  return (
    <div className="flex h-screen items-center justify-center bg-app">
      <div className="size-8 animate-spin rounded-full border-2 border-default border-t-transparent" />
    </div>
  );
}
```

```tsx
// src/app/not-found.tsx
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
```

```tsx
// src/app/error.tsx
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
```

- [ ] **Step 8: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed with no errors.

- [ ] **Step 9: Manual browser verification**

Run: `npm run dev`, open `/login` and `/signup`.
Confirm: no more purple/gray hardcoded colors or the broken external logo image; both pages follow the current theme; submitting either form still just does nothing externally-visible (expected — no backend wiring this round) without throwing a console error.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: restyle auth pages, fill in Next.js special files"
```

---

### Task 8: Full verification + CLAUDE.md

**Files:**
- None created by this task's own steps except `CLAUDE.md` (generated by the `init` skill).

- [ ] **Step 1: Full typecheck, lint, unit tests, and build**

Run: `npx tsc --noEmit && npm run lint && npx vitest run && npm run build`
Expected: all four succeed (0 typecheck errors, 0 lint errors, all Vitest tests passing, production build completes).

- [ ] **Step 2: Full manual browser pass**

Run: `npm run dev`. Walk through: home page shell (sidebar + header + theme switcher across all 3 themes), tree zoom/pan/expand/collapse, search-and-center, click-to-open detail panel and child navigation, `/login`, `/signup`, and an intentionally-broken URL to see `not-found.tsx`.

- [ ] **Step 3: Generate CLAUDE.md**

Invoke the `init` skill (Skill tool, `skill: "init"`) for this repository to generate `CLAUDE.md` documenting the actual resulting structure.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md"
```

---

## Self-Review Notes

- **Spec coverage:** TS build fix ✓ (Task 1), 3 configurable themes + settings popover + persistence + FOUC prevention ✓ (Tasks 3-4), redesigned sidebar/header ✓ (Task 4), styled tree + zoom controls + expand/collapse affordance ✓ (Task 5), search + centering + detail panel ✓ (Task 6), auth page restyle + special files ✓ (Task 7), Vitest for pure logic only / manual browser verification for interaction ✓ (Tasks 2, 3, and the manual-verification steps throughout), CLAUDE.md ✓ (Task 8). Non-goals (backend wiring, new data fields, fuzzy search, E2E automation, library swap) are respected throughout — nothing in any task touches them.
- **Placeholder scan:** no TBD/TODO; every step has literal code, an exact shell command, or a concrete manual-verification checklist. The one explicitly-flagged uncertainty (whether `next/dynamic` forwards the ref to `Tree`'s class instance) has a stated, concrete fallback rather than being left open.
- **Type consistency:** `FamilyMember` (Task 2) is used identically in `search.ts`, `genealogy-tree/page.tsx`, and `page.tsx`. `SelectedMember`/`MemberDetailPanelProps` field names match between Task 6's two files. `HeaderProps`/`HeaderSearchResult` (Task 4) match how Task 6 constructs `searchResults`. `FocusRequest` is defined once (Task 6, `genealogy-tree/page.tsx`) and imported by `page.tsx`, not redefined.
