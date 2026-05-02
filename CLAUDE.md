---
description: Use bun  instead of node vite npm pnpm
alwaysApply: false
---
## Guidelines 

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- No unnecessary comments - write self-documenting code.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write goal for invalid inputs, then make them pass"
- "Fix the bug" → "Write a goal that reproduces it, then make it pass"
- "Refactor X" → "Ensure goal pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.


# Repository Guidelines

## Project Structure & Module Organization
This package is a Bun-managed TypeScript SDK for converting Markdown to Docx.

- `src/index.ts`: public export barrel (entrypoint).
- `src/errors/`: custom error classes (for example, `MarkdownToDocError`).
- `src/types/`: shared type definitions.
- `src/utils/`: helper utilities.
- `dist/`: generated build output (do not edit manually).

Keep new runtime logic under `src/` and re-export public APIs from `src/index.ts`.

## Build, Test, and Development Commands
Use Bun for all local workflows:

- `bun install`: install dependencies.
- `bun run format`: format code with Biome.
- `bun run lint`: run static checks with Biome.
- `bun run typecheck`: run strict TypeScript checks (`noEmit`).
- `bun run build`: compile package to `dist/`.
- `bun run clean`: remove build artifacts.

Recommended pre-PR sequence:
`bun run format && bun run lint && bun run typecheck && bun run build`

## Coding Style & Naming Conventions
- Language: TypeScript (`strict: true`).
- Formatting/linting: Biome (`biome.json`), 2-space indentation, semicolons, double quotes.
- File naming:
  - Classes: `PascalCase.ts` (e.g., `MarkdownToDoc.ts`).
  - Utils/types: `kebab-case.ts` (e.g., `convert-markdown-to-docx.ts` if added).
- Keep modules focused: one class per file, types in dedicated type files, errors in `src/errors/`.

## Testing Guidelines
There is currently no test runner configured in this repository. Until tests are added:

- Treat `bun run typecheck` and `bun run lint` as required quality gates.
- Validate behavior changes with small, isolated modules and deterministic error handling.
- If you add tests, place them under `src/**/__tests__/` or a top-level `tests/` directory and document the command in `package.json`.

## Commit & Pull Request Guidelines
Git history is not available in this workspace, so follow a conventional format:

- Commit style: `type(scope): summary` (example: `feat(client): add axios error mapping`).
- Keep commits small and focused.
- Do not use `npm version patch`/`npm version` for releases. Update `package.json` version manually so file formatting stays consistent.
- After manually updating version fields, run `bun run format` once before commit.
- Releases are published by GitHub Actions from `.github/workflows/publish.yml`. Do not run `npm publish` locally for normal releases.
- PRs should include:
  - clear problem/solution summary,
  - affected files/modules,
  - validation results (`format`, `lint`, `typecheck`, `build`),
  - linked issue/task when applicable.

## Release Process
- Update `package.json` version manually to the next release version.
- Run `bun run format` after the version bump.
- Run `bun run ci:check` and confirm it passes before releasing.
- Commit the release changes on `main` using the normal commit style.
- Push the commit to GitHub: `git push origin main`.
- Create an annotated tag that matches the publish workflow pattern `v*.*.*`, for example `git tag -a v1.0.3 -m "v1.0.3"`.
- Push the tag: `git push origin v1.0.3`.
- GitHub Actions will publish the package through `.github/workflows/publish.yml` when the tag push is received.
- Verify the release with `gh run list --workflow "Publish to npm" --limit 3` or in the GitHub Actions UI.
- If the workflow fails, fix the issue, create a new version, and publish with a new tag. Do not reuse or move an existing release tag.



Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.
