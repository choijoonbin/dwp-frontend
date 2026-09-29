export type HrisCatalogLocale = 'ko' | 'en';
export type HrisModule = 'SYS' | 'HRM' | 'TIM' | 'PAY' | 'PER';
export type HrisPersona = 'EMPLOYEE' | 'MANAGER' | 'OPERATOR' | 'SETTINGS_ADMIN' | 'AUDITOR';
export type HrisLifecycle = 'PILOT' | 'PLANNED' | 'BLOCKED_EVIDENCE' | 'EXTERNAL';
export type HrisAvailability =
  'CURRENT_RUNTIME' | 'LEGACY_PARTIAL' | 'ROADMAP' | 'DWP_CONTROL_PLANE';
export type HrisExternalTarget =
  | 'DWP_EXPERIENCE'
  | 'DWP_IDENTITY'
  | 'DWP_PLATFORM'
  | 'DWP_INTEGRATIONS'
  | 'DWP_GOVERNANCE'
  | 'DWP_EXTENSIBILITY';
export type HrisWorkSurface = 'HOME' | 'MY_HR' | 'TEAM' | 'OPERATIONS' | 'SETTINGS';
export type HrisInventoryGroup =
  | 'MY_HR'
  | 'TEAM'
  | 'HR_OPERATIONS'
  | 'TIME'
  | 'PAYROLL'
  | 'PERFORMANCE'
  | 'SETTINGS'
  | 'DWP_CONTROL';

export type HrisLocalizedText = Readonly<Record<HrisCatalogLocale, string>>;

export type HrisCatalogNode = Readonly<{
  id: string;
  inventoryGroup: HrisInventoryGroup;
  surface: HrisWorkSurface;
  module: HrisModule;
  personas: readonly HrisPersona[];
  lifecycle: HrisLifecycle;
  availability: HrisAvailability;
  authorization: 'RUNTIME_POLICY_REQUIRED' | 'NOT_EVALUATED' | 'CENTRAL_POLICY';
  label: HrisLocalizedText;
  capability: HrisLocalizedText;
  coverageNote?: HrisLocalizedText;
  legacyPaths: readonly string[];
  externalTarget?: HrisExternalTarget;
  href?: string;
}>;

type NodeInput = Omit<HrisCatalogNode, 'availability' | 'authorization' | 'legacyPaths'> &
  Partial<Pick<HrisCatalogNode, 'availability' | 'authorization' | 'legacyPaths'>>;

export function hrisCatalogNode(input: NodeInput): HrisCatalogNode {
  const availability =
    input.availability ??
    (input.lifecycle === 'PILOT'
      ? 'CURRENT_RUNTIME'
      : input.lifecycle === 'EXTERNAL'
        ? 'DWP_CONTROL_PLANE'
        : 'ROADMAP');
  const authorization =
    input.authorization ??
    (input.lifecycle === 'PILOT'
      ? 'RUNTIME_POLICY_REQUIRED'
      : input.lifecycle === 'EXTERNAL'
        ? 'CENTRAL_POLICY'
        : 'NOT_EVALUATED');
  return Object.freeze({
    ...input,
    availability,
    authorization,
    legacyPaths: Object.freeze([...(input.legacyPaths ?? [])]),
  });
}

export const HRIS_EMPLOYEE_PERSONAS = ['EMPLOYEE'] as const;
export const HRIS_MANAGER_PERSONAS = ['MANAGER'] as const;
export const HRIS_OPERATOR_PERSONAS = ['OPERATOR'] as const;
export const HRIS_SETTINGS_PERSONAS = ['SETTINGS_ADMIN'] as const;

export const HRIS_INVENTORY_GROUP_ORDER: readonly HrisInventoryGroup[] = [
  'MY_HR',
  'TEAM',
  'HR_OPERATIONS',
  'TIME',
  'PAYROLL',
  'PERFORMANCE',
  'SETTINGS',
  'DWP_CONTROL',
];

export const HRIS_INVENTORY_GROUP_LABELS: Readonly<Record<HrisInventoryGroup, HrisLocalizedText>> =
  {
    MY_HR: { ko: '내 HR', en: 'My HR' },
    TEAM: { ko: '팀', en: 'Team' },
    HR_OPERATIONS: { ko: '인사·조직 운영', en: 'People & organization operations' },
    TIME: { ko: '근태·휴가 운영', en: 'Time & leave operations' },
    PAYROLL: { ko: '급여·법정 운영', en: 'Payroll & statutory operations' },
    PERFORMANCE: { ko: '성과 운영', en: 'Performance operations' },
    SETTINGS: { ko: 'HRIS 설정', en: 'HRIS settings' },
    DWP_CONTROL: { ko: 'DWP 관리자·감사 연결', en: 'DWP administration & audit' },
  };

export function plannedHrisCatalogNode(
  id: string,
  inventoryGroup: HrisInventoryGroup,
  surface: HrisWorkSurface,
  module: HrisModule,
  personas: readonly HrisPersona[],
  ko: string,
  en: string,
  capabilityKo: string,
  capabilityEn: string,
  legacyPaths: readonly string[] = []
): HrisCatalogNode {
  return hrisCatalogNode({
    id,
    inventoryGroup,
    surface,
    module,
    personas,
    lifecycle: 'PLANNED',
    ...(legacyPaths.length
      ? {
          availability: 'LEGACY_PARTIAL' as const,
          authorization: 'RUNTIME_POLICY_REQUIRED' as const,
          legacyPaths,
          coverageNote: {
            ko: '기존 DWP 화면에서 일부 기능을 제공 중이며, 목표 메뉴로 통합·고도화할 예정입니다.',
            en: 'Some capability remains available in existing DWP screens and will be consolidated and upgraded into this target menu.',
          },
        }
      : {}),
    label: { ko, en },
    capability: { ko: capabilityKo, en: capabilityEn },
  });
}
