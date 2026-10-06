'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const CODING = __dirname;
const ROOT = path.resolve(CODING, '..');
const PYTHON_GUARD = path.join(CODING, 'modern_successor_reader_guard.py');
const JOURNAL = path.join(ROOT, 'g0', 'modern-successor-promotion-transaction-state.json');

function fail(message) {
  throw new Error(`MODERN_SUCCESSOR_READER_FENCE=BLOCKED reason=${message}`);
}

function validateCentralJournals() {
  const contracts = [
    ['g3-control-checkpoint-transaction-state.json', 'dwp.hris.g3.control-checkpoint-transaction-state.v1', new Set(['CONTROL_CHECKPOINT_TRANSACTION_COMMITTED'])],
    ['g3-control-delivery-state.json', 'dwp.hris.g3.control-delivery-transaction-state.v1', new Set(['HEADER_ONLY_CLOSED_GATE', 'CONTROL_DELIVERY_TRANSACTION_COMMITTED'])],
    ['g4-functional-gate-state.json', 'dwp.hris.g4-functional-gate-control-state.v2', new Set(['CONTROL_REGISTER_INITIALIZED', 'CONTROL_REGISTER_COMMITTED'])]
  ];
  for (const [name, schema, statuses] of contracts) {
    const target = path.join(ROOT, 'g0', name);
    let value;
    try { value = JSON.parse(fs.readFileSync(target, 'utf8')); }
    catch (error) { fail(`central journal unreadable ${name}: ${error.message}`); }
    if (value.schema !== schema || value.phase !== 'COMMITTED' || !statuses.has(value.status)) {
      fail(`central journal is not committed: ${name}`);
    }
  }
  if (!fs.existsSync(JOURNAL)) return;
  let value;
  try { value = JSON.parse(fs.readFileSync(JOURNAL, 'utf8')); }
  catch (error) { fail(`promotion journal unreadable: ${error.message}`); }
  const terminal = {
    COMMITTED: 'PROMOTION_TRANSACTION_COMMITTED',
    ROLLED_BACK: 'PROMOTION_TRANSACTION_ROLLED_BACK'
  };
  if (value.schema !== 'dwp.hris.modern-successor-promotion-transaction-state.v1' || terminal[value.phase] !== value.status) {
    fail('promotion journal is nonterminal or malformed');
  }
}

function validateInheritedLease(entrypoint) {
  const fdText = process.env.DWP_HRIS_READER_GUARD_FD;
  if (!/^\d+$/.test(fdText || '')) return false;
  const fd = Number(fdText);
  const expectedEntry = path.relative(ROOT, path.resolve(entrypoint)).split(path.sep).join('/');
  if (process.env.DWP_HRIS_READER_GUARD_ENTRYPOINT !== expectedEntry) {
    fail('inherited reader entrypoint mismatch');
  }
  const lockPath = process.env.DWP_HRIS_READER_GUARD_LOCK_PATH;
  if (!lockPath || path.dirname(lockPath) !== '/Users/a10697/Work/DWP/.codex-worktrees/hris/.control-locks') {
    fail('inherited reader lock path mismatch');
  }
  let descriptorStat;
  let pathStat;
  try {
    descriptorStat = fs.fstatSync(fd);
    pathStat = fs.lstatSync(lockPath);
  } catch (error) {
    fail(`inherited reader descriptor unavailable: ${error.message}`);
  }
  if (!descriptorStat.isFile() || !pathStat.isFile() || pathStat.isSymbolicLink()) {
    fail('inherited reader lock is unsafe');
  }
  if (
    String(descriptorStat.dev) !== process.env.DWP_HRIS_READER_GUARD_DEVICE ||
    String(descriptorStat.ino) !== process.env.DWP_HRIS_READER_GUARD_INODE ||
    descriptorStat.dev !== pathStat.dev || descriptorStat.ino !== pathStat.ino
  ) {
    fail('inherited reader lock identity mismatch');
  }
  validateCentralJournals();
  return true;
}

function ensureGuardedOrRelaunch(entrypoint) {
  if (validateInheritedLease(entrypoint)) return;
  const result = childProcess.spawnSync(
    'python3',
    [PYTHON_GUARD, '--run-cjs', path.resolve(entrypoint), '--', ...process.argv.slice(2)],
    {cwd: ROOT, stdio: 'inherit'}
  );
  if (result.error) fail(`guarded CJS relaunch failed: ${result.error.message}`);
  process.exit(result.status === null ? 78 : result.status);
}

module.exports = {ensureGuardedOrRelaunch, validateInheritedLease};
