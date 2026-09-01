import type { ReactNode } from 'react';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { ProviderSectionHeading } from './provider-ui';

import type {
  ProviderServiceHealthOverview,
  ProviderServiceIncident,
  ProviderTenant,
} from '@dwp-frontend/shared-utils';

export type ProviderIncidentDraft = {
  title: string;
  severity: ProviderServiceIncident['severity'];
  impactScope: 'GLOBAL' | 'REGION' | 'CELL' | 'SERVICE' | 'TENANT';
  target: string;
  customerImpact: string;
  publicSummary: string;
  initialUpdate: string;
};

const initialDraft: ProviderIncidentDraft = {
  title: '',
  severity: 'SEV3',
  impactScope: 'SERVICE',
  target: '',
  customerImpact: '',
  publicSummary: '',
  initialUpdate: '',
};

export function CreateProviderIncidentDialog({
  health,
  tenants,
  busy,
  onClose,
  onCreate,
}: {
  health: ProviderServiceHealthOverview;
  tenants: ProviderTenant[];
  busy: boolean;
  onClose: () => void;
  onCreate: (draft: ProviderIncidentDraft) => Promise<void>;
}) {
  const { t } = useTranslation('provider');
  const [draft, setDraft] = useState(initialDraft);
  const regions = useMemo(
    () => [...new Set(health.cells.map((cell) => cell.regionKey))].sort(),
    [health.cells]
  );
  const targets =
    draft.impactScope === 'REGION'
      ? regions.map((region) => ({ value: region, label: region }))
      : draft.impactScope === 'CELL'
        ? health.cells.map((cell) => ({ value: cell.deploymentCellId, label: cell.displayName }))
        : draft.impactScope === 'SERVICE'
          ? health.services.map((service) => ({
              value: service.serviceKey,
              label: service.displayName,
            }))
          : draft.impactScope === 'TENANT'
            ? tenants.map((tenant) => ({ value: tenant.tenantId, label: tenant.displayName }))
            : [];
  const valid =
    draft.title.trim() &&
    draft.customerImpact.trim() &&
    draft.initialUpdate.trim() &&
    (draft.impactScope === 'GLOBAL' || draft.target);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t('health.incidents.createTitle')}</DialogTitle>
      <DialogContent dividers>
        <Stack gap={2}>
          <Alert severity="warning">{t('health.incidents.createNotice')}</Alert>
          <TextField
            required
            label={t('health.incidents.fields.title')}
            value={draft.title}
            onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <TextField
              select
              fullWidth
              label={t('health.incidents.fields.severity')}
              value={draft.severity}
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  severity: event.target.value as ProviderIncidentDraft['severity'],
                }))
              }
            >
              {['SEV1', 'SEV2', 'SEV3', 'SEV4'].map((severity) => (
                <MenuItem key={severity} value={severity}>
                  {t(`health.severity.${severity}`)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              fullWidth
              label={t('health.incidents.fields.scope')}
              value={draft.impactScope}
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  impactScope: event.target.value as ProviderIncidentDraft['impactScope'],
                  target: '',
                }))
              }
            >
              {['GLOBAL', 'REGION', 'CELL', 'SERVICE', 'TENANT'].map((scope) => (
                <MenuItem key={scope} value={scope}>
                  {t(`health.scopes.${scope}`)}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          {draft.impactScope !== 'GLOBAL' && (
            <TextField
              select
              required
              label={t('health.incidents.fields.target')}
              value={draft.target}
              onChange={(event) => setDraft((value) => ({ ...value, target: event.target.value }))}
            >
              {targets.map((target) => (
                <MenuItem key={target.value} value={target.value}>
                  {target.label}
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            required
            multiline
            minRows={2}
            label={t('health.incidents.fields.impact')}
            value={draft.customerImpact}
            onChange={(event) =>
              setDraft((value) => ({ ...value, customerImpact: event.target.value }))
            }
          />
          <TextField
            multiline
            minRows={2}
            label={t('health.incidents.fields.publicSummary')}
            value={draft.publicSummary}
            onChange={(event) =>
              setDraft((value) => ({ ...value, publicSummary: event.target.value }))
            }
          />
          <TextField
            required
            multiline
            minRows={2}
            label={t('health.incidents.fields.initialUpdate')}
            value={draft.initialUpdate}
            onChange={(event) =>
              setDraft((value) => ({ ...value, initialUpdate: event.target.value }))
            }
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('actions.cancel')}
        </Button>
        <Button
          variant="contained"
          color="warning"
          startIcon={<AlertTriangle size={17} />}
          disabled={busy || !valid}
          onClick={() => void onCreate(draft)}
        >
          {t('health.incidents.actions.declare')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function UpdateProviderIncidentDialog({
  incident,
  busy,
  onClose,
  onUpdate,
}: {
  incident: ProviderServiceIncident;
  busy: boolean;
  onClose: () => void;
  onUpdate: (
    state: 'IDENTIFIED' | 'MONITORING' | 'RESOLVED' | 'CLOSED',
    message: string,
    visibility: 'INTERNAL' | 'CUSTOMER'
  ) => Promise<void>;
}) {
  const { t } = useTranslation('provider');
  const [state, setState] = useState<'IDENTIFIED' | 'MONITORING' | 'RESOLVED' | 'CLOSED'>(
    incident.lifecycleState === 'INVESTIGATING'
      ? 'IDENTIFIED'
      : incident.lifecycleState === 'IDENTIFIED'
        ? 'MONITORING'
        : incident.lifecycleState === 'MONITORING'
          ? 'RESOLVED'
          : 'CLOSED'
  );
  const [message, setMessage] = useState('');
  const [visibility, setVisibility] = useState<'INTERNAL' | 'CUSTOMER'>('INTERNAL');
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('health.incidents.updateTitle', { key: incident.incidentKey })}</DialogTitle>
      <DialogContent dividers>
        <Stack gap={2}>
          <TextField
            select
            label={t('health.incidents.fields.state')}
            value={state}
            onChange={(event) => setState(event.target.value as typeof state)}
          >
            {['IDENTIFIED', 'MONITORING', 'RESOLVED', 'CLOSED'].map((value) => (
              <MenuItem key={value} value={value}>
                {t(`states.${value}`)}
              </MenuItem>
            ))}
          </TextField>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={visibility}
            onChange={(_event, value: 'INTERNAL' | 'CUSTOMER' | null) =>
              value && setVisibility(value)
            }
            aria-label={t('health.incidents.fields.visibility')}
          >
            <ToggleButton value="INTERNAL">
              {t('health.incidents.visibility.INTERNAL')}
            </ToggleButton>
            <ToggleButton value="CUSTOMER">
              {t('health.incidents.visibility.CUSTOMER')}
            </ToggleButton>
          </ToggleButtonGroup>
          <TextField
            required
            multiline
            minRows={3}
            label={t('health.incidents.fields.update')}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('actions.cancel')}
        </Button>
        <Button
          variant="contained"
          disabled={busy || !message.trim()}
          onClick={() => void onUpdate(state, message.trim(), visibility)}
        >
          {t('actions.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function ProviderHealthSection({
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
    <Paper component="section" variant="outlined" sx={{ minWidth: 0, p: 2 }}>
      <ProviderSectionHeading title={title} description={description} action={action} />
      <Box sx={{ mt: 1.75 }}>{children}</Box>
    </Paper>
  );
}
