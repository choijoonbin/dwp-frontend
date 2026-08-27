import { useDeferredValue, useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Accessibility, Code2, Database, Gauge, Search, ShieldCheck } from 'lucide-react';
import { ActionButton, EmptyState, FormField } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  WORKSPACE_WIDGET_CATALOG,
  type WorkspaceWidgetCatalogDefinition,
} from '../../components/workspace-composer/workspace-widget-catalog';

function EvidenceField({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        component="code"
        variant="body2"
        sx={{ mt: 0.25, display: 'block', overflowWrap: 'anywhere' }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function revealStackedCatalogDetail(detailPanelId: string, detailHeadingId: string) {
  if (!window.matchMedia('(max-width: 899.95px)').matches) return;
  window.requestAnimationFrame(() => {
    const detail = document.getElementById(detailPanelId);
    const heading = document.getElementById(detailHeadingId);
    heading?.focus({ preventScroll: true });
    detail?.scrollIntoView({ behavior: 'auto', block: 'start' });
  });
}

export function ProviderWidgetCatalog({
  onOpenCodeContracts,
}: {
  onOpenCodeContracts: () => void;
}) {
  const { t } = useTranslation('provider');
  const { t: homeT } = useTranslation('home');
  const navigate = useNavigate();
  const detailPanelId = useId();
  const detailHeadingId = `${detailPanelId}-heading`;
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string>(WORKSPACE_WIDGET_CATALOG[0]?.key ?? '');
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const definitions = useMemo(
    () =>
      WORKSPACE_WIDGET_CATALOG.filter((definition) => {
        if (!deferredQuery) return true;
        return [
          definition.key,
          definition.ownerProduct,
          definition.sourceAppResourceKey,
          definition.dataSource,
          homeT(`widgets.registry.${definition.key}.label`),
        ]
          .join(' ')
          .toLowerCase()
          .includes(deferredQuery);
      }),
    [deferredQuery, homeT]
  );

  useEffect(() => {
    if (definitions.some((definition) => definition.key === selectedKey)) return;
    setSelectedKey(definitions[0]?.key ?? '');
  }, [definitions, selectedKey]);

  const selected = definitions.find((definition) => definition.key === selectedKey) ?? null;

  return (
    <Stack gap={2.5}>
      <Alert severity="info" icon={<ShieldCheck size={19} />}>
        <Typography variant="subtitle2">{t('widgetCatalog.governance.title')}</Typography>
        <Typography variant="body2">{t('widgetCatalog.governance.description')}</Typography>
      </Alert>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        gap={1.5}
      >
        <FormField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          label={t('widgetCatalog.search.label')}
          placeholder={t('widgetCatalog.search.placeholder')}
          sx={{ maxWidth: { sm: 420 } }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={17} aria-hidden="true" />
                </InputAdornment>
              ),
            },
          }}
        />
        <Stack direction="row" gap={0.75} flexWrap="wrap">
          <ActionButton intent="secondary" onClick={onOpenCodeContracts}>
            {t('widgetCatalog.actions.codeContract')}
          </ActionButton>
          <ActionButton intent="quiet" onClick={() => navigate('/provider/feature-rollouts')}>
            {t('widgetCatalog.actions.rollouts')}
          </ActionButton>
        </Stack>
      </Stack>

      <Typography variant="body2" color="text.secondary" aria-live="polite">
        {t('widgetCatalog.search.results', { count: definitions.length })}
      </Typography>

      {definitions.length === 0 ? (
        <EmptyState
          icon={<Search size={28} />}
          title={t('widgetCatalog.search.empty')}
          description={t('widgetCatalog.search.emptyDescription')}
          size="standard"
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '340px minmax(0, 1fr)' },
            borderBlock: 1,
            borderColor: 'divider',
          }}
        >
          <List
            disablePadding
            aria-label={t('widgetCatalog.listLabel')}
            sx={{ borderInlineEnd: { md: 1 }, borderColor: 'divider' }}
          >
            {definitions.map((definition) => (
              <ListItem key={definition.key} disablePadding>
                <ListItemButton
                  selected={definition.key === selected?.key}
                  aria-current={definition.key === selected?.key ? 'true' : undefined}
                  aria-controls={detailPanelId}
                  onClick={() => {
                    setSelectedKey(definition.key);
                    revealStackedCatalogDetail(detailPanelId, detailHeadingId);
                  }}
                  sx={{ minHeight: 76, borderBottom: 1, borderColor: 'divider' }}
                >
                  <ListItemText
                    primary={homeT(`widgets.registry.${definition.key}.label`)}
                    secondary={`${definition.ownerProduct} · ${definition.dataSource}`}
                    primaryTypographyProps={{ variant: 'subtitle2' }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={t(`widgetCatalog.states.${definition.lifecycle}`)}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          {selected && (
            <ProviderWidgetDefinitionDetail
              detailId={detailPanelId}
              headingId={detailHeadingId}
              definition={selected}
              label={homeT(`widgets.registry.${selected.key}.label`)}
              description={homeT(`widgets.registry.${selected.key}.description`)}
            />
          )}
        </Box>
      )}
    </Stack>
  );
}

function ProviderWidgetDefinitionDetail({
  detailId,
  headingId,
  definition,
  label,
  description,
}: {
  detailId: string;
  headingId: string;
  definition: WorkspaceWidgetCatalogDefinition;
  label: string;
  description: string;
}) {
  const { t } = useTranslation('provider');
  const certification = [
    { key: 'manifest', icon: Code2 },
    { key: 'data', icon: Database },
    { key: 'accessibility', icon: Accessibility },
    { key: 'performance', icon: Gauge },
  ] as const;

  return (
    <Stack
      id={detailId}
      role="region"
      aria-labelledby={headingId}
      gap={2.5}
      sx={{ minWidth: 0, p: { xs: 2, sm: 3 } }}
    >
      <Box>
        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
          <Typography id={headingId} component="h2" variant="h6" tabIndex={-1}>
            {label}
          </Typography>
          <Chip
            size="small"
            icon={<Code2 size={14} />}
            label={t('widgetCatalog.certified')}
            variant="outlined"
          />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {description}
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: 2,
        }}
      >
        <EvidenceField label={t('widgetCatalog.fields.key')} value={definition.key} />
        <EvidenceField label={t('widgetCatalog.fields.owner')} value={definition.ownerProduct} />
        <EvidenceField
          label={t('widgetCatalog.fields.sourceApp')}
          value={definition.sourceAppResourceKey}
        />
        <EvidenceField label={t('widgetCatalog.fields.dataSource')} value={definition.dataSource} />
        <EvidenceField
          label={t('widgetCatalog.fields.analytics')}
          value={definition.analyticsKey}
        />
        <EvidenceField
          label={t('widgetCatalog.fields.manifestVersion')}
          value={String(definition.manifestVersion)}
        />
      </Box>

      <Divider />

      <Box>
        <Typography variant="subtitle2">{t('widgetCatalog.contract.title')}</Typography>
        <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1 }}>
          <Chip size="small" label={t(`widgetCatalog.runtime.${definition.runtime}`)} />
          <Chip size="small" label={t(`widgetCatalog.privacy.${definition.privacyClass}`)} />
          <Chip
            size="small"
            label={t('widgetCatalog.contract.freshness', {
              seconds: definition.freshnessSeconds,
            })}
          />
          <Chip size="small" label={t(`widgetCatalog.policyClass.${definition.policyClass}`)} />
        </Stack>
      </Box>

      <Box>
        <Typography variant="subtitle2">{t('widgetCatalog.certification.title')}</Typography>
        <List disablePadding sx={{ mt: 0.5 }}>
          {certification.map(({ key, icon: Icon }) => (
            <ListItem key={key} disableGutters sx={{ py: 0.75 }}>
              <ListItemIcon sx={{ minWidth: 34, color: 'text.secondary' }}>
                <Icon size={17} aria-hidden="true" />
              </ListItemIcon>
              <ListItemText
                primary={t(`widgetCatalog.certification.${key}.title`)}
                secondary={t(`widgetCatalog.certification.${key}.description`)}
                primaryTypographyProps={{ variant: 'subtitle2' }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItem>
          ))}
        </List>
      </Box>

      <Alert severity="warning">
        <Typography variant="subtitle2">{t('widgetCatalog.revocation.title')}</Typography>
        <Typography variant="body2">{t('widgetCatalog.revocation.description')}</Typography>
      </Alert>
    </Stack>
  );
}
