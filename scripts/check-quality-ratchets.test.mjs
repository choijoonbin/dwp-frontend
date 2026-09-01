import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceSizeChecker = resolve(repositoryRoot, 'scripts/check-source-size.mjs');
const designSystemChecker = resolve(repositoryRoot, 'scripts/check-design-system-adoption.mjs');
const i18nChecker = resolve(repositoryRoot, 'scripts/check-i18n.mjs');
const importCycleChecker = resolve(repositoryRoot, 'scripts/check-relative-import-cycles.mjs');
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'dwp-quality-ratchet-'));
  temporaryDirectories.push(directory);
  mkdirSync(join(directory, 'apps/dwp/src'), { recursive: true });
  mkdirSync(join(directory, 'libs'), { recursive: true });
  mkdirSync(join(directory, 'scripts'), { recursive: true });
  return directory;
}

function run(checker, directory, args = []) {
  return spawnSync(process.execPath, [checker, ...args], {
    cwd: directory,
    encoding: 'utf8',
  });
}

function i18nFixture() {
  const directory = fixture();
  const localeRoot = join(directory, 'libs/shared-i18n/src/locales');
  const libraryRoot = join(directory, 'libs/shared-i18n/src/lib');
  mkdirSync(join(localeRoot, 'en'), { recursive: true });
  mkdirSync(join(localeRoot, 'ko'), { recursive: true });
  mkdirSync(libraryRoot, { recursive: true });
  writeFileSync(
    join(libraryRoot, 'locales.ts'),
    "export const productLocales = [{ code: 'en' }, { code: 'ko' }] as const;\n"
  );
  writeFileSync(
    join(libraryRoot, 'i18n.ts'),
    "export const PRODUCT_NAMESPACES = ['common'] as const;\n"
  );
  writeFileSync(join(localeRoot, 'en/common.json'), '{"save":"Save"}\n');
  writeFileSync(join(localeRoot, 'ko/common.json'), '{"save":"저장"}\n');
  return directory;
}

test('source-size exceptions cannot retain headroom after a file shrinks', () => {
  const directory = fixture();
  const relative = 'apps/dwp/src/large.ts';
  writeFileSync(join(directory, relative), `${'export const value = 1;\n'.repeat(1_005)}`);
  writeFileSync(
    join(directory, 'scripts/source-size-baseline.json'),
    `${JSON.stringify({ [relative]: 1_010 }, null, 2)}\n`
  );

  const result = run(sourceSizeChecker, directory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /reduced from 1010 to 1005 lines/);
  assert.match(result.stderr, /yarn source-size:baseline/);
});

test('source-size baseline writer records only current oversized files', () => {
  const directory = fixture();
  const oversized = 'apps/dwp/src/large.ts';
  const standard = 'apps/dwp/src/standard.ts';
  writeFileSync(join(directory, oversized), `${'export const value = 1;\n'.repeat(1_005)}`);
  writeFileSync(join(directory, standard), 'export const standard = true;\n');
  writeFileSync(
    join(directory, 'scripts/source-size-baseline.json'),
    `${JSON.stringify({ [oversized]: 1_010 }, null, 2)}\n`
  );

  const result = run(sourceSizeChecker, directory, ['--write']);
  const baseline = JSON.parse(
    readFileSync(join(directory, 'scripts/source-size-baseline.json'), 'utf8')
  );

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(baseline, { [oversized]: 1_005 });
});

test('source-size baseline writer refuses to add a new oversized exception', () => {
  const directory = fixture();
  const relative = 'apps/dwp/src/new-large.ts';
  writeFileSync(join(directory, relative), `${'export const value = 1;\n'.repeat(1_005)}`);
  writeFileSync(join(directory, 'scripts/source-size-baseline.json'), '{}\n');

  const result = run(sourceSizeChecker, directory, ['--write']);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Refusing to raise the source-size baseline/);
  assert.match(result.stderr, /new-large\.ts: 1005 lines exceeds 1000/);
});

test('source-size gate rejects non-numeric baseline limits', () => {
  const directory = fixture();
  const relative = 'apps/dwp/src/large.ts';
  writeFileSync(join(directory, relative), `${'export const value = 1;\n'.repeat(1_005)}`);
  writeFileSync(
    join(directory, 'scripts/source-size-baseline.json'),
    `${JSON.stringify({ [relative]: 'unbounded' }, null, 2)}\n`
  );

  const result = run(sourceSizeChecker, directory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid source-size baseline/);
});

test('source-size gate only trusts a generated marker in the leading file comment', () => {
  const directory = fixture();
  const relative = 'apps/dwp/src/disguised-large.ts';
  writeFileSync(
    join(directory, relative),
    `export const marker = '@generated';\n${'export const value = 1;\n'.repeat(1_004)}`
  );
  writeFileSync(join(directory, 'scripts/source-size-baseline.json'), '{}\n');

  const result = run(sourceSizeChecker, directory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /disguised-large\.ts: 1005 lines exceeds 1000/);
});

test('source-size gate excludes an exact generated-file header', () => {
  const directory = fixture();
  const relative = 'apps/dwp/src/generated.ts';
  writeFileSync(
    join(directory, relative),
    `/** Generated from contracts/example.json. Do not edit manually. */\n${'export interface Value {}\n'.repeat(1_004)}`
  );
  writeFileSync(join(directory, 'scripts/source-size-baseline.json'), '{}\n');

  const result = run(sourceSizeChecker, directory);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1 generated file\(s\) excluded/);
});

test('design-system allowances must be ratcheted after legacy JSX is removed', () => {
  const directory = fixture();
  const relative = 'apps/dwp/src/example.tsx';
  writeFileSync(
    join(directory, relative),
    "import Button from '@mui/material/Button';\nexport const Example = () => <Button>Save</Button>;\n"
  );
  writeFileSync(
    join(directory, 'scripts/design-system-adoption-baseline.json'),
    `${JSON.stringify({ version: 1, files: { [relative]: { Button: 2 } } }, null, 2)}\n`
  );
  writeFileSync(
    join(directory, 'scripts/design-system-adoption-exceptions.json'),
    `${JSON.stringify(
      {
        version: 1,
        rules: [
          {
            id: 'TEST',
            pathPrefix: 'apps/dwp/src/',
            owner: 'Test owner',
            reason: 'Legacy test fixture.',
            removalCondition: 'Remove after migration.',
          },
        ],
      },
      null,
      2
    )}\n`
  );

  const result = run(designSystemChecker, directory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /1 grandfathered JSX use\(s\) were removed/);
});

test('design-system gate rejects new product-owned hard-coded colors', () => {
  const directory = fixture();
  const relative = 'apps/dwp/src/example.tsx';
  writeFileSync(
    join(directory, relative),
    "export const Example = () => <div style={{ color: '#1557D5' }}>Save</div>;\n"
  );
  writeFileSync(
    join(directory, 'scripts/design-system-adoption-baseline.json'),
    `${JSON.stringify({ version: 1, files: {} }, null, 2)}\n`
  );
  writeFileSync(
    join(directory, 'scripts/design-system-adoption-exceptions.json'),
    `${JSON.stringify({ version: 1, rules: [] }, null, 2)}\n`
  );

  const result = run(designSystemChecker, directory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /HardcodedColor direct use increased from 0 to 1/);
});

test('design-system baseline writer refuses to add a new direct primitive allowance', () => {
  const directory = fixture();
  const relative = 'apps/dwp/src/example.tsx';
  writeFileSync(
    join(directory, relative),
    "import Button from '@mui/material/Button';\nexport const Example = () => <Button>Save</Button>;\n"
  );
  writeFileSync(
    join(directory, 'scripts/design-system-adoption-baseline.json'),
    `${JSON.stringify({ version: 1, files: {} }, null, 2)}\n`
  );

  const result = run(designSystemChecker, directory, ['--write']);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Refusing to raise the design-system adoption baseline/);
  assert.match(result.stderr, /example\.tsx: Button 0 -> 1/);
});

test('design-system gate rejects non-numeric baseline allowances', () => {
  const directory = fixture();
  const relative = 'apps/dwp/src/example.tsx';
  writeFileSync(
    join(directory, relative),
    "import Button from '@mui/material/Button';\nexport const Example = () => <Button>Save</Button>;\n"
  );
  writeFileSync(
    join(directory, 'scripts/design-system-adoption-baseline.json'),
    `${JSON.stringify({ version: 1, files: { [relative]: { Button: 'unbounded' } } }, null, 2)}\n`
  );
  writeFileSync(
    join(directory, 'scripts/design-system-adoption-exceptions.json'),
    `${JSON.stringify({ version: 1, rules: [] }, null, 2)}\n`
  );

  const result = run(designSystemChecker, directory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unsupported design-system adoption baseline format/);
});

test('design-system scanner catches namespace JSX, expression date types, and template colors', () => {
  const directory = fixture();
  const relative = 'apps/dwp/src/example.tsx';
  writeFileSync(
    join(directory, relative),
    [
      "import * as Mui from '@mui/material';",
      "const suffix = 'f';",
      'export const Example = () => (',
      "  <><Mui.Button>Save</Mui.Button><input type={'date'} /><span style={{ color: `#fff${suffix}` }}>Tone</span></>",
      ');',
      '',
    ].join('\n')
  );
  writeFileSync(
    join(directory, 'scripts/design-system-adoption-baseline.json'),
    `${JSON.stringify({ version: 1, files: {} }, null, 2)}\n`
  );
  writeFileSync(
    join(directory, 'scripts/design-system-adoption-exceptions.json'),
    `${JSON.stringify({ version: 1, rules: [] }, null, 2)}\n`
  );

  const result = run(designSystemChecker, directory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Button direct use increased from 0 to 1/);
  assert.match(result.stderr, /NativeDateTimeInput direct use increased from 0 to 1/);
  assert.match(result.stderr, /HardcodedColor direct use increased from 0 to 1/);
});

test('design-system scanner catches raw visual specs across objects, JSX props, and CSS templates', () => {
  const directory = fixture();
  const relative = 'apps/dwp/src/example.tsx';
  writeFileSync(
    join(directory, relative),
    [
      "import styled from '@emotion/styled';",
      "import Typography from '@mui/material/Typography';",
      'const Surface = styled.div`',
      '  border-radius: 7px;',
      '  box-shadow: 0 4px 12px rgb(0 0 0 / 12%);',
      '  filter: drop-shadow(0 2px 3px rgb(0 0 0 / 10%));',
      '  transition: transform 120ms ease-out;',
      '  font-size: 0.875rem;',
      '`;',
      'const surfaceStyle = {',
      '  borderRadius: { xs: 2, md: 3 },',
      "  boxShadow: '0 4px 12px rgb(0 0 0 / 12%)',",
      "  transition: 'transform 120ms ease-out',",
      "  animationIterationCount: 'infinite',",
      "  fontSize: '0.875rem',",
      '};',
      'export const Example = () => <Surface style={surfaceStyle}><Typography fontWeight={750}>Raw</Typography></Surface>;',
      '',
    ].join('\n')
  );
  writeFileSync(
    join(directory, 'scripts/design-system-adoption-baseline.json'),
    `${JSON.stringify({ version: 2, files: {} }, null, 2)}\n`
  );
  writeFileSync(
    join(directory, 'scripts/design-system-adoption-exceptions.json'),
    `${JSON.stringify({ version: 1, rules: [] }, null, 2)}\n`
  );

  const result = run(designSystemChecker, directory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /RawRadius direct use increased from 0 to 2/);
  assert.match(result.stderr, /RawShadow direct use increased from 0 to 3/);
  assert.match(result.stderr, /RawMotion direct use increased from 0 to 3/);
  assert.match(result.stderr, /RawTypography direct use increased from 0 to 3/);
});

test('design-system v1 baseline migration records new visual contracts once and remains exact', () => {
  const directory = fixture();
  const relative = 'apps/dwp/src/example.tsx';
  const legacySource = [
    "import Button from '@mui/material/Button';",
    "export const Example = () => <Button sx={{ borderRadius: '7px' }}>Save</Button>;",
    '',
  ].join('\n');
  writeFileSync(join(directory, relative), legacySource);
  writeFileSync(
    join(directory, 'scripts/design-system-adoption-baseline.json'),
    `${JSON.stringify({ version: 1, files: { [relative]: { Button: 1 } } }, null, 2)}\n`
  );
  writeFileSync(
    join(directory, 'scripts/design-system-adoption-exceptions.json'),
    `${JSON.stringify(
      {
        version: 1,
        rules: [
          {
            id: 'OWNED',
            pathPrefix: 'apps/dwp/src/',
            owner: 'Platform',
            reason: 'Legacy fixture.',
            removalCondition: 'Replace the fixture.',
          },
        ],
      },
      null,
      2
    )}\n`
  );

  const migration = run(designSystemChecker, directory, ['--write']);
  const baseline = JSON.parse(
    readFileSync(join(directory, 'scripts/design-system-adoption-baseline.json'), 'utf8')
  );

  assert.equal(migration.status, 0, migration.stderr);
  assert.equal(baseline.version, 2);
  assert.deepEqual(baseline.files[relative], { Button: 1, RawRadius: 1 });
  assert.equal(run(designSystemChecker, directory).status, 0);

  writeFileSync(
    join(directory, relative),
    "import Button from '@mui/material/Button';\nexport const Example = () => <Button sx={{ borderRadius: '7px', fontSize: '13px' }}>Save</Button>;\n"
  );
  const increase = run(designSystemChecker, directory, ['--write']);
  assert.equal(increase.status, 1);
  assert.match(increase.stderr, /RawTypography 0 -> 1/);

  writeFileSync(
    join(directory, relative),
    "import Button from '@mui/material/Button';\nexport const Example = () => <Button>Save</Button>;\n"
  );
  const stale = run(designSystemChecker, directory);
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /1 grandfathered JSX use\(s\) were removed/);
});

test('design-system gate rejects a direct progress indicator without an accessible contract', () => {
  const directory = fixture();
  const relative = 'apps/dwp/src/example.tsx';
  writeFileSync(
    join(directory, relative),
    "import Busy from '@mui/material/CircularProgress';\nexport const Example = () => <Busy />;\n"
  );
  writeFileSync(
    join(directory, 'scripts/design-system-adoption-baseline.json'),
    `${JSON.stringify({ version: 1, files: { [relative]: { CircularProgress: 1 } } }, null, 2)}\n`
  );
  writeFileSync(
    join(directory, 'scripts/design-system-adoption-exceptions.json'),
    `${JSON.stringify(
      {
        version: 1,
        rules: [
          {
            id: 'OWNED',
            pathPrefix: 'apps/dwp/src/',
            owner: 'Platform',
            reason: 'Legacy fixture.',
            removalCondition: 'Replace the fixture.',
          },
        ],
      },
      null,
      2
    )}\n`
  );

  const result = run(designSystemChecker, directory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /example\.tsx:2: CircularProgress must have an i18n-backed/);
});

test('design-system gate accepts named and explicitly decorative progress indicators', () => {
  const directory = fixture();
  const relative = 'apps/dwp/src/example.tsx';
  writeFileSync(
    join(directory, relative),
    [
      "import { CircularProgress, LinearProgress } from '@mui/material';",
      'const t = (key) => key;',
      'export const Example = () => <><CircularProgress aria-label={t(\'loading\')} /><LinearProgress aria-hidden="true" /></>;',
      '',
    ].join('\n')
  );
  writeFileSync(
    join(directory, 'scripts/design-system-adoption-baseline.json'),
    `${JSON.stringify(
      { version: 1, files: { [relative]: { CircularProgress: 1, LinearProgress: 1 } } },
      null,
      2
    )}\n`
  );
  writeFileSync(
    join(directory, 'scripts/design-system-adoption-exceptions.json'),
    `${JSON.stringify(
      {
        version: 1,
        rules: [
          {
            id: 'OWNED',
            pathPrefix: 'apps/dwp/src/',
            owner: 'Platform',
            reason: 'Legacy fixture.',
            removalCondition: 'Replace the fixture.',
          },
        ],
      },
      null,
      2
    )}\n`
  );

  const result = run(designSystemChecker, directory);

  assert.equal(result.status, 0, result.stderr);
});

test('design-system progress contract rejects a hard-coded aria label', () => {
  const directory = fixture();
  const relative = 'apps/dwp/src/example.tsx';
  writeFileSync(
    join(directory, relative),
    'import Busy from \'@mui/material/CircularProgress\';\nexport const Example = () => <Busy aria-label="Loading" />;\n'
  );
  writeFileSync(
    join(directory, 'scripts/design-system-adoption-baseline.json'),
    `${JSON.stringify({ version: 1, files: { [relative]: { CircularProgress: 1 } } }, null, 2)}\n`
  );
  writeFileSync(
    join(directory, 'scripts/design-system-adoption-exceptions.json'),
    `${JSON.stringify(
      {
        version: 1,
        rules: [
          {
            id: 'OWNED',
            pathPrefix: 'apps/dwp/src/',
            owner: 'Platform',
            reason: 'Legacy fixture.',
            removalCondition: 'Replace the fixture.',
          },
        ],
      },
      null,
      2
    )}\n`
  );

  const result = run(designSystemChecker, directory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /CircularProgress must have an i18n-backed/);
});

test('design-system scanner includes product CSS hard-coded colors', () => {
  const directory = fixture();
  const relative = 'apps/dwp/src/feature.css';
  writeFileSync(join(directory, relative), '.surface { color: #ffffff; }\n');
  writeFileSync(
    join(directory, 'scripts/design-system-adoption-baseline.json'),
    `${JSON.stringify({ version: 1, files: {} }, null, 2)}\n`
  );
  writeFileSync(
    join(directory, 'scripts/design-system-adoption-exceptions.json'),
    `${JSON.stringify({ version: 1, rules: [] }, null, 2)}\n`
  );

  const result = run(designSystemChecker, directory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /feature\.css: HardcodedColor direct use increased from 0 to 1/);
});

test('design-system scanner distinguishes raw CSS specs from token references and disabled effects', () => {
  const directory = fixture();
  const relative = 'apps/dwp/src/feature.css';
  writeFileSync(
    join(directory, relative),
    [
      ':root { --feature-radius: 11px; --feature-font-size: 0.8125rem; }',
      '.surface {',
      '  border-radius: var(--surface-radius);',
      '  box-shadow: none;',
      '  transition: none;',
      '  font-size: var(--type-body-size);',
      '}',
      '',
    ].join('\n')
  );
  writeFileSync(
    join(directory, 'scripts/design-system-adoption-baseline.json'),
    `${JSON.stringify({ version: 2, files: {} }, null, 2)}\n`
  );
  writeFileSync(
    join(directory, 'scripts/design-system-adoption-exceptions.json'),
    `${JSON.stringify({ version: 1, rules: [] }, null, 2)}\n`
  );

  const result = run(designSystemChecker, directory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /feature\.css: RawRadius direct use increased from 0 to 1/);
  assert.match(result.stderr, /feature\.css: RawTypography direct use increased from 0 to 1/);
  assert.doesNotMatch(result.stderr, /RawShadow/);
  assert.doesNotMatch(result.stderr, /RawMotion/);
});

test('design-system gate rejects stale ownership rules', () => {
  const directory = fixture();
  const relative = 'apps/dwp/src/example.tsx';
  writeFileSync(
    join(directory, relative),
    "import Button from '@mui/material/Button';\nexport const Example = () => <Button>Save</Button>;\n"
  );
  writeFileSync(
    join(directory, 'scripts/design-system-adoption-baseline.json'),
    `${JSON.stringify({ version: 1, files: { [relative]: { Button: 1 } } }, null, 2)}\n`
  );
  writeFileSync(
    join(directory, 'scripts/design-system-adoption-exceptions.json'),
    `${JSON.stringify(
      {
        version: 1,
        rules: [
          {
            id: 'OWNED',
            pathPrefix: 'apps/dwp/src/',
            owner: 'Platform',
            reason: 'Legacy fixture.',
            removalCondition: 'Replace the fixture.',
          },
          {
            id: 'STALE',
            pathPrefix: 'apps/dwp/src/unused/',
            owner: 'Platform',
            reason: 'Unused fixture.',
            removalCondition: 'Remove immediately.',
          },
        ],
      },
      null,
      2
    )}\n`
  );

  const result = run(designSystemChecker, directory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /STALE: stale design-system exception rule owns no baseline file/);
});

test('i18n source-debt allowances must be ratcheted after a locale branch is removed', () => {
  const directory = i18nFixture();
  const relative = 'apps/dwp/src/example.ts';
  writeFileSync(join(directory, relative), 'export const example = true;\n');
  writeFileSync(
    join(directory, 'scripts/i18n-source-debt-baseline.json'),
    `${JSON.stringify({ version: 1, files: { [relative]: { localeStartsWithKo: 1 } } }, null, 2)}\n`
  );

  const result = run(i18nChecker, directory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /1 grandfathered i18n source-debt use\(s\) were removed/);
});

test('i18n baseline writer refuses to add a new locale-specific branch allowance', () => {
  const directory = i18nFixture();
  const relative = 'apps/dwp/src/example.ts';
  writeFileSync(
    join(directory, relative),
    "export const isKorean = (language) => language.startsWith('ko');\n"
  );
  writeFileSync(
    join(directory, 'scripts/i18n-source-debt-baseline.json'),
    `${JSON.stringify({ version: 1, files: {} }, null, 2)}\n`
  );

  const result = run(i18nChecker, directory, ['--write-source-debt-baseline']);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Refusing to raise the i18n source-debt baseline/);
  assert.match(result.stderr, /example\.ts: localeStartsWithKo 0 -> 1/);
});

test('i18n gate rejects non-numeric source-debt allowances', () => {
  const directory = i18nFixture();
  const relative = 'apps/dwp/src/example.ts';
  writeFileSync(
    join(directory, relative),
    "export const isKorean = (language) => language.startsWith('ko');\n"
  );
  writeFileSync(
    join(directory, 'scripts/i18n-source-debt-baseline.json'),
    `${JSON.stringify(
      { version: 1, files: { [relative]: { localeStartsWithKo: 'unbounded' } } },
      null,
      2
    )}\n`
  );

  const result = run(i18nChecker, directory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /unsupported i18n source-debt baseline format/);
});

test('i18n scanner catches JSX templates and callable Intl formatters', () => {
  const directory = i18nFixture();
  const relative = 'apps/dwp/src/example.tsx';
  writeFileSync(
    join(directory, relative),
    'export const Example = () => <div>{`Save`}</div>;\nexport const formatter = () => Intl.NumberFormat();\n'
  );
  writeFileSync(
    join(directory, 'scripts/i18n-source-debt-baseline.json'),
    `${JSON.stringify({ version: 1, files: {} }, null, 2)}\n`
  );

  const result = run(i18nChecker, directory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /direct JSX string: "Save"/);
  assert.match(result.stderr, /constructing Intl directly/);
});

test('relative production import cycles fail closed', () => {
  const directory = fixture();
  writeFileSync(join(directory, 'apps/dwp/src/alpha.ts'), "export { beta } from './beta';\n");
  writeFileSync(join(directory, 'apps/dwp/src/beta.ts'), "export { alpha } from './alpha';\n");

  const result = run(importCycleChecker, directory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /alpha\.ts <-> apps\/dwp\/src\/beta\.ts/);
});
