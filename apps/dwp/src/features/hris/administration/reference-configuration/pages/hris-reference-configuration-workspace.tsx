import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InlineFeedback } from '@dwp-frontend/design-system';

import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ReferenceConfigurationStudio } from '../components/reference-configuration-studio';
import { useReferenceConfigurationWorkspace } from '../hooks/use-reference-configuration-workspace';
import { referenceConfigurationRuntimeState } from '../model/reference-configuration-model';

export const HRIS_REFERENCE_CONFIGURATION_RUNTIME_STATE = referenceConfigurationRuntimeState(
  import.meta.env.VITE_HRIS_REFERENCE_CONFIGURATION_ENABLED === 'true'
);

export type HrisReferenceConfigurationWorkspaceProps = Readonly<{
  runtimeEnabled?: boolean;
}>;

/**
 * SYS-owned lifecycle studio mounted by Control. The route remains default-off until tenant
 * activation is explicitly granted; the raw workforce reference-data SoR is never imported.
 */
export function HrisReferenceConfigurationWorkspace({
  runtimeEnabled = HRIS_REFERENCE_CONFIGURATION_RUNTIME_STATE === 'ON',
}: HrisReferenceConfigurationWorkspaceProps) {
  if (!runtimeEnabled) return <ReferenceConfigurationUnavailable />;
  return <ActiveReferenceConfigurationWorkspace />;
}

function ActiveReferenceConfigurationWorkspace() {
  const workspace = useReferenceConfigurationWorkspace();
  const [preparedAction, setPreparedAction] = useState<string | null>(null);

  return (
    <Stack
      gap={2}
      data-testid="hris-reference-configuration-workspace"
      data-runtime-state="ON"
      sx={{ minWidth: 0, maxWidth: '100%' }}
    >
      {preparedAction ? (
        <InlineFeedback severity="info" title={`${preparedAction.replaceAll('_', ' ')} prepared`}>
          Confirm impact, approval evidence, optimistic version, and step-up authority before the
          command is submitted. Closing this message does not mutate configuration state.
        </InlineFeedback>
      ) : null}
      <ReferenceConfigurationStudio
        state={workspace.status}
        workbench={workspace.workbench}
        detail={workspace.detail}
        detailLoading={workspace.detailLoading}
        selectedId={workspace.selected?.configurationId}
        statusFilter={workspace.statusFilter}
        onStatusFilterChange={workspace.setStatusFilter}
        onSelect={workspace.select}
        onRefresh={() => void workspace.refresh()}
        onPrepareAction={setPreparedAction}
      />
    </Stack>
  );
}

function ReferenceConfigurationUnavailable() {
  const { t } = useTranslation('hcm');
  return (
    <Stack
      gap={2}
      data-testid="hris-reference-configuration-workspace"
      data-runtime-state="OFF"
      sx={{ minWidth: 0, maxWidth: '100%' }}
    >
      <InlineFeedback
        severity="info"
        title={t('pages.hcm.settings-reference.availabilityTitle', {
          defaultValue: 'Reference-configuration lifecycle is unavailable',
        })}
      >
        {t('pages.hcm.settings-reference.availabilityDescription', {
          defaultValue:
            'The SYS lifecycle is installed but remains feature-off. No configuration data is loaded and no lifecycle command is available.',
        })}
      </InlineFeedback>

      <Paper component="section" variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, minWidth: 0 }}>
        <Stack gap={1.25} alignItems="flex-start" minWidth={0}>
          <Chip
            size="small"
            color="default"
            variant="outlined"
            label={t('pages.hcm.settings-reference.runtimeState', {
              defaultValue: 'Feature state: OFF',
            })}
          />
          <Typography component="h2" variant="subtitle1" sx={{ overflowWrap: 'anywhere' }}>
            {t('pages.hcm.settings-reference.boundaryTitle', {
              defaultValue: 'Separate from workforce reference data',
            })}
          </Typography>
          <Typography color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {t('pages.hcm.settings-reference.boundaryDescription', {
              defaultValue:
                'This workspace stores only version lifecycle evidence and owner references. Workforce reference data remains available only at /hr/data/reference.',
            })}
          </Typography>
        </Stack>
      </Paper>
    </Stack>
  );
}
