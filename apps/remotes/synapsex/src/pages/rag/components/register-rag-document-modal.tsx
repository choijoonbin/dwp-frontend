/**
 * Register RAG document modal (규정문서 라이브러리)
 * - 파일: 사용자가 파일 선택 후 선택된 파일의 확장자를 소스 유형으로 표시 (select 아님). multipart POST (file + title + docType)
 * - URL/S3: JSON POST .../register (title, sourceType, url/s3Key, docType)
 * - 업로드 허용 확장자: .pdf, .txt, .doc, .docx, .hwp
 */

import type { FormEvent, ChangeEvent } from 'react';
import type { CatalogCodeItemDto, RegisterRagDocumentRequest } from '@dwp-frontend/shared-utils';

import { useState, useEffect } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import InputLabel from '@mui/material/InputLabel';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';

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

/** BE catalog API docTypes와 동기화 (key/value/description) */
type RegisterRagDocumentModalProps = {
  onClose: () => void;
  onSubmit: (payload: FormData | RegisterRagDocumentRequest) => void | Promise<void>;
  isLoading?: boolean;
  closeOnSubmit?: boolean;
  docTypes?: CatalogCodeItemDto[];
};

export const RegisterRagDocumentModal = ({
  onClose,
  onSubmit,
  isLoading,
  closeOnSubmit = true,
  docTypes = [],
}: RegisterRagDocumentModalProps) => {
  const { t } = useTranslation('common');
  const [title, setTitle] = useState('');
  const [sourceMode, setSourceMode] = useState<string>('FILE');
  const [docType, setDocType] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [s3Key, setS3Key] = useState('');
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (docTypes.length > 0 && !docType) setDocType(docTypes[0].key);
  }, [docTypes, docType]);

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
    setDocType(docTypes[0]?.key ?? '');
    setFile(null);
    setS3Key('');
    setUrl('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();

    let payload: FormData | RegisterRagDocumentRequest;
    if (sourceMode === 'FILE' && file != null && file.size > 0 && hasAllowedExtension(file)) {
      const formData = new FormData();
      formData.append('file', file);
      if (trimmedTitle) formData.append('title', trimmedTitle);
      if (docType.trim()) formData.append('docType', docType.trim());
      if (docType.trim() === 'HIERARCHICAL' && process.env.NODE_ENV === 'development') {
        console.log('[RAG] HIERARCHICAL upload submitted; verify Aura chunk structure (조/항) in BE/Aura logs for at least one document.');
      }
      payload = formData;
    } else {
      const body: RegisterRagDocumentRequest = {
        title: trimmedTitle,
        sourceType: sourceMode,
      };
      if (docType.trim()) body.docType = docType.trim();
      if (s3Key.trim()) body.s3Key = s3Key.trim();
      if (url.trim()) body.url = url.trim();
      payload = body;
    }
    const result = onSubmit(payload);
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      await (result as Promise<unknown>);
    }
    if (closeOnSubmit) {
      onClose();
      resetForm();
    }
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
            <Tooltip title={docType === 'HIERARCHICAL' ? '조/항 인식 검증 필요' : ''} placement="top">
              <FormControl fullWidth>
                <InputLabel id="rag-doc-type-label">{t('rag.registerModal.docType')}</InputLabel>
                <Select
                  size="small"
                  labelId="rag-doc-type-label"
                  label={t('rag.registerModal.docType')}
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                >
                  {docTypes.map((dt) => (
                    <MenuItem key={dt.key} value={dt.key}>
                      {dt.value}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Tooltip>
            {(() => {
              const selected = docTypes.find((d) => d.key === docType);
              return selected?.description ? (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: -1.5 }}>
                  {selected.description}
                </Typography>
              ) : null;
            })()}
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
