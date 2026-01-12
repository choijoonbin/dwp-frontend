import { useMemo } from 'react';
import { Label, Scrollbar } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

type MailItem = {
  id: string;
  from: string;
  subject: string;
  preview: string;
  receivedAt: string;
  tags: Array<'Approval' | 'System' | 'HR' | 'Finance'>;
  unread: boolean;
};

export const MailApp = () => {
  const items = useMemo<MailItem[]>(
    () => [
      {
        id: 'm-001',
        from: 'approval@dwp.local',
        subject: '[결재] 출장비 정산 요청',
        preview: '출장비 정산 내역을 확인해 주세요. (영수증 3건 첨부)',
        receivedAt: '2026-01-12 09:10',
        tags: ['Approval', 'Finance'],
        unread: true,
      },
      {
        id: 'm-002',
        from: 'hr@dwp.local',
        subject: '[공지] 2026 복지 포인트 안내',
        preview: '복지 포인트 사용 기간 및 대상자 안내드립니다.',
        receivedAt: '2026-01-12 08:02',
        tags: ['HR'],
        unread: false,
      },
      {
        id: 'm-003',
        from: 'system@dwp.local',
        subject: '[System] API Gateway 점검 예정',
        preview: '오늘 23:00~23:30 사이 서비스 영향이 있을 수 있습니다.',
        receivedAt: '2026-01-11 18:40',
        tags: ['System'],
        unread: false,
      },
    ],
    []
  );

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={0.75} sx={{ mb: 3 }}>
        <Typography variant="h4">Mail</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Host와 동일한 테마(@dwp-frontend/design-system)로 렌더링되는 Remote 예시 화면입니다.
        </Typography>
      </Stack>

      <Card sx={{ p: 2 }}>
        <Scrollbar sx={{ maxHeight: 560 }}>
          <Stack spacing={1.5} sx={{ pr: 1 }}>
            {items.map((mail) => (
              <Card
                key={mail.id}
                variant="outlined"
                sx={{
                  p: 2,
                  borderColor: (theme) =>
                    mail.unread ? theme.vars.palette.primary.main : theme.vars.palette.divider,
                }}
              >
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle2" sx={{ flex: '1 1 auto' }}>
                      {mail.subject}
                    </Typography>
                    {mail.unread && <Chip size="small" color="primary" label="NEW" />}
                  </Stack>

                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      From: {mail.from}
                    </Typography>
                    <Divider flexItem orientation="vertical" sx={{ borderStyle: 'dashed' }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {mail.receivedAt}
                    </Typography>
                  </Stack>

                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {mail.preview}
                  </Typography>

                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {mail.tags.map((tag) => (
                      <Label
                        key={`${mail.id}-${tag}`}
                        color={
                          tag === 'Approval' ? 'info' : tag === 'Finance' ? 'warning' : 'default'
                        }
                        variant="soft"
                      >
                        {tag}
                      </Label>
                    ))}
                  </Box>
                </Stack>
              </Card>
            ))}
          </Stack>
        </Scrollbar>
      </Card>
    </Container>
  );
};

