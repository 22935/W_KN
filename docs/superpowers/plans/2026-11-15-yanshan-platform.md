# Yanshan Platform Implementation Plan

> **For agentic workers:** Use executing-plans to implement this approved plan inline, task by task. Keep checkpoints here; no new approval is needed to execute the user's approved design.

**Goal:** Deliver the approved local-first platform skeleton with persistent writing, papers, diagrams, AI prompt workflows, assets and publishing.

**Architecture:** npm workspaces separate Astro site, React studio and Express API. Shared content contracts and SQLite storage own private data; existing import and distribution adapters remain compatible. Preserve existing public content paths during this release so article URLs and migration scripts stay stable.

**Tech Stack:** Astro 5, React, Vite, TypeScript, Express 5, Node 22.16+ built-in SQLite, Zod, KaTeX, Mermaid, Playwright.

---

## Task 1 — Workspace and contracts

Files: root `package.json`, `apps/{site,studio,api}/package.json`, `packages/{content,storage,ui,publishers}/package.json`, `packages/content/index.mjs`, `packages/content/index.d.ts`.

- [x] Add npm workspaces `apps/*`, `packages/*`; keep `npm run dev/build/preview/studio/test` working.
- [x] Define validated document kinds `article`, `note`, `paper`, `diagram`; formats `markdown`, `mermaid`; versioned IDs, metadata, paper notes, template and manual AI task payloads.
- [x] Install React/Vite/Mermaid/Zod and type declarations using npm. Pin resolved versions in lockfile. Do not copy upstream application code.
- [x] Check imports with `node --input-type=module -e "import('./packages/content/index.mjs')"` and frontend with `tsc --noEmit -p apps/studio/tsconfig.json` after Task 4.

## Task 2 — Durable storage and migration

Files: `packages/storage/index.mjs`, `packages/storage/backup.mjs`, `studio/lib/store.mjs`, `tests/platform.test.mjs`.

- [x] Use `DatabaseSync` with transactions, WAL and an explicit schema version; tables own entities, immutable revisions and legacy account/job state. All updates compare expected document version.
- [x] Back up old `state.json` before importing, validate it, import drafts by stable IDs and persist a migration marker in the transaction. Legacy drafts are mapped onto the same document records, not maintained as a second writable collection.
- [x] Import existing public Markdown only if its stable source/public ID is absent. Preserve raw body and source date.
- [x] Verify persistence after reopening, repeated migration, version conflict (409), dangling asset prevention and corrupt legacy-file failure in `node --test tests/platform.test.mjs`.
- [x] Export versioned ZIP backup with database snapshot, validated manifest and resource files; restore only on service startup with safe paths and original-data backup.

## Task 3 — API and compatibility

Files: `apps/api/server.mjs`, `apps/api/platform.mjs`, `studio/server.mjs`, `packages/publishers/index.mjs`.

- [x] Move server composition into the API app and retain old startup path as a compatibility import. Keep existing origin/session checks, import routes, account isolation and distribution states.
- [x] Add `/api/v1` capability/state, document CRUD/snapshots, project CRUD, asset import/download/delete, template CRUD, manual AI task CRUD, backup download and preview/publish routes.
- [x] Serve built React studio same-origin; expose existing import/accounts/delivery interface at `/legacy/` while new pages call established adapters. Session token stays in sessionStorage.
- [x] Validate image signatures, PDF header, text files, maximum sizes, generated storage keys and asset references. Stream authenticated resources; do not expose `.local/` statically.
- [x] Verify invalid requests, unauthorized access, state after restart and public/private boundary through API tests.

## Task 4 — React studio and design system

Files: `apps/studio/index.html`, `apps/studio/vite.config.ts`, `apps/studio/src/{main,App,api,types}.tsx/ts`, `apps/studio/src/components/*`, `apps/studio/src/views/*`, `packages/ui/tokens.css`.

- [x] Implement paper/ink/cinnabar tokens, responsive sidebar, page headers, theme persistence, search/filter, keyboard focus, notices and explicit loading/empty/error states.
- [x] Build overview and document library backed by real state. Include project creation/selection, tags, lifecycle, delete handling and immutable snapshots.
- [x] Implement Markdown editor with sanitized preview and KaTeX. Track dirty state, confirm navigation, offer unsaved text download, detect version conflicts and publish only after review.
- [x] Implement paper metadata and three note layers, authenticated PDF object URLs, Mermaid strict-mode preview and source download, draw.io resource import/download, prompt templates/manual AI tasks.
- [x] Implement assets upload/filter/reference view, backup and config settings, plus publishing/account/legacy import entry points. Show exact capability state for deferred features.
- [x] Verify with `npm run check:studio` and `npm run build:studio`.

## Task 5 — Public site and documentation

Files: `apps/site/cli.mjs`, `src/config.ts`, `src/layouts/Base.astro`, `src/pages/{index,studio,papers,diagrams,resources}.astro`, `src/styles/refinements.css`, `README.md`, `THIRD_PARTY.md`, `.env.example`.

- [x] Apply Yanshan brand and concise research/writing copy. Add public catalog routes showing only deliberately published documents and true empty states.
- [x] Keep `src/content/posts` and `src/assets/imported` as the public export boundary in this release. Preserve existing slugs, source links and article rendering.
- [x] Update README with actual commands, SQLite migration/backup/restore instructions, current capabilities and deferred AI/LaTeX/server features.
- [x] Run `npm run check`, `npm run build`, `npm run test:deployment` sequentially where builds share `dist`.

## Task 6 — Browser acceptance and delivery

Files: `tests/platform.e2e.mjs`, existing `tests/browser.e2e.mjs`, plan progress entries.

- [x] Use temporary isolated data for browser tests; preserve the user's `.local` and public articles.
- [x] Verify new article save/reload/version/snapshot, paper layered notes/PDF, Mermaid persistence, template/manual result workflow, uploads, module navigation, theme, 375px layout and missing-session screen.
- [x] Keep legacy browser coverage for import, accounts, delivery isolation; update only brand/entry selectors affected by the new shell.
- [x] Inspect desktop/mobile screenshots and resolve usability defects. Run `npm test`, both browser suites and deployment checks; record exact limitations.
- [x] Commit tested changes and sync approved GitHub/Gitee remotes without force. Verify remote commits and Pages status where available; report deployment separately from push.

## Progress and implementation decisions

- User approved design on 2026-11-15. Execution proceeds inline on a feature branch; no application behavior has changed at plan creation.
- Public-content directory movement is deliberately deferred: the new site app consumes current source paths so existing migration/import/scripts and article resource links stay compatible.

- 2026-11-15 implementation checkpoint: Tasks 1–5 and local browser acceptance are complete. Runtime services use ESM JavaScript with Zod validation; the React client and shared declarations use TypeScript. A complete service TypeScript conversion is deferred to avoid rewriting the proven adapters.
- The Astro workspace entry delegates to the root source tree. Production builds refresh only generated content metadata, preserve image cache, and fail closed if any public article is missing or a draft generated a page.
- SQLite legacy compatibility now preserves lifecycle/metadata and maps private image references for distribution without rewriting untouched documents. Version conflicts expose both drafts; paper-note image references and restored snapshot attachments remain protected.
- Fresh verification: 27 unit/API tests; Astro diagnostics 0 errors / 0 warnings; React TypeScript passed; complete production build passed (37 pages / 28 article search entries); 6 new-workbench browser scenarios and 8 legacy/blog browser scenarios passed. Desktop, editor, diagram and 375px screenshots inspected.
- Deployment acceptance passed with alternate repository subpath and default configuration: actual images, formulas, sanitized article scripts, search links and draft isolation checked. Temporary test articles were removed and the default 28-article build restored.
- CSDN normal migration added 5 real articles (28/78 total) and 9 distinct images (254 total); remaining 50 stopped at HTTP 521. Advanced editor dragging, embedded draw.io, scientific plotting, actual AI calls, PDF annotations/translation, LaTeX compilation and public server hosting remain outside this release.

- Delivery verified: implementation `5f45977` fast-forwarded to main and synchronized to GitHub/Gitee; the public Pages homepage returned the Yanshan brand.
