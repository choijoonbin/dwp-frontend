import '@dwp-frontend/design-system/styles/global.css';

import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { DwpThemeProvider } from '@dwp-frontend/design-system/appearance';
import { I18nProvider } from '@dwp-frontend/shared-i18n';
import { writeLocalePreference } from '@dwp-frontend/shared-utils/locale-preference';
import {
  AlertTriangle,
  AppWindow,
  Bell,
  CircleDot,
  Clock3,
  FileText,
  Grid2X2,
  Keyboard,
  LockKeyhole,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
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

const sectionPaper = {
  border: '1px solid',
  borderColor: '#dce3f2',
  borderRadius: 2,
  bgcolor: '#fff',
  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
};

function MetaChip({
  children,
  tone = 'blue',
}: {
  children: ReactNode;
  tone?: 'blue' | 'amber' | 'green' | 'slate';
}) {
  const tones = {
    blue: { color: '#1d4ed8', backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
    amber: { color: '#92400e', backgroundColor: '#fffbeb', borderColor: '#fde68a' },
    green: { color: '#047857', backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
    slate: { color: '#475569', backgroundColor: '#f8fafc', borderColor: '#cbd5e1' },
  } as const;
  return (
    <Box
      component="span"
      sx={{
        ...tones[tone],
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 28,
        px: 1,
        border: '1px solid',
        borderRadius: 10,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {children}
    </Box>
  );
}

function SpecSection({
  index,
  eyebrow,
  title,
  trailing,
  children,
  minHeight,
}: {
  index: string;
  eyebrow: string;
  title: string;
  trailing?: ReactNode;
  children: ReactNode;
  minHeight?: number;
}) {
  return (
    <Paper component="section" elevation={0} sx={{ ...sectionPaper, minHeight, p: 3 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'flex-start', md: 'center' }}
        justifyContent="space-between"
        gap={1.5}
        sx={{ pb: 2, mb: 2.5, borderBottom: '1px solid #e2e8f0' }}
      >
        <Box>
          <Typography
            variant="caption"
            sx={{
              color: '#64748b',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '.09em',
            }}
          >
            {eyebrow}
          </Typography>
          <Typography
            component="h2"
            sx={{ mt: 0.5, fontSize: 21, fontWeight: 800, color: '#0f172a' }}
          >
            <Box
              component="span"
              sx={{
                display: 'inline-block',
                width: 7,
                height: 24,
                mr: 1.25,
                bgcolor: '#2563eb',
                borderRadius: 0.5,
                verticalAlign: 'middle',
              }}
            />
            {index}. {title}
          </Typography>
        </Box>
        {trailing}
      </Stack>
      {children}
    </Paper>
  );
}

function StateContract({ kind }: { kind: HomeContentStateKind }) {
  const semantics = resolveHomeContentStateSemantics(kind);
  const affectedSources = AFFECTED_SOURCES.get(kind) ?? [];
  return (
    <Box
      data-state-spec-contract={kind}
      sx={{
        display: 'grid',
        gridTemplateColumns: '120px minmax(0, 1fr)',
        gap: 0.6,
        p: 1.25,
        bgcolor: '#f6f7ff',
        border: '1px solid #e2e7ff',
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
        <Box key={label} sx={{ display: 'contents' }}>
          <Typography
            variant="caption"
            component="strong"
            sx={{ color: '#475569', fontWeight: 800 }}
          >
            {label}
          </Typography>
          <Typography
            variant="caption"
            component="span"
            sx={{ minWidth: 0, color: '#1e293b', overflowWrap: 'anywhere' }}
          >
            {value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function PreservedContent({ kind }: { kind: HomeContentStateKind }) {
  return (
    <Paper
      variant="outlined"
      data-home-state-preserved-sample={kind}
      sx={{ p: 1.25, mb: 1, minHeight: 68, bgcolor: '#fff' }}
    >
      <Typography variant="subtitle2" fontWeight={800}>
        검증된 콘텐츠 유지 영역
      </Typography>
      <Typography variant="body2" color="text.secondary">
        마지막으로 성공한 원천 데이터는 새 응답을 기다리는 동안 계속 표시됩니다.
      </Typography>
    </Paper>
  );
}

const STATE_TABS = ['success', 'empty', 'partial', 'retrying', 'retry-failed'] as const;

function WorkplaceShell({ children }: { children: ReactNode }) {
  const navigation = [
    'Classic Portal',
    'Operations',
    'Facility Scheduler',
    'Telemetry Health',
    'Service Catalogue',
  ];
  const navigationIcons = [AppWindow, CircleDot, Clock3, ShieldCheck, Grid2X2];
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#faf8ff', color: '#131b2e' }}>
      <Box
        component="header"
        sx={{
          position: 'fixed',
          inset: '0 0 auto 0',
          zIndex: 3,
          height: 64,
          bgcolor: '#283044',
          color: '#eef0ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
        }}
      >
        <Stack direction="row" alignItems="center" gap={2.5}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1,
                bgcolor: '#2563eb',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Grid2X2 size={18} />
            </Box>
            <Typography sx={{ fontWeight: 800, letterSpacing: '.06em' }}>DWP // OS</Typography>
          </Stack>
          <Box
            sx={{
              width: 320,
              height: 36,
              border: '1px solid rgba(255,255,255,.24)',
              borderRadius: 1,
              px: 1.25,
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Search size={17} />
            <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
              Search portal, telemetry, assets...
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" alignItems="center" gap={1.5}>
          <MetaChip tone="blue">✦ DWAI ON</MetaChip>
          <Grid2X2 size={18} />
          <Bell size={18} />
          <Box
            sx={{
              width: 32,
              height: 32,
              bgcolor: '#0053db',
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <UserRound size={17} />
          </Box>
        </Stack>
      </Box>
      <Box
        component="aside"
        sx={{
          position: 'fixed',
          zIndex: 2,
          inset: '64px auto 0 0',
          width: 248,
          bgcolor: '#fff',
          borderRight: '1px solid #e2e8f0',
          px: 1.5,
          py: 2,
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Typography variant="overline" sx={{ color: '#737686', px: 1 }}>
            Workplace Context
          </Typography>
          {navigation.map((item, index) => {
            const Icon = navigationIcons[index];
            return (
              <Stack
                key={item}
                direction="row"
                alignItems="center"
                gap={1}
                sx={{
                  mt: 0.5,
                  px: 1.25,
                  py: 1.1,
                  borderRadius: 1,
                  color: index === 0 ? '#004ac6' : '#434655',
                  bgcolor: index === 0 ? '#e2e7ff' : 'transparent',
                  fontWeight: index === 0 ? 700 : 400,
                }}
              >
                <Icon size={18} />
                <Typography variant="body2">{item}</Typography>
              </Stack>
            );
          })}
        </Box>
        <Box>
          <Typography variant="overline" sx={{ color: '#737686', px: 1 }}>
            Session &amp; Mode
          </Typography>
          <Stack
            direction="row"
            justifyContent="space-between"
            sx={{ mt: 0.5, p: 1.25, bgcolor: '#f2f3ff', borderRadius: 1 }}
          >
            <Typography variant="caption">● Cluster: Prod-NA</Typography>
            <LockKeyhole size={14} />
          </Stack>
          <Stack direction="row" gap={1} sx={{ p: 1.25 }}>
            <Settings size={17} />
            <Typography variant="body2">System Config</Typography>
          </Stack>
        </Box>
      </Box>
      <Box sx={{ ml: { xs: 0, md: '248px' }, pt: '64px' }}>{children}</Box>
    </Box>
  );
}

function StateSpec({ showPrimitives = false }: { showPrimitives?: boolean }) {
  const [activeTab, setActiveTab] = useState<(typeof STATE_TABS)[number]>('success');
  useEffect(() => {
    document.documentElement.lang = 'ko-KR';
  }, []);
  return (
    <WorkplaceShell>
      <Box
        component="main"
        data-testid="home-wave2-state-spec"
        sx={{ width: 1, minHeight: 2380, p: 3 }}
      >
        <Paper component="header" elevation={0} sx={{ ...sectionPaper, p: 3, mb: 3 }}>
          <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" gap={2}>
            <Box>
              <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mb: 1 }}>
                <MetaChip>SPEC BOARD A</MetaChip>
                <MetaChip tone="slate">FRAME: DESKTOP 1440 × 1200</MetaChip>
                <MetaChip tone="slate">BATCH-A-REQ</MetaChip>
              </Stack>
              <Typography component="h1" sx={{ fontSize: 28, lineHeight: 1.2, fontWeight: 800 }}>
                CLASSIC-STATE-COMPONENT-SPEC-A: Classic 상태 컴포넌트 명세
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                Empty &amp; Partial Batch A 상태 머신 · WCAG 2.2 AA (4.5:1 text, 3:1 UI boundaries)
                · Scroll Contract: height:auto / overflow-y:visible
              </Typography>
            </Box>
            <Stack alignItems={{ xs: 'flex-start', lg: 'flex-end' }} justifyContent="center">
              <Typography variant="caption" color="text.secondary">
                Cluster Telemetry
              </Typography>
              <Typography variant="subtitle2" color="primary">
                DWP-KN-ENGINE // v4.2.0
              </Typography>
            </Stack>
          </Stack>
          <Box
            sx={{
              mt: 2.5,
              p: 1.5,
              bgcolor: '#f2f3ff',
              borderRadius: 1,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
              gap: 2,
            }}
          >
            {[
              ['Target Shell', 'DWP Workplace OS'],
              ['Minimum Touch Target', '44 × 44 CSS px'],
              ['Contrast Standards', 'WCAG 2.2 AA Verified'],
              ['Reflow Boundaries', '320px ~ 1440px Fluid'],
            ].map(([label, value]) => (
              <Box key={label}>
                <Typography variant="caption" color="text.secondary">
                  {label}
                </Typography>
                <Typography variant="subtitle2" fontWeight={800}>
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>
        </Paper>

        <Paper
          component="section"
          elevation={0}
          sx={{ ...sectionPaper, p: 3, mb: 3, minHeight: 570 }}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={1.5}>
            <Box>
              <Typography variant="overline" color="text.secondary">
                ● Section 01 // Interactive Matrix
              </Typography>
              <Typography component="h2" sx={{ fontSize: 22, fontWeight: 800 }}>
                5 Core Component State Variants
              </Typography>
            </Box>
            <Stack
              role="tablist"
              direction="row"
              flexWrap="wrap"
              gap={0.5}
              sx={{ p: 0.5, bgcolor: '#f2f3ff', borderRadius: 1 }}
            >
              {STATE_TABS.map((tab) => (
                <Button
                  key={tab}
                  role="tab"
                  aria-selected={activeTab === tab}
                  onClick={() => setActiveTab(tab)}
                  size="small"
                  variant={activeTab === tab ? 'contained' : 'text'}
                  sx={{ minHeight: 44, textTransform: 'none' }}
                >
                  {tab}
                </Button>
              ))}
            </Stack>
          </Stack>
          <Box sx={{ mt: 2.5, p: 2, bgcolor: '#f2f3ff', borderRadius: 1.5, minHeight: 250 }}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="caption">
                ◉ Active State Canvas: <b>{activeTab.toUpperCase()}</b>
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Container Layout: Planar Flat (Anti-Nesting)
              </Typography>
            </Stack>
            <Paper elevation={0} sx={{ mt: 2, p: 2.5, border: '1px solid #dce3f2' }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" gap={1}>
                  <MetaChip>KNOWLEDGE HUB</MetaChip>
                  <Typography component="h3" fontWeight={800}>
                    전사 승인 문서 및 기술 지표
                  </Typography>
                  <Chip label="14" size="small" />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  ✓ 최신 확인: 14:32 KST
                </Typography>
              </Stack>
              {[
                [
                  'DWP-ARCH-2025-V2: 고가용성 하이브리드 리전 장애 격리 및 롤백 규약',
                  '인프라 거버넌스',
                ],
                ['DWP-SEC-09: 무중단 세션 동기화 및 생체 인증 SSO 토큰 만료 정책', '보안 아키텍처'],
              ].map(([title, source]) => (
                <Stack
                  key={title}
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ mt: 1.5, py: 1.25, borderTop: '1px solid #edf1f8' }}
                >
                  <Stack direction="row" gap={1}>
                    <FileText size={17} color="#2563eb" />
                    <Typography variant="body2">{title}</Typography>
                  </Stack>
                  <Stack direction="row" gap={1}>
                    <Typography variant="caption" color="text.secondary">
                      {source}
                    </Typography>
                    <Button size="small" sx={{ minHeight: 44 }}>
                      보기
                    </Button>
                  </Stack>
                </Stack>
              ))}
            </Paper>
          </Box>
          <Typography component="h3" sx={{ mt: 2.5, mb: 1, fontWeight: 800 }}>
            Variant Anatomy Comparison at a Glance
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(5, 1fr)' },
              gap: 1,
            }}
          >
            {STATE_TABS.map((tab, index) => (
              <Box key={tab} sx={{ p: 1.5, bgcolor: '#f2f3ff', minHeight: 112, borderRadius: 1 }}>
                <MetaChip
                  tone={index === 0 ? 'green' : index === 2 || index === 4 ? 'amber' : 'slate'}
                >
                  {tab}
                </MetaChip>
                <Typography variant="subtitle2" sx={{ mt: 1 }}>
                  {
                    [
                      'Normal List',
                      'Compact Bar',
                      'Isolated Fault',
                      'In-Flight Lock',
                      'Direct Redirect',
                    ][index]
                  }
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Role: {index === 4 ? 'alert (assertive)' : 'status'}
                </Typography>
              </Box>
            ))}
          </Box>
        </Paper>

        <Paper
          component="section"
          elevation={0}
          sx={{ ...sectionPaper, p: 3, mb: 3, minHeight: 600 }}
        >
          <Typography variant="overline" color="text.secondary">
            ● Section 02 // Interface specification
          </Typography>
          <Typography component="h2" sx={{ fontSize: 22, fontWeight: 800, mb: 2 }}>
            Data Field Structure &amp; A11y Schema Table
          </Typography>
          <Box
            component="table"
            sx={{
              width: 1,
              borderCollapse: 'collapse',
              '& th': { bgcolor: '#eef0ff', textAlign: 'left', fontSize: 12 },
              '& th, & td': {
                p: 1.4,
                borderBottom: '1px solid #e2e8f0',
                verticalAlign: 'top',
              },
              '& td': { fontSize: 12.5 },
            }}
          >
            <thead>
              <tr>
                {[
                  'Field Name',
                  'Data Type',
                  'Required State',
                  'Visual Mapping',
                  'A11y / ARIA Contract',
                ].map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                [
                  'source_label',
                  'string',
                  'All Variants',
                  '상단 컨텍스트 배지',
                  'aria-label="데이터 출처"',
                ],
                ['state_title', 'string', 'All Variants', 'Headline-SM', 'heading level 3 (h3)'],
                [
                  'description',
                  'string | ReactNode',
                  'empty, partial, retry-failed',
                  'Body-SM text',
                  'aria-describedby mapping',
                ],
                [
                  'lastSuccessfulSync',
                  'ISO8601 string',
                  'success, partial',
                  '우측 상태 메타데이터',
                  '<time datetime="...">',
                ],
                [
                  'primaryAction',
                  'ActionConfig',
                  'partial, retrying, retry-failed',
                  'Primary 44px button',
                  'aria-disabled while in-flight',
                ],
                [
                  'secondaryAction',
                  'ActionConfig (optional)',
                  'partial, retry-failed',
                  'Secondary button',
                  'external link aria-haspopup',
                ],
                [
                  'screenReaderAnnouncement',
                  "AriaLiveMode ('polite'|'assertive')",
                  'partial, retrying, retry-failed',
                  '시각 비노출 라이브 리전',
                  'aria-live="polite"',
                ],
              ].map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, index) => (
                    <td
                      key={cell}
                      style={{
                        color: index === 0 ? '#1d4ed8' : undefined,
                        fontFamily: index < 2 ? 'ui-monospace, monospace' : undefined,
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Box>
          <Box sx={{ mt: 2, p: 1.5, bgcolor: '#f2f3ff', borderRadius: 1 }}>
            <Typography variant="caption">
              ▱ Enum Tag Reservations for Batch B: &nbsp; forbidden (403 ACL) &nbsp; stale (TTL
              만료) &nbsp; loading (최초 골격) &nbsp; refreshing (백그라운드 갱신)
            </Typography>
          </Box>
        </Paper>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
            gap: 3,
            mb: 3,
          }}
        >
          <Paper component="section" elevation={0} sx={{ ...sectionPaper, p: 3, minHeight: 510 }}>
            <Typography variant="overline" color="text.secondary">
              ● Section 03 // Spatial rules
            </Typography>
            <Typography component="h2" sx={{ fontSize: 20, fontWeight: 800, mb: 2 }}>
              Responsive &amp; Reflow Constraints
            </Typography>
            {[
              ['Desktop vs Mobile Viewport Budget', '1440px / 328px'],
              ['한/영 80자 이상 텍스트 처리 규칙', 'break-words / truncate'],
              ['Touch Target & Typography Minimums', 'Min 44 × 44 px'],
            ].map(([title, code]) => (
              <Box key={title} sx={{ p: 2, mb: 1.5, bgcolor: '#f2f3ff', borderRadius: 1 }}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="subtitle2" fontWeight={800}>
                    {title}
                  </Typography>
                  <Typography variant="caption" color="primary" sx={{ fontFamily: 'monospace' }}>
                    {code}
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  320px 최소 뷰포트에서도 내부 컨테이너가 100% 폭으로 재배치되고 단일 문서 스크롤을
                  유지합니다.
                </Typography>
              </Box>
            ))}
          </Paper>
          <Paper component="section" elevation={0} sx={{ ...sectionPaper, p: 3, minHeight: 510 }}>
            <Typography variant="overline" color="text.secondary">
              ● Section 04 // State machine
            </Typography>
            <Typography component="h2" sx={{ fontSize: 20, fontWeight: 800, mb: 2 }}>
              Retry State Flow &amp; ARIA Transition Timeline
            </Typography>
            <Button variant="contained" startIcon={<RefreshCw size={17} />} sx={{ minHeight: 44 }}>
              다시 시도
            </Button>
            {[
              '1. IDLE (대기 / 부분 결함 노출)',
              '2. RETRYING (비동기 요청 진행)',
              '3. RESULT (분기 및 포커스 복원)',
            ].map((item) => (
              <Box key={item} sx={{ mt: 2, pl: 2, borderLeft: '2px solid #bfdbfe' }}>
                <Typography variant="subtitle2" fontWeight={800}>
                  {item}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  라이브 리전 발화와 aria-busy 상태를 동기화하고 완료 시 트리거로 포커스를
                  복원합니다.
                </Typography>
              </Box>
            ))}
            <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <Box sx={{ p: 1.5, bgcolor: '#ecfdf5' }}>
                <b>SUCCESS</b>
                <Typography variant="caption" display="block">
                  {'aria-live="polite"'}
                </Typography>
              </Box>
              <Box sx={{ p: 1.5, bgcolor: '#fff1f2' }}>
                <b>FAILED</b>
                <Typography variant="caption" display="block">
                  {'role="alert"'}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Box>

        {showPrimitives && (
          <Paper component="section" elevation={0} sx={{ ...sectionPaper, p: 3, minHeight: 620 }}>
            <Typography variant="overline" color="text.secondary">
              ● Production primitive evidence
            </Typography>
            <Typography component="h2" sx={{ fontSize: 20, fontWeight: 800, mb: 2 }}>
              9 production HomeContentState primitives
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                gap: 1.5,
                alignItems: 'start',
              }}
            >
              {HOME_CONTENT_STATES.map((kind) => {
                const semantics = resolveHomeContentStateSemantics(kind);
                const affectedSources = AFFECTED_SOURCES.get(kind) ?? [];
                return (
                  <Paper
                    component="article"
                    key={kind}
                    variant="outlined"
                    data-state-spec-kind={kind}
                    sx={{ p: 1.5, minWidth: 0, bgcolor: '#fff' }}
                  >
                    <Typography component="h3" variant="overline" fontWeight={800}>
                      {kind}
                    </Typography>
                    <StateContract kind={kind} />
                    <Box sx={{ mt: 1 }}>
                      <HomeContentState
                        kind={kind}
                        title={
                          kind === 'widget-error' ? '업무 요약을 불러오지 못했습니다' : undefined
                        }
                        description={
                          kind === 'widget-error'
                            ? '업무 요약 위젯만 중단되었습니다. 홈의 다른 영역은 계속 사용할 수 있습니다.'
                            : undefined
                        }
                        affectedSources={affectedSources}
                        lastSuccessfulAt={LAST_SUCCESS.get(kind)}
                        onAction={ACTIONABLE_STATES.has(kind) ? () => undefined : undefined}
                        preservedContent={
                          semantics.preservesVerifiedContent ? (
                            <PreservedContent kind={kind} />
                          ) : undefined
                        }
                        size="compact"
                      />
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          </Paper>
        )}
      </Box>
    </WorkplaceShell>
  );
}

const KEYBOARD_STEPS = [
  ['Skip Link', '본문 바로가기', 'Tab'],
  ['Header Focus', '상단 DWP 헤더', 'Tab'],
  ['Mode Switch', '[홈 편집] 버튼', 'Enter / Space'],
  ['Widget Nav & Menu', '개인 위젯 탐색 및 이동 메뉴', 'Tab / Shift+Tab'],
  ['Reorder / Group', '앞으로/뒤로 또는 그룹 이동', 'Space + 방향키'],
  ['Span / Density', '너비/밀도 선택', 'Arrow keys'],
  ['Hide & Restore', '숨기기/복원', 'Enter'],
  ['Undo / Redo', '실행 취소/다시 실행', 'Ctrl+Z / Ctrl+Y'],
  ['Commit / Discard', '레이아웃 저장 또는 변경 취소', 'Enter'],
] as const;

function C18AccessibilitySpec() {
  const [sandboxStatus, setSandboxStatus] = useState('READY');
  useEffect(() => {
    document.documentElement.lang = 'ko-KR';
  }, []);
  return (
    <Box
      component="main"
      data-testid="home-wave2-c18-spec"
      sx={{
        bgcolor: '#f8fafc',
        color: '#1e293b',
        minHeight: 5950,
        p: { xs: 2, lg: 4 },
        '& *:focus-visible': { outline: '2px solid #2563eb', outlineOffset: 2 },
      }}
    >
      <Stack gap={4} sx={{ width: 1, maxWidth: 1440, mx: 'auto' }}>
        <Paper component="header" elevation={0} sx={{ ...sectionPaper, p: 4, minHeight: 300 }}>
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            justifyContent="space-between"
            gap={2}
            sx={{ pb: 3, borderBottom: '1px solid #e2e8f0' }}
          >
            <Box>
              <Stack direction="row" gap={1} flexWrap="wrap">
                <MetaChip tone="amber">[REVIEW] DWP CLASSIC ARCHITECTURE</MetaChip>
                <MetaChip tone="slate">SPEC: C18-KEYBOARD-REDUCED-MOTION-r02</MetaChip>
              </Stack>
              <Typography
                component="h1"
                sx={{ mt: 1.25, fontSize: 30, fontWeight: 850, lineHeight: 1.2 }}
              >
                CLASSIC SPEC C18: 홈 편집·저장 충돌·키보드 내비게이션 &amp; Reduced Motion 명세
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                조직 포털 개인화 위젯 엔진 키보드 단독 조작 보장, 포커스 트래핑·복원, 409 버전 충돌
                해결 및 감각 반응성 표준
              </Typography>
            </Box>
            <Stack direction="row" gap={1} flexWrap="wrap" alignContent="flex-start">
              <MetaChip tone="amber">Status: [REVIEW]</MetaChip>
              <MetaChip tone="slate">exportIncluded=false</MetaChip>
              <MetaChip tone="blue">supersedes=SCREEN_3</MetaChip>
              <MetaChip tone="green">WCAG 2.2 AA Verified</MetaChip>
            </Stack>
          </Stack>
          <Box
            sx={{
              mt: 3,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' },
              gap: 2,
            }}
          >
            {[
              ['Scope', '개인화 엔진 (C15, C16)', '상태 머신, 충돌 해결, 제어권'],
              ['WCAG 2.5.7 Dragging', 'Drag-Free Alternative', '마우스 없이 Space + Arrow 완결'],
              [
                'WCAG 2.4.11 Focus Obscured',
                'Zero Obscured Targets',
                '고정 툴바 및 모달 침범 금지',
              ],
              [
                'WCAG 2.5.8 Target Size',
                'Min 24×24px / 44×44px Touch',
                '충분한 오프셋 및 탭 여백 보장',
              ],
            ].map(([label, value, note]) => (
              <Box
                key={label}
                sx={{ p: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 1 }}
              >
                <Typography variant="overline" color="text.secondary">
                  {label}
                </Typography>
                <Typography variant="subtitle2" fontWeight={800}>
                  {value}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {note}
                </Typography>
              </Box>
            ))}
          </Box>
        </Paper>

        <SpecSection
          index="01"
          eyebrow="Keyboard-only contract"
          title="편집 모드 진입 및 키보드 단독 여정 (Drag-Free Journey: 9-Step Sequence)"
          trailing={<MetaChip tone="slate">WCAG 2.1.1 / 2.5.7</MetaChip>}
          minHeight={1040}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
              gap: 2,
              mb: 3,
            }}
          >
            {[
              [
                '진입점 A: Top Action',
                'Tab Stop 3',
                '상단 유틸리티 영역의 [홈 편집] 버튼에서 Enter 또는 Space로 편집 모드에 진입합니다.',
              ],
              [
                '진입점 B: Widget Context',
                'Menu Trigger',
                '위젯 헤더의 더보기 메뉴에서 [홈 편집]을 선택하여 해당 위젯 컨텍스트로 진입합니다.',
              ],
              [
                '진입점 C: Mobile Long Press',
                '550ms Hold',
                '지속 터치와 이동 임계값 10px을 구분하여 스크롤 제스처를 보호합니다.',
              ],
            ].map(([title, code, body]) => (
              <Box
                key={title}
                sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: 1, minHeight: 140 }}
              >
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="subtitle2" color="primary" fontWeight={800}>
                    {title}
                  </Typography>
                  <MetaChip tone="slate">{code}</MetaChip>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {body}
                </Typography>
              </Box>
            ))}
          </Box>
          <Box sx={{ p: 3, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
            <Stack direction="row" alignItems="center" gap={1}>
              <Keyboard size={19} color="#2563eb" />
              <Typography component="h3" fontWeight={850}>
                Complete 9-Step Keyboard Navigation Sequence
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Step 1 to Step 9 End-to-End Coverage
              </Typography>
            </Stack>
            <Box
              sx={{
                mt: 2,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
                gap: 2,
              }}
            >
              {KEYBOARD_STEPS.map(([type, title, key], index) => {
                const tone =
                  index === 2
                    ? '#2563eb'
                    : index === 4
                      ? '#d97706'
                      : index === 8
                        ? '#059669'
                        : '#334155';
                return (
                  <Box
                    key={type}
                    sx={{
                      minHeight: 160,
                      p: 2,
                      bgcolor: '#fff',
                      border: `2px solid ${index === 2 || index === 4 || index === 8 ? tone : '#e2e8f0'}`,
                      borderRadius: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Box>
                      <Stack direction="row" justifyContent="space-between">
                        <Box
                          sx={{
                            width: 28,
                            height: 28,
                            bgcolor: tone,
                            color: '#fff',
                            borderRadius: '50%',
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: 800,
                          }}
                        >
                          {index + 1}
                        </Box>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          {type}
                        </Typography>
                      </Stack>
                      <Typography variant="subtitle2" fontWeight={800} sx={{ mt: 1 }}>
                        {title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        포커스 순서와 작업 결과를 사용자에게 명확하게 알리고 현재 초안을 보존합니다.
                      </Typography>
                    </Box>
                    <Typography
                      variant="caption"
                      color="primary"
                      sx={{
                        pt: 1,
                        mt: 1,
                        borderTop: '1px solid #e2e8f0',
                        fontFamily: 'monospace',
                        fontWeight: 800,
                      }}
                    >
                      Key: {key}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
            <Box
              role="status"
              aria-live="polite"
              sx={{
                mt: 2.5,
                p: 2,
                bgcolor: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: 1,
              }}
            >
              <Typography variant="subtitle2" fontWeight={800}>
                스크린리더 사용자 키보드 드래그 안내 발화 규격
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, fontFamily: 'monospace' }}>
                “내 앱 위젯을 선택했습니다. 화살표 키로 이동하고 Space 키로 놓으세요.”
              </Typography>
            </Box>
          </Box>
        </SpecSection>

        <SpecSection
          index="02"
          eyebrow="Focus lifecycle"
          title="포커스 & 스크롤 복원 매트릭스 (Focus & Scroll Restoration: 9 Rows)"
          trailing={<MetaChip tone="blue">Focus &amp; Scroll Matrix</MetaChip>}
          minHeight={850}
        >
          <Box
            component="table"
            sx={{
              width: 1,
              borderCollapse: 'collapse',
              '& th': { bgcolor: '#f1f5f9', textAlign: 'left', color: '#475569' },
              '& th, & td': {
                p: 1.6,
                fontSize: 12.5,
                borderBottom: '1px solid #e2e8f0',
                verticalAlign: 'top',
              },
            }}
          >
            <thead>
              <tr>
                {['이벤트', '초기 포커스', 'Esc / 종료 결과', '스크롤 및 복원 계약'].map(
                  (heading) => (
                    <th key={heading}>{heading}</th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {KEYBOARD_STEPS.map(([type, title, key], index) => (
                <tr key={type}>
                  <td>
                    <b>
                      {index + 1}. {title}
                    </b>
                  </td>
                  <td>
                    <Box component="code" sx={{ color: '#1d4ed8' }}>
                      {type}
                    </Box>
                  </td>
                  <td>{index % 2 ? '직전 트리거 복원' : '현재 상태 유지'}</td>
                  <td>
                    Focus Path {index + 1} · {key} · 단일 문서 Y 위치 보존
                  </td>
                </tr>
              ))}
            </tbody>
          </Box>
          <Box
            sx={{
              mt: 2.5,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 2,
            }}
          >
            <Box sx={{ p: 2, bgcolor: '#0f172a', color: '#e2e8f0', borderRadius: 1 }}>
              <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                FOCUS RESTORE ALGORITHM
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, fontFamily: 'monospace' }}>
                triggerRef.current?.focus(&#123; preventScroll: true &#125;);
                <br />
                requestAnimationFrame(restoreScrollPosition);
              </Typography>
            </Box>
            <Box sx={{ p: 2, bgcolor: '#0f172a', color: '#e2e8f0', borderRadius: 1 }}>
              <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                SCROLL POSITION CONTRACT
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, fontFamily: 'monospace' }}>
                document.scrollingElement · overflow-y: visible · nested scroll: 0
              </Typography>
            </Box>
          </Box>
        </SpecSection>

        <SpecSection
          index="03"
          eyebrow="Draft state lifecycle"
          title="초안 보존 및 저장 상태 머신 (Exactly 6 State Variants Cards)"
          trailing={<MetaChip tone="amber">6 canonical states</MetaChip>}
          minHeight={850}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
              gap: 2,
            }}
          >
            {[
              ['CLEAN', '편집 가능한 기본 상태', '#f8fafc', '#cbd5e1'],
              ['DIRTY', '로컬 초안 변경됨', '#eff6ff', '#93c5fd'],
              ['SAVING', '버전 조건부 저장 중', '#eef2ff', '#a5b4fc'],
              ['SAVE-FAILED', '저장 실패 · 초안 유지', '#fffbeb', '#fcd34d'],
              ['CONFLICT (409)', '서버 최신본과 충돌', '#fff1f2', '#fda4af'],
              ['REAPPLIED', '내 변경 재적용 완료', '#ecfdf5', '#6ee7b7'],
            ].map(([name, label, bg, border], index) => (
              <Box
                key={name}
                sx={{
                  minHeight: 240,
                  p: 2.5,
                  bgcolor: bg,
                  border: `2px solid ${border}`,
                  borderRadius: 1,
                }}
              >
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="overline" fontWeight={900}>
                    {index + 1}. {name}
                  </Typography>
                  <MetaChip tone={index === 4 ? 'amber' : index === 5 ? 'green' : 'slate'}>
                    {index < 3 ? 'polite' : 'assertive'}
                  </MetaChip>
                </Stack>
                <Typography variant="subtitle2" fontWeight={800} sx={{ mt: 2 }}>
                  {label}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  version, updatedAt, local draft hash를 함께 보존하고 다음 전이를 명확히
                  노출합니다.
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ display: 'block', mt: 3, fontFamily: 'monospace' }}
                >
                  Focus Restore: {index === 4 ? '충돌 해결 선택지' : '저장 트리거'}
                </Typography>
              </Box>
            ))}
          </Box>
          <Box
            sx={{ mt: 2.5, p: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 1 }}
          >
            <Typography variant="caption" color="error.main">
              × Never lose the local draft &nbsp; × 409 상태를 일반 오류로 축약 금지 &nbsp; ✓ 사용자
              선택으로만 최신본/재적용 결정
            </Typography>
          </Box>
        </SpecSection>

        <SpecSection
          index="04"
          eyebrow="Motion policy"
          title="모션 매트릭스 (Standard Motion vs Reduced Motion)"
          trailing={<MetaChip tone="green">prefers-reduced-motion: reduce</MetaChip>}
          minHeight={790}
        >
          <Box
            component="table"
            sx={{
              width: 1,
              borderCollapse: 'collapse',
              '& th': { bgcolor: '#f1f5f9', textAlign: 'left' },
              '& th, & td': { p: 1.6, fontSize: 12.5, borderBottom: '1px solid #e2e8f0' },
            }}
          >
            <thead>
              <tr>
                <th>인터랙션 및 컴포넌트</th>
                <th>일반 모션</th>
                <th>감소 모션</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['위젯 재배치', 'transform 180ms ease', '즉시 위치 변경'],
                ['상태 전환', 'opacity 120ms', 'duration 0ms'],
                ['저장 진행 표시', '회전 progress', '정적 상태 아이콘'],
                ['다이얼로그', 'scale + fade', '즉시 표시'],
                ['스크롤 복원', 'auto / anchored', 'smooth 금지'],
                ['뉴스 캐러셀', '자동 순환', '자동 순환 일시정지'],
              ].map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, index) => (
                    <td
                      key={cell}
                      style={{
                        color: index === 2 ? '#047857' : undefined,
                        fontWeight: index === 0 ? 700 : 400,
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Box>
          <Box
            sx={{ mt: 3, p: 2.5, bgcolor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 1 }}
          >
            <Stack direction="row" gap={1.5}>
              <AlertTriangle size={22} color="#d97706" />
              <Box>
                <Typography variant="subtitle2" fontWeight={850}>
                  Reduced Transparency 금지: 반투명도에 정보 의미를 의존하지 않습니다.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  감소 모션 환경에서도 포커스 링, 상태 경계, 저장 결과 및 오류 의미를 색상 외
                  텍스트와 아이콘으로 함께 전달합니다.
                </Typography>
              </Box>
            </Stack>
          </Box>
        </SpecSection>

        <SpecSection
          index="05"
          eyebrow="Layout geometry"
          title="단일 문서 스크롤 & 셸 지오메트리 공식 (Single Document Scroll & Geometry)"
          trailing={<MetaChip tone="slate">overflow-y: visible</MetaChip>}
          minHeight={710}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 2,
            }}
          >
            {[
              [
                '1440px Production Viewport 공식',
                'Viewport 1440 − Sidebar 248 = Content 1192',
                '3열 그리드와 본문 단일 Y 스크롤. 편집 툴바는 포커스 목표를 가리지 않습니다.',
              ],
              [
                '1280px Preview Viewport 공식',
                'Viewport 1280 − Sidebar 248 = Content 1032',
                '2열 리플로우와 동일한 문서 순서. 별도 위젯 스크롤을 만들지 않습니다.',
              ],
            ].map(([title, formula, body]) => (
              <Box
                key={title}
                sx={{
                  minHeight: 290,
                  p: 2.5,
                  bgcolor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 1,
                }}
              >
                <Typography component="h3" variant="subtitle1" fontWeight={850}>
                  {title}
                </Typography>
                <Box
                  sx={{
                    mt: 2,
                    p: 2,
                    bgcolor: '#fff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 1,
                  }}
                >
                  <Typography sx={{ fontFamily: 'monospace', color: '#1d4ed8', fontWeight: 800 }}>
                    {formula}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  {body}
                </Typography>
                <Box sx={{ mt: 3, height: 8, bgcolor: '#e2e8f0', borderRadius: 10 }}>
                  <Box
                    sx={{
                      width: title.startsWith('1440') ? '83%' : '81%',
                      height: 1,
                      bgcolor: '#22c55e',
                      borderRadius: 10,
                    }}
                  />
                </Box>
              </Box>
            ))}
          </Box>
          <Box
            sx={{
              mt: 2,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
              gap: 1.5,
            }}
          >
            {['포커스 목표 가림 0건', '중첩 세로 스크롤 0건', '320px 가로 오버플로 0px'].map(
              (item) => (
                <Box
                  key={item}
                  sx={{ p: 2, border: '1px solid #bbf7d0', bgcolor: '#f0fdf4', borderRadius: 1 }}
                >
                  <Typography variant="subtitle2" color="#047857" fontWeight={850}>
                    ✓ {item}
                  </Typography>
                </Box>
              )
            )}
          </Box>
        </SpecSection>

        <SpecSection
          index="06"
          eyebrow="Interactive evidence"
          title="실시간 인터랙션 샌드박스 (Interactive Test Sandbox)"
          trailing={<MetaChip tone="green">runtime verified</MetaChip>}
          minHeight={800}
        >
          <Stack direction="row" gap={1} flexWrap="wrap">
            <Button
              variant="contained"
              startIcon={<Keyboard size={17} />}
              onClick={() => setSandboxStatus('EDITING')}
              sx={{ minHeight: 44 }}
            >
              편집 모드 진입
            </Button>
            <Button
              color="error"
              variant="outlined"
              startIcon={<AlertTriangle size={17} />}
              onClick={() => setSandboxStatus('CONFLICT_409')}
              sx={{ minHeight: 44 }}
            >
              저장 충돌(409) 재현
            </Button>
            <MetaChip tone={sandboxStatus === 'CONFLICT_409' ? 'amber' : 'green'}>
              CURRENT STATE: {sandboxStatus}
            </MetaChip>
          </Stack>
          <Box
            role="status"
            aria-live="polite"
            sx={{
              mt: 2,
              p: 2,
              bgcolor: '#0f172a',
              color: '#e2e8f0',
              borderRadius: 1,
              fontFamily: 'monospace',
            }}
          >
            ARIA-LIVE OUTPUT:{' '}
            {sandboxStatus === 'CONFLICT_409'
              ? '저장 충돌이 감지되었습니다. 해결 방법을 선택하세요.'
              : sandboxStatus === 'EDITING'
                ? '편집 모드입니다. 내 앱 위젯을 이동할 수 있습니다.'
                : '사용 준비 완료.'}
          </Box>
          <Paper
            elevation={0}
            sx={{ mt: 2.5, p: 2.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}
          >
            <Typography component="h3" fontWeight={850}>
              내 앱 (My Applications Hub)
            </Typography>
            <Box
              sx={{
                mt: 2,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' },
                gap: 1.5,
              }}
            >
              {[
                ['업무 시작', ['업무', 'DWAI·ON', '활동']],
                ['소통과 협업', ['소식', '캘린더', '메일']],
                ['구성원과 서비스', ['서비스', '인사']],
                ['시스템과 통제', ['지식', 'ERP', '관리']],
              ].map(([group, apps]) => (
                <Box
                  key={group as string}
                  sx={{ p: 2, bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: 1 }}
                >
                  <Typography variant="subtitle2" fontWeight={800}>
                    {group as string}
                  </Typography>
                  <Stack direction="row" gap={1} sx={{ mt: 2 }}>
                    {(apps as string[]).map((app, index) => (
                      <Button
                        key={app}
                        aria-label={app}
                        variant="outlined"
                        sx={{
                          minWidth: 44,
                          width: 44,
                          height: 44,
                          p: 0,
                          bgcolor: `${['#2563eb', '#7c3aed', '#059669'][index % 3]}14`,
                        }}
                      >
                        {app.slice(0, 1)}
                      </Button>
                    ))}
                  </Stack>
                </Box>
              ))}
            </Box>
          </Paper>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mt: 2.5, p: 2, bgcolor: '#0f172a', color: '#fff', borderRadius: 1 }}
          >
            <Stack direction="row" gap={1}>
              <RotateCcw size={17} />
              <Typography variant="body2">변경 3건 · 로컬 초안 보존</Typography>
            </Stack>
            <Stack direction="row" gap={1}>
              <Button variant="text" sx={{ color: '#fff', minHeight: 44 }}>
                변경 취소
              </Button>
              <Button variant="contained" startIcon={<Save size={17} />} sx={{ minHeight: 44 }}>
                저장
              </Button>
            </Stack>
          </Stack>
        </SpecSection>

        <Box
          component="footer"
          sx={{ p: 2.5, border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: '#fff' }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" gap={1}>
              <ShieldCheck size={19} color="#2563eb" />
              <Typography variant="body2">
                DWP OS Design System Spec Batch A Verified · Production Release v4.2.0
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Architect: Workplace Core Platform UI Lab
            </Typography>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}

const query = new URLSearchParams(window.location.search);
const c18 = query.get('board') === 'c18';
const primitives = query.get('board') === 'primitives';
document.documentElement.dataset.wave2Fixture = c18
  ? 'HOME_SPEC_ACCESSIBILITY_SPEC'
  : 'HOME_STATE_ALL_STATES_DESKTOP';
writeLocalePreference('ko');

createRoot(document.getElementById('root')!).render(
  <I18nProvider namespaces={['common', 'home']}>
    <DwpThemeProvider>
      <Suspense fallback={<div aria-busy="true">Loading</div>}>
        {c18 ? <C18AccessibilitySpec /> : <StateSpec showPrimitives={primitives} />}
      </Suspense>
    </DwpThemeProvider>
  </I18nProvider>
);
