/**
 * Register RAG document modal
 */

import type { FormEvent } from 'react';
import type { RegisterRagDocumentRequest } from '@dwp-frontend/shared-utils';

import { useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import InputLabel from '@mui/material/InputLabel';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';

const SOURCE_TYPES = [
  { value: 'PDF', label: 'PDF' },
  { value: 'TXT', label: 'Text' },
  { value: 'URL', label: 'URL' },
  { value: 'S3', label: 'S3' },
];

type RegisterRagDocumentModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (body: RegisterRagDocumentRequest) => void;
  isLoading?: boolean;
};

export const RegisterRagDocumentModal = ({
  open,
  onClose,
  onSubmit,
  isLoading,
}: RegisterRagDocumentModalProps) => {
  const { t } = useTranslation('common');
  const [title, setTitle] = useState('');
  const [sourceType, setSourceType] = useState<string>('PDF');
  const [s3Key, setS3Key] = useState('');
  const [url, setUrl] = useState('');
  const [checksum, setChecksum] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const body: RegisterRagDocumentRequest = {
      title: title.trim(),
      sourceType,
    };
    if (s3Key.trim()) body.s3Key = s3Key.trim();
    if (url.trim()) body.url = url.trim();
    if (checksum.trim()) body.checksum = checksum.trim();
    onSubmit(body);
    onClose();
    setTitle('');
    setSourceType('PDF');
    setS3Key('');
    setUrl('');
    setChecksum('');
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
      setTitle('');
      setSourceType('PDF');
      setS3Key('');
      setUrl('');
      setChecksum('');
    }
  };

  return (
    <>
      <DialogTitle>{t('rag.registerDocument')}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <DialogContentText sx={{ mb: 3 }}>
            {t('rag.registerModal.hint')}
          </DialogContentText>
          <Stack spacing={2.5}>
            <TextField
              size="small"
              label={t('rag.registerModal.titleLabel')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('rag.registerModal.titlePlaceholder')}
              required
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel id="rag-source-type-label">{t('rag.registerModal.sourceType')}</InputLabel>
              <Select
                size="small"
                labelId="rag-source-type-label"
                label={t('rag.registerModal.sourceType')}
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
              >
                {SOURCE_TYPES.map((st) => (
                  <MenuItem key={st.value} value={st.value}>
                    {st.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {sourceType === 'S3' && (
              <TextField
                size="small"
                fullWidth
                label={t('rag.registerModal.s3Key')}
                value={s3Key}
                onChange={(e) => setS3Key(e.target.value)}
                placeholder={t('rag.registerModal.s3KeyPlaceholder')}
              />
            )}
            {sourceType === 'URL' && (
              <TextField
                size="small"
                fullWidth
                label={t('rag.registerModal.url')}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t('rag.registerModal.urlPlaceholder')}
              />
            )}
            <TextField
              size="small"
              fullWidth
              label={t('rag.registerModal.checksum')}
              value={checksum}
              onChange={(e) => setChecksum(e.target.value)}
              placeholder={t('rag.registerModal.checksumPlaceholder')}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={isLoading} sx={{ color: 'text.secondary' }}>
            {t('rag.registerModal.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!title.trim() || isLoading}
            startIcon={<Iconify icon={isLoading ? 'solar:refresh-bold' : 'solar:upload-bold'} width={18} />}
          >
            {isLoading ? t('rag.registerModal.registering') : t('rag.registerModal.register')}
          </Button>
        </DialogActions>
      </form>
    </>
  );
};
