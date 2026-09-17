import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cable, RefreshCw, Search } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { buildMailConnectionReadiness } from './mail-admin-operations-model';
import {
  EvidenceChip,
  Facts,
  FormattedTime,
  Section,
  SourceEvidence,
  StateChip,
} from './mail-admin-operations-ui-shared';

import type { MailAdminOverview } from '@dwp-frontend/shared-utils';
import type { MailConnectionOperation } from './mail-admin-operations-model';

export function ConnectionsSurface({
  overview,
  operations,
  now,
  canManage,
  busyAction,
  onOpenSettings,
  onDiagnostic,
  onSync,
  onTest,
}: {
  overview: MailAdminOverview;
  operations?: readonly MailConnectionOperation[];
  now: number;
  canManage: boolean;
  busyAction?: string | null;
  onOpenSettings?: () => void;
  onDiagnostic?: (connectionId: string) => void;
  onSync?: (connectionId: string) => void;
  onTest?: (connectionId: string, recipient: string) => void;
}) {
  const { t } = useTranslation('mail');
  const rows = useMemo(() => buildMailConnectionReadiness(overview, now), [overview, now]);
  const [testConnectionId, setTestConnectionId] = useState<string | null>(null);
  const [recipient, setRecipient] = useState('');
  return (
    <Stack spacing={2.5}>
      <SourceEvidence overview={overview} now={now} />
      <Section
        title={t('admin.overview.connectionHealth')}
        description={t('admin.operationsWorkspace.a02.description', {
          defaultValue:
            'Adapter, credentials, synchronization, and send evidence are kept separate.',
        })}
        action={
          onOpenSettings ? (
            <ActionButton
              intent="secondary"
              disabled={!canManage}
              startIcon={<Cable size={16} />}
              onClick={onOpenSettings}
            >
              {t('admin.connections.configure')}
            </ActionButton>
          ) : undefined
        }
      >
        {rows.length ? (
          rows.map((row, index) => {
            const latest = operations?.find(
              (operation) => operation.connectionId === row.connection.connectionId
            );
            const id = row.connection.connectionId;
            return (
              <Box key={id}>
                {index > 0 ? <Divider /> : null}
                <Stack spacing={1.3} sx={{ px: { xs: 1.75, sm: 2.25 }, py: 1.75 }}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                  >
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="body2" fontWeight="fontWeightBold">
                        {row.connection.displayName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.connection.providerType} · {row.connection.authenticationMode}
                      </Typography>
                    </Box>
                    <StateChip label={row.connection.state} />
                    <EvidenceChip state={row.evidenceState} />
                  </Stack>
                  <Facts
                    items={[
                      {
                        label: t('admin.operationsWorkspace.a02.runtime', {
                          defaultValue: 'Adapter',
                        }),
                        value: row.runtimeVerified
                          ? (row.descriptor?.adapterVersion ?? 'Available')
                          : 'Not verified',
                      },
                      {
                        label: t('admin.operationsWorkspace.a02.credentials', {
                          defaultValue: 'Credentials',
                        }),
                        value: row.credentialVerified ? 'Configured' : 'Not verified',
                      },
                      {
                        label: t('admin.operationsWorkspace.a02.lastSync', {
                          defaultValue: 'Last synchronization',
                        }),
                        value: <FormattedTime value={row.connection.lastSynchronizedAt} />,
                      },
                    ]}
                  />
                  {row.blockers.length ? (
                    <Typography variant="caption" color="warning.main">
                      {row.blockers.join(' · ')}
                    </Typography>
                  ) : null}
                  {latest ? (
                    <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                      <Typography variant="caption">
                        {latest.kind} · {latest.correlationId}
                      </Typography>
                      <StateChip label={latest.state} />
                    </Stack>
                  ) : null}
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    justifyContent="flex-end"
                  >
                    <ActionButton
                      size="small"
                      intent="quiet"
                      loading={busyAction === `diagnostic:${id}`}
                      disabled={!canManage || !onDiagnostic || !row.runtimeVerified}
                      startIcon={<Search size={15} />}
                      onClick={() => onDiagnostic?.(id)}
                    >
                      {t('admin.operationsWorkspace.a02.diagnostic', {
                        defaultValue: 'Run diagnostics',
                      })}
                    </ActionButton>
                    <ActionButton
                      size="small"
                      intent="secondary"
                      loading={busyAction === `sync:${id}`}
                      disabled={!canManage || !onSync || !row.runtimeVerified}
                      startIcon={<RefreshCw size={15} />}
                      onClick={() => onSync?.(id)}
                    >
                      {t('admin.operationsWorkspace.a02.sync', { defaultValue: 'Synchronize' })}
                    </ActionButton>
                    <ActionButton
                      size="small"
                      intent="primary"
                      disabled={!canManage || !onTest || !row.activationAllowed}
                      onClick={() => {
                        setRecipient('');
                        setTestConnectionId(id);
                      }}
                    >
                      {t('admin.operationsWorkspace.a02.testSend', { defaultValue: 'Test send' })}
                    </ActionButton>
                  </Stack>
                </Stack>
              </Box>
            );
          })
        ) : (
          <Box sx={{ p: 2 }}>
            <Typography variant="body2">{t('admin.connections.emptyTitle')}</Typography>
          </Box>
        )}
      </Section>
      <Dialog
        open={Boolean(testConnectionId)}
        onClose={() => setTestConnectionId(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {t('admin.operationsWorkspace.a02.testSend', { defaultValue: 'Test send' })}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('admin.operationsWorkspace.a02.testWarning', {
              defaultValue: 'This sends a real message. Confirm the recipient and external impact.',
            })}
          </Typography>
          <TextField
            autoFocus
            fullWidth
            type="email"
            label={t('compose.to')}
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <ActionButton intent="quiet" onClick={() => setTestConnectionId(null)}>
            {t('actions.cancel')}
          </ActionButton>
          <ActionButton
            intent="primary"
            disabled={!recipient.includes('@') || !testConnectionId}
            loading={busyAction === `test:${testConnectionId}`}
            onClick={() => {
              if (testConnectionId) onTest?.(testConnectionId, recipient.trim());
            }}
          >
            {t('admin.operationsWorkspace.a02.confirmTest', {
              defaultValue: 'Confirm and send test',
            })}
          </ActionButton>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
