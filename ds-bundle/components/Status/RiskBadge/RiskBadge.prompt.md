# RiskBadge

Numeric severity score badge. Typically shows a 0–100 integer alongside a DataBar progress track. Four levels map to distinct colours.

## Levels

| Level | Colour | Range (convention) |
|-------|--------|-------------------|
| `low` | Green `#4caf50` | 0–33 |
| `med` | Yellow `#ffeb3b` | 34–59 |
| `high` | Orange `#ff9800` | 60–79 |
| `critical` | Red `#f44336` | 80–100 |

## Usage

```jsx
import { RiskBadge, DataBar } from '@ds/world-monitor';

function RiskFactor({ name, score, level }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>{name}</span>
      <DataBar value={score} level={level} style={{ flex: 1 }} />
      <RiskBadge level={level}>{score}</RiskBadge>
    </div>
  );
}

<RiskFactor name="Political Stability" score={72} level="high" />
<RiskFactor name="Food Security" score={18} level="low" />
```

## Styling idiom

Always pair a RiskBadge with a `DataBar` at the same `level`. Do not use colour overrides — let the `level` prop drive colour. The badge renders a mono-font number; put only the integer value in `children`.
