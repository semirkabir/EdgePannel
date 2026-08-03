import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertSafeWebhookUrl, postToWebhookSafely } from '../server/_shared/ssrf-guard.ts';

function fakeResponse(status: number, location?: string): Response {
  const headers = new Headers();
  if (location) headers.set('location', location);
  return {
    status,
    ok: status >= 200 && status < 300,
    headers,
    body: { cancel: async () => {} },
  } as unknown as Response;
}

describe('assertSafeWebhookUrl', () => {
  it('allows a normal public https URL', () => {
    assert.doesNotThrow(() => assertSafeWebhookUrl('https://example.com/hook'));
  });

  it('blocks loopback hosts', () => {
    assert.throws(() => assertSafeWebhookUrl('http://127.0.0.1/hook'));
    assert.throws(() => assertSafeWebhookUrl('http://localhost/hook'));
  });

  it('blocks private ranges', () => {
    assert.throws(() => assertSafeWebhookUrl('http://10.0.0.5/hook'));
    assert.throws(() => assertSafeWebhookUrl('http://192.168.1.1/hook'));
    assert.throws(() => assertSafeWebhookUrl('http://172.16.0.1/hook'));
    assert.throws(() => assertSafeWebhookUrl('http://172.31.255.255/hook'));
  });

  it('allows a 172.x address outside the private range', () => {
    assert.doesNotThrow(() => assertSafeWebhookUrl('http://172.32.0.1/hook'));
  });

  it('blocks link-local and .local hosts', () => {
    assert.throws(() => assertSafeWebhookUrl('http://169.254.169.254/hook'));
    assert.throws(() => assertSafeWebhookUrl('http://my-box.local/hook'));
  });

  it('blocks non-http(s) protocols', () => {
    assert.throws(() => assertSafeWebhookUrl('ftp://example.com/hook'));
    assert.throws(() => assertSafeWebhookUrl('file:///etc/passwd'));
  });

  it('blocks embedded credentials', () => {
    assert.throws(() => assertSafeWebhookUrl('https://user:pass@example.com/hook'));
  });
});

describe('postToWebhookSafely', () => {
  it('returns true on a 2xx response', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => fakeResponse(200);
    try {
      const delivered = await postToWebhookSafely('https://example.com/hook', { ok: true });
      assert.equal(delivered, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('returns false on a non-2xx response', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => fakeResponse(500);
    try {
      const delivered = await postToWebhookSafely('https://example.com/hook', {});
      assert.equal(delivered, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('follows a redirect to a safe host', async () => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      if (calls === 1) return fakeResponse(302, 'https://safe-redirect-target.example.com/hook');
      return fakeResponse(200);
    };
    try {
      const delivered = await postToWebhookSafely('https://example.com/hook', {});
      assert.equal(delivered, true);
      assert.equal(calls, 2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('rejects a redirect to a blocked host', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => fakeResponse(302, 'http://169.254.169.254/steal-metadata');
    try {
      await assert.rejects(() => postToWebhookSafely('https://example.com/hook', {}));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
