/**
 * Agent Studio — 지식 탭: RAG 지식 베이스 목록 + 에이전트 바인딩/해제
 * 파일 업로드 시 doc_type은 백엔드 knowledge_base_master와 일치 (REGULATION | MANUAL | POLICY | GENERAL)
 */

import { useQuery } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';

import { Iconify } from '@dwp-frontend/design-system';
import { getAgentKnowledgeCatalog, type AgentKnowledgeItemDto } from '@dwp-frontend/shared-utils';

import type { CatalogCodeItemDto } from '@dwp-frontend/shared-utils';

type AgentKnowledgeTabProps = {
  /** key=서버값, value=UI 노출값. 문서 타입 표기에 사용 */
  docTypes: CatalogCodeItemDto[];
  boundIds: Set<string>;
  onToggleBinding: (id: string, bound: boolean) => void;
};

const docTypeLabel = (docTypes: CatalogCodeItemDto[], key: string): string =>
  docTypes.find((d) => d.key === key)?.value ?? key;

/** RAG 문서를 지식 베이스 카드 형태로 표시, 바인딩 스위치 */
export const AgentKnowledgeTab = ({ docTypes, boundIds, onToggleBinding }: AgentKnowledgeTabProps) => {
  const { data: res, isLoading } = useQuery({
    queryKey: ['synapse', 'agents', 'knowledge'],
    queryFn: () => getAgentKnowledgeCatalog({ size: 50 }),
  });

  const items: AgentKnowledgeItemDto[] = res?.data?.items ?? [];

  return (
    <Box sx={{ p: 3 }}>
      <Card variant="outlined">
        <CardHeader
          title="지식 베이스 (RAG)"
          subheader="에이전트에 바인딩할 지식 베이스(문서)를 선택하세요. 업로드 시 doc_type은 knowledge_base_master와 일치해야 합니다."
        />
        <CardContent>
          {isLoading && (
            <Typography variant="body2" color="text.secondary">로딩 중...</Typography>
          )}
          {!isLoading && items.length === 0 && (
            <Typography variant="body2" color="text.secondary">등록된 지식 베이스가 없습니다.</Typography>
          )}
          <Stack spacing={1.5}>
            {items.map((doc) => {
              const docId = String(doc.docId);
              const bound = boundIds.has(docId);
              const docTypeKey = doc.docType ?? doc.sourceType;
              return (
                <Box
                  key={docId}
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    border: 1,
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Iconify icon="solar:document-text-bold-duotone" width={20} sx={{ color: 'text.secondary' }} />
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{doc.title}</Typography>
                      <Typography variant="caption" color="text.secondary">{docTypeLabel(docTypes, docTypeKey)} · {doc.status}</Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="caption" color="text.secondary">{bound ? '바인딩됨' : '미바인딩'}</Typography>
                    <Switch
                      checked={bound}
                      onChange={(e) => onToggleBinding(docId, e.target.checked)}
                    />
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};
