/**
 * Register RAG document modal (규정문서 라이브러리)
 * - 파일: 사용자가 파일 선택 후 선택된 파일의 확장자를 소스 유형으로 표시 (select 아님). multipart POST (file + title + docType)
 * - URL/S3: JSON POST .../register (title, sourceType, url/s3Key, docType)
 * - 업로드 허용 확장자: .pdf, .txt, .doc, .docx, .hwp
 */

import type { ChangeEvent, FormEvent } from 'react';
import type { RegisterRagDocumentRequest } from '@dwp-frontend/shared-utils';

import { useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import Button from '@mui/material/Button';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContentText from '@mui/material/DialogContentText';
import Stack from '@mui/material/Stack';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import TextField from '@mui/material/TextField';

const DOC_TYPES = [
  { value: 'GENERAL', label: 'GENERAL' },
  { value: 'REGULATION', label: 'REGULATION' },
  { value: 'MANUAL', label: 'MANUAL' },
  { value: 'POLICY', label: 'POLICY' },
];

/** 업로드 허용 확장자: pdf, txt, doc, docx, hwp */
const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.doc', '.docx', '.hwp'];
const hasAllowedExtension = (f: File): boolean =>
  ALLOWED_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext));

/** 선택된 파일의 확장자를 대문자로 반환 (예: PDF, DOCX, HWP) */
const getFileExtensionLabel = (f: File): string => {
  const name = f.name.toLowerCase();
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toUpperCase() : '';
};

type RegisterRagDocumentModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: FormData | RegisterRagDocumentRequest) => void;
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
  const [sourceMode, setSourceMode] = useState<string>('FILE');
  const [docType, setDocType] = useState<string>('GENERAL');
  const [file, setFile] = useState<File | null>(null);
  const [s3Key, setS3Key] = useState('');
  const [url, setUrl] = useState('');

  const requiresFile = sourceMode === 'FILE';
  const fileValid = file != null && file.size > 0 && hasAllowedExtension(file);
  const canSubmitFile = title.trim() && !isLoading && fileValid;
  const canSubmitUrl =
    title.trim() &&
    !isLoading &&
    (sourceMode !== 'URL' || url.trim()) &&
    (sourceMode !== 'S3' || s3Key.trim());
  const canSubmit = requiresFile ? canSubmitFile : canSubmitUrl;

  /** 파일 선택 시 소스 유형 = 선택된 파일 확장자 (표시용) */
  const displayedSourceType = file != null ? getFileExtensionLabel(file) : '';

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    setFile(selected ?? null);
  };

  const resetForm = () => {
    setTitle('');
    setSourceMode('FILE');
    setDocType('GENERAL');
    setFile(null);
    setS3Key('');
    setUrl('');
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();

    if (sourceMode === 'FILE' && file != null && file.size > 0 && hasAllowedExtension(file)) {
      const formData = new FormData();
      formData.append('file', file);
      if (trimmedTitle) formData.append('title', trimmedTitle);
      if (docType.trim()) formData.append('docType', docType.trim());
      onSubmit(formData);
    } else {
      const body: RegisterRagDocumentRequest = {
        title: trimmedTitle,
        sourceType: sourceMode,
      };
      if (docType.trim()) body.docType = docType.trim();
      if (s3Key.trim()) body.s3Key = s3Key.trim();
      if (url.trim()) body.url = url.trim();
      onSubmit(body);
    }
    onClose();
    resetForm();
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
      resetForm();
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
              <InputLabel id="rag-source-mode-label">{t('rag.registerModal.sourceMode')}</InputLabel>
              <Select
                size="small"
                labelId="rag-source-mode-label"
                label={t('rag.registerModal.sourceMode')}
                value={sourceMode}
                onChange={(e) => {
                  setSourceMode(e.target.value);
                  if (e.target.value !== 'FILE') setFile(null);
                }}
              >
                <MenuItem value="FILE">{t('rag.registerModal.sourceModeFile')}</MenuItem>
                <MenuItem value="URL">{t('rag.registerModal.sourceModeUrl')}</MenuItem>
                <MenuItem value="S3">{t('rag.registerModal.sourceModeS3')}</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="rag-doc-type-label">{t('rag.registerModal.docType')}</InputLabel>
              <Select
                size="small"
                labelId="rag-doc-type-label"
                label={t('rag.registerModal.docType')}
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
              >
                {DOC_TYPES.map((dt) => (
                  <MenuItem key={dt.value} value={dt.value}>
                    {dt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {sourceMode === 'FILE' && (
              <Stack spacing={0.5}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Button variant="outlined" component="label" size="small" disabled={isLoading}>
                    {t('rag.registerModal.selectFile')}
                    <input
                      type="file"
                      hidden
                      accept=".pdf,.txt,.doc,.docx,.hwp"
                      onChange={handleFileChange}
                    />
                  </Button>
                  {file != null && (
                    <TextField
                      size="small"
                      value={file.name}
                      InputProps={{ readOnly: true }}
                      sx={{ flex: 1 }}
                    />
                  )}
                </Stack>
                {file != null && (
                  <TextField
                    size="small"
                    fullWidth
                    label={t('rag.registerModal.sourceType')}
                    value={displayedSourceType}
                    InputProps={{ readOnly: true }}
                    error={!hasAllowedExtension(file)}
                    helperText={
                      !hasAllowedExtension(file)
                        ? t('rag.registerModal.allowedExtensionsHint')
                        : undefined
                    }
                  />
                )}
              </Stack>
            )}
            {sourceMode === 'S3' && (
              <TextField
                size="small"
                fullWidth
                label={t('rag.registerModal.s3Key')}
                value={s3Key}
                onChange={(e) => setS3Key(e.target.value)}
                placeholder={t('rag.registerModal.s3KeyPlaceholder')}
              />
            )}
            {sourceMode === 'URL' && (
              <TextField
                size="small"
                fullWidth
                label={t('rag.registerModal.url')}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t('rag.registerModal.urlPlaceholder')}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={isLoading} sx={{ color: 'text.secondary' }}>
            {t('rag.registerModal.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!canSubmit}
            startIcon={<Iconify icon={isLoading ? 'solar:refresh-bold' : 'solar:upload-bold'} width={18} />}
          >
            {isLoading ? t('rag.registerModal.registering') : t('rag.registerModal.register')}
          </Button>
        </DialogActions>
      </form>
    </>
  );
};
