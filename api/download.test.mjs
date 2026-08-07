import { strict as assert } from 'node:assert';
import test from 'node:test';
import handler from './download.js';

function makeRequest(query = '') {
  return new Request(`https://worldmonitor.app/api/download${query}`);
}

test('redirects to releases page when platform is missing or invalid', async () => {
  const missing = await handler(makeRequest());
  assert.equal(missing.status, 302);
  assert.equal(missing.headers.get('location'), 'https://github.com/koala73/worldmonitor/releases/latest');

  const invalid = await handler(makeRequest('?platform=unknown'));
  assert.equal(invalid.status, 302);
  assert.equal(invalid.headers.get('location'), 'https://github.com/koala73/worldmonitor/releases/latest');
});

test('redirects to matching asset on the "latest" release for the default/full edition', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.ok(String(url).endsWith('/releases/latest'), 'full edition should hit the single-release endpoint');
    return new Response(JSON.stringify({
      assets: [
        { name: 'EdgePannel_1.0.0_x64-setup.exe', browser_download_url: 'https://example.com/full.exe' },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const response = await handler(makeRequest('?platform=windows-exe&variant=full'));
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), 'https://example.com/full.exe');
    assert.match(response.headers.get('cache-control') || '', /stale-while-revalidate/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('redirects to matching asset for a variant with its own tag (finance)', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.ok(String(url).includes('/releases?'), 'variant editions should be resolved from the release list');
    return new Response(JSON.stringify([
      { tag_name: 'v1.0.0', draft: false, assets: [
        { name: 'EdgePannel_1.0.0_x64-setup.exe', browser_download_url: 'https://example.com/full.exe' },
      ] },
      { tag_name: 'v1.0.0-finance', draft: false, assets: [
        { name: 'FinanceMonitor_1.0.0_x64-setup.exe', browser_download_url: 'https://example.com/finance.exe' },
      ] },
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const response = await handler(makeRequest('?platform=windows-exe&variant=finance'));
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), 'https://example.com/finance.exe');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('redirects to matching asset for the conflicts edition', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify([
    { tag_name: 'v1.0.0-conflicts', draft: false, assets: [
      { name: 'ConflictsMonitor_1.0.0_aarch64.dmg', browser_download_url: 'https://example.com/conflicts.dmg' },
    ] },
  ]), { status: 200, headers: { 'Content-Type': 'application/json' } });

  try {
    const response = await handler(makeRequest('?platform=macos-arm64&variant=conflicts'));
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), 'https://example.com/conflicts.dmg');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('ignores draft releases when resolving a tagged variant', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify([
    { tag_name: 'v1.1.0-finance', draft: true, assets: [
      { name: 'FinanceMonitor_1.1.0_x64-setup.exe', browser_download_url: 'https://example.com/draft.exe' },
    ] },
    { tag_name: 'v1.0.0-finance', draft: false, assets: [
      { name: 'FinanceMonitor_1.0.0_x64-setup.exe', browser_download_url: 'https://example.com/published.exe' },
    ] },
  ]), { status: 200, headers: { 'Content-Type': 'application/json' } });

  try {
    const response = await handler(makeRequest('?platform=windows-exe&variant=finance'));
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), 'https://example.com/published.exe');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('falls back to releases page when upstream returns no matching asset', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify([]), { status: 200 });

  try {
    const response = await handler(makeRequest('?platform=linux-appimage&variant=finance'));
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), 'https://github.com/koala73/worldmonitor/releases/latest');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('falls back to releases page when upstream request fails', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('', { status: 500 });

  try {
    const response = await handler(makeRequest('?platform=windows-exe&variant=full'));
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), 'https://github.com/koala73/worldmonitor/releases/latest');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
