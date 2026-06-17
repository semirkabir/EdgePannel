# SysBtn

Compact operator-console button. Mono-font, bordered, 24 px tall. Used for toolbar actions, panel controls, and inline toggles across the World Monitor interface.

## Usage

```jsx
import { SysBtn } from '@ds/world-monitor';

// Default
<SysBtn onClick={handleExport}>Export</SysBtn>

// Active/selected toggle
<SysBtn active onClick={toggleLiveFeed}>● Live</SysBtn>

// Icon-only (24 × 24)
<SysBtn iconOnly aria-label="Close">✕</SysBtn>

// Disabled
<SysBtn disabled>No data</SysBtn>
```

## Props

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `active` | boolean | false | Brightens border + surface — use for pressed/selected state |
| `iconOnly` | boolean | false | Removes padding, fixes width to 24 px |
| `disabled` | boolean | false | Reduces opacity, disables pointer events |
| All `<button>` attrs | — | — | `onClick`, `type`, `aria-*`, etc. passed through |

## Styling idiom

Style via `active` / `iconOnly` props and the standard button attributes — **do not** add inline styles or extra class names. To show a dot indicator, put it in `children`: `<SysBtn active>● Recording</SysBtn>`. For gap between icon and label, use a text space: `<SysBtn>⚙ Settings</SysBtn>`.
