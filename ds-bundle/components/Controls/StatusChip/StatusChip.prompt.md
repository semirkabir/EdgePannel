# StatusChip

Bordered semantic pill. Used to communicate connection state, alert level, or data freshness — always uppercase mono text with a coloured border and tinted background.

## Variants

| Variant | Color | Use for |
|---------|-------|---------|
| `live` | Indigo `#6366f1` | Active data stream, connected |
| `info` | Blue `#4a9eff` | Informational, advisory |
| `elevated` | Amber `#ffaa00` | Degraded, delayed, warning |
| `critical` | Red `#ff4444` | Alert, failure, threat |
| `neutral` | Grey | Offline, inactive, disabled |

## Usage

```jsx
import { StatusChip } from '@ds/world-monitor';

<StatusChip variant="live">● Live</StatusChip>
<StatusChip variant="elevated">Delayed</StatusChip>
<StatusChip variant="critical">Alert</StatusChip>
<StatusChip variant="neutral">Offline</StatusChip>
```

## Styling idiom

Choose `variant` based on semantic meaning, not colour preference. For a live pulse dot, put `●` or a small `<span>` in `children` — the chip does not render a dot by itself. Do not override colours with inline styles; use the `variant` prop.
