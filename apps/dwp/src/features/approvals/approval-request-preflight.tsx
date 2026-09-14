import { useTranslation } from 'react-i18next';
import { CheckCircle2, CircleAlert, CircleDashed, GitBranch, ShieldCheck } from 'lucide-react';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ApprovalSurface } from './approval-ui';

import type { ApprovalFormField, ApprovalRequestTemplate } from '@dwp-frontend/shared-utils';

type ApprovalRequestPreflightProps = {
  template: ApprovalRequestTemplate;
  missingFields: readonly ApprovalFormField[];
  compact?: boolean;
  validation?: { ready: boolean; valid: boolean; missing: number; required: number };
};

export function ApprovalRequestPreflight({
  template,
  missingFields,
  compact = false,
  validation,
}: ApprovalRequestPreflightProps) {
  const { t, i18n } = useTranslation('approvals');
  const korean = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language) === 'ko';
  const valid = validation
    ? validation.ready && validation.valid && validation.missing === 0
    : missingFields.length === 0;
  const missing = validation?.missing ?? missingFields.length;

  return (
    <Stack gap={2}>
      <ApprovalSurface
        title={t('requests.route.title')}
        meta={t('requests.route.meta', { count: template.workflow.currentVersion })}
      >
        <Stack gap={1.25} sx={{ p: compact ? 1.5 : 2 }}>
          <Stack direction="row" gap={1} alignItems="center">
            <Box sx={{ color: 'primary.main', display: 'flex' }}>
              <GitBranch size={19} aria-hidden="true" />
            </Box>
            <Typography component="p" variant="subtitle2">
              {korean ? template.workflow.nameKo : template.workflow.nameEn}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {korean ? template.workflow.descriptionKo : template.workflow.descriptionEn}
          </Typography>
          <Stack direction="row" gap={0.75} useFlexGap flexWrap="wrap">
            <Chip size="small" variant="outlined" label={template.workflow.category} />
            <Chip size="small" variant="outlined" label={template.workflow.dataClassification} />
            <Chip
              size="small"
              variant={valid ? 'filled' : 'outlined'}
              color={valid ? 'success' : 'warning'}
              icon={valid ? <CheckCircle2 size={14} /> : <CircleAlert size={14} />}
              label={
                validation
                  ? !valid && missing === 0
                    ? t(
                        validation.ready
                          ? 'requests.typed.inputInvalid'
                          : 'requests.typed.schemaLoading'
                      )
                    : t('requests.drafts.fieldCompletion', {
                        completed: Math.max(0, validation.required - missing),
                        total: validation.required,
                      })
                  : t('requests.template.fieldCount', { count: missing })
              }
            />
          </Stack>
          <Box
            component="ol"
            aria-label={t('requests.route.steps')}
            sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 0.75 }}
          >
            {template.routeDefinition.steps.map((step, index) => (
              <Stack
                component="li"
                key={step.key}
                direction="row"
                gap={1}
                alignItems="center"
                sx={{ minHeight: 48, px: 1.25, border: 1, borderColor: 'divider' }}
              >
                <Box
                  aria-hidden="true"
                  sx={{
                    width: 24,
                    height: 24,
                    flex: '0 0 auto',
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: 'primary.lighter',
                    color: 'primary.dark',
                  }}
                >
                  <Typography component="span" variant="caption">
                    {index + 1}
                  </Typography>
                </Box>
                <Box minWidth={0} flex={1}>
                  <Typography component="p" variant="subtitle2">
                    {step.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {t('requests.route.stepMeta', {
                      role: step.candidateRole,
                      minutes: step.slaMinutes,
                    })}
                  </Typography>
                </Box>
              </Stack>
            ))}
          </Box>
        </Stack>
      </ApprovalSurface>

      <Box
        component="section"
        sx={{ border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
      >
        <Stack direction="row" gap={1} alignItems="center" sx={{ p: 2 }}>
          <Box sx={{ color: 'primary.main', display: 'flex' }}>
            <ShieldCheck size={20} aria-hidden="true" />
          </Box>
          <Box minWidth={0}>
            <Typography component="h3" variant="subtitle2">
              {t('requests.assurance.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('requests.assurance.description')}
            </Typography>
          </Box>
        </Stack>
        <Divider />
        <Stack
          data-testid="approval-request-server-safeguards"
          gap={1}
          sx={{ p: 2, color: 'text.secondary' }}
        >
          {['identity', 'policy', 'evidence', 'concurrency'].map((key) => (
            <Stack key={key} direction="row" gap={1} alignItems="flex-start">
              <Box sx={{ color: 'text.secondary', display: 'flex', mt: 0.25 }}>
                <CircleDashed size={15} aria-hidden="true" />
              </Box>
              <Typography variant="caption" color="inherit">
                {t(`requests.assurance.${key}`)}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}
