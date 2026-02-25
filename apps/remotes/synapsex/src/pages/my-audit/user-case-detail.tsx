import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useMemo, useState, useEffect, type ReactNode } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  getMe,
  useAuth,
  useCaseDetailQuery,
  useSubmitCaseExplanationMutation,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CardContent from '@mui/material/CardContent';

import { SYNAPSE_ROUTES } from '../../routes';
import { useCaseDetail } from '../cases/hooks/use-case-detail';
import { WorkbenchThoughtChain } from '../workbench/components/WorkbenchThoughtChain';

type UserInfoLike = {
  id?: string | number;
  userId?: string | number;
  roles?: string[];
  [key: string]: unknown;
};

type StatusMeta = {
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'default';
  label: string;
  guide: string;
};

const STATUS_META: Record<string, StatusMeta> = {
  ANALYZING: {
    color: 'primary',
    label: 'AI 분석 중',
    guide: 'AI가 전표를 분석 중입니다. 잠시만 기다려주세요.',
  },
  PENDING_EXPLANATION: {
    color: 'warning',
    label: '소명 필요',
    guide: '감사관이 소명을 요청했습니다. 내용을 입력해 주세요.',
  },
  IN_REVIEW: {
    color: 'info',
    label: '검토 중',
    guide: '소명이 제출되어 검토 중입니다. (수정 불가)',
  },
  RESOLVED: {
    color: 'success',
    label: '종결(해결)',
    guide: '감사가 종료되었습니다.',
  },
  IGNORED: {
    color: 'default',
    label: '종결(제외)',
    guide: '감사가 종료되었습니다.',
  },
  PENDING_APPROVAL: {
    color: 'secondary',
    label: '결재 대기',
    guide: '관리자 승인 절차가 진행 중입니다.',
  },
  NEW: {
    color: 'secondary',
    label: '분석 완료',
    guide: 'AI 분석이 완료되어 감사관의 최초 확인을 기다리고 있습니다.',
  },
};

const REGULATION_REGEX = /(제\s*\d+\s*조(?:\s*제\s*\d+\s*항)?)/g;

const toUpperStatus = (status: unknown): string =>
  typeof status === 'string' && status.trim() ? status.trim().toUpperCase() : 'NEW';

const normalizeId = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return null;
};

const extractMyUserId = (me: UserInfoLike | null | undefined): string | null =>
  normalizeId(me?.userId ?? me?.id);

const extractRoles = (me: UserInfoLike | null | undefined): string[] => {
  if (!Array.isArray(me?.roles)) return [];
  return me.roles.filter((r): r is string => typeof r === 'string');
};

const extractCaseOwnerId = (dto: Record<string, unknown> | null | undefined): string | null =>
  normalizeId(
    dto?.user_id ??
      dto?.userId ??
      dto?.owner_user_id ??
      dto?.ownerUserId ??
      dto?.created_by ??
      dto?.createdBy
  );

const extractExistingExplanation = (dto: Record<string, unknown> | null | undefined): string => {
  const explanationHistory = dto?.explanationHistory;
  if (Array.isArray(explanationHistory) && explanationHistory.length > 0) {
    const latest = [...explanationHistory]
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .sort((a, b) => {
        const at = new Date(String(a.createdAt ?? '')).getTime();
        const bt = new Date(String(b.createdAt ?? '')).getTime();
        return bt - at;
      })[0];
    const historyText = latest?.explanationText;
    if (typeof historyText === 'string' && historyText.trim()) return historyText;
  }

  const direct = [
    dto?.explanation_text,
    dto?.explanationText,
    (dto?.explanation as Record<string, unknown> | undefined)?.explanation_text,
    (dto?.explanation as Record<string, unknown> | undefined)?.explanationText,
    (dto?.explanation as Record<string, unknown> | undefined)?.content,
  ];
  for (const candidate of direct) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
  }

  const explanations = dto?.explanations;
  if (Array.isArray(explanations) && explanations.length > 0) {
    for (const item of explanations) {
      if (item && typeof item === 'object') {
        const v = (item as Record<string, unknown>).explanation_text;
        const v2 = (item as Record<string, unknown>).explanationText;
        const v3 = (item as Record<string, unknown>).content;
        const resolved = [v, v2, v3].find((x) => typeof x === 'string' && x.trim());
        if (typeof resolved === 'string') return resolved;
      }
    }
  }

  return '';
};

const extractReasonText = (dto: Record<string, unknown> | null | undefined): string => {
  const reasoning = dto?.reasoning as Record<string, unknown> | undefined;
  const candidates = [
    reasoning?.reasonText,
    dto?.reasonText,
    dto?.reason_text,
    dto?.reasoningText,
  ];
  const found = candidates.find((c) => typeof c === 'string' && c.trim());
  return typeof found === 'string' ? found : '';
};

const highlightRegulations = (text: string): ReactNode => {
  if (!text.trim()) return '-';
  const parts = text.split(REGULATION_REGEX);
  return (
    <>
      {parts.map((part, idx) => {
        if (!part) return null;
        return /(제\s*\d+\s*조(?:\s*제\s*\d+\s*항)?)/.test(part) ? <strong key={`${part}-${idx}`}>{part}</strong> : <span key={`${part}-${idx}`}>{part}</span>;
      })}
    </>
  );
};

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

          <Card variant="outlined" sx={{ flex: 1, minWidth: 0 }}>
            <CardContent>
              <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
                <Tab value="thought" label="사고과정" />
                <Tab value="logic" label="검토로직" />
                <Tab value="evidence" label="증거맵" />
              </Tabs>
              <Divider sx={{ my: 1.5 }} />

              {activeTab === 'thought' && (
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      Aura 분석 요약
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {highlightRegulations(reasonText)}
                    </Typography>
                  </Box>
                  {detail.briefingInsight && (
                    <Alert severity="info">{detail.briefingInsight}</Alert>
                  )}
                  {detail.aiThoughts.length > 0 ? (
                    <WorkbenchThoughtChain thoughts={detail.aiThoughts} />
                  ) : (
                    <Stack spacing={1}>
                      {detail.reasoningProcess.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      ) : (
                        detail.reasoningProcess.map((step, idx) => (
                          <Typography key={`${idx}-${step}`} variant="body2">{idx + 1}. {step}</Typography>
                        ))
                      )}
                    </Stack>
                  )}
                </Stack>
              )}

              {activeTab === 'logic' && (
                <Stack spacing={1}>
                  {detail.logicCheckpoints.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">-</Typography>
                  ) : (
                    detail.logicCheckpoints.map((item, idx) => (
                      <Card key={`${item.clause}-${idx}`} variant="outlined" sx={{ p: 1.5 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{item.clause}</Typography>
                          <Tooltip title={item.description || '조항 상세 설명이 없습니다.'} placement="top">
                            <IconButton size="small" sx={{ p: 0.25 }}>
                              i
                            </IconButton>
                          </Tooltip>
                          <Chip
                            size="small"
                            color={item.status === 'violation' ? 'error' : 'success'}
                            label={item.status === 'violation' ? '위반' : '준수'}
                          />
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {item.description || '-'}
                        </Typography>
                      </Card>
                    ))
                  )}
                </Stack>
              )}

              {activeTab === 'evidence' && (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>라인</TableCell>
                      <TableCell>계정</TableCell>
                      <TableCell>금액</TableCell>
                      <TableCell>위반 근거</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detail.fiDocItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center">-</TableCell>
                      </TableRow>
                    ) : (
                      detail.fiDocItems.map((item, idx) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.buzei ?? '-'}</TableCell>
                          <TableCell>{item.hkont ?? '-'}</TableCell>
                          <TableCell>{item.wrbtr != null ? `${item.wrbtr} ${item.waers ?? ''}` : '-'}</TableCell>
                          <TableCell>{evidenceReasonByItemIdx.get(idx) ?? '-'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Stack>

        {hideExplanationForm ? (
          <Card variant="outlined">
            <CardContent>
              <Alert severity="success">
                Aura 스크리닝 결과 본 전표는 사내 규정을 준수하고 있습니다.
              </Alert>
            </CardContent>
          </Card>
        ) : (
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
                  onChange={(e) => setExplanationText(e.target.value)}
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
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setAttachmentName(file.name);
                        setEvidenceAttachmentId(file.name);
                      }}
                    />
                  </Button>
                  <Typography variant="caption" color="text.secondary">
                    {attachmentName ? `첨부됨: ${attachmentName}` : '첨부 파일 없음'}
                  </Typography>
                </Stack>

                <Stack direction="row" justifyContent="flex-end" spacing={1}>
                  <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                  >
                    {submitMutation.isPending ? '제출 중...' : '소명 제출'}
                  </Button>
                </Stack>
                {submitMutation.isSuccess && (
                  <Alert severity="success">소명이 완료되었습니다.</Alert>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}
      </Stack>
    </Box>
  );
};
