// @ds-bundle WorldMonitor
// @ds-bundle-css _ds_bundle.css
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

  window.WorldMonitor = {
    SysLabel,
    SysBtn,
    StatusChip,
    FilterBtn,
    RiskBadge,
    DataBar,
    SysDivider,
    SysFrame,
    PanelTabs,
    PanelTab,
    Panel,
    DataCard,
  };
})();
