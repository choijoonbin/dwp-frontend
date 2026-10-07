export const HRIS_RETAINED_OUTSIDE_TARGET = Object.freeze([
  {
    path: '/hr/benefits',
    sourceModule: 'BENSK',
    label: { ko: '내 복리후생', en: 'My benefits' },
    reason: {
      ko: 'BENSK 제외 범위이므로 기존 DWP 기능을 유지하되 76개 HRIS 목표 메뉴에는 포함하지 않습니다.',
      en: 'BENSK is out of scope, so the existing DWP function remains without being folded into the 76-menu HRIS target.',
    },
  },
  {
    path: '/hr/operations/benefits',
    sourceModule: 'BENSK',
    label: { ko: '복리후생 운영', en: 'Benefits operations' },
    reason: {
      ko: 'BENSK 제외 범위이므로 기존 DWP 기능을 유지하되 76개 HRIS 목표 메뉴에는 포함하지 않습니다.',
      en: 'BENSK is out of scope, so the existing DWP function remains without being folded into the 76-menu HRIS target.',
    },
  },
] as const);
