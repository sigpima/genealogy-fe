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
