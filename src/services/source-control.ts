import { loadFromStorage } from '@/utils';

const DISABLED_SOURCES_KEY = 'worldmonitor-disabled-feeds';

export function isNamedSourceEnabled(sourceName: string): boolean {
  const disabled = loadFromStorage<string[]>(DISABLED_SOURCES_KEY, []);
  return !disabled.includes(sourceName);
}
