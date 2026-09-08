import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import {
  ActionButton,
  ContentDialog,
  FormField,
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';
import { useAuth, usePermissions } from '@dwp-frontend/shared-utils';
import { meetingRecordReference } from '@dwp-frontend/shared-utils/api/video-meeting-record-retention-api';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useMeetingRecordRetention } from './use-meeting-record-retention';

type ControlAction = 'hold' | 'release' | 'authorize' | 'revoke';
export function MeetingRecordRetentionControl() {
  const { user, isAuthenticated } = useAuth();
  const { hasPermission } = usePermissions();
  const canView = isAuthenticated && hasPermission('ADMIN.MEETINGS', 'VIEW');
  const canManage = isAuthenticated && hasPermission('ADMIN.MEETINGS', 'MANAGE');
  if (!canView) return null;
  const identity = JSON.stringify([
    user?.tenantId,
    user?.userId,
    user?.identityPlane,
    canView,
    canManage,
  ]);
  return <RecordControl key={identity} canManage={canManage} />;
}
function RecordControl({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation('meetings');
  const [reference, setReference] = useState('');
  const [action, setAction] = useState<ControlAction | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const state = useMeetingRecordRetention(canManage);
  const id = meetingRecordReference(reference.trim());
  const data = state.data;
  const label = (key: string) => t(`admin.recordRetention.${key}`);
  const confirm = (next: ControlAction) => {
    setAcknowledged(false);
    setAction(next);
  };
  const controlsDisabled = !canManage || state.busy || !data || data.state === 'PURGED';
  const uncertain = state.phase === 'uncertain';
  return (
    <Box
      component="details"
      data-testid="meeting-record-retention-control"
      sx={{ mt: 1.5, borderTop: 1, borderColor: 'divider', pt: 1 }}
    >
      <Box
        component="summary"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          minHeight: 44,
          cursor: 'pointer',
          listStyle: 'none',
          '&::-webkit-details-marker': { display: 'none' },
          '&:focus-visible': { outline: 2, outlineColor: 'primary.main' },
        }}
      >
        <ShieldCheck size={17} aria-hidden="true" />
        <Typography component="span" variant="subtitle2" sx={{ flex: 1 }}>
          {label('title')}
        </Typography>
        <ChevronDown size={16} aria-hidden="true" />
      </Box>
      <Stack gap={1.5} sx={{ pt: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
        <Typography variant="caption" color="text.secondary">
          {label('scope')}
        </Typography>
        <FormField
          label={label('reference')}
          value={reference}
          size="small"
          fullWidth
          disabled={state.busy || uncertain}
          onChange={(event) => {
            state.reset();
            setAction(null);
            setReference(event.target.value);
          }}
        />
        <ActionButton
          intent="secondary"
          disabled={!id || state.busy || uncertain}
          onClick={() => id && state.load(id)}
        >
          {label('lookup')}
        </ActionButton>
        {state.busy && <LoadingState label={label('loading')} size="compact" skeletonRows={2} />}
        {['error', 'denied', 'conflict'].includes(state.phase) && (
          <InlineFeedback severity="warning" title={label(state.phase)}>
            {label('retryRead')}
          </InlineFeedback>
        )}
        {uncertain && (
          <InlineFeedback severity="warning" title={label('uncertain')}>
            <Stack gap={1}>
              <Typography variant="body2">{label('uncertainHint')}</Typography>
              <ActionButton intent="secondary" onClick={state.retry} disabled={!canManage}>
                {label('retryCommand')}
              </ActionButton>
            </Stack>
          </InlineFeedback>
        )}
        {data && (
          <>
            <InlineFeedback
              severity={data.state === 'PURGED' ? 'success' : 'info'}
              title={label(`states.${data.state}`)}
            >
              <Stack gap={0.5}>
                <Typography variant="caption">
                  {label('worker')}: {label(data.workerEnabled ? 'enabled' : 'disabled')}
                </Typography>
                <Typography variant="caption">
                  {label('audit')}:{' '}
                  {label(data.authorizationAuditPublished ? 'published' : 'pending')}
                </Typography>
                <Typography variant="caption">
                  {label('deadline')}:{' '}
                  <time dateTime={data.retentionUntil}>{data.retentionUntil}</time>
                </Typography>
                <Typography variant="caption">
                  {t('admin.recordRetention.versions', {
                    meeting: data.meetingVersion,
                    policy: data.policyVersion,
                    control: data.controlVersion,
                  })}
                </Typography>
                {data.purgedAt && (
                  <Typography variant="caption">
                    {label('purgedAt')}: <time dateTime={data.purgedAt}>{data.purgedAt}</time>
                  </Typography>
                )}
              </Stack>
            </InlineFeedback>
            {data.reasons.length > 0 && (
              <Box component="ul" aria-label={label('reasons')} sx={{ m: 0, pl: 2.5 }}>
                {data.reasons.map((reason, index) => (
                  <Typography component="li" variant="caption" key={`${reason}-${index}`}>
                    {t(`admin.recordRetention.reasons.${reason}`, {
                      defaultValue: label('unknownReason'),
                    })}{' '}
                    <Box component="code" sx={{ display: 'block', overflowWrap: 'anywhere' }}>
                      {reason}
                    </Box>
                  </Typography>
                ))}
              </Box>
            )}
            <Typography variant="caption" color="text.secondary">
              {label('holdBoundary')}
            </Typography>
            {!canManage && <Typography variant="caption">{label('readOnly')}</Typography>}
            <Stack direction="row" flexWrap="wrap" gap={1}>
              <ActionButton
                intent="secondary"
                disabled={controlsDisabled}
                onClick={() => confirm(data.hold ? 'release' : 'hold')}
              >
                {label(data.hold ? 'release' : 'hold')}
              </ActionButton>
              <ActionButton
                intent="secondary"
                disabled={
                  controlsDisabled ||
                  data.hold ||
                  (!data.purgeAuthorized &&
                    (Date.parse(data.retentionUntil) > Date.now() ||
                      data.reasons.includes('RECORD_NOT_TERMINAL')))
                }
                onClick={() => confirm(data.purgeAuthorized ? 'revoke' : 'authorize')}
              >
                {label(data.purgeAuthorized ? 'revoke' : 'authorize')}
              </ActionButton>
            </Stack>
          </>
        )}
      </Stack>
      <ContentDialog
        open={Boolean(action && data)}
        title={action ? label(action) : label('title')}
        description={label('confirmHint')}
        closeLabel={t('actions.cancel')}
        maxWidth="xs"
        onClose={() => setAction(null)}
        footerContent={
          <>
            <ActionButton intent="quiet" autoFocus onClick={() => setAction(null)}>
              {t('actions.cancel')}
            </ActionButton>
            <ActionButton
              intent={action === 'authorize' || action === 'release' ? 'danger' : 'primary'}
              disabled={!acknowledged || controlsDisabled}
              onClick={() => {
                if (!data || !action || !acknowledged || controlsDisabled) return;
                state.update(data, action === 'hold', action === 'authorize');
                setAction(null);
              }}
            >
              {label('confirm')}
            </ActionButton>
          </>
        }
      >
        <Stack gap={1.5}>
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
            {data?.meetingId}
          </Typography>
          <Typography variant="body2">{label('holdBoundary')}</Typography>
          <Box
            component="label"
            sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minHeight: 44 }}
          >
            <Box
              component="input"
              type="checkbox"
              checked={acknowledged}
              sx={{
                width: 20,
                height: 20,
                flexShrink: 0,
                accentColor: 'primary.main',
                '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: 2 },
              }}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            <Typography component="span" variant="body2">
              {label('acknowledge')}
            </Typography>
          </Box>
        </Stack>
      </ContentDialog>
    </Box>
  );
}
