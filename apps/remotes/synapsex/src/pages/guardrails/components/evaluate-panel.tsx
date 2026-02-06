/**
 * Evaluate test panel — Simulate if an action is allowed
 */

import type { FormEvent } from 'react';
import type { GuardrailEvaluateResponse } from '@dwp-frontend/shared-utils';

import { useState } from 'react';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { Label, Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InputLabel from '@mui/material/InputLabel';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';

type EvaluatePanelProps = {
  onEvaluate: (params: {
    caseType?: string;
    actionType?: string;
    amount?: number;
    currency?: string;
    bukrs?: string;
    partyId?: string;
  }) => void;
  result: GuardrailEvaluateResponse | null;
  isLoading?: boolean;
};

const CASE_TYPES = ['PAYMENT', 'REVERSAL', 'BLOCK', 'FLAG', 'CLEAR'];
const ACTION_TYPES = ['EXECUTE', 'APPROVE', 'REJECT', 'REQUEST'];

export const EvaluatePanel = ({ onEvaluate, result, isLoading }: EvaluatePanelProps) => {
  const { t } = useTranslation('common');
  const [caseType, setCaseType] = useState('');
  const [actionType, setActionType] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('KRW');
  const [bukrs, setBukrs] = useState('');
  const [partyId, setPartyId] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onEvaluate({
      caseType: caseType || undefined,
      actionType: actionType || undefined,
      amount: amount ? Number(amount) : undefined,
      currency: currency || undefined,
      bukrs: bukrs || undefined,
      partyId: partyId || undefined,
    });
  };

  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
          <Iconify icon="solar:test-tube-bold" width={20} sx={{ color: 'primary.main' }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {t('guardrails.evaluate')}
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          {t('guardrails.evaluateHint')}
        </Typography>
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>{t('guardrails.caseType')}</InputLabel>
                <Select
                  label={t('guardrails.caseType')}
                  value={caseType}
                  onChange={(e) => setCaseType(e.target.value)}
                >
                  <MenuItem value="">—</MenuItem>
                  {CASE_TYPES.map((ct) => (
                    <MenuItem key={ct} value={ct}>
                      {ct}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>{t('guardrails.actionType')}</InputLabel>
                <Select
                  label={t('guardrails.actionType')}
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                >
                  <MenuItem value="">—</MenuItem>
                  {ACTION_TYPES.map((at) => (
                    <MenuItem key={at} value={at}>
                      {at}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                size="small"
                label={t('guardrails.amount')}
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={t('guardrails.amountPlaceholder')}
                sx={{ minWidth: 140 }}
              />
              <TextField
                size="small"
                label={t('guardrails.currency')}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder="KRW"
                sx={{ minWidth: 100 }}
              />
              <TextField
                size="small"
                label={t('guardrails.company')}
                value={bukrs}
                onChange={(e) => setBukrs(e.target.value)}
                placeholder={t('guardrails.companyPlaceholder')}
                sx={{ minWidth: 100 }}
              />
              <TextField
                size="small"
                label={t('guardrails.partyId')}
                value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
                placeholder={t('guardrails.partyIdPlaceholder')}
                sx={{ flex: 1 }}
              />
            </Stack>
            <Button
              type="submit"
              variant="contained"
              disabled={isLoading}
              startIcon={<Iconify icon="solar:play-bold" width={18} />}
            >
              {isLoading ? t('guardrails.evaluating') : t('guardrails.evaluate')}
            </Button>
          </Stack>
        </Box>
        {result && (
          <Box
            sx={{
              mt: 2,
              p: 2,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1.5,
              bgcolor: result.allowed ? 'success.lighter' : 'error.lighter',
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              {result.allowed ? (
                <Label color="success" startIcon={<Iconify icon="solar:check-circle-bold" width={18} />}>
                  {t('guardrails.allowed')}
                </Label>
              ) : (
                <Label color="error" startIcon={<Iconify icon="solar:close-circle-bold" width={18} />}>
                  {t('guardrails.blocked')}
                </Label>
              )}
              {result.requiredApprovalLevel && (
                <Typography variant="caption" color="text.secondary">
                  {t('guardrails.required')}: {result.requiredApprovalLevel}
                </Typography>
              )}
            </Stack>
            {result.violatedRules && result.violatedRules.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                {t('guardrails.violated')}: {result.violatedRules.join(', ')}
              </Typography>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};
