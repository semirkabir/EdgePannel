# PanelTabs / PanelTab

Horizontal tab bar that sits flush below the panel header. Underline-style active indicator in `--status-live` colour. Horizontally scrollable on overflow with hidden scrollbar.

## Usage

```jsx
import { Panel, PanelTabs, PanelTab } from '@ds/world-monitor';

const [tab, setTab] = React.useState('news');

<Panel title="Intel Feed">
  <PanelTabs>
    <PanelTab active={tab === 'news'} icon="📰" label="News" onClick={() => setTab('news')} />
    <PanelTab active={tab === 'markets'} icon="📊" label="Markets" onClick={() => setTab('markets')} />
    <PanelTab active={tab === 'signals'} icon="⚡" label="Signals" onClick={() => setTab('signals')} />
  </PanelTabs>
  {tab === 'news' && <NewsFeed />}
  {tab === 'markets' && <MarketsView />}
  {tab === 'signals' && <SignalsView />}
</Panel>
```

## CSS classes (direct HTML)

```html
<div class="panel-tabs">
  <button class="panel-tab active">
    <span class="tab-icon">📰</span>
    <span class="tab-label">News</span>
  </button>
  <button class="panel-tab">
    <span class="tab-label">Markets</span>
  </button>
</div>
```

## Styling idiom

Place `PanelTabs` as the first child of `Panel` children — the CSS `panel-content:has(.panel-tabs)` rule removes top padding automatically so tabs sit flush. Use `.panel-tabs--wrap` class on `PanelTabs` for multi-row wrapping tab groups (country deep-dives). Exactly one tab should be `active` at a time.
