import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';

type Props = {
  currentStatus: string;
  hideExplanationForm: boolean;
  explanationText: string;
  explanationReadonly: boolean;
  canSubmit: boolean;
  attachmentName: string;
  isSubmitting: boolean;
  isSuccess: boolean;
  onExplanationTextChange: (value: string) => void;
  onAttachmentChange: (file: File | null) => void;
  onSubmit: () => void;
};

export function UserCaseExplanationPanel({
  currentStatus,
  hideExplanationForm,
  explanationText,
  explanationReadonly,
  canSubmit,
  attachmentName,
  isSubmitting,
  isSuccess,
  onExplanationTextChange,
  onAttachmentChange,
  onSubmit,
}: Props) {
  if (hideExplanationForm) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Alert severity="success">
            Aura 스크리닝 결과 본 전표는 사내 규정을 준수하고 있습니다.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            소명서 작성
          </Typography>
          {currentStatus === 'PENDING_EXPLANATION' ? (
            <Alert severity="warning">소명 필요 상태입니다. 최소 20자 이상 입력 후 제출해주세요.</Alert>
          ) : (
            <Alert severity="info">현재 상태에서는 소명 폼이 읽기 전용입니다.</Alert>
          )}

          <TextField
            label="소명 사유"
            placeholder="소명 사유를 구체적으로 입력하세요. (최소 20자)"
            multiline
            minRows={6}
            value={explanationText}
            onChange={(event) => onExplanationTextChange(event.target.value)}
            disabled={explanationReadonly}
            helperText={`${explanationText.trim().length}/20`}
            fullWidth
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <Button component="label" variant="outlined" disabled={explanationReadonly}>
              증빙 첨부 (이미지/PDF)
              <input
                type="file"
                hidden
                accept="image/*,application/pdf"
                onChange={(event) => onAttachmentChange(event.target.files?.[0] ?? null)}
              />
            </Button>
            <Typography variant="caption" color="text.secondary">
              {attachmentName ? `첨부됨: ${attachmentName}` : '첨부 파일 없음'}
            </Typography>
          </Stack>

          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button variant="contained" onClick={onSubmit} disabled={!canSubmit}>
              {isSubmitting ? '제출 중...' : '소명 제출'}
            </Button>
          </Stack>
          {isSuccess && <Alert severity="success">소명이 완료되었습니다.</Alert>}
        </Stack>
      </CardContent>
    </Card>
  );
}
