import {
  getPanelDensityPreference,
  isDesktopOnboardingDismissed,
  isMobileHelpDismissed,
  setDesktopOnboardingDismissed,
  setLocalDevApiNoticeDismissed,
  setMobileHelpDismissed,
  setPanelDensityPreference,
} from './ui-preferences';
import { confirmShellAction, showShellNotification } from './shell-notifications';
import { removePanelLayoutSnapshot } from './layout-snapshot';

export function applyPanelDensity(): void {
  document.body.dataset.panelDensity = getPanelDensityPreference();
  const button = document.getElementById('densityToggleBtn');
  if (button) {
    button.textContent = getPanelDensityPreference() === 'comfortable' ? 'Comfort' : 'Compact';
  }
}

export function togglePanelDensity(): void {
  const next = getPanelDensityPreference() === 'comfortable' ? 'compact' : 'comfortable';
  setPanelDensityPreference(next);
  applyPanelDensity();
  showShellNotification(
    next === 'comfortable' ? 'Comfortable panel spacing enabled' : 'Compact panel spacing enabled',
    'success',
  );
}

export function setupShellGuidance(isMobile: boolean): void {
  const strip = document.getElementById('shellGuidanceStrip');
  if (!strip) return;
  const shouldHide = isMobile || isDesktopOnboardingDismissed() || document.body.classList.contains('playback-mode');
  strip.classList.toggle('hidden', shouldHide);
  document.getElementById('shellGuidanceDismiss')?.addEventListener('click', () => {
    setDesktopOnboardingDismissed(true);
    strip.classList.add('hidden');
  });

  document.getElementById('localDevApiDismiss')?.addEventListener('click', () => {
    setLocalDevApiNoticeDismissed(true);
    document.getElementById('localDevApiNotice')?.remove();
  });
}

export function setupMobileHelpSheet(isMobile: boolean): void {
  const overlay = document.getElementById('mobileHelpOverlay');
  if (!overlay) return;

  document.getElementById('mobileMenuHelp')?.addEventListener('click', openMobileHelpSheet);
  document.getElementById('mobileHelpClose')?.addEventListener('click', closeMobileHelpSheet);
  document.getElementById('mobileHelpDone')?.addEventListener('click', closeMobileHelpSheet);
  document.getElementById('mobileHelpDismiss')?.addEventListener('click', () => {
    setMobileHelpDismissed(true);
    closeMobileHelpSheet();
  });
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeMobileHelpSheet();
  });

  if (isMobile && !isMobileHelpDismissed()) {
    window.setTimeout(openMobileHelpSheet, 200);
  }
}

export function openMobileHelpSheet(): void {
  document.getElementById('mobileHelpOverlay')?.classList.add('open');
}

export async function confirmAndResetLayout(panelSpansKey: string, panelOrderKey: string): Promise<void> {
  const confirmed = await confirmShellAction({
    title: 'Reset saved layout?',
    message: 'This clears saved panel positions, map sizing, and shell layout preferences for this device.',
    confirmLabel: 'Reset layout',
    danger: true,
  });
  if (!confirmed) return;

  localStorage.removeItem(panelSpansKey);
  localStorage.removeItem('worldmonitor-panel-col-spans');
  localStorage.removeItem(panelOrderKey);
  localStorage.removeItem(panelOrderKey + '-bottom');
  localStorage.removeItem(panelOrderKey + '-bottom-set');
  localStorage.removeItem('map-height');
  localStorage.removeItem('worldmonitor-sidebar-split');
  localStorage.removeItem('worldmonitor-panels-collapsed');
  localStorage.removeItem('worldmonitor-bottom-grid-collapsed');
  removePanelLayoutSnapshot();
  showShellNotification('Resetting layout...', 'warning', 900);
  window.setTimeout(() => window.location.reload(), 120);
}

function closeMobileHelpSheet(): void {
  document.getElementById('mobileHelpOverlay')?.classList.remove('open');
}
