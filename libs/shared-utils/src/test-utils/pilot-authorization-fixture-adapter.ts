import {
  PILOT_AUTHORIZATION_FIXTURES,
  type PilotAuthorizationComponent,
  type PilotAuthorizationContextCase,
  type PilotAuthorizationFixtureBundle,
  type PilotAuthorizationNegativeCase,
  type PilotAuthorizationTestCase,
  type PilotFixtureOpenRecord,
} from './pilot-authorization-fixtures.generated';

const CATALOG_NAMES = [
  'scopes',
  'targetPopulations',
  'objects',
  'payloads',
  'relationships',
  'supportSessions',
  'stepUpChallenges',
] as const;

export type PilotFixtureSelector = { testId: string } | { fixtureId: string };
export type PilotFrontendProjectionKind = 'MENU' | 'ROUTE' | 'ACCESS_STATE' | 'E2E_SESSION';

export type PilotFixtureSourceReference =
  | Readonly<{ source: 'COMPONENT'; reference: string; value: PilotAuthorizationComponent }>
  | Readonly<{
      source: 'CATALOG';
      catalog: (typeof CATALOG_NAMES)[number];
      reference: string;
      value: PilotFixtureOpenRecord;
    }>
  | Readonly<{ source: 'CASE_DIRECTIVE'; reference: `CASE:${string}` }>;

export type PilotFrontendFixtureProjection = Readonly<{
  projectionKind: PilotFrontendProjectionKind;
  schemaVersion: 1;
  fixtureBundleKey: 'pilot-fixtures.v1';
  fixtureChecksum: string;
  fixedClock: string;
  registryRef: PilotAuthorizationTestCase['requiredRegistryRef'];
  sourceRevisions: PilotAuthorizationFixtureBundle['sourceRevisions'] | null;
  testCase: PilotAuthorizationTestCase;
  composition: readonly PilotFixtureSourceReference[];
  expectedOutcome: string;
  activeAccessMode: PilotAuthorizationTestCase['activeAccessMode'] | null;
  testRegistryOverrideRef: string | null;
  delta: Readonly<Record<string, unknown>> | null;
}>;

function findExactlyOne<T>(
  values: readonly T[],
  predicate: (value: T) => boolean,
  label: string
): T {
  const matches = values.filter(predicate);
  if (matches.length !== 1) {
    throw new Error(`Pilot authorization fixture ${label} resolved ${matches.length} records.`);
  }
  return matches[0] as T;
}

export function selectPilotAuthorizationTestCase(
  selector: PilotFixtureSelector,
  bundle: PilotAuthorizationFixtureBundle = PILOT_AUTHORIZATION_FIXTURES
): PilotAuthorizationTestCase {
  return 'testId' in selector
    ? findExactlyOne(
        bundle.testCases,
        (testCase) => testCase.testId === selector.testId,
        selector.testId
      )
    : findExactlyOne(
        bundle.testCases,
        (testCase) => testCase.fixtureId === selector.fixtureId,
        selector.fixtureId
      );
}

export function selectPilotAuthorizationNegativeCase(
  fixtureId: string,
  bundle: PilotAuthorizationFixtureBundle = PILOT_AUTHORIZATION_FIXTURES
): PilotAuthorizationNegativeCase {
  return findExactlyOne(
    bundle.negativeCases,
    (testCase) => testCase.fixtureId === fixtureId,
    fixtureId
  );
}

export function selectPilotAuthorizationContextCase(
  fixtureId: string,
  bundle: PilotAuthorizationFixtureBundle = PILOT_AUTHORIZATION_FIXTURES
): PilotAuthorizationContextCase {
  return findExactlyOne(
    bundle.contextCases,
    (testCase) => testCase.fixtureId === fixtureId,
    fixtureId
  );
}

function sourceIndex(bundle: PilotAuthorizationFixtureBundle) {
  const components = new Map(bundle.components.map((component) => [component.key, component]));
  const catalogs = new Map<
    string,
    { catalog: (typeof CATALOG_NAMES)[number]; value: PilotFixtureOpenRecord }
  >();
  for (const catalog of CATALOG_NAMES) {
    for (const value of bundle.catalogs[catalog]) {
      if (catalogs.has(value.key)) {
        throw new Error(`Pilot authorization catalog key is ambiguous: ${value.key}`);
      }
      catalogs.set(value.key, { catalog, value });
    }
  }
  return { components, catalogs };
}

function resolveSourceReference(
  reference: string,
  index: ReturnType<typeof sourceIndex>
): PilotFixtureSourceReference {
  if (reference.startsWith('CASE:')) {
    return { source: 'CASE_DIRECTIVE', reference: reference as `CASE:${string}` };
  }
  const component = index.components.get(reference);
  if (component) return { source: 'COMPONENT', reference, value: component };
  const catalog = index.catalogs.get(reference);
  if (catalog) return { source: 'CATALOG', reference, ...catalog };
  throw new Error(`Pilot authorization composition references unknown source key ${reference}.`);
}

export function adaptPilotAuthorizationFixture(
  selector: PilotFixtureSelector,
  projectionKind: PilotFrontendProjectionKind,
  bundle: PilotAuthorizationFixtureBundle = PILOT_AUTHORIZATION_FIXTURES
): PilotFrontendFixtureProjection {
  const testCase = selectPilotAuthorizationTestCase(selector, bundle);
  const index = sourceIndex(bundle);
  return {
    projectionKind,
    schemaVersion: bundle.schemaVersion,
    fixtureBundleKey: bundle.fixtureBundleKey,
    fixtureChecksum: bundle.fixtureChecksum,
    fixedClock: bundle.fixedClock,
    registryRef: testCase.requiredRegistryRef,
    sourceRevisions: bundle.sourceRevisions ?? null,
    testCase,
    composition: testCase.composition.map((reference) => resolveSourceReference(reference, index)),
    expectedOutcome: testCase.expected,
    activeAccessMode: testCase.activeAccessMode ?? null,
    testRegistryOverrideRef: testCase.testRegistryOverrideRef ?? null,
    delta: testCase.delta ?? null,
  };
}

export const toPilotMenuFixture = (selector: PilotFixtureSelector) =>
  adaptPilotAuthorizationFixture(selector, 'MENU');

export const toPilotRouteFixture = (selector: PilotFixtureSelector) =>
  adaptPilotAuthorizationFixture(selector, 'ROUTE');

export const toPilotAccessStateFixture = (selector: PilotFixtureSelector) =>
  adaptPilotAuthorizationFixture(selector, 'ACCESS_STATE');

export const toPilotE2ESessionFixture = (selector: PilotFixtureSelector) =>
  adaptPilotAuthorizationFixture(selector, 'E2E_SESSION');
