import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useMyVouchersListQuery } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import TableContainer from '@mui/material/TableContainer';

import { SYNAPSE_ROUTES } from '../../routes';
import { TableLoadingSkeleton } from '../../components/ux/table-loading-skeleton';
import {
  toUpperStatus,
  type VoucherRow,
  auraResultFromRow,
  evidenceStatusFromRow,
  mapMyVoucherListItems,
} from './my-audit-voucher.utils';

type MyAuditTab = 'all' | 'inbox';

type MyAuditExpensesPageProps = {
  initialTab?: MyAuditTab;
};

const PAGE_SIZE = 20;

export const MyAuditExpensesPage = ({ initialTab = 'all' }: MyAuditExpensesPageProps) => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [activeTab, setActiveTab] = useState<MyAuditTab>(initialTab);

  const query = useMyVouchersListQuery({
    statusFilter: activeTab === 'inbox' ? 'PENDING_EXPLANATION' : 'ALL',
    page,
    size: PAGE_SIZE,
    sort: 'postingDate,desc',
  });

  const { allRows, inboxRows, totalPages } = useMemo(() => {
    const raw = query.data?.content ?? [];
    const mapped: VoucherRow[] = mapMyVoucherListItems(raw);
    const inbox = mapped.filter((row) => toUpperStatus(row.caseStatus) === 'PENDING_EXPLANATION');
    return {
      allRows: mapped,
      inboxRows: inbox,
      totalPages: query.data?.totalPages ?? 1,
    };
  }, [query.data]);

  const rows = activeTab === 'all' ? allRows : inboxRows;

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {t('myAudit.expenses.title', '나의 전표 현황')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('myAudit.expenses.subtitle', '내 전표와 Aura 스크리닝 결과를 확인하고 필요한 소명을 진행합니다.')}
          </Typography>
        </Box>

        <Card variant="outlined">
          <CardContent>
            <Tabs
              value={activeTab}
              onChange={(_, v) => {
                setActiveTab(v);
                setPage(0);
              }}
              sx={{ mb: 1.5 }}
            >
              <Tab value="all" label={t('myAudit.expenses.allVouchers', '나의 모든 전표')} />
              <Tab value="inbox" label={t('myAudit.expenses.inbox', '소명 대기함')} />
            </Tabs>

            {activeTab === 'inbox' && (
              <Alert severity={inboxRows.length > 0 ? 'warning' : 'info'} sx={{ mb: 1.5 }}>
                {inboxRows.length > 0
                  ? `현재 소명이 필요한 전표가 ${inboxRows.length}건 있습니다.`
                  : '현재 소명이 필요한 전표가 없습니다.'}
              </Alert>
            )}

            {query.isLoading ? (
              <TableLoadingSkeleton rows={6} columns={8} />
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('myAudit.expenses.voucherNo', '전표번호')}</TableCell>
                      <TableCell>{t('myAudit.expenses.merchant', '가맹점')}</TableCell>
                      <TableCell>{t('myAudit.expenses.amount', '금액')}</TableCell>
                      <TableCell>{t('myAudit.expenses.evidenceStatus', '증빙상태')}</TableCell>
                      <TableCell>{t('myAudit.expenses.auraResult', 'Aura 스크리닝 결과')}</TableCell>
                      <TableCell>{t('myAudit.expenses.postingDate', '전표발생일자')}</TableCell>
                      <TableCell>{t('cases.lastDetected', 'Detected')}</TableCell>
                      <TableCell align="right">{t('commonLabels.actions', 'Actions')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                          <Typography variant="body2" color="text.secondary">
                            {activeTab === 'inbox'
                              ? t('myAudit.expenses.inboxEmpty', '소명 대기 전표가 없습니다.')
                              : t('myAudit.expenses.empty', '표시할 전표가 없습니다.')}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((row) => {
                        const aura = auraResultFromRow(row);
                        const isPending = toUpperStatus(row.caseStatus) === 'PENDING_EXPLANATION';
                        const hasCase = Boolean(row.id);
                        const docDetailPath = `${SYNAPSE_ROUTES.DOCUMENTS}/${row.bukrs}/${row.belnr}/${row.gjahr}`;
                        return (
                          <TableRow key={`${row.bukrs}-${row.belnr}-${row.gjahr}-${row.id || 'no-case'}`} hover>
                            <TableCell sx={{ fontFamily: 'monospace' }}>{row.belnr || '-'}</TableCell>
                            <TableCell>{row.bktxt || '-'}</TableCell>
                            <TableCell>{`${row.wrbtr.toLocaleString()} ${row.waers}`}</TableCell>
                            <TableCell>{evidenceStatusFromRow(row)}</TableCell>
                            <TableCell>
                              <Chip size="small" color={aura.color} label={aura.label} />
                            </TableCell>
                            <TableCell>{row.postingDate ? new Date(row.postingDate).toLocaleDateString() : '-'}</TableCell>
                            <TableCell>{row.detectedAt ? new Date(row.detectedAt).toLocaleString() : '-'}</TableCell>
                            <TableCell align="right">
                              <Button
                                size="small"
                                variant="text"
                                onClick={() =>
                                  hasCase
                                    ? navigate(SYNAPSE_ROUTES.MY_AUDIT_CASE_DETAIL.replace(':id', row.id))
                                    : navigate(docDetailPath)
                                }
                              >
                                {hasCase ? (isPending ? '소명하기' : t('commonLabels.view', 'View')) : '전표보기'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 2 }}>
              <Button size="small" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page <= 0}>
                {t('commonLabels.previous', 'Previous')}
              </Button>
              <Typography variant="caption" sx={{ alignSelf: 'center', minWidth: 80, textAlign: 'center' }}>
                {page + 1} / {totalPages}
              </Typography>
              <Button size="small" onClick={() => setPage((p) => p + 1)} disabled={page + 1 >= totalPages}>
                {t('commonLabels.next', 'Next')}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
};
