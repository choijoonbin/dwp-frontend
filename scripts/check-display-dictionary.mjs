import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const localeRoot = path.join(root, 'libs/shared-i18n/src/locales');
const scanRoots = [path.join(root, 'apps/dwp/src'), path.join(root, 'libs/shared-utils/src')];
const issues = [];

const propertyDomains = new Map([
  ['lifecycleState', 'states'],
  ['healthState', 'states'],
  ['health', 'states'],
  ['state', 'states'],
  ['outcome', 'outcomes'],
  ['severity', 'severities'],
  ['kind', 'entityKinds'],
  ['eventCategory', 'eventCategories'],
  ['sourceType', 'sourceTypes'],
  ['connectorType', 'connectorTypes'],
  ['authMode', 'authModes'],
  ['assignmentType', 'assignmentTypes'],
  ['scopeType', 'scopeTypes'],
  ['targetType', 'targetTypes'],
  ['relationType', 'relationTypes'],
  ['riskTier', 'riskTiers'],
  ['objectType', 'objectTypes'],
  ['action', 'auditActions'],
  ['eventType', 'auditActions'],
  ['latestEventType', 'auditActions'],
]);

const userFacingAttributes = new Set(['label', 'title', 'description', 'helperText']);

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(target);
    return /\.tsx?$/.test(target) && !/\.(test|spec|stories)\.tsx?$/.test(target) ? [target] : [];
  });
}

function registeredStringArray(file, declarationName) {
  const source = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const values = [];

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(sourceFile) === declarationName &&
      node.initializer
    ) {
      const expression = ts.isAsExpression(node.initializer)
        ? node.initializer.expression
        : node.initializer;
      if (ts.isArrayLiteralExpression(expression)) {
        expression.elements.forEach((element) => {
          if (ts.isStringLiteral(element)) values.push(element.text);
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return values;
}

function dictionaryKey(code) {
  return code
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

function loadDictionary(locale) {
  return JSON.parse(fs.readFileSync(path.join(localeRoot, locale, 'display.json'), 'utf8'));
}

const dictionaries = new Map([
  ['en', loadDictionary('en')],
  ['ko', loadDictionary('ko')],
]);

const registeredDomains = registeredStringArray(
  path.join(root, 'libs/shared-i18n/src/lib/display-dictionary.ts'),
  'DISPLAY_DOMAINS'
).sort();
const systemRoleCodes = registeredStringArray(
  path.join(root, 'libs/shared-i18n/src/lib/role-display.ts'),
  'SYSTEM_ROLE_CODES'
);

function propertyDomain(node) {
  if (ts.isPropertyAccessExpression(node)) return propertyDomains.get(node.name.text);
  if (ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression)) {
    return propertyDomains.get(node.argumentExpression.text);
  }
  return undefined;
}

function contractDomain(node, file) {
  const domain = propertyDomain(node);
  if (!domain) return undefined;
  const relative = path.relative(root, file);
  const property = ts.isPropertyAccessExpression(node)
    ? node.name.text
    : ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression)
      ? node.argumentExpression.text
      : '';
  if (property === 'state' || property === 'health') return undefined;
  if (property === 'kind' && !relative.includes('catalog')) return undefined;
  if (property === 'sourceType' && !relative.includes('workforce')) return undefined;
  if (['connectorType', 'authMode'].includes(property) && !relative.includes('workforce')) {
    return undefined;
  }
  return domain;
}

function dangerousReferences(node, result = []) {
  const domain = propertyDomain(node);
  if (domain) result.push({ node, domain });
  ts.forEachChild(node, (child) => dangerousReferences(child, result));
  return result;
}

function isDisplayCall(node) {
  return (
    ts.isCallExpression(node) &&
    ((ts.isIdentifier(node.expression) &&
      ['display', 'resolveDisplayCode', 'auditActionLabel'].includes(node.expression.text)) ||
      (ts.isPropertyAccessExpression(node.expression) &&
        ['display', 'resolveDisplayCode'].includes(node.expression.name.text)))
  );
}

function isEvidenceCode(node) {
  let parent = node.parent;
  while (parent) {
    if (
      ts.isJsxElement(parent) &&
      parent.openingElement.tagName.getText() === 'Box' &&
      parent.openingElement.attributes.properties.some(
        (attribute) =>
          ts.isJsxAttribute(attribute) &&
          attribute.name.getText() === 'component' &&
          attribute.initializer?.getText() === '"code"'
      )
    ) {
      return true;
    }
    if (ts.isFunctionLike(parent) || ts.isSourceFile(parent)) return false;
    parent = parent.parent;
  }
  return false;
}

function lineOf(sourceFile, node) {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return `${path.relative(root, sourceFile.fileName)}:${position.line + 1}`;
}

function requireCode(sourceFile, node, domain, code) {
  const key = dictionaryKey(code);
  for (const [locale, dictionary] of dictionaries) {
    const value = dictionary[domain]?.[key];
    if (typeof value !== 'string' || !value.trim()) {
      issues.push(`${lineOf(sourceFile, node)}: ${locale}/display missing ${domain}.${key}`);
    }
  }
}

function literalValues(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  if (ts.isLiteralTypeNode(node)) return literalValues(node.literal);
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.flatMap((element) => literalValues(element));
  }
  return [];
}

function checkFile(file) {
  const source = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  function reportRaw(node, domain) {
    issues.push(
      `${lineOf(sourceFile, node)}: raw ${domain} code is rendered; use useDisplayDictionary()`
    );
  }

  function visit(node) {
    const highRiskUi =
      /apps\/dwp\/src\/features\/(provider|workforce|integrations)\//.test(file) ||
      /apps\/dwp\/src\/features\/admin\/(audit|catalog|role)/.test(file);
    if (
      highRiskUi &&
      ts.isJsxExpression(node) &&
      !ts.isJsxAttribute(node.parent) &&
      node.expression &&
      !isEvidenceCode(node)
    ) {
      if (!isDisplayCall(node.expression)) {
        const refs = dangerousReferences(node.expression);
        if (
          refs.length &&
          (ts.isPropertyAccessExpression(node.expression) ||
            ts.isTemplateExpression(node.expression))
        ) {
          reportRaw(node, refs[0].domain);
        }
      }
    }

    if (highRiskUi && ts.isJsxAttribute(node) && userFacingAttributes.has(node.name.getText())) {
      const expression =
        node.initializer && ts.isJsxExpression(node.initializer)
          ? node.initializer.expression
          : undefined;
      if (expression && !isDisplayCall(expression)) {
        const refs = dangerousReferences(expression);
        if (
          refs.length &&
          (ts.isPropertyAccessExpression(expression) || ts.isTemplateExpression(expression))
        ) {
          reportRaw(node, refs[0].domain);
        }
      }
    }

    if (ts.isPropertyAssignment(node) && node.name.getText(sourceFile) === 'defaultValue') {
      const refs = dangerousReferences(node.initializer);
      if (refs.length) reportRaw(node, refs[0].domain);
    }

    if (ts.isBinaryExpression(node)) {
      const leftDomain = contractDomain(node.left, file);
      const rightDomain = contractDomain(node.right, file);
      if (leftDomain) {
        literalValues(node.right).forEach((value) =>
          requireCode(sourceFile, node, leftDomain, value)
        );
      }
      if (rightDomain) {
        literalValues(node.left).forEach((value) =>
          requireCode(sourceFile, node, rightDomain, value)
        );
      }
    }

    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'includes' &&
      node.arguments.length
    ) {
      const domain = contractDomain(node.arguments[0], file);
      if (domain) {
        literalValues(node.expression.expression).forEach((value) =>
          requireCode(sourceFile, node, domain, value)
        );
      }
    }

    if (ts.isPropertySignature(node) && node.type) {
      const name = node.name.getText(sourceFile).replace(/["']/g, '');
      const relative = path.relative(root, file);
      const domain =
        file.includes(`${path.sep}libs${path.sep}shared-utils${path.sep}`) &&
        name !== 'state' &&
        name !== 'health' &&
        (name !== 'kind' || relative.includes('catalog')) &&
        (name !== 'sourceType' || relative.includes('workforce')) &&
        (!['connectorType', 'authMode'].includes(name) || relative.includes('workforce'))
          ? propertyDomains.get(name)
          : undefined;
      if (domain && ts.isUnionTypeNode(node.type)) {
        node.type.types.forEach((type) =>
          literalValues(type).forEach((value) => requireCode(sourceFile, node, domain, value))
        );
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

for (const [locale, dictionary] of dictionaries) {
  const dictionaryDomains = Object.keys(dictionary)
    .filter((domain) => domain !== 'empty' && domain !== 'unmapped')
    .sort();
  if (JSON.stringify(dictionaryDomains) !== JSON.stringify(registeredDomains)) {
    issues.push(
      `${locale}/display domains (${dictionaryDomains.join(', ')}) do not match DISPLAY_DOMAINS (${registeredDomains.join(', ')})`
    );
  }
  for (const [domain, entries] of Object.entries(dictionary)) {
    if (domain === 'empty' || domain === 'unmapped') continue;
    if (!entries || typeof entries !== 'object' || !Object.keys(entries).length) {
      issues.push(`${locale}/display domain ${domain} is empty`);
    }
  }
  for (const roleCode of systemRoleCodes) {
    for (const domain of ['roleNames', 'roleDescriptions']) {
      const value = dictionary[domain]?.[roleCode];
      if (typeof value !== 'string' || !value.trim()) {
        issues.push(`${locale}/display missing ${domain}.${roleCode}`);
      }
    }
  }
}

scanRoots.flatMap(listFiles).forEach(checkFile);

if (issues.length) {
  console.error(`display dictionary validation failed with ${issues.length} issue(s):`);
  issues.forEach((issue) => console.error(`- ${issue}`));
  process.exit(1);
}

console.log('display dictionary validation passed: code coverage and UI exposure are controlled.');
