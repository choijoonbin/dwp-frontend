import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import {
  AlertCircle,
  Check,
  Clock3,
  Hand,
  LoaderCircle,
  MessageSquareText,
  RefreshCw,
  Send,
  ShieldAlert,
  Trash2,
  UserRoundCheck,
  UserRoundX,
  X,
} from 'lucide-react';

import {
  countActionableFloorRequests,
  findOwnFloorRequest,
  normalizeMeetingChatDraft,
  type MeetingChatMessage,
  type MeetingChatPanelState,
  type MeetingCollaborationActions,
  type MeetingCollaborationLabels,
  type MeetingCollaborationPermissions,
  type MeetingCollaborationTab,
  type MeetingFloorPanelState,
  type MeetingFloorRequest,
} from './meeting-collaboration-model';

import './meeting-collaboration-panel.css';

export type MeetingCollaborationPanelProps = {
  activeTab: MeetingCollaborationTab;
  chat: MeetingChatPanelState;
  floor: MeetingFloorPanelState;
  permissions: MeetingCollaborationPermissions;
  labels: MeetingCollaborationLabels;
  actions: MeetingCollaborationActions;
  maxMessageLength: number;
  disabled?: boolean;
  disabledReason?: string | null;
};

function NotificationCount({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="dwp-meeting-collaboration__count" aria-hidden="true">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function PanelState({
  icon,
  title,
  description,
  busy,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  busy?: boolean;
}) {
  return (
    <div
      className="dwp-meeting-collaboration__state"
      role={busy ? 'status' : undefined}
      aria-busy={busy || undefined}
    >
      <span className="dwp-meeting-collaboration__state-icon" aria-hidden="true">
        {icon}
      </span>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
    </div>
  );
}

function InlineError({
  title,
  detail,
  retryLabel,
  onRetry,
}: {
  title: string;
  detail: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <div className="dwp-meeting-collaboration__alert" role="alert">
      <AlertCircle size={18} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
      <button type="button" className="dwp-meeting-collaboration__text-action" onClick={onRetry}>
        <RefreshCw size={15} aria-hidden="true" />
        {retryLabel}
      </button>
    </div>
  );
}

export function MeetingCollaborationPanel({
  activeTab,
  chat,
  floor,
  permissions,
  labels,
  actions,
  maxMessageLength,
  disabled = false,
  disabledReason,
}: MeetingCollaborationPanelProps) {
  const generatedId = useId();
  const tabRefs = useRef(new Map<MeetingCollaborationTab, HTMLButtonElement>());
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const floorCount = countActionableFloorRequests(floor.requests);
  const tabs: readonly MeetingCollaborationTab[] = ['chat', 'floor'];
  const markChatRead = actions.onMarkChatRead;
  const lastMarkedUnreadCount = useRef(0);
  const activeDisabledReason = activeTab === 'chat' ? chat.disabledReason : floor.disabledReason;

  useEffect(() => {
    if (activeTab === 'chat' && permissions.canReadChat && chat.unreadCount > 0) {
      if (lastMarkedUnreadCount.current !== chat.unreadCount) {
        lastMarkedUnreadCount.current = chat.unreadCount;
        markChatRead();
      }
      return;
    }
    lastMarkedUnreadCount.current = 0;
  }, [activeTab, chat.unreadCount, markChatRead, permissions.canReadChat]);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  const selectAdjacentTab = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let nextIndex = currentIndex;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    const nextTab = tabs[nextIndex];
    actions.onTabChange(nextTab);
    tabRefs.current.get(nextTab)?.focus();
  };

  return (
    <aside
      className="dwp-meeting-collaboration"
      aria-label={labels.panelTitle}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        actions.onClose();
      }}
    >
      <header className="dwp-meeting-collaboration__header">
        <div>
          <strong>{labels.panelTitle}</strong>
          <small>{activeTab === 'chat' ? labels.chatDescription : labels.floorDescription}</small>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          className="dwp-meeting-collaboration__icon-button"
          aria-label={labels.close}
          title={labels.close}
          onClick={actions.onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="dwp-meeting-collaboration__tabs" role="tablist">
        {tabs.map((tab, index) => {
          const selected = activeTab === tab;
          const count = tab === 'chat' ? chat.unreadCount : floorCount;
          const label = tab === 'chat' ? labels.chatTab : labels.floorTab;
          const accessibleLabel = count
            ? tab === 'chat'
              ? labels.unreadMessages(count)
              : labels.pendingFloorRequests(count)
            : label;
          return (
            <button
              key={tab}
              ref={(node) => {
                if (node) tabRefs.current.set(tab, node);
                else tabRefs.current.delete(tab);
              }}
              type="button"
              id={`${generatedId}-${tab}-tab`}
              role="tab"
              aria-label={accessibleLabel}
              aria-selected={selected}
              aria-controls={selected ? `${generatedId}-${tab}-panel` : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={() => actions.onTabChange(tab)}
              onKeyDown={(event) => selectAdjacentTab(event, index)}
            >
              {tab === 'chat' ? (
                <MessageSquareText size={17} aria-hidden="true" />
              ) : (
                <Hand size={17} aria-hidden="true" />
              )}
              <span>{label}</span>
              <NotificationCount count={count} />
            </button>
          );
        })}
      </div>

      <div className="dwp-meeting-collaboration__body">
        {(disabledReason || activeDisabledReason) && (
          <div className="dwp-meeting-collaboration__policy" role="status">
            <ShieldAlert size={16} aria-hidden="true" />
            <span>{disabledReason || activeDisabledReason}</span>
          </div>
        )}
        {activeTab === 'chat' ? (
          <PersistentMeetingChat
            id={`${generatedId}-chat-panel`}
            chat={chat}
            permissions={permissions}
            labels={labels}
            actions={actions}
            maxMessageLength={maxMessageLength}
            disabled={disabled}
            labelledBy={`${generatedId}-chat-tab`}
          />
        ) : (
          <MeetingFloorQueue
            id={`${generatedId}-floor-panel`}
            floor={floor}
            permissions={permissions}
            labels={labels}
            actions={actions}
            disabled={disabled}
            labelledBy={`${generatedId}-floor-tab`}
          />
        )}
      </div>
    </aside>
  );
}

function PersistentMeetingChat({
  id,
  chat,
  permissions,
  labels,
  actions,
  maxMessageLength,
  disabled,
  labelledBy,
}: {
  id: string;
  chat: MeetingChatPanelState;
  permissions: MeetingCollaborationPermissions;
  labels: MeetingCollaborationLabels;
  actions: MeetingCollaborationActions;
  maxMessageLength: number;
  disabled: boolean;
  labelledBy: string;
}) {
  const [draft, setDraft] = useState('');
  const preparedDraft = normalizeMeetingChatDraft(draft, maxMessageLength);
  const remaining = Math.max(0, maxMessageLength - draft.length);
  const composerDisabled =
    disabled || !permissions.canSendChat || chat.sending === true || Boolean(chat.disabledReason);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!preparedDraft || composerDisabled) return;
    try {
      await actions.onSendChat(preparedDraft, crypto.randomUUID());
      setDraft('');
    } catch {
      // Retain the draft. The caller owns the governed error detail exposed through chat.error.
    }
  };

  if (!permissions.canReadChat) {
    return (
      <section id={id} role="tabpanel" aria-labelledby={labelledBy}>
        <PanelState
          icon={<ShieldAlert size={22} />}
          title={labels.chatPermissionTitle}
          description={labels.chatPermissionDescription}
        />
      </section>
    );
  }

  return (
    <section
      id={id}
      className="dwp-meeting-chat-persistent"
      role="tabpanel"
      aria-labelledby={labelledBy}
      aria-busy={chat.loading || undefined}
    >
      <div className="dwp-meeting-chat-persistent__stream">
        {chat.error && (
          <InlineError
            title={labels.chatErrorTitle}
            detail={chat.error}
            retryLabel={labels.retry}
            onRetry={actions.onRetryChat}
          />
        )}

        {chat.retentionNotice && (
          <div className="dwp-meeting-collaboration__retention" role="note">
            <Clock3 size={15} aria-hidden="true" />
            <span>{chat.retentionNotice}</span>
          </div>
        )}

        {chat.hasMore && (
          <button
            type="button"
            className="dwp-meeting-collaboration__load-more"
            disabled={chat.loadingMore}
            onClick={() => actions.onLoadMoreMessages(chat.nextSequence ?? 0)}
          >
            {chat.loadingMore && <LoaderCircle size={15} aria-hidden="true" />}
            {chat.loadingMore ? labels.loadingMoreMessages : labels.loadMoreMessages}
          </button>
        )}

        {chat.loading && chat.messages.length === 0 ? (
          <PanelState
            icon={<LoaderCircle className="dwp-meeting-collaboration__spinner" size={22} />}
            title={labels.chatLoading}
            busy
          />
        ) : chat.messages.length === 0 && !chat.error ? (
          <PanelState
            icon={<MessageSquareText size={22} />}
            title={labels.chatEmptyTitle}
            description={labels.chatEmptyDescription}
          />
        ) : (
          <ol className="dwp-meeting-chat-persistent__messages" role="log" aria-live="polite">
            {chat.messages.map((message) => (
              <MeetingChatMessageRow
                key={message.messageId}
                message={message}
                labels={labels}
                canDelete={message.canDelete}
                busy={chat.busyMessageIds?.has(message.messageId) === true}
                disabled={disabled}
                onRetry={() => actions.onRetryMessage(message.messageId)}
                onDelete={() => actions.onDeleteMessage(message.messageId)}
              />
            ))}
          </ol>
        )}
      </div>

      <form className="dwp-meeting-chat-persistent__composer" onSubmit={submit}>
        <textarea
          value={draft}
          rows={2}
          maxLength={maxMessageLength}
          disabled={composerDisabled}
          aria-label={labels.chatPlaceholder}
          aria-describedby={`${id}-remaining`}
          placeholder={chat.disabledReason || labels.chatPlaceholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing &&
              preparedDraft
            ) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          onKeyUp={(event) => event.stopPropagation()}
        />
        <div className="dwp-meeting-chat-persistent__composer-meta">
          <small id={`${id}-remaining`}>{labels.charactersRemaining(remaining)}</small>
          <button
            type="submit"
            className="dwp-meeting-collaboration__primary-action"
            disabled={composerDisabled || !preparedDraft}
            aria-label={chat.sending ? labels.sendingMessage : labels.sendMessage}
          >
            {chat.sending ? (
              <LoaderCircle className="dwp-meeting-collaboration__spinner" size={17} />
            ) : (
              <Send size={17} aria-hidden="true" />
            )}
            <span>{chat.sending ? labels.sendingMessage : labels.sendMessage}</span>
          </button>
        </div>
      </form>
    </section>
  );
}

function MeetingChatMessageRow({
  message,
  labels,
  canDelete,
  busy,
  disabled,
  onRetry,
  onDelete,
}: {
  message: MeetingChatMessage;
  labels: MeetingCollaborationLabels;
  canDelete: boolean;
  busy: boolean;
  disabled: boolean;
  onRetry: () => void;
  onDelete: () => void;
}) {
  const deleted = Boolean(message.deletedAt);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  return (
    <li className="dwp-meeting-chat-message" data-own={message.isOwn || undefined}>
      <div className="dwp-meeting-chat-message__meta">
        <strong>{message.senderName}</strong>
        <time dateTime={message.sentAt}>{labels.timestamp(message.sentAt)}</time>
      </div>
      <div className="dwp-meeting-chat-message__bubble" data-deleted={deleted || undefined}>
        {deleted ? labels.deletedMessage : message.body}
      </div>
      <div className="dwp-meeting-chat-message__actions">
        {message.deliveryState === 'PENDING' && (
          <small role="status">
            <Clock3 size={13} aria-hidden="true" /> {labels.pendingMessage}
          </small>
        )}
        {message.deliveryState === 'DELIVERED' && message.isOwn && (
          <small>
            <Check size={13} aria-hidden="true" />
            <span className="dwp-meeting-visually-hidden">{labels.sendMessage}</span>
          </small>
        )}
        {message.deliveryState === 'FAILED' && (
          <button type="button" disabled={busy || disabled} onClick={onRetry}>
            <RefreshCw size={13} aria-hidden="true" />
            {labels.retryMessage}
            <span className="dwp-meeting-visually-hidden">: {labels.failedMessage}</span>
          </button>
        )}
        {canDelete && !deleted && message.deliveryState !== 'PENDING' && (
          <>
            <button
              type="button"
              className="dwp-meeting-chat-message__delete"
              disabled={busy || disabled}
              aria-label={confirmingDelete ? labels.confirmDeleteMessage : labels.deleteMessage}
              title={confirmingDelete ? labels.confirmDeleteMessage : labels.deleteMessage}
              onClick={() => {
                if (!confirmingDelete) {
                  setConfirmingDelete(true);
                  return;
                }
                onDelete();
                setConfirmingDelete(false);
              }}
            >
              {confirmingDelete ? (
                <AlertCircle size={13} aria-hidden="true" />
              ) : (
                <Trash2 size={13} aria-hidden="true" />
              )}
            </button>
            {confirmingDelete && (
              <button
                type="button"
                disabled={busy || disabled}
                onClick={() => setConfirmingDelete(false)}
              >
                {labels.cancelDeleteMessage}
              </button>
            )}
          </>
        )}
      </div>
    </li>
  );
}

function MeetingFloorQueue({
  id,
  floor,
  permissions,
  labels,
  actions,
  disabled,
  labelledBy,
}: {
  id: string;
  floor: MeetingFloorPanelState;
  permissions: MeetingCollaborationPermissions;
  labels: MeetingCollaborationLabels;
  actions: MeetingCollaborationActions;
  disabled: boolean;
  labelledBy: string;
}) {
  const ownRequest = findOwnFloorRequest(floor.requests);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const mutationDisabled = disabled || floor.mutating === true || Boolean(floor.disabledReason);

  if (!permissions.canViewFloorQueue) {
    return (
      <section id={id} role="tabpanel" aria-labelledby={labelledBy}>
        <PanelState
          icon={<ShieldAlert size={22} />}
          title={labels.floorPermissionTitle}
          description={labels.floorPermissionDescription}
        />
      </section>
    );
  }

  return (
    <section
      id={id}
      className="dwp-meeting-floor"
      role="tabpanel"
      aria-labelledby={labelledBy}
      aria-busy={floor.loading || undefined}
    >
      {permissions.canRequestFloor && (
        <div className="dwp-meeting-floor__self-status">
          <div>
            <strong>{ownRequest ? labels.requestPending : labels.requestFloor}</strong>
            {ownRequest && (
              <small>
                {ownRequest.state === 'RAISED'
                  ? labels.ownQueuePosition(ownRequest.position)
                  : floorStateLabel(ownRequest, labels)}
              </small>
            )}
          </div>
          <button
            type="button"
            className={
              ownRequest
                ? 'dwp-meeting-collaboration__secondary-action'
                : 'dwp-meeting-collaboration__primary-action'
            }
            disabled={mutationDisabled}
            onClick={() =>
              ownRequest ? actions.onLowerHand(ownRequest.requestId) : actions.onRequestFloor()
            }
          >
            <Hand size={16} aria-hidden="true" />
            {ownRequest ? labels.withdrawRequest : labels.requestFloor}
          </button>
        </div>
      )}

      {floor.error && (
        <InlineError
          title={labels.floorErrorTitle}
          detail={floor.error}
          retryLabel={labels.retry}
          onRetry={actions.onRetryFloor}
        />
      )}

      {permissions.canModerateFloor && floor.requests.length > 0 && (
        <div className="dwp-meeting-floor__moderation">
          <span>{labels.pendingFloorRequests(countActionableFloorRequests(floor.requests))}</span>
          <button
            type="button"
            className="dwp-meeting-collaboration__secondary-action"
            disabled={mutationDisabled}
            onClick={() => {
              if (!confirmingClear) {
                setConfirmingClear(true);
                return;
              }
              actions.onClearFloorQueue();
              setConfirmingClear(false);
            }}
          >
            {confirmingClear ? labels.confirmClearFloorQueue : labels.clearFloorQueue}
          </button>
          {confirmingClear && (
            <button
              type="button"
              className="dwp-meeting-collaboration__text-action"
              disabled={mutationDisabled}
              onClick={() => setConfirmingClear(false)}
            >
              {labels.cancelClearFloorQueue}
            </button>
          )}
        </div>
      )}

      <div className="dwp-meeting-floor__queue">
        {floor.loading && floor.requests.length === 0 ? (
          <PanelState
            icon={<LoaderCircle className="dwp-meeting-collaboration__spinner" size={22} />}
            title={labels.floorLoading}
            busy
          />
        ) : floor.requests.length === 0 && !floor.error ? (
          <PanelState
            icon={<Hand size={22} />}
            title={labels.floorEmptyTitle}
            description={labels.floorEmptyDescription}
          />
        ) : (
          <ol className="dwp-meeting-floor__requests" aria-live="polite">
            {floor.requests.map((request) => (
              <MeetingFloorRequestRow
                key={request.requestId}
                request={request}
                own={request.mine}
                canModerate={permissions.canModerateFloor}
                labels={labels}
                disabled={mutationDisabled || floor.busyRequestIds?.has(request.requestId) === true}
                actions={actions}
              />
            ))}
          </ol>
        )}
        {floor.hasMore && (
          <button
            type="button"
            className="dwp-meeting-collaboration__load-more"
            disabled={floor.loadingMore}
            onClick={() => actions.onLoadMoreFloorRequests(floor.nextSequence ?? 0)}
          >
            {floor.loadingMore && <LoaderCircle size={15} aria-hidden="true" />}
            {floor.loadingMore ? labels.loadingMoreFloorRequests : labels.loadMoreFloorRequests}
          </button>
        )}
      </div>
    </section>
  );
}

function floorStateLabel(request: MeetingFloorRequest, labels: MeetingCollaborationLabels): string {
  if (request.state === 'ACKNOWLEDGED') return labels.acknowledged;
  if (request.state === 'LOWERED') return labels.lowered;
  if (request.state === 'DISMISSED') return labels.dismissed;
  if (request.state === 'CLEARED') return labels.cleared;
  return labels.raised;
}

function MeetingFloorRequestRow({
  request,
  own,
  canModerate,
  labels,
  disabled,
  actions,
}: {
  request: MeetingFloorRequest;
  own: boolean;
  canModerate: boolean;
  labels: MeetingCollaborationLabels;
  disabled: boolean;
  actions: MeetingCollaborationActions;
}) {
  return (
    <li
      className="dwp-meeting-floor-request"
      data-state={request.state}
      data-own={own || undefined}
    >
      <span className="dwp-meeting-floor-request__position" aria-hidden="true">
        {request.state === 'RAISED' ? request.position : <Hand size={16} />}
      </span>
      <span className="dwp-meeting-floor-request__avatar" aria-hidden="true">
        {labels.participantInitials(request.participantName)}
      </span>
      <div className="dwp-meeting-floor-request__identity">
        <strong>{request.participantName}</strong>
        <small>
          <span className="dwp-meeting-floor-request__state">
            {floorStateLabel(request, labels)}
          </span>
          <span aria-hidden="true"> · </span>
          {labels.requestedAt(request.requestedAt)}
        </small>
      </div>
      {canModerate && !own && (
        <div className="dwp-meeting-floor-request__actions">
          {request.canAcknowledge && (
            <button
              type="button"
              className="dwp-meeting-collaboration__primary-action"
              disabled={disabled}
              onClick={() => actions.onAcknowledgeFloor(request.requestId)}
            >
              <UserRoundCheck size={15} aria-hidden="true" />
              {labels.acknowledgeRequest}
            </button>
          )}
          {request.canDismiss && (
            <button
              type="button"
              className="dwp-meeting-collaboration__icon-button"
              disabled={disabled}
              aria-label={labels.dismissRequest}
              title={labels.dismissRequest}
              onClick={() => actions.onDismissFloor(request.requestId)}
            >
              <UserRoundX size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </li>
  );
}
