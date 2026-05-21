const MAP_HEIGHT_KEY = 'map-height';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function getMinMapHeight(): number {
  return window.innerWidth >= 1600 ? 280 : 350;
}

function getMaxMapHeight(): number {
  const min = getMinMapHeight();
  if (window.innerWidth < 1600) return Math.max(min, window.innerHeight - 150);

  const bottomGrid = document.getElementById('mapBottomGrid');
  const isEmpty = !bottomGrid || bottomGrid.children.length === 0;
  const headerHeight = 60;
  const totalAvailable = window.innerHeight - headerHeight;

  return isEmpty ? totalAvailable - 25 : totalAvailable - 300;
}

/** Restore saved map section height from localStorage before the map initializes. */
export function applyStoredMapHeight(): boolean {
  const mapSection = document.getElementById('mapSection');
  const mapContainer = document.getElementById('mapContainer');
  if (!mapSection || !mapContainer) return false;

  const savedHeight = localStorage.getItem(MAP_HEIGHT_KEY);
  if (!savedHeight) return false;

  const numeric = Number.parseInt(savedHeight, 10);
  if (!Number.isFinite(numeric)) {
    localStorage.removeItem(MAP_HEIGHT_KEY);
    return false;
  }

  const clamped = clamp(numeric, getMinMapHeight(), getMaxMapHeight());
  if (window.innerWidth >= 1600) {
    mapContainer.style.flex = 'none';
    mapContainer.style.setProperty('height', `${clamped}px`, 'important');
  } else {
    mapSection.style.flex = 'none';
    mapSection.style.setProperty('height', `${clamped}px`, 'important');
  }
  if (clamped !== numeric) {
    localStorage.setItem(MAP_HEIGHT_KEY, `${clamped}px`);
  }
  return true;
}

/** Run resize after layout has settled (flex chain + restored height). */
export function scheduleMapResize(map: { resize(): void } | null | undefined): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      map?.resize();
    });
  });
}
