import type { ReactNode } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';

import { WorkbenchThoughtChain } from '../../workbench/components/WorkbenchThoughtChain';

import type { CaseDetailResult } from '../../cases/hooks/use-case-detail';

type Props = {
  activeTab: 'thought' | 'logic' | 'evidence';
  onTabChange: (tab: 'thought' | 'logic' | 'evidence') => void;
  detail: CaseDetailResult;
  reasonTextView: ReactNode;
  evidenceReasonByItemIdx: Map<number, string>;
};

export function UserCaseAnalysisPanel({
  activeTab,
  onTabChange,
  detail,
  reasonTextView,
  evidenceReasonByItemIdx,
}: Props) {
  return (
    <Card variant="outlined" sx={{ flex: 1, minWidth: 0 }}>
      <CardContent>
        <Tabs value={activeTab} onChange={(_, value) => onTabChange(value)}>
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
                {reasonTextView}
              </Typography>
            </Box>
            {detail.briefingInsight && <AlertInfoText text={detail.briefingInsight} />}
            {detail.aiThoughts.length > 0 ? (
              <WorkbenchThoughtChain thoughts={detail.aiThoughts} />
            ) : (
              <Stack spacing={1}>
                {detail.reasoningProcess.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    -
                  </Typography>
                ) : (
                  detail.reasoningProcess.map((step, idx) => (
                    <Typography key={`${idx}-${step}`} variant="body2">
                      {idx + 1}. {step}
                    </Typography>
                  ))
                )}
              </Stack>
            )}
          </Stack>
        )}

        {activeTab === 'logic' && (
          <Stack spacing={1}>
            {detail.logicCheckpoints.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                -
              </Typography>
            ) : (
              detail.logicCheckpoints.map((item, idx) => (
                <Card key={`${item.clause}-${idx}`} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {item.clause}
                    </Typography>
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
                  <TableCell colSpan={4} align="center">
                    -
                  </TableCell>
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
  );
}

function AlertInfoText({ text }: { text: string }) {
  return (
    <Box
      sx={{
        px: 1.5,
        py: 1,
        borderRadius: 1,
        bgcolor: 'info.lighter',
        color: 'info.darker',
      }}
    >
      <Typography variant="body2">{text}</Typography>
    </Box>
  );
}
