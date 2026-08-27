import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { deflateSync } from 'node:zlib';

import {
  formatFindings,
  readZipEntries,
  scanProviderArtifacts,
} from './scan-provider-artifacts.mjs';

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function storedZip(entries) {
  const locals = [];
  const centrals = [];
  let localOffset = 0;
  for (const [name, value] of entries) {
    const nameBuffer = Buffer.from(name);
    const data = Buffer.from(value);
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    locals.push(local, nameBuffer, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(localOffset, 42);
    centrals.push(central, nameBuffer);
    localOffset += local.length + nameBuffer.length + data.length;
  }
  const localData = Buffer.concat(locals);
  const centralData = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralData.length, 12);
  end.writeUInt32LE(localData.length, 16);
  return Buffer.concat([localData, centralData, end]);
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return chunk;
}

function screenshotPng({ pixelCanary = false } = {}) {
  const width = 8;
  const height = 8;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 4);
    for (let x = 0; x < width; x += 1) {
      const index = 1 + x * 4;
      const magenta = pixelCanary && (x + y) % 2 === 0;
      const cyan = pixelCanary && !magenta;
      row[index] = magenta ? 255 : 0;
      row[index + 1] = cyan ? 255 : 0;
      row[index + 2] = magenta || cyan ? 255 : 0;
      row[index + 3] = 255;
    }
    rows.push(row);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(Buffer.concat(rows))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

async function withTemporaryDirectory(run) {
  const directory = await mkdtemp(join(tmpdir(), 'dwp-provider-dlp-'));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('accepts sanitized Playwright report, screenshot, result, and trace artifacts', async () => {
  await withTemporaryDirectory(async (directory) => {
    const report = join(directory, 'playwright-report-provider');
    const results = join(directory, 'test-results', 'provider');
    await mkdir(report, { recursive: true });
    await mkdir(results, { recursive: true });
    const trace = storedZip([
      [
        'resources/src@abcdef0123456789.txt',
        'const syntheticFixture = "fixture-user@tenant.example"; const password = "fixture-only";',
      ],
      [
        'trace.trace',
        '{"type":"request","url":"/api/platform/v1/admin/tenant-experience-preview","resource":"page@abcdef0123456789-100.jpeg"}',
      ],
      ['trace.network', '{"status":200,"contentType":"application/json"}'],
    ]);
    const embedded = `data:application/zip;base64,${trace.toString('base64')}`;
    await mkdir(join(report, 'trace', 'assets'), { recursive: true });
    await writeFile(
      join(report, 'index.html'),
      `<html><script>const password = "playwright-viewer-control";</script><body>${embedded}</body></html>`
    );
    await writeFile(
      join(report, 'trace', 'assets', 'viewer.js'),
      'const cookieHeader = "Playwright trace viewer control";'
    );
    await writeFile(join(results, 'pt-a21-trace.zip'), trace);
    await writeFile(join(results, 'pt-a21-preview.png'), screenshotPng());
    await writeFile(join(results, 'results.json'), '{"status":"passed"}');

    const result = await scanProviderArtifacts([report, results]);

    assert.equal(result.findings.length, 0, formatFindings(result.findings));
    assert.ok(result.filesScanned >= 4);
    assert.equal(readZipEntries(trace).length, 3);
  });
});

test('detects tokens, cookies, emails, secrets, and canaries inside real artifact shapes', async () => {
  await withTemporaryDirectory(async (directory) => {
    const report = join(directory, 'playwright-report-provider');
    const results = join(directory, 'test-results', 'provider');
    await mkdir(report, { recursive: true });
    await mkdir(results, { recursive: true });
    const trace = storedZip([
      [
        'trace.network',
        [
          'Authorization: Bearer top-secret-provider-token',
          'Cookie: DWP_SESSION=session-value',
          'activationToken=activation-value',
          'operator@customer.example.com',
          'DWP_PII_CANARY_PTA21',
          'client_secret=client-value',
          'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJvcGVyYXRvciJ9.c2lnbmF0dXJlMTIz',
        ].join('\n'),
      ],
    ]);
    await writeFile(join(results, 'trace.zip'), trace);
    await writeFile(join(report, 'index.html'), '<html><body>Provider acceptance</body></html>');

    const result = await scanProviderArtifacts([report, results]);
    const kinds = new Set(result.findings.map((finding) => finding.kind));

    for (const expected of [
      'authorization-bearer',
      'jwt',
      'activation-token',
      'session-cookie',
      'cookie-header',
      'secret-assignment',
      'email',
      'pii-canary',
    ]) {
      assert.ok(kinds.has(expected), `missing ${expected}`);
    }
    const output = formatFindings(result.findings);
    assert.doesNotMatch(
      output,
      /top-secret-provider-token|operator@customer\.example\.com|session-value/u
    );
  });
});

test('detects the reserved canary after it is rasterized into screenshot pixels', async () => {
  await withTemporaryDirectory(async (directory) => {
    await writeFile(join(directory, 'rasterized-canary.png'), screenshotPng({ pixelCanary: true }));

    const result = await scanProviderArtifacts([directory]);

    assert.ok(
      result.findings.some((finding) => finding.kind === 'pii-canary-pixel-marker'),
      formatFindings(result.findings)
    );
  });
});

test('fails closed when no requested artifact root exists', async () => {
  await withTemporaryDirectory(async (directory) => {
    await assert.rejects(
      scanProviderArtifacts([join(directory, 'missing')]),
      /none of the requested artifact roots exist/u
    );
  });
});
