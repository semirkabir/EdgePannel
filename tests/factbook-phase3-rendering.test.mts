import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { renderFactbookTab } from '../src/components/country-factbook/index.ts';
import type { FactbookData } from '../src/services/factbook.ts';

function loadFactbookFixture(code: string): FactbookData {
  const raw = readFileSync(new URL(`../public/data/factbook/${code}.json`, import.meta.url), 'utf8');
  return JSON.parse(raw) as FactbookData;
}

function installDom(): void {
  const { window, document } = parseHTML('<!doctype html><html><body></body></html>');
  Object.assign(globalThis, {
    window,
    document,
    HTMLElement: window.HTMLElement,
    SVGElement: window.SVGElement,
    HTMLDetailsElement: window.HTMLDetailsElement,
    HTMLSummaryElement: window.HTMLSummaryElement,
    Node: window.Node,
  });
}

test('renders locator maps for geography and capital cards', () => {
  installDom();
  const data = loadFactbookFixture('dz');

  const geography = renderFactbookTab('geography', data, 'Algeria');
  const government = renderFactbookTab('government', data, 'Algeria');

  assert.equal(geography.querySelectorAll('.cdp-fb-locator-svg').length >= 1, true);
  assert.equal(government.querySelectorAll('.cdp-fb-locator-svg').length >= 1, true);
  assert.match(government.textContent ?? '', /Algiers/);
  assert.match(geography.textContent ?? '', /Northern Africa/);
});

test('renders a population pyramid and world-median health benchmarks', () => {
  installDom();
  const people = renderFactbookTab('people', loadFactbookFixture('dz'), 'Algeria');

  assert.equal(people.querySelectorAll('.cdp-fb-pyramid-row').length, 3);
  assert.equal(people.querySelectorAll('.cdp-fb-benchmark').length >= 4, true);
  assert.match(people.textContent ?? '', /Male/i);
  assert.match(people.textContent ?? '', /world median/i);
});

test('renders sparkline tiles and a transport scale chart', () => {
  installDom();
  const economy = renderFactbookTab('economy', loadFactbookFixture('us'), 'United States');
  const transport = renderFactbookTab('transportation', loadFactbookFixture('us'), 'United States');

  assert.equal(economy.querySelectorAll('.mini-sparkline').length >= 5, true);
  assert.match(economy.textContent ?? '', /GDP/);

  assert.equal(transport.querySelectorAll('.cdp-fb-bars-transport .cdp-fb-bar-row').length >= 4, true);
  assert.match(transport.textContent ?? '', /Airports/);
  assert.match(transport.textContent ?? '', /Merchant marine/);
});
