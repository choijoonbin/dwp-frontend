import {
  fullDocumentEvidence,
  immersiveEvidence,
} from './meeting-approved-frame-evidence-builders';

import type { ImplementationCaptureEvidence } from './meeting-approved-frame-evidence-builders';
import type { MeetingApprovedFrameId } from './meeting-approved-frame-contract';

// Reviewed implementation snapshots only. Immutable Stitch ZIP/screen/code provenance is separate.
export const implementationCaptureEvidence = {
  'U01-D': fullDocumentEvidence(
    1279,
    '709c637c670742610294e25a64af9ae78ac84eeafaf07cc2951526c262a7bf71',
    [
      '[data-testid="meeting-home-context"]',
      '[data-testid="meeting-command-primary"]',
      '[data-testid="meeting-day-lists"]',
      '[data-testid="meeting-home-continuation"]',
    ],
    '[data-testid="meeting-home-continuation"]'
  ),
  'U01-M': fullDocumentEvidence(
    2165,
    '27d3feee45ffa131e54a91d4e65612df76e0145ce50013d29d9a1c65478d36fa',
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
    'bff8c879608d21e1ff114c628cdb08180a641759f29c08f430bc7b587c062f48',
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
    1532,
    '77f1a22418427c596a4d7e60944e5a2f059760b655b98c99db60df4fa199d4dc',
    ['#preparation-title', '#preparation-agenda'],
    '[data-testid="meeting-preparation"]'
  ),
  'U04-M': fullDocumentEvidence(
    2342,
    'be31033a26d2aba8c4f993a0c85d0f65e0434820382cbb9827981a1141c79b30',
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
    2737,
    'd3f26af497f89cb955f60a2032d123dbfbc213b757810a917b08fa07e26fb4af',
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
    'be2a38be4e4dd2f1593dd4a5168d0ba9dc5141ec4f8dac34fc0c58f4717d8455',
    ['#dwp-main-content h1', '[data-testid="meeting-library-workspace"]'],
    '[data-testid="meeting-library-workspace"]'
  ),
  'U07-M': fullDocumentEvidence(
    1337,
    'b9b3248a380efe062cfd7fd643e596bfaafc916a84c128cae0cbbb2fe1d5a30c',
    ['#dwp-main-content h1', '[data-testid="meeting-library-workspace"]'],
    '[data-testid="meeting-library-workspace"]',
    true
  ),
  'U08-D': fullDocumentEvidence(
    2329,
    '4cd7d96b774db1fec81ee5a35fec2306435274151ebdb3fd296e84d35a86cdd2',
    ['#meeting-recap-title', '[data-testid="meeting-recap-overview"]'],
    '[data-testid="meeting-recap-overview"]'
  ),
  'U08-M': fullDocumentEvidence(
    2128,
    '1d8ae135da75d7069ee244bafecb0d2dfb21504b669b9082761f2666d2eca9e5',
    [
      '#meeting-recap-title',
      '[data-testid="meeting-recap-overview"]',
      '[data-testid="meeting-recap-evidence-rail"]',
      '[data-testid="meeting-recap-analysis-disclosure"]',
    ],
    '[data-testid="meeting-recap-overview"]',
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
    1268,
    'd61f1fd423a268dcbd7cade9d5cf445f0a401bbfcffd3afbd82190296b491f64',
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
    2715,
    '8397124bc5998b692ed43260415584eec80e5e0d0828e3a6c936af18b4ccfd10',
    [
      '[data-testid="meeting-preferences-workspace"] h1',
      '#meeting-preferences-join',
      '#meeting-preferences-advanced',
    ],
    '[data-testid="meeting-preferences-workspace"]'
  ),
  'U12-M': {
    ...fullDocumentEvidence(
      2901,
      '7279c46e443f2ad69fb2cdbc5f5ebfd4488962f1dfa68d58157c333923b20640',
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
    2626,
    'd5e4eea7a6bb31765900f0ea4006a0335046b7876aefe8937ff06fbe25e02cfe',
    [
      '#dwp-main-content h1',
      '[data-dwp-page-canvas="workspace"] details[role="region"]:first-of-type',
      '[data-dwp-page-canvas="workspace"] details[role="region"]:last-of-type',
    ],
    '[data-dwp-page-canvas="workspace"] details[role="region"]:last-of-type'
  ),
  'U14-M': fullDocumentEvidence(
    1788,
    '08034098d51bc5c4eeb932e04478562b5c62b4034842ccfbb67b26722d5e521f',
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
