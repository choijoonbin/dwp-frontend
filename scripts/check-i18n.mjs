import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const localeRoot = path.join(root, 'libs/shared-i18n/src/locales');
const sourceRoot = path.join(root, 'apps/dwp/src');
const baseLocale = 'en';
const issues = [];

function registeredProductLocales() {
  const registryPath = path.join(root, 'libs/shared-i18n/src/lib/locales.ts');
  const source = fs.readFileSync(registryPath, 'utf8');
  const sourceFile = ts.createSourceFile(
    registryPath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const locales = [];

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(sourceFile) === 'productLocales' &&
      node.initializer
    ) {
      const expression = ts.isAsExpression(node.initializer)
        ? node.initializer.expression
        : node.initializer;
      if (!ts.isArrayLiteralExpression(expression)) return;
      for (const element of expression.elements) {
        if (!ts.isObjectLiteralExpression(element)) continue;
        const code = element.properties.find(
          (property) =>
            ts.isPropertyAssignment(property) && property.name.getText(sourceFile) === 'code'
        );
        if (code && ts.isPropertyAssignment(code) && ts.isStringLiteral(code.initializer)) {
          locales.push(code.initializer.text);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return locales.sort();
}

function registeredProductNamespaces() {
  const registryPath = path.join(root, 'libs/shared-i18n/src/lib/i18n.ts');
  const source = fs.readFileSync(registryPath, 'utf8');
  const sourceFile = ts.createSourceFile(
    registryPath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const namespaces = [];

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(sourceFile) === 'PRODUCT_NAMESPACES' &&
      node.initializer
    ) {
      const expression = ts.isAsExpression(node.initializer)
        ? node.initializer.expression
        : node.initializer;
      if (ts.isArrayLiteralExpression(expression)) {
        for (const element of expression.elements) {
          if (ts.isStringLiteral(element)) namespaces.push(element.text);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return namespaces.sort();
}

function listFiles(directory, predicate) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(target, predicate);
    return predicate(target) ? [target] : [];
  });
}

function flatten(value, prefix = '', result = new Map()) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    result.set(prefix, value);
    return result;
  }
  for (const [key, child] of Object.entries(value)) {
    flatten(child, prefix ? `${prefix}.${key}` : key, result);
  }
  return result;
}

function placeholders(value) {
  if (typeof value !== 'string') return [];
  return [...value.matchAll(/{{\s*([\w.-]+)/g)].map((match) => match[1]).sort();
}

function compareBundles(locale, namespace, baseBundle, candidateBundle) {
  const base = flatten(baseBundle);
  const candidate = flatten(candidateBundle);
  for (const key of base.keys()) {
    if (!candidate.has(key)) issues.push(`${locale}/${namespace}: missing key ${key}`);
  }
  for (const key of candidate.keys()) {
    if (!base.has(key)) issues.push(`${locale}/${namespace}: extra key ${key}`);
  }
  for (const [key, baseValue] of base) {
    if (!candidate.has(key)) continue;
    const candidateValue = candidate.get(key);
    if (typeof baseValue !== typeof candidateValue) {
      issues.push(`${locale}/${namespace}: value type differs for ${key}`);
      continue;
    }
    const expected = placeholders(baseValue).join(',');
    const actual = placeholders(candidateValue).join(',');
    if (expected !== actual) {
      issues.push(
        `${locale}/${namespace}: placeholders differ for ${key} (${expected || 'none'} != ${
          actual || 'none'
        })`
      );
    }
  }
}

function checkBundles() {
  const locales = fs
    .readdirSync(localeRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const registeredLocales = registeredProductLocales();
  if (JSON.stringify(locales) !== JSON.stringify(registeredLocales)) {
    issues.push(
      `product locale registry (${registeredLocales.join(', ')}) does not match locale directories (${locales.join(', ')})`
    );
  }
  for (const locale of registeredLocales) {
    try {
      const canonical = Intl.getCanonicalLocales(locale)[0];
      if (canonical !== locale)
        issues.push(`product locale must use canonical BCP 47 form: ${locale}`);
    } catch {
      issues.push(`invalid BCP 47 product locale: ${locale}`);
    }
  }
  if (!locales.includes(baseLocale)) {
    issues.push(`missing product default locale directory: ${baseLocale}`);
    return;
  }

  const namespaces = fs
    .readdirSync(path.join(localeRoot, baseLocale))
    .filter((file) => file.endsWith('.json'))
    .sort();
  const registeredNamespaces = registeredProductNamespaces().map((value) => `${value}.json`);
  if (JSON.stringify(namespaces) !== JSON.stringify(registeredNamespaces)) {
    issues.push(
      `product namespace registry (${registeredNamespaces.join(', ')}) does not match locale bundles (${namespaces.join(', ')})`
    );
  }
  for (const locale of locales) {
    const localeDirectory = path.join(localeRoot, locale);
    const localeNamespaces = fs
      .readdirSync(localeDirectory)
      .filter((file) => file.endsWith('.json'))
      .sort();
    for (const namespace of namespaces) {
      if (!localeNamespaces.includes(namespace)) {
        issues.push(`${locale}: missing namespace ${namespace}`);
        continue;
      }
      const baseBundle = JSON.parse(
        fs.readFileSync(path.join(localeRoot, baseLocale, namespace), 'utf8')
      );
      const candidateBundle = JSON.parse(
        fs.readFileSync(path.join(localeDirectory, namespace), 'utf8')
      );
      compareBundles(locale, namespace, baseBundle, candidateBundle);
    }
    for (const namespace of localeNamespaces) {
      if (!namespaces.includes(namespace)) issues.push(`${locale}: extra namespace ${namespace}`);
    }
  }
}

const translatedStringAttributes = new Set([
  'alt',
  'aria-label',
  'ariaLabel',
  'description',
  'helperText',
  'label',
  'placeholder',
  'title',
]);

function containsWords(value) {
  if (/^[A-Z]$/.test(value.trim())) return false;
  return /[A-Za-z\u3131-\uD79D]/.test(value);
}

function sourceLocation(sourceFile, node) {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return `${path.relative(root, sourceFile.fileName)}:${position.line + 1}`;
}

function checkSourceFile(file) {
  const source = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  function report(node, reason) {
    issues.push(`${sourceLocation(sourceFile, node)}: ${reason}`);
  }

  function visit(node) {
    if (ts.isJsxText(node)) {
      const value = node.getText(sourceFile).trim();
      if (value && containsWords(value)) report(node, `direct JSX text: ${JSON.stringify(value)}`);
    }

    if (
      ts.isJsxExpression(node) &&
      node.expression &&
      ts.isStringLiteral(node.expression) &&
      containsWords(node.expression.text)
    ) {
      report(node, `direct JSX string: ${JSON.stringify(node.expression.text)}`);
    }

    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sourceFile);
      if (
        translatedStringAttributes.has(name) &&
        node.initializer &&
        ts.isStringLiteral(node.initializer) &&
        containsWords(node.initializer.text)
      ) {
        report(node, `literal ${name} attribute: ${JSON.stringify(node.initializer.text)}`);
      }
    }

    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      if (['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString'].includes(method)) {
        report(
          node,
          'use @dwp-frontend/shared-i18n formatters instead of calling toLocale* directly'
        );
      }
      if (['success', 'error', 'info', 'warning'].includes(method)) {
        const firstArgument = node.arguments[0];
        if (
          firstArgument &&
          ts.isStringLiteral(firstArgument) &&
          containsWords(firstArgument.text)
        ) {
          report(node, `literal feedback message: ${JSON.stringify(firstArgument.text)}`);
        }
      }
    }

    if (
      ts.isNewExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(sourceFile) === 'Intl' &&
      ['DateTimeFormat', 'ListFormat', 'NumberFormat', 'RelativeTimeFormat'].includes(
        node.expression.name.text
      )
    ) {
      report(
        node,
        'use @dwp-frontend/shared-i18n formatters instead of constructing Intl directly'
      );
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

function checkProductSource() {
  const files = listFiles(
    sourceRoot,
    (file) =>
      /\.tsx?$/.test(file) && !/\.(test|spec|stories)\.tsx?$/.test(file) && !file.endsWith('.d.ts')
  );
  files.forEach(checkSourceFile);
}

checkBundles();
checkProductSource();

if (issues.length) {
  console.error(`i18n validation failed with ${issues.length} issue(s):`);
  issues.forEach((issue) => console.error(`- ${issue}`));
  process.exit(1);
}

console.log('i18n validation passed: locale bundles and product source are consistent.');
