import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { listKnownExploitedVulns } from '../server/worldmonitor/cyber/v1/list-known-exploited-vulns';

function jsonResponse(payload: unknown, ok = true): Response {
  return {
    ok,
    async json() {
      return payload;
    },
  } as Response;
}

function withEnv(overrides: Record<string, string | undefined>) {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  return () => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

function testContext() {
  return {
    request: new Request('https://edgepannel.test/api/cyber/v1/list-known-exploited-vulns'),
    pathParams: {},
    headers: {},
  };
}

describe('listKnownExploitedVulns', { concurrency: 1 }, () => {
  it('normalizes CISA KEV records and returns newest entries first', async () => {
    const restoreEnv = withEnv({
      UPSTASH_REDIS_REST_URL: undefined,
      UPSTASH_REDIS_REST_TOKEN: undefined,
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => jsonResponse({
      vulnerabilities: [
        {
          cveID: 'cve-2024-0001',
          vendorProject: ' Vendor One ',
          product: 'Product   One',
          vulnerabilityName: 'Older bug',
          dateAdded: '2024-01-02',
          shortDescription: 'Allows remote code execution.',
          requiredAction: 'Apply updates.',
          dueDate: '2024-02-01',
          knownRansomwareCampaignUse: 'Unknown',
          notes: '  See vendor advisory. ',
          cwes: [' CWE-79 ', 'CWE-89'],
        },
        {
          cveID: 'CVE-2025-0002',
          vendorProject: 'Vendor Two',
          product: 'Product Two',
          vulnerabilityName: 'Newer bug',
          dateAdded: '2025-03-04',
          shortDescription: 'Privilege escalation.',
          requiredAction: 'Mitigate or discontinue use.',
          dueDate: '2025-04-01',
          knownRansomwareCampaignUse: 'Known',
          cwes: ['CWE-20'],
        },
      ],
    });

    try {
      const result = await listKnownExploitedVulns(testContext(), {
        pageSize: 10,
        cursor: '',
        search: '',
      });

      assert.equal(result.pagination?.totalCount, 2);
      assert.equal(result.pagination?.nextCursor, '');
      assert.equal(result.vulnerabilities.length, 2);
      assert.equal(result.vulnerabilities[0]?.cveId, 'CVE-2025-0002');
      assert.equal(result.vulnerabilities[0]?.source, 'CISA KEV');
      assert.equal(result.vulnerabilities[0]?.cwe, 'CWE-20');
      assert.equal(result.vulnerabilities[1]?.cveId, 'CVE-2024-0001');
      assert.equal(result.vulnerabilities[1]?.product, 'Product One');
      assert.equal(result.vulnerabilities[1]?.cwe, 'CWE-79');
    } finally {
      globalThis.fetch = originalFetch;
      restoreEnv();
    }
  });

  it('applies search and cursor pagination', async () => {
    const restoreEnv = withEnv({
      UPSTASH_REDIS_REST_URL: undefined,
      UPSTASH_REDIS_REST_TOKEN: undefined,
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => jsonResponse({
      vulnerabilities: [
        { cveID: 'CVE-2025-1001', vendorProject: 'Alpha', product: 'Gateway', vulnerabilityName: 'Alpha RCE', dateAdded: '2025-01-01' },
        { cveID: 'CVE-2025-1002', vendorProject: 'Beta', product: 'Gateway', vulnerabilityName: 'Beta RCE', dateAdded: '2025-01-02' },
        { cveID: 'CVE-2025-1003', vendorProject: 'Beta', product: 'Console', vulnerabilityName: 'Beta auth bypass', dateAdded: '2025-01-03' },
      ],
    });

    try {
      const result = await listKnownExploitedVulns(testContext(), {
        pageSize: 1,
        cursor: '1',
        search: 'beta',
      });

      assert.equal(result.pagination?.totalCount, 2);
      assert.equal(result.pagination?.nextCursor, '');
      assert.deepEqual(
        result.vulnerabilities.map((entry) => entry.cveId),
        ['CVE-2025-1002'],
      );
    } finally {
      globalThis.fetch = originalFetch;
      restoreEnv();
    }
  });
});
