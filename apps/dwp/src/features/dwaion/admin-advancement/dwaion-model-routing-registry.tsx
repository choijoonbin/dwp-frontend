import { LockKeyhole, Route, ShieldCheck } from 'lucide-react';
import { foundationTokens } from '@dwp-frontend/design-system';
import { formatNumber } from '@dwp-frontend/shared-i18n';
import type { DwaionModelsRoutingSnapshot } from '@dwp-frontend/shared-utils';
import type { ReactNode } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DwaionAdminSection, DwaionHealthChip } from './dwaion-admin-advancement-ui';
import { useDwaionAdminAdvancementCopy } from './dwaion-admin-advancement-copy';

export function DwaionModelRoutingRegistry({ data }: { data: DwaionModelsRoutingSnapshot }) {
  const copy = useDwaionAdminAdvancementCopy();
  const providerById = new Map(data.providers.map((provider) => [provider.providerId, provider]));
  const modelById = new Map(data.models.map((model) => [model.modelId, model]));
  return (
    <Stack spacing={2}>
      <DwaionAdminSection
        title={copy.ui.modelRegistry.providerRegistryTitle}
        description={copy.ui.modelRegistry.providerRegistryDescription}
      >
        <Box
          role="table"
          aria-label={copy.ui.modelRegistry.providerRegistryLabel}
          sx={{ minWidth: 0 }}
        >
          <Box
            role="row"
            sx={{
              display: { xs: 'none', lg: 'grid' },
              gridTemplateColumns: '1.25fr 1fr 1fr 1.2fr 1fr 0.9fr',
              gap: 1.25,
              px: 2,
              py: 1,
              bgcolor: 'action.hover',
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            {[
              copy.ui.modelRegistry.providerModel,
              copy.ui.modelRegistry.modalityLimit,
              copy.ui.modelRegistry.allowedData,
              copy.ui.modelRegistry.governanceRegion,
              copy.ui.modelRegistry.credential,
              copy.ui.modelRegistry.runtime,
            ].map((label) => (
              <Typography key={label} role="columnheader" variant="caption" fontWeight={700}>
                {label}
              </Typography>
            ))}
          </Box>
          <Stack role="rowgroup">
            {data.models.map((model, index) => {
              const provider = providerById.get(model.providerId);
              return (
                <Box
                  role="row"
                  key={model.modelId}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'minmax(0,1fr)',
                      sm: 'repeat(2,minmax(0,1fr))',
                      lg: '1.25fr 1fr 1fr 1.2fr 1fr 0.9fr',
                    },
                    gap: 1.25,
                    px: 2,
                    py: 1.5,
                    borderTop: index ? 1 : 0,
                    borderColor: 'divider',
                  }}
                >
                  <RegistryCell label={copy.ui.modelRegistry.providerModel}>
                    <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
                      {provider?.name ?? model.providerId}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {model.displayName} · {model.lifecycle}
                    </Typography>
                  </RegistryCell>
                  <RegistryCell label={copy.ui.modelRegistry.modalityLimit}>
                    <Typography variant="body2">{model.modalities.join(' · ')}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {model.contextWindow == null ? '—' : formatNumber(model.contextWindow)}{' '}
                      {copy.ui.modelRegistry.contextUnit}
                    </Typography>
                  </RegistryCell>
                  <RegistryCell label={copy.ui.modelRegistry.allowedData}>
                    <Stack direction="row" gap={0.5} flexWrap="wrap">
                      {model.allowedDataClassifications.map((classification) => (
                        <Chip key={classification} size="small" label={classification} />
                      ))}
                    </Stack>
                  </RegistryCell>
                  <RegistryCell label={copy.ui.modelRegistry.governanceRegion}>
                    <Typography variant="body2">{model.governancePolicy}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {model.region}
                    </Typography>
                  </RegistryCell>
                  <RegistryCell label={copy.ui.modelRegistry.credential}>
                    <Stack direction="row" gap={0.75} alignItems="center">
                      <LockKeyhole size={15} aria-hidden="true" />
                      <Typography variant="body2">{model.credentialState}</Typography>
                    </Stack>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ overflowWrap: 'anywhere' }}
                    >
                      {model.credentialRef}
                    </Typography>
                  </RegistryCell>
                  <RegistryCell label={copy.ui.modelRegistry.runtime}>
                    <DwaionHealthChip health={provider?.health ?? 'UNKNOWN'} />
                    <Typography variant="caption" color="text.secondary">
                      {provider?.latencyP95Ms == null ? 'P95 —' : `P95 ${provider.latencyP95Ms}ms`}
                    </Typography>
                  </RegistryCell>
                </Box>
              );
            })}
          </Stack>
        </Box>
      </DwaionAdminSection>

      <DwaionAdminSection
        title={copy.ui.modelRegistry.routingMatrixTitle}
        description={copy.ui.modelRegistry.routingMatrixDescription}
      >
        <Stack divider={<Divider flexItem />}>
          {data.routingRules.map((rule, index) => {
            const primary = modelById.get(rule.primaryModelId);
            return (
              <Stack
                key={rule.ruleId}
                direction={{ xs: 'column', md: 'row' }}
                justifyContent="space-between"
                gap={1.5}
                sx={{ px: 2, py: 1.5 }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                    <Typography
                      variant="caption"
                      fontWeight={800}
                      sx={{
                        width: 26,
                        height: 26,
                        borderRadius: `${foundationTokens.radius.control}px`,
                        bgcolor: rule.failClosed ? 'error.main' : 'action.selected',
                        color: rule.failClosed ? 'error.contrastText' : 'text.primary',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      {String(index + 1).padStart(2, '0')}
                    </Typography>
                    <Typography variant="subtitle2">{rule.name}</Typography>
                    <Chip size="small" variant="outlined" label={rule.taskType} />
                    {rule.failClosed && (
                      <Chip size="small" color="error" label={copy.ui.modelRegistry.failClosed} />
                    )}
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                    {rule.conditions.join(' · ')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {rule.allowedDataClassifications.join(' · ')} {copy.ui.common.versionSeparator}
                    {rule.version}
                  </Typography>
                </Box>
                <Stack
                  direction="row"
                  gap={1}
                  alignItems="center"
                  sx={{ minWidth: 0, flexShrink: 0 }}
                >
                  <ShieldCheck size={16} aria-hidden="true" />
                  <Typography variant="body2" fontWeight={700}>
                    {primary?.displayName ?? rule.primaryModelId}
                  </Typography>
                  <Route size={15} aria-hidden="true" />
                  <Typography
                    variant="caption"
                    color={rule.failClosed ? 'error' : 'text.secondary'}
                  >
                    {rule.fallbackModelIds.length
                      ? rule.fallbackModelIds
                          .map((id) => modelById.get(id)?.displayName ?? id)
                          .join(' → ')
                      : 'No external fallback'}
                  </Typography>
                </Stack>
              </Stack>
            );
          })}
        </Stack>
      </DwaionAdminSection>
    </Stack>
  );
}

function RegistryCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack role="cell" spacing={0.35} sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: { lg: 'none' } }}>
        {label}
      </Typography>
      {children}
    </Stack>
  );
}
