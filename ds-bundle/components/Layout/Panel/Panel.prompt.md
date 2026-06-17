# Panel

The primary content container in World Monitor. Glassmorphic dark surface with a two-pixel accent top-border driven by `--status-live`, a mono-uppercase header, and a scrollable content area.

## Usage

```jsx
import { Panel, SysBtn, StatusChip } from '@ds/world-monitor';

<Panel
  title="Breaking News"
  actions={
    <>
      <StatusChip variant="live">● Live</StatusChip>
      <SysBtn iconOnly aria-label="Fullscreen">⤢</SysBtn>
      <SysBtn iconOnly aria-label="Close">✕</SysBtn>
    </>
  }
>
  {/* scrollable content */}
</Panel>
```

## CSS classes (for direct HTML use)

```html
<div class="wm-panel">
  <div class="wm-panel-header">
    <div class="wm-panel-header-left">
      <span class="wm-panel-title">Panel Title</span>
    </div>
    <!-- optional right-side actions -->
  </div>
  <div class="wm-panel-content">
    <!-- content -->
  </div>
</div>
```

## Styling idiom

Set a fixed height via the parent's layout (grid or flex). The Panel fills 100% height with `flex-direction: column`; `.wm-panel-content` takes the remaining space and scrolls. Pair the header title with a `StatusChip` to show live/offline state. Do not override `--status-live-rgb` per-panel — it is a global accent set by the user's theme.
