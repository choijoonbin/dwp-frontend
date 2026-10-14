import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  HRIS_IA_SOURCE_FILES,
  parseCsv,
  renderHrisIaRuntimeManifest,
  syncHrisIaRuntimeManifest,
  validateAndProjectHrisIa,
} from './sync-hris-ia-runtime-manifest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function registerRows(relativePath) {
  const text = fs.readFileSync(path.join(root, relativePath), 'utf8').replace(/^\uFEFF/u, '');
  const header = text.slice(0, text.indexOf('\n')).replace(/\r$/u, '').split(',');
  return parseCsv(text, header, relativePath);
}

function inputs() {
  return {
    nodeRows: registerRows(HRIS_IA_SOURCE_FILES.nodes),
    shellRows: registerRows(HRIS_IA_SOURCE_FILES.shellEntries),
    taskGroupRows: registerRows(HRIS_IA_SOURCE_FILES.taskGroups),
  };
}

test('projects the pinned 98-node, 9-entry, 46-group navigation closure', () => {
  const projected = validateAndProjectHrisIa(inputs());

  assert.equal(projected.nodes.length, 98);
  assert.equal(projected.shellEntries.length, 9);
  assert.equal(projected.taskGroups.length, 46);
  assert.equal(projected.nodes.filter((node) => node.sourceSet === 'BASE76').length, 76);
  assert.equal(projected.nodes.filter((node) => node.sourceSet === 'MODERN22').length, 22);
  assert.equal(projected.taskGroups.flatMap((group) => group.memberIaNodeIds).length, 97);
});

test('fails closed on duplicate canonical routes and task-group membership', () => {
  const duplicateRoute = structuredClone(inputs());
  duplicateRoute.nodeRows[1].canonical_route = duplicateRoute.nodeRows[0].canonical_route;
  duplicateRoute.nodeRows[1].deep_link_template = duplicateRoute.nodeRows[0].deep_link_template;
  assert.throws(
    () => validateAndProjectHrisIa(duplicateRoute),
    /canonical route paths must be unique/u
  );

  const duplicateMember = structuredClone(inputs());
  duplicateMember.taskGroupRows[1].member_ia_node_ids =
    duplicateMember.taskGroupRows[0].member_ia_node_ids;
  assert.throws(
    () => validateAndProjectHrisIa(duplicateMember),
    /task groups must cover 97 non-home nodes exactly once/u
  );
});

test('fails closed on non-contiguous task-group order and a default outside its group', () => {
  const orderDrift = structuredClone(inputs());
  orderDrift.taskGroupRows[0].display_order = '9';
  assert.throws(
    () => validateAndProjectHrisIa(orderDrift),
    /display order must be contiguous from zero/u
  );

  const defaultDrift = structuredClone(inputs());
  defaultDrift.taskGroupRows[0].default_ia_node_id = 'BASE:team-home';
  assert.throws(() => validateAndProjectHrisIa(defaultDrift), /default node is not a member/u);
});

test('fails closed on malformed contract provenance and list sentinels', () => {
  const mismatchedNodeId = structuredClone(inputs());
  mismatchedNodeId.nodeRows[0].ia_node_id = 'MODERN:my-hr-home';
  assert.throws(
    () => validateAndProjectHrisIa(mismatchedNodeId),
    /does not match its source set and source node key/u
  );

  const mismatchedDeepLink = structuredClone(inputs());
  mismatchedDeepLink.nodeRows[0].deep_link_template = '/hr/me/profile';
  assert.throws(
    () => validateAndProjectHrisIa(mismatchedDeepLink),
    /deep link must preserve its canonical route/u
  );

  const mixedNone = structuredClone(inputs());
  mixedNone.nodeRows[0].entry_query_refs = 'NONE|IAQ-035';
  assert.throws(() => validateAndProjectHrisIa(mixedNone), /invalid pipe-delimited value/u);
});

test('fails closed on workbench cardinality and authorization-policy drift', () => {
  const cardinalityDrift = structuredClone(inputs());
  cardinalityDrift.taskGroupRows[0].workbench_entry_id = 'HRIS-WB-TEAM';
  assert.throws(
    () => validateAndProjectHrisIa(cardinalityDrift),
    /contains a node outside its workbench inventory/u
  );

  const policyDrift = structuredClone(inputs());
  policyDrift.taskGroupRows[0].visibility_rule = 'ALWAYS_VISIBLE';
  assert.throws(
    () => validateAndProjectHrisIa(policyDrift),
    /navigation or authorization policy drift/u
  );
});

test('renders deterministically and rejects a stale generated target', async () => {
  const first = await renderHrisIaRuntimeManifest(root);
  const second = await renderHrisIaRuntimeManifest(root);
  assert.equal(first, second);
  assert.match(first, /topologySha256/u);

  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'dwp-hris-ia-'));
  const target = path.join(temporaryDirectory, 'hris-information-architecture.generated.ts');
  try {
    await syncHrisIaRuntimeManifest({ mode: '--sync', root, target });
    await syncHrisIaRuntimeManifest({ mode: '--check', root, target });
    fs.appendFileSync(target, '\n// stale\n', 'utf8');
    await assert.rejects(
      syncHrisIaRuntimeManifest({ mode: '--check', root, target }),
      /generated manifest is stale/u
    );
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
