# SysFrame

Inset framed surface. Subtle dark background, thin border, inset highlight on the top edge. Used for terminal output areas, metric summaries, nested data blocks, and connection status cards.

## Usage

```jsx
import { SysFrame, SysLabel, StatusChip } from '@ds/world-monitor';

// Terminal / output block
<SysFrame style={{ padding: 12 }}>
  <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>
    {logOutput}
  </pre>
</SysFrame>

// Metric summary
<SysFrame style={{ padding: 14 }}>
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
    <div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700 }}>247</span>
      <SysLabel>Signals / hr</SysLabel>
    </div>
  </div>
</SysFrame>

// With live glow
<SysFrame className="sys-glow--live" style={{ padding: '10px 14px', display: 'flex', gap: 10 }}>
  <span>📡</span>
  <div>Satellite Uplink Active</div>
  <StatusChip variant="live" style={{ marginLeft: 'auto' }}>● Live</StatusChip>
</SysFrame>
```

## CSS classes (direct HTML)

```html
<div class="sys-frame" style="padding: 12px;">…</div>
<!-- with glow -->
<div class="sys-frame sys-glow--live" style="padding: 10px 14px;">…</div>
```

## Styling idiom

SysFrame provides no padding by default — always add `style={{ padding: … }}` or a padding class. Combine with `sys-glow--live`, `sys-glow--high`, or `sys-glow--critical` for live/alert states. Font inside should be `var(--font-mono)` for data/terminal content.
