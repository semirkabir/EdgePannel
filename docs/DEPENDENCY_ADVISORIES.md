# Dependency Advisories

Which dependency security alerts are accepted rather than fixed, and why.

---

## Overview

Dependabot and `npm audit` / `cargo audit` report advisories against every lockfile in
the repo. Most are resolved by a version bump. The ones listed here have no upstream
fix and are deliberately left in place, because the vulnerable code path is not
reachable from this codebase.

Re-check this file when bumping `@huggingface/transformers` or Tauri — an upstream
release may make an entry obsolete.

### Where the lockfiles are

| Lockfile | Ecosystem | Notes |
| --- | --- | --- |
| `package-lock.json` | npm | Main app |
| `scripts/package-lock.json` | npm | Build/maintenance scripts |
| `.kilo/package-lock.json` | npm | Editor plugin; **no `package.json` beside it** |
| `.opencode/package-lock.json` | npm | Editor plugin; **no `package.json` beside it** |
| `src-tauri/Cargo.lock` | cargo | Desktop app + Rust sidecar |

`.kilo` and `.opencode` ship a lockfile with no manifest next to it. Running
`npm audit` inside either directory silently walks up and audits the repo root
instead, reporting the root's results and hiding their own. To audit them, copy the
lockfile to a scratch directory, synthesize a `package.json` from the lockfile's root
`dependencies` block, and audit there.

---

## Accepted: npm

Both reach the tree only through `@huggingface/transformers`, which is already at its
latest release (4.2.0) and constrains them itself — `sharp: ^0.34.5` cannot reach the
patched 0.35.0, and `onnxruntime-node` is pinned to an exact `1.24.3`. `npm audit`
correctly reports "No fix available" for both.

| Advisory | Package | Path |
| --- | --- | --- |
| [GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj) | `sharp` <0.35.0 | `@huggingface/transformers` → `sharp` |
| [GHSA-xcpc-8h2w-3j85](https://github.com/advisories/GHSA-xcpc-8h2w-3j85) | `adm-zip` <0.6.0 | `@huggingface/transformers` → `onnxruntime-node` → `adm-zip` |

**Why they are not exploitable here.** No source file imports `sharp` or
`onnxruntime-node`. ML inference runs browser-side in a Web Worker via
`onnxruntime-web`, which the `overrides` block already pins separately. Both packages
are Node-only and are installed but never loaded.

- `sharp` inherits libvips CVEs that require parsing an untrusted **image**. Nothing
  feeds it one.
- `adm-zip` allocates 4GB on a crafted **ZIP**. Its only caller is `onnxruntime-node`'s
  install script, unpacking that package's own release artifacts.

**Why not force them via `overrides`.** Both are native modules. Overriding `adm-zip`
across the `<0.6.0` → `^0.6.0` major boundary risks breaking `npm install` for
everyone, since it runs during `onnxruntime-node`'s postinstall. That trades a working
install for no real security gain.

---

## Accepted: cargo

`cargo audit` reports 0 vulnerabilities. The remaining ~19 findings are
`unmaintained` / `unsound` *warnings*, not vulnerabilities, and are transitive through
Tauri:

- **GTK3 bindings** — `gtk`, `gtk-sys`, `gtk3-macros`, `gdk`, `gdk-sys`, `gdkx11`,
  `gdkx11-sys`, `gdkwayland-sys`, `atk`, `atk-sys`, `glib`. Pulled in by `webkit2gtk`,
  Tauri's Linux webview. Moving off them is an upstream Tauri decision.
- **`rand` 0.7.3** ([RUSTSEC-2026-0097](https://rustsec.org/advisories/RUSTSEC-2026-0097)) —
  a *build*-dependency of `tauri-build`, via `phf_generator` → `selectors` →
  `kuchikiki`. The 0.7 line has no patched release; the fix lands in ≥0.8.6, which is
  a major bump owned by Tauri's build tooling. Not present at runtime.
- **`fxhash`, `proc-macro-error`, `unic-*`** — unmaintained, transitive, no runtime
  impact.

---

## Auditing

```bash
npm audit --package-lock-only              # root
(cd scripts && npm audit --package-lock-only)
(cd src-tauri && cargo audit)              # needs: cargo install cargo-audit --locked
```

For `.kilo` / `.opencode`, use the scratch-directory procedure described above.
