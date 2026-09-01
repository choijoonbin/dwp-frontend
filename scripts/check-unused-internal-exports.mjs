#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const INTERNAL_PREFIXES = ['apps/dwp/src/components/', 'apps/dwp/src/features/'];
const PROJECT_PREFIXES = ['apps/', 'libs/'];
const VERIFICATION = /\.(?:test|spec|stories)\.[cm]?[jt]sx?$/u;
const TEST_SUPPORT = /(?:^|\/)(?:test-utils)(?:\/|$)|\.test-support\.[cm]?[jt]sx?$/u;
const DYNAMIC_CONTRACT = /(?:generated|product-manifest)\.[cm]?[jt]sx?$/u;
const normalize = (value) => value.split(path.sep).join('/');

function parseTsConfig(repositoryRoot) {
  const configPath = ts.findConfigFile(repositoryRoot, ts.sys.fileExists, 'tsconfig.json');
  if (!configPath) throw new Error('tsconfig.json was not found.');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) throw new Error('Unable to read tsconfig.json.');
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
  if (parsed.errors.length) throw new Error('Unable to parse tsconfig.json.');
  return parsed;
}

function readAllowlist(repositoryRoot, allowlistPath) {
  const parsed = JSON.parse(fs.readFileSync(path.resolve(repositoryRoot, allowlistPath), 'utf8'));
  if (
    parsed.version !== 1 ||
    !Number.isSafeInteger(parsed.maximumEntries) ||
    parsed.maximumEntries < 0 ||
    !Array.isArray(parsed.entries)
  ) {
    throw new Error(
      'Internal export allowlist must have version 1, a non-negative maximumEntries, and an entries array.'
    );
  }
  return parsed;
}

function declarationNames(statement) {
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations
      .map((declaration) => declaration.name)
      .filter(ts.isIdentifier);
  }
  return statement.name && ts.isIdentifier(statement.name) ? [statement.name] : [];
}

function isDeclarationName(node) {
  const parent = node.parent;
  return (
    (ts.isVariableDeclaration(parent) && parent.name === node) ||
    ((ts.isFunctionDeclaration(parent) ||
      ts.isClassDeclaration(parent) ||
      ts.isInterfaceDeclaration(parent) ||
      ts.isTypeAliasDeclaration(parent) ||
      ts.isEnumDeclaration(parent)) &&
      parent.name === node)
  );
}

const hasModifier = (statement, kind) =>
  statement.modifiers?.some((modifier) => modifier.kind === kind);

export function checkUnusedInternalExports({
  repositoryRoot,
  allowlistPath = 'scripts/internal-export-allowlist.json',
} = {}) {
  const root = path.resolve(repositoryRoot ?? process.cwd());
  const parsed = parseTsConfig(root);
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const checker = program.getTypeChecker();
  const sourceFiles = program.getSourceFiles().filter((sourceFile) => {
    const relative = normalize(path.relative(root, sourceFile.fileName));
    return PROJECT_PREFIXES.some((prefix) => relative.startsWith(prefix));
  });
  const candidates = new Map();

  for (const sourceFile of sourceFiles) {
    const relative = normalize(path.relative(root, sourceFile.fileName));
    if (
      !INTERNAL_PREFIXES.some((prefix) => relative.startsWith(prefix)) ||
      VERIFICATION.test(relative) ||
      TEST_SUPPORT.test(relative) ||
      DYNAMIC_CONTRACT.test(relative)
    ) {
      continue;
    }
    for (const statement of sourceFile.statements) {
      if (
        !hasModifier(statement, ts.SyntaxKind.ExportKeyword) ||
        hasModifier(statement, ts.SyntaxKind.DefaultKeyword)
      ) {
        continue;
      }
      for (const nameNode of declarationNames(statement)) {
        const symbol = checker.getSymbolAtLocation(nameNode);
        if (!symbol) continue;
        const existing = candidates.get(symbol);
        if (existing) existing.declarations.add(nameNode);
        else {
          candidates.set(symbol, {
            path: relative,
            name: nameNode.text,
            declarations: new Set([nameNode]),
            references: 0,
          });
        }
      }
    }
  }

  for (const sourceFile of sourceFiles) {
    const visit = (node) => {
      if (ts.isIdentifier(node)) {
        let symbol = checker.getSymbolAtLocation(node);
        if (symbol?.flags & ts.SymbolFlags.Alias) {
          try {
            symbol = checker.getAliasedSymbol(symbol);
          } catch {
            symbol = undefined;
          }
        }
        const candidate = candidates.get(symbol);
        if (candidate && !candidate.declarations.has(node) && !isDeclarationName(node)) {
          candidate.references += 1;
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  const unused = [...candidates.values()]
    .filter((candidate) => candidate.references === 0)
    .map(({ path: candidatePath, name }) => ({ path: candidatePath, name }))
    .sort(
      (left, right) => left.path.localeCompare(right.path) || left.name.localeCompare(right.name)
    );
  const allowlist = readAllowlist(root, allowlistPath);
  const errors = [];
  if (allowlist.entries.length !== allowlist.maximumEntries) {
    errors.push(
      `allowlist maximumEntries must equal the exact current inventory: ${allowlist.entries.length} entries, maximumEntries ${allowlist.maximumEntries}`
    );
  }
  const allowed = new Map();
  for (const [index, entry] of allowlist.entries.entries()) {
    for (const field of ['path', 'name', 'owner', 'reason', 'removalCondition']) {
      if (typeof entry?.[field] !== 'string' || !entry[field].trim()) {
        errors.push(`allowlist entry ${index + 1} requires a non-empty ${field}`);
      }
    }
    if (typeof entry?.path !== 'string' || typeof entry?.name !== 'string') continue;
    const normalizedPath = normalize(entry.path);
    if (entry.path !== normalizedPath || path.isAbsolute(entry.path) || entry.path.includes('..')) {
      errors.push(`allowlist path must be a normalized repository-relative path: ${entry.path}`);
    }
    const key = `${normalizedPath}#${entry.name}`;
    if (allowed.has(key)) errors.push(`duplicate allowlist entry: ${key}`);
    allowed.set(key, entry);
  }
  const unusedKeys = new Set(unused.map((entry) => `${entry.path}#${entry.name}`));
  for (const key of allowed.keys()) {
    if (!unusedKeys.has(key)) errors.push(`stale allowlist entry: ${key}`);
  }
  for (const entry of unused) {
    const key = `${entry.path}#${entry.name}`;
    if (!allowed.has(key)) errors.push(`unused internal export: ${key}`);
  }
  return { exportedDeclarations: candidates.size, unused, errors };
}

function main() {
  const rootIndex = process.argv.indexOf('--root');
  const repositoryRoot = rootIndex >= 0 ? process.argv[rootIndex + 1] : process.cwd();
  try {
    const result = checkUnusedInternalExports({ repositoryRoot });
    if (result.errors.length) {
      console.error(`Internal export check failed with ${result.errors.length} issue(s):`);
      result.errors.forEach((error) => console.error(`- ${error}`));
      process.exitCode = 1;
      return;
    }
    console.log(
      `PASS internal exports: ${result.exportedDeclarations} declarations checked; ${result.unused.length} exact documented exception(s).`
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
