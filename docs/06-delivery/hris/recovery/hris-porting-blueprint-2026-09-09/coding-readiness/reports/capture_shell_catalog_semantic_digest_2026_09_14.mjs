import { createHash } from 'node:crypto';
import { createServer } from 'file:///Users/a10697/Work/DWP/.codex-worktrees/hris/integration/frontend/node_modules/vite/dist/node/index.js';

const server = await createServer({
  appType: 'custom',
  logLevel: 'error',
  root: process.cwd(),
  server: { middlewareMode: true },
});

try {
  const module = await server.ssrLoadModule(
    '/apps/dwp/src/features/hris/shell/model/hris-product-map-catalog.ts'
  );
  const catalog = module.HRIS_PRODUCT_MAP_CATALOG;
  const semanticJson = JSON.stringify(catalog);
  console.log(
    JSON.stringify({
      schema: 'dwp.hris.shell-catalog-semantic-digest.v1',
      count: catalog.length,
      ids: catalog.map((node) => node.id),
      arrayFrozen: Object.isFrozen(catalog),
      everyNodeFrozen: catalog.every((node) => Object.isFrozen(node)),
      semanticJsonBytes: Buffer.byteLength(semanticJson),
      semanticSha256: createHash('sha256').update(semanticJson).digest('hex'),
    })
  );
} finally {
  await server.close();
}
