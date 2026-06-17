/* @ds-bundle: {"namespace":"WorldMonitor","components":[{"name":"AccentSwatch","sourcePath":"components/Controls/AccentSwatch/AccentSwatch.jsx"},{"name":"FilterBtn","sourcePath":"components/Controls/FilterBtn/FilterBtn.jsx"},{"name":"MapControlBtn","sourcePath":"components/Controls/MapControlBtn/MapControlBtn.jsx"},{"name":"NotifBell","sourcePath":"components/Controls/NotifBell/NotifBell.jsx"},{"name":"StatusChip","sourcePath":"components/Controls/StatusChip/StatusChip.jsx"},{"name":"SysBtn","sourcePath":"components/Controls/SysBtn/SysBtn.jsx"},{"name":"TimeRangeSelector","sourcePath":"components/Controls/TimeRangeSelector/TimeRangeSelector.jsx"},{"name":"DataCard","sourcePath":"components/Data/DataCard/DataCard.jsx"},{"name":"MetricBlock","sourcePath":"components/Data/MetricBlock/MetricBlock.jsx"},{"name":"SanctionCard","sourcePath":"components/Data/SanctionCard/SanctionCard.jsx"},{"name":"TagChip","sourcePath":"components/Data/TagChip/TagChip.jsx"},{"name":"PanelEmpty","sourcePath":"components/Feedback/PanelEmpty/PanelEmpty.jsx"},{"name":"PanelError","sourcePath":"components/Feedback/PanelError/PanelError.jsx"},{"name":"PanelLoading","sourcePath":"components/Feedback/PanelLoading/PanelLoading.jsx"},{"name":"Panel","sourcePath":"components/Layout/Panel/Panel.jsx"},{"name":"PanelTabs","sourcePath":"components/Layout/PanelTabs/PanelTabs.jsx"},{"name":"SysDivider","sourcePath":"components/Layout/SysDivider/SysDivider.jsx"},{"name":"SysFrame","sourcePath":"components/Layout/SysFrame/SysFrame.jsx"},{"name":"Modal","sourcePath":"components/Overlay/Modal/Modal.jsx"},{"name":"SearchModal","sourcePath":"components/Overlay/SearchModal/SearchModal.jsx"},{"name":"DataBar","sourcePath":"components/Status/DataBar/DataBar.jsx"},{"name":"RiskBadge","sourcePath":"components/Status/RiskBadge/RiskBadge.jsx"},{"name":"SysLabel","sourcePath":"components/Status/SysLabel/SysLabel.jsx"}],"sourceHashes":{"components/Controls/AccentSwatch/AccentSwatch.d.ts":"820c2cc1ba39","components/Controls/AccentSwatch/AccentSwatch.prompt.md":"b2f7f8ae7142","components/Controls/FilterBtn/FilterBtn.d.ts":"d27e7801a08f","components/Controls/FilterBtn/FilterBtn.prompt.md":"ed65455f4f4e","components/Controls/MapControlBtn/MapControlBtn.d.ts":"3334ee4b832c","components/Controls/MapControlBtn/MapControlBtn.prompt.md":"6a67621dcf6d","components/Controls/NotifBell/NotifBell.d.ts":"139014265cce","components/Controls/NotifBell/NotifBell.prompt.md":"281b6ed7ab8c","components/Controls/StatusChip/StatusChip.d.ts":"3fa447a06554","components/Controls/StatusChip/StatusChip.prompt.md":"d560f185a297","components/Controls/SysBtn/SysBtn.d.ts":"db326500e4fe","components/Controls/SysBtn/SysBtn.prompt.md":"15f86e409e50","components/Controls/TimeRangeSelector/TimeRangeSelector.d.ts":"7bdee2882a06","components/Controls/TimeRangeSelector/TimeRangeSelector.prompt.md":"a8dd859730c6","components/Data/DataCard/DataCard.d.ts":"10fc15e97d29","components/Data/DataCard/DataCard.prompt.md":"c2138bf87535","components/Data/MetricBlock/MetricBlock.d.ts":"fe6b77ed6968","components/Data/MetricBlock/MetricBlock.prompt.md":"b5b7348029e8","components/Data/SanctionCard/SanctionCard.d.ts":"045f1163cff1","components/Data/SanctionCard/SanctionCard.prompt.md":"f87bbd1a88e3","components/Data/TagChip/TagChip.d.ts":"79a83b5d852d","components/Data/TagChip/TagChip.prompt.md":"e2ca8e5e00a0","components/Feedback/PanelEmpty/PanelEmpty.d.ts":"a1fd473ec608","components/Feedback/PanelEmpty/PanelEmpty.prompt.md":"6a42c093710c","components/Feedback/PanelError/PanelError.d.ts":"18aab9b0741c","components/Feedback/PanelError/PanelError.prompt.md":"bd4fb6443ea2","components/Feedback/PanelLoading/PanelLoading.d.ts":"07e5e1a58ea9","components/Feedback/PanelLoading/PanelLoading.prompt.md":"b3ab8a9287ab","components/Layout/Panel/Panel.d.ts":"012c1d6a89ad","components/Layout/Panel/Panel.prompt.md":"0ab2e3cfebc7","components/Layout/PanelTabs/PanelTabs.d.ts":"1da60955b091","components/Layout/PanelTabs/PanelTabs.prompt.md":"5e70f5b24e84","components/Layout/SysDivider/SysDivider.d.ts":"d72d54344a00","components/Layout/SysDivider/SysDivider.prompt.md":"54aa45d7b408","components/Layout/SysFrame/SysFrame.d.ts":"701300e7bfb2","components/Layout/SysFrame/SysFrame.prompt.md":"fbb2f1560db1","components/Overlay/Modal/Modal.d.ts":"d6d51f48e347","components/Overlay/Modal/Modal.prompt.md":"bcaba80c7f49","components/Overlay/SearchModal/SearchModal.d.ts":"530e2389108f","components/Overlay/SearchModal/SearchModal.prompt.md":"a4e6b729c526","components/Status/DataBar/DataBar.d.ts":"37c0cff066e8","components/Status/DataBar/DataBar.prompt.md":"c2af470a902c","components/Status/RiskBadge/RiskBadge.d.ts":"21dcfb5260ed","components/Status/RiskBadge/RiskBadge.prompt.md":"e7b67dec1025","components/Status/SysLabel/SysLabel.d.ts":"49472b665ae7","components/Status/SysLabel/SysLabel.prompt.md":"a04b8c8b81a1"},"inlinedExternals":[],"builtBy":"cc-design-sync"} */
(function () {
  'use strict';
  var React = window.React;
  var h = React.createElement;

  // ─── SysLabel ───────────────────────────────────────────────
  function SysLabel(_ref) {
    var children = _ref.children, className = _ref.className || '', rest = Object.assign({}, _ref);
    delete rest.children; delete rest.className;
    return h('span', Object.assign({ className: ['sys-label', className].filter(Boolean).join(' ') }, rest), children);
  }

  // ─── SysBtn ─────────────────────────────────────────────────
  function SysBtn(_ref) {
    var children = _ref.children, active = _ref.active, iconOnly = _ref.iconOnly,
        disabled = _ref.disabled, className = _ref.className || '', rest = Object.assign({}, _ref);
    delete rest.children; delete rest.active; delete rest.iconOnly;
    delete rest.disabled; delete rest.className;
    var cls = ['sys-btn', active && 'sys-btn--active', iconOnly && 'sys-btn--icon', className]
      .filter(Boolean).join(' ');
    return h('button', Object.assign({ className: cls, disabled: disabled }, rest), children);
  }

  // ─── StatusChip ─────────────────────────────────────────────
  function StatusChip(_ref) {
    var children = _ref.children, variant = _ref.variant || 'neutral',
        className = _ref.className || '', rest = Object.assign({}, _ref);
    delete rest.children; delete rest.variant; delete rest.className;
    var cls = ['status-chip', 'status-chip--' + variant, className].filter(Boolean).join(' ');
    return h('span', Object.assign({ className: cls }, rest), children);
  }

  // ─── FilterBtn ──────────────────────────────────────────────
  function FilterBtn(_ref) {
    var children = _ref.children, active = _ref.active,
        className = _ref.className || '', rest = Object.assign({}, _ref);
    delete rest.children; delete rest.active; delete rest.className;
    var cls = ['filter-btn', active && 'active', className].filter(Boolean).join(' ');
    return h('button', Object.assign({ className: cls }, rest), children);
  }

  // ─── RiskBadge ──────────────────────────────────────────────
  function RiskBadge(_ref) {
    var children = _ref.children, level = _ref.level || 'low',
        className = _ref.className || '', rest = Object.assign({}, _ref);
    delete rest.children; delete rest.level; delete rest.className;
    var cls = ['risk-badge', 'risk-badge--' + level, className].filter(Boolean).join(' ');
    return h('span', Object.assign({ className: cls }, rest), children);
  }

  // ─── DataBar ────────────────────────────────────────────────
  function DataBar(_ref) {
    var value = _ref.value || 0, level = _ref.level, className = _ref.className || '', rest = Object.assign({}, _ref);
    delete rest.value; delete rest.level; delete rest.className;
    var fillCls = ['data-bar-fill', level && 'data-bar-fill--' + level].filter(Boolean).join(' ');
    return h('div', Object.assign({ className: ['data-bar-track', className].filter(Boolean).join(' ') }, rest),
      h('div', { className: fillCls, style: { width: Math.min(100, Math.max(0, value)) + '%' } })
    );
  }

  // ─── SysDivider ─────────────────────────────────────────────
  function SysDivider(_ref) {
    var className = _ref && _ref.className || '';
    return h('hr', { className: ['sys-divider', className].filter(Boolean).join(' ') });
  }

  // ─── SysFrame ───────────────────────────────────────────────
  function SysFrame(_ref) {
    var children = _ref.children, className = _ref.className || '', rest = Object.assign({}, _ref);
    delete rest.children; delete rest.className;
    return h('div', Object.assign({ className: ['sys-frame', className].filter(Boolean).join(' ') }, rest), children);
  }

  // ─── PanelTabs + PanelTab ────────────────────────────────────
  function PanelTabs(_ref) {
    var children = _ref.children, className = _ref.className || '', rest = Object.assign({}, _ref);
    delete rest.children; delete rest.className;
    return h('div', Object.assign({ className: ['panel-tabs', className].filter(Boolean).join(' ') }, rest), children);
  }

  function PanelTab(_ref) {
    var children = _ref.children, active = _ref.active,
        icon = _ref.icon, label = _ref.label,
        className = _ref.className || '', rest = Object.assign({}, _ref);
    delete rest.children; delete rest.active; delete rest.icon; delete rest.label; delete rest.className;
    var cls = ['panel-tab', active && 'active', className].filter(Boolean).join(' ');
    return h('button', Object.assign({ className: cls }, rest),
      icon && h('span', { className: 'tab-icon' }, icon),
      h('span', { className: 'tab-label' }, label || children)
    );
  }

  // ─── Panel (wm-panel shell) ──────────────────────────────────
  function Panel(_ref) {
    var children = _ref.children, title = _ref.title, actions = _ref.actions,
        className = _ref.className || '', rest = Object.assign({}, _ref);
    delete rest.children; delete rest.title; delete rest.actions; delete rest.className;
    return h('div', Object.assign({ className: ['wm-panel', className].filter(Boolean).join(' ') }, rest),
      (title || actions) && h('div', { className: 'wm-panel-header' },
        h('div', { className: 'wm-panel-header-left' },
          h('span', { className: 'wm-panel-title' }, title)
        ),
        actions
      ),
      h('div', { className: 'wm-panel-content' }, children)
    );
  }

  // ─── DataCard ───────────────────────────────────────────────
  function DataCard(_ref) {
    var children = _ref.children, icon = _ref.icon, title = _ref.title,
        meta = _ref.meta, className = _ref.className || '', rest = Object.assign({}, _ref);
    delete rest.children; delete rest.icon; delete rest.title; delete rest.meta; delete rest.className;
    return h('div', Object.assign({ className: ['data-card', className].filter(Boolean).join(' ') }, rest),
      icon && h('div', { className: 'data-card-icon' }, icon),
      h('div', { className: 'data-card-main' },
        title && h('div', { className: 'data-card-title' }, title),
        meta && h('div', { className: 'data-card-meta' }, meta),
        children
      )
    );
  }

  // ─── PanelLoading (radar sweep) ─────────────────────────────
  function PanelLoading(_ref) {
    var text = (_ref && _ref.text) || 'Loading…';
    var className = (_ref && _ref.className) || '';
    return h('div', { className: ['panel-loading', className].filter(Boolean).join(' ') },
      h('div', { className: 'panel-loading-radar' },
        h('div', { className: 'panel-radar-sweep' }),
        h('div', { className: 'panel-radar-dot' })
      ),
      h('div', { className: 'panel-loading-text' }, text)
    );
  }

  // ─── PanelEmpty ─────────────────────────────────────────────
  function PanelEmpty(_ref) {
    var children = _ref && _ref.children, className = (_ref && _ref.className) || '';
    var rest = Object.assign({}, _ref);
    delete rest.children; delete rest.className;
    return h('div', Object.assign({ className: ['panel-empty', className].filter(Boolean).join(' ') }, rest), children);
  }

  // ─── PanelError ─────────────────────────────────────────────
  function PanelError(_ref) {
    var message = (_ref && _ref.message) || 'Failed to load data';
    var sub = _ref && _ref.sub;
    var countdown = _ref && _ref.countdown;
    var onRetry = _ref && _ref.onRetry;
    var className = (_ref && _ref.className) || '';
    return h('div', { className: ['panel-error-state', className].filter(Boolean).join(' ') },
      h('div', { className: 'panel-error-radar panel-loading-radar' },
        h('div', { className: 'panel-radar-sweep' }),
        h('div', { className: 'panel-radar-dot error' })
      ),
      h('div', { className: 'panel-error-msg' }, message),
      sub && h('div', { className: 'panel-error-sub' }, sub),
      countdown && h('div', { className: 'panel-error-countdown' }, 'Retrying in ' + countdown + 's'),
      onRetry && h('button', { className: 'panel-error-retry-btn', onClick: onRetry }, 'Retry')
    );
  }

  // ─── TimeRangeSelector ──────────────────────────────────────
  function TimeRangeSelector(_ref) {
    var options = (_ref && _ref.options) || ['1h', '6h', '24h', '7d', '30d'];
    var value = _ref && _ref.value;
    var onChange = _ref && _ref.onChange;
    var className = (_ref && _ref.className) || '';
    return h('div', { className: ['time-slider-buttons', className].filter(Boolean).join(' ') },
      options.map(function(opt) {
        return h('button', {
          key: opt,
          className: ['time-btn', value === opt && 'active'].filter(Boolean).join(' '),
          onClick: onChange && function() { onChange(opt); }
        }, opt);
      })
    );
  }

  // ─── MapControlBtn ──────────────────────────────────────────
  function MapControlBtn(_ref) {
    var children = _ref && _ref.children, className = (_ref && _ref.className) || '';
    var rest = Object.assign({}, _ref);
    delete rest.children; delete rest.className;
    return h('button', Object.assign({ className: ['map-control-btn', className].filter(Boolean).join(' ') }, rest), children);
  }

  // ─── AccentSwatch ───────────────────────────────────────────
  function AccentSwatch(_ref) {
    var color = (_ref && _ref.color) || '#6366f1';
    var name = (_ref && _ref.name) || '';
    var active = _ref && _ref.active;
    var className = (_ref && _ref.className) || '';
    var rest = Object.assign({}, _ref);
    delete rest.color; delete rest.name; delete rest.active; delete rest.className;
    var cls = ['accent-swatch', active && 'active', className].filter(Boolean).join(' ');
    return h('div', Object.assign({ className: cls, style: { '--swatch-color': color } }, rest),
      h('div', { className: 'accent-swatch-chip' }),
      name && h('span', { className: 'accent-swatch-name' }, name)
    );
  }

  // ─── NotifBell ──────────────────────────────────────────────
  function NotifBell(_ref) {
    var count = (_ref && _ref.count) || 0;
    var urgency = (_ref && _ref.urgency) || 'attention';
    var className = (_ref && _ref.className) || '';
    var rest = Object.assign({}, _ref);
    delete rest.count; delete rest.urgency; delete rest.className;
    return h('div', Object.assign({ className: ['notif-center', className].filter(Boolean).join(' ') }, rest),
      h('button', { className: 'notif-bell-btn' },
        h('span', { style: { fontSize: 14 } }, '🔔'),
        count > 0 && h('span', { className: 'notif-badge badge--' + urgency }, count)
      )
    );
  }

  // ─── TagChip ────────────────────────────────────────────────
  function TagChip(_ref) {
    var children = _ref && _ref.children, className = (_ref && _ref.className) || '';
    var rest = Object.assign({}, _ref);
    delete rest.children; delete rest.className;
    return h('span', Object.assign({ className: ['rule-tag', className].filter(Boolean).join(' ') }, rest), children);
  }

  // ─── MetricBlock ────────────────────────────────────────────
  function MetricBlock(_ref) {
    var value = _ref && _ref.value, label = _ref && _ref.label;
    var color = _ref && _ref.color, size = (_ref && _ref.size) || 24;
    var className = (_ref && _ref.className) || '';
    var rest = Object.assign({}, _ref);
    delete rest.value; delete rest.label; delete rest.color; delete rest.size; delete rest.className;
    return h('div', Object.assign({ className: ['wm-metric', className].filter(Boolean).join(' '),
        style: { display: 'flex', flexDirection: 'column', gap: 3 } }, rest),
      h('span', { style: {
        fontFamily: 'var(--font-mono)', fontSize: size, fontWeight: 700,
        lineHeight: 1.1, color: color || 'var(--text)', fontVariantNumeric: 'tabular-nums'
      } }, value),
      label && h('span', { className: 'sys-label' }, label)
    );
  }

  // ─── SanctionCard ───────────────────────────────────────────
  function SanctionCard(_ref) {
    var icon = _ref && _ref.icon, name = _ref && _ref.name;
    var flags = _ref && _ref.flags, meta = _ref && _ref.meta;
    var source = _ref && _ref.source, programs = _ref && _ref.programs;
    var className = (_ref && _ref.className) || '';
    var rest = Object.assign({}, _ref);
    delete rest.icon; delete rest.name; delete rest.flags; delete rest.meta;
    delete rest.source; delete rest.programs; delete rest.className;
    return h('div', Object.assign({ className: ['sanction-card', className].filter(Boolean).join(' ') }, rest),
      h('div', { className: 'sanction-card-icon' }, icon || '🏛'),
      h('div', { className: 'sanction-card-main' },
        h('div', { className: 'sanction-card-header' },
          h('span', { className: 'sanction-name' }, name),
          flags && h('span', { className: 'sanction-flags' }, flags)
        ),
        (meta || source) && h('div', { className: 'sanction-card-meta' },
          source && h('span', { className: 'sanction-source-badge' }, source),
          meta && h('span', null, meta)
        ),
        programs && programs.length > 0 && h('div', { className: 'sanction-card-programs' },
          programs.map(function(p, i) { return h('span', { key: i, className: 'sanction-program' }, p); })
        )
      )
    );
  }

  // ─── Modal ──────────────────────────────────────────────────
  function Modal(_ref) {
    var children = _ref && _ref.children, title = _ref && _ref.title;
    var onClose = _ref && _ref.onClose, open = _ref && _ref.open;
    var className = (_ref && _ref.className) || '';
    var rest = Object.assign({}, _ref);
    delete rest.children; delete rest.title; delete rest.onClose; delete rest.open; delete rest.className;
    return h('div', Object.assign({ className: ['modal-overlay', open && 'active', className].filter(Boolean).join(' ') }, rest),
      h('div', { className: 'modal' },
        h('div', { className: 'modal-header' },
          h('span', { className: 'modal-title' }, title),
          h('button', { className: 'modal-close', onClick: onClose }, '✕')
        ),
        children
      )
    );
  }

  // ─── SearchModal ────────────────────────────────────────────
  function SearchModal(_ref) {
    var placeholder = (_ref && _ref.placeholder) || 'Search countries, events, threats…';
    var className = (_ref && _ref.className) || '';
    var rest = Object.assign({}, _ref);
    delete rest.placeholder; delete rest.className;
    return h('div', Object.assign({ className: ['search-overlay', className].filter(Boolean).join(' ') }, rest),
      h('div', { className: 'search-modal' },
        h('div', { className: 'search-header' },
          h('span', { style: { fontSize: 14, color: 'var(--text-dim)' } }, '⌘K'),
          h('input', { className: 'search-input', placeholder: placeholder, readOnly: true })
        ),
        h('div', { className: 'search-section-header' }, 'Recent searches'),
        h('div', { className: 'search-results' })
      )
    );
  }

  window.WorldMonitor = {
    SysLabel, SysBtn, StatusChip, FilterBtn,
    RiskBadge, DataBar, SysDivider, SysFrame,
    PanelTabs, PanelTab, Panel, DataCard,
    PanelLoading, PanelEmpty, PanelError,
    TimeRangeSelector, MapControlBtn, AccentSwatch, NotifBell,
    TagChip, MetricBlock, SanctionCard, Modal, SearchModal,
  };
})();
