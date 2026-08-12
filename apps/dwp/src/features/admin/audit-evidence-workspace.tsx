import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { FileSearch2, GitBranch } from 'lucide-react';

import Box from '@mui/material/Box';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import { AuditEventCorrelations } from './audit-event-correlations';
import { AuditExplorer } from './audit-explorer';

type EvidenceMode = 'correlations' | 'events';

export function AuditEvidenceWorkspace() {
  const { t } = useTranslation('admin');
  const [searchParams, setSearchParams] = useSearchParams();
  const mode: EvidenceMode = searchParams.get('mode') === 'events' ? 'events' : 'correlations';

  const changeMode = (value: EvidenceMode) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'correlations') next.delete('mode');
    else next.set('mode', value);
    setSearchParams(next, { replace: true });
  };

  return (
    <>
      <Box
        sx={{
          mb: 2.5,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { sm: 'center' },
          justifyContent: 'space-between',
          gap: 1.5,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h2" variant="subtitle1">
            {t(`auditControl.evidenceModes.${mode}.title`)}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {t(`auditControl.evidenceModes.${mode}.description`)}
          </Typography>
        </Box>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={mode}
          onChange={(_event, value: EvidenceMode | null) => value && changeMode(value)}
          aria-label={t('auditControl.evidenceModes.label')}
        >
          <ToggleButton value="correlations">
            <GitBranch size={16} aria-hidden="true" />
            <Box component="span" sx={{ ml: 0.75 }}>
              {t('auditControl.evidenceModes.correlations.short')}
            </Box>
          </ToggleButton>
          <ToggleButton value="events">
            <FileSearch2 size={16} aria-hidden="true" />
            <Box component="span" sx={{ ml: 0.75 }}>
              {t('auditControl.evidenceModes.events.short')}
            </Box>
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
      {mode === 'correlations' ? <AuditEventCorrelations /> : <AuditExplorer />}
    </>
  );
}
