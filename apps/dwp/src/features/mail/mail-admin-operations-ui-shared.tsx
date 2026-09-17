import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { InlineFeedback, foundationTokens } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { resolveMailAdminFreshness } from './mail-admin-operations-model';

import type { MailAdminOverview } from '@dwp-frontend/shared-utils';
import type {
  MailAdminEvidenceState,
  MailAdminOperationalException,
  MailAdminOperationsSnapshot,
  MailAdminSurface,
  MailAuditExport,
  MailConnectionOperation,
  MailDeliveryAuditPage,
  MailDeliveryRecoveryEvidence,
  MailLegalHoldInput,
  MailPolicyGovernance,
  MailPurgeCandidateSnapshot,
  MailPurgeGateEvidence,
  MailRetentionSnapshot,
  MailSharedInboxAccess,
  MailSharedInboxMember,
  MailSharedInboxMemberInput,
} from './mail-admin-operations-model';

const PANEL_RADIUS = `${foundationTokens.radius.compact}px`;

export type MailAdminOperationsContentProps = {
  surface: MailAdminSurface;
  overview: MailAdminOverview;
  canManage: boolean;
  now?: number;
  operations?: MailAdminOperationsSnapshot;
  connectionOperations?: readonly MailConnectionOperation[];
  sharedAccess?: readonly MailSharedInboxAccess[];
  policyGovernance?: MailPolicyGovernance;
  retention?: MailRetentionSnapshot;
  deliveryAudit?: MailDeliveryAuditPage;
  auditExport?: MailAuditExport;
  deliveryEvidence?: readonly MailDeliveryRecoveryEvidence[];
  purgeEvidence?: MailPurgeGateEvidence;
  busyAction?: string | null;
  onOpenConnectionSettings?: () => void;
  onOpenSharedInboxSettings?: () => void;
  onOpenPolicySettings?: () => void;
  onOpenException?: (exception: MailAdminOperationalException) => void;
  onRunConnectionDiagnostic?: (connectionId: string) => void;
  onStartConnectionSync?: (connectionId: string) => void;
  onSendConnectionTest?: (connectionId: string, recipient: string) => void;
  onAddSharedMember?: (sharedInboxId: string, input: MailSharedInboxMemberInput) => void;
  onUpdateSharedMember?: (
    sharedInboxId: string,
    memberId: string,
    input: MailSharedInboxMemberInput
  ) => void;
  onRemoveSharedMember?: (
    sharedInboxId: string,
    member: MailSharedInboxMember,
    memberVersion: number
  ) => void;
  onCreateLegalHold?: (input: MailLegalHoldInput) => void;
  onUpdateLegalHold?: (holdId: string, input: MailLegalHoldInput) => void;
  onReleaseLegalHold?: (holdId: string, version: number) => void;
  onPreviewPurge?: () => void;
  onApprovePurge?: (candidate: MailPurgeCandidateSnapshot) => void;
  onExecutePurge?: (candidate: MailPurgeCandidateSnapshot) => void;
  onReconcileDelivery?: (deliveryId: string) => void;
  onRetryDelivery?: (deliveryId: string) => void;
  onCancelDelivery?: (deliveryId: string) => void;
  onExportDeliveryAudit?: () => void;
};

export function EvidenceChip({ state }: { state: MailAdminEvidenceState }) {
  const { t } = useTranslation('mail');
  const color =
    state === 'VERIFIED'
      ? 'success'
      : state === 'STALE'
        ? 'error'
        : state === 'PARTIAL'
          ? 'warning'
          : 'default';
  return (
    <Chip
      size="small"
      variant="outlined"
      color={color}
      label={t(`admin.operationsWorkspace.evidence.${state}`, { defaultValue: state })}
    />
  );
}

export function StateChip({ label }: { label: string }) {
  const success = ['SUCCEEDED', 'READY', 'ENFORCED', 'ACTIVE', 'APPLIED', 'VERIFIED'].includes(
    label
  );
  const error = ['FAILED', 'UNKNOWN', 'BLOCKED', 'REVOKED'].includes(label);
  const warning = ['PARTIAL', 'PENDING', 'RUNNING', 'STALE'].includes(label);
  return (
    <Chip
      size="small"
      variant="outlined"
      color={success ? 'success' : error ? 'error' : warning ? 'warning' : 'default'}
      label={label}
    />
  );
}

export function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box
      component="section"
      sx={{
        minWidth: 0,
        border: 1,
        borderColor: 'divider',
        borderRadius: PANEL_RADIUS,
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        spacing={1.5}
        sx={{ px: { xs: 1.75, sm: 2.25 }, py: 1.75 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h2" variant="h6" fontWeight="fontWeightBold">
            {title}
          </Typography>
          {description ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              {description}
            </Typography>
          ) : null}
        </Box>
        {action}
      </Stack>
      <Divider />
      {children}
    </Box>
  );
}

export function Facts({
  items,
}: {
  items: ReadonlyArray<{ label: string; value: ReactNode; detail?: string }>;
}) {
  return (
    <Box
      component="dl"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, 1fr)' },
        m: 0,
      }}
    >
      {items.map((item) => (
        <Box
          key={item.label}
          sx={{
            minWidth: 0,
            px: { xs: 1.75, sm: 2.25 },
            py: 1.75,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Typography component="dt" variant="caption" color="text.secondary">
            {item.label}
          </Typography>
          <Typography
            component="dd"
            variant="h6"
            fontWeight="fontWeightBold"
            sx={{ m: 0, mt: 0.35, overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' }}
          >
            {item.value}
          </Typography>
          {item.detail ? (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 0.25 }}
            >
              {item.detail}
            </Typography>
          ) : null}
        </Box>
      ))}
    </Box>
  );
}

export function FormattedTime({ value }: { value?: string | null }) {
  const { i18n } = useTranslation('mail');
  if (!value) return <>—</>;
  return (
    <>
      {formatDate(
        value,
        { dateStyle: 'medium', timeStyle: 'short' },
        resolveSupportedLocale(i18n.language)
      )}
    </>
  );
}

export function SourceEvidence({
  overview,
  operations,
  now,
}: {
  overview: MailAdminOverview;
  operations?: MailAdminOperationsSnapshot;
  now: number;
}) {
  const { t } = useTranslation('mail');
  const generatedAt = operations?.generatedAt ?? overview.generatedAt;
  const freshness = resolveMailAdminFreshness(generatedAt, now);
  return (
    <InlineFeedback severity={freshness === 'CURRENT' ? 'info' : 'warning'}>
      {t('admin.operationsWorkspace.sourceEvidence', {
        defaultValue: 'Evidence generated at {{time}}. Each source is evaluated independently.',
        time: generatedAt,
      })}
    </InlineFeedback>
  );
}
