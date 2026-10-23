import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { Per008ClientError, Per008CommandOutcomeUnknownError } from './per008-client';
import type { Per008Client } from './per008-client';
import {
  PER008_CREATE_ACTION_KEY,
  PER008_FEATURE_DEFAULT_ENABLED,
  PER008_PROVIDER_BOUND,
} from './per008-model';
import type {
  Per008CommandContext,
  Per008CreateAction,
  Per008CreateFeedbackRequestCommand,
  Per008FeedbackActionTarget,
  Per008ProtectedState,
  Per008RequestOptions,
  Per008TeamItem,
  Per008TeamProjection,
  Per008TeamQuery,
} from './per008-model';
import {
  formatPer008Instant,
  per008Copy,
  Per008ActionNotice,
  Per008ProtectedNotice,
  Per008RequestComposer,
} from './per008-ui';
import type { Per008Locale } from './per008-ui';

import './per008-workspace.css';

const teamCopy = {
  en: {
    eyebrow: 'Team performance', title: 'Performance feedback',
    description: 'Review one team member at a time and request feedback from an explicit authorized assignment.',
    filters: 'Filter team performance', assignment: 'Performance assignment', due: 'Due status',
    profile: 'Profile', effectiveOn: 'Effective on', sort: 'Sort', apply: 'Apply filters', clear: 'Clear',
    results: 'Authorized team members', detail: 'Selected team member', status: 'Status',
    select: 'View details', noSelection: 'Select a team member to inspect the authorized details.',
    actionUnavailable: 'A request cannot be started because the exact action target is unavailable.',
    outcomeUnknown: 'The request outcome is unknown. Replay with the same request key to confirm it safely.',
    replay: 'Replay safely', previous: 'Previous page', next: 'Next page', page: 'Page',
    filterCodeHint: 'Separate multiple exact codes with commas.',
  },
  ko: {
    eyebrow: '팀 성과', title: '성과 피드백',
    description: '권한이 확인된 한 명의 팀 구성원과 배정을 선택해 피드백을 요청합니다.',
    filters: '팀 성과 필터', assignment: '성과 배정', due: '마감 상태', profile: '구성원',
    effectiveOn: '기준일', sort: '정렬', apply: '필터 적용', clear: '초기화',
    results: '권한이 확인된 팀 구성원', detail: '선택한 팀 구성원', status: '상태',
    select: '상세 보기', noSelection: '팀 구성원을 선택하면 권한이 확인된 상세 정보를 볼 수 있습니다.',
    actionUnavailable: '정확한 작업 대상이 확인되지 않아 요청을 시작할 수 없습니다.',
    outcomeUnknown: '요청 결과를 확인할 수 없습니다. 동일한 요청 키로 안전하게 재실행해 확인하세요.',
    replay: '동일 키로 재실행', previous: '이전 페이지', next: '다음 페이지', page: '페이지',
    filterCodeHint: '정확한 코드를 여러 개 입력할 때는 쉼표로 구분하세요.',
  },
} as const;

const localizedCodes: Record<Per008Locale, Readonly<Record<string, string>>> = {
  en: {
    ACTIVE: 'Active', AGGREGATED: 'Aggregated', ASSIGNED: 'Assigned', CANCELLED: 'Cancelled',
    CLOSED: 'Closed', DECLINED: 'Declined', DRAFT: 'Draft', DUE_SOON: 'Due soon', OPEN: 'Open',
    RELEASED: 'Released', SUBMITTED: 'Submitted',
  },
  ko: {
    ACTIVE: '재직', AGGREGATED: '집계 완료', ASSIGNED: '배정됨', CANCELLED: '취소됨',
    CLOSED: '마감됨', DECLINED: '거절됨', DRAFT: '초안', DUE_SOON: '마감 임박', OPEN: '진행 중',
    RELEASED: '공개됨', SUBMITTED: '제출됨',
  },
} as const;

function localizedCode(value: string, locale: Per008Locale): string {
  return localizedCodes[locale][value] ?? value.replaceAll('_', ' ');
}

function showsProtectedRows(state: Per008ProtectedState): boolean {
  return state === 'COMPLETE' || state === 'PARTIAL' || state === 'STALE';
}

function stateFromError(error: unknown): Per008ProtectedState {
  if (!(error instanceof Per008ClientError)) return 'UNAVAILABLE';
  if (error.code === 'DENIED' || error.code === 'NOT_FOUND') return 'DENIED';
  if (error.code === 'STALE') return 'STALE';
  if (error.code === 'SUPPRESSED') return 'SUPPRESSED';
  return 'UNAVAILABLE';
}

function displayField(item: Per008TeamItem, group: 'PERFORMANCE_ASSIGNMENT' | 'DUE_STATUS' | 'LIMITED_PROFILE',
  locale: Per008Locale): string {
  if (group === 'PERFORMANCE_ASSIGNMENT') {
    const field = item.fieldGroups.PERFORMANCE_ASSIGNMENT;
    if (!field) return per008Copy[locale].omitted;
    return field.decision === 'VIEW' ? field.value.label : per008Copy[locale].masked;
  }
  if (group === 'DUE_STATUS') {
    const field = item.fieldGroups.DUE_STATUS;
    if (!field) return per008Copy[locale].omitted;
    return field.decision === 'VIEW'
      ? `${localizedCode(field.value.code, locale)} · r${field.value.revision}` : per008Copy[locale].masked;
  }
  const field = item.fieldGroups.LIMITED_PROFILE;
  if (!field) return per008Copy[locale].omitted;
  return field.decision === 'VIEW'
    ? `${localizedCode(field.value.code, locale)} · r${field.value.revision}` : per008Copy[locale].masked;
}

type TeamFilterChange = Readonly<{
  filter: Per008TeamQuery['filter'];
  sort: Per008TeamQuery['sort'];
}>;

type TeamViewProps = Readonly<{
  state: Per008ProtectedState;
  projection?: Per008TeamProjection;
  selectedItemId?: string;
  requestOptions?: Per008RequestOptions;
  commandMessage?: string;
  actionState?: Per008ProtectedState;
  commandBusy?: boolean;
  displayTimeZone?: string;
  pageNumber?: number;
  canPreviousPage?: boolean;
  canNextPage?: boolean;
  locale?: Per008Locale;
  onRetry?: () => void;
  onSelect?: (itemPublicId: string) => void;
  onQuery?: (query: TeamFilterChange) => void;
  onBeginRequest?: (action: Per008CreateAction, target: Per008FeedbackActionTarget) => void;
  onCancelRequest?: () => void;
  onCreateRequest?: (command: Per008CreateFeedbackRequestCommand) => void;
  onReplay?: () => void;
  onPreviousPage?: () => void;
  onNextPage?: () => void;
}>;

export function Per008TeamPerformanceView({ state, projection, selectedItemId, requestOptions,
  commandMessage, actionState, commandBusy = false, displayTimeZone = 'UTC', pageNumber = 1,
  canPreviousPage = false, canNextPage = false, locale = 'ko', onRetry, onSelect, onQuery,
  onBeginRequest, onCancelRequest, onCreateRequest, onReplay, onPreviousPage,
  onNextPage }: TeamViewProps) {
  const labels = teamCopy[locale];
  const common = per008Copy[locale];
  const filterHintId = useId();
  const visibleProjection = showsProtectedRows(state) ? projection : undefined;
  const selected = visibleProjection?.items.find((item) => item.itemPublicId === selectedItemId) ??
    visibleProjection?.items[0];
  const targetField = selected?.fieldGroups.PERFORMANCE_FEEDBACK_ACTION_TARGET;
  const canAct = state === 'COMPLETE' && visibleProjection?.queryState.freshness === 'CURRENT' &&
    targetField?.decision === 'VIEW';
  const action = canAct ? selected?.availableActions.find((candidate): candidate is Per008CreateAction =>
    candidate.actionKey === PER008_CREATE_ACTION_KEY) : undefined;
  return (
    <section className="per008-workspace" aria-labelledby="per008-team-title">
      <header className="per008-page-header">
        <div>
          <p className="per008-eyebrow">{labels.eyebrow}</p>
          <h1 id="per008-team-title">{labels.title}</h1>
          <p>{labels.description}</p>
        </div>
        {visibleProjection && (
          <div className="per008-freshness" aria-label={common.lastRefresh}>
            <strong>{state === 'STALE' ? common.stale : common.current}</strong>
            <span>{common.lastRefresh}: {formatPer008Instant(visibleProjection.asOf, locale,
              displayTimeZone)} ({displayTimeZone})</span>
          </div>
        )}
      </header>

      <Per008ProtectedNotice state={state} locale={locale} onRetry={onRetry} />
      {actionState && <Per008ActionNotice state={actionState} locale={locale} />}
      {commandMessage && <p className="per008-success" role="status">{commandMessage}</p>}
      {onReplay && <button className="per008-button per008-button--secondary" type="button"
        disabled={commandBusy} onClick={onReplay}>{labels.replay}</button>}

      {onQuery && (
        <form className="per008-filter-bar" role="search" aria-label={labels.filters}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const values = (key: string) => String(data.get(key) ?? '').split(',')
              .map((value) => value.trim()).filter(Boolean);
            const effectiveOn = String(data.get('effectiveOn') ?? '').trim() || undefined;
            onQuery({
              filter: {
                ...(values('performanceAssignment').length ? {
                  performanceAssignment: { codes: values('performanceAssignment') },
                } : {}),
                ...(values('dueStatus').length ? { dueStatus: { codes: values('dueStatus') } } : {}),
                ...(values('limitedProfile').length ? {
                  limitedProfile: { codes: values('limitedProfile') },
                } : {}),
                ...(effectiveOn ? { effectiveOn } : {}),
              },
              sort: [String(data.get('sort') ?? 'itemPublicId:ASC') as Per008TeamQuery['sort'][number]],
            });
          }}>
          <label>{labels.assignment}<input name="performanceAssignment" aria-describedby={filterHintId}
            autoComplete="off" spellCheck={false} disabled={commandBusy} /></label>
          <label>{labels.due}<input name="dueStatus" aria-describedby={filterHintId}
            autoComplete="off" spellCheck={false} disabled={commandBusy} /></label>
          <label>{labels.profile}<input name="limitedProfile" aria-describedby={filterHintId}
            autoComplete="off" spellCheck={false} disabled={commandBusy} /></label>
          <label>{labels.effectiveOn}<input name="effectiveOn" type="date" disabled={commandBusy} /></label>
          <label>{labels.sort}
            <select name="sort" defaultValue="itemPublicId:ASC" disabled={commandBusy}>
              <option value="itemPublicId:ASC">ID ↑</option>
              <option value="itemPublicId:DESC">ID ↓</option>
              <option value="performanceAssignment:ASC">{labels.assignment} ↑</option>
              <option value="performanceAssignment:DESC">{labels.assignment} ↓</option>
              <option value="dueStatus:ASC">{labels.due} ↑</option>
              <option value="dueStatus:DESC">{labels.due} ↓</option>
              <option value="limitedProfile:ASC">{labels.profile} ↑</option>
              <option value="limitedProfile:DESC">{labels.profile} ↓</option>
            </select>
          </label>
          <div className="per008-filter-actions">
            <button className="per008-button per008-button--quiet" type="reset"
              disabled={commandBusy}>{labels.clear}</button>
            <button className="per008-button per008-button--primary" type="submit"
              disabled={commandBusy}>{labels.apply}</button>
          </div>
          <small id={filterHintId} className="per008-filter-hint">{labels.filterCodeHint}</small>
        </form>
      )}

      {visibleProjection && visibleProjection.items.length > 0 && (
        <div className="per008-list-detail">
          <section className="per008-list-pane" aria-labelledby="per008-team-results">
            <div className="per008-pane-heading">
              <h2 id="per008-team-results">{labels.results}</h2>
              <span>{visibleProjection.items.length}</span>
            </div>
            <ul className="per008-record-list">
              {visibleProjection.items.map((item) => (
                <li key={item.itemPublicId}>
                  <button type="button" className="per008-record-button"
                    aria-current={selected?.itemPublicId === item.itemPublicId ? 'true' : undefined}
                    onClick={() => onSelect?.(item.itemPublicId)}>
                    <strong>{item.title}</strong>
                    <span>{displayField(item, 'PERFORMANCE_ASSIGNMENT', locale)}</span>
                    <small>{labels.status}: {localizedCode(item.statusCode, locale)}</small>
                    <span className="per008-visually-hidden">{labels.select}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section className="per008-detail-pane" aria-labelledby="per008-team-detail">
            <div className="per008-pane-heading"><h2 id="per008-team-detail">{labels.detail}</h2></div>
            {selected ? (
              <div className="per008-detail-content">
                <h3>{selected.title}</h3>
                <dl className="per008-definition-list">
                  <div><dt>{labels.assignment}</dt><dd>{displayField(selected, 'PERFORMANCE_ASSIGNMENT', locale)}</dd></div>
                  <div><dt>{labels.due}</dt><dd>{displayField(selected, 'DUE_STATUS', locale)}</dd></div>
                  <div><dt>{labels.profile}</dt><dd>{displayField(selected, 'LIMITED_PROFILE', locale)}</dd></div>
                </dl>
                {action && targetField?.decision === 'VIEW' && onBeginRequest ? (
                  <button className="per008-button per008-button--primary" type="button"
                    disabled={commandBusy}
                    onClick={() => onBeginRequest(action, targetField.value)}>{common.requestFeedback}</button>
                ) : <p className="per008-muted">{labels.actionUnavailable}</p>}
              </div>
            ) : <p>{labels.noSelection}</p>}
          </section>
        </div>
      )}

      {(canPreviousPage || canNextPage) && (
        <nav className="per008-pagination" aria-label={`${labels.results} ${labels.page} ${pageNumber}`}>
          <button className="per008-button per008-button--quiet" type="button"
            disabled={commandBusy || !canPreviousPage} onClick={onPreviousPage}>{labels.previous}</button>
          <span aria-current="page">{labels.page} {pageNumber}</span>
          <button className="per008-button per008-button--quiet" type="button"
            disabled={commandBusy || !canNextPage} onClick={onNextPage}>{labels.next}</button>
        </nav>
      )}

      {state === 'COMPLETE' && requestOptions && onCancelRequest && onCreateRequest && (
        <Per008RequestComposer options={requestOptions} locale={locale} busy={commandBusy}
          timeZone={displayTimeZone} onCancel={onCancelRequest} onSubmit={onCreateRequest} />
      )}
    </section>
  );
}

export type Per008TeamPerformanceWorkspaceProps = Readonly<{
  mounted?: boolean;
  featureEnabled?: boolean;
  enrolled?: boolean;
  providerBound?: boolean;
  contextScopeKey?: string;
  client?: Pick<Per008Client, 'loadTeamPerformance' | 'loadRequestOptions' | 'createFeedbackRequest'>;
  initialQuery?: Per008TeamQuery;
  commandContextFactory?: (action: Per008CreateAction, target: Per008FeedbackActionTarget) => Per008CommandContext;
  locale?: Per008Locale;
}>;

/** Unmounted by design. All four rollout gates default closed, so no owner call can occur. */
export function Per008TeamPerformanceWorkspace({ mounted = false,
  featureEnabled = PER008_FEATURE_DEFAULT_ENABLED, enrolled = false,
  providerBound = PER008_PROVIDER_BOUND, contextScopeKey, client, commandContextFactory,
  initialQuery, locale = 'ko' }: Per008TeamPerformanceWorkspaceProps) {
  const active = mounted && featureEnabled && enrolled && providerBound && !!client && !!initialQuery &&
    !!contextScopeKey?.trim();
  const [state, setState] = useState<Per008ProtectedState>('LOADING');
  const [stateContextKey, setStateContextKey] = useState<string>();
  const [projection, setProjection] = useState<Per008TeamProjection>();
  const [projectionContextKey, setProjectionContextKey] = useState<string>();
  const [query, setQuery] = useState<Per008TeamQuery | undefined>(initialQuery);
  const [queryContextKey, setQueryContextKey] = useState<string | undefined>(contextScopeKey);
  const [retryCount, setRetryCount] = useState(0);
  const [selectedItemId, setSelectedItemId] = useState<string>();
  const [pendingAction, setPendingAction] = useState<Per008CreateAction>();
  const [pendingTarget, setPendingTarget] = useState<Per008FeedbackActionTarget>();
  const [options, setOptions] = useState<Per008RequestOptions>();
  const [optionsContextKey, setOptionsContextKey] = useState<string>();
  const [commandBusy, setCommandBusy] = useState(false);
  const [commandBusyContextKey, setCommandBusyContextKey] = useState<string>();
  const [commandMessage, setCommandMessage] = useState<string>();
  const [commandMessageContextKey, setCommandMessageContextKey] = useState<string>();
  const [actionState, setActionState] = useState<Per008ProtectedState>();
  const [actionStateContextKey, setActionStateContextKey] = useState<string>();
  const [cursorTrail, setCursorTrail] = useState<readonly (string | null)[]>([
    initialQuery?.cursor ?? null,
  ]);
  const [cursorTrailContextKey, setCursorTrailContextKey] = useState<string | undefined>(contextScopeKey);
  const [unknownCreate, setUnknownCreate] = useState<Readonly<{
    contextScopeKey: string;
    command: Per008CreateFeedbackRequestCommand;
    context: Per008CommandContext;
  }>>();
  const optionsSequence = useRef(0);
  const commandSequence = useRef(0);
  const currentContextScopeKey = useRef(contextScopeKey);
  currentContextScopeKey.current = contextScopeKey;
  const effectiveQuery = queryContextKey === contextScopeKey ? query : initialQuery;

  useEffect(() => {
    commandSequence.current += 1;
    setUnknownCreate(undefined);
    setCommandMessage(undefined);
    setCommandMessageContextKey(undefined);
    setCommandBusy(false);
    setCommandBusyContextKey(undefined);
    setCursorTrail([initialQuery?.cursor ?? null]);
    setCursorTrailContextKey(contextScopeKey);
  }, [contextScopeKey, initialQuery?.cursor]);

  useEffect(() => {
    if (!active || !client || !effectiveQuery || !contextScopeKey) return;
    let cancelled = false;
    const requestedContextKey = contextScopeKey;
    optionsSequence.current += 1;
    setOptions(undefined);
    setPendingAction(undefined);
    setPendingTarget(undefined);
    setActionState(undefined);
    setActionStateContextKey(undefined);
    setProjection(undefined);
    setProjectionContextKey(undefined);
    setState('LOADING');
    setStateContextKey(requestedContextKey);
    client.loadTeamPerformance(effectiveQuery).then((next) => {
      if (cancelled) return;
      setProjection(next);
      setProjectionContextKey(requestedContextKey);
      setStateContextKey(requestedContextKey);
      setState(next.queryState.state === 'PARTIAL' ? 'PARTIAL'
        : next.queryState.freshness === 'STALE' ? 'STALE' : next.queryState.state);
      setSelectedItemId((current) => next.items.some((item) => item.itemPublicId === current)
        ? current : next.items[0]?.itemPublicId);
    }).catch((error: unknown) => {
      if (cancelled) return;
      setProjection(undefined);
      setProjectionContextKey(undefined);
      setStateContextKey(requestedContextKey);
      setState(stateFromError(error));
    });
    return () => { cancelled = true; };
  }, [active, client, contextScopeKey, effectiveQuery, retryCount]);

  const retry = useCallback(() => {
    optionsSequence.current += 1;
    commandSequence.current += 1;
    setOptions(undefined);
    setOptionsContextKey(undefined);
    setPendingAction(undefined);
    setPendingTarget(undefined);
    setActionState(undefined);
    setActionStateContextKey(undefined);
    setUnknownCreate(undefined);
    setCommandMessage(undefined);
    setCommandMessageContextKey(undefined);
    setCommandBusy(false);
    setCommandBusyContextKey(undefined);
    setProjection(undefined);
    setProjectionContextKey(undefined);
    setState('LOADING');
    setStateContextKey(contextScopeKey);
    setRetryCount((count) => count + 1);
  }, [contextScopeKey]);
  const beginRequest = useCallback((action: Per008CreateAction, target: Per008FeedbackActionTarget) => {
    if (!active || !client || !contextScopeKey || projectionContextKey !== contextScopeKey ||
        (commandBusy && commandBusyContextKey === contextScopeKey) ||
        action.actionKey !== PER008_CREATE_ACTION_KEY) return;
    const sequence = ++optionsSequence.current;
    const requestedContextKey = contextScopeKey;
    setCommandBusy(true);
    setCommandBusyContextKey(requestedContextKey);
    setCommandMessage(undefined);
    setCommandMessageContextKey(undefined);
    setActionState(undefined);
    setActionStateContextKey(undefined);
    setOptions(undefined);
    setOptionsContextKey(undefined);
    client.loadRequestOptions(target).then((next) => {
      if (sequence !== optionsSequence.current ||
          currentContextScopeKey.current !== requestedContextKey) return;
      setPendingAction(action);
      setPendingTarget(target);
      setOptions(next);
      setOptionsContextKey(requestedContextKey);
    }).catch((error: unknown) => {
      if (sequence !== optionsSequence.current ||
          currentContextScopeKey.current !== requestedContextKey) return;
      setOptions(undefined);
      setOptionsContextKey(undefined);
      setPendingAction(undefined);
      setPendingTarget(undefined);
      setActionState(stateFromError(error));
      setActionStateContextKey(requestedContextKey);
    })
      .finally(() => {
        if (sequence === optionsSequence.current && currentContextScopeKey.current === requestedContextKey) {
          setCommandBusy(false);
          setCommandBusyContextKey(undefined);
        }
      });
  }, [active, client, commandBusy, commandBusyContextKey, contextScopeKey, projectionContextKey]);
  const executeCreate = useCallback((command: Per008CreateFeedbackRequestCommand,
    context: Per008CommandContext, requestedContextKey: string) => {
    if (!client || currentContextScopeKey.current !== requestedContextKey) return;
    const sequence = ++commandSequence.current;
    setCommandBusy(true);
    setCommandBusyContextKey(requestedContextKey);
    setActionState(undefined);
    setActionStateContextKey(undefined);
    client.createFeedbackRequest(command, context).then(() => {
      if (sequence !== commandSequence.current ||
          currentContextScopeKey.current !== requestedContextKey) return;
      setUnknownCreate(undefined);
      setOptions(undefined);
      setOptionsContextKey(undefined);
      setPendingAction(undefined);
      setPendingTarget(undefined);
      setActionState(undefined);
      setActionStateContextKey(undefined);
      setCommandMessage(per008Copy[locale].requestCreated);
      setCommandMessageContextKey(requestedContextKey);
    }).catch((error: unknown) => {
      if (sequence !== commandSequence.current ||
          currentContextScopeKey.current !== requestedContextKey) return;
      if (error instanceof Per008CommandOutcomeUnknownError) {
        setUnknownCreate({ contextScopeKey: requestedContextKey, command, context });
        setOptions(undefined);
        setOptionsContextKey(undefined);
        setPendingAction(undefined);
        setPendingTarget(undefined);
        setCommandMessage(teamCopy[locale].outcomeUnknown);
        setCommandMessageContextKey(requestedContextKey);
      } else {
        setUnknownCreate(undefined);
        setCommandMessage(undefined);
        setCommandMessageContextKey(undefined);
        setOptions(undefined);
        setOptionsContextKey(undefined);
        setPendingAction(undefined);
        setPendingTarget(undefined);
        setActionState(stateFromError(error));
        setActionStateContextKey(requestedContextKey);
      }
    }).finally(() => {
      if (sequence === commandSequence.current &&
          currentContextScopeKey.current === requestedContextKey) {
        setCommandBusy(false);
        setCommandBusyContextKey(undefined);
      }
    });
  }, [client, locale]);
  const createRequest = useCallback((command: Per008CreateFeedbackRequestCommand) => {
    if (!active || !client || !contextScopeKey || optionsContextKey !== contextScopeKey ||
        !pendingAction || !pendingTarget || !options || !commandContextFactory ||
        command.cycleVersionId !== pendingTarget.cycleVersionId ||
        command.subjectWorkerPublicId !== pendingTarget.subjectWorkerPublicId ||
        command.subjectAssignmentPublicId !== pendingTarget.subjectAssignmentPublicId) return;
    let context: Per008CommandContext;
    try { context = commandContextFactory(pendingAction, pendingTarget); }
    catch {
      setOptions(undefined);
      setOptionsContextKey(undefined);
      setPendingAction(undefined);
      setPendingTarget(undefined);
      setActionState('DENIED');
      setActionStateContextKey(contextScopeKey);
      return;
    }
    if (context.expectedDecisionRevision !== pendingTarget.authorizationDecisionRevision) {
      setOptions(undefined);
      setOptionsContextKey(undefined);
      setPendingAction(undefined);
      setPendingTarget(undefined);
      setActionState('DENIED');
      setActionStateContextKey(contextScopeKey);
      return;
    }
    executeCreate(command, context, contextScopeKey);
  }, [active, client, commandContextFactory, contextScopeKey, executeCreate, options,
    optionsContextKey, pendingAction, pendingTarget]);
  const cancelRequest = useCallback(() => {
    optionsSequence.current += 1;
    setOptions(undefined);
    setOptionsContextKey(undefined);
    setPendingAction(undefined);
    setPendingTarget(undefined);
    setActionState(undefined);
    setActionStateContextKey(undefined);
  }, []);
  const selectItem = useCallback((itemId: string) => {
    optionsSequence.current += 1;
    setOptions(undefined);
    setOptionsContextKey(undefined);
    setPendingAction(undefined);
    setPendingTarget(undefined);
    setActionState(undefined);
    setActionStateContextKey(undefined);
    setSelectedItemId(itemId);
  }, []);
  if (!active) return null;
  const contextMatches = projectionContextKey === contextScopeKey;
  const visibleState = stateContextKey === contextScopeKey ? state : 'LOADING';
  const visibleUnknown = unknownCreate?.contextScopeKey === contextScopeKey ? unknownCreate : undefined;
  const visibleBusy = commandBusyContextKey === contextScopeKey && commandBusy;
  const activeCursorTrail = cursorTrailContextKey === contextScopeKey
    ? cursorTrail : [initialQuery?.cursor ?? null];
  const visibleActionState = actionStateContextKey === contextScopeKey ? actionState : undefined;
  const nextCursor = contextMatches && showsProtectedRows(visibleState) &&
    projection?.queryState.freshness === 'CURRENT' ? projection.queryState.nextCursor : null;
  const preparePageChange = (nextQuery: Per008TeamQuery, nextTrail: readonly (string | null)[]) => {
    optionsSequence.current += 1;
    setOptions(undefined);
    setOptionsContextKey(undefined);
    setPendingAction(undefined);
    setPendingTarget(undefined);
    setActionState(undefined);
    setActionStateContextKey(undefined);
    setUnknownCreate(undefined);
    setCommandMessage(undefined);
    setCommandMessageContextKey(undefined);
    setProjection(undefined);
    setProjectionContextKey(undefined);
    setSelectedItemId(undefined);
    setState('LOADING');
    setStateContextKey(contextScopeKey);
    setCursorTrail(nextTrail);
    setCursorTrailContextKey(contextScopeKey);
    setQuery(nextQuery);
    setQueryContextKey(contextScopeKey);
  };
  return <Per008TeamPerformanceView state={visibleState}
    projection={contextMatches ? projection : undefined}
    selectedItemId={contextMatches ? selectedItemId : undefined}
    requestOptions={optionsContextKey === contextScopeKey ? options : undefined}
    actionState={visibleActionState}
    commandMessage={commandMessageContextKey === contextScopeKey ? commandMessage : undefined}
    commandBusy={visibleBusy} displayTimeZone={effectiveQuery?.timeZone ?? 'UTC'}
    pageNumber={activeCursorTrail.length} canPreviousPage={activeCursorTrail.length > 1}
    canNextPage={!!nextCursor} locale={locale} onRetry={retry} onSelect={selectItem}
    onQuery={({ filter, sort }) => {
      optionsSequence.current += 1;
      setOptions(undefined);
      setOptionsContextKey(undefined);
      setPendingAction(undefined);
      setPendingTarget(undefined);
      setActionState(undefined);
      setActionStateContextKey(undefined);
      setUnknownCreate(undefined);
      setCommandMessage(undefined);
      setCommandMessageContextKey(undefined);
      setProjection(undefined);
      setProjectionContextKey(undefined);
      setState('LOADING');
      setStateContextKey(contextScopeKey);
      setQuery(effectiveQuery ? { ...effectiveQuery, filter, sort, cursor: null } : effectiveQuery);
      setQueryContextKey(contextScopeKey);
      setCursorTrail([null]);
      setCursorTrailContextKey(contextScopeKey);
    }}
    onBeginRequest={commandContextFactory && !visibleUnknown ? beginRequest : undefined}
    onCancelRequest={cancelRequest} onCreateRequest={commandContextFactory ? createRequest : undefined}
    onReplay={visibleUnknown ? () => executeCreate(visibleUnknown.command, visibleUnknown.context,
      visibleUnknown.contextScopeKey) : undefined}
    onPreviousPage={activeCursorTrail.length > 1 && effectiveQuery ? () => {
      const previousTrail = activeCursorTrail.slice(0, -1);
      preparePageChange({ ...effectiveQuery, cursor: previousTrail.at(-1) ?? null }, previousTrail);
    } : undefined}
    onNextPage={nextCursor && effectiveQuery ? () => {
      preparePageChange({ ...effectiveQuery, cursor: nextCursor }, [...activeCursorTrail, nextCursor]);
    } : undefined} />;
}
