import { useCallback, useEffect, useRef, useState } from 'react';

import { Per008ClientError, Per008CommandOutcomeUnknownError } from './per008-client';
import type { Per008Client } from './per008-client';
import {
  PER008_CREATE_ACTION_KEY,
  PER008_FEATURE_DEFAULT_ENABLED,
  PER008_PROVIDER_BOUND,
  PER008_SUBMIT_ACTION_KEY,
} from './per008-model';
import type {
  Per008AssignedFeedbackDetail,
  Per008AssignedFeedbackList,
  Per008AuthorizedReleaseTarget,
  Per008CommandContext,
  Per008CreateFeedbackRequestCommand,
  Per008FeedbackAnswer,
  Per008FeedbackRelease,
  Per008FeedbackResponseCommand,
  Per008ProtectedState,
  Per008RequestOptions,
  Per008RequestSubject,
} from './per008-model';
import {
  formatPer008Instant,
  per008Copy,
  Per008ProtectedNotice,
  Per008RequestComposer,
} from './per008-ui';
import type { Per008Locale } from './per008-ui';

import './per008-workspace.css';

const personalCopy = {
  en: {
    eyebrow: 'My performance', title: 'Feedback inbox',
    description: 'Request feedback for your explicit SELF assignment and respond to work assigned to you.',
    inbox: 'Assigned feedback', detail: 'Feedback details', status: 'Status', window: 'Response window',
    select: 'Open feedback', noSelection: 'Select an assignment to view its protected details.',
    unavailableDetail: 'The selected assignment details are not available.', response: 'Your response',
    submit: 'Submit final response', submitting: 'Submitting…', submitted: 'Your response was submitted.',
    reviewSubmit: 'Review final response', confirmTitle: 'Submit this immutable response?',
    confirmImpact: 'After submission, this response cannot be edited or replaced. Review every answer before continuing.',
    confirmSubmit: 'Confirm and submit', backToEdit: 'Back to editing', requiredMissing: 'Complete all required questions.',
    responseLocked: 'A response is available only while this assignment is open and assigned.',
    release: 'Released feedback', openRelease: 'Open release status',
    privacy: 'Privacy mode', releasedAt: 'Released', selfUnavailable: 'SELF request is unavailable.',
    outcomeUnknown: 'The command outcome is unknown. Replay with the same request key to confirm it safely.',
    replay: 'Replay safely',
  },
  ko: {
    eyebrow: '나의 성과', title: '피드백 받은 편지함',
    description: '명시적으로 확인된 SELF 배정으로 피드백을 요청하고 나에게 배정된 응답을 처리합니다.',
    inbox: '배정된 피드백', detail: '피드백 상세', status: '상태', window: '응답 기간',
    select: '피드백 열기', noSelection: '배정을 선택하면 보호된 상세 정보를 볼 수 있습니다.',
    unavailableDetail: '선택한 배정의 상세 정보를 사용할 수 없습니다.', response: '나의 응답',
    submit: '최종 응답 제출', submitting: '제출 중…', submitted: '응답을 제출했습니다.',
    reviewSubmit: '최종 응답 검토', confirmTitle: '변경할 수 없는 응답을 제출할까요?',
    confirmImpact: '제출한 응답은 수정하거나 교체할 수 없습니다. 계속하기 전에 모든 답변을 확인하세요.',
    confirmSubmit: '확인 후 제출', backToEdit: '수정으로 돌아가기', requiredMissing: '필수 질문에 모두 답해 주세요.',
    responseLocked: '요청과 배정이 모두 열려 있을 때만 응답할 수 있습니다.',
    release: '공개된 피드백', openRelease: '공개 상태 열기',
    privacy: '개인정보 보호 방식', releasedAt: '공개 시각', selfUnavailable: 'SELF 요청을 사용할 수 없습니다.',
    outcomeUnknown: '명령 결과를 확인할 수 없습니다. 동일한 요청 키로 안전하게 재실행해 확인하세요.',
    replay: '동일 키로 재실행',
  },
} as const;

function stateFromError(error: unknown): Per008ProtectedState {
  if (!(error instanceof Per008ClientError)) return 'UNAVAILABLE';
  if (error.code === 'DENIED' || error.code === 'NOT_FOUND') return 'DENIED';
  if (error.code === 'STALE') return 'STALE';
  if (error.code === 'SUPPRESSED') return 'SUPPRESSED';
  return 'UNAVAILABLE';
}

type ResponseFormProps = Readonly<{
  detail: Per008AssignedFeedbackDetail;
  locale: Per008Locale;
  busy?: boolean;
  onSubmit: (command: Per008FeedbackResponseCommand) => void;
}>;

function Per008ResponseForm({ detail, locale, busy = false, onSubmit }: ResponseFormProps) {
  const labels = personalCopy[locale];
  const [pending, setPending] = useState<Per008FeedbackResponseCommand>();
  const [validationMessage, setValidationMessage] = useState<string>();
  const confirmationRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!pending) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const confirmation = confirmationRef.current;
    const focusable = confirmation?.querySelectorAll<HTMLElement>('button:not(:disabled)');
    focusable?.[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setPending(undefined);
        return;
      }
      if (event.key !== 'Tab' || !focusable?.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      returnFocusRef.current?.focus();
    };
  }, [pending]);

  const answerText = (answer: Per008FeedbackAnswer): string => {
    if (answer.textValue !== null) return answer.textValue;
    if (answer.numberValue !== null) return String(answer.numberValue);
    const question = detail.questions.find((candidate) => candidate.questionPublicId === answer.questionPublicId);
    return answer.choiceOptionPublicIds.map((id) =>
      question?.choiceOptions.find((option) => option.choiceOptionPublicId === id)?.label ?? id).join(', ');
  };
  return (
    <form className="per008-response-form" aria-labelledby="per008-response-heading"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const answers: Per008FeedbackAnswer[] = [];
        let missingRequired = false;
        for (const question of detail.questions) {
          const values = data.getAll(question.questionPublicId).map(String);
          const base = { questionPublicId: question.questionPublicId, answerType: question.answerType };
          if (question.answerType === 'TEXT') {
            const textValue = String(values[0] ?? '').trim();
            if (!textValue) { missingRequired ||= question.required; continue; }
            answers.push({ ...base, textValue, numberValue: null, choiceOptionPublicIds: [] });
            continue;
          }
          if (question.answerType === 'NUMBER') {
            const raw = String(values[0] ?? '').trim();
            if (!raw) { missingRequired ||= question.required; continue; }
            const numberValue = Number(raw);
            if (!Number.isFinite(numberValue)) { missingRequired = true; continue; }
            answers.push({ ...base, textValue: null, numberValue, choiceOptionPublicIds: [] });
            continue;
          }
          if (values.length === 0) { missingRequired ||= question.required; continue; }
          answers.push({ ...base, textValue: null, numberValue: null, choiceOptionPublicIds: values.sort() });
        }
        if (missingRequired || answers.length === 0) {
          setValidationMessage(labels.requiredMissing);
          return;
        }
        setValidationMessage(undefined);
        setPending({
          expectedRequestVersion: detail.expectedRequestVersion,
          templateContentHash: detail.templateContentHash,
          response: { schemaKey: 'PerformanceFeedbackResponse.v1', answers },
        });
      }}>
      <h3 id="per008-response-heading">{labels.response}</h3>
      {detail.questions.map((question, index) => (
        <fieldset key={question.questionPublicId} className="per008-question" disabled={busy || !!pending}>
          <legend><span>{index + 1}.</span> {question.prompt}</legend>
          {question.answerType === 'TEXT' && <textarea name={question.questionPublicId}
            required={question.required} rows={5} />}
          {question.answerType === 'NUMBER' && <input name={question.questionPublicId} type="number"
            required={question.required} step="any" />}
          {(question.answerType === 'SINGLE_CHOICE' || question.answerType === 'MULTI_CHOICE') &&
            <div className="per008-choice-list" role="group" aria-required={question.required}>
              {question.choiceOptions.map((option) => (
                <label key={option.choiceOptionPublicId}>
                  <input name={question.questionPublicId}
                    type={question.answerType === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'}
                    value={option.choiceOptionPublicId}
                    required={question.answerType === 'SINGLE_CHOICE' && question.required} />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>}
        </fieldset>
      ))}
      {validationMessage && <p className="per008-validation" role="alert">{validationMessage}</p>}
      <div className="per008-actions">
        <button className="per008-button per008-button--primary" type="submit" disabled={busy || !!pending}>
          {busy ? labels.submitting : labels.reviewSubmit}
        </button>
      </div>
      {pending && (
        <section ref={confirmationRef} className="per008-confirmation" role="alertdialog" aria-modal="true"
          aria-labelledby="per008-confirm-title" aria-describedby="per008-confirm-impact">
          <h4 id="per008-confirm-title">{labels.confirmTitle}</h4>
          <p id="per008-confirm-impact">{labels.confirmImpact}</p>
          <ol className="per008-confirmation__answers">
            {pending.response.answers.map((answer) => (
              <li key={answer.questionPublicId}>
                <strong>{detail.questions.find((question) =>
                  question.questionPublicId === answer.questionPublicId)?.prompt}</strong>
                <span>{answerText(answer)}</span>
              </li>
            ))}
          </ol>
          <div className="per008-actions">
            <button className="per008-button per008-button--quiet" type="button"
              onClick={() => setPending(undefined)} disabled={busy}>{labels.backToEdit}</button>
            <button className="per008-button per008-button--primary" type="button"
              onClick={() => onSubmit(pending)} disabled={busy}>
              {busy ? labels.submitting : labels.confirmSubmit}
            </button>
          </div>
        </section>
      )}
    </form>
  );
}

type PersonalViewProps = Readonly<{
  state: Per008ProtectedState;
  detailState?: Per008ProtectedState;
  releaseState?: Per008ProtectedState;
  inbox?: Per008AssignedFeedbackList;
  detail?: Per008AssignedFeedbackDetail;
  release?: Per008FeedbackRelease;
  releaseTarget?: Per008AuthorizedReleaseTarget;
  selectedAssignmentId?: string;
  requestOptions?: Per008RequestOptions;
  canRequestSelf?: boolean;
  actionMessage?: string;
  actionBusy?: boolean;
  locale?: Per008Locale;
  onRetry?: () => void;
  onSelect?: (assignmentId: string) => void;
  onBeginSelfRequest?: () => void;
  onCancelRequest?: () => void;
  onCreateRequest?: (command: Per008CreateFeedbackRequestCommand) => void;
  onSubmitResponse?: (command: Per008FeedbackResponseCommand) => void;
  onLoadRelease?: (feedbackRequestId: string) => void;
  onReplay?: () => void;
}>;

export function Per008PersonalFeedbackView({ state, detailState = 'EMPTY', releaseState = 'EMPTY', inbox,
  detail, release, releaseTarget,
  selectedAssignmentId, requestOptions, canRequestSelf = false, actionMessage, actionBusy = false,
  locale = 'ko', onRetry, onSelect, onBeginSelfRequest, onCancelRequest, onCreateRequest,
  onSubmitResponse, onLoadRelease, onReplay }: PersonalViewProps) {
  const labels = personalCopy[locale];
  const common = per008Copy[locale];
  const canRespond = detail?.requestState === 'OPEN' && detail.assignmentState === 'ASSIGNED';
  return (
    <main className="per008-workspace" aria-labelledby="per008-personal-title">
      <header className="per008-page-header">
        <div>
          <p className="per008-eyebrow">{labels.eyebrow}</p>
          <h1 id="per008-personal-title">{labels.title}</h1>
          <p>{labels.description}</p>
        </div>
        <div className="per008-header-actions">
          {canRequestSelf && onBeginSelfRequest
            ? <button className="per008-button per008-button--primary" type="button"
              disabled={actionBusy} onClick={onBeginSelfRequest}>{common.requestFeedback}</button>
            : <span className="per008-muted">{labels.selfUnavailable}</span>}
        </div>
      </header>

      <Per008ProtectedNotice state={state} locale={locale} onRetry={onRetry} />
      {actionMessage && <p className="per008-success" role="status">{actionMessage}</p>}
      {onReplay && <button className="per008-button per008-button--secondary" type="button"
        disabled={actionBusy} onClick={onReplay}>{labels.replay}</button>}

      {inbox && inbox.items.length > 0 && (
        <div className="per008-list-detail">
          <section className="per008-list-pane" aria-labelledby="per008-inbox-heading">
            <div className="per008-pane-heading">
              <h2 id="per008-inbox-heading">{labels.inbox}</h2><span>{inbox.items.length}</span>
            </div>
            <ul className="per008-record-list">
              {inbox.items.map((item) => (
                <li key={item.feedbackAssignmentId}>
                  <button type="button" className="per008-record-button"
                    aria-current={selectedAssignmentId === item.feedbackAssignmentId ? 'true' : undefined}
                    onClick={() => onSelect?.(item.feedbackAssignmentId)}>
                    <strong>{item.requestTitle}</strong>
                    <span>{item.assignmentState.replaceAll('_', ' ')}</span>
                    <small>{formatPer008Instant(item.closesAt, locale)}</small>
                    <span className="per008-visually-hidden">{labels.select}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section className="per008-detail-pane" aria-labelledby="per008-personal-detail">
            <div className="per008-pane-heading"><h2 id="per008-personal-detail">{labels.detail}</h2></div>
            <Per008ProtectedNotice state={detailState} locale={locale} />
            {detailState === 'COMPLETE' && detail &&
              detail.feedbackAssignmentId === selectedAssignmentId && (
              <div className="per008-detail-content">
                <h3>{detail.requestTitle}</h3>
                <dl className="per008-definition-list">
                  <div><dt>{labels.status}</dt><dd>{detail.assignmentState.replaceAll('_', ' ')}</dd></div>
                  <div><dt>{labels.window}</dt><dd>{formatPer008Instant(detail.opensAt, locale)} –<br />
                    {formatPer008Instant(detail.closesAt, locale)}</dd></div>
                </dl>
                {canRespond && onSubmitResponse
                  ? <Per008ResponseForm detail={detail} locale={locale} busy={actionBusy}
                    onSubmit={onSubmitResponse} />
                  : <p className="per008-muted">{labels.responseLocked}</p>}
              </div>
            )}
          </section>
        </div>
      )}

      {releaseTarget && (
        <section className="per008-release" aria-labelledby="per008-release-heading">
          <div className="per008-pane-heading">
            <h2 id="per008-release-heading">{labels.release}</h2>
            {!release && onLoadRelease && <button className="per008-button per008-button--secondary"
              type="button" disabled={actionBusy}
              onClick={() => onLoadRelease(releaseTarget.feedbackRequestId)}>{labels.openRelease}</button>}
          </div>
          {releaseState !== 'EMPTY' && releaseState !== 'COMPLETE' &&
            <Per008ProtectedNotice state={releaseState} locale={locale} />}
          {release?.feedbackRequestId === releaseTarget.feedbackRequestId && (
            <div className="per008-detail-content">
              <h3>{release.title}</h3>
              <dl className="per008-definition-list">
                <div><dt>{labels.privacy}</dt><dd>{release.anonymityMode.replaceAll('_', ' ')}</dd></div>
                <div><dt>{labels.releasedAt}</dt><dd>{formatPer008Instant(release.releasedAt, locale)}</dd></div>
              </dl>
            </div>
          )}
        </section>
      )}

      {requestOptions && onCancelRequest && onCreateRequest && (
        <Per008RequestComposer options={requestOptions} locale={locale} busy={actionBusy}
          onCancel={onCancelRequest} onSubmit={onCreateRequest} />
      )}
    </main>
  );
}

type PersonalClient = Pick<Per008Client, 'loadMyAssignments' | 'loadAssignment' | 'loadRequestOptions' |
  'createFeedbackRequest' | 'submitResponse' | 'loadRelease'>;

export type Per008PersonalFeedbackWorkspaceProps = Readonly<{
  mounted?: boolean;
  featureEnabled?: boolean;
  enrolled?: boolean;
  providerBound?: boolean;
  contextScopeKey?: string;
  selfSubject?: Per008RequestSubject;
  selfSubjectContextScopeKey?: string;
  releaseTarget?: Per008AuthorizedReleaseTarget;
  client?: PersonalClient;
  commandContextFactory?: (actionKey: typeof PER008_CREATE_ACTION_KEY | typeof PER008_SUBMIT_ACTION_KEY) =>
    Per008CommandContext;
  locale?: Per008Locale;
}>;

/** SELF is an explicit host tuple. It is never inferred from IAQ-038 items or browser state. */
export function Per008PersonalFeedbackWorkspace({ mounted = false,
  featureEnabled = PER008_FEATURE_DEFAULT_ENABLED, enrolled = false,
  providerBound = PER008_PROVIDER_BOUND, contextScopeKey, selfSubject, selfSubjectContextScopeKey,
  releaseTarget, client, commandContextFactory, locale = 'ko' }: Per008PersonalFeedbackWorkspaceProps) {
  const active = mounted && featureEnabled && enrolled && providerBound && !!client &&
    !!contextScopeKey?.trim();
  const [state, setState] = useState<Per008ProtectedState>('LOADING');
  const [stateContextKey, setStateContextKey] = useState<string>();
  const [detailState, setDetailState] = useState<Per008ProtectedState>('EMPTY');
  const [detailContextKey, setDetailContextKey] = useState<string>();
  const [releaseState, setReleaseState] = useState<Per008ProtectedState>('EMPTY');
  const [inbox, setInbox] = useState<Per008AssignedFeedbackList>();
  const [inboxContextKey, setInboxContextKey] = useState<string>();
  const [selectedId, setSelectedId] = useState<string>();
  const [detail, setDetail] = useState<Per008AssignedFeedbackDetail>();
  const [release, setRelease] = useState<Per008FeedbackRelease>();
  const [releaseEvidenceKey, setReleaseEvidenceKey] = useState<string>();
  const [options, setOptions] = useState<Per008RequestOptions>();
  const [optionsContextKey, setOptionsContextKey] = useState<string>();
  const [retryCount, setRetryCount] = useState(0);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionBusyContextKey, setActionBusyContextKey] = useState<string>();
  const [actionMessage, setActionMessage] = useState<string>();
  const [actionMessageContextKey, setActionMessageContextKey] = useState<string>();
  const [unknownCommand, setUnknownCommand] = useState<
    | Readonly<{ kind: 'CREATE'; contextScopeKey: string; command: Per008CreateFeedbackRequestCommand;
      context: Per008CommandContext }>
    | Readonly<{ kind: 'SUBMIT'; contextScopeKey: string; assignmentId: string;
      command: Per008FeedbackResponseCommand;
      context: Per008CommandContext }>
  >();
  const optionsSequence = useRef(0);
  const actionSequence = useRef(0);
  const currentContextScopeKey = useRef(contextScopeKey);
  currentContextScopeKey.current = contextScopeKey;
  const releaseTargetKey = releaseTarget && contextScopeKey
    ? `${releaseTarget.contextScopeKey}\u0000${releaseTarget.feedbackRequestId}\u0000${releaseTarget.authorizationDecisionRevision}`
    : undefined;

  useEffect(() => {
    optionsSequence.current += 1;
    setOptions(undefined);
    setOptionsContextKey(undefined);
  }, [selfSubject?.cycleVersionId, selfSubject?.subjectAssignmentPublicId,
    selfSubject?.subjectWorkerPublicId, contextScopeKey]);

  useEffect(() => {
    if (!active || !client || !contextScopeKey) return;
    let cancelled = false;
    const requestedContextKey = contextScopeKey;
    setInbox(undefined);
    setInboxContextKey(undefined);
    setState('LOADING');
    setStateContextKey(requestedContextKey);
    client.loadMyAssignments().then((next) => {
      if (cancelled || currentContextScopeKey.current !== requestedContextKey) return;
      setInbox(next);
      setInboxContextKey(requestedContextKey);
      setState(next.queryState);
      setStateContextKey(requestedContextKey);
      setSelectedId((current) => next.items.some((item) => item.feedbackAssignmentId === current)
        ? current : next.items[0]?.feedbackAssignmentId);
    }).catch((error: unknown) => {
      if (cancelled || currentContextScopeKey.current !== requestedContextKey) return;
      setInbox(undefined);
      setInboxContextKey(undefined);
      setState(stateFromError(error));
      setStateContextKey(requestedContextKey);
    });
    return () => { cancelled = true; };
  }, [active, client, contextScopeKey, retryCount]);

  useEffect(() => {
    if (!active || !client || !selectedId || !contextScopeKey ||
        inboxContextKey !== contextScopeKey) {
      setDetail(undefined);
      setDetailContextKey(undefined);
      setDetailState('EMPTY');
      return;
    }
    let cancelled = false;
    const requestedId = selectedId;
    const requestedContextKey = contextScopeKey;
    setDetail(undefined);
    setDetailContextKey(requestedContextKey);
    setDetailState('LOADING');
    client.loadAssignment(requestedId).then((next) => {
      if (cancelled || currentContextScopeKey.current !== requestedContextKey) return;
      if (next.feedbackAssignmentId !== requestedId) {
        setDetailState('DENIED');
        setDetailContextKey(requestedContextKey);
        return;
      }
      setDetail(next);
      setDetailContextKey(requestedContextKey);
      setDetailState('COMPLETE');
    }).catch((error: unknown) => {
      if (cancelled || currentContextScopeKey.current !== requestedContextKey) return;
      setDetail(undefined);
      setDetailContextKey(requestedContextKey);
      setDetailState(stateFromError(error));
    });
    return () => { cancelled = true; };
  }, [active, client, contextScopeKey, inboxContextKey, selectedId]);

  useEffect(() => {
    setRelease(undefined);
    setReleaseEvidenceKey(undefined);
    setReleaseState('EMPTY');
  }, [releaseTargetKey]);

  const retry = useCallback(() => {
    optionsSequence.current += 1;
    setOptions(undefined);
    setOptionsContextKey(undefined);
    setInbox(undefined);
    setInboxContextKey(undefined);
    setDetail(undefined);
    setDetailContextKey(undefined);
    setDetailState('EMPTY');
    setState('LOADING');
    setStateContextKey(contextScopeKey);
    setRetryCount((count) => count + 1);
  }, [contextScopeKey]);
  const beginSelfRequest = useCallback(() => {
    if (!active || !client || !selfSubject || !contextScopeKey ||
        selfSubjectContextScopeKey !== contextScopeKey ||
        (actionBusy && actionBusyContextKey === contextScopeKey)) return;
    const sequence = ++optionsSequence.current;
    const requestedContextKey = contextScopeKey;
    setActionBusy(true);
    setActionBusyContextKey(requestedContextKey);
    setActionMessage(undefined);
    setActionMessageContextKey(undefined);
    setOptions(undefined);
    setOptionsContextKey(undefined);
    client.loadRequestOptions(selfSubject).then((next) => {
      if (sequence === optionsSequence.current &&
          currentContextScopeKey.current === requestedContextKey) {
        setOptions(next);
        setOptionsContextKey(requestedContextKey);
      }
    })
      .catch((error: unknown) => {
        if (sequence !== optionsSequence.current ||
            currentContextScopeKey.current !== requestedContextKey) return;
        setState(stateFromError(error));
        setStateContextKey(requestedContextKey);
      })
      .finally(() => {
        if (sequence === optionsSequence.current &&
            currentContextScopeKey.current === requestedContextKey) {
          setActionBusy(false);
          setActionBusyContextKey(undefined);
        }
      });
  }, [actionBusy, actionBusyContextKey, active, client, contextScopeKey, selfSubject,
    selfSubjectContextScopeKey]);
  const executeCreate = useCallback((command: Per008CreateFeedbackRequestCommand,
    context: Per008CommandContext, requestedContextKey: string) => {
    if (!client || currentContextScopeKey.current !== requestedContextKey) return;
    const sequence = ++actionSequence.current;
    setActionBusy(true);
    setActionBusyContextKey(requestedContextKey);
    client.createFeedbackRequest(command, context).then(() => {
      if (sequence !== actionSequence.current ||
          currentContextScopeKey.current !== requestedContextKey) return;
      setUnknownCommand(undefined);
      setOptions(undefined);
      setOptionsContextKey(undefined);
      setActionMessage(per008Copy[locale].requestCreated);
      setActionMessageContextKey(requestedContextKey);
    }).catch((error: unknown) => {
      if (sequence !== actionSequence.current ||
          currentContextScopeKey.current !== requestedContextKey) return;
      if (error instanceof Per008CommandOutcomeUnknownError) {
        setUnknownCommand({ kind: 'CREATE', contextScopeKey: requestedContextKey, command, context });
        setOptions(undefined);
        setOptionsContextKey(undefined);
        setActionMessage(personalCopy[locale].outcomeUnknown);
        setActionMessageContextKey(requestedContextKey);
      } else {
        setState(stateFromError(error));
        setStateContextKey(requestedContextKey);
      }
    }).finally(() => {
      if (sequence === actionSequence.current &&
          currentContextScopeKey.current === requestedContextKey) {
        setActionBusy(false);
        setActionBusyContextKey(undefined);
      }
    });
  }, [client, locale]);
  const createRequest = useCallback((command: Per008CreateFeedbackRequestCommand) => {
    if (!active || !client || !contextScopeKey || optionsContextKey !== contextScopeKey ||
        selfSubjectContextScopeKey !== contextScopeKey || !selfSubject || !options || !commandContextFactory ||
        command.cycleVersionId !== selfSubject.cycleVersionId ||
        command.subjectWorkerPublicId !== selfSubject.subjectWorkerPublicId ||
        command.subjectAssignmentPublicId !== selfSubject.subjectAssignmentPublicId) return;
    let context: Per008CommandContext;
    try { context = commandContextFactory(PER008_CREATE_ACTION_KEY); }
    catch { setState('DENIED'); return; }
    executeCreate(command, context, contextScopeKey);
  }, [active, client, commandContextFactory, contextScopeKey, executeCreate, options,
    optionsContextKey, selfSubject, selfSubjectContextScopeKey]);
  const executeSubmit = useCallback((assignmentId: string, command: Per008FeedbackResponseCommand,
    context: Per008CommandContext, requestedContextKey: string) => {
    if (!client || currentContextScopeKey.current !== requestedContextKey) return;
    const sequence = ++actionSequence.current;
    setActionBusy(true);
    setActionBusyContextKey(requestedContextKey);
    client.submitResponse(assignmentId, command, context).then(() => {
      if (sequence !== actionSequence.current ||
          currentContextScopeKey.current !== requestedContextKey) return;
      setUnknownCommand(undefined);
      setDetail((current) => current?.feedbackAssignmentId === assignmentId
        ? { ...current, assignmentState: 'SUBMITTED' } : current);
      setActionMessage(personalCopy[locale].submitted);
      setActionMessageContextKey(requestedContextKey);
    }).catch((error: unknown) => {
      if (sequence !== actionSequence.current ||
          currentContextScopeKey.current !== requestedContextKey) return;
      if (error instanceof Per008CommandOutcomeUnknownError) {
        setUnknownCommand({ kind: 'SUBMIT', contextScopeKey: requestedContextKey, assignmentId,
          command, context });
        setActionMessage(personalCopy[locale].outcomeUnknown);
        setActionMessageContextKey(requestedContextKey);
      } else {
        setDetailState(stateFromError(error));
        setDetailContextKey(requestedContextKey);
      }
    }).finally(() => {
      if (sequence === actionSequence.current &&
          currentContextScopeKey.current === requestedContextKey) {
        setActionBusy(false);
        setActionBusyContextKey(undefined);
      }
    });
  }, [client, locale]);
  const submitResponse = useCallback((command: Per008FeedbackResponseCommand) => {
    if (!active || !client || !contextScopeKey || detailContextKey !== contextScopeKey ||
        !detail || detailState !== 'COMPLETE' ||
        detail.feedbackAssignmentId !== selectedId || !commandContextFactory) return;
    let context: Per008CommandContext;
    try { context = commandContextFactory(PER008_SUBMIT_ACTION_KEY); }
    catch { setDetailState('DENIED'); return; }
    executeSubmit(detail.feedbackAssignmentId, command, context, contextScopeKey);
  }, [active, client, commandContextFactory, contextScopeKey, detail, detailContextKey,
    detailState, executeSubmit, selectedId]);
  const loadRelease = useCallback((requestId: string) => {
    if (!active || !client || !contextScopeKey || !releaseTarget || !releaseTargetKey ||
        releaseTarget.provenance !== 'OWNER_AUTHORIZED_RELEASE_REFERENCE' ||
        releaseTarget.contextScopeKey !== contextScopeKey ||
        releaseTarget.feedbackRequestId !== requestId ||
        !releaseTarget.authorizationDecisionRevision.trim()) return;
    const sequence = ++actionSequence.current;
    const requestedContextKey = contextScopeKey;
    const requestedReleaseKey = releaseTargetKey;
    setActionBusy(true);
    setActionBusyContextKey(requestedContextKey);
    setRelease(undefined);
    setReleaseEvidenceKey(requestedReleaseKey);
    setReleaseState('LOADING');
    client.loadRelease(requestId).then((next) => {
      if (sequence !== actionSequence.current ||
          currentContextScopeKey.current !== requestedContextKey ||
          next.feedbackRequestId !== requestId) {
        if (next.feedbackRequestId !== requestId &&
            currentContextScopeKey.current === requestedContextKey) setReleaseState('DENIED');
        return;
      }
      setRelease(next);
      setReleaseEvidenceKey(requestedReleaseKey);
      setReleaseState('COMPLETE');
    }).catch((error: unknown) => {
      if (sequence !== actionSequence.current ||
          currentContextScopeKey.current !== requestedContextKey) return;
      setReleaseState(stateFromError(error));
      setReleaseEvidenceKey(requestedReleaseKey);
    }).finally(() => {
      if (sequence === actionSequence.current &&
          currentContextScopeKey.current === requestedContextKey) {
        setActionBusy(false);
        setActionBusyContextKey(undefined);
      }
    });
  }, [active, client, contextScopeKey, releaseTarget, releaseTargetKey]);
  if (!active) return null;
  const inboxMatches = inboxContextKey === contextScopeKey;
  const detailMatches = detailContextKey === contextScopeKey;
  const visibleReleaseTarget = releaseTarget && releaseTarget.contextScopeKey === contextScopeKey &&
    releaseTarget.authorizationDecisionRevision.trim() ? releaseTarget : undefined;
  const visibleUnknown = unknownCommand?.contextScopeKey === contextScopeKey ? unknownCommand : undefined;
  const replay = visibleUnknown?.kind === 'CREATE'
    ? () => executeCreate(visibleUnknown.command, visibleUnknown.context, visibleUnknown.contextScopeKey)
    : visibleUnknown?.kind === 'SUBMIT'
      ? () => executeSubmit(visibleUnknown.assignmentId, visibleUnknown.command, visibleUnknown.context,
        visibleUnknown.contextScopeKey)
      : undefined;
  const visibleBusy = actionBusyContextKey === contextScopeKey && actionBusy;
  return <Per008PersonalFeedbackView
    state={stateContextKey === contextScopeKey ? state : 'LOADING'}
    detailState={detailMatches ? detailState : 'EMPTY'}
    releaseState={visibleReleaseTarget && releaseEvidenceKey === releaseTargetKey ? releaseState : 'EMPTY'}
    inbox={inboxMatches ? inbox : undefined}
    detail={detailMatches ? detail : undefined}
    release={visibleReleaseTarget && releaseEvidenceKey === releaseTargetKey ? release : undefined}
    releaseTarget={visibleReleaseTarget}
    selectedAssignmentId={inboxMatches ? selectedId : undefined}
    requestOptions={optionsContextKey === contextScopeKey ? options : undefined}
    canRequestSelf={!!selfSubject && selfSubjectContextScopeKey === contextScopeKey && !visibleUnknown}
    actionMessage={actionMessageContextKey === contextScopeKey
      ? actionMessage : undefined} actionBusy={visibleBusy}
    locale={locale} onRetry={retry} onSelect={inboxMatches ? setSelectedId : undefined}
    onBeginSelfRequest={selfSubject && selfSubjectContextScopeKey === contextScopeKey && !visibleUnknown
      ? beginSelfRequest : undefined}
    onCancelRequest={() => {
      optionsSequence.current += 1;
      setOptions(undefined);
      setOptionsContextKey(undefined);
    }}
    onCreateRequest={commandContextFactory ? createRequest : undefined}
    onSubmitResponse={commandContextFactory && visibleUnknown?.kind !== 'SUBMIT'
      ? submitResponse : undefined} onLoadRelease={loadRelease}
    onReplay={replay} />;
}
