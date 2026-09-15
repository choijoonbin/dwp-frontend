import '@dwp-frontend/design-system/styles/global.css';

import { Suspense, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { DwpThemeProvider } from '@dwp-frontend/design-system/appearance';
import { I18nProvider } from '@dwp-frontend/shared-i18n';
import { writeLocalePreference } from '@dwp-frontend/shared-utils/locale-preference';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  HOME_CONTENT_STATES,
  HomeContentState,
  resolveHomeContentStateSemantics,
} from '../src/features/home/runtime/home-content-state';

import type { HomeContentStateKind } from '../src/features/home/runtime/home-content-state';

const ACTIONABLE_STATES = new Set<HomeContentStateKind>([
  'empty',
  'partial',
  'stale',
  'widget-error',
  'conflict',
]);

const AFFECTED_SOURCES = new Map<HomeContentStateKind, readonly string[]>([
  ['partial', ['DWP_CALENDAR']],
  ['stale', ['DWP_CALENDAR']],
  ['widget-error', ['DWP_WORKSPACE']],
  ['conflict', ['HOME_PREFERENCE']],
]);

const LAST_SUCCESS = new Map<HomeContentStateKind, string>([
  ['background-refresh', '오전 9:24'],
  ['partial', '오전 9:24'],
  ['stale', '오전 9:24'],
  ['dirty', '오전 9:24'],
  ['conflict', '오전 9:24'],
]);

const NEXT_TRANSITION: Readonly<Record<HomeContentStateKind, string>> = {
  'initial-loading': '요청 완료 → ready',
  'background-refresh': '새 응답 → ready',
  empty: '새로 확인 → background-refresh',
  partial: '다시 시도 → background-refresh',
  forbidden: '권한 변경 → ready',
  stale: '다시 시도 → background-refresh',
  'widget-error': '다시 시도 → initial-loading',
  dirty: '저장 또는 취소 → ready',
  conflict: '재적용 또는 최신본 → ready',
};

function StateContract({ kind }: { kind: HomeContentStateKind }) {
  const semantics = resolveHomeContentStateSemantics(kind);
  const affectedSources = AFFECTED_SOURCES.get(kind) ?? [];
  return (
    <Box
      data-state-spec-contract={kind}
      sx={{
        display: 'grid',
        gridTemplateColumns: 'max-content minmax(0, 1fr)',
        gap: 0.5,
        mb: 1.25,
        p: 1,
        bgcolor: 'action.hover',
        borderRadius: 1,
      }}
    >
      {[
        ['콘텐츠 차단', semantics.blocksContent ? '예' : '아니오'],
        ['검증 콘텐츠 유지', semantics.preservesVerifiedContent ? '예' : '아니오'],
        ['영향 원천', affectedSources.join(', ') || '해당 없음'],
        ['마지막 성공', LAST_SUCCESS.get(kind) ?? '해당 없음'],
        ['다음 동작', NEXT_TRANSITION[kind]],
      ].map(([label, value]) => (
        <Typography key={label} variant="caption" component="span">
          <Box component="strong" sx={{ fontWeight: 700 }}>
            {label}
          </Box>{' '}
          {value}
        </Typography>
      ))}
    </Box>
  );
}

function PreservedContent({ kind }: { kind: HomeContentStateKind }) {
  return (
    <Paper
      variant="outlined"
      data-home-state-preserved-sample={kind}
      sx={{ p: 1.5, mb: 1, minHeight: 72 }}
    >
      <Typography variant="subtitle2">검증된 콘텐츠 유지 영역</Typography>
      <Typography variant="body2" color="text.secondary">
        마지막으로 성공한 원천 데이터는 새 응답을 기다리는 동안 계속 표시됩니다.
      </Typography>
    </Paper>
  );
}

function StateSpec() {
  useLayoutEffect(() => {
    document.documentElement.lang = 'ko-KR';
  }, []);
  return (
    <Box component="main" data-testid="home-wave2-state-spec" sx={{ p: { xs: 2, md: 4 } }}>
      <Stack gap={0.75} sx={{ mb: 3 }}>
        <Typography component="h1" variant="h4" fontWeight={800}>
          Classic Home 상태 컴포넌트 계약
        </Typography>
        <Typography color="text.secondary">
          차단 상태와 검증 콘텐츠 유지 상태를 동일한 운영 규칙으로 비교합니다.
        </Typography>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        {HOME_CONTENT_STATES.map((kind) => {
          const semantics = resolveHomeContentStateSemantics(kind);
          const affectedSources = AFFECTED_SOURCES.get(kind) ?? [];
          return (
            <Paper
              component="section"
              key={kind}
              variant="outlined"
              data-state-spec-kind={kind}
              sx={{ p: 2, minWidth: 0 }}
            >
              <Typography component="h2" variant="overline" fontWeight={800}>
                {kind}
              </Typography>
              <StateContract kind={kind} />
              <HomeContentState
                kind={kind}
                title={kind === 'widget-error' ? '업무 요약을 불러오지 못했습니다' : undefined}
                description={
                  kind === 'widget-error'
                    ? '업무 요약 위젯만 중단되었습니다. 홈의 다른 영역은 계속 사용할 수 있습니다.'
                    : undefined
                }
                affectedSources={affectedSources}
                lastSuccessfulAt={LAST_SUCCESS.get(kind)}
                onAction={ACTIONABLE_STATES.has(kind) ? () => undefined : undefined}
                preservedContent={
                  semantics.preservesVerifiedContent ? <PreservedContent kind={kind} /> : undefined
                }
                size="standard"
              />
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
}

document.documentElement.dataset.wave2Fixture = 'HOME_STATE_ALL_STATES_DESKTOP';
writeLocalePreference('ko');

createRoot(document.getElementById('root')!).render(
  <I18nProvider namespaces={['common', 'home']}>
    <DwpThemeProvider>
      <Suspense fallback={<div aria-busy="true">Loading</div>}>
        <StateSpec />
      </Suspense>
    </DwpThemeProvider>
  </I18nProvider>
);
