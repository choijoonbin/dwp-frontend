#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const SOURCE_EXTENSIONS = ['.ts', '.tsx'];
const DEFAULT_SOURCE_ROOTS = ['apps/dwp/src', 'apps/product-runtime/src'];
const DEFAULT_ENTRY_ROOTS = [
  'apps/dwp/src/main.tsx',
  'apps/product-runtime/src/main.tsx',
  'libs/api-contracts/src/index.ts',
  'libs/design-system/src/index.ts',
  'libs/shared-i18n/src/index.ts',
  'libs/shared-utils/src/index.ts',
];
const VERIFICATION_FILE_PATTERN = /\.(?:test|spec|stories)\.[cm]?[jt]sx?$/u;
const SUPPORT_FILE_PATTERN = /(?:^|\/)(?:test-utils)(?:\/|$)|\.test-support\.[cm]?[jt]sx?$/u;

const normalize = (value) => value.split(path.sep).join('/');

function listFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(target);
    const normalized = normalize(target);
    if (!SOURCE_EXTENSIONS.includes(path.extname(target))) return [];
    if (target.endsWith('.d.ts')) return [];
    if (VERIFICATION_FILE_PATTERN.test(normalized) || SUPPORT_FILE_PATTERN.test(normalized))
      return [];
    return [path.resolve(target)];
  });
}

function parseTsConfig(repositoryRoot) {
  const configPath = ts.findConfigFile(repositoryRoot, ts.sys.fileExists, 'tsconfig.json');
  if (!configPath) {
    return { options: { moduleResolution: ts.ModuleResolutionKind.Bundler }, errors: [] };
  }
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) return { options: {}, errors: [config.error] };
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
  return { options: parsed.options, errors: parsed.errors };
}

function collectModuleSpecifiers(file) {
  const source = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const specifiers = [];
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require')) &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return specifiers;
}

function resolveSpecifier(specifier, importer, compilerOptions, candidates) {
  const resolution = ts.resolveModuleName(
    specifier,
    importer,
    compilerOptions,
    ts.sys
  ).resolvedModule;
  if (!resolution) return undefined;
  const resolved = path.resolve(resolution.resolvedFileName).replace(/\.d\.ts$/u, '.ts');
  return candidates.has(resolved) ? resolved : undefined;
}

function collectNamedStringLeaves(file, names) {
  if (!fs.existsSync(file)) return [];
  const sourceFile = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const values = [];
  const collect = (node) => {
    if (ts.isStringLiteralLike(node)) values.push(node.text);
    else ts.forEachChild(node, collect);
  };
  sourceFile.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const declaration of node.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        names.has(declaration.name.text) &&
        declaration.initializer
      ) {
        collect(declaration.initializer);
      }
    }
  });
  return values;
}

function viteRoots(repositoryRoot, candidates, compilerOptions) {
  const roots = new Set();
  for (const configName of ['vite.config.ts', 'vite.product.config.ts']) {
    const config = path.join(repositoryRoot, configName);
    if (!fs.existsSync(config)) continue;
    for (const specifier of collectModuleSpecifiers(config)) {
      const resolved = resolveSpecifier(specifier, config, compilerOptions, candidates);
      if (resolved) roots.add(resolved);
    }
  }

  const productConfig = path.join(repositoryRoot, 'vite.product.config.ts');
  for (const value of collectNamedStringLeaves(productConfig, new Set(['routeExports']))) {
    const resolved = path.resolve(repositoryRoot, 'apps/dwp/src/routes', value);
    if (candidates.has(resolved)) roots.add(resolved);
  }
  for (const value of collectNamedStringLeaves(productConfig, new Set(['manifestExports']))) {
    const resolved = path.resolve(repositoryRoot, 'apps/dwp/src/features', value);
    if (candidates.has(resolved)) roots.add(resolved);
  }
  return roots;
}

function readAllowlist(repositoryRoot, allowlistPath) {
  const absolute = path.resolve(repositoryRoot, allowlistPath);
  const parsed = JSON.parse(fs.readFileSync(absolute, 'utf8'));
  if (
    parsed.version !== 1 ||
    !Number.isSafeInteger(parsed.maximumEntries) ||
    parsed.maximumEntries < 0 ||
    !Array.isArray(parsed.entries)
  ) {
    throw new Error(
      'Production reachability allowlist must have version 1, a non-negative maximumEntries, and an entries array.'
    );
  }
  return parsed;
}

export function checkProductionReachability({
  repositoryRoot,
  allowlistPath = 'scripts/production-reachability-allowlist.json',
  sourceRoots = DEFAULT_SOURCE_ROOTS,
  entryRoots = DEFAULT_ENTRY_ROOTS,
} = {}) {
  const root = path.resolve(repositoryRoot ?? process.cwd());
  const libraryRoots = fs.existsSync(path.join(root, 'libs'))
    ? fs
        .readdirSync(path.join(root, 'libs'), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => `libs/${entry.name}/src`)
    : [];
  const candidates = new Set(
    [...sourceRoots, ...libraryRoots].flatMap((directory) => listFiles(path.join(root, directory)))
  );
  const { options: compilerOptions, errors: configErrors } = parseTsConfig(root);
  if (configErrors.length)
    throw new Error('Unable to parse tsconfig.json for reachability analysis.');

  const graph = new Map();
  for (const file of candidates) {
    graph.set(
      file,
      new Set(
        collectModuleSpecifiers(file)
          .map((specifier) => resolveSpecifier(specifier, file, compilerOptions, candidates))
          .filter(Boolean)
      )
    );
  }

  const roots = new Set(
    entryRoots.map((entry) => path.resolve(root, entry)).filter((entry) => candidates.has(entry))
  );
  for (const viteRoot of viteRoots(root, candidates, compilerOptions)) roots.add(viteRoot);

  const reachable = new Set();
  const pending = [...roots];
  while (pending.length) {
    const file = pending.pop();
    if (reachable.has(file)) continue;
    reachable.add(file);
    for (const dependency of graph.get(file) ?? []) pending.push(dependency);
  }

  const unreachable = [...candidates]
    .filter((file) => !reachable.has(file))
    .map((file) => normalize(path.relative(root, file)))
    .sort();
  const allowlist = readAllowlist(root, allowlistPath);
  const entries = allowlist.entries;
  const errors = [];
  if (entries.length !== allowlist.maximumEntries) {
    errors.push(
      `allowlist maximumEntries must equal the exact current inventory: ${entries.length} entries, maximumEntries ${allowlist.maximumEntries}`
    );
  }
  const byPath = new Map();
  for (const [index, entry] of entries.entries()) {
    if (!entry || typeof entry !== 'object') {
      errors.push(`allowlist entry ${index + 1} must be an object`);
      continue;
    }
    for (const field of ['path', 'owner', 'reason', 'removalCondition']) {
      if (typeof entry[field] !== 'string' || !entry[field].trim()) {
        errors.push(`allowlist entry ${index + 1} requires a non-empty ${field}`);
      }
    }
    if (typeof entry.path !== 'string') continue;
    const normalizedPath = normalize(entry.path);
    if (entry.path !== normalizedPath || path.isAbsolute(entry.path) || entry.path.includes('..')) {
      errors.push(`allowlist path must be a normalized repository-relative path: ${entry.path}`);
    }
    if (byPath.has(normalizedPath)) errors.push(`duplicate allowlist entry: ${normalizedPath}`);
    byPath.set(normalizedPath, entry);
  }

  for (const allowedPath of byPath.keys()) {
    if (!unreachable.includes(allowedPath)) errors.push(`stale allowlist entry: ${allowedPath}`);
  }
  for (const file of unreachable) {
    if (!byPath.has(file)) errors.push(`unreachable production module: ${file}`);
  }
  return {
    candidates: candidates.size,
    reachable: reachable.size,
    roots: roots.size,
    unreachable,
    errors,
  };
}

function main() {
  const rootIndex = process.argv.indexOf('--root');
  const repositoryRoot = rootIndex >= 0 ? process.argv[rootIndex + 1] : process.cwd();
  try {
    const result = checkProductionReachability({ repositoryRoot });
    if (result.errors.length) {
      console.error(`Production reachability check failed with ${result.errors.length} issue(s):`);
      for (const error of result.errors) console.error(`- ${error}`);
      process.exitCode = 1;
      return;
    }
    console.log(
      `PASS production reachability: ${result.reachable}/${result.candidates} modules reachable from ${result.roots} roots; ${result.unreachable.length} governed verification root(s).`
    );
  } catch (error) {
    console.error(
      `Production reachability check failed: ${error instanceof Error ? error.message : error}`
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main();
