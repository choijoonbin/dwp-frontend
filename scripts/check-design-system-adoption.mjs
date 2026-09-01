import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const sourceRoot = path.join(root, 'apps/dwp/src');
const baselinePath = path.join(root, 'scripts/design-system-adoption-baseline.json');
const exceptionPath = path.join(root, 'scripts/design-system-adoption-exceptions.json');
const writeBaseline = process.argv.includes('--write');

const materialComponents = new Set([
  'Autocomplete',
  'Alert',
  'Button',
  'CircularProgress',
  'Dialog',
  'DialogActions',
  'DialogContent',
  'DialogTitle',
  'IconButton',
  'LinearProgress',
  'Skeleton',
  'TextField',
]);
const nativeDateTypes = new Set(['date', 'datetime-local', 'month', 'time', 'week']);
const hardcodedColorPattern = /(?:#[0-9a-f]{3,8}\b|rgba?\(|hsla?\()/i;
const hardcodedColorGlobalPattern = /(?:#[0-9a-f]{3,8}\b|rgba?\(|hsla?\()/gi;
const legacyTrackedContracts = new Set([
  ...materialComponents,
  'DataGrid',
  'DataGridPro',
  'DataGridPremium',
  'MuiDateTimePicker',
  'NativeDateTimeInput',
  'HardcodedColor',
]);
const rawStyleContracts = new Set(['RawRadius', 'RawShadow', 'RawMotion', 'RawTypography']);
const trackedContracts = new Set([...legacyTrackedContracts, ...rawStyleContracts]);
const inaccessibleProgressIndicators = [];

const stylePropertyContracts = new Map([
  ['borderRadius', 'RawRadius'],
  ['borderStartStartRadius', 'RawRadius'],
  ['borderStartEndRadius', 'RawRadius'],
  ['borderEndStartRadius', 'RawRadius'],
  ['borderEndEndRadius', 'RawRadius'],
  ['borderTopLeftRadius', 'RawRadius'],
  ['borderTopRightRadius', 'RawRadius'],
  ['borderBottomLeftRadius', 'RawRadius'],
  ['borderBottomRightRadius', 'RawRadius'],
  ['boxShadow', 'RawShadow'],
  ['textShadow', 'RawShadow'],
  ['transition', 'RawMotion'],
  ['transitionDuration', 'RawMotion'],
  ['transitionDelay', 'RawMotion'],
  ['transitionProperty', 'RawMotion'],
  ['transitionTimingFunction', 'RawMotion'],
  ['animation', 'RawMotion'],
  ['animationDuration', 'RawMotion'],
  ['animationDelay', 'RawMotion'],
  ['animationDirection', 'RawMotion'],
  ['animationFillMode', 'RawMotion'],
  ['animationIterationCount', 'RawMotion'],
  ['animationName', 'RawMotion'],
  ['animationPlayState', 'RawMotion'],
  ['animationTimingFunction', 'RawMotion'],
  ['fontFamily', 'RawTypography'],
  ['fontSize', 'RawTypography'],
  ['fontWeight', 'RawTypography'],
  ['lineHeight', 'RawTypography'],
  ['letterSpacing', 'RawTypography'],
]);
const cssPropertyContracts = [
  {
    pattern:
      /^(?:border-(?:start|end)-(?:start|end)|border-(?:top|bottom)-(?:left|right)|border)-radius$/i,
    contract: 'RawRadius',
  },
  { pattern: /^(?:box|text)-shadow$/i, contract: 'RawShadow' },
  { pattern: /^(?:transition|animation)(?:-[a-z-]+)?$/i, contract: 'RawMotion' },
  {
    pattern: /^(?:font|font-(?:family|size|weight)|line-height|letter-spacing)$/i,
    contract: 'RawTypography',
  },
];
const cssDeclarationPattern = /(?:^|[;{])\s*((?:--[\w-]+)|(?:[a-z-]+))\s*:\s*([^;}]+)/gim;
const cssCustomPropertyContractPatterns = [
  { pattern: /radius/i, contract: 'RawRadius' },
  { pattern: /shadow/i, contract: 'RawShadow' },
  { pattern: /(?:motion|duration|easing|transition|animation)/i, contract: 'RawMotion' },
  { pattern: /(?:font|type|line-height|letter-spacing)/i, contract: 'RawTypography' },
];

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(target);
    if (target.endsWith('.css')) return [target];
    if (!/\.tsx?$/.test(target) || /\.(test|spec|stories)\.tsx?$/.test(target)) return [];
    return target.endsWith('.d.ts') ? [] : [target];
  });
}

function increment(counts, contract) {
  counts[contract] = (counts[contract] ?? 0) + 1;
}

function propertyNameText(name, sourceFile) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return name.getText(sourceFile).replace(/^['"]|['"]$/g, '');
}

function isSafeStyleKeyword(value, contract) {
  const normalized = value
    .trim()
    .replace(/\s*!important\s*$/i, '')
    .toLowerCase();
  if (/^var\(--[\w-]+\)$/.test(normalized)) return true;
  if (
    contract === 'RawTypography' &&
    /^(?:typography\.)?[a-z][\w-]*\.(?:font-?family|font-?size|font-?weight|line-?height|letter-?spacing)$/i.test(
      normalized
    )
  ) {
    return true;
  }
  if (
    contract === 'RawTypography' &&
    ['fontweightlight', 'fontweightregular', 'fontweightmedium', 'fontweightbold'].includes(
      normalized
    )
  ) {
    return true;
  }
  if (contract === 'RawRadius' && normalized === 'shape.borderradius') return true;
  if (['inherit', 'initial', 'revert', 'revert-layer', 'unset'].includes(normalized)) return true;
  if (contract === 'RawRadius' && ['0', '0px', '0rem', '50%'].includes(normalized)) return true;
  if (contract === 'RawShadow' && normalized === 'none') return true;
  if (contract === 'RawMotion' && ['none', '0', '0ms', '0s'].includes(normalized)) return true;
  return false;
}

function expressionContainsRawStyleValue(expression, contract) {
  if (
    ts.isStringLiteral(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression) ||
    ts.isNumericLiteral(expression)
  ) {
    if (contract === 'RawShadow' && ts.isNumericLiteral(expression)) return false;
    return !isSafeStyleKeyword(expression.text, contract);
  }
  if (ts.isPrefixUnaryExpression(expression) && ts.isNumericLiteral(expression.operand)) {
    return contract !== 'RawShadow';
  }
  if (ts.isTemplateExpression(expression)) return true;
  if (ts.isParenthesizedExpression(expression)) {
    return expressionContainsRawStyleValue(expression.expression, contract);
  }
  if (ts.isConditionalExpression(expression)) {
    return (
      expressionContainsRawStyleValue(expression.whenTrue, contract) ||
      expressionContainsRawStyleValue(expression.whenFalse, contract)
    );
  }
  if (ts.isArrayLiteralExpression(expression)) {
    return expression.elements.some((element) =>
      expressionContainsRawStyleValue(element, contract)
    );
  }
  if (ts.isObjectLiteralExpression(expression)) {
    return expression.properties.some((property) => {
      if (ts.isPropertyAssignment(property)) {
        return expressionContainsRawStyleValue(property.initializer, contract);
      }
      if (ts.isShorthandPropertyAssignment(property)) return false;
      if (ts.isSpreadAssignment(property)) return false;
      return false;
    });
  }
  return false;
}

function jsxAttributeContainsRawStyleValue(attribute, contract) {
  if (!attribute.initializer) return false;
  if (ts.isStringLiteral(attribute.initializer)) {
    return !isSafeStyleKeyword(attribute.initializer.text, contract);
  }
  if (!ts.isJsxExpression(attribute.initializer) || !attribute.initializer.expression) return false;
  return expressionContainsRawStyleValue(attribute.initializer.expression, contract);
}

function cssContractForProperty(property) {
  if (property.startsWith('--')) {
    return cssCustomPropertyContractPatterns.find(({ pattern }) => pattern.test(property))
      ?.contract;
  }
  return cssPropertyContracts.find(({ pattern }) => pattern.test(property))?.contract;
}

function collectCssStyleViolations(source, counts) {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  cssDeclarationPattern.lastIndex = 0;
  for (const match of withoutComments.matchAll(cssDeclarationPattern)) {
    const [, property, value] = match;
    const contract =
      cssContractForProperty(property) ??
      (property.toLowerCase() === 'filter' && /drop-shadow\s*\(/i.test(value)
        ? 'RawShadow'
        : undefined);
    if (!contract || isSafeStyleKeyword(value, contract)) continue;
    increment(counts, contract);
  }
}

function importedName(specifier) {
  return specifier.propertyName?.text ?? specifier.name.text;
}

function registerImportAliases(sourceFile) {
  const aliases = new Map();
  const namespaces = new Map();

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }
    if (statement.importClause?.isTypeOnly) continue;

    const moduleName = statement.moduleSpecifier.text;
    const clause = statement.importClause;
    if (!clause) continue;

    if (moduleName.startsWith('@mui/material/')) {
      const component = moduleName.slice('@mui/material/'.length).split('/')[0];
      if (clause.name && materialComponents.has(component)) {
        aliases.set(clause.name.text, component);
      }
    }

    if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
      if (moduleName === '@mui/material') {
        namespaces.set(clause.namedBindings.name.text, 'material');
      } else if (moduleName === '@mui/x-data-grid') {
        namespaces.set(clause.namedBindings.name.text, 'data-grid');
      } else if (moduleName.startsWith('@mui/x-date-pickers')) {
        namespaces.set(clause.namedBindings.name.text, 'date-pickers');
      }
    }

    if (
      moduleName === '@mui/material' &&
      clause.namedBindings &&
      ts.isNamedImports(clause.namedBindings)
    ) {
      for (const specifier of clause.namedBindings.elements) {
        if (specifier.isTypeOnly) continue;
        const component = importedName(specifier);
        if (materialComponents.has(component)) aliases.set(specifier.name.text, component);
      }
    }

    if (
      moduleName === '@mui/x-data-grid' &&
      clause.namedBindings &&
      ts.isNamedImports(clause.namedBindings)
    ) {
      for (const specifier of clause.namedBindings.elements) {
        if (specifier.isTypeOnly) continue;
        const component = importedName(specifier);
        if (['DataGrid', 'DataGridPro', 'DataGridPremium'].includes(component)) {
          aliases.set(specifier.name.text, component);
        }
      }
    }

    if (moduleName.startsWith('@mui/x-date-pickers')) {
      if (clause.name) aliases.set(clause.name.text, 'MuiDateTimePicker');
      if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const specifier of clause.namedBindings.elements) {
          if (specifier.isTypeOnly) continue;
          const component = importedName(specifier);
          if (component.includes('Picker') || component === 'LocalizationProvider') {
            aliases.set(specifier.name.text, 'MuiDateTimePicker');
          }
        }
      }
    }
  }

  return { aliases, namespaces };
}

function literalAttributeValue(attribute) {
  if (!attribute?.initializer) return undefined;
  if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text;
  if (
    ts.isJsxExpression(attribute.initializer) &&
    attribute.initializer.expression &&
    (ts.isStringLiteral(attribute.initializer.expression) ||
      ts.isNoSubstitutionTemplateLiteral(attribute.initializer.expression))
  ) {
    return attribute.initializer.expression.text;
  }
  return undefined;
}

function jsxAttribute(node, sourceFile, name) {
  return node.attributes.properties.find(
    (property) => ts.isJsxAttribute(property) && property.name.getText(sourceFile) === name
  );
}

function hasAccessibleProgressContract(node, sourceFile) {
  const label = jsxAttribute(node, sourceFile, 'aria-label');
  const labelledBy = jsxAttribute(node, sourceFile, 'aria-labelledby');
  const hidden = jsxAttribute(node, sourceFile, 'aria-hidden');
  const role = jsxAttribute(node, sourceFile, 'role');
  const hasUsableExpression = (attribute) => {
    if (!attribute?.initializer) return false;
    if (!ts.isJsxExpression(attribute.initializer) || !attribute.initializer.expression)
      return false;
    const expression = attribute.initializer.expression;
    if ([ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(expression.kind)) {
      return false;
    }
    if (ts.isIdentifier(expression) && expression.text === 'undefined') return false;
    return !(ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression));
  };
  const hasLabelledBy =
    (labelledBy?.initializer &&
      ts.isStringLiteral(labelledBy.initializer) &&
      labelledBy.initializer.text.trim().length > 0) ||
    hasUsableExpression(labelledBy);
  const hiddenExpression =
    hidden?.initializer &&
    ts.isJsxExpression(hidden.initializer) &&
    hidden.initializer.expression?.kind === ts.SyntaxKind.TrueKeyword;

  return (
    hasUsableExpression(label) ||
    hasLabelledBy ||
    literalAttributeValue(hidden) === 'true' ||
    hiddenExpression ||
    ['none', 'presentation'].includes(literalAttributeValue(role))
  );
}

function namespaceContract(tagName, namespaces) {
  if (!ts.isPropertyAccessExpression(tagName) || !ts.isIdentifier(tagName.expression)) {
    return undefined;
  }
  const namespace = namespaces.get(tagName.expression.text);
  const component = tagName.name.text;
  if (namespace === 'material' && materialComponents.has(component)) return component;
  if (
    namespace === 'data-grid' &&
    ['DataGrid', 'DataGridPro', 'DataGridPremium'].includes(component)
  ) {
    return component;
  }
  if (
    namespace === 'date-pickers' &&
    (component.includes('Picker') || component === 'LocalizationProvider')
  ) {
    return 'MuiDateTimePicker';
  }
  return undefined;
}

function isValidBaselineSnapshot(value) {
  if (
    value === null ||
    typeof value !== 'object' ||
    ![1, 2].includes(value.version) ||
    value.files === null ||
    typeof value.files !== 'object' ||
    Array.isArray(value.files)
  ) {
    return false;
  }
  return Object.entries(value.files).every(
    ([file, counts]) =>
      file.startsWith('apps/dwp/src/') &&
      !file.split('/').includes('..') &&
      counts !== null &&
      typeof counts === 'object' &&
      !Array.isArray(counts) &&
      Object.entries(counts).every(
        ([contract, count]) =>
          (value.version === 1
            ? legacyTrackedContracts.has(contract)
            : trackedContracts.has(contract)) &&
          Number.isSafeInteger(count) &&
          count > 0
      )
  );
}

function collectViolations(file) {
  const source = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.css')) {
    const counts = {};
    const count = source.match(hardcodedColorGlobalPattern)?.length ?? 0;
    if (count) counts.HardcodedColor = count;
    collectCssStyleViolations(source, counts);
    return counts;
  }
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const { aliases, namespaces } = registerImportAliases(sourceFile);
  const counts = {};

  function visit(node) {
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      hardcodedColorPattern.test(node.text)
    ) {
      increment(counts, 'HardcodedColor');
    }
    if (ts.isTemplateExpression(node) && hardcodedColorPattern.test(node.getText(sourceFile))) {
      increment(counts, 'HardcodedColor');
    }
    if (ts.isTaggedTemplateExpression(node)) {
      collectCssStyleViolations(node.template.getText(sourceFile).slice(1, -1), counts);
    }

    if (ts.isPropertyAssignment(node)) {
      const property = propertyNameText(node.name, sourceFile);
      const contract =
        stylePropertyContracts.get(property) ??
        cssContractForProperty(property) ??
        (['filter', 'WebkitFilter'].includes(property) &&
        /drop-shadow\s*\(/i.test(node.initializer.getText(sourceFile))
          ? 'RawShadow'
          : undefined);
      if (contract && expressionContainsRawStyleValue(node.initializer, contract)) {
        increment(counts, contract);
      }
    }

    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = ts.isIdentifier(node.tagName) ? node.tagName.text : undefined;
      const aliasedContract = tagName && aliases.has(tagName) ? aliases.get(tagName) : undefined;
      if (aliasedContract) increment(counts, aliasedContract);
      const namespacedContract = namespaceContract(node.tagName, namespaces);
      if (namespacedContract) increment(counts, namespacedContract);
      const progressContract = aliasedContract ?? namespacedContract;
      if (
        ['CircularProgress', 'LinearProgress'].includes(progressContract) &&
        !hasAccessibleProgressContract(node, sourceFile)
      ) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        inaccessibleProgressIndicators.push(
          `${path.relative(root, file).split(path.sep).join('/')}:${line + 1}: ${progressContract} must have an i18n-backed aria-label/aria-labelledby or be explicitly aria-hidden`
        );
      }

      const typeAttribute = node.attributes.properties.find(
        (property) => ts.isJsxAttribute(property) && property.name.getText(sourceFile) === 'type'
      );
      const inputType =
        typeAttribute && ts.isJsxAttribute(typeAttribute)
          ? literalAttributeValue(typeAttribute)
          : undefined;
      if (inputType && nativeDateTypes.has(inputType)) increment(counts, 'NativeDateTimeInput');

      for (const property of node.attributes.properties) {
        if (!ts.isJsxAttribute(property)) continue;
        const attributeName = property.name.getText(sourceFile);
        const contract =
          stylePropertyContracts.get(attributeName) ??
          (['filter', 'WebkitFilter'].includes(attributeName) &&
          /drop-shadow\s*\(/i.test(property.getText(sourceFile))
            ? 'RawShadow'
            : undefined);
        if (contract && jsxAttributeContainsRawStyleValue(property, contract)) {
          increment(counts, contract);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return counts;
}

function currentSnapshot() {
  const files = {};
  for (const file of listFiles(sourceRoot).sort()) {
    const counts = collectViolations(file);
    if (Object.keys(counts).length) {
      files[path.relative(root, file).split(path.sep).join('/')] = counts;
    }
  }
  return { version: 2, files };
}

const current = currentSnapshot();

if (inaccessibleProgressIndicators.length) {
  console.error(
    `Design-system adoption failed with ${inaccessibleProgressIndicators.length} inaccessible progress indicator(s):`
  );
  inaccessibleProgressIndicators.forEach((issue) => console.error(`- ${issue}`));
  process.exit(1);
}

if (writeBaseline) {
  if (!fs.existsSync(baselinePath)) {
    console.error(
      'Refusing to create a design-system adoption baseline; establish the initial policy baseline through an explicit reviewed change.'
    );
    process.exit(1);
  }

  const existingBaseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  if (!isValidBaselineSnapshot(existingBaseline)) {
    console.error('Unsupported design-system adoption baseline format.');
    process.exit(1);
  }

  const increases = [];
  for (const [file, counts] of Object.entries(current.files)) {
    for (const [contract, count] of Object.entries(counts)) {
      const allowed = existingBaseline.files[file]?.[contract] ?? 0;
      const isV2ContractMigration =
        existingBaseline.version === 1 && rawStyleContracts.has(contract);
      if (count > allowed && !isV2ContractMigration) {
        increases.push(`${file}: ${contract} ${allowed} -> ${count}`);
      }
    }
  }
  if (increases.length) {
    console.error('Refusing to raise the design-system adoption baseline:');
    increases.forEach((increase) => console.error(`- ${increase}`));
    process.exit(1);
  }

  fs.writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`);
  const total = Object.values(current.files).reduce(
    (sum, counts) => sum + Object.values(counts).reduce((fileSum, count) => fileSum + count, 0),
    0
  );
  console.log(`Design-system adoption baseline updated (${total} legacy JSX use(s)).`);
  process.exit(0);
}

if (!fs.existsSync(baselinePath)) {
  console.error('Missing design-system adoption baseline. Run `yarn design-system:baseline`.');
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
if (!isValidBaselineSnapshot(baseline)) {
  console.error('Unsupported design-system adoption baseline format.');
  process.exit(1);
}

const issues = [];
let legacyUseCount = 0;
let removedUseCount = 0;

if (!fs.existsSync(exceptionPath)) {
  console.error('Missing design-system exception ownership registry.');
  process.exit(1);
}
const exceptionRegistry = JSON.parse(fs.readFileSync(exceptionPath, 'utf8'));
if (exceptionRegistry.version !== 1 || !Array.isArray(exceptionRegistry.rules)) {
  console.error('Unsupported design-system exception registry format.');
  process.exit(1);
}
for (const rule of exceptionRegistry.rules) {
  for (const field of ['id', 'pathPrefix', 'owner', 'reason', 'removalCondition']) {
    if (typeof rule[field] !== 'string' || !rule[field].trim()) {
      issues.push(`design-system exception rule is missing ${field}`);
    }
  }
  if (!rule.pathPrefix.endsWith('/')) {
    issues.push(`design-system exception ${rule.id || '(unknown)'} pathPrefix must end with /`);
  }
}

const duplicateRuleIds = exceptionRegistry.rules
  .map((rule) => rule.id)
  .filter((id, index, ids) => ids.indexOf(id) !== index);
const duplicateRulePrefixes = exceptionRegistry.rules
  .map((rule) => rule.pathPrefix)
  .filter((prefix, index, prefixes) => prefixes.indexOf(prefix) !== index);
if (duplicateRuleIds.length) {
  issues.push(
    `duplicate design-system exception id(s): ${[...new Set(duplicateRuleIds)].join(', ')}`
  );
}
if (duplicateRulePrefixes.length) {
  issues.push(
    `duplicate design-system exception pathPrefix(es): ${[...new Set(duplicateRulePrefixes)].join(
      ', '
    )}`
  );
}

function exceptionFor(file) {
  return exceptionRegistry.rules
    .filter((rule) => file.startsWith(rule.pathPrefix))
    .sort((left, right) => right.pathPrefix.length - left.pathPrefix.length)[0];
}

for (const rule of exceptionRegistry.rules) {
  const ownsBaselineFile = Object.keys(baseline.files).some(
    (file) => exceptionFor(file)?.id === rule.id
  );
  if (!ownsBaselineFile) {
    issues.push(`${rule.id}: stale design-system exception rule owns no baseline file`);
  }
}

for (const [file, counts] of Object.entries(current.files)) {
  for (const [contract, count] of Object.entries(counts)) {
    const allowed = baseline.files[file]?.[contract] ?? 0;
    legacyUseCount += count;
    if (count > allowed) {
      issues.push(
        `${file}: ${contract} direct use increased from ${allowed} to ${count}; use @dwp-frontend/design-system`
      );
    }
  }
}

for (const [file, counts] of Object.entries(baseline.files)) {
  if (Object.values(counts).some((count) => count > 0) && !exceptionFor(file)) {
    issues.push(`${file}: grandfathered JSX has no owner, reason, and removal condition`);
  }
  for (const [contract, count] of Object.entries(counts)) {
    const currentCount = current.files[file]?.[contract] ?? 0;
    removedUseCount += Math.max(0, count - currentCount);
  }
}

if (removedUseCount > 0) {
  issues.push(
    `${removedUseCount} grandfathered JSX use(s) were removed; run \`yarn design-system:baseline\` to ratchet the allowance down`
  );
}

if (issues.length) {
  console.error(`Design-system adoption failed with ${issues.length} regression(s):`);
  issues.forEach((issue) => console.error(`- ${issue}`));
  process.exit(1);
}

console.log(`Design-system adoption passed (${legacyUseCount} grandfathered JSX use(s)).`);
