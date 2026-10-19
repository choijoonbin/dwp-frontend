import { useCallback, useEffect, useState } from 'react';

import {
  parsePer004Projection,
  PER004_FEATURE_DEFAULT_ENABLED,
  PER004_PROVIDER_BOUND,
} from './per004-contract';
import type { Per004Action, Per004Projection, Per004Variant } from './per004-contract';

import './per004-workspace.css';

export type Per004DataSource = Readonly<{
  load: (variant: Per004Variant) => Promise<unknown>;
}>;
export type Per004ActionExecutor = (descriptor: Per004Action) => Promise<'SUCCEEDED' | 'STEP_UP_REQUIRED'>;
export type Per004ViewState =
  | 'LOADING' | 'EMPTY' | 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE' | 'FORBIDDEN' | 'STEP_UP';

export type Per004WorkspaceViewProps = Readonly<{
  variant: Per004Variant;
  state: Per004ViewState;
  projection?: Per004Projection;
  locale?: 'en' | 'ko';
  retryable?: boolean;
  onRetry?: () => void;
  onAction?: (action: Per004Action) => void;
}>;

const copy = {
  en: {
    forms: 'Performance forms and rating scales',
    settings: 'Performance policy settings',
    loading: 'Loading performance configuration…',
    empty: 'No governed configuration is available yet.',
    unavailable: 'Configuration information is temporarily unavailable.',
    forbidden: 'You do not have access to this configuration.',
    partial: 'Some configuration information is unavailable. No actions are offered for incomplete evidence.',
    stepUp: 'Additional verification is required before this action can continue.',
    retry: 'Try again',
    status: 'Status',
    masked: 'Restricted',
    create: 'Create version',
    validate: 'Validate',
    simulate: 'Simulate',
    submit: 'Submit for approval',
    approve: 'Approve',
    publish: 'Publish',
  },
  ko: {
    forms: '성과 평가 양식 및 평점 척도',
    settings: '성과 정책 설정',
    loading: '성과 설정을 불러오는 중입니다…',
    empty: '아직 사용 가능한 관리형 설정이 없습니다.',
    unavailable: '설정 정보를 일시적으로 사용할 수 없습니다.',
    forbidden: '이 설정에 접근할 권한이 없습니다.',
    partial: '일부 설정 정보를 사용할 수 없습니다. 근거가 불완전한 작업은 표시되지 않습니다.',
    stepUp: '이 작업을 계속하려면 추가 인증이 필요합니다.',
    retry: '다시 시도',
    status: '상태',
    masked: '접근 제한',
    create: '버전 생성',
    validate: '검증',
    simulate: '시뮬레이션',
    submit: '승인 요청 제출',
    approve: '승인',
    publish: '게시',
  },
} as const;

function actionLabel(action: Per004Action, language: keyof typeof copy): string {
  const suffix = action.actionKey.split('.').at(-1);
  const key = suffix === 'versions' ? 'create' : suffix;
  if (key === 'validate' || key === 'simulate' || key === 'submit' ||
      key === 'approve' || key === 'publish' || key === 'create') return copy[language][key];
  return '';
}

export function Per004WorkspaceView({ variant, state, projection, locale = 'en', retryable = false,
  onRetry, onAction }: Per004WorkspaceViewProps) {
  const language = locale === 'ko' ? 'ko' : 'en';
  const labels = copy[language];
  const title = variant === 'FORMS_SCALES' ? labels.forms : labels.settings;
  const message = state === 'LOADING' ? labels.loading
    : state === 'EMPTY' ? labels.empty
    : state === 'FORBIDDEN' ? labels.forbidden
    : state === 'PARTIAL' ? labels.partial
    : state === 'STEP_UP' ? labels.stepUp
    : state === 'UNAVAILABLE' ? labels.unavailable : null;
  return (
    <section className="per004-workspace" aria-labelledby={`per004-${variant}-title`}>
      <header className="per004-workspace__header">
        <h1 id={`per004-${variant}-title`}>{title}</h1>
      </header>
      {message && (
        <div className="per004-workspace__notice" role={state === 'LOADING' ? 'status' : 'alert'}
          aria-live={state === 'LOADING' ? 'polite' : 'assertive'}>
          <p>{message}</p>
          {retryable && onRetry && state !== 'LOADING' && (
            <button type="button" onClick={onRetry}>{labels.retry}</button>
          )}
        </div>
      )}
      {(state === 'COMPLETE' || state === 'PARTIAL') && projection && (
        <ul className="per004-workspace__items" aria-label={title}>
          {projection.items.map((item) => (
            <li className="per004-workspace__item" key={item.itemPublicId}>
              <h2>{item.title}</h2>
              <p><span>{labels.status}: </span><strong>{item.statusCode.replaceAll('_', ' ')}</strong></p>
              <dl className="per004-workspace__fields">
                {Object.entries(item.fieldGroups).map(([group, field]) => (
                  <div key={group}>
                    <dt>{group.replaceAll('_', ' ')}</dt>
                    <dd>{field.decision === 'MASK' ? labels.masked : String(
                      typeof field.value === 'object' && field.value !== null
                        ? Object.entries(field.value as Record<string, unknown>)
                          .map(([key, value]) => `${key}: ${String(value ?? '—')}`).join(' · ')
                        : field.value ?? '—'
                    )}</dd>
                  </div>
                ))}
              </dl>
              {state === 'COMPLETE' && item.availableActions.map((action) => (
                <button className="per004-workspace__action" type="button" key={action.actionKey}
                  disabled={!onAction} onClick={() => onAction?.(action)}>
                  {actionLabel(action, language)}
                </button>
              ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export type Per004WorkspaceProps = Readonly<{
  variant: Per004Variant;
  mounted?: boolean;
  featureEnabled?: boolean;
  enrolled?: boolean;
  providerBound?: boolean;
  dataSource?: Per004DataSource;
  actionExecutor?: Per004ActionExecutor;
  locale?: 'en' | 'ko';
}>;

/** No route or menu imports this component. All four production gates default closed. */
export function Per004Workspace({ variant, mounted = false,
  featureEnabled = PER004_FEATURE_DEFAULT_ENABLED, enrolled = false,
  providerBound = PER004_PROVIDER_BOUND, dataSource, actionExecutor, locale = 'en' }: Per004WorkspaceProps) {
  const active = mounted && featureEnabled && enrolled && providerBound && !!dataSource;
  const [state, setState] = useState<Per004ViewState>('LOADING');
  const [projection, setProjection] = useState<Per004Projection>();
  const [retryCount, setRetryCount] = useState(0);
  const [retryable, setRetryable] = useState(false);
  useEffect(() => {
    if (!active || !dataSource) return;
    let cancelled = false;
    setState('LOADING');
    dataSource.load(variant).then((wire) => {
      if (cancelled) return;
      const parsed = parsePer004Projection(wire, variant);
      setProjection(parsed);
      setState(parsed.queryState.state);
      setRetryable(parsed.queryState.partialFailures.some((failure) => failure.retryable));
    }).catch((error: unknown) => {
      if (cancelled) return;
      setProjection(undefined);
      setState(error instanceof Error && error.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'UNAVAILABLE');
      setRetryable(!(error instanceof Error && error.message === 'FORBIDDEN'));
    });
    return () => { cancelled = true; };
  }, [active, dataSource, retryCount, variant]);
  const retry = useCallback(() => setRetryCount((count) => count + 1), []);
  const act = useCallback((action: Per004Action) => {
    if (!active || !actionExecutor) return;
    actionExecutor(action).then((result) => {
      if (result === 'STEP_UP_REQUIRED') setState('STEP_UP');
      else retry();
    }).catch(() => { setState('UNAVAILABLE'); setRetryable(true); });
  }, [active, actionExecutor, retry]);
  if (!active) return null;
  return <Per004WorkspaceView variant={variant} state={state} projection={projection}
    locale={locale} retryable={retryable} onRetry={retry} onAction={actionExecutor ? act : undefined} />;
}
