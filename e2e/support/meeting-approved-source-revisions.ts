/** A new source revision never rewrites the September 4 archive or implementation goldens. */
export const MEETING_STITCH_SOURCE_OVERRIDES = {
  'U14-M': {
    revision: '2026-09-07-policy-mobile-selected-section',
    stitchProjectUrl: 'https://stitch.withgoogle.com/projects/13391261371843159731',
    stitchNodeId: '7baadb2159e3411db77faaadb0dc52f5',
    archive: {
      fileName: 'stitch_enterprise_grid_calendar_application (15).zip',
      sha256: '39425824a002e9c551df53975828723c0d91b120c9fb3c231df1812a78f351bb',
      capturedAt: '2026-09-07',
    },
    archiveEnvironmentVariable: 'MEETING_STITCH_U14_M_EXPORT_PATH',
    downloadedArchivePath:
      '/Users/a10697/Downloads/stitch_enterprise_grid_calendar_application (15).zip',
    extractedDirectory: '/tmp/meeting-latest-policy.IgHgMe',
    screenEntry: 'screen.png',
    codeEntry: 'code.html',
    approvedViewport: { width: 390, height: 942 },
    sourceArtifact: {
      exportDirectory: '.',
      screenSha256: '52afa62d0ac12f37fb50ee9e7ffcb1577251e79333bbbc3288f420efd92f744e',
      codeSha256: 'cc8fd54553f03ff22d05f7cf70b685553b4d7837345b90c80a3c58f280344ff0',
      raster: { width: 390, height: 942 },
    },
    supersedes: {
      archiveSha256: '0a2fc4d7881a01f9b3ba0e6f164f3b9f980f8aa8afc53c29ea53afecb5d22787',
      screenSha256: '9cdc6f6ef1e11a569315ca9dff95fa66249b90ffeb8294270854673dedaa3f24',
      codeSha256: '0f9d07e86190a7f67d029daecd826f4d0fe82e5e4fa6924cff0f16e4bc045092',
      raster: { width: 498, height: 1600 },
    },
    layout: {
      sectionSelectors: ['01', '02', '03', '04'],
      initiallyExpanded: ['01'],
      initiallyCollapsed: ['02', '03', '04'],
    },
  },
} as const;
