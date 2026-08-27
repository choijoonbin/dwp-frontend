import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useDisplayDictionary } from '@dwp-frontend/shared-i18n';
import { getProviderSupportPostReviewEvidence } from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ProviderSupportAccessRequest } from '@dwp-frontend/shared-utils';

import { isProviderPostReviewEvidenceReady } from './provider-support-post-review-evidence-model';
import { formatProviderDate } from './provider-ui';

export function ProviderSupportPostReviewEvidence({
  request,
  onReadyChange,
}: {
  request: ProviderSupportAccessRequest;
  onReadyChange: (ready: boolean) => void;
}) {
  const { t } = useTranslation('provider');
  const display = useDisplayDictionary();
  const evidence = useQuery({
    queryKey: ['provider', 'support-post-review-evidence', request.supportAccessRequestId],
    queryFn: () => getProviderSupportPostReviewEvidence(request.supportAccessRequestId),
    retry: false,
  });
  const ready = isProviderPostReviewEvidenceReady(request, evidence.data);

  useEffect(() => onReadyChange(ready), [onReadyChange, ready]);

  return (
    <Box component="section" aria-label={t('support.postReviewEvidence.title')}>
      <Typography variant="subtitle2">{t('support.postReviewEvidence.title')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
        {t('support.postReviewEvidence.description')}
      </Typography>
      {evidence.isLoading ? (
        <Stack direction="row" alignItems="center" gap={1} role="status" sx={{ mt: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="body2">{t('support.postReviewEvidence.loading')}</Typography>
        </Stack>
      ) : evidence.isError || !evidence.data ? (
        <Alert severity="error" sx={{ mt: 1 }}>
          {t('support.postReviewEvidence.error')}
        </Alert>
      ) : (
        <Stack gap={1.25} sx={{ mt: 1 }}>
          <Box
            component="dl"
            sx={{
              m: 0,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              borderBlock: 1,
              borderColor: 'divider',
            }}
          >
            {[
              [t('support.columns.session'), evidence.data.supportSessionId],
              [t('support.columns.state'), evidence.data.sessionLifecycleState],
              [
                t('support.postReviewEvidence.period'),
                `${formatProviderDate(evidence.data.evidenceFrom)} – ${formatProviderDate(
                  evidence.data.evidenceThrough
                )}`,
              ],
              [
                t('support.postReviewEvidence.grantedScopes'),
                evidence.data.grantedScopes.join(', '),
              ],
              [
                t('support.postReviewEvidence.observedScopes'),
                evidence.data.observedScopes.length > 0
                  ? evidence.data.observedScopes.join(', ')
                  : t('support.postReviewEvidence.noObservedScope'),
              ],
              [
                t('support.postReviewEvidence.completeness'),
                evidence.data.evidenceComplete
                  ? t('support.postReviewEvidence.complete')
                  : t('support.postReviewEvidence.incomplete'),
              ],
            ].map(([label, value]) => (
              <Box key={label} sx={{ px: 1.25, py: 0.75, minWidth: 0 }}>
                <Typography component="dt" variant="caption" color="text.secondary">
                  {label}
                </Typography>
                <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>

          <Stack direction="row" gap={0.75} flexWrap="wrap">
            <Chip
              size="small"
              variant="outlined"
              label={t('support.postReviewEvidence.total', {
                count: evidence.data.totalEventCount,
              })}
            />
            <Chip
              size="small"
              color="success"
              variant="outlined"
              label={t('support.postReviewEvidence.allowed', {
                count: evidence.data.actualUseCount,
              })}
            />
            <Chip
              size="small"
              color={evidence.data.deniedAttemptCount > 0 ? 'warning' : 'default'}
              variant="outlined"
              label={t('support.postReviewEvidence.denied', {
                count: evidence.data.deniedAttemptCount,
              })}
            />
          </Stack>

          {!evidence.data.evidenceComplete ? (
            <Alert severity="error">{t('support.postReviewEvidence.incompleteBlocked')}</Alert>
          ) : evidence.data.noUseConfirmed ? (
            <Alert severity="info">{t('support.postReviewEvidence.noUseConfirmed')}</Alert>
          ) : null}

          {evidence.data.anomalies.length > 0 && (
            <Alert severity="warning">
              {t('support.postReviewEvidence.anomalies', {
                value: evidence.data.anomalies
                  .map((anomaly) =>
                    t(`support.postReviewEvidence.anomaly.${anomaly}`, { defaultValue: anomaly })
                  )
                  .join(', '),
              })}
            </Alert>
          )}

          {evidence.data.events.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('support.postReviewEvidence.showing', {
                  shown: evidence.data.events.length,
                  total: evidence.data.totalEventCount,
                })}
              </Typography>
              <Stack component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
                {evidence.data.events.map((event) => (
                  <Box
                    component="li"
                    key={event.auditEventId}
                    sx={{ py: 0.75, borderBottom: 1, borderColor: 'divider' }}
                  >
                    <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
                      <Chip
                        size="small"
                        color={event.decision === 'ALLOW' ? 'success' : 'warning'}
                        label={t(`support.postReviewEvidence.decision.${event.decision}`)}
                      />
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {event.method} {event.routeTemplate}
                      </Typography>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={display('outcomes', event.outcome)}
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {formatProviderDate(event.occurredAt)}
                    </Typography>
                    {event.scope && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {t('support.postReviewEvidence.scope', { value: event.scope })}
                      </Typography>
                    )}
                    {event.reasonCode && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {t('support.postReviewEvidence.reason', { value: event.reasonCode })}
                      </Typography>
                    )}
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                      sx={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                    >
                      {t('support.postReviewEvidence.correlation', {
                        value: event.correlationId,
                      })}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      )}
    </Box>
  );
}
