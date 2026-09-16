import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GuidedEmptyState } from '@dwp-frontend/design-system';

import Stack from '@mui/material/Stack';

import { WorkHubMobileQuickCapture } from './work-hub-mobile-quick-capture';
import type { WorkTaskDialogProps } from './work-task-dialog';

export function WorkHubMobileEmptyCapture({
  ownerKey,
  canCreate,
  canScheduleAfterCreate,
  onSubmit,
}: {
  ownerKey: string;
  canCreate: boolean;
  canScheduleAfterCreate: boolean;
  onSubmit: WorkTaskDialogProps['onSubmit'];
}) {
  const { t } = useTranslation('work');
  const [captureOpen, setCaptureOpen] = useState(true);

  useEffect(() => {
    setCaptureOpen(true);
  }, [ownerKey]);

  return (
    <Stack gap={1.5}>
      <GuidedEmptyState
        kind="first-use"
        title={t('workHub.empty.title')}
        description={t('workHub.empty.description')}
        actionLabel={canCreate ? t('workHub.actions.createTask') : undefined}
        onAction={canCreate ? () => setCaptureOpen(true) : undefined}
        size="compact"
      />
      {canCreate && captureOpen && (
        <WorkHubMobileQuickCapture
          key={ownerKey}
          canScheduleAfterCreate={canScheduleAfterCreate}
          onCancel={() => setCaptureOpen(false)}
          onSubmit={onSubmit}
        />
      )}
    </Stack>
  );
}
