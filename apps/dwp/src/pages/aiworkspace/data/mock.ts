// TODO: Replace mock data with API-backed data when backend integration is ready.

import type {
  PlanStep,
  ThoughtChain,
  AgentMessage,
  TimelineStep,
  ExecutionLog,
  ActionExecution,
  ContextSnapshot,
} from '@dwp-frontend/shared-utils/aura/use-aura-store';

type AiWorkspaceMockData = {
  messages: AgentMessage[];
  thoughtChains: ThoughtChain[];
  planSteps: PlanStep[];
  timelineSteps: TimelineStep[];
  actionExecutions: ActionExecution[];
  executionLogs: ExecutionLog[];
  contextSnapshot: ContextSnapshot;
};

export const createAiWorkspaceMockData = (): AiWorkspaceMockData => {
  const now = new Date();
  const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60 * 1000);

  const messages: AgentMessage[] = [
    {
      id: 'mock-msg-1',
      role: 'user',
      content: '사용자 관리 화면의 필터 기능을 개선해줘. 검색할 때 너무 느린 것 같아.',
      timestamp: minutesAgo(4),
    },
    {
      id: 'mock-msg-2',
      role: 'assistant',
      content:
        '네, 사용자 관리 화면의 필터 성능을 분석하고 개선하겠습니다.\n\n현재 분석 결과:\n1. 검색 입력 시 즉시 API 호출이 발생합니다.\n2. 필터 상태 변경 시 전체 컴포넌트가 리렌더링됩니다.\n\n다음 최적화를 제안합니다:\n- 검색 입력에 300ms 디바운스 적용\n- 필터 상태 메모이제이션\n- API 결과 캐싱',
      timestamp: minutesAgo(3),
      metadata: {
        result: {
          type: 'text',
          title: '요약 결과',
          content:
            '검색 입력 디바운스 적용과 필터 상태 메모이제이션으로 불필요한 API 호출과 리렌더링을 줄입니다.',
        },
      },
    },
  ];

  const thoughtChains: ThoughtChain[] = [
    {
      id: 'mock-thought-1',
      type: 'analysis',
      content: '사용자 요청을 분석하고 있습니다. 현재 페이지의 컴포넌트 구조를 파악 중...',
      timestamp: minutesAgo(3),
      sources: [
        { type: 'code', name: 'page.tsx', path: '/app/admin/users/page.tsx' },
        { type: 'conversation', name: '이전 대화' },
      ],
    },
    {
      id: 'mock-thought-2',
      type: 'planning',
      content: '사용자 관리 화면의 필터 기능 개선을 위한 계획을 수립하고 있습니다.',
      timestamp: minutesAgo(2),
    },
    {
      id: 'mock-thought-3',
      type: 'execution',
      content: '필터 컴포넌트를 분석하여 최적화 포인트를 식별했습니다.',
      timestamp: minutesAgo(1),
      sources: [{ type: 'metadata', name: '컴포넌트 분석 결과' }],
    },
  ];

  const planSteps: PlanStep[] = [
    {
      id: 'mock-plan-1',
      title: '현재 필터 구조 분석',
      description: '기존 필터 컴포넌트의 구조와 상태 관리 방식을 분석합니다.',
      order: 0,
      canSkip: false,
      status: 'completed',
      confidence: 0.95,
    },
    {
      id: 'mock-plan-2',
      title: '필터 상태 최적화',
      description: '불필요한 리렌더링을 방지하기 위해 필터 상태를 최적화합니다.',
      order: 1,
      canSkip: false,
      status: 'executing',
      confidence: 0.88,
    },
    {
      id: 'mock-plan-3',
      title: '디바운스 적용',
      description: '검색 입력에 디바운스를 적용하여 API 호출을 최적화합니다.',
      order: 2,
      canSkip: true,
      status: 'pending',
      confidence: 0.92,
    },
    {
      id: 'mock-plan-4',
      title: '결과 검증',
      description: '변경 사항이 의도한 대로 작동하는지 검증합니다.',
      order: 3,
      canSkip: false,
      status: 'pending',
      confidence: 0.85,
    },
  ];

  const timelineSteps: TimelineStep[] = [
    {
      id: 'mock-timeline-1',
      title: '요청 분석',
      description: '사용자 요청을 분석하고 이해합니다.',
      status: 'completed',
      timestamp: minutesAgo(4),
    },
    {
      id: 'mock-timeline-2',
      title: '계획 수립',
      description: '작업 단계를 계획합니다.',
      status: 'processing',
      timestamp: minutesAgo(3),
    },
    {
      id: 'mock-timeline-3',
      title: '실행',
      description: '계획된 작업을 실행합니다.',
      status: 'pending',
      timestamp: minutesAgo(2),
    },
    {
      id: 'mock-timeline-4',
      title: '결과 검증',
      description: '실행 결과를 검증합니다.',
      status: 'pending',
      timestamp: minutesAgo(1),
    },
  ];

  const actionExecutions: ActionExecution[] = [
    {
      id: 'mock-exec-1',
      tool: 'analyze',
      params: { target: '/app/admin/users/page.tsx' },
      status: 'completed',
      timestamp: minutesAgo(2),
      result: '컴포넌트 분석 완료: 3개의 최적화 포인트 발견',
    },
    {
      id: 'mock-exec-2',
      tool: 'optimize',
      params: { scope: 'search-filter' },
      status: 'executing',
      timestamp: minutesAgo(1),
    },
  ];

  const executionLogs: ExecutionLog[] = [
    {
      id: 'mock-log-1',
      timestamp: minutesAgo(3),
      type: 'info',
      content: '작업을 시작합니다...',
    },
    {
      id: 'mock-log-2',
      timestamp: minutesAgo(3),
      type: 'command',
      content: '$ analyzing /app/admin/users/page.tsx',
    },
    {
      id: 'mock-log-3',
      timestamp: minutesAgo(2),
      type: 'api',
      content: 'GET /api/users?page=1&limit=10 - 200 OK (45ms)',
    },
    {
      id: 'mock-log-4',
      timestamp: minutesAgo(1),
      type: 'success',
      content: '컴포넌트 분석 완료: 3개의 최적화 포인트 발견',
    },
  ];

  const contextSnapshot: ContextSnapshot = {
    url: typeof window !== 'undefined' ? window.location.href : 'https://dwp.example.com/admin/users',
    title: typeof document !== 'undefined' ? document.title : '사용자 관리 - DWP Admin',
    metadata: {
      pathname: '/admin/users',
      activeApp: 'admin',
      screen: 'users',
      filters: 'all',
    },
    timestamp: now,
  };

  return {
    messages,
    thoughtChains,
    planSteps,
    timelineSteps,
    actionExecutions,
    executionLogs,
    contextSnapshot,
  };
};
