import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { formatDate } from '@dwp-frontend/shared-i18n';
import type {
  DwaionGateEvidenceType,
  DwaionOperationalGateDetail,
} from '@dwp-frontend/shared-utils';
import { CheckCircle2, CircleAlert, FileCheck2, History, ShieldCheck } from 'lucide-react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { GateStatusChip, gateOptionLabel } from './dwaion-gate-ui';

type Props = {
  detail?: DwaionOperationalGateDetail;
  loading?: boolean;
  error?: boolean;
};

export function DwaionGateReview({ detail, loading = false, error = false }: Props) {
  const { t } = useTranslation('work');

  if (loading) {
    return (
      <Box aria-label={t('dwaionAdmin.gates.review.loading')}>
        <LinearProgress />
      </Box>
    );
  }
  if (error || !detail) {
    return <Alert severity="error">{t('dwaionAdmin.gates.review.loadError')}</Alert>;
  }

  const { gate } = detail;
  const evidenceTypes = new Set(detail.evidence.map((item) => item.evidenceType));
  return (
    <Stack spacing={2.5}>
      <section>
        <ReviewHeading icon={<ShieldCheck size={17} />}>
          {t('dwaionAdmin.gates.review.policyTitle')}
        </ReviewHeading>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            columnGap: 3,
            borderBlock: 1,
            borderColor: 'divider',
          }}
        >
          <ReviewValue label={t('dwaionAdmin.gates.review.status')}>
            <GateStatusChip
              status={gate.status}
              label={t(`dwaionAdmin.gates.statuses.${gate.status}`)}
            />
          </ReviewValue>
          <ReviewValue label={t('dwaionAdmin.gates.review.policy')}>
            {gate.selectedOption
              ? gateOptionLabel(t, gate.gateKey, gate.selectedOption)
              : t('dwaionAdmin.gates.notSelected')}
          </ReviewValue>
          <ReviewValue label={t('dwaionAdmin.gates.review.owner')}>
            {gate.ownerUserId || t('dwaionAdmin.gates.review.none')}
          </ReviewValue>
          <ReviewValue label={t('dwaionAdmin.gates.review.configurationRef')}>
            {gate.configurationRef || t('dwaionAdmin.gates.review.none')}
          </ReviewValue>
          <ReviewValue label={t('dwaionAdmin.gates.review.validationSummary')}>
            {gate.validationSummary || t('dwaionAdmin.gates.review.notValidated')}
          </ReviewValue>
          <ReviewValue label={t('dwaionAdmin.gates.review.revision')}>
            {t('dwaionAdmin.gates.review.revisionValue', {
              configuration: gate.configurationRevision,
              policy: gate.policyVersion,
            })}
          </ReviewValue>
        </Box>
      </section>

      <section>
        <ReviewHeading icon={<FileCheck2 size={17} />}>
          {t('dwaionAdmin.gates.review.evidenceTitle')}
        </ReviewHeading>
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mb: 1.5 }}>
          {gate.requiredEvidenceTypes.map((type) => {
            const present = evidenceTypes.has(type);
            return (
              <Chip
                key={type}
                size="small"
                color={present ? 'success' : 'warning'}
                variant="outlined"
                icon={present ? <CheckCircle2 size={14} /> : <CircleAlert size={14} />}
                label={t(`dwaionAdmin.gates.evidenceTypes.${type}`)}
              />
            );
          })}
        </Stack>
        {detail.missingEvidenceTypes.length > 0 && (
          <Alert severity="warning" sx={{ mb: 1.5 }}>
            {t('dwaionAdmin.gates.review.missingEvidence', {
              evidence: evidenceLabels(detail.missingEvidenceTypes, t),
            })}
          </Alert>
        )}
        {detail.evidence.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('dwaionAdmin.gates.review.noEvidence')}
          </Typography>
        ) : (
          <Stack divider={<Divider flexItem />} sx={{ borderBlock: 1, borderColor: 'divider' }}>
            {detail.evidence.map((item) => (
              <Box key={item.evidenceId} sx={{ py: 1.25 }}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  gap={0.5}
                >
                  <Typography variant="body2" fontWeight={680}>
                    {item.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(item.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {t(`dwaionAdmin.gates.evidenceTypes.${item.evidenceType}`)} · {item.createdBy}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
                  {item.reference}
                </Typography>
                {item.notes && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {item.notes}
                  </Typography>
                )}
              </Box>
            ))}
          </Stack>
        )}
      </section>

      <ApprovalEligibility detail={detail} />

      <section>
        <ReviewHeading icon={<History size={17} />}>
          {t('dwaionAdmin.gates.review.auditTitle')}
        </ReviewHeading>
        {detail.events.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('dwaionAdmin.gates.review.noAudit')}
          </Typography>
        ) : (
          <Stack divider={<Divider flexItem />} sx={{ borderBlock: 1, borderColor: 'divider' }}>
            {detail.events.map((event) => (
              <Box key={event.eventId} sx={{ py: 1.25 }}>
                <Stack direction="row" justifyContent="space-between" gap={2}>
                  <Typography variant="body2" fontWeight={650}>
                    {auditEventLabel(event.eventType, t)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                    {formatDate(event.createdAt, { dateStyle: 'short', timeStyle: 'short' })}
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {event.actorUserId}
                  {event.previousStatus && event.currentStatus
                    ? ` · ${t(`dwaionAdmin.gates.statuses.${event.previousStatus}`)} → ${t(
                        `dwaionAdmin.gates.statuses.${event.currentStatus}`
                      )}`
                    : ''}
                </Typography>
                {event.changeReason && (
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {event.changeReason}
                  </Typography>
                )}
              </Box>
            ))}
          </Stack>
        )}
      </section>
    </Stack>
  );
}

function ApprovalEligibility({ detail }: { detail: DwaionOperationalGateDetail }) {
  const { t } = useTranslation('work');
  const eligibility = detail.approvalEligibility;
  const key = eligibility.eligible
    ? 'eligible'
    : eligibility.reason === 'SEPARATION_OF_DUTY'
      ? 'separation'
      : 'notReady';
  return (
    <Alert severity={eligibility.eligible ? 'success' : key === 'separation' ? 'warning' : 'info'}>
      {t(`dwaionAdmin.gates.review.approval.${key}`, {
        role: eligibility.conflictingRole
          ? t(`dwaionAdmin.gates.review.actorRoles.${eligibility.conflictingRole}`)
          : '',
      })}
    </Alert>
  );
}

function ReviewHeading({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
      {icon}
      <Typography variant="subtitle2">{children}</Typography>
    </Stack>
  );
}

function ReviewValue({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ py: 1.25, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
        {label}
      </Typography>
      <Box sx={{ typography: 'body2', overflowWrap: 'anywhere' }}>{children}</Box>
    </Box>
  );
}

function evidenceLabels(values: DwaionGateEvidenceType[], t: TFunction<'work'>): string {
  return values.map((value) => t(`dwaionAdmin.gates.evidenceTypes.${value}`)).join(', ');
}

function auditEventLabel(eventType: string, t: TFunction<'work'>): string {
  const action = eventType.split('.').at(-1) ?? eventType;
  return t(`dwaionAdmin.gates.review.auditEvents.${action}`, { defaultValue: eventType });
}
