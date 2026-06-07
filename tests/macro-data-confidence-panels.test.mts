import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const consumerPanel = readFileSync(new URL('../src/components/ConsumerPricesPanel.ts', import.meta.url), 'utf8');
const forecastPanel = readFileSync(new URL('../src/components/ForecastPanel.ts', import.meta.url), 'utf8');
const panelStyles = readFileSync(new URL('../src/styles/panels.css', import.meta.url), 'utf8');

describe('macro data confidence panel rendering', () => {
  it('keeps consumer price confidence strip wired to the shared assessor', () => {
    assert.match(consumerPanel, /assessConsumerPriceConfidence/);
    assert.match(consumerPanel, /renderConfidenceStrip/);
    assert.match(consumerPanel, /cp-confidence-strip/);
  });

  it('keeps forecast data caveats wired to the shared assessor', () => {
    assert.match(forecastPanel, /assessMacroForecastConfidence/);
    assert.match(forecastPanel, /renderDataConfidenceChip/);
    assert.match(forecastPanel, /Data caveats/);
  });

  it('keeps confidence styles in the shared panel stylesheet', () => {
    assert.match(panelStyles, /\.cp-confidence-strip/);
    assert.match(panelStyles, /\.fc-data-chip/);
    assert.doesNotMatch(consumerPanel, /\.cp-confidence-strip\s*\{/);
    assert.doesNotMatch(forecastPanel, /\.fc-data-chip\s*\{/);
  });
});
