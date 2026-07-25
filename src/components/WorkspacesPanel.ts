/**
 * WorkspacesPanel — save and switch between named layout snapshots.
 *
 * The dashboard already lets you drag, resize, add and remove panels; this
 * keeps several of those arrangements around as named workspaces so a
 * "War room" layout is one click away from a "Markets" one. Self-contained
 * overlay, matching the other header panels.
 */
import {
  listWorkspaces,
  saveWorkspace,
  applyWorkspace,
  deleteWorkspace,
  renameWorkspace,
  type Workspace,
} from '@/services/workspaces';
import { escapeHtml } from '@/utils/sanitize';
import { SITE_VARIANT } from '@/config';

export class WorkspacesPanel {
  private overlay: HTMLElement;
  private listEl: HTMLElement;
  private nameInput: HTMLInputElement;
  private statusEl: HTMLElement;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'wsp-overlay';
    this.overlay.hidden = true;

    const panel = document.createElement('aside');
    panel.className = 'wsp-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Workspaces');
    panel.innerHTML = `
      <header class="wsp-header">
        <div>
          <h2>Workspaces</h2>
          <p class="wsp-status"></p>
        </div>
        <button type="button" class="wsp-close" aria-label="Close">×</button>
      </header>
      <div class="wsp-save">
        <input type="text" class="wsp-name" maxlength="60" placeholder="Name this layout…" aria-label="Workspace name">
        <button type="button" class="wsp-save-btn">Save current</button>
      </div>
      <div class="wsp-list" aria-live="polite"></div>
      <footer class="wsp-footer">
        Saves which panels are shown, their order, sizes, and the current map view.
      </footer>
    `;
    this.overlay.appendChild(panel);
    document.body.appendChild(this.overlay);

    this.listEl = panel.querySelector<HTMLElement>('.wsp-list')!;
    this.nameInput = panel.querySelector<HTMLInputElement>('.wsp-name')!;
    this.statusEl = panel.querySelector<HTMLElement>('.wsp-status')!;

    this.overlay.addEventListener('click', (event) => {
      if (event.target === this.overlay || (event.target as HTMLElement).closest('.wsp-close')) {
        this.close();
      }
    });
    panel.querySelector<HTMLButtonElement>('.wsp-save-btn')!
      .addEventListener('click', () => this.saveCurrent());
    this.nameInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); this.saveCurrent(); }
    });
    this.listEl.addEventListener('click', (event) => this.handleListClick(event));
  }

  public open(): void {
    this.overlay.hidden = false;
    this.overlay.classList.add('active');
    this.render();
    this.nameInput.focus();
  }

  public close(): void {
    this.overlay.classList.remove('active');
    this.overlay.hidden = true;
  }

  public destroy(): void {
    this.overlay.remove();
  }

  private saveCurrent(): void {
    const name = this.nameInput.value.trim();
    if (!name) {
      this.setStatus('Give the layout a name first.');
      this.nameInput.focus();
      return;
    }
    const saved = saveWorkspace(name);
    this.nameInput.value = '';
    this.render();
    this.setStatus(`Saved “${saved.name}”.`);
  }

  private handleListClick(event: Event): void {
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLElement>('.wsp-item');
    const id = row?.dataset.id;
    if (!id) return;

    if (target.closest('.wsp-delete')) {
      deleteWorkspace(id);
      this.render();
      this.setStatus('Workspace deleted.');
      return;
    }
    if (target.closest('.wsp-rename')) {
      this.beginRename(row!, id);
      return;
    }
    if (target.closest('.wsp-apply') || target.closest('.wsp-name-text')) {
      this.apply(id);
    }
  }

  private apply(id: string): void {
    const url = applyWorkspace(id);
    if (!url) {
      this.setStatus('That workspace was saved on a different variant and can’t be applied here.');
      return;
    }
    // Panel order and sizes are read when panels are built, so reload for an
    // exact restore rather than leaving a half-applied layout on screen.
    this.setStatus('Applying…');
    window.location.assign(url);
  }

  private beginRename(row: HTMLElement, id: string): void {
    const nameEl = row.querySelector<HTMLElement>('.wsp-name-text');
    if (!nameEl) return;
    const input = document.createElement('input');
    input.className = 'wsp-rename-input';
    input.value = nameEl.textContent ?? '';
    input.maxLength = 60;
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    const finish = (commit: boolean) => {
      if (commit && input.value.trim()) renameWorkspace(id, input.value);
      this.render();
    };
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); finish(true); }
      else if (event.key === 'Escape') { event.preventDefault(); finish(false); }
    });
  }

  private setStatus(message: string): void {
    this.statusEl.textContent = message;
  }

  private render(): void {
    const workspaces = listWorkspaces();
    if (workspaces.length === 0) {
      this.listEl.innerHTML = `<div class="wsp-empty">No saved workspaces yet. Arrange the dashboard how you like it, then save it above.</div>`;
      this.setStatus('Nothing saved yet');
      return;
    }
    this.setStatus(`${workspaces.length} saved`);
    this.listEl.innerHTML = workspaces.map(w => this.renderRow(w)).join('');
  }

  private renderRow(w: Workspace): string {
    // Layouts captured on another variant reference panels that don't exist here.
    const foreign = w.variant !== SITE_VARIANT;
    return `
      <div class="wsp-item${foreign ? ' wsp-item-foreign' : ''}" data-id="${escapeHtml(w.id)}">
        <div class="wsp-item-main">
          <span class="wsp-name-text"${foreign ? '' : ' title="Apply this workspace"'}>${escapeHtml(w.name)}</span>
          <span class="wsp-meta">${w.panelCount} panel${w.panelCount === 1 ? '' : 's'} · ${escapeHtml(formatWhen(w.updatedAt))}${foreign ? ` · saved on ${escapeHtml(w.variant)}` : ''}</span>
        </div>
        <div class="wsp-item-actions">
          ${foreign ? '' : '<button type="button" class="wsp-apply" title="Apply">Apply</button>'}
          <button type="button" class="wsp-rename" aria-label="Rename workspace" title="Rename">✏️</button>
          <button type="button" class="wsp-delete" aria-label="Delete workspace" title="Delete">×</button>
        </div>
      </div>
    `;
  }
}

function formatWhen(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
