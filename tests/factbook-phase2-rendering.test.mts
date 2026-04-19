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
    HTMLElementTagNameMap: window.HTMLElementTagNameMap,
    Node: window.Node,
  });
}

test('renders geography phase 2 visuals for Algeria', () => {
  installDom();
  const geography = renderFactbookTab('geography', loadFactbookFixture('dz'), 'Algeria');

  assert.equal(geography.querySelectorAll('.cdp-fb-stack').length > 0, true);
  assert.equal(geography.querySelectorAll('.cdp-fb-area-box').length, 2);
  assert.match(geography.textContent ?? '', /Texas/);
  assert.equal(geography.querySelectorAll('.cdp-fb-elevation-svg').length, 1);
});

test('renders partner flag chips and diverging energy bars', () => {
  installDom();
  const economy = renderFactbookTab('economy', loadFactbookFixture('dz'), 'Algeria');
  const energy = renderFactbookTab('energy', loadFactbookFixture('dz'), 'Algeria');

  assert.match(economy.textContent ?? '', /Italy 29%/);
  assert.match(economy.textContent ?? '', /France 14%/);
  assert.equal(economy.querySelectorAll('.cdp-fb-chip-icon').length > 0, true);

  assert.equal(energy.querySelectorAll('.cdp-fb-flow-card').length >= 2, true);
  assert.match(energy.textContent ?? '', /Production/);
  assert.match(energy.textContent ?? '', /Consumption/);
});

test('renders deployment flag chips from multiple text patterns', () => {
  installDom();
  const austria = renderFactbookTab('military', loadFactbookFixture('at'), 'Austria');
  const france = renderFactbookTab('military', loadFactbookFixture('fr'), 'France');

  assert.match(austria.textContent ?? '', /Bosnia-Herzegovina 210/);
  assert.match(austria.textContent ?? '', /Lebanon 160/);
  assert.match(france.textContent ?? '', /Djibouti 1,500/);
  assert.match(france.textContent ?? '', /United Arab Emirates 800/);
});

test('renders disputed-neighbor flag chips for transnational disputes', () => {
  installDom();
  const issues = renderFactbookTab('transnational', loadFactbookFixture('eh'), 'Western Sahara');

  assert.match(issues.textContent ?? '', /Morocco/);
  assert.match(issues.textContent ?? '', /Algeria/);
  assert.equal(issues.querySelectorAll('.cdp-fb-chip-icon').length > 0, true);
});
