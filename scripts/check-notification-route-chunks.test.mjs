import assert from 'node:assert/strict';
import test from 'node:test';

import viteConfig from '../vite.config.ts';

import {
  incrementalRouteKeys,
  initialManifestKeys,
  manifestImportClosure,
} from './notification-route-budget-model.mjs';

const manifest = {
  'index.html': { isEntry: true, file: 'index.js', imports: ['_shell.js'] },
  '_shell.js': { file: 'shell.js', imports: ['_vendor.js'] },
  '_vendor.js': { file: 'vendor.js' },
  'notification-route.tsx': {
    isDynamicEntry: true,
    file: 'notification-route.js',
    imports: ['_shell.js', '_notification-admin.js'],
  },
  '_notification-admin.js': {
    file: 'notification-admin.js',
    imports: ['_vendor.js', '_notification-helper.js'],
  },
  '_notification-helper.js': { file: 'notification-helper.js' },
};

test('route closure recursively includes shared chunks but excludes the warm initial shell graph', () => {
  assert.deepEqual([...initialManifestKeys(manifest)].sort(), [
    '_shell.js',
    '_vendor.js',
    'index.html',
  ]);
  assert.deepEqual([...manifestImportClosure(manifest, 'notification-route.tsx')].sort(), [
    '_notification-admin.js',
    '_notification-helper.js',
    '_shell.js',
    '_vendor.js',
    'notification-route.tsx',
  ]);
  assert.deepEqual([...incrementalRouteKeys(manifest, 'notification-route.tsx')].sort(), [
    '_notification-admin.js',
    '_notification-helper.js',
    'notification-route.tsx',
  ]);
});

test('LiveKit stays isolated from the generic async vendor graph', async () => {
  const config = await viteConfig({
    command: 'build',
    mode: 'production',
    isSsrBuild: false,
    isPreview: false,
  });
  const output = config.build?.rollupOptions?.output;
  assert.ok(output && !Array.isArray(output));
  const groups = output.codeSplitting?.groups;
  assert.ok(Array.isArray(groups));
  const liveKit = groups.find((group) => group.name === 'vendor-livekit');
  const asyncVendor = groups.find((group) => group.name === 'async-vendor');
  assert.ok(liveKit);
  assert.ok(asyncVendor);
  assert.equal(liveKit.includeDependenciesRecursively, false);
  assert.equal(liveKit.minSize, 0);
  assert.ok(liveKit.priority > asyncVendor.priority);

  for (const moduleId of [
    '/workspace/node_modules/@livekit/components-react/dist/index.js',
    '/workspace/node_modules/.pnpm/@livekit+components-core@0.12.15/node_modules/@livekit/components-core/dist/index.js',
    '/workspace/node_modules/livekit-client/dist/livekit-client.esm.mjs',
    '/workspace/node_modules/@livekit/protocol/dist/index.js',
    '/workspace/node_modules/.pnpm/@bufbuild+protobuf@1.10.1/node_modules/@bufbuild/protobuf/dist/esm/index.js',
  ]) {
    assert.equal(liveKit.test(moduleId), true, moduleId);
  }
  for (const moduleId of [
    '/workspace/node_modules/@tanstack/react-query/build/modern/index.js',
    '/workspace/node_modules/@mui/material/Box/index.js',
    '/workspace/node_modules/lucide-react/dist/esm/lucide-react.js',
    '/workspace/node_modules/jose/dist/webapi/index.js',
  ]) {
    assert.equal(liveKit.test(moduleId), false, moduleId);
  }
});

test('heavy optional SDK families stay out of ordinary async vendor chunks', async () => {
  const config = await viteConfig({
    command: 'build',
    mode: 'production',
    isSsrBuild: false,
    isPreview: false,
  });
  const output = config.build?.rollupOptions?.output;
  assert.ok(output && !Array.isArray(output));
  const groups = output.codeSplitting?.groups;
  assert.ok(Array.isArray(groups));
  const asyncVendor = groups.find((group) => group.name === 'async-vendor');
  assert.ok(asyncVendor);
  const isolatedFamilies = new Map([
    [
      'vendor-mediapipe',
      [
        '/workspace/node_modules/@mediapipe/tasks-vision/vision_bundle.mjs',
        '/workspace/node_modules/.pnpm/@mediapipe+tasks-vision@0.10.14/node_modules/@mediapipe/tasks-vision/vision_bundle.mjs',
      ],
    ],
    [
      'vendor-temporal',
      [
        '/workspace/node_modules/temporal-polyfill/index.js',
        '/workspace/node_modules/temporal-utils/dist/index.js',
        '/workspace/node_modules/temporal-spec/index.js',
      ],
    ],
    [
      'vendor-dnd-kit',
      [
        '/workspace/node_modules/@dnd-kit/core/dist/index.js',
        '/workspace/node_modules/@dnd-kit/sortable/dist/index.js',
        '/workspace/node_modules/@dnd-kit/utilities/dist/index.js',
        '/workspace/node_modules/@dnd-kit/accessibility/dist/index.js',
      ],
    ],
    [
      'vendor-qrcode',
      [
        '/workspace/node_modules/qrcode.react/lib/esm/index.js',
        '/workspace/node_modules/.pnpm/qrcode.react@4.2.0/node_modules/qrcode.react/lib/esm/index.js',
      ],
    ],
  ]);
  const ordinaryDependencies = [
    '/workspace/node_modules/@tanstack/react-query/build/modern/index.js',
    '/workspace/node_modules/@mui/material/Box/index.js',
    '/workspace/node_modules/lucide-react/dist/esm/lucide-react.js',
    '/workspace/node_modules/jose/dist/webapi/index.js',
  ];

  for (const [name, moduleIds] of isolatedFamilies) {
    const group = groups.find((candidate) => candidate.name === name);
    assert.ok(group, name);
    assert.equal(group.includeDependenciesRecursively, false, name);
    assert.equal(group.minSize, 0, name);
    assert.ok(group.priority > asyncVendor.priority, name);
    for (const moduleId of moduleIds) assert.equal(group.test(moduleId), true, moduleId);
    for (const moduleId of ordinaryDependencies) {
      assert.equal(group.test(moduleId), false, `${name}: ${moduleId}`);
    }
  }
});
