export type ResponsiveZoneListener = { cancel(): void };

type ResponsiveZoneTarget = Pick<Window, 'matchMedia'>;

/**
 * Fires `onZoneChange` only when the panel-layout ultra-wide breakpoint is
 * actually crossed, via `matchMedia`'s `change` event — not on every pixel of
 * a window resize/drag like a raw `resize` listener would. Ported from
 * worldmonitor#4000 (upstream `panel-layout.ts` had the same bare
 * `addEventListener('resize', ...)` this replaces).
 */
export function addResponsiveZoneListener(
  target: ResponsiveZoneTarget,
  minWidthPx: number,
  onZoneChange: () => void,
): ResponsiveZoneListener {
  const media = target.matchMedia(`(min-width: ${minWidthPx}px)`);
  const onMediaChange = () => onZoneChange();

  media.addEventListener('change', onMediaChange);

  return {
    cancel() {
      media.removeEventListener('change', onMediaChange);
    },
  };
}

export function removeResponsiveZoneListener(listener: ResponsiveZoneListener | null): void {
  listener?.cancel();
}
