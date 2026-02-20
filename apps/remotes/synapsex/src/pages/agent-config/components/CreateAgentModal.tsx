/**
 * 에이전트 등록 모달. POST /api/synapse/agents
 * domain/modelName = app_codes (catalog.domains, catalog.models key)
 */

import type { CreateAgentRequest } from '@dwp-frontend/shared-utils';

import { useState, useCallback } from 'react';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import InputLabel from '@mui/material/InputLabel';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

const AGENT_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

type CreateAgentModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateAgentRequest) => Promise<{ id: string }>;
  domains: { key: string; label: string }[];
  models: { key: string; label: string }[];
};

export const CreateAgentModal = ({
  open,
  onClose,
  onSubmit,
  domains,
  models,
}: CreateAgentModalProps) => {
  const { t } = useTranslation('common');
  const [name, setName] = useState('');
  const [agentKey, setAgentKey] = useState('');
  const [domainKey, setDomainKey] = useState('');
  const [modelName, setModelName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    if (!submitting) {
      setName('');
      setAgentKey('');
      setDomainKey('');
      setModelName('');
      setError(null);
      onClose();
    }
  }, [onClose, submitting]);

  const handleSubmit = useCallback(async () => {
    setError(null);
    const trimmedName = name.trim();
    const trimmedKey = agentKey.trim();
    if (!trimmedName) {
      setError(t('agentConfig.createErrorNameRequired'));
      return;
    }
    if (!trimmedKey) {
      setError(t('agentConfig.createErrorAgentKeyRequired'));
      return;
    }
    if (!AGENT_KEY_PATTERN.test(trimmedKey)) {
      setError(t('agentConfig.createErrorAgentKeyFormat'));
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        agentKey: trimmedKey,
        name: trimmedName,
        ...(domainKey && { domain: domainKey }),
        ...(modelName && { modelName }),
        temperature: 0,
      });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('agentConfig.createError'));
    } finally {
      setSubmitting(false);
    }
  }, [name, agentKey, domainKey, modelName, onSubmit, handleClose, t]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('agentConfig.createTitle')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            fullWidth
            required
            id="create-agent-name"
            name="agentName"
            label={t('agentConfig.createName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('agentConfig.createNamePlaceholder')}
          />
          <TextField
            fullWidth
            required
            id="create-agent-key"
            name="agentKey"
            label={t('agentConfig.createAgentKey')}
            value={agentKey}
            onChange={(e) => setAgentKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            placeholder={t('agentConfig.createAgentKeyPlaceholder')}
            helperText={t('agentConfig.createAgentKeyHint')}
          />
          {domains.length > 0 && (
            <FormControl fullWidth>
              <InputLabel id="create-agent-domain-label">{t('agentConfig.createDomain')}</InputLabel>
              <Select
                id="create-agent-domain"
                labelId="create-agent-domain-label"
                value={domainKey}
                label={t('agentConfig.createDomain')}
                onChange={(e) => setDomainKey(e.target.value)}
              >
                <MenuItem value="">{t('agentConfig.createDomainNone')}</MenuItem>
                {domains.map((d) => (
                  <MenuItem key={d.key} value={d.key}>
                    {d.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {models.length > 0 && (
            <FormControl fullWidth>
              <InputLabel id="create-agent-model-label">{t('agentConfig.createModel')}</InputLabel>
              <Select
                id="create-agent-model"
                labelId="create-agent-model-label"
                value={modelName}
                label={t('agentConfig.createModel')}
                onChange={(e) => setModelName(e.target.value)}
              >
                <MenuItem value="">{t('agentConfig.createModelNone')}</MenuItem>
                {models.map((m) => (
                  <MenuItem key={m.key} value={m.key}>
                    {m.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {error && (
            <Stack sx={{ color: 'error.main', typography: 'body2' }}>{error}</Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>
          {t('agentConfig.cancel')}
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
          {submitting ? t('agentConfig.createSubmitting') : t('agentConfig.createSubmit')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
