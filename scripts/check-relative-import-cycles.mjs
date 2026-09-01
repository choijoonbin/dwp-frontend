#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

const root = process.cwd();
const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];

function listFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(target);
    if (!extensions.includes(path.extname(target))) return [];
    if (/\.(?:test|spec|stories)\.[cm]?[jt]sx?$/.test(target) || target.endsWith('.d.ts'))
      return [];
    const header = fs.readFileSync(target, 'utf8').slice(0, 512);
    return /(?:@generated|Generated .*Do not edit manually\.)/i.test(header) ? [] : [target];
  });
}

function resolveRelativeImport(sourceFile, specifier, sourceFiles) {
  if (!specifier.startsWith('.')) return undefined;
  const base = path.resolve(path.dirname(sourceFile), specifier);
  const candidates = [
    base,
    ...extensions.map((extension) => `${base}${extension}`),
    ...extensions.map((extension) => path.join(base, `index${extension}`)),
  ];
  return candidates.find((candidate) => sourceFiles.has(candidate));
}

function relativeSpecifiers(file) {
  const source = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const specifiers = [];

  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

function stronglyConnectedComponents(graph) {
  const indexByNode = new Map();
  const lowLinkByNode = new Map();
  const stack = [];
  const onStack = new Set();
  const components = [];
  let nextIndex = 0;

  function visit(node) {
    indexByNode.set(node, nextIndex);
    lowLinkByNode.set(node, nextIndex);
    nextIndex += 1;
    stack.push(node);
    onStack.add(node);

    for (const dependency of graph.get(node) ?? []) {
      if (!indexByNode.has(dependency)) {
        visit(dependency);
        lowLinkByNode.set(node, Math.min(lowLinkByNode.get(node), lowLinkByNode.get(dependency)));
      } else if (onStack.has(dependency)) {
        lowLinkByNode.set(node, Math.min(lowLinkByNode.get(node), indexByNode.get(dependency)));
      }
    }

    if (lowLinkByNode.get(node) !== indexByNode.get(node)) return;
    const component = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      component.push(member);
    } while (member !== node);
    components.push(component);
  }

  for (const node of graph.keys()) {
    if (!indexByNode.has(node)) visit(node);
  }
  return components;
}

const files = listFiles(path.join(root, 'apps/dwp/src')).concat(listFiles(path.join(root, 'libs')));
const sourceFiles = new Set(files.map((file) => path.resolve(file)));
const graph = new Map(
  [...sourceFiles].map((file) => [
    file,
    new Set(
      relativeSpecifiers(file)
        .map((specifier) => resolveRelativeImport(file, specifier, sourceFiles))
        .filter(Boolean)
    ),
  ])
);
const cycles = stronglyConnectedComponents(graph).filter(
  (component) =>
    component.length > 1 || (component.length === 1 && graph.get(component[0])?.has(component[0]))
);

if (cycles.length) {
  console.error(`Relative import cycle check failed with ${cycles.length} cycle(s):`);
  for (const component of cycles) {
    console.error(
      `- ${component
        .map((file) => path.relative(root, file).split(path.sep).join('/'))
        .sort()
        .join(' <-> ')}`
    );
  }
  process.exit(1);
}

console.log(`PASS relative import cycles: ${sourceFiles.size} production modules checked.`);
