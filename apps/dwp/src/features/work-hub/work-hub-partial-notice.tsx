import { useTranslation } from 'react-i18next';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';

import Stack from '@mui/material/Stack';

import type { WorkHubSnapshot } from './work-hub-contracts';

export function workHubPartialCopy(snapshot: WorkHubSnapshot) {
  const failed = snapshot.sources.some(
    (source) => source.state === 'FORBIDDEN' || source.state === 'UNAVAILABLE'
  );
  const truncated = snapshot.sources.some((source) => source.state === 'READY' && source.hasMore);
  const prefix = truncated && !failed ? 'bounded' : failed && truncated ? 'mixed' : 'failure';
  return {
    title: `workHub.partial.${prefix}Title`,
    description: `workHub.partial.${prefix}Description`,
  };
}

export function WorkHubPartialNotice({
  snapshot,
  onInspect,
}: {
  snapshot: WorkHubSnapshot;
  onInspect: () => void;
}) {
  const { t } = useTranslation('work');
  const copy = workHubPartialCopy(snapshot);
  return (
    <InlineFeedback severity="warning" title={t(copy.title)} sx={{ mt: 2 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        gap={1}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
      >
        <span>{t(copy.description)}</span>
        <ActionButton intent="quiet" size="small" onClick={onInspect}>
          {t('workHub.partial.inspect')}
        </ActionButton>
      </Stack>
    </InlineFeedback>
  );
}
