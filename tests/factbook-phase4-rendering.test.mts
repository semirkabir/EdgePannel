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

test('renders a population share pictogram in the people hero', () => {
  installDom();
  const people = renderFactbookTab('people', loadFactbookFixture('dz'), 'Algeria');

  assert.equal(people.querySelectorAll('.cdp-fb-pop-pictogram').length, 1);
  assert.equal(people.querySelectorAll('.cdp-fb-pop-icon').length, 10);
  assert.match(people.textContent ?? '', /world population/i);
});

test('renders donut variants for economy and energy breakdowns', () => {
  installDom();
  const economy = renderFactbookTab('economy', loadFactbookFixture('us'), 'United States');
  const energy = renderFactbookTab('energy', loadFactbookFixture('us'), 'United States');

  assert.equal(economy.querySelectorAll('.cdp-fb-donut').length >= 1, true);
  assert.equal(energy.querySelectorAll('.cdp-fb-donut').length >= 1, true);
  assert.equal(economy.querySelectorAll('.cdp-fb-donut-segment').length >= 3, true);
});

test('renders electricity and military benchmark gauges', () => {
  installDom();
  const energy = renderFactbookTab('energy', loadFactbookFixture('us'), 'United States');
  const military = renderFactbookTab('military', loadFactbookFixture('et'), 'Ethiopia');

  assert.equal(energy.querySelectorAll('.cdp-fb-gauge').length >= 1, true);
  assert.match(energy.textContent ?? '', /Electrification/);
  assert.equal(energy.querySelectorAll('.cdp-fb-gauge-center .cdp-fb-gauge-note').length, 0);
  assert.equal(energy.querySelectorAll('.cdp-fb-gauge > .cdp-fb-gauge-note').length >= 1, true);

  assert.equal(military.querySelectorAll('.cdp-fb-gauge').length >= 1, true);
  assert.match(military.textContent ?? '', /NATO target 2%/);
  assert.match(military.textContent ?? '', /World average 2.2%/i);
  assert.doesNotMatch(military.textContent ?? '', /&nbsp;/i);
});
