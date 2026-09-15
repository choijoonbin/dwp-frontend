import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';

export const HOME_WAVE2_CANONICAL_IDS = [
  'C01-D1440-BASE',
  'C02-D1280-BASE',
  'C03-M390-BASE',
  'C04-M320-BASE',
  'C05-BROWSER-ZOOM-200-CSS720-r01',
  'C06-TEXT-200-D1440-r04',
  'C07-LONG-EN-D1280-r02',
  'C08-DARK-D1440-r02',
  'C09-HIGH-CONTRAST-D1440-r04',
  'C10-D1440-EMPTY-r02',
  'C10-M390-EMPTY-r01',
  'C11-D1440-PARTIAL-r02',
  'C11-M390-PARTIAL-r02',
  'C12-D1440-FORBIDDEN-r02',
  'C12-M390-FORBIDDEN-r04',
  'C13-D1440-STALE-r02',
  'C13-M390-STALE-r03',
  'C14-D1440-BACKGROUND-REFRESH-r02',
  'C14-D1440-INITIAL-LOADING-r02',
  'C14-M390-BACKGROUND-REFRESH-r02',
  'C14-M390-INITIAL-LOADING-r02',
  'C15-D1440-EDITOR-DIRTY-r01',
  'C15-M390-EDITOR-DIRTY-r01',
  'C16-D1440-SAVE-CONFLICT-r02',
  'C16-M390-SAVE-CONFLICT-r02',
  'C17-MODE-PRESET',
  'C18-KEYBOARD-REDUCED-MOTION-SPEC-r02',
  'CLASSIC-STATE-COMPONENT-SPEC-A',
  'FLOW-BASE-DESKTOP-FINAL',
  'FLOW-BASE-MOBILE-FINAL',
  'FLOW-EDITOR-DESKTOP',
  'FLOW-PERSONALIZED-DESKTOP-FINAL',
  'FLOW-PERSONALIZED-MOBILE-FINAL',
];

const BASE_IDS = new Set([
  'C01-D1440-BASE',
  'C02-D1280-BASE',
  'C03-M390-BASE',
  'C04-M320-BASE',
  'FLOW-BASE-DESKTOP-FINAL',
  'FLOW-BASE-MOBILE-FINAL',
  'FLOW-EDITOR-DESKTOP',
  'FLOW-PERSONALIZED-DESKTOP-FINAL',
  'FLOW-PERSONALIZED-MOBILE-FINAL',
]);
const STATE_EVIDENCE_IDS = new Set(HOME_WAVE2_CANONICAL_IDS.slice(9, 28));
const INTERACTION_IDS = new Set([
  'C15-D1440-EDITOR-DIRTY-r01',
  'C15-M390-EDITOR-DIRTY-r01',
  'C16-D1440-SAVE-CONFLICT-r02',
  'C16-M390-SAVE-CONFLICT-r02',
  'C17-MODE-PRESET',
  'C18-KEYBOARD-REDUCED-MOTION-SPEC-r02',
  'FLOW-EDITOR-DESKTOP',
]);
const SHA256 = /^[a-f0-9]{64}$/u;
const COMMIT_SHA = /^[a-f0-9]{40}$/u;
const BROWSER_VERSION = /^\d+\.\d+\.\d+\.\d+$/u;
const FORBIDDEN_RUNTIME_SOURCE =
  /(?:cdn\.tailwindcss\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|https?:\/\/)/u;
const EXPECTED_ARCHIVE_SHA = '926a6461af752aa7ed6d0ee036a75de4d9b3396aeeb879eb9f4269751e61ce2b';
const EXPECTED_REGISTRY_SHA = 'a27654ddea1abe5faf9d995e223b66e4a0485998520eed3a12427a3c165b73ef';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function walkFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? walkFiles(path) : [path];
  });
}

function expectedEvidencePath(id) {
  return STATE_EVIDENCE_IDS.has(id)
    ? 'e2e/home-wave2-state-evidence.spec.ts'
    : 'e2e/home-wave2-acceptance.spec.ts';
}

function expectedVisualPath(id, interaction = false) {
  const suite = STATE_EVIDENCE_IDS.has(id)
    ? 'e2e/home-wave2-state-evidence.spec.ts-snapshots'
    : 'e2e/home-wave2-acceptance.spec.ts-snapshots';
  return `${suite}/home-wave2-${id}${interaction ? '-interaction' : ''}-chromium-darwin.png`;
}

function expectedViewport(id) {
  if (id === 'C04-M320-BASE') return { width: 320, height: 720 };
  if (id === 'C05-BROWSER-ZOOM-200-CSS720-r01') {
    return { width: 720, height: 900, browserZoomPercent: 200 };
  }
  if (id === 'C06-TEXT-200-D1440-r04') {
    return { width: 1440, height: 900, textScalePercent: 200 };
  }
  if (id === 'C02-D1280-BASE' || id === 'C07-LONG-EN-D1280-r02') {
    return { width: 1280, height: 900 };
  }
  if (id === 'CLASSIC-STATE-COMPONENT-SPEC-A') return { width: 1440, height: 1100 };
  if (id.startsWith('FLOW-') && id.includes('DESKTOP')) return { width: 1920, height: 1080 };
  if (id.includes('M390') || (id.startsWith('FLOW-') && id.includes('MOBILE'))) {
    return { width: 390, height: 844 };
  }
  return { width: 1440, height: 900 };
}

function validateGitEvidence(root, commit, path, expectedSha, errors, id) {
  if (!COMMIT_SHA.test(commit ?? '')) return;
  try {
    const bytes = execFileSync('git', ['show', `${commit}:${path}`], {
      cwd: root,
      encoding: 'buffer',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (sha256(bytes) !== expectedSha) {
      errors.push(`${id} screenshot differs from its implementation commit.`);
    }
  } catch {
    errors.push(`${id} visual evidence is absent from implementation commit ${commit}.`);
  }
}

function validateCommittedSource(root, commit, path, errors, id) {
  if (!COMMIT_SHA.test(commit ?? '') || !path || !existsSync(resolve(root, path))) return;
  try {
    const committed = execFileSync('git', ['show', `${commit}:${path}`], {
      cwd: root,
      encoding: 'buffer',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (!committed.equals(readFileSync(resolve(root, path)))) {
      errors.push(`${id} implementation source differs from the sealed implementation commit.`);
    }
  } catch {
    errors.push(`${id} implementation source is absent from implementation commit ${commit}.`);
  }
}

export function validateHomeWave2Evidence(manifest, root) {
  const errors = [];
  if (manifest?.schemaVersion !== 1) errors.push('schemaVersion must be 1.');
  if (manifest?.wave !== 'WAVE_2') errors.push('wave must be WAVE_2.');
  if (manifest?.sourceArchiveSha256 !== EXPECTED_ARCHIVE_SHA) {
    errors.push('source archive SHA-256 does not match the accepted package.');
  }

  const registryPath = resolve(root, 'architecture/home-wave2-design-source-registry.v1.json');
  if (!existsSync(registryPath)) errors.push('vendored design source registry is missing.');
  const registryBytes = existsSync(registryPath) ? readFileSync(registryPath) : Buffer.from('');
  const actualRegistrySha = sha256(registryBytes);
  if (actualRegistrySha !== EXPECTED_REGISTRY_SHA) {
    errors.push('vendored design source registry differs from the accepted registry.');
  }
  if (manifest?.sourceRegistrySha256 !== actualRegistrySha) {
    errors.push('sourceRegistrySha256 does not match the vendored registry.');
  }
  const registry = existsSync(registryPath) ? readJson(registryPath) : { screens: [] };
  const registryById = new Map((registry.screens ?? []).map((screen) => [screen.id, screen]));

  const screens = Array.isArray(manifest?.canonicalScreens) ? manifest.canonicalScreens : [];
  const ids = screens.map((screen) => screen?.id);
  if (JSON.stringify(ids) !== JSON.stringify(HOME_WAVE2_CANONICAL_IDS)) {
    errors.push('canonical screen IDs must match the accepted 33 IDs in canonical order.');
  }
  if (new Set(ids).size !== ids.length) errors.push('canonical screen IDs must be unique.');

  const implementationCommit = manifest?.evidenceEnvironment?.implementationCommit;
  if (!COMMIT_SHA.test(implementationCommit ?? '')) {
    errors.push('evidenceEnvironment requires a full implementation commit SHA.');
  } else {
    try {
      execFileSync('git', ['cat-file', '-e', `${implementationCommit}^{commit}`], {
        cwd: root,
        stdio: 'ignore',
      });
      execFileSync('git', ['merge-base', '--is-ancestor', implementationCommit, 'HEAD'], {
        cwd: root,
        stdio: 'ignore',
      });
    } catch {
      errors.push(
        `implementation commit ${implementationCommit} is unavailable or not an ancestor.`
      );
    }
  }
  const sharedBrowser = manifest?.evidenceEnvironment?.browser;
  if (
    sharedBrowser?.name !== 'Chromium' ||
    sharedBrowser?.project !== 'chromium' ||
    sharedBrowser?.platform !== 'darwin' ||
    !BROWSER_VERSION.test(sharedBrowser?.version ?? '')
  ) {
    errors.push('evidenceEnvironment requires the exact Chromium project/version/platform.');
  }
  if (manifest?.evidenceEnvironment?.reducedMotion !== 'REDUCE') {
    errors.push('evidenceEnvironment must record reduced-motion emulation.');
  }
  if (manifest?.evidenceEnvironment?.axePolicy !== 'CRITICAL_AND_SERIOUS') {
    errors.push('evidenceEnvironment must record the axe critical-and-serious policy.');
  }

  const primaryVisualPaths = new Set();
  const interactionVisualPaths = new Set();
  for (const screen of screens) {
    const id = screen?.id ?? '<unknown>';
    const registryScreen = registryById.get(id);
    if (!registryScreen) {
      errors.push(`${id} is absent from the accepted source registry.`);
    } else if (screen.sourcePngSha256 !== registryScreen.png?.sha256) {
      errors.push(`${id} sourcePngSha256 does not match the accepted source PNG.`);
    }
    if (!SHA256.test(screen.sourcePngSha256 ?? '')) {
      errors.push(`${id} requires its accepted PNG SHA-256.`);
    }

    const base = BASE_IDS.has(id);
    if (base && screen.implementationKind !== 'PRODUCTION_COMPOSITION') {
      errors.push(`${id} must map to a production composition.`);
    }
    if (!base && screen.implementationKind === 'PRODUCTION_COMPOSITION') {
      errors.push(`${id} is state/spec evidence and must not become a product route.`);
    }
    if (base && screen.route !== '/') errors.push(`${id} must use the shared Home route.`);
    if (!base && Object.hasOwn(screen, 'route'))
      errors.push(`${id} must not define a separate route.`);

    if (
      screen.implementationCommit !== implementationCommit ||
      !COMMIT_SHA.test(screen.implementationCommit ?? '')
    ) {
      errors.push(`${id} requires the sealed implementation commit.`);
    }
    const browser = screen.browser;
    if (
      browser?.name !== sharedBrowser?.name ||
      browser?.version !== sharedBrowser?.version ||
      browser?.project !== sharedBrowser?.project ||
      browser?.platform !== sharedBrowser?.platform
    ) {
      errors.push(`${id} requires browser name/version/project/platform metadata.`);
    }
    if (JSON.stringify(screen.viewport) !== JSON.stringify(expectedViewport(id))) {
      errors.push(`${id} requires its exact canonical viewport.`);
    }
    const expectedLocale = id === 'C07-LONG-EN-D1280-r02' ? 'en-US' : 'ko-KR';
    if (screen.locale !== expectedLocale) errors.push(`${id} has an invalid locale.`);
    const expectedTheme =
      id === 'C08-DARK-D1440-r02'
        ? 'DARK'
        : id === 'C09-HIGH-CONTRAST-D1440-r04'
          ? 'FORCED_COLORS'
          : 'LIGHT';
    if (screen.theme !== expectedTheme) errors.push(`${id} has an invalid theme.`);
    if (screen.reducedMotion !== 'REDUCE') errors.push(`${id} must record reduced motion.`);
    if (
      screen.axeResult?.status !== 'PASS' ||
      screen.axeResult?.ruleLevel !== 'CRITICAL_AND_SERIOUS' ||
      screen.axeResult?.violationCount !== 0 ||
      screen.axeResult?.evidence !== expectedEvidencePath(id)
    ) {
      errors.push(`${id} requires a passing axe critical-and-serious result.`);
    }

    if (typeof screen.fixtureId !== 'string' || screen.fixtureId.length === 0) {
      errors.push(`${id} requires an executable fixtureId.`);
    }
    const expectedEvidence = expectedEvidencePath(id);
    if (!Array.isArray(screen.evidence) || !screen.evidence.includes(expectedEvidence)) {
      errors.push(`${id} must cite its executable Wave 2 evidence suite.`);
    }
    const paths = [screen.component, ...(screen.evidence ?? []), screen.visualEvidence].filter(
      Boolean
    );
    for (const path of paths) {
      if (!existsSync(resolve(root, path))) errors.push(`${id} references missing ${path}.`);
    }
    if (
      existsSync(resolve(root, expectedEvidence)) &&
      !readFileSync(resolve(root, expectedEvidence), 'utf8').includes(screen.fixtureId ?? '')
    ) {
      errors.push(`${id} fixtureId ${screen.fixtureId} is not exercised by its evidence.`);
    }

    if (screen.visualEvidence !== expectedVisualPath(id)) {
      errors.push(`${id} requires its exact canonical primary screenshot path.`);
    }
    if (primaryVisualPaths.has(screen.visualEvidence)) {
      errors.push(`${id} reuses another screen's primary visual evidence.`);
    }
    primaryVisualPaths.add(screen.visualEvidence);
    if (typeof screen.visualEvidence !== 'string' || !screen.visualEvidence.endsWith('.png')) {
      errors.push(`${id} requires primary PNG visual evidence.`);
    } else {
      const visualPath = resolve(root, screen.visualEvidence);
      if (!existsSync(visualPath)) {
        errors.push(`${id} references missing ${screen.visualEvidence}.`);
      } else {
        const actual = sha256(readFileSync(visualPath));
        if (!SHA256.test(screen.visualEvidenceSha256 ?? '')) {
          errors.push(`${id} requires its visual evidence SHA-256.`);
        } else if (actual !== screen.visualEvidenceSha256) {
          errors.push(`${id} visual evidence SHA-256 does not match its screenshot.`);
        }
        validateGitEvidence(
          root,
          screen.implementationCommit,
          screen.visualEvidence,
          screen.visualEvidenceSha256,
          errors,
          id
        );
      }
    }

    const comparison = screen.acceptedSourceComparison;
    if (
      comparison?.status !== 'PASS' ||
      comparison?.method !== 'HUMAN_PERCEPTUAL_AND_CONTRACT_REVIEW' ||
      comparison?.sourcePngSha256 !== screen.sourcePngSha256 ||
      comparison?.record !== 'architecture/home-wave2-visual-comparison.md' ||
      !existsSync(resolve(root, comparison?.record ?? ''))
    ) {
      errors.push(`${id} requires a human/perceptual accepted-source comparison record.`);
    }

    if (INTERACTION_IDS.has(id)) {
      const interaction = screen.interactionEvidence;
      const interactionPath = resolve(root, interaction?.path ?? '');
      const expectedPurpose =
        id === 'FLOW-EDITOR-DESKTOP'
          ? 'FIXED_PANEL_FOCUS_AND_SCROLL_CONTRACT'
          : 'VIEWPORT_INTERACTION_AND_FOCUS_CONTRACT';
      if (
        interaction?.path !== expectedVisualPath(id, true) ||
        interaction?.purpose !== expectedPurpose
      ) {
        errors.push(`${id} requires its exact interaction path and purpose.`);
      }
      if (interactionVisualPaths.has(interaction?.path)) {
        errors.push(`${id} reuses another screen's interaction evidence.`);
      }
      interactionVisualPaths.add(interaction?.path);
      if (
        !interaction?.path ||
        !existsSync(interactionPath) ||
        !SHA256.test(interaction?.sha256 ?? '')
      ) {
        errors.push(`${id} requires viewport interaction evidence and SHA-256.`);
      } else {
        const actual = sha256(readFileSync(interactionPath));
        if (actual !== interaction.sha256) {
          errors.push(`${id} interaction evidence SHA-256 does not match its screenshot.`);
        }
        validateGitEvidence(
          root,
          screen.implementationCommit,
          interaction.path,
          interaction.sha256,
          errors,
          id
        );
      }
    }

    if (screen.component && existsSync(resolve(root, screen.component))) {
      const source = readFileSync(resolve(root, screen.component), 'utf8');
      if (FORBIDDEN_RUNTIME_SOURCE.test(source)) {
        errors.push(`${id} production component contains a remote runtime source.`);
      }
      validateCommittedSource(root, screen.implementationCommit, screen.component, errors, id);
    }
  }

  const productionCount = screens.filter(
    (screen) => screen.implementationKind === 'PRODUCTION_COMPOSITION'
  ).length;
  const stateCount = screens.length - productionCount;
  const interactionCount = screens.filter((screen) => screen.interactionEvidence).length;
  const expectedCounts = {
    canonical: 33,
    productionCompositions: 9,
    stateAndSpecificationEvidence: 24,
    primaryVisualEvidence: 33,
    interactionVisualEvidence: INTERACTION_IDS.size,
  };
  if (JSON.stringify(manifest?.counts) !== JSON.stringify(expectedCounts)) {
    errors.push('manifest counts must exactly match 33/9/24/33/7 evidence records.');
  }
  if (
    screens.length !== 33 ||
    productionCount !== 9 ||
    stateCount !== 24 ||
    interactionCount !== 7
  ) {
    errors.push('actual evidence counts must exactly match 33/9/24/7.');
  }

  const testOnly = manifest?.testOnlyStateSpec;
  if (
    testOnly?.html !== 'apps/dwp/home-wave2-state-spec.html' ||
    testOnly?.source !== 'apps/dwp/e2e-fixtures/home-wave2-state-spec.tsx' ||
    testOnly?.productionExcluded !== true ||
    testOnly?.productionReachabilityCheck !== 'scripts/check-production-reachability.mjs' ||
    testOnly?.productionBuildCheck !== 'scripts/check-home-wave2-production-exclusion.mjs'
  ) {
    errors.push('test-only state spec exclusion metadata is invalid.');
  } else {
    for (const path of [
      testOnly.html,
      testOnly.source,
      testOnly.productionReachabilityCheck,
      testOnly.productionBuildCheck,
    ]) {
      if (!existsSync(resolve(root, path)))
        errors.push(`test-only evidence references missing ${path}.`);
    }
    if (testOnly.source.includes('/src/') || testOnly.html.includes('/src/')) {
      errors.push('test-only state spec must remain outside the production source tree.');
    }
    const productionRoot = resolve(root, 'apps/dwp/src');
    const productionReferences = existsSync(productionRoot)
      ? walkFiles(productionRoot)
          .filter((path) => ['.ts', '.tsx', '.js', '.jsx', '.html'].includes(extname(path)))
          .filter((path) => {
            const source = readFileSync(path, 'utf8');
            return (
              source.includes('home-wave2-state-spec.html') ||
              source.includes('e2e-fixtures/home-wave2-state-spec')
            );
          })
      : [];
    if (productionReferences.length > 0) {
      errors.push('test-only state spec is referenced by the production source graph.');
    }
    for (const productionEntry of [
      'apps/dwp/index.html',
      'apps/dwp/vite.config.ts',
      'apps/dwp/vite.config.mts',
      'vite.config.ts',
    ]) {
      const entryPath = resolve(root, productionEntry);
      if (
        existsSync(entryPath) &&
        /home-wave2-state-spec|e2e-fixtures\/home-wave2-state-spec/u.test(
          readFileSync(entryPath, 'utf8')
        )
      ) {
        errors.push(`test-only state spec leaks into production entry ${productionEntry}.`);
      }
    }
  }

  if (
    manifest?.visualReview?.method !== 'HUMAN_PERCEPTUAL_AND_CONTRACT_REVIEW' ||
    manifest?.visualReview?.record !== 'architecture/home-wave2-visual-comparison.md' ||
    manifest?.visualReview?.decision !== 'PASS_WITH_PRODUCT_NATIVE_ADAPTATIONS'
  ) {
    errors.push('visual review metadata is incomplete.');
  }

  const cleanRun = manifest?.cleanRun;
  const receiptPath = resolve(root, cleanRun?.receipt ?? '');
  if (
    cleanRun?.status !== 'PASS' ||
    cleanRun?.testCount !== 15 ||
    JSON.stringify(cleanRun?.suites) !==
      JSON.stringify([
        'e2e/home-wave2-acceptance.spec.ts',
        'e2e/home-wave2-state-evidence.spec.ts',
      ]) ||
    cleanRun?.receipt !== 'architecture/home-wave2-playwright-junit.xml' ||
    !SHA256.test(cleanRun?.receiptSha256 ?? '') ||
    !existsSync(receiptPath)
  ) {
    errors.push('combined 15-test clean-run receipt metadata is invalid.');
  } else {
    const receipt = readFileSync(receiptPath);
    if (sha256(receipt) !== cleanRun.receiptSha256) {
      errors.push('combined clean-run receipt SHA-256 does not match.');
    }
    const xml = receipt.toString('utf8');
    if (
      !/<testsuites\b[^>]*\btests="15"/u.test(xml) ||
      !/<testsuites\b[^>]*\bfailures="0"/u.test(xml) ||
      !/<testsuites\b[^>]*\berrors="0"/u.test(xml) ||
      !xml.includes('home-wave2-acceptance.spec.ts') ||
      !xml.includes('home-wave2-state-evidence.spec.ts')
    ) {
      errors.push('combined clean-run receipt does not prove both suites passed 15/15.');
    }
    validateGitEvidence(
      root,
      implementationCommit,
      cleanRun.receipt,
      cleanRun.receiptSha256,
      errors,
      'combined-clean-run'
    );
  }

  return errors;
}
