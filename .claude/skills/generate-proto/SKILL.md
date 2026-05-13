---
name: generate-proto
description: Regenerates all TypeScript proto clients and servers from .proto files using Buf tooling. Use after any .proto file is modified, or when generated files in src/generated/ are out of sync.
---

Run proto generation for this project and report what changed.

## Steps

1. Run lint + generation:
   ```bash
   make check
   ```
   If `make` is not available, run:
   ```bash
   npx buf lint && npx buf generate
   ```

2. If the command fails, show the first 40 lines of error output and stop.

3. If successful, show which files in `src/generated/` were modified:
   ```bash
   git diff --name-only src/generated/
   ```

4. Run type checking to verify generated code compiles:
   ```bash
   npm run typecheck:all 2>&1 | tail -30
   ```

5. Report summary:
   - How many files were regenerated
   - Any type errors introduced
   - Whether a commit is needed for the generated files

## Notes
- Generated files in `src/generated/` are checked into the repo and must be committed alongside proto changes
- Run `make breaking` to check for breaking changes against `main` before merging
- Proto files live in `proto/` across 22 services
