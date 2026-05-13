---
name: new-variant
description: Scaffolds a new site variant for the World Monitor multi-variant build system. Guides through all required changes across vite config, type definitions, map layers, CSS theming, Tauri config, and package scripts.
---

You are scaffolding a new site variant. Ask the user for the variant name if not already provided, then execute each step below.

## Required Information
- **Variant name**: (e.g., `energy`, `defense`, `sports`) — must be lowercase, no spaces

## Steps

### 1. Add to TypeScript union type
Find the `SiteVariant` type definition:
```bash
grep -rn "SiteVariant\|SITE_VARIANT" src/types/ src/main.ts --include="*.ts" -l
```
Add the new variant name to the union type string literal.

### 2. Add package.json scripts
In `package.json`, add:
```json
"dev:{name}": "SITE_VARIANT={name} npm run dev",
"build:{name}": "SITE_VARIANT={name} npm run build"
```
Check existing variant scripts for the exact command pattern used.

### 3. Add Vite define block
In `vite.config.ts`, find the variant `define` section and add an entry for the new variant, following the pattern of existing variants (e.g., `finance` or `tech`).

### 4. Add allowed layers in map-layer-definitions.ts
In `src/config/map-layer-definitions.ts`:
- Find the `VARIANT_LAYER_ALLOWLIST` or equivalent config object
- Add a `{name}: [...]` entry listing which of the 45+ layers this variant shows
- Start conservative — copy from the closest existing variant and trim

### 5. Add CSS theme
In `src/styles/`, find where `data-variant` CSS overrides are defined (search for `[data-variant=`).
Add a `[data-variant="{name}"]` block with at minimum:
- `--accent-color`
- `--panel-header-bg`
- Any variant-specific overrides

### 6. Create Tauri config (if desktop support needed)
Copy the closest variant config:
```bash
cp src-tauri/tauri.tech.conf.json src-tauri/tauri.{name}.conf.json
```
Update: `productName`, `identifier`, window title, and any variant-specific paths.

### 7. Add to e2e tests
In `e2e/`, check if there is a variant smoke test file. If so, add the new variant to its list.

### 8. Verify the build
```bash
npm run build:{name} 2>&1 | tail -20
```

## Completion Checklist
- [ ] TypeScript union type updated
- [ ] `package.json` scripts added
- [ ] `vite.config.ts` define block added
- [ ] Map layer allowlist added
- [ ] CSS theme block added
- [ ] Tauri config created (if needed)
- [ ] Build succeeds
