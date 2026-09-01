import { useTranslation } from 'react-i18next';
import { CircleGauge, Database, Pencil, ShieldCheck } from 'lucide-react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';

import { OperationalMetric } from './reference-data-metrics';

export type ReferenceDataCatalogSummary = {
  catalogs: number;
  values: number;
  active: number;
  draft: number;
};

type ReferenceDataOverviewProps = {
  summary: ReferenceDataCatalogSummary;
};

export function ReferenceDataOverview({ summary }: ReferenceDataOverviewProps) {
  const { t } = useTranslation('admin');
  const theme = useTheme();

  return (
    <Box
      component="section"
      aria-label={t('referenceData.overview.title')}
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: '1.4fr repeat(4, minmax(120px, 1fr))' },
        borderTop: 1,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Box
            sx={{
              width: 34,
              height: 34,
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: 'primary.main',
              borderRadius: 1,
            }}
          >
            <Database size={19} strokeWidth={1.8} aria-hidden="true" />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography component="h2" variant="subtitle1" fontWeight={700}>
              {t('referenceData.overview.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('referenceData.overview.description')}
            </Typography>
          </Box>
        </Stack>
      </Box>
      <OperationalMetric
        icon={<Database size={15} strokeWidth={1.8} />}
        label={t('referenceData.overview.catalogs')}
        value={summary.catalogs}
        detail={t('referenceData.overview.catalogsDetail')}
      />
      <OperationalMetric
        icon={<CircleGauge size={15} strokeWidth={1.8} />}
        label={t('referenceData.overview.values')}
        value={summary.values}
        detail={t('referenceData.overview.valuesDetail')}
      />
      <OperationalMetric
        icon={<ShieldCheck size={15} strokeWidth={1.8} />}
        label={t('referenceData.overview.published')}
        value={summary.active}
        detail={t('referenceData.overview.publishedDetail')}
      />
      <OperationalMetric
        icon={<Pencil size={15} strokeWidth={1.8} />}
        label={t('referenceData.overview.drafts')}
        value={summary.draft}
        detail={t('referenceData.overview.draftsDetail')}
      />
    </Box>
  );
}
