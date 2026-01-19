// ----------------------------------------------------------------------

import type { HitlRequest } from 'src/store/use-aura-store';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type CheckpointApprovalProps = {
  request: HitlRequest;
  onApprove: (editedContent?: string) => void;
  onReject: () => void;
  onEdit?: (content: string) => void;
};

export const CheckpointApproval = ({ request, onApprove, onReject, onEdit }: CheckpointApprovalProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(request.editableContent || request.message);
  const confidence = request.confidence ?? 1.0;

  const handleContentChange = (newContent: string) => {
    setEditedContent(newContent);
    // Optimistic update: 즉시 store에 반영
    if (onEdit) {
      onEdit(newContent);
    }
  };

  const handleSaveEdit = () => {
    // Content is already updated via handleContentChange
    setIsEditing(false);
  };

  const getConfidenceColor = (conf: number) => {
    if (conf > 0.8) return 'success';
    if (conf > 0.5) return 'warning';
    return 'error';
  };

  const getConfidenceLabel = (conf: number) => {
    if (conf > 0.8) return '높음';
    if (conf > 0.5) return '보통';
    return '낮음';
  };

  return (
    <Dialog open maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center">
            <Iconify icon="solar:shield-warning-bold" width={24} sx={{ color: 'warning.main' }} />
            <Typography variant="h6">작업 승인 필요</Typography>
          </Stack>
          {confidence < 0.8 && (
            <Alert
              severity={getConfidenceColor(confidence)}
              icon={<Iconify icon="solar:info-circle-bold" width={16} />}
              sx={{ py: 0, px: 1 }}
            >
              신뢰도: {getConfidenceLabel(confidence)} ({Math.round(confidence * 100)}%)
            </Alert>
          )}
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Alert severity="warning" icon={<Iconify icon="solar:info-circle-bold" width={20} />}>
            에이전트가 다음 작업을 수행하기 전 사용자 승인이 필요합니다.
          </Alert>

          <Paper sx={{ p: 2, bgcolor: 'background.neutral' }}>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="subtitle2">작업 내용</Typography>
              {request.editableContent !== undefined && (
                <Button
                  size="small"
                  variant={isEditing ? 'contained' : 'outlined'}
                  onClick={() => (isEditing ? handleSaveEdit() : setIsEditing(true))}
                  startIcon={<Iconify icon={isEditing ? 'solar:check-circle-bold' : 'solar:pen-bold'} />}
                >
                  {isEditing ? '저장' : '수정'}
                </Button>
              )}
            </Stack>
            {isEditing ? (
              <TextField
                fullWidth
                multiline
                rows={4}
                value={editedContent}
                onChange={(e) => handleContentChange(e.target.value)}
                variant="outlined"
                sx={{ mt: 1 }}
              />
            ) : (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {editedContent}
              </Typography>
            )}
          </Paper>

          <Paper sx={{ p: 2, bgcolor: 'background.neutral' }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              실행할 액션
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
              {request.action}
            </Typography>
          </Paper>

          <Paper sx={{ p: 2, bgcolor: 'background.neutral' }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              파라미터
            </Typography>
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 1,
                bgcolor: 'background.paper',
                borderRadius: 0.5,
                fontSize: '0.75rem',
                overflow: 'auto',
                maxHeight: 200,
              }}
            >
              {JSON.stringify(request.params, null, 2)}
            </Box>
          </Paper>

          {confidence < 0.5 && (
            <Alert severity="info" icon={<Iconify icon="solar:question-circle-bold" width={20} />}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                신뢰도가 낮아 추가 정보가 필요합니다. 다음 중 하나를 제공해주세요:
              </Typography>
              <Stack spacing={0.5}>
                <Typography variant="caption">• 관련 파일 경로</Typography>
                <Typography variant="caption">• 이전 대화 맥락</Typography>
                <Typography variant="caption">• 특정 요구사항</Typography>
              </Stack>
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button variant="outlined" color="error" onClick={onReject} startIcon={<Iconify icon="solar:close-circle-bold" />}>
          거절
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => onApprove(isEditing ? editedContent : undefined)}
          startIcon={<Iconify icon="solar:check-circle-bold" />}
        >
          승인 및 실행
        </Button>
      </DialogActions>
    </Dialog>
  );
};
