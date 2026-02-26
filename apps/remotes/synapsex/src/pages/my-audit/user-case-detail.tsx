import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  getMe,
  useAuth,
  useCaseDetailQuery,
  useSubmitCaseExplanationMutation,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';

import { SYNAPSE_ROUTES } from '../../routes';
import { useCaseDetail } from '../cases/hooks/use-case-detail';
import { UserCaseAnalysisPanel } from './components/user-case-analysis-panel';
import { UserCaseExplanationPanel } from './components/user-case-explanation-panel';
import {
  STATUS_META,
  extractRoles,
  toUpperStatus,
  extractMyUserId,
  extractReasonText,
  extractCaseOwnerId,
  highlightRegulations,
  extractExistingExplanation,
} from './user-case-detail.helpers';

import type { UserInfoLike } from './user-case-detail.helpers';

export const UserCaseDetailPage = () => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated } = useAuth();
  const idFromPath = pathname.match(/(?:^|\/)my-audit\/cases\/([^/]+)(?:$|\?)/)?.[1];
  const caseId = id ?? idFromPath ?? '';

  const [activeTab, setActiveTab] = useState<'thought' | 'logic' | 'evidence'>('thought');
  const [statusOverride, setStatusOverride] = useState<string | null>(null);
  const [explanationText, setExplanationText] = useState('');
  const [evidenceAttachmentId, setEvidenceAttachmentId] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [prefilled, setPrefilled] = useState(false);

  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await getMe();
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to fetch me');
      }
      return res.data as UserInfoLike;
    },
    enabled: isAuthenticated,
    retry: false,
  });

  const detailQuery = useCaseDetailQuery(caseId || undefined);
  const detail = useCaseDetail(caseId || undefined);
  const submitMutation = useSubmitCaseExplanationMutation();

  const rawDto = (detailQuery.data ?? null) as Record<string, unknown> | null;
  const myUserId = extractMyUserId(meQuery.data);
  const myRoles = extractRoles(meQuery.data);
  const isAdmin = myRoles.includes('ADMIN') || myRoles.includes('SYNAPSEX_ADMIN');
  const isOperator = myRoles.includes('SYNAPSEX_OPERATOR');
  const ownerUserId = extractCaseOwnerId(rawDto);
  const ownerMatched = isAdmin || Boolean(myUserId && ownerUserId && myUserId === ownerUserId);

  const currentStatus = toUpperStatus(statusOverride ?? detail.caseData?.status ?? rawDto?.status);
  const statusMeta = STATUS_META[currentStatus] ?? {
    color: 'default',
    label: currentStatus || '-',
    guide: '-',
  };

  const reasonText = extractReasonText(rawDto);
  const explanationReadonly = currentStatus !== 'PENDING_EXPLANATION';
  const hideExplanationForm = currentStatus === 'RESOLVED' || currentStatus === 'IGNORED';
  const canSubmit = explanationText.trim().length >= 20 && !explanationReadonly && !submitMutation.isPending;

  useEffect(() => {
    if (prefilled) return;
    const existing = extractExistingExplanation(rawDto);
    if (existing) {
      setExplanationText(existing);
    }
    setPrefilled(true);
  }, [rawDto, prefilled]);

  const evidenceReasonByItemIdx = useMemo(() => {
    const map = new Map<number, string>();
    for (const link of detail.evidenceLinks) {
      if (typeof link.itemIdx !== 'number') continue;
      if (!link.reason) continue;
      map.set(link.itemIdx, link.reason);
    }
    return map;
  }, [detail.evidenceLinks]);

  const handleSubmit = async () => {
    if (!caseId || !canSubmit) return;
    await submitMutation.mutateAsync({
      caseId,
      explanation: explanationText.trim(),
      evidenceAttachmentId: evidenceAttachmentId || undefined,
    });
    setStatusOverride('IN_REVIEW');
  };

  if (!caseId) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">잘못된 접근입니다. 케이스 ID가 없습니다.</Alert>
      </Box>
    );
  }

  if (detail.isLoading || detailQuery.isLoading || meQuery.isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="body2" color="text.secondary">
          {t('caseDetail.loading', 'Loading case detail...')}
        </Typography>
      </Box>
    );
  }

  if (detail.error || detailQuery.error || meQuery.error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          상세 정보를 불러오지 못했습니다.
        </Alert>
        <Button variant="outlined" onClick={() => detail.refetch()}>
          다시 시도
        </Button>
      </Box>
    );
  }

  if (!isAdmin && !isOperator) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">접근 권한이 없습니다. (허용 역할: ADMIN, SYNAPSEX_OPERATOR)</Alert>
      </Box>
    );
  }

  if (!ownerMatched) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">본인 전표만 조회할 수 있습니다.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack spacing={2.5}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {t('myAudit.caseDetail.title', '소명 상세')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {detail.caseData?.title ?? '-'}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            onClick={() => navigate(SYNAPSE_ROUTES.MY_AUDIT_EXPENSES)}
          >
            {t('caseDetail.backToCases', '목록으로')}
          </Button>
        </Stack>

        <Card variant="outlined">
          <CardContent>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', md: 'center' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {detail.caseData?.caseNumber ?? `CS-${caseId}`}
              </Typography>
              <Chip label={statusMeta.label} color={statusMeta.color} size="small" />
              <Typography variant="body2" color="text.secondary">
                {statusMeta.guide}
              </Typography>
              {(currentStatus === 'RESOLVED' || currentStatus === 'IGNORED') && (
                <Typography variant="body2" color="text.secondary">
                  {detail.finalReport?.verdict ?? detail.finalReport?.summary ?? '-'}
                </Typography>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems="stretch">
          <Card variant="outlined" sx={{ width: { xs: '100%', lg: 360 }, flexShrink: 0 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                전표 기본 정보
              </Typography>
              <Stack spacing={1}>
                <Typography variant="body2">Company: {detail.fiDoc?.bukrs ?? '-'}</Typography>
                <Typography variant="body2">Document: {detail.fiDoc?.belnr ?? '-'}</Typography>
                <Typography variant="body2">Fiscal Year: {detail.fiDoc?.gjahr ?? '-'}</Typography>
                <Typography variant="body2">Posting Date: {detail.fiDoc?.budat ?? '-'}</Typography>
                <Typography variant="body2">
                  Amount: {detail.fiDoc?.wrbtr != null ? `${detail.fiDoc.wrbtr} ${detail.fiDoc.waers ?? ''}` : '-'}
                </Typography>
                <Typography variant="body2">Counterparty: {detail.fiDoc?.counterpartyDisplay ?? '-'}</Typography>
              </Stack>
            </CardContent>
          </Card>

          <UserCaseAnalysisPanel
            activeTab={activeTab}
            onTabChange={setActiveTab}
            detail={detail}
            reasonTextView={highlightRegulations(reasonText)}
            evidenceReasonByItemIdx={evidenceReasonByItemIdx}
          />
        </Stack>

        <UserCaseExplanationPanel
          currentStatus={currentStatus}
          hideExplanationForm={hideExplanationForm}
          explanationText={explanationText}
          explanationReadonly={explanationReadonly}
          canSubmit={canSubmit}
          attachmentName={attachmentName}
          isSubmitting={submitMutation.isPending}
          isSuccess={submitMutation.isSuccess}
          onExplanationTextChange={setExplanationText}
          onAttachmentChange={(file) => {
            if (!file) return;
            setAttachmentName(file.name);
            setEvidenceAttachmentId(file.name);
          }}
          onSubmit={handleSubmit}
        />
      </Stack>
    </Box>
  );
};
