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
    HTMLDetailsElement: window.HTMLDetailsElement,
    HTMLSummaryElement: window.HTMLSummaryElement,
    Node: window.Node,
  });
}

test('renders phase 1 geography and government enhancements for Algeria', () => {
  installDom();
  const data = loadFactbookFixture('dz');

  const geography = renderFactbookTab('geography', data, 'Algeria');
  const government = renderFactbookTab('government', data, 'Algeria');

  assert.match(geography.textContent ?? '', /Semi-arid/);
  assert.match(geography.textContent ?? '', /Arid/);
  assert.match(geography.textContent ?? '', /petroleum/i);
  assert.match(geography.textContent ?? '', /Seismic/);
  assert.match(geography.textContent ?? '', /Flooding/);
  assert.equal(geography.querySelectorAll('.cdp-fb-details').length >= 2, true);

  const badgeText = government.querySelector('.cdp-fb-badges')?.textContent ?? '';
  assert.match(badgeText, /Presidential Republic/);
  assert.match(badgeText, /Mixed civil\/Islamic law/);
});

test('renders commodity and military icon chips for Algeria', () => {
  installDom();
  const data = loadFactbookFixture('dz');

  const economy = renderFactbookTab('economy', data, 'Algeria');
  const military = renderFactbookTab('military', data, 'Algeria');

  assert.match(economy.textContent ?? '', /natural gas/i);
  assert.match(economy.textContent ?? '', /crude petroleum/i);
  assert.match(economy.textContent ?? '', /wheat/i);
  assert.equal(economy.querySelectorAll('.cdp-fb-chip-icon').length > 0, true);

  assert.match(military.textContent ?? '', /Land Forces/);
  assert.match(military.textContent ?? '', /National Gendarmerie/);
  assert.equal(military.querySelectorAll('.cdp-fb-chip-icon').length > 0, true);
});

test('extracts and surfaces the TIP tier badge when trafficking data is present', () => {
  installDom();
  const data = loadFactbookFixture('dz');

  const issues = renderFactbookTab('transnational', data, 'Algeria');
  const badgeText = issues.querySelector('.cdp-fb-badge')?.textContent ?? '';
  const calloutText = issues.querySelector('.cdp-fb-callout-body')?.textContent ?? '';

  assert.match(badgeText, /Tier 2 Watch List/);
  assert.doesNotMatch(calloutText, /^Tier 2 Watch List/);
  assert.match(calloutText, /did not demonstrate overall increasing efforts/i);
});
