import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ActionButton, ErrorState, LoadingState, PageCanvas } from '@dwp-frontend/design-system';
import { useAuth } from '@dwp-frontend/shared-utils';
import {
  getVideoMeetingTemplate,
  type VideoMeetingTemplateScheduleDraft,
} from '@dwp-frontend/shared-utils/api/video-meeting-templates-api';
import { ProductSurfaceLocalNotFound } from '../../components/product-surface-local-not-found';
import { MeetingPersonalRoom } from './meeting-personal-room';
import { MeetingPreparation } from './meeting-preparation';
import { MeetingScheduleWorkspace } from './meeting-schedule-workspace';
import { MyMeetings } from './my-meetings';
import {
  meetingContextRequest,
  meetingDraftFromCurrentTemplate,
  meetingPreparationPath,
  type MeetingTemplateReference,
} from './meeting-context-routing';

/** All contextual screens inherit My Meetings' product access boundary. */
export function MeetingContextWorkspace() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const client = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const request = meetingContextRequest(search);
  const scope = JSON.stringify([
    isAuthenticated,
    user?.identityPlane,
    user?.tenantId,
    user?.userId,
  ]);
  const back = () => navigate('/meetings/mine');
  const enter = (meetingId: string) => navigate('/meetings/room/' + encodeURIComponent(meetingId));
  const created = (meetingId: string) => {
    void client.invalidateQueries({ queryKey: ['meetings'] });
    navigate(meetingPreparationPath(meetingId), { replace: true });
  };
  switch (request.view) {
    case 'list':
      return <MyMeetings />;
    case 'personal-room':
      return (
        <MeetingPersonalRoom
          key={scope}
          onBack={back}
          onEnterMeeting={enter}
          onCheckDevices={() => navigate('/meetings/preferences')}
        />
      );
    case 'preparation':
      return (
        <MeetingPreparation
          key={scope + request.meetingId}
          meetingId={request.meetingId}
          onEnterMeeting={() => enter(request.meetingId)}
          onBack={back}
        />
      );
    case 'schedule':
      return (
        <MeetingScheduleEntry
          key={scope + JSON.stringify(request.template)}
          template={request.template}
          authenticated={isAuthenticated && Boolean(user?.tenantId) && Boolean(user?.userId)}
          onCreated={created}
          onCancel={back}
        />
      );
    default:
      return <ProductSurfaceLocalNotFound />;
  }
}

type TemplateLoad =
  | { status: 'loading' | 'error' | 'changed' }
  | { status: 'ready'; draft: VideoMeetingTemplateScheduleDraft };
function MeetingScheduleEntry({
  template,
  authenticated,
  onCreated,
  onCancel,
}: {
  template: MeetingTemplateReference | null;
  authenticated: boolean;
  onCreated: (meetingId: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation('meetings');
  const [loaded, setLoaded] = useState<TemplateLoad>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const templateId = template?.templateId;
  const version = template?.version;
  useEffect(() => {
    if (!authenticated || !templateId || version === undefined) return;
    const abort = new AbortController();
    setLoaded({ status: 'loading' });
    void getVideoMeetingTemplate(templateId, abort.signal)
      .then((value) => {
        if (abort.signal.aborted) return;
        const draft = meetingDraftFromCurrentTemplate(value, { templateId, version });
        setLoaded(draft ? { status: 'ready', draft } : { status: 'changed' });
      })
      .catch(() => {
        if (!abort.signal.aborted) setLoaded({ status: 'error' });
      });
    return () => abort.abort();
  }, [authenticated, templateId, version, attempt]);
  if (!authenticated)
    return (
      <PageCanvas mode="workspace" topInset="compact">
        <ErrorState title={t('context.accessRequired')} />
      </PageCanvas>
    );
  if (!template) return <MeetingScheduleWorkspace onCreated={onCreated} onCancel={onCancel} />;
  if (loaded.status === 'ready')
    return (
      <MeetingScheduleWorkspace
        initialTemplateDraft={loaded.draft}
        onCreated={onCreated}
        onCancel={onCancel}
      />
    );
  return (
    <PageCanvas mode="workspace" topInset="compact">
      {loaded.status === 'loading' ? (
        <LoadingState label={t('context.checkingTemplate')} />
      ) : (
        <>
          <ErrorState
            title={t(
              loaded.status === 'changed'
                ? 'context.templateChanged'
                : 'context.templateUnavailable'
            )}
            description={t('context.templateRevalidationHint')}
            retryLabel={loaded.status === 'error' ? t('actions.retry') : undefined}
            onRetry={loaded.status === 'error' ? () => setAttempt((value) => value + 1) : undefined}
          />
          <ActionButton intent="secondary" onClick={onCancel}>
            {t('context.backToMeetings')}
          </ActionButton>
        </>
      )}
    </PageCanvas>
  );
}
