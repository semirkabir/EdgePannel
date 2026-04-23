#!/usr/bin/env node
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const GENERATED_ROOTS = [
  join(ROOT, 'src/generated/client'),
  join(ROOT, 'src/generated/server'),
];

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...await walk(full));
    } else if (entry.isFile() && /service_(client|server)\.ts$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function parseInterfaces(source) {
  const interfaces = new Map();
  const interfaceRe = /export interface (\w+) \{\n([\s\S]*?)\n\}/g;
  let match;
  while ((match = interfaceRe.exec(source)) !== null) {
    const [, name, body] = match;
    const fields = new Map();
    for (const line of body.split('\n')) {
      const field = line.match(/^\s+(\w+)\??: ([^;]+);$/);
      if (field) fields.set(field[1], field[2].trim());
    }
    interfaces.set(name, fields);
  }
  return interfaces;
}

function normalizeClient(source) {
  let next = source.replace(
    /if \(req\.(\w+) != null && req\.\1 !== ""\) params\.set\("([^"]+)", String\(req\.\1\)\);/g,
    'if (req.$1 != null && String(req.$1) !== "") params.set("$2", String(req.$1));',
  );

  next = next.replace(
    /async (\w+)\((_?req): (\w+Request), options\?: ([^)]+)\): Promise<([\s\S]*?)> \{/g,
    (full, methodName, _paramName, requestType, optionsType, responseType, offset) => {
      const bodyStart = offset + full.length;
      let depth = 1;
      let i = bodyStart;
      for (; i < next.length; i += 1) {
        const ch = next[i];
        if (ch === '{') depth += 1;
        if (ch === '}') depth -= 1;
        if (depth === 0) break;
      }
      const body = next.slice(bodyStart, i);
      const nextParamName = /\breq\b/.test(body) ? 'req' : '_req';
      return `async ${methodName}(${nextParamName}: ${requestType}, options?: ${optionsType}): Promise<${responseType}> {`;
    },
  );

  return next;
}

function normalizeServer(source) {
  const interfaces = parseInterfaces(source);
  return source.replace(
    /const body: (\w+Request) = \{\n([\s\S]*?)\n\s+\};/g,
    (full, requestType, body) => {
      const fields = interfaces.get(requestType);
      if (!fields) return full;

      const normalizedBody = body.replace(
        /^(\s+)(\w+): params\.get\("([^"]+)"\) \?\? "",$/gm,
        (line, indent, fieldName, queryName) => {
          const fieldType = fields.get(fieldName);
          if (!fieldType) return line;
          if (fieldType === 'string') {
            return `${indent}${fieldName}: params.get("${queryName}") ?? "",`;
          }
          if (fieldType === 'string[]') {
            return `${indent}${fieldName}: (params.get("${queryName}") ?? "").split(",").filter(Boolean),`;
          }
          return `${indent}${fieldName}: (params.get("${queryName}") ?? "") as ${fieldType},`;
        },
      );

      return `const body: ${requestType} = {\n${normalizedBody}\n          };`;
    },
  );
}

async function main() {
  const files = [];
  for (const root of GENERATED_ROOTS) files.push(...await walk(root));

  let changed = 0;
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const next = file.endsWith('service_client.ts')
      ? normalizeClient(source)
      : normalizeServer(source);
    if (next !== source) {
      await writeFile(file, next);
      changed += 1;
    }
  }

  console.log(`postprocess-sebuf-generated: normalized ${changed} file(s)`);
}

main().catch((err) => {
  console.error('postprocess-sebuf-generated failed:', err);
  process.exit(1);
});
