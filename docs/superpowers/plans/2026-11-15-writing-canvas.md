# Writing Canvas Implementation Plan

> Execute inline under the user's continuing implementation authorization. Keep progress and evidence here; no additional workflow selection is required.

**Goal:** Make articles and notes editable as movable components while preserving their Markdown source and existing persistence flows.

**Architecture:** A shared pure Markdown segment module owns lossless splitting, conservative classification and edits. A separate React canvas owns transient IDs, drag/keyboard sorting and undo. Editor retains the sole document state and sends the existing API payload.

**Tech stack:** React, TypeScript, Marked lexer, dnd-kit, KaTeX, strict Mermaid, Node tests and Playwright.

## 1. Preserve source and define editing operations

- [x] Add `tests/canvas.test.mjs` first: assert missing module API, then exercise every migrated Markdown file, whitespace/CRLF, long fences, formulas, raw syntax and ordering.
- [x] Create `packages/content/canvas.mjs` and matching declarations with `splitMarkdown`, `joinBlocks`, `createBlock`, `readBlock`, `editBlock`, `moveBlock` and boundary repair. `joinBlocks(splitMarkdown(source)) === source` must hold before editing.
- [x] Run `node --test tests/canvas.test.mjs` before and after implementation. Unknown or mismatched lexer output falls back to a raw block.

## 2. Build and connect the canvas

- [x] Add an article/note browser scenario before UI code; verify the new switch is missing. Install dnd-kit via npm and retain the resolved lockfile.
- [x] Create `apps/studio/src/components/BlockCanvas.tsx` and `BlockCanvas.css`, isolating component controls from `Editor.tsx`. Include add palette, editable fields, formula/diagram preview, duplicate/delete, undo/redo, pointer/touch/keyboard sensors and focus after operations.
- [x] Connect a source/canvas toggle for article/note documents only. Pass the same `doc.body` and existing update callback; reload the canvas on externally restored or conflicting source without marking it dirty.
- [x] Add accessible drag handles and move buttons. Keep destructive operations reversible through undo and expose clear empty/error states. Preserve raw blocks rather than interpreting HTML.

## 3. Verify and document

- [x] Browser checks cover no-edit switching, component editing, formulas, Mermaid, drag and keyboard order, undo, saving/reopening and mobile overflow. Inspect desktop and mobile screenshots.
- [x] Update README, settings capability labels and third-party sources to distinguish this component canvas from Tiptap and from future scientific plotting.
- [x] Run `npm test`, `npm run check`, production build and the new/legacy browser suites; inspect generated site article counts and `git diff --check` outside preserved imported Markdown.
- [ ] Commit, integrate with main without force, sync GitHub/Gitee and verify remote SHAs and the public Pages result separately.

## Verification checkpoint

- Original preservation verified against all 28 public Markdown files and their extracted article bodies, plus CRLF, raw HTML, tables, references, long code fences and formula samples. Parser/operation tests were observed failing before the implementation. A separate newline-input regression was reproduced and fixed.
- `npm test`: 32 passed; `npm run check`: Astro 0 errors / 0 warnings and React TypeScript passed. Production build: 37 pages, all 28 public articles and search entries present.
- Workbench browser suite: 8 passed including the parent suite; legacy/blog suite: 9 passed including its parent. Canvas scenario verifies no-edit source switching, mouse dragging, keyboard sorting, duplicate/delete restoration, undo/redo, formula/Mermaid rendering, persisted reopening and mobile movement without horizontal overflow.
- Desktop and 375px canvas screenshots inspected. Canvas history is transient and limited to 60 snapshots; source mode changes reset that temporary history. Full rich text, automatic graphical formula models and public Mermaid image export remain separate work.
