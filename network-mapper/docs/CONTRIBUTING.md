# Contributing Guide

Thank you for contributing! This document lists the workflow and expectations for code contributions.

## Workflow
- Create a feature branch from `main` (e.g., `feature/undo-redo-tests`).
- Open a Pull Request with a clear description and link to any relevant issue.
- PR should include tests for new behavior when applicable.

## Commit messages
- Use concise messages and reference issues: `feat: add device snapshot on delete (#12)`
- Use conventional prefixes: `feat:`, `fix:`, `chore:`, `docs:`, `test:`

## Testing & Linting
- Python: use `pytest` for backend tests.
- JS: use a headless browser (Playwright/Cypress) or Jest + DOM tests for UI logic.
- Run linters locally before opening PR (add automated checks later):
  - Python: `black` + `flake8` (recommended)
  - JavaScript: keep code tidy (project currently uses vanilla JS; consider `prettier` if adding tooling)

## PR Checklist
- [ ] Branch named appropriately
- [ ] Tests added / updated
- [ ] Lint pass
- [ ] Documentation updated (`docs/*`, `docs/API.md`) if API or behavior changed
- [ ] Manual verification steps described in PR

## Parallel work & coordination
- See `docs/DEVELOPMENT.md` for branch naming, file ownership, CI guidance, and coordination rules when multiple agents or developers work in parallel.

## Code style
- Keep code clear and minimal.
- Add comments for non-obvious logic (especially around history/undo/redo semantics).

Thanks — contributions are welcome and will be reviewed promptly.