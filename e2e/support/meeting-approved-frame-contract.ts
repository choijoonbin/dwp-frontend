import {
  fullDocumentEvidence,
  immersiveEvidence,
} from './meeting-approved-frame-evidence-builders';

import type { ImplementationCaptureEvidence } from './meeting-approved-frame-evidence-builders';

export type MeetingApprovedFrameMode = 'desktop' | 'mobile';
export type MeetingApprovedFrameScreen =
  | 'U01'
  | 'U02'
  | 'U03'
  | 'U04'
  | 'U05'
  | 'U06'
  | 'U07'
  | 'U08'
  | 'U09'
  | 'U10'
  | 'U11'
  | 'U12'
  | 'U13'
  | 'U14'
  | 'U15';
export type MeetingApprovedFrameId = `${MeetingApprovedFrameScreen}-${'D' | 'M'}`;
export type MeetingApprovedFrameCaptureClass = 'FULL_DOCUMENT' | 'IMMERSIVE_VIEWPORT';

export type MeetingApprovedFrameClearance = {
  horizontalOverflowTolerancePx: number;
  lastContentSelector: string;
  maxTrailingGapPx: number;
  fixedOverlaySelector?: string;
  fixedOverlayContentSelector?: string;
};

export type MeetingApprovedFrame = {
  id: MeetingApprovedFrameId;
  screen: MeetingApprovedFrameScreen;
  mode: MeetingApprovedFrameMode;
  stitchNodeId: string;
  approvedViewport: { width: 1440 | 390; height: number };
  route: string;
  state: string;
  sourceFiles: readonly string[];
  sourceTokens: readonly string[];
  proofSpec: string;
  proofTokens: readonly string[];
  sourceArtifact: MeetingApprovedFrameSourceArtifact;
  implementationGolden: MeetingApprovedFrameImplementationGolden;
};

export type MeetingApprovedFrameImplementationGolden = {
  /** Exact repository-relative baseline. Approved Stitch provenance lives separately. */
  path: `e2e/${string}.png`;
  expectedRasterWidth: 1440 | 390;
  expectedRasterHeight: number;
  ownerSpec: `e2e/${string}.spec.ts`;
  screenshotName: `${string}.png`;
  expectedProject: 'chromium' | 'mobile';
  captureClass: MeetingApprovedFrameCaptureClass;
  orderedLandmarks: readonly string[];
  clearance: MeetingApprovedFrameClearance;
  sha256: string;
};

export type MeetingApprovedFrameSourceArtifact = {
  exportDirectory: string;
  screenSha256: string;
  codeSha256: string;
  raster: { width: number; height: number };
};

export const MEETING_STITCH_EXPORT = {
  fileName: 'stitch_enterprise_grid_calendar_application (10).zip',
  sha256: '0a2fc4d7881a01f9b3ba0e6f164f3b9f980f8aa8afc53c29ea53afecb5d22787',
  capturedAt: '2026-09-04',
} as const;

type ScreenContract = Omit<
  MeetingApprovedFrame,
  'id' | 'mode' | 'stitchNodeId' | 'approvedViewport' | 'sourceArtifact' | 'implementationGolden'
> & {
  desktop: {
    nodeId: string;
    height: number;
    golden: Pick<
      MeetingApprovedFrameImplementationGolden,
      'path' | 'ownerSpec' | 'screenshotName' | 'expectedProject'
    >;
  };
  mobile: {
    nodeId: string;
    height: number;
    golden: Pick<
      MeetingApprovedFrameImplementationGolden,
      'path' | 'ownerSpec' | 'screenshotName' | 'expectedProject'
    >;
  };
};

const REGRESSION_OWNER = 'e2e/video-meeting-approved-frame-regression.spec.ts' as const;
const REGRESSION_SNAPSHOT_ROOT =
  'e2e/video-meeting-approved-frame-regression.spec.ts-snapshots' as const;

function regressionGolden(screen: MeetingApprovedFrameScreen, mode: MeetingApprovedFrameMode) {
  const suffix = mode === 'desktop' ? 'chromium' : 'mobile';
  const slug = screen.toLowerCase();
  return {
    path: `${REGRESSION_SNAPSHOT_ROOT}/meeting-approved-${slug}-ko-light-${suffix}-darwin.png`,
    ownerSpec: REGRESSION_OWNER,
    screenshotName: `meeting-approved-${slug}-ko-light.png`,
    expectedProject: suffix,
  } as const;
}

const sourceArtifacts = {
  'U01-D': [
    'dwp_meetings_today_next_action_1440px_polished',
    '8579fb405ff3543eab9584af7a03ed99d50fe225b78827d98c122e9f6c427d5d',
    'bbc35c60ff3d567a02082c69240c443f2a99fed8d54f25fb59a859d0678d71cb',
    1504,
    1600,
  ],
  'U01-M': [
    'dwp_meetings_mobile_home_390px_polished',
    '6142c0d9b45c38d0a21822370a02232623e06c4b4ce24dc9d95094cec3b880e7',
    '24af31b8d32cc763c8677053374afb36e918738bb59ad268c6887c43bffc8a34',
    346,
    1600,
  ],
  'U02-D': [
    'dwp_meetings_my_meetings_02._1440px',
    '037178b6e077c9878b13a24ce40042a3959beffc0c62866f48017091cd25c905',
    'edb92519f349e295b10b4830be2b38f16e04364d624f106c805612652ed00502',
    1263,
    1600,
  ],
  'U02-M': [
    'dwp_meetings_my_meetings_02._390px_restored',
    'e127ac6a683f42616f2f23079f2ac43e892121c9ccb9c379c979295c3a2817ba',
    'cbf5b8daaa981a7863d1fcd691b2f769372bb1c8323f153a783a01fe960fc32b',
    451,
    1600,
  ],
  'U03-D': [
    'dwp_meetings_schedule_edit_03._1440px',
    '970d5779f44e44e39bf6b8226fe0b078519ed503134491eb1ce32a28039403f7',
    '00965a7ccecd06eface6b822e3c60b764ce48cc0a03d820363b90794a80abde0',
    1069,
    1600,
  ],
  'U03-M': [
    'dwp_meetings_schedule_edit_03._390px_polished',
    '7a6461834de485f7fbcccfeabb90051cc470035f05bdf786177c0da3c3a2102a',
    'c35c2d53c280bc1865eb1f47d37c9df5735ca71e9002d58f3052a9a28413db3e',
    591,
    1600,
  ],
  'U04-D': [
    'dwp_meetings_meeting_preparation_04._1440px',
    'c676f654020b29b44941dad5cdc01b721241b23c2d019917d66c955db64b9976',
    '4d8913499ee14e6f66f14ba04b636f00c85b6f0fea316f6138c222eee0349bad',
    1299,
    1600,
  ],
  'U04-M': [
    'dwp_meetings_meeting_preparation_04._390px',
    'ebfd5fef5d073db1e778f93391ef905408c0397459536b02b0af56e3d380071c',
    '8a7e1cbd9f304a463a15159bc6cdd85f7387e7c10c68dfdc555eaf0fd44875eb',
    407,
    1600,
  ],
  'U05-D': [
    'dwp_meetings_device_check_lobby_05._1440px',
    '8999e7ff82ba29d66f2d77849f7f04e3032ac8c561508ae30b2625055b4ec4ca',
    '988920aabaab12c28f58861165ab60e24f7d03a3917a7e353c32f36a7c0ba1c8',
    1496,
    1600,
  ],
  'U05-M': [
    'dwp_meetings_device_check_lobby_05._390px_restored',
    '5c5efa971f8030ef567a8a7e82ca779ec0fb718af1e6906e161cf50ecb45efb5',
    '767c344806d2adf1312a00f5b056abaabdcff2a8425a52d32f111606c49952dc',
    496,
    1600,
  ],
  'U06-D': [
    'dwp_meetings_live_room_stage_tools_06._1440px',
    '4889b20351fd38b469361d327d5ce134ae362a3d772f24f7b8518811ce00f896',
    'e39cc8fe45edb214f89c0260476575fec875d7312e352b4b27bf61dc9ead83a6',
    1600,
    1299,
  ],
  'U06-M': [
    'dwp_meetings_live_room_stage_tools_06._390px_restored',
    '61314915bd5047c1f6fe5e5fe523e213a0370640140ae69fb1d977ff9f253fcb',
    '9d9cf53cfdb6d15d41b12fbc9ce25a7b11e3f859d4ea8d5768b5bca08a60dd93',
    706,
    1600,
  ],
  'U07-D': [
    'dwp_meetings_records_library_07._1440px',
    '88b6abc236c5d464b4abf2efe383cc605bc12bf6299faa549d9bc13ae1877a60',
    'ff09147410dd7bdbe25486d8e2ee1b8cb2ecdd4edd0c6cbede562c5e5d3f9ff1',
    1600,
    1348,
  ],
  'U07-M': [
    'dwp_meetings_records_library_07._390px_restored',
    '29941fa08ebff0948d877f1a1ca9dede831443a0149dd6d51a1d5005e7caf775',
    '3a18e2a6908e82578be153e62a03fd8b5f537aad9ec80efb7d64a3393a6ab257',
    706,
    1600,
  ],
  'U08-D': [
    'dwp_meetings_ai_recap_review_08._ai_1440px',
    'f2b8156e20111a211ccc876e02669ab56492cc35a48407dddd434ca9414a9c5b',
    'afed60619be0a17f8e144ff1a4c849f8f5dac463376b50a55cba2947512eeb51',
    1164,
    1600,
  ],
  'U08-M': [
    'dwp_meetings_ai_recap_review_08._ai_390px_restored',
    'e5bf93d863b7ac6553935999578e70d1a100cec91ca3e39492672b80a7aad5ff',
    '3433e9c83289c6534e8da24f320ca8b0f0cb49890d104440c36c615bcda1eba1',
    456,
    1600,
  ],
  'U09-D': [
    'dwp_meetings_follow_ups_workbench_09._1440px',
    'a9966513c370a1fed8d05abf9effc4604e18d5237174d1412f6abb603fc978cb',
    '94defbf695188f7b6e684be829439f5eab199cd20cde01d1c07a7fb24a6f5b9d',
    1600,
    1565,
  ],
  'U09-M': [
    'dwp_meetings_follow_ups_workbench_09._390px_restored',
    'c6c986c05850f70cd702900f0467325db4e9dc0dc963a29e8f4ae69121542b90',
    'da8aacfa1e8dcb136d3c40a746cb4d9c235395f0fbaeaa273acd585361576b2e',
    479,
    1600,
  ],
  'U10-D': [
    'dwp_meetings_meeting_templates_10._1440px',
    '1333f7720110832b554887546190d3cf14f3bdaf42a30ce785ade57ce7cd51a6',
    '7abab5ebb1f8e96a8fe50fc47bfc3e6150bb154b5b0e9ceda9628d02540374af',
    1600,
    1465,
  ],
  'U10-M': [
    'dwp_meetings_meeting_templates_10._390px_restored',
    'b27d798d9833fcf4f2cf8801a0b269944490f49ec64d09fcf82980571175f6dc',
    '47c2f0ac0e00fdeaf2592e6e0c9b2351373be7cf8a836f9124252bd939fc5336',
    528,
    1600,
  ],
  'U11-D': [
    'dwp_meetings_personal_room_11._1440px',
    '5788774fc539b6542b3fd24480d7abceb6526dd280ba208e435c45b269be891f',
    '4141280a47544f26086b130a8ebea62843547686ec4e85243482f57723123a14',
    1528,
    1600,
  ],
  'U11-M': [
    'dwp_meetings_personal_room_11._390px_restored',
    'b3463f1e8f6eb18e220371f4cf2bde083451ac2f06c1376d792ceebcb0e2a206',
    '0d5a1201aa8ddf0a146f8dfde2ac09ced4506a045fb2caa1b20c90e63a242ed4',
    531,
    1600,
  ],
  'U12-D': [
    'dwp_meetings_device_preferences_12._1440px',
    '75bc068c2a1ef98e0e8f5f36ad1bf369f632131203de5f68b31190a21c708742',
    '8e6f4b98cbdef121dd0aceb23245c6b9fe94566b9fcd54b3a5b42f62671ae62f',
    769,
    1600,
  ],
  'U12-M': [
    'dwp_meetings_device_preferences_12._390px_restored',
    'cff9349d25470b56f9be13fb734b5cd19190eaa19d43bfc011f6e03afaab7ad2',
    '84cb742fb5cdc5ed26eebe8f283ee32d0f47eb7c130756800371497c84e4cfae',
    321,
    1600,
  ],
  'U13-D': [
    'dwp_meetings_operations_command_center_13._1440px',
    '8238de08a177f662a94858bc0808050a43db97e60380762a5bda397a5945882b',
    '1ddaff77794573bc2805f535b4dd4a93170312380d35e6c185e4cf68f9ea0c8a',
    1600,
    1450,
  ],
  'U13-M': [
    'dwp_meetings_operations_mobile_13._390px',
    '27bb39bc070ec9cbcc4be876056770ba98a010fe117e94084d4ca73669ccee28',
    'fc7dd640a06c89c34a1f137f773a0babba79c9e63ef932960155f9eef9337b54',
    602,
    1600,
  ],
  'U14-D': [
    'dwp_meetings_policy_control_hub_14._1440px',
    '477b5ed6cbf3bf0078faf325f513817c0b97bfa77dbaef9a4adbd859bad1d414',
    'f9c213b00666f71704d7a5ab65f969f11e65c75e27ddd21ce62ffd8da0ac6a34',
    1215,
    1600,
  ],
  'U14-M': [
    'dwp_meetings_policy_mobile_14._390px',
    '9cdc6f6ef1e11a569315ca9dff95fa66249b90ffeb8294270854673dedaa3f24',
    '0f9d07e86190a7f67d029daecd826f4d0fe82e5e4fa6924cff0f16e4bc045092',
    498,
    1600,
  ],
  'U15-D': [
    'dwp_meetings_ai_data_governance_hub_15._ai_1440px',
    '574f8da6b011b0242e86ef75ef5cf3d0799cb7ebc143edb9c20d980fba39b1a0',
    '33221ccf44dcebdf97f29c070bf12c203991dc308bef404679de5c1bbf8c7b64',
    1256,
    1600,
  ],
  'U15-M': [
    'dwp_meetings_ai_data_governance_mobile_15._ai_390px',
    '440a5130095c6596fa97906ae1adc8d80e905db3ea60f3ee5e498e695cd456ba',
    '1b2d6c99b008257b60f8b56b71035a0e865bfa47f807754c26ab9567459a9661',
    528,
    1600,
  ],
} as const satisfies Record<string, readonly [string, string, string, number, number]>;

function sourceArtifact(id: keyof typeof sourceArtifacts): MeetingApprovedFrameSourceArtifact {
  const [exportDirectory, screenSha256, codeSha256, width, height] = sourceArtifacts[id];
  return { exportDirectory, screenSha256, codeSha256, raster: { width, height } };
}

const implementationCaptureEvidence = {
  'U01-D': fullDocumentEvidence(
    1380,
    '092122759028b5350b5be4ae8d137032ff7e60ca0e0ac614deabb0b71ce49947',
    [
      '[data-testid="meeting-home-context"]',
      '[data-testid="meeting-command-primary"]',
      '[data-testid="meeting-day-lists"]',
      '[data-testid="meeting-home-continuation"]',
    ],
    '[data-testid="meeting-home-continuation"]'
  ),
  'U01-M': fullDocumentEvidence(
    2522,
    '73c642eea704aa0a0812af263699135d5c3438b3093a07005dcb4dc8b788a0bc',
    [
      '#dwp-main-content h1',
      '[data-testid="meeting-day-lists"]',
      '[data-testid="meeting-home-continuation"]',
    ],
    '[data-testid="meeting-home-continuation"]',
    true
  ),
  'U02-D': fullDocumentEvidence(
    1166,
    '8acb97f44ce512a134803cd2745a947a78282dc3c10f44733bf6600cffe4d4eb',
    ['#dwp-main-content h1', '[data-testid="my-meetings-workspace"]'],
    '[data-testid="my-meetings-workspace"]'
  ),
  'U02-M': fullDocumentEvidence(
    1579,
    'b933b568ca738a57147477b18a91c6d6925324332a913da53ca2b663b54b7326',
    ['#dwp-main-content h1', '[data-testid="my-meetings-workspace"]'],
    '[data-testid="my-meetings-workspace"]',
    true
  ),
  'U03-D': fullDocumentEvidence(
    2376,
    '7ac9514d2d9dccfb4c61106a667ee54e3b634d01989410c14b49774e04523434',
    [
      '[data-testid="meeting-schedule-workspace"] h1',
      '[data-testid="meeting-schedule-workspace"] aside',
    ],
    '[data-testid="meeting-schedule-workspace"]'
  ),
  'U03-M': fullDocumentEvidence(
    1442,
    '38f6e5c9f548d5c9c13795599d55b066014de89c9d6355269c701868d0eb9005',
    [
      '[data-testid="meeting-schedule-workspace"] h1',
      '[data-testid="meeting-schedule-workspace"] nav',
    ],
    '[data-testid="meeting-schedule-workspace"]'
  ),
  'U04-D': fullDocumentEvidence(
    1372,
    '33e8735750b9f27e73dabc16d61d8abf547afb38b7f873d231ab146a14276bb9',
    ['#preparation-title', '#preparation-agenda'],
    '[data-testid="meeting-preparation"]'
  ),
  'U04-M': fullDocumentEvidence(
    2367,
    '79dcc9b27f63f54a1e0af1eafb47e4a00be751cbb3c6834aee07b8ea174032b2',
    ['#preparation-title', '#preparation-agenda'],
    '[data-testid="meeting-preparation"]'
  ),
  'U05-D': fullDocumentEvidence(
    1164,
    '25bc248af89035616747781e5e19b9c6f6a002e7ad51ac4ec5c4b4d67ede3e2e',
    ['[data-testid="meeting-prejoin-context"]', '.dwp-meeting-prejoin'],
    '.dwp-meeting-prejoin'
  ),
  'U05-M': fullDocumentEvidence(
    1590,
    '7013325780346b3aefda2a5488e56ce752c42417d38721df60c6dbe420079a05',
    [
      '#dwp-main-content h1',
      '[data-testid="meeting-prejoin-context"]',
      '.dwp-meeting-prejoin__stage',
      '.dwp-meeting-prejoin__rail',
    ],
    '.dwp-meeting-prejoin'
  ),
  'U06-D': immersiveEvidence(
    960,
    '1428935296cfda6fcdaf91c382c882bb7415377de95ac30b8cac6941b7df29c1',
    ['.dwp-video-meeting-room__header', '.dwp-video-meeting-room__interactions']
  ),
  'U06-M': immersiveEvidence(
    844,
    'b45154a2ce97d1ef3aec59b902e69425e6de29fae91b15a091b6e54b8f4042e3',
    ['.dwp-video-meeting-room__header', '.dwp-video-meeting-room__interactions']
  ),
  'U07-D': fullDocumentEvidence(
    1199,
    '1693f678f0f20304a90d884e82752ce70257ffa738cdb90187c1ba9302be051b',
    ['#dwp-main-content h1', '[data-testid="meeting-library-workspace"]'],
    '[data-testid="meeting-library-workspace"]'
  ),
  'U07-M': fullDocumentEvidence(
    1171,
    'e5265cb92102038eac824a90c3ecbad76a2d80f55595e1cb6758fd46cc48782b',
    ['#dwp-main-content h1', '[data-testid="meeting-library-workspace"]'],
    '[data-testid="meeting-library-workspace"]',
    true
  ),
  'U08-D': fullDocumentEvidence(
    1400,
    'ffdc46dc9f5aedba230fc1592817bd5456003fd8cd0b92e737cadafda338e2c0',
    ['#meeting-recap-title', '[data-testid="meeting-recap-overview"]'],
    '[data-testid="meeting-recap-overview"]'
  ),
  'U08-M': fullDocumentEvidence(
    2076,
    '5686b803fbea9f7497709271d6954a6a95e3c23e921a62811f40ec228235985f',
    [
      '#meeting-recap-title',
      '[data-testid="meeting-recap-overview"]',
      '[data-testid="meeting-recap-evidence-rail"]',
      '[data-testid="meeting-recap-analysis"]',
    ],
    '[data-testid="meeting-recap-overview"]',
    true
  ),
  'U09-D': fullDocumentEvidence(
    960,
    'ac6baad3cd1cf99c9151781dd2823c47505a273623dba3717da803c147f17c3d',
    ['#dwp-main-content h1', '[data-testid="meeting-follow-ups"]'],
    '[data-testid="meeting-follow-ups"]'
  ),
  'U09-M': fullDocumentEvidence(
    933,
    '06c53cf58061661c3703d66e625b9cf41f3d25a8bada686fe84eab441d9a0619',
    [
      '#dwp-main-content h1',
      '[data-testid="meeting-follow-ups"]',
      '[data-testid^="follow-up-row-"]',
    ],
    '[data-testid="meeting-follow-ups"]',
    true
  ),
  'U10-D': fullDocumentEvidence(
    980,
    '78c87a9e3e82838ec82b9c06a3723c433fafbc6351631ccdab2cbbbf1529ffd1',
    [
      '[data-testid="meeting-templates"] h1',
      '[data-testid="template-search-scope"]',
      '[data-testid="template-list"]',
    ],
    '[data-testid="meeting-templates"]'
  ),
  'U10-M': fullDocumentEvidence(
    902,
    'd9818f6fb990e234eb469f4da2a1c3b1519fd8afc640589a15e03a2751850a46',
    [
      '#dwp-main-content h1',
      '[data-testid="template-mobile-intro"]',
      '[data-testid="template-search-scope"]',
      '[data-testid="template-list"]',
    ],
    '[data-testid="meeting-templates"]'
  ),
  'U11-D': fullDocumentEvidence(
    1330,
    '6c686d91a5d5a7c2d244111241e045456e5ac049eb2d9ad5d71957eeab3c77f5',
    ['[data-testid="meeting-personal-room"] h1', '#personal-room-current'],
    '[data-testid="meeting-personal-room"]'
  ),
  'U11-M': fullDocumentEvidence(
    1951,
    'd6db90541a68b65165d498afbf20264ec8772ac81ba2d1a439fde2e5e1ddfc19',
    [
      '#dwp-main-content h1',
      '#personal-room-current',
      '#personal-room-policy',
      '#personal-room-history',
      '[data-testid="personal-room-supplemental-settings"]',
    ],
    '[data-testid="meeting-personal-room"]'
  ),
  'U12-D': fullDocumentEvidence(
    2165,
    '4680565b511f3057eef34faba2b0e8b93fe1f7b96b82f1c295cef2920fb3d9aa',
    [
      '[data-testid="meeting-preferences-workspace"] h1',
      '#meeting-preferences-join',
      '#meeting-preferences-advanced',
    ],
    '[data-testid="meeting-preferences-workspace"]'
  ),
  'U12-M': fullDocumentEvidence(
    2068,
    'f7ccc14a25a74f4a3031ddb29b993ab49ff35901ab042cc67d43aa1ca1c683a3',
    [
      '#dwp-main-content h1',
      '#meeting-preferences-join',
      '#meeting-preferences-advanced',
      '#dwp-main-content aside',
    ],
    '[data-testid="meeting-preferences-workspace"]',
    true
  ),
  'U13-D': fullDocumentEvidence(
    960,
    '9b2fc6bbe24dbab184e5d5c3d643e39a7d726c367ecc05bc857e47fef0be11c7',
    [
      '#dwp-main-content h1',
      '[data-testid="meeting-admin-impact-primary"]',
      'section[aria-labelledby="meeting-exceptions-title"]',
    ],
    'section[aria-labelledby="meeting-exceptions-title"]'
  ),
  'U13-M': fullDocumentEvidence(
    1843,
    '53655de4dd592c9c2d73a36048a422144aaa856f693d42fd8191acc50b1b2f18',
    [
      '#dwp-main-content h1',
      '[data-testid="meeting-admin-impact-primary"]',
      '[data-testid="meeting-admin-service-readiness"]',
      'section[aria-labelledby="meeting-exceptions-title"]',
    ],
    'section[aria-labelledby="meeting-exceptions-title"]'
  ),
  'U14-D': fullDocumentEvidence(
    1486,
    '73bf44282797d576fbba9df2d9f616ca131065b378a1479cfe611ec54911300d',
    [
      '#dwp-main-content h1',
      '[data-dwp-page-canvas="workspace"] details[role="region"]:first-of-type',
      '[data-dwp-page-canvas="workspace"] details[role="region"]:last-of-type',
    ],
    '[data-dwp-page-canvas="workspace"] details[role="region"]:last-of-type'
  ),
  'U14-M': fullDocumentEvidence(
    1147,
    'f1fcb454bbf97aadcfbe4c0def6d8b8a0f669b1959e4b21cfc07d61fa83d75c2',
    [
      '#dwp-main-content h1',
      '#dwp-main-content aside',
      '#dwp-main-content details[role="region"]',
      '#dwp-main-content section[aria-label]',
    ],
    '#dwp-main-content section[aria-label]'
  ),
  'U15-D': fullDocumentEvidence(
    2630,
    '8edbee607f8e2e487a549d492935fcee985ec9a173c3a6a784996b434539e59c',
    [
      '#dwp-main-content h1',
      'section[aria-labelledby$="-readiness"]',
      'section[aria-labelledby$="-pipeline"]',
      'section[aria-labelledby$="-lifecycle"]',
    ],
    'section[aria-labelledby$="-lifecycle"]'
  ),
  'U15-M': fullDocumentEvidence(
    2067,
    '858d239f53381c81a0ec04fa4f7835620031a382f939fe2129f9cb366edb6490',
    [
      '#dwp-main-content h1',
      'section[aria-labelledby$="-readiness"]',
      'section[aria-labelledby$="-pipeline"]',
      'section[aria-labelledby$="-lifecycle"]',
      '[data-testid="meeting-intelligence-mobile-details"]',
    ],
    '[data-testid="meeting-intelligence-mobile-details"]'
  ),
} as const satisfies Record<MeetingApprovedFrameId, ImplementationCaptureEvidence>;

const screens: readonly ScreenContract[] = [
  {
    screen: 'U01',
    desktop: {
      nodeId: '93fe31e4744949689fd0ae3058a46f01',
      height: 1362,
      golden: regressionGolden('U01', 'desktop'),
    },
    mobile: {
      nodeId: 'ce1c05d6081447bba9bf892a230a84a9',
      height: 1804,
      golden: regressionGolden('U01', 'mobile'),
    },
    route: '/meetings/home',
    state: 'HOME_TODAY_WITH_QUEUE_AND_RESULTS',
    sourceFiles: [
      'apps/dwp/src/features/meetings/meeting-home.tsx',
      'apps/dwp/src/features/meetings/meeting-mobile-navigation.tsx',
    ],
    sourceTokens: ['data-testid="meeting-day-lists"', 'data-testid="meeting-home-recent"'],
    proofSpec: 'e2e/video-meeting-visual-quality.spec.ts',
    proofTokens: [
      'home SAMPLE presents contract-backed schedule',
      'home SAMPLE preserves the approved full work hierarchy',
    ],
  },
  {
    screen: 'U02',
    desktop: {
      nodeId: '22d9267b31984b23b60c27c4fcd51dc7',
      height: 1493,
      golden: regressionGolden('U02', 'desktop'),
    },
    mobile: {
      nodeId: '1d0fca4227a946859858fb5d87940aa3',
      height: 1385,
      golden: regressionGolden('U02', 'mobile'),
    },
    route: '/meetings/mine',
    state: 'MINE_SELECTED_UPCOMING',
    sourceFiles: ['apps/dwp/src/features/meetings/my-meetings.tsx'],
    sourceTokens: ['data-testid="my-meetings-list"', 'data-testid="my-meetings-inspector"'],
    proofSpec: 'e2e/video-meeting-visual-quality.spec.ts',
    proofTokens: ['My meetings uses a bounded list', 'My meetings keeps the selected preparation'],
  },
  {
    screen: 'U03',
    desktop: {
      nodeId: 'd0965e69a9ab425cb301dcf64f8a2fc7',
      height: 1915.5,
      golden: {
        path: 'e2e/video-meeting-schedule.spec.ts-snapshots/meeting-u03-ko-light-approved-size-chromium-darwin.png',
        ownerSpec: 'e2e/video-meeting-schedule.spec.ts',
        screenshotName: 'meeting-u03-ko-light-approved-size.png',
        expectedProject: 'chromium',
      },
    },
    mobile: {
      nodeId: '8c42fc313fbc4edba6b7e1323f34cb99',
      height: 1056,
      golden: {
        path: 'e2e/video-meeting-schedule.spec.ts-snapshots/meeting-u03-ko-light-approved-size-mobile-darwin.png',
        ownerSpec: 'e2e/video-meeting-schedule.spec.ts',
        screenshotName: 'meeting-u03-ko-light-approved-size.png',
        expectedProject: 'mobile',
      },
    },
    route: '/meetings/mine?view=schedule',
    state: 'SCHEDULE_RECURRING_IMPACT_REVIEW',
    sourceFiles: ['apps/dwp/src/features/meetings/meeting-schedule-workspace.tsx'],
    sourceTokens: ['data-testid="meeting-schedule-workspace"', 'MeetingScheduleSections'],
    proofSpec: 'e2e/video-meeting-schedule.spec.ts',
    proofTokens: [
      'single scheduling connects five sections',
      'recurring scheduling requires a server impact preview',
    ],
  },
  {
    screen: 'U04',
    desktop: {
      nodeId: 'caa5173800a042e99bda626122fbc25d',
      height: 1549.38,
      golden: {
        path: 'e2e/video-meeting-preparation.spec.ts-snapshots/meeting-u04-ko-light-approved-size-chromium-darwin.png',
        ownerSpec: 'e2e/video-meeting-preparation.spec.ts',
        screenshotName: 'meeting-u04-ko-light-approved-size.png',
        expectedProject: 'chromium',
      },
    },
    mobile: {
      nodeId: '9b19f244ce574b7597c49e49c7304391',
      height: 1532.5,
      golden: {
        path: 'e2e/video-meeting-preparation.spec.ts-snapshots/meeting-u04-ko-light-approved-size-mobile-darwin.png',
        ownerSpec: 'e2e/video-meeting-preparation.spec.ts',
        screenshotName: 'meeting-u04-ko-light-approved-size.png',
        expectedProject: 'mobile',
      },
    },
    route: '/meetings/mine?view=preparation&meetingId=:meetingId',
    state: 'PREPARATION_HOST_MATERIALS_AND_RSVP',
    sourceFiles: ['apps/dwp/src/features/meetings/meeting-preparation.tsx'],
    sourceTokens: ['data-testid="meeting-preparation"', 'MeetingPreparationContent'],
    proofSpec: 'e2e/video-meeting-preparation.spec.ts',
    proofTokens: [
      'preparation RSVP uses current revision',
      'host registers a governed opaque material reference',
    ],
  },
  {
    screen: 'U05',
    desktop: {
      nodeId: 'df576160dfbf46daa4f00eaf7835e972',
      height: 1273.75,
      golden: regressionGolden('U05', 'desktop'),
    },
    mobile: {
      nodeId: 'f10d82bb54f14557a53f65b35552dd4f',
      height: 1240.62,
      golden: regressionGolden('U05', 'mobile'),
    },
    route: '/meetings/room/:meetingId',
    state: 'PREJOIN_PRIVATE_DEVICE_CHECK',
    sourceFiles: ['apps/dwp/src/features/meetings/meeting-prejoin.tsx'],
    sourceTokens: ['dwp-meeting-prejoin__stage', 'dwp-meeting-prejoin__rail'],
    proofSpec: 'e2e/video-meeting-visual-quality.spec.ts',
    proofTokens: ['prejoin keeps the private preview', 'prejoin stacks preview before policy'],
  },
  {
    screen: 'U06',
    desktop: {
      nodeId: '62228a81174b4885a2e4c40a76596a72',
      height: 1024.5,
      golden: regressionGolden('U06', 'desktop'),
    },
    mobile: {
      nodeId: 'ac47af882bfb4932860e7a761c0660e0',
      height: 884,
      golden: regressionGolden('U06', 'mobile'),
    },
    route: '/meetings/room/:meetingId',
    state: 'LIVE_HOST_COLLABORATION',
    sourceFiles: [
      'apps/dwp/src/features/meetings/live-video-meeting-room.tsx',
      'apps/dwp/src/features/meetings/meeting-collaboration-panel.tsx',
    ],
    sourceTokens: ['dwp-video-meeting-room__interactions', 'MeetingCollaborationPanel'],
    proofSpec: 'e2e/video-meeting-live-facilitation.spec.ts',
    proofTokens: ['live facilitation connects verified Q&A', 'meeting-u06-live-room-'],
  },
  {
    screen: 'U07',
    desktop: {
      nodeId: '7a44a131fac94aa688bb273a5cd8e382',
      height: 1061.5,
      golden: regressionGolden('U07', 'desktop'),
    },
    mobile: {
      nodeId: 'daef408970b64308a1c39acd8b1b0f27',
      height: 884,
      golden: regressionGolden('U07', 'mobile'),
    },
    route: '/meetings/history',
    state: 'LIBRARY_RESULT_SELECTED',
    sourceFiles: ['apps/dwp/src/features/meetings/meeting-history.tsx'],
    sourceTokens: ['data-testid="meeting-library-list"', 'data-testid="meeting-library-preview"'],
    proofSpec: 'e2e/video-meeting-visual-quality.spec.ts',
    proofTokens: [
      'Meeting library uses a 7 to 5 result',
      'Meeting library becomes a single actionable list',
    ],
  },
  {
    screen: 'U08',
    desktop: {
      nodeId: '98ac02d91bba48918bd6de2319996300',
      height: 1632,
      golden: regressionGolden('U08', 'desktop'),
    },
    mobile: {
      nodeId: 'caad2e4e4c924cf49043e2f93558da68',
      height: 1330.12,
      golden: regressionGolden('U08', 'mobile'),
    },
    route: '/meetings/history?meeting=:meetingId',
    state: 'RECAP_PUBLISHED_WITH_EVIDENCE',
    sourceFiles: ['apps/dwp/src/features/meetings/meeting-recap-detail.tsx'],
    sourceTokens: [
      'data-testid="meeting-recap-overview"',
      'data-testid="meeting-recap-evidence-rail"',
    ],
    proofSpec: 'e2e/video-meeting-visual-quality.spec.ts',
    proofTokens: [
      'published AI recap remains evidence-led',
      'published AI recap preserves the evidence rail',
    ],
  },
  {
    screen: 'U09',
    desktop: {
      nodeId: 'b31bb30cad0846069c26db89046d171c',
      height: 1251.5,
      golden: regressionGolden('U09', 'desktop'),
    },
    mobile: {
      nodeId: '9eb3bdd9cd0e451fb5720b1e45eb570f',
      height: 1255.75,
      golden: regressionGolden('U09', 'mobile'),
    },
    route: '/meetings/follow-ups',
    state: 'FOLLOW_UP_REVIEW_AND_RECEIPT',
    sourceFiles: ['apps/dwp/src/features/meetings/meeting-follow-ups.tsx'],
    sourceTokens: [
      'data-testid="meeting-follow-ups"',
      'OperationalKpiStrip',
      "data-testid={'follow-up-row-'",
    ],
    proofSpec: 'e2e/video-meeting-follow-ups.spec.ts',
    proofTokens: ['selects only one source', 'keeps 320px dark mode readable'],
  },
  {
    screen: 'U10',
    desktop: {
      nodeId: '96c3f59f78b64c148cd5804cfa65e1b5',
      height: 1099.5,
      golden: regressionGolden('U10', 'desktop'),
    },
    mobile: {
      nodeId: 'c636b178b60a42aeb012c7855c80fb8e',
      height: 1181,
      golden: regressionGolden('U10', 'mobile'),
    },
    route: '/meetings/templates',
    state: 'TEMPLATE_SELECTED_AND_REVALIDATED',
    sourceFiles: ['apps/dwp/src/features/meetings/meeting-templates.tsx'],
    sourceTokens: ['data-testid="template-list"', 'data-testid="template-preview"'],
    proofSpec: 'e2e/video-meeting-workspace-menus.spec.ts',
    proofTokens: [
      'new user menu routes render actual templates',
      'template selection revalidates current source',
    ],
  },
  {
    screen: 'U11',
    desktop: {
      nodeId: '399e8da93fda456ca6fb24ec12b65672',
      height: 1308,
      golden: regressionGolden('U11', 'desktop'),
    },
    mobile: {
      nodeId: 'e8318d5da737420ca03584e13d79566e',
      height: 1176,
      golden: regressionGolden('U11', 'mobile'),
    },
    route: '/meetings/mine?view=personal-room',
    state: 'PERSONAL_ROOM_PROVISIONED',
    sourceFiles: ['apps/dwp/src/features/meetings/meeting-personal-room.tsx'],
    sourceTokens: ['data-testid="meeting-personal-room"', 'MeetingPersonalRoomDetails'],
    proofSpec: 'e2e/video-meeting-personal-room.spec.ts',
    proofTokens: [
      'personal room provisions, renames and rotates',
      'personal room ${mode} is responsive',
    ],
  },
  {
    screen: 'U12',
    desktop: {
      nodeId: '2cc05be3c87e4614a48f5c1c5c7837d5',
      height: 2631,
      golden: regressionGolden('U12', 'desktop'),
    },
    mobile: {
      nodeId: '992974d456f9469eb5efa35ad7ce035a',
      height: 1927,
      golden: regressionGolden('U12', 'mobile'),
    },
    route: '/meetings/preferences',
    state: 'ACCOUNT_AND_DEVICE_PREFERENCES',
    sourceFiles: ['apps/dwp/src/features/meetings/meeting-preferences.tsx'],
    sourceTokens: ['data-testid="meeting-preferences-workspace"', 'MeetingDeviceSettings'],
    proofSpec: 'e2e/video-meeting-workspace-menus.spec.ts',
    proofTokens: [
      'preferences persist only account values',
      'preferences support keyboard, dark high contrast',
    ],
  },
  {
    screen: 'U13',
    desktop: {
      nodeId: '8178d81ee53f45daae9b9c3e417c2dd2',
      height: 1122,
      golden: regressionGolden('U13', 'desktop'),
    },
    mobile: {
      nodeId: '6388c55dda0f40fe9b2322684f968980',
      height: 1017,
      golden: regressionGolden('U13', 'mobile'),
    },
    route: '/meetings/admin/operations',
    state: 'OPERATIONS_EXCEPTION_SELECTED',
    sourceFiles: ['apps/dwp/src/features/meetings/meeting-admin.tsx'],
    sourceTokens: ['MeetingAdminOperations', 'operationalExceptions'],
    proofSpec: 'e2e/video-meeting-admin-surfaces.spec.ts',
    proofTokens: ['U13 presents user impact', 'expectResponsiveAndAccessible'],
  },
  {
    screen: 'U14',
    desktop: {
      nodeId: '17c30a9ce3f7464ea6d4509634f88a98',
      height: 1624,
      golden: regressionGolden('U14', 'desktop'),
    },
    mobile: {
      nodeId: '7baadb2159e3411db77faaadb0dc52f5',
      height: 1236,
      golden: regressionGolden('U14', 'mobile'),
    },
    route: '/meetings/admin/policies',
    state: 'POLICY_VERSIONED_THREE_STATE_RECORDING',
    sourceFiles: [
      'apps/dwp/src/features/meetings/meeting-admin.tsx',
      'apps/dwp/src/features/meetings/meeting-admin-model.ts',
    ],
    sourceTokens: ['MeetingAdminPolicies', 'MEETING_RECORDING_POLICIES'],
    proofSpec: 'e2e/video-meeting-admin-recording-policy.spec.ts',
    proofTokens: ['explicitly select and persist all recording policies', 'ADMIN_REQUIRED'],
  },
  {
    screen: 'U15',
    desktop: {
      nodeId: 'd3f87ba97185403ba023bdfc81035ae9',
      height: 1575,
      golden: {
        path: 'e2e/video-meeting-admin-intelligence-visual.spec.ts-snapshots/meeting-admin-intelligence-blocked-ko-1440-light-chromium-darwin.png',
        ownerSpec: 'e2e/video-meeting-admin-intelligence-visual.spec.ts',
        screenshotName: 'meeting-admin-intelligence-blocked-ko-1440-light.png',
        expectedProject: 'chromium',
      },
    },
    mobile: {
      nodeId: 'fffb987648454c19b4a1d87d3ed80b56',
      height: 1182,
      golden: {
        path: 'e2e/video-meeting-admin-intelligence-visual.spec.ts-snapshots/meeting-admin-intelligence-blocked-ko-390-light-chromium-darwin.png',
        ownerSpec: 'e2e/video-meeting-admin-intelligence-visual.spec.ts',
        screenshotName: 'meeting-admin-intelligence-blocked-ko-390-light.png',
        expectedProject: 'chromium',
      },
    },
    route: '/meetings/admin/intelligence',
    state: 'INTELLIGENCE_SEVEN_STAGE_READINESS',
    sourceFiles: ['apps/dwp/src/features/meetings/meeting-admin-intelligence.tsx'],
    sourceTokens: ['MEETING_ADMIN_INTELLIGENCE_DEPENDENCIES', 'MeetingAdminIntelligence'],
    proofSpec: 'e2e/video-meeting-admin-intelligence-visual.spec.ts',
    proofTokens: [
      'blocked AI administration makes every release dependency legible',
      'ready AI administration stays readable',
    ],
  },
];

export const MEETING_APPROVED_FRAMES: readonly MeetingApprovedFrame[] = screens.flatMap(
  ({ desktop, mobile, ...screen }) => [
    {
      ...screen,
      id: `${screen.screen}-D` as const,
      mode: 'desktop' as const,
      stitchNodeId: desktop.nodeId,
      approvedViewport: { width: 1440 as const, height: desktop.height },
      sourceArtifact: sourceArtifact(`${screen.screen}-D` as keyof typeof sourceArtifacts),
      implementationGolden: {
        ...desktop.golden,
        expectedRasterWidth: 1440 as const,
        ...implementationCaptureEvidence[`${screen.screen}-D`],
      },
    },
    {
      ...screen,
      id: `${screen.screen}-M` as const,
      mode: 'mobile' as const,
      stitchNodeId: mobile.nodeId,
      approvedViewport: { width: 390 as const, height: mobile.height },
      sourceArtifact: sourceArtifact(`${screen.screen}-M` as keyof typeof sourceArtifacts),
      implementationGolden: {
        ...mobile.golden,
        expectedRasterWidth: 390 as const,
        ...implementationCaptureEvidence[`${screen.screen}-M`],
      },
    },
  ]
);
