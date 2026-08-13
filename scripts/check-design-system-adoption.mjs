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
  'Button',
  'Dialog',
  'DialogActions',
  'DialogContent',
  'DialogTitle',
  'IconButton',
  'TextField',
]);
const nativeDateTypes = new Set(['date', 'datetime-local', 'month', 'time', 'week']);

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(target);
    if (!/\.tsx?$/.test(target) || /\.(test|spec|stories)\.tsx?$/.test(target)) return [];
    return target.endsWith('.d.ts') ? [] : [target];
  });
}

function increment(counts, contract) {
  counts[contract] = (counts[contract] ?? 0) + 1;
}

function importedName(specifier) {
  return specifier.propertyName?.text ?? specifier.name.text;
}

function registerImportAliases(sourceFile) {
  const aliases = new Map();

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

  return aliases;
}

function literalAttributeValue(attribute) {
  if (!attribute?.initializer || !ts.isStringLiteral(attribute.initializer)) return undefined;
  return attribute.initializer.text;
}

function collectViolations(file) {
  const source = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const aliases = registerImportAliases(sourceFile);
  const counts = {};

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = ts.isIdentifier(node.tagName) ? node.tagName.text : undefined;
      if (tagName && aliases.has(tagName)) increment(counts, aliases.get(tagName));

      const typeAttribute = node.attributes.properties.find(
        (property) => ts.isJsxAttribute(property) && property.name.getText(sourceFile) === 'type'
      );
      const inputType =
        typeAttribute && ts.isJsxAttribute(typeAttribute)
          ? literalAttributeValue(typeAttribute)
          : undefined;
      if (inputType && nativeDateTypes.has(inputType)) increment(counts, 'NativeDateTimeInput');
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
  return { version: 1, files };
}

const current = currentSnapshot();

if (writeBaseline) {
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
if (baseline.version !== 1 || !baseline.files) {
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
}

function exceptionFor(file) {
  return exceptionRegistry.rules
    .filter((rule) => file.startsWith(rule.pathPrefix))
    .sort((left, right) => right.pathPrefix.length - left.pathPrefix.length)[0];
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

if (issues.length) {
  console.error(`Design-system adoption failed with ${issues.length} regression(s):`);
  issues.forEach((issue) => console.error(`- ${issue}`));
  process.exit(1);
}

const progress = removedUseCount ? `; ${removedUseCount} baseline use(s) removed` : '';
console.log(
  `Design-system adoption passed (${legacyUseCount} grandfathered JSX use(s)${progress}).`
);
