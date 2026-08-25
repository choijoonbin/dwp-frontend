import type { TFunction } from 'i18next';

import type { HomeViewSource } from '@dwp-frontend/shared-utils';

const revisionSources = new Set<HomeViewSource>(['USER', 'TEMPLATE', 'AI', 'RESTORE', 'UNDO']);

const fixedSummaryKeys: Readonly<Record<string, string>> = {
  'Home view created': 'history.summaries.created',
  'Home view updated': 'history.summaries.updated',
  'Home view reset to organization defaults': 'history.summaries.reset',
  'Approved composer proposal applied': 'history.summaries.aiApplied',
  'Composer proposal undone': 'history.summaries.aiUndone',
};

const widgetLabelKeys: Readonly<Record<string, string>> = {
  activity: 'content.widgetLabels.activity',
  focus: 'content.widgetLabels.focus',
  schedule: 'content.widgetLabels.schedule',
  'daily-brief': 'content.widgetLabels.daily-brief',
};

export function homeRevisionSourceLabel(
  t: TFunction<'homeStudio'>,
  source: string | null | undefined
): string {
  const sourceKey = revisionSources.has(source as HomeViewSource) ? source : 'UNKNOWN';
  return t(`history.sources.${sourceKey}`);
}

export function homeRevisionSummaryLabel(
  t: TFunction<'homeStudio'>,
  changeSummary: string | null | undefined
): string {
  const summary = changeSummary?.trim() ?? '';
  const fixedKey = fixedSummaryKeys[summary];
  if (fixedKey) return t(fixedKey);

  const deviceMatch = /^(DESKTOP|MOBILE) device overlay updated$/u.exec(summary);
  if (deviceMatch) {
    const device = deviceMatch[1] === 'MOBILE' ? t('device.mobile') : t('device.desktop');
    return t('history.summaries.deviceUpdated', { device });
  }

  const revisionMatch = /^Revision ([1-9]\d*) restored$/u.exec(summary);
  if (revisionMatch) {
    return t('history.summaries.revisionRestored', { number: revisionMatch[1] });
  }

  if (/^Template .+ applied$/u.test(summary)) {
    return t('history.summaries.templateApplied');
  }

  const widgetMatch = /^(.+) configuration updated$/u.exec(summary);
  if (widgetMatch) {
    const labelKey = widgetLabelKeys[widgetMatch[1] ?? ''];
    const widget = labelKey ? t(labelKey) : t('history.widgetFallback');
    return t('history.summaries.widgetUpdated', { widget });
  }

  return t('history.summaries.fallback');
}
