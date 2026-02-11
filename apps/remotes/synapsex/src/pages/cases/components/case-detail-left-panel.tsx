/**
 * Case Detail Left Panel — Source Evidence, Document Relationship, FI Doc, Open Items, Lineage
 */

import { Link, useNavigate } from 'react-router-dom';
import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import { alpha, useTheme } from '@mui/material/styles';

import { SYNAPSE_ROUTES } from '../../../routes';
import { CaseLineItemsCard } from './case-line-items-card';

import type { FiDocItem } from '../hooks/use-case-detail';
import type { CaseDetailUi } from '../adapters/case-detail-adapter';

export type DocRelationshipItem = {
  id: string;
  type: 'original' | 'reversal';
  number: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
};

export type FiDocSummary = {
  bukrs?: string;
  belnr: string;
  gjahr?: string;
  id: string;
  budat?: string;
  wrbtr?: number;
  waers?: string;
  counterpartyId?: string;
  counterpartyDisplay?: string;
};

export type CaseDetailLeftPanelProps = {
  caseData: CaseDetailUi;
  fiDoc: FiDocSummary | null;
  fiDocItems: FiDocItem[];
  lineCount?: number;
  targetBuzei?: string;
  documentRelationship: DocRelationshipItem[];
};

export const CaseDetailLeftPanel = ({
  caseData,
  fiDoc,
  fiDocItems,
  lineCount,
  targetBuzei,
  documentRelationship,
}: CaseDetailLeftPanelProps) => {
  const { t } = useTranslation('common');
  const theme = useTheme();
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        width: { xs: '100%', lg: 360 },
        minWidth: 0,
        flexShrink: 0,
        borderRight: { lg: 1 },
        borderBottom: { xs: 1, lg: 0 },
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          px: { xs: 1, sm: 2 },
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: alpha(theme.palette.primary.main, 0.04),
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Iconify icon="solar:document-text-bold-duotone" width={18} />
          <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
            {t('caseDetail.sourceEvidence')}
          </Typography>
        </Stack>
      </Box>
      <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 1, sm: 2 }, minWidth: 0 }}>
        <Stack spacing={2}>
          <Card sx={{ width: '100%' }}>
            <CardContent sx={{ px: { xs: 1.5, sm: 2 }, py: { xs: 1.5, sm: 2 } }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {t('caseDetail.documentRelationship')}
              </Typography>
              <Stack spacing={1}>
                {documentRelationship.map((doc) => (
                  <Box
                    key={doc.id}
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: alpha(theme.palette.primary.main, doc.type === 'original' ? 0.08 : 0.04),
                      border: 1,
                      borderColor: doc.type === 'original' ? 'primary.main' : 'divider',
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                      <Chip
                        label={doc.type === 'original' ? t('caseDetail.original') : t('caseDetail.reversal')}
                        size="small"
                        color={doc.type === 'original' ? 'primary' : 'default'}
                      />
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {doc.number}
                      </Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {doc.date} • {doc.amount.toLocaleString()} {doc.currency} • {doc.status}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>

          <Card
            {...(fiDoc &&
              fiDoc.bukrs &&
              fiDoc.belnr &&
              fiDoc.gjahr && {
                component: 'div',
                role: 'button',
                tabIndex: 0,
                onClick: () =>
                  navigate(`${SYNAPSE_ROUTES.DOCUMENTS}/${fiDoc.bukrs}/${fiDoc.belnr}/${fiDoc.gjahr}`),
                onKeyDown: (e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`${SYNAPSE_ROUTES.DOCUMENTS}/${fiDoc.bukrs}/${fiDoc.belnr}/${fiDoc.gjahr}`);
                  }
                },
                sx: {
                  cursor: 'pointer',
                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                  transition: 'background-color 0.2s',
                },
              })}
          >
            <CardHeader
              title={
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                  <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
                    {t('caseDetail.fiDocument')}
                  </Typography>
                  <Chip label="KR" size="small" variant="outlined" />
                </Stack>
              }
              sx={{ pb: 1, px: 2, pt: 2 }}
            />
            <CardContent sx={{ px: 2, pt: 0, pb: 2 }}>
              <Stack spacing={1.5}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('caseDetail.docNumber')}
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
                      {fiDoc?.belnr || 'N/A'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('caseDetail.date')}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {fiDoc?.budat || 'N/A'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('caseDetail.amount')}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {fiDoc?.wrbtr?.toLocaleString() || '0'} {fiDoc?.waers || 'USD'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('caseDetail.vendor')}
                    </Typography>
                    {(() => {
                      const display =
                        fiDoc?.counterpartyDisplay ?? (fiDoc as { counterpartyId?: string })?.counterpartyId;
                      const entityId = fiDoc?.counterpartyId;
                      return entityId ? (
                        <Typography
                          component={Link}
                          to={`${SYNAPSE_ROUTES.ENTITIES}/${entityId}`}
                          variant="body2"
                          onClick={(e) => e.stopPropagation()}
                          sx={{
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            color: 'primary.main',
                            '&:hover': { textDecoration: 'underline' },
                          }}
                        >
                          {display || t('caseDetail.viewEntity')}
                        </Typography>
                      ) : (
                        <Typography variant="body2" sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {display || 'N/A'}
                        </Typography>
                      );
                    })()}
                  </Box>
                </Box>
                <Divider />
                <CaseLineItemsCard items={fiDocItems} lineCount={lineCount} targetBuzei={targetBuzei} />
              </Stack>
            </CardContent>
          </Card>

          <Card
            component={Link}
            to={(() => {
              const params = new URLSearchParams();
              params.set('related', 'true');
              params.set('caseId', caseData.id);
              if (fiDoc?.bukrs) params.set('bukrs', fiDoc.bukrs);
              if (fiDoc?.belnr) params.set('belnr', fiDoc.belnr);
              if (fiDoc?.gjahr) params.set('gjahr', fiDoc.gjahr);
              return `${SYNAPSE_ROUTES.OPEN_ITEMS}?${params.toString()}`;
            })()}
            sx={{
              textDecoration: 'none',
              cursor: 'pointer',
              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
              transition: 'background-color 0.2s',
            }}
          >
            <CardHeader
              title={
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                  <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
                    {t('caseDetail.relatedOpenItems')}
                  </Typography>
                  <Iconify icon="solar:alt-arrow-right-bold-duotone" width={16} />
                </Stack>
              }
              sx={{ pb: 1, px: 2, pt: 2 }}
            />
            <CardContent sx={{ px: 2, pt: 0, pb: 2 }}>
              <Typography variant="caption" color="text.secondary">
                {t('caseDetail.relatedOpenItemsDesc')}
              </Typography>
            </CardContent>
          </Card>

          <Card
            component={Link}
            to={(() => {
              const params = new URLSearchParams();
              params.set('caseId', caseData.id);
              if (fiDoc?.bukrs && fiDoc?.belnr && fiDoc?.gjahr) {
                params.set('docKey', `${fiDoc.bukrs}-${fiDoc.belnr}-${fiDoc.gjahr}`);
              }
              return `${SYNAPSE_ROUTES.LINEAGE}?${params.toString()}`;
            })()}
            sx={{
              textDecoration: 'none',
              cursor: 'pointer',
              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
              transition: 'background-color 0.2s',
            }}
          >
            <CardContent sx={{ p: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={1} alignItems="center">
                  <Iconify icon="solar:history-bold-duotone" width={18} />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {t('caseDetail.viewDataLineage')}
                  </Typography>
                </Stack>
                <Iconify icon="solar:alt-arrow-right-bold-duotone" width={18} />
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </Box>
  );
};
