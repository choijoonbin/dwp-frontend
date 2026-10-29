import { useCallback, useEffect, useRef, useState } from 'react';

import { Per008CommandOutcomeUnknownError } from './per008-client';
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
  Per008FeedbackRelease,
  Per008FeedbackResponseCommand,
  Per008ProtectedState,
  Per008RequestOptions,
  Per008RequestSubject,
} from './per008-model';
import {
  formatPer008AnonymityMode,
  formatPer008Instant,
  localizedCode,
  personalCopy,
  per008Copy,
  Per008ResponseForm,
  Per008ActionNotice,
  Per008ProtectedNotice,
  Per008RequestComposer,
  showsProtectedRows,
  stateFromError,
} from './per008-ui';
import type { Per008Locale } from './per008-ui';

import './per008-workspace.css';

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
  actionState?: Per008ProtectedState;
  actionBusy?: boolean;
  displayTimeZone?: string;
  pageNumber?: number;
  canPreviousPage?: boolean;
  canNextPage?: boolean;
  locale?: Per008Locale;
  onRetry?: () => void;
  onSelect?: (assignmentId: string) => void;
  onBeginSelfRequest?: () => void;
  onCancelRequest?: () => void;
  onCreateRequest?: (command: Per008CreateFeedbackRequestCommand) => void;
  onSubmitResponse?: (command: Per008FeedbackResponseCommand) => void;
  onLoadRelease?: (feedbackRequestId: string) => void;
  onReplay?: () => void;
  onPreviousPage?: () => void;
  onNextPage?: () => void;
}>;

export function Per008PersonalFeedbackView({
  state,
  detailState = 'EMPTY',
  releaseState = 'EMPTY',
  inbox,
  detail,
  release,
  releaseTarget,
  selectedAssignmentId,
  requestOptions,
  canRequestSelf = false,
  actionMessage,
  actionState,
  actionBusy = false,
  displayTimeZone = 'UTC',
  pageNumber = 1,
  canPreviousPage = false,
  canNextPage = false,
  locale = 'ko',
  onRetry,
  onSelect,
  onBeginSelfRequest,
  onCancelRequest,
  onCreateRequest,
  onSubmitResponse,
  onLoadRelease,
  onReplay,
  onPreviousPage,
  onNextPage,
}: PersonalViewProps) {
  const labels = personalCopy[locale];
  const common = per008Copy[locale];
  const visibleInbox = showsProtectedRows(state) ? inbox : undefined;
  const canRespond =
    state === 'COMPLETE' &&
    detailState === 'COMPLETE' &&
    detail?.requestState === 'OPEN' &&
    detail.assignmentState === 'ASSIGNED';
  return (
    <section className="per008-workspace" aria-labelledby="per008-personal-title">
      <header className="per008-page-header">
        <div>
          <p className="per008-eyebrow">{labels.eyebrow}</p>
          <h1 id="per008-personal-title">{labels.title}</h1>
          <p>{labels.description}</p>
        </div>
        <div className="per008-header-actions">
          {canRequestSelf && onBeginSelfRequest ? (
            <button
              className="per008-button per008-button--primary"
              type="button"
              disabled={actionBusy}
              onClick={onBeginSelfRequest}
            >
              {common.requestFeedback}
            </button>
          ) : (
            <span className="per008-muted">{labels.selfUnavailable}</span>
          )}
        </div>
      </header>

      <Per008ProtectedNotice state={state} locale={locale} onRetry={onRetry} />
      {actionState && <Per008ActionNotice state={actionState} locale={locale} />}
      {actionMessage && (
        <p className="per008-success" role="status">
          {actionMessage}
        </p>
      )}
      {onReplay && (
        <button
          className="per008-button per008-button--secondary"
          type="button"
          disabled={actionBusy}
          onClick={onReplay}
        >
          {labels.replay}
        </button>
      )}

      {visibleInbox && visibleInbox.items.length > 0 && (
        <div className="per008-list-detail">
          <section className="per008-list-pane" aria-labelledby="per008-inbox-heading">
            <div className="per008-pane-heading">
              <h2 id="per008-inbox-heading">{labels.inbox}</h2>
              <span>{visibleInbox.items.length}</span>
            </div>
            <ul className="per008-record-list">
              {visibleInbox.items.map((item) => (
                <li key={item.feedbackAssignmentId}>
                  <button
                    type="button"
                    className="per008-record-button"
                    aria-current={
                      selectedAssignmentId === item.feedbackAssignmentId ? 'true' : undefined
                    }
                    onClick={() => onSelect?.(item.feedbackAssignmentId)}
                  >
                    <strong>{item.requestTitle}</strong>
                    <span>{localizedCode(item.assignmentState, locale)}</span>
                    <small>
                      {formatPer008Instant(item.closesAt, locale, displayTimeZone)} (
                      {displayTimeZone})
                    </small>
                    <span className="per008-visually-hidden">{labels.select}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section className="per008-detail-pane" aria-labelledby="per008-personal-detail">
            <div className="per008-pane-heading">
              <h2 id="per008-personal-detail">{labels.detail}</h2>
            </div>
            <Per008ProtectedNotice state={detailState} locale={locale} />
            {detailState === 'COMPLETE' &&
              detail &&
              detail.feedbackAssignmentId === selectedAssignmentId && (
                <div className="per008-detail-content">
                  <h3>{detail.requestTitle}</h3>
                  <dl className="per008-definition-list">
                    <div>
                      <dt>{labels.status}</dt>
                      <dd>{localizedCode(detail.assignmentState, locale)}</dd>
                    </div>
                    <div>
                      <dt>{labels.window}</dt>
                      <dd>
                        {formatPer008Instant(detail.opensAt, locale, displayTimeZone)} –<br />
                        {formatPer008Instant(detail.closesAt, locale, displayTimeZone)} (
                        {displayTimeZone})
                      </dd>
                    </div>
                  </dl>
                  {canRespond && onSubmitResponse ? (
                    <Per008ResponseForm
                      detail={detail}
                      locale={locale}
                      busy={actionBusy}
                      onSubmit={onSubmitResponse}
                    />
                  ) : (
                    <p className="per008-muted">{labels.responseLocked}</p>
                  )}
                </div>
              )}
          </section>
        </div>
      )}

      {(canPreviousPage || canNextPage) && (
        <nav
          className="per008-pagination"
          aria-label={`${labels.inbox} ${labels.page} ${pageNumber}`}
        >
          <button
            className="per008-button per008-button--quiet"
            type="button"
            disabled={actionBusy || !canPreviousPage}
            onClick={onPreviousPage}
          >
            {labels.previous}
          </button>
          <span aria-current="page">
            {labels.page} {pageNumber}
          </span>
          <button
            className="per008-button per008-button--quiet"
            type="button"
            disabled={actionBusy || !canNextPage}
            onClick={onNextPage}
          >
            {labels.next}
          </button>
        </nav>
      )}

      {releaseTarget && (
        <section className="per008-release" aria-labelledby="per008-release-heading">
          <div className="per008-pane-heading">
            <h2 id="per008-release-heading">{labels.release}</h2>
            {!release && onLoadRelease && (
              <button
                className="per008-button per008-button--secondary"
                type="button"
                disabled={actionBusy}
                onClick={() => onLoadRelease(releaseTarget.feedbackRequestId)}
              >
                {labels.openRelease}
              </button>
            )}
          </div>
          {releaseState !== 'EMPTY' && releaseState !== 'COMPLETE' && (
            <Per008ProtectedNotice state={releaseState} locale={locale} />
          )}
          {releaseState === 'COMPLETE' &&
            release?.feedbackRequestId === releaseTarget.feedbackRequestId && (
              <div className="per008-detail-content">
                <h3>{release.title}</h3>
                <dl className="per008-definition-list">
                  <div>
                    <dt>{labels.privacy}</dt>
                    <dd>{formatPer008AnonymityMode(release.anonymityMode, locale)}</dd>
                  </div>
                  <div>
                    <dt>{labels.releasedAt}</dt>
                    <dd>
                      {formatPer008Instant(release.releasedAt, locale, displayTimeZone)} (
                      {displayTimeZone})
                    </dd>
                  </div>
                </dl>
              </div>
            )}
        </section>
      )}

      {requestOptions && onCancelRequest && onCreateRequest && (
        <Per008RequestComposer
          options={requestOptions}
          locale={locale}
          busy={actionBusy}
          timeZone={displayTimeZone}
          onCancel={onCancelRequest}
          onSubmit={onCreateRequest}
        />
      )}
    </section>
  );
}

type PersonalClient = Pick<
  Per008Client,
  | 'loadMyAssignments'
  | 'loadAssignment'
  | 'loadRequestOptions'
  | 'createFeedbackRequest'
  | 'submitResponse'
  | 'loadRelease'
>;

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
  commandContextFactory?: (
    actionKey: typeof PER008_CREATE_ACTION_KEY | typeof PER008_SUBMIT_ACTION_KEY
  ) => Per008CommandContext;
  displayTimeZone?: string;
  locale?: Per008Locale;
}>;

/** SELF is an explicit host tuple. It is never inferred from IAQ-038 items or browser state. */
export function Per008PersonalFeedbackWorkspace({
  mounted = false,
  featureEnabled = PER008_FEATURE_DEFAULT_ENABLED,
  enrolled = false,
  providerBound = PER008_PROVIDER_BOUND,
  contextScopeKey,
  selfSubject,
  selfSubjectContextScopeKey,
  releaseTarget,
  client,
  commandContextFactory,
  displayTimeZone = 'UTC',
  locale = 'ko',
}: Per008PersonalFeedbackWorkspaceProps) {
  const active =
    mounted && featureEnabled && enrolled && providerBound && !!client && !!contextScopeKey?.trim();
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
  const [actionState, setActionState] = useState<Per008ProtectedState>();
  const [actionStateContextKey, setActionStateContextKey] = useState<string>();
  const [inboxCursor, setInboxCursor] = useState<string | null>(null);
  const [inboxCursorContextKey, setInboxCursorContextKey] = useState<string | undefined>(
    contextScopeKey
  );
  const [inboxCursorTrail, setInboxCursorTrail] = useState<readonly (string | null)[]>([null]);
  const [unknownCommand, setUnknownCommand] = useState<
    | Readonly<{
        kind: 'CREATE';
        contextScopeKey: string;
        command: Per008CreateFeedbackRequestCommand;
        context: Per008CommandContext;
      }>
    | Readonly<{
        kind: 'SUBMIT';
        contextScopeKey: string;
        assignmentId: string;
        command: Per008FeedbackResponseCommand;
        context: Per008CommandContext;
      }>
  >();
  const optionsSequence = useRef(0);
  const actionSequence = useRef(0);
  const currentContextScopeKey = useRef(contextScopeKey);
  currentContextScopeKey.current = contextScopeKey;
  const releaseTargetKey =
    releaseTarget && contextScopeKey
      ? `${releaseTarget.contextScopeKey}\u0000${releaseTarget.feedbackRequestId}\u0000${releaseTarget.authorizationDecisionRevision}`
      : undefined;
  const effectiveInboxCursor = inboxCursorContextKey === contextScopeKey ? inboxCursor : null;

  useEffect(() => {
    actionSequence.current += 1;
    setUnknownCommand(undefined);
    setActionMessage(undefined);
    setActionMessageContextKey(undefined);
    setActionState(undefined);
    setActionStateContextKey(undefined);
    setActionBusy(false);
    setActionBusyContextKey(undefined);
    setInboxCursor(null);
    setInboxCursorContextKey(contextScopeKey);
    setInboxCursorTrail([null]);
  }, [contextScopeKey]);

  useEffect(() => {
    optionsSequence.current += 1;
    setOptions(undefined);
    setOptionsContextKey(undefined);
    setActionState(undefined);
    setActionStateContextKey(undefined);
  }, [
    selfSubject?.cycleVersionId,
    selfSubject?.subjectAssignmentPublicId,
    selfSubject?.subjectWorkerPublicId,
    contextScopeKey,
  ]);

  useEffect(() => {
    if (!active || !client || !contextScopeKey) return;
    let cancelled = false;
    const requestedContextKey = contextScopeKey;
    setInbox(undefined);
    setInboxContextKey(undefined);
    setState('LOADING');
    setStateContextKey(requestedContextKey);
    client
      .loadMyAssignments(effectiveInboxCursor ?? undefined)
      .then((next) => {
        if (cancelled || currentContextScopeKey.current !== requestedContextKey) return;
        setInbox(next);
        setInboxContextKey(requestedContextKey);
        setState(next.queryState);
        setStateContextKey(requestedContextKey);
        setSelectedId((current) =>
          next.items.some((item) => item.feedbackAssignmentId === current)
            ? current
            : next.items[0]?.feedbackAssignmentId
        );
      })
      .catch((error: unknown) => {
        if (cancelled || currentContextScopeKey.current !== requestedContextKey) return;
        setInbox(undefined);
        setInboxContextKey(undefined);
        setState(stateFromError(error));
        setStateContextKey(requestedContextKey);
      });
    return () => {
      cancelled = true;
    };
  }, [active, client, contextScopeKey, effectiveInboxCursor, retryCount]);

  useEffect(() => {
    if (
      !active ||
      !client ||
      !selectedId ||
      !contextScopeKey ||
      inboxContextKey !== contextScopeKey
    ) {
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
    client
      .loadAssignment(requestedId)
      .then((next) => {
        if (cancelled || currentContextScopeKey.current !== requestedContextKey) return;
        if (next.feedbackAssignmentId !== requestedId) {
          setDetailState('DENIED');
          setDetailContextKey(requestedContextKey);
          return;
        }
        setDetail(next);
        setDetailContextKey(requestedContextKey);
        setDetailState('COMPLETE');
      })
      .catch((error: unknown) => {
        if (cancelled || currentContextScopeKey.current !== requestedContextKey) return;
        setDetail(undefined);
        setDetailContextKey(requestedContextKey);
        setDetailState(stateFromError(error));
      });
    return () => {
      cancelled = true;
    };
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
    setActionState(undefined);
    setActionStateContextKey(undefined);
    setUnknownCommand(undefined);
    setActionMessage(undefined);
    setActionMessageContextKey(undefined);
    setState('LOADING');
    setStateContextKey(contextScopeKey);
    setRetryCount((count) => count + 1);
  }, [contextScopeKey]);
  const beginSelfRequest = useCallback(() => {
    if (
      !active ||
      !client ||
      !selfSubject ||
      !contextScopeKey ||
      selfSubjectContextScopeKey !== contextScopeKey ||
      (actionBusy && actionBusyContextKey === contextScopeKey)
    )
      return;
    const sequence = ++optionsSequence.current;
    const requestedContextKey = contextScopeKey;
    setActionBusy(true);
    setActionBusyContextKey(requestedContextKey);
    setActionMessage(undefined);
    setActionMessageContextKey(undefined);
    setActionState(undefined);
    setActionStateContextKey(undefined);
    setOptions(undefined);
    setOptionsContextKey(undefined);
    client
      .loadRequestOptions(selfSubject)
      .then((next) => {
        if (
          sequence === optionsSequence.current &&
          currentContextScopeKey.current === requestedContextKey
        ) {
          setOptions(next);
          setOptionsContextKey(requestedContextKey);
        }
      })
      .catch((error: unknown) => {
        if (
          sequence !== optionsSequence.current ||
          currentContextScopeKey.current !== requestedContextKey
        )
          return;
        setOptions(undefined);
        setOptionsContextKey(undefined);
        setActionState(stateFromError(error));
        setActionStateContextKey(requestedContextKey);
      })
      .finally(() => {
        if (
          sequence === optionsSequence.current &&
          currentContextScopeKey.current === requestedContextKey
        ) {
          setActionBusy(false);
          setActionBusyContextKey(undefined);
        }
      });
  }, [
    actionBusy,
    actionBusyContextKey,
    active,
    client,
    contextScopeKey,
    selfSubject,
    selfSubjectContextScopeKey,
  ]);
  const executeCreate = useCallback(
    (
      command: Per008CreateFeedbackRequestCommand,
      context: Per008CommandContext,
      requestedContextKey: string
    ) => {
      if (!client || currentContextScopeKey.current !== requestedContextKey) return;
      const sequence = ++actionSequence.current;
      setActionBusy(true);
      setActionBusyContextKey(requestedContextKey);
      setActionState(undefined);
      setActionStateContextKey(undefined);
      client
        .createFeedbackRequest(command, context)
        .then(() => {
          if (
            sequence !== actionSequence.current ||
            currentContextScopeKey.current !== requestedContextKey
          )
            return;
          setUnknownCommand(undefined);
          setOptions(undefined);
          setOptionsContextKey(undefined);
          setActionState(undefined);
          setActionStateContextKey(undefined);
          setActionMessage(per008Copy[locale].requestCreated);
          setActionMessageContextKey(requestedContextKey);
        })
        .catch((error: unknown) => {
          if (
            sequence !== actionSequence.current ||
            currentContextScopeKey.current !== requestedContextKey
          )
            return;
          if (error instanceof Per008CommandOutcomeUnknownError) {
            setUnknownCommand({
              kind: 'CREATE',
              contextScopeKey: requestedContextKey,
              command,
              context,
            });
            setOptions(undefined);
            setOptionsContextKey(undefined);
            setActionMessage(personalCopy[locale].outcomeUnknown);
            setActionMessageContextKey(requestedContextKey);
          } else {
            setUnknownCommand(undefined);
            setActionMessage(undefined);
            setActionMessageContextKey(undefined);
            setOptions(undefined);
            setOptionsContextKey(undefined);
            setActionState(stateFromError(error));
            setActionStateContextKey(requestedContextKey);
          }
        })
        .finally(() => {
          if (
            sequence === actionSequence.current &&
            currentContextScopeKey.current === requestedContextKey
          ) {
            setActionBusy(false);
            setActionBusyContextKey(undefined);
          }
        });
    },
    [client, locale]
  );
  const createRequest = useCallback(
    (command: Per008CreateFeedbackRequestCommand) => {
      if (
        !active ||
        !client ||
        !contextScopeKey ||
        optionsContextKey !== contextScopeKey ||
        selfSubjectContextScopeKey !== contextScopeKey ||
        !selfSubject ||
        !options ||
        !commandContextFactory ||
        command.cycleVersionId !== selfSubject.cycleVersionId ||
        command.subjectWorkerPublicId !== selfSubject.subjectWorkerPublicId ||
        command.subjectAssignmentPublicId !== selfSubject.subjectAssignmentPublicId
      )
        return;
      let context: Per008CommandContext;
      try {
        context = commandContextFactory(PER008_CREATE_ACTION_KEY);
      } catch {
        setOptions(undefined);
        setOptionsContextKey(undefined);
        setActionState('DENIED');
        setActionStateContextKey(contextScopeKey);
        return;
      }
      executeCreate(command, context, contextScopeKey);
    },
    [
      active,
      client,
      commandContextFactory,
      contextScopeKey,
      executeCreate,
      options,
      optionsContextKey,
      selfSubject,
      selfSubjectContextScopeKey,
    ]
  );
  const executeSubmit = useCallback(
    (
      assignmentId: string,
      command: Per008FeedbackResponseCommand,
      context: Per008CommandContext,
      requestedContextKey: string
    ) => {
      if (!client || currentContextScopeKey.current !== requestedContextKey) return;
      const sequence = ++actionSequence.current;
      setActionBusy(true);
      setActionBusyContextKey(requestedContextKey);
      setActionState(undefined);
      setActionStateContextKey(undefined);
      client
        .submitResponse(assignmentId, command, context)
        .then(() => {
          if (
            sequence !== actionSequence.current ||
            currentContextScopeKey.current !== requestedContextKey
          )
            return;
          setUnknownCommand(undefined);
          setDetail((current) =>
            current?.feedbackAssignmentId === assignmentId
              ? { ...current, assignmentState: 'SUBMITTED' }
              : current
          );
          setActionMessage(personalCopy[locale].submitted);
          setActionMessageContextKey(requestedContextKey);
          setActionState(undefined);
          setActionStateContextKey(undefined);
        })
        .catch((error: unknown) => {
          if (
            sequence !== actionSequence.current ||
            currentContextScopeKey.current !== requestedContextKey
          )
            return;
          if (error instanceof Per008CommandOutcomeUnknownError) {
            setUnknownCommand({
              kind: 'SUBMIT',
              contextScopeKey: requestedContextKey,
              assignmentId,
              command,
              context,
            });
            setActionMessage(personalCopy[locale].outcomeUnknown);
            setActionMessageContextKey(requestedContextKey);
          } else {
            setUnknownCommand(undefined);
            setActionMessage(undefined);
            setActionMessageContextKey(undefined);
            setActionState(stateFromError(error));
            setActionStateContextKey(requestedContextKey);
          }
        })
        .finally(() => {
          if (
            sequence === actionSequence.current &&
            currentContextScopeKey.current === requestedContextKey
          ) {
            setActionBusy(false);
            setActionBusyContextKey(undefined);
          }
        });
    },
    [client, locale]
  );
  const submitResponse = useCallback(
    (command: Per008FeedbackResponseCommand) => {
      if (
        !active ||
        !client ||
        !contextScopeKey ||
        detailContextKey !== contextScopeKey ||
        !detail ||
        detailState !== 'COMPLETE' ||
        detail.feedbackAssignmentId !== selectedId ||
        !commandContextFactory
      )
        return;
      let context: Per008CommandContext;
      try {
        context = commandContextFactory(PER008_SUBMIT_ACTION_KEY);
      } catch {
        setActionState('DENIED');
        setActionStateContextKey(contextScopeKey);
        return;
      }
      executeSubmit(detail.feedbackAssignmentId, command, context, contextScopeKey);
    },
    [
      active,
      client,
      commandContextFactory,
      contextScopeKey,
      detail,
      detailContextKey,
      detailState,
      executeSubmit,
      selectedId,
    ]
  );
  const loadRelease = useCallback(
    (requestId: string) => {
      if (
        !active ||
        !client ||
        !contextScopeKey ||
        !releaseTarget ||
        !releaseTargetKey ||
        releaseTarget.provenance !== 'OWNER_AUTHORIZED_RELEASE_REFERENCE' ||
        releaseTarget.contextScopeKey !== contextScopeKey ||
        releaseTarget.feedbackRequestId !== requestId ||
        !releaseTarget.authorizationDecisionRevision.trim()
      )
        return;
      const sequence = ++actionSequence.current;
      const requestedContextKey = contextScopeKey;
      const requestedReleaseKey = releaseTargetKey;
      setActionBusy(true);
      setActionBusyContextKey(requestedContextKey);
      setRelease(undefined);
      setReleaseEvidenceKey(requestedReleaseKey);
      setReleaseState('LOADING');
      client
        .loadRelease(requestId)
        .then((next) => {
          if (
            sequence !== actionSequence.current ||
            currentContextScopeKey.current !== requestedContextKey ||
            next.feedbackRequestId !== requestId
          ) {
            if (
              next.feedbackRequestId !== requestId &&
              currentContextScopeKey.current === requestedContextKey
            )
              setReleaseState('DENIED');
            return;
          }
          setRelease(next);
          setReleaseEvidenceKey(requestedReleaseKey);
          setReleaseState('COMPLETE');
        })
        .catch((error: unknown) => {
          if (
            sequence !== actionSequence.current ||
            currentContextScopeKey.current !== requestedContextKey
          )
            return;
          setReleaseState(stateFromError(error));
          setReleaseEvidenceKey(requestedReleaseKey);
        })
        .finally(() => {
          if (
            sequence === actionSequence.current &&
            currentContextScopeKey.current === requestedContextKey
          ) {
            setActionBusy(false);
            setActionBusyContextKey(undefined);
          }
        });
    },
    [active, client, contextScopeKey, releaseTarget, releaseTargetKey]
  );
  if (!active) return null;
  const inboxMatches = inboxContextKey === contextScopeKey;
  const detailMatches = detailContextKey === contextScopeKey;
  const visibleReleaseTarget =
    releaseTarget &&
    releaseTarget.contextScopeKey === contextScopeKey &&
    releaseTarget.authorizationDecisionRevision.trim()
      ? releaseTarget
      : undefined;
  const visibleUnknown =
    unknownCommand?.contextScopeKey === contextScopeKey ? unknownCommand : undefined;
  const replay =
    visibleUnknown?.kind === 'CREATE'
      ? () =>
          executeCreate(
            visibleUnknown.command,
            visibleUnknown.context,
            visibleUnknown.contextScopeKey
          )
      : visibleUnknown?.kind === 'SUBMIT'
        ? () =>
            executeSubmit(
              visibleUnknown.assignmentId,
              visibleUnknown.command,
              visibleUnknown.context,
              visibleUnknown.contextScopeKey
            )
        : undefined;
  const visibleBusy = actionBusyContextKey === contextScopeKey && actionBusy;
  const visibleState = stateContextKey === contextScopeKey ? state : 'LOADING';
  const visibleActionState = actionStateContextKey === contextScopeKey ? actionState : undefined;
  const activeCursorTrail = inboxCursorContextKey === contextScopeKey ? inboxCursorTrail : [null];
  const nextCursor = inboxMatches && showsProtectedRows(visibleState) ? inbox?.nextCursor : null;
  const preparePageChange = (cursor: string | null, trail: readonly (string | null)[]) => {
    optionsSequence.current += 1;
    setOptions(undefined);
    setOptionsContextKey(undefined);
    setActionState(undefined);
    setActionStateContextKey(undefined);
    setUnknownCommand(undefined);
    setActionMessage(undefined);
    setActionMessageContextKey(undefined);
    setInbox(undefined);
    setInboxContextKey(undefined);
    setSelectedId(undefined);
    setDetail(undefined);
    setDetailContextKey(undefined);
    setDetailState('EMPTY');
    setState('LOADING');
    setStateContextKey(contextScopeKey);
    setInboxCursor(cursor);
    setInboxCursorContextKey(contextScopeKey);
    setInboxCursorTrail(trail);
  };
  const selectAssignment = (assignmentId: string) => {
    setActionState(undefined);
    setActionStateContextKey(undefined);
    setSelectedId(assignmentId);
  };
  return (
    <Per008PersonalFeedbackView
      state={visibleState}
      detailState={detailMatches ? detailState : 'EMPTY'}
      releaseState={
        visibleReleaseTarget && releaseEvidenceKey === releaseTargetKey ? releaseState : 'EMPTY'
      }
      inbox={inboxMatches ? inbox : undefined}
      detail={detailMatches ? detail : undefined}
      release={
        visibleReleaseTarget && releaseEvidenceKey === releaseTargetKey ? release : undefined
      }
      releaseTarget={visibleReleaseTarget}
      selectedAssignmentId={inboxMatches ? selectedId : undefined}
      requestOptions={optionsContextKey === contextScopeKey ? options : undefined}
      canRequestSelf={
        !!selfSubject && selfSubjectContextScopeKey === contextScopeKey && !visibleUnknown
      }
      actionState={visibleActionState}
      actionMessage={actionMessageContextKey === contextScopeKey ? actionMessage : undefined}
      actionBusy={visibleBusy}
      displayTimeZone={displayTimeZone}
      pageNumber={activeCursorTrail.length}
      canPreviousPage={activeCursorTrail.length > 1}
      canNextPage={!!nextCursor}
      locale={locale}
      onRetry={retry}
      onSelect={inboxMatches ? selectAssignment : undefined}
      onBeginSelfRequest={
        selfSubject && selfSubjectContextScopeKey === contextScopeKey && !visibleUnknown
          ? beginSelfRequest
          : undefined
      }
      onCancelRequest={() => {
        optionsSequence.current += 1;
        setOptions(undefined);
        setOptionsContextKey(undefined);
        setActionState(undefined);
        setActionStateContextKey(undefined);
      }}
      onCreateRequest={commandContextFactory ? createRequest : undefined}
      onSubmitResponse={
        commandContextFactory && visibleUnknown?.kind !== 'SUBMIT' ? submitResponse : undefined
      }
      onLoadRelease={loadRelease}
      onReplay={replay}
      onPreviousPage={
        activeCursorTrail.length > 1
          ? () => {
              const previousTrail = activeCursorTrail.slice(0, -1);
              preparePageChange(previousTrail.at(-1) ?? null, previousTrail);
            }
          : undefined
      }
      onNextPage={
        nextCursor
          ? () => {
              preparePageChange(nextCursor, [...activeCursorTrail, nextCursor]);
            }
          : undefined
      }
    />
  );
}
