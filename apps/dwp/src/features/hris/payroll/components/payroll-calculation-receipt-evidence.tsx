import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';

import type { PayrollCalculationReceipt } from '../model/payroll-calculation-contract';
import type { PayrollCalculationCopy } from '../model/payroll-calculation-copy';

export function PayrollCalculationReceiptEvidence({
  receipts,
  copy,
}: Readonly<{
  receipts: readonly PayrollCalculationReceipt[];
  copy: PayrollCalculationCopy;
}>) {
  const { t } = useTranslation('hcm');
  return (
    <Paper component="section" variant="outlined" sx={{ p: 2, minWidth: 0 }}>
      <Typography component="h2" variant="h6">
        {copy.receipts}
      </Typography>
      {receipts.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {copy.noReceipts}
        </Typography>
      ) : (
        <Stack component="ol" gap={1} sx={{ listStyle: 'none', p: 0, m: 0, mt: 1.5 }}>
          {receipts.map((receipt) => (
            <Paper component="li" key={receipt.receiptId} variant="outlined" sx={{ p: 1.5 }}>
              <Stack gap={0.75}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  gap={1}
                  alignItems="flex-start"
                >
                  <Box minWidth={0}>
                    <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
                      {copy.receipt}: {receipt.receiptId}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {copy.command}: {receipt.originatingAction}
                    </Typography>
                  </Box>
                  <Chip size="small" label={receipt.status} />
                </Stack>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  {copy.created}: {receipt.createdAt} · {copy.resultReference}:{' '}
                  {receipt.resultRef ?? '—'}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  {t('hrisPayroll.calculationReceipt.requestPopulation', {
                    requestDigest: receipt.requestDigest,
                    populationDigest: receipt.populationScopeDigest,
                    defaultValue: 'Request {{requestDigest}} · Population {{populationDigest}}',
                  })}
                </Typography>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </Paper>
  );
}
