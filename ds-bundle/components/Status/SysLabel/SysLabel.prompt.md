# SysLabel

9 px mono uppercase label with tight letter-spacing. The workhorse typographic primitive for section headers, field names, kickers, and metadata labels in the World Monitor operator console.

## Usage

```jsx
import { SysLabel } from '@ds/world-monitor';

// Section header
<SysLabel>Current Threat Assessment</SysLabel>
<hr className="sys-divider" />

// Field label above a value
<div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
  <SysLabel>CII Score</SysLabel>
  <span style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>7.4</span>
</div>

// Kicker / unit label inline
<span style={{ fontSize: 22, fontWeight: 700 }}>142</span>
<SysLabel style={{ marginLeft: 4 }}>events</SysLabel>
```

## Styling idiom

SysLabel renders as a `<span>` with `color: var(--text-dim)`. To use as a block-level header, wrap in a `<div>`. Do not increase font-size — the 9 px size is intentional; pair with `var(--font-mono)` values or large numeric values for visual contrast.
