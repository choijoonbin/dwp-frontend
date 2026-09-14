import { useTranslation } from 'react-i18next';
import { InlineFeedback, LoadingState } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import type { ApprovalFormWorkspaceDiff } from '@dwp-frontend/shared-utils';
import type { ApprovalFormWorkspaceReadState } from './approval-form-workspace-model';

const provenanceKeys = {
  UNRECORDED_HISTORICAL_METADATA: 'admin.formWorkspace.unrecordedMetadata',
  LEGACY_CAPTURE_TIME: 'admin.formWorkspace.legacyCapture',
  AUTHORING_SNAPSHOT: 'admin.formWorkspace.authoringSnapshot',
  PUBLISH_SNAPSHOT: 'admin.formWorkspace.publishSnapshot',
} as const;
function valueText(value: unknown) {
  if (value === null) return '-';
  return typeof value === 'string' ? value : JSON.stringify(value);
}
export function ApprovalFormVersionDiff({
  diff,
  state,
}: {
  diff?: ApprovalFormWorkspaceDiff;
  state: ApprovalFormWorkspaceReadState;
}) {
  const { t } = useTranslation('approvals');
  if (state === 'DENIED')
    return (
      <InlineFeedback severity="error">{t('admin.formWorkspace.sourceUnavailable')}</InlineFeedback>
    );
  return (
    <Box component="section" sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
      <Box component="h3" sx={{ m: 0, typography: 'subtitle2' }}>
        {t('admin.formWorkspace.compare')}
      </Box>
      {state === 'LOADING' ? (
        <LoadingState label={t('admin.formWorkspace.compare')} size="compact" />
      ) : null}
      {state !== 'READY' && state !== 'LOADING' ? (
        <InlineFeedback severity="warning">
          {t('admin.formWorkspace.sourceUnavailable')}
        </InlineFeedback>
      ) : null}
      {diff ? (
        <>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            gap={1}
            sx={{ my: 1, typography: 'caption', color: 'text.secondary' }}
          >
            <Box>
              {t('admin.formWorkspace.before')}: {t(provenanceKeys[diff.fromMetadataProvenance])}
            </Box>
            <Box>
              {t('admin.formWorkspace.after')}: {t(provenanceKeys[diff.toMetadataProvenance])}
            </Box>
          </Stack>
          {!diff.complete ? (
            <InlineFeedback severity="warning">
              {t('admin.formWorkspace.diffPartial')}
            </InlineFeedback>
          ) : null}
          {diff.changes.length ? (
            <Stack
              component="ul"
              sx={{ listStyle: 'none', p: 0, m: 0, maxHeight: 380, overflowY: 'auto' }}
            >
              {diff.changes.map((change, index) => (
                <Box
                  component="li"
                  key={`${change.path}-${index}`}
                  sx={{ py: 1.5, borderBottom: 1, borderColor: 'divider' }}
                >
                  <Box
                    sx={{
                      typography: 'caption',
                      fontWeight: 'fontWeightBold',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {change.path}
                  </Box>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' },
                      gap: 1,
                      mt: 0.5,
                    }}
                  >
                    <Box sx={{ typography: 'body2', overflowWrap: 'anywhere' }}>
                      <Box component="span" sx={{ color: 'text.secondary' }}>
                        {t('admin.formWorkspace.before')}:{' '}
                      </Box>
                      {valueText(change.before)}
                    </Box>
                    <Box sx={{ typography: 'body2', overflowWrap: 'anywhere' }}>
                      <Box component="span" sx={{ color: 'text.secondary' }}>
                        {t('admin.formWorkspace.after')}:{' '}
                      </Box>
                      {valueText(change.after)}
                    </Box>
                  </Box>
                </Box>
              ))}
            </Stack>
          ) : (
            <Box sx={{ typography: 'body2', py: 2, color: 'text.secondary' }}>
              {t('admin.formWorkspace.noChanges')}
            </Box>
          )}
        </>
      ) : null}
    </Box>
  );
}
