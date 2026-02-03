/**
 * Register RAG document modal
 */

import type { FormEvent } from 'react';
import type { RegisterRagDocumentRequest } from '@dwp-frontend/shared-utils';

import { useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';

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
      <DialogTitle>Register Document</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <DialogContentText sx={{ mb: 3 }}>
            Register a document for RAG indexing. The document will be processed and chunked for semantic search.
          </DialogContentText>
          <Stack spacing={2.5}>
            <TextField
              size="small"
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Internal Control Policy v2026"
              required
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel id="rag-source-type-label">Source Type</InputLabel>
              <Select
                size="small"
                labelId="rag-source-type-label"
                label="Source Type"
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
              >
                {SOURCE_TYPES.map((t) => (
                  <MenuItem key={t.value} value={t.value}>
                    {t.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {sourceType === 'S3' && (
              <TextField
                size="small"
                fullWidth
                label="S3 Key"
                value={s3Key}
                onChange={(e) => setS3Key(e.target.value)}
                placeholder="bucket/path/to/document.pdf"
              />
            )}
            {sourceType === 'URL' && (
              <TextField
                size="small"
                fullWidth
                label="URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
              />
            )}
            <TextField
              size="small"
              fullWidth
              label="Checksum (optional)"
              value={checksum}
              onChange={(e) => setChecksum(e.target.value)}
              placeholder="SHA256 hash for integrity"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={isLoading} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!title.trim() || isLoading}
            startIcon={<Iconify icon={isLoading ? 'solar:refresh-bold' : 'solar:upload-bold'} width={18} />}
          >
            {isLoading ? 'Registering...' : 'Register'}
          </Button>
        </DialogActions>
      </form>
    </>
  );
};
