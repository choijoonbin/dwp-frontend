import {
  fullDocumentEvidence,
  immersiveEvidence,
} from './meeting-approved-frame-evidence-builders';

import type { ImplementationCaptureEvidence } from './meeting-approved-frame-evidence-builders';
import type { MeetingApprovedFrameId } from './meeting-approved-frame-contract';

// Reviewed implementation snapshots only. Immutable Stitch ZIP/screen/code provenance is separate.
export const implementationCaptureEvidence = {
  'U01-D': fullDocumentEvidence(
    1411,
    '47ca8994abe0b84f30b79d237e18a3ed3d52be910d6741a204fb7cf273f7cd8c',
    [
      '[data-testid="meeting-home-context"]',
      '[data-testid="meeting-command-primary"]',
      '[data-testid="meeting-day-lists"]',
      '[data-testid="meeting-home-continuation"]',
    ],
    '[data-testid="meeting-home-continuation"]'
  ),
  'U01-M': fullDocumentEvidence(
    2295,
    '1507cc496d92ad469a156a20d55b1137efc1d0ceaf70c08d288bb60d8a1d51a7',
    [
      '#dwp-main-content h1',
      '[data-testid="meeting-day-lists"]',
      '[data-testid="meeting-home-continuation"]',
    ],
    '[data-testid="meeting-home-continuation"]',
    true
  ),
  'U02-D': fullDocumentEvidence(
    1614,
    '6a661a856b9c36517ccb99fe5fd4f37082217d5c81d26a4cf4e51485f77688fb',
    ['#dwp-main-content h1', '[data-testid="my-meetings-workspace"]'],
    '[data-testid="my-meetings-workspace"]'
  ),
  'U02-M': fullDocumentEvidence(
    1337,
    '994fab7177ee664e3d83be6061d189432e2f98a8106a781c2ce5fd411e21b83e',
    ['#dwp-main-content h1', '[data-testid="my-meetings-workspace"]'],
    '[data-testid="my-meetings-workspace"]',
    true
  ),
  'U03-D': fullDocumentEvidence(
    2239,
    '8a7cddd659dc57b050669d589427de9ed98040606c527cf0afb2ea9033984775',
    [
      '[data-testid="meeting-schedule-workspace"] h1',
      '[data-testid="meeting-schedule-workspace"] aside',
    ],
    '[data-testid="meeting-schedule-workspace"]'
  ),
  'U03-M': fullDocumentEvidence(
    1360,
    '4a8f61f25b3223388ef8705d5c7dfdcadba713877a8c63cfb1c6fc52e869eb66',
    [
      '[data-testid="meeting-schedule-workspace"] h1',
      '[data-testid="meeting-schedule-workspace"] nav',
    ],
    '[data-testid="meeting-schedule-workspace"]'
  ),
  'U04-D': fullDocumentEvidence(
    1719,
    'b694c2f1f90aa9c6af32c1bbd98810cd4593d0b8db3013489b71f6b5bdb8c7ab',
    ['#preparation-title', '#preparation-agenda'],
    '[data-testid="meeting-preparation"]'
  ),
  'U04-M': fullDocumentEvidence(
    2774,
    '0138c05a2f4ec0def861e5969002ab259568678198b3bd3b1b8c7b7461ff47fe',
    ['#preparation-title', '#preparation-agenda'],
    '[data-testid="meeting-preparation"]'
  ),
  'U05-D': fullDocumentEvidence(
    1440,
    'b630097309db5b8d8aed0c474159f1a0e45f462dc26d80b1cde53c539843cacc',
    ['[data-testid="meeting-prejoin-context"]', '.dwp-meeting-prejoin'],
    '.dwp-meeting-prejoin'
  ),
  'U05-M': fullDocumentEvidence(
    2725,
    '0480f275f80ce860afcac62f69b79986fe0794b8f3bd132020ea08b6edd1ab24',
    [
      '[data-testid="meeting-prejoin-context"]',
      '#dwp-main-content h1',
      '.dwp-meeting-prejoin__stage',
      '.dwp-meeting-prejoin__rail',
    ],
    '.dwp-meeting-prejoin'
  ),
  'U06-D': immersiveEvidence(
    960,
    '1335f9a2d1975cd4dd4de647ef4c06d4305d0d8902c498dd514ab2d6e34e20a4',
    ['.dwp-video-meeting-room__header', '.dwp-video-meeting-room__interactions']
  ),
  'U06-M': immersiveEvidence(
    844,
    'c601a99e653d34cc521b90da9f8f484ab4766d6467609861609afdfc55d04346',
    ['.dwp-video-meeting-room__header', '.dwp-video-meeting-room__interactions']
  ),
  'U07-D': fullDocumentEvidence(
    1545,
    'ffb814370cf1e281cb132f4883b84bf021e1350e2d5f92bbf820fc5f50b0c512',
    ['#dwp-main-content h1', '[data-testid="meeting-library-workspace"]'],
    '[data-testid="meeting-library-workspace"]'
  ),
  'U07-M': fullDocumentEvidence(
    1487,
    '8fd743dba570b5315ec8546c5f8b39d12b6a6a4071802ab08602dbe336223ae7',
    ['#dwp-main-content h1', '[data-testid="meeting-library-workspace"]'],
    '[data-testid="meeting-library-workspace"]',
    true
  ),
  'U08-D': fullDocumentEvidence(
    2474,
    '5bb224ad35c1c6c297cb3ddeda02e159dd81873cffe210959037c08bb48b9033',
    [
      '#meeting-recap-title',
      '[data-testid="meeting-recap-overview"]',
      '[data-testid="meeting-recap-distribution"]',
    ],
    '[data-testid="meeting-recap-distribution"]'
  ),
  'U08-M': fullDocumentEvidence(
    2458,
    'a56ae3d66438cedd0c65b9e5b2f2af79bca7f4fc4865b36bd2f24feb8a1d400d',
    [
      '#meeting-recap-title',
      '[data-testid="meeting-recap-overview"]',
      '[data-testid="meeting-recap-evidence-rail"]',
      '[data-testid="meeting-recap-analysis-disclosure"]',
      '[data-testid="meeting-recap-distribution"]',
    ],
    '[data-testid="meeting-recap-distribution"]',
    true
  ),
  'U09-D': fullDocumentEvidence(
    1591,
    '5139709ce2e9dadca46b4a474c3936d766a9885ad147ada3e615d6259d8591e3',
    ['#dwp-main-content h1', '[data-testid="meeting-follow-ups"]'],
    '[data-testid="meeting-follow-ups"]'
  ),
  'U09-M': fullDocumentEvidence(
    1780,
    'e2c4e4ed1b7e5ec5b42ce4016370420b38edbc76438b30aa1d84e72f2259e299',
    [
      '#dwp-main-content h1',
      '[data-testid="meeting-follow-ups"]',
      '[data-testid^="follow-up-row-"]',
    ],
    '[data-testid="meeting-follow-ups"]',
    true
  ),
  'U10-D': fullDocumentEvidence(
    1262,
    '426e30f8c86eff1e117cda6378bb14c5032dbdedfb7c2bf19b9e0b4e1c4aec2e',
    [
      '[data-testid="meeting-templates"] h1',
      '[data-testid="template-search-scope"]',
      '[data-testid="template-list"]',
    ],
    '[data-testid="meeting-templates"]'
  ),
  'U10-M': fullDocumentEvidence(
    1989,
    '00c6c97b2ee53c8b1d7a755b480d3d12cd669e2618dc96e5fe2d3dbe3a68cb21',
    [
      '#dwp-main-content h1',
      '[data-testid="template-mobile-intro"]',
      '[data-testid="template-search-scope"]',
      '[data-testid="template-list"]',
    ],
    '[data-testid="meeting-templates"]',
    true
  ),
  'U11-D': fullDocumentEvidence(
    1493,
    '3dbfc8c2fa0acd7389e4cc9bfb7459a8a06f3ebfc4defb89c50a223b905a630c',
    [
      '[data-testid="meeting-personal-room"] h1',
      'section[aria-labelledby="personal-room-current"]',
    ],
    '[data-testid="meeting-personal-room"]'
  ),
  'U11-M': fullDocumentEvidence(
    1609,
    '73a03bd2a796f6aa459ae2810b0936bf2412736cec9853c93c77e85cfaec9361',
    [
      '#dwp-main-content h1',
      'section[aria-labelledby="personal-room-current"]',
      '#personal-room-policy',
      '#personal-room-history',
      '[data-testid="personal-room-supplemental-settings"]',
    ],
    '[data-testid="personal-room-supplemental-settings"]',
    true
  ),
  'U12-D': fullDocumentEvidence(
    2717,
    '43584280d31fed503da9998bc19ee526bee2f42cc0759af8f630f9a0a00821a1',
    [
      '[data-testid="meeting-preferences-workspace"] h1',
      '#meeting-preferences-join',
      '#meeting-preferences-advanced',
    ],
    '[data-testid="meeting-preferences-workspace"]'
  ),
  'U12-M': {
    ...fullDocumentEvidence(
      2882,
      '1caf4ff0cc4690111f03223a4e8df2b1d74a0c4227d5adfe47b2e55ae32ef70d',
      [
        '#dwp-main-content h1',
        '#meeting-preferences-join',
        '#meeting-preferences-advanced',
        '#dwp-main-content aside',
      ],
      '#dwp-main-content aside'
    ),
    clearance: {
      horizontalOverflowTolerancePx: 1,
      lastContentSelector: '#dwp-main-content aside',
      maxTrailingGapPx: 128,
      fixedOverlaySelector: '[data-testid="meeting-preferences-save-dock"]',
      fixedOverlayContentSelector: '[data-testid="meeting-preferences-workspace"]',
    },
  },
  'U13-D': fullDocumentEvidence(
    1551,
    '44db0c9f04a732a13c97b38e6b1b7cec4f0bf2d298d81f980d51d02fa028b1d2',
    [
      '#dwp-main-content h1',
      '[data-testid="meeting-admin-impact-primary"]',
      'section[aria-labelledby="meeting-exceptions-title"]',
    ],
    'section[aria-labelledby="meeting-exceptions-title"]'
  ),
  'U13-M': fullDocumentEvidence(
    2335,
    '745995e33795ed89efea34f57404c65aed22914a30787207ce56eba26a097a16',
    [
      '#dwp-main-content h1',
      '[data-testid="meeting-admin-mobile-signal"]',
      '[data-testid="meeting-admin-service-readiness"]',
      'section[aria-labelledby="meeting-exceptions-title"]',
      '[data-testid="meeting-admin-telemetry-inspector"]',
    ],
    '[data-testid="meeting-admin-telemetry-inspector"]'
  ),
  'U14-D': fullDocumentEvidence(
    2690,
    'bbe81840766dd8cfd9dfabfc865e53b63a5f2b29bc70dc117e16cc0f80ffb1a3',
    [
      '#dwp-main-content h1',
      '[data-dwp-page-canvas="workspace"] details[role="region"]:first-of-type',
      '[data-dwp-page-canvas="workspace"] details[role="region"]:last-of-type',
    ],
    '[data-dwp-page-canvas="workspace"] details[role="region"]:last-of-type'
  ),
  'U14-M': fullDocumentEvidence(
    1852,
    'f480c2d2f8abdce460899d57b4d46e97c019bc443ac8f7364f388d472b69e761',
    [
      '#dwp-main-content h1',
      '#dwp-main-content details[role="region"]',
      '#dwp-main-content aside',
      '#dwp-main-content details[aria-label="정책 제한 및 사용할 수 없는 제어"]',
    ],
    '#dwp-main-content details[aria-label="정책 제한 및 사용할 수 없는 제어"]'
  ),
  'U15-D': fullDocumentEvidence(
    2423,
    'b98b96fc650b79dc44def63815faf6f233e5fe6e04581c78196b981e2614c42a',
    [
      '#dwp-main-content h1',
      'section[aria-labelledby$="-readiness"]',
      'section[aria-labelledby$="-pipeline"]',
      '[data-testid="meeting-admin-governance-workbench"]',
    ],
    'section[aria-labelledby$="-lifecycle"]'
  ),
  'U15-M': fullDocumentEvidence(
    2233,
    'c9dce157868c88b8fca3ae638a1f7dfaa4b321175ba66ab3e001c8386ccd0b77',
    [
      '#dwp-main-content h1',
      'section[aria-labelledby$="-readiness"]',
      'section[aria-labelledby$="-pipeline"]',
      '[data-testid="meeting-admin-governance-workbench"]',
      '[data-testid="meeting-intelligence-mobile-details"]',
    ],
    '[data-testid="meeting-intelligence-mobile-details"]'
  ),
} as const satisfies Record<MeetingApprovedFrameId, ImplementationCaptureEvidence>;
