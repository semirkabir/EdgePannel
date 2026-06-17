# World Monitor Design System — Conventions

World Monitor is a dark-first operator-console interface. The design language is dense, technical, and information-rich: mono-font labels, thin borders on dark surfaces, semantic colour driven by threat/status levels.

## Wrapping and setup

No provider or root wrapper is required. Add `data-theme="light"` to the `<html>` element for light mode; dark is the default. Add `data-accent-color="emerald|amber|sky|rose"` for the live-state accent.

```jsx
// Minimal host page setup
<html data-accent-color="emerald">   {/* optional accent */}
  <head>
    <link rel="stylesheet" href="_ds/world-monitor/styles.css" />
  </head>
  <body>…</body>
</html>
```

## Styling idiom — CSS custom properties

This is a **CSS-variable system**. There are no utility classes like Tailwind. Style layout glue (padding, gap, grid) with inline styles using the token names below. Do NOT invent class names — only the class names from `styles.css` are defined.

### Core surface tokens

| Token | Dark | Light | Use |
|-------|------|-------|-----|
| `var(--bg)` | `#0a0a0a` | `#f8f9fa` | Page / outermost background |
| `var(--surface)` | `#141414` | `#ffffff` | Card / panel background |
| `var(--surface-hover)` | `#1e1e1e` | `#f0f0f0` | Hover state surface |
| `var(--border)` | `#2a2a2a` | `#d4d4d4` | Default border |
| `var(--border-subtle)` | `#1a1a1a` | `#e8e8e8` | Dividers between rows |

### Text tokens

| Token | Use |
|-------|-----|
| `var(--text)` | Primary text |
| `var(--text-secondary)` | Body copy, list items |
| `var(--text-dim)` | Labels, captions, metadata |
| `var(--text-muted)` | Placeholder, less-important |
| `var(--font-mono)` | Mono stack: SF Mono, Cascadia Code… |
| `var(--font-body)` | Sans stack: Inter, system-ui… |

### Semantic colour tokens

| Token | Meaning |
|-------|---------|
| `var(--semantic-critical)` | Failure, highest-threat |
| `var(--semantic-high)` | Elevated risk |
| `var(--semantic-elevated)` | Warning, degraded |
| `var(--semantic-normal)` | OK / nominal |
| `var(--semantic-info)` | Informational, selected |
| `var(--status-live)` | Live / active accent (indigo by default) |

### Motion tokens

```css
transition: opacity var(--motion-fast) var(--ease-standard);  /* 120ms */
transition: transform var(--motion-normal) var(--ease-press);  /* 180ms */
```

## Component class names

| Class | Component |
|-------|-----------|
| `.sys-btn` | Compact mono button — add `.sys-btn--active`, `.sys-btn--icon` |
| `.status-chip .status-chip--{live,info,elevated,critical,neutral}` | Semantic pill badge |
| `.filter-btn` | Pill filter toggle — add `.active` |
| `.risk-badge .risk-badge--{low,med,high,critical}` | Numeric risk score |
| `.data-bar-track` / `.data-bar-fill .data-bar-fill--{level}` | Progress bar |
| `.sys-label` | 9 px mono uppercase label |
| `.sys-divider` | Gradient horizontal rule |
| `.sys-frame` | Inset framed surface |
| `.sys-glow--{live,high,critical}` | Box-shadow glow state |
| `.wm-panel` / `.wm-panel-header` / `.wm-panel-content` | Panel shell |
| `.panel-tabs` / `.panel-tab` / `.panel-tab.active` | Tab navigation |
| `.data-card` / `.data-card-icon` / `.data-card-title` | Icon + text card |

## Idiomatic build example

```jsx
import { Panel, PanelTabs, PanelTab, StatusChip, RiskBadge, DataBar, SysLabel } from '@ds/world-monitor';

function CountryRiskPanel({ country, factors }) {
  const [tab, setTab] = React.useState('risk');
  return (
    <Panel
      title={country.name}
      actions={<StatusChip variant={country.online ? 'live' : 'neutral'}>{country.online ? '● Live' : 'Offline'}</StatusChip>}
      style={{ height: 340 }}
    >
      <PanelTabs>
        <PanelTab active={tab === 'risk'} label="Risk" onClick={() => setTab('risk')} />
        <PanelTab active={tab === 'economy'} label="Economy" onClick={() => setTab('economy')} />
      </PanelTabs>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 0' }}>
        {factors.map(f => (
          <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)' }}>{f.name}</span>
            <DataBar value={f.score} level={f.level} style={{ flex: 1 }} />
            <RiskBadge level={f.level}>{f.score}</RiskBadge>
          </div>
        ))}
      </div>
    </Panel>
  );
}
```
