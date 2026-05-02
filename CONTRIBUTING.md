# Contributing

Thanks for contributing to `markdown-to-doc`.

## Before you start

- Search existing issues and pull requests before opening a new one.
- For larger features or behavior changes, open an issue first to align on
  scope.
- Keep changes focused. Avoid unrelated refactors in the same pull request.

## Local setup

```bash
bun install
```

## Common commands

```bash
bun run format
bun run lint
bun run typecheck
bun test
bun run build
bun run ci:check
```

## Development expectations

- Runtime code lives under `src/`.
- Public exports must be re-exported from `src/index.ts`.
- Match the existing TypeScript and Biome formatting style.
- Add or update tests when behavior changes.
- Update `README.md` and `CHANGELOG.md` when the public API or user-facing
  behavior changes.

## Pull requests

- Use a clear title and explain the problem and solution.
- Include validation results from `bun run ci:check`.
- Call out breaking changes explicitly.
- Keep documentation in sync with code.

## Release notes

Maintainers handle versioning and releases. Do not publish directly from forks
or pull requests.
