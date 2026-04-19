import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const readSrc = (relPath) => readFileSync(resolve(root, relPath), 'utf8');

function extractMethodBody(source, methodName) {
  const signature = new RegExp(`(?:private|public)?\\s*${methodName}\\s*\\(`);
  const match = signature.exec(source);
  if (!match) throw new Error(`Could not find ${methodName}`);

  const braceIndex = source.indexOf('{', match.index);
  if (braceIndex === -1) throw new Error(`Could not find opening brace for ${methodName}`);

  const bodyStart = braceIndex + 1;
  let depth = 1;
  for (let i = bodyStart; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(bodyStart, i);
    }
  }
  throw new Error(`Could not extract ${methodName}`);
}

describe('idle performance guards', () => {
  it('does not initialize the ML worker by default on desktop startup', () => {
    const src = readSrc('src/App.ts');

    assert.match(src, /if \(aiFlow\.browserModel\) \{\s*await mlWorker\.init\(\);/s);
    assert.doesNotMatch(src, /if \(aiFlow\.browserModel \|\| isDesktopRuntime\(\)\)/);
    assert.match(src, /if \(!s\.browserModel\) \{\s*mlWorker\.terminate\(\);/s);
  });

  it('gates recurring refreshes behind active consumers', () => {
    const src = readSrc('src/App.ts');

    assert.match(src, /scheduleRefresh\(\s*'news',[\s\S]*this\.dataLoader\.hasActiveNewsConsumer\(\)/s);
    assert.match(src, /name: 'predictions'[\s\S]*condition: \(\) => this\.dataLoader\.hasActivePredictionConsumer\(\)/s);
    assert.match(src, /name: 'markets'[\s\S]*condition: \(\) => this\.dataLoader\.hasActiveMarketsConsumer\(\)/s);
    assert.match(src, /scheduleRefresh\(\s*'tradePolicy',[\s\S]*this\.dataLoader\.hasActiveTradePolicyConsumer\(\)/s);
    assert.match(src, /scheduleRefresh\(\s*'supplyChain',[\s\S]*this\.dataLoader\.hasActiveSupplyChainConsumer\(\)/s);
  });

  it('gates startup data loading and supports immediate panel-triggered fetches', () => {
    const src = readSrc('src/app/data-loader.ts');

    assert.match(src, /isLocalDevTaskEnabled\('markets'\) && this\.hasActiveMarketsConsumer\(\)/);
    assert.match(src, /if \(this\.hasActivePredictionConsumer\(\)\) \{\s*tasks\.push\(\{ name: 'predictions'/s);
    assert.match(src, /isLocalDevTaskEnabled\('tradePolicy'\) && this\.hasActiveTradePolicyConsumer\(\)/);
    assert.match(src, /isLocalDevTaskEnabled\('supplyChain'\) && this\.hasActiveSupplyChainConsumer\(\)/);
    assert.match(src, /if \(this\.hasActiveSanctionsConsumer\(\)\)/);
    assert.match(src, /if \(this\.hasActiveSolarWeatherConsumer\(\)\)/);
    assert.match(src, /if \(this\.hasActiveCiiConsumer\(\)\) \{\s*tasks\.push\(\{ name: 'governanceBaselines'/s);
    assert.match(src, /async loadDataForPanel\(panelKey: string\)/);
    assert.match(src, /case 'polymarket':[\s\S]*runOnDemand\('predictions'/s);
    assert.match(src, /case 'trade-policy':[\s\S]*runOnDemand\('tradePolicy'/s);
    assert.match(src, /case 'supply-chain':[\s\S]*runOnDemand\('supplyChain'/s);
  });

  it('loads panel data immediately when a hidden panel is enabled', () => {
    const src = readSrc('src/app/event-handlers.ts');
    assert.match(src, /if \(config\.enabled\) this\.callbacks\.loadDataForPanel\(key\);/);
  });

  it('removes globe auto-spin and gates pulse animation by layer consumers', () => {
    const src = readSrc('src/components/DeckGLMap.ts');
    const needsPulse = extractMethodBody(src, 'needsPulseAnimation');
    const setGlobeProjection = extractMethodBody(src, 'setGlobeProjection');

    assert.match(src, /private hasActivePulseConsumer\(\): boolean/);
    assert.match(needsPulse, /if \(!this\.hasActivePulseConsumer\(\)\) return false;/);
    assert.match(needsPulse, /this\.state\.layers\.conflicts \|\| this\.state\.layers\.hotspots/);
    assert.match(needsPulse, /this\.state\.layers\.protests && this\.hasRecentRiot\(now\)/);
    assert.match(needsPulse, /this\.state\.layers\.positiveEvents && this\.positiveEvents\.some/);
    assert.match(needsPulse, /this\.state\.layers\.kindness && this\.kindnessPoints\.some/);
    assert.doesNotMatch(setGlobeProjection, /_startGlobeSpin\(\)/);
  });

  it('starts notification polling lazily and stops it after the close grace period', () => {
    const src = readSrc('src/components/NotificationCenter.ts');
    const constructorBody = extractMethodBody(src, 'constructor');

    assert.doesNotMatch(constructorBody, /setInterval\(/);
    assert.match(src, /private ensurePollingStarted\(\): void/);
    assert.match(src, /private schedulePollingStop\(\): void/);
    assert.match(src, /private show\(\): void \{[\s\S]*this\.ensurePollingStarted\(\);/);
    assert.match(src, /private close\(\): void \{[\s\S]*this\.schedulePollingStop\(\);/);
    assert.match(src, /const POLL_STOP_GRACE_MS = 60_000;/);
  });
});
