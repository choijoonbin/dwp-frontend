import type { TFunction } from 'i18next';

const sourceKey: Readonly<Record<string, string>> = {
  DWP_WORKSPACE: 'workspace',
  DWP_WORK: 'workspace',
  DWP_CALENDAR: 'calendar',
  DWP_ACTIVITY: 'activity',
  DWP_COMMUNICATIONS: 'communications',
  DWP_HOME_RECOMMENDATIONS: 'recommendations',
  DWP_RECOMMENDATIONS: 'recommendations',
  'Approval Service': 'approvals',
  HRIS: 'people',
  ERP: 'erp',
};

export function flowSourceLabel(source: string | null | undefined, t: TFunction): string {
  if (!source) return t('flow.sources.workspace');
  const label = source.trim();
  const key = sourceKey[label];
  if (key) return t(`flow.sources.${key}`);
  if (/^[A-Z0-9]+(?:[_-][A-Z0-9]+)+$/u.test(label) || /^[A-Z][A-Z0-9]{2,}$/u.test(label)) {
    return t('flow.sources.connectedService');
  }
  return label;
}
