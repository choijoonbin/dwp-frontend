import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  ErrorState,
  LoadingState,
  InlineFeedback,
  PageCanvas,
} from '@dwp-frontend/design-system';
import { HttpError, useAuth, useToast } from '@dwp-frontend/shared-utils';
import { getVideoMeeting } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import {
  getVideoMeetingPreparation,
  issueVideoMeetingMaterialAccessTicket,
  registerVideoMeetingMaterial,
  removeVideoMeetingMaterial,
  replaceVideoMeetingAgenda,
  replaceMyVideoMeetingPreparation,
  respondVideoMeetingInvitation,
  type RegisterVideoMeetingMaterialInput,
  type VideoMeetingAgendaInput,
  type VideoMeetingMaterialAccessTicket,
  type VideoMeetingPreparation,
} from '@dwp-frontend/shared-utils/api/video-meeting-preparation-api';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { MeetingPreparationAgendaEditor } from './meeting-preparation-agenda-editor';
import { validatePreparationMaterialBoundary } from './meeting-preparation-model';
import {
  MeetingPreparationContent,
  MeetingPreparationContext,
  MeetingPreparationPeople,
} from './meeting-preparation-sections';

type Props = { meetingId: string; onEnterMeeting: () => void; onBack: () => void };
function denied(error: unknown) {
  return error instanceof HttpError && [401, 403, 404].includes(error.status);
}

export function MeetingPreparation(props: Props) {
  const { user, isAuthenticated } = useAuth();
  const scope = JSON.stringify([
    isAuthenticated,
    user?.identityPlane,
    user?.tenantId,
    user?.userId,
    props.meetingId,
  ]);
  return (
    <PreparationWorkspace
      key={scope}
      {...props}
      scope={scope}
      authenticated={isAuthenticated && Boolean(user)}
    />
  );
}

function PreparationWorkspace({
  meetingId,
  onEnterMeeting,
  onBack,
  scope,
  authenticated,
}: Props & { scope: string; authenticated: boolean }) {
  const { t } = useTranslation('meetings');
  const toast = useToast();
  const client = useQueryClient();
  const [revoked, setRevoked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<VideoMeetingPreparation | null>(null);
  const [agendaConflict, setAgendaConflict] = useState(false);
  const [invitationConflict, setInvitationConflict] = useState(false);
  const [materialConflict, setMaterialConflict] = useState(false);
  const [personalPreparationConflict, setPersonalPreparationConflict] = useState(false);
  const [commandError, setCommandError] = useState(false);
  const mounted = useRef(false);
  const generation = useRef(0);
  const pending = useRef(false);
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const queryKey = ['meetings', 'preparation', scope] as const;
  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const [meeting, preparation] = await Promise.all([
        getVideoMeeting(meetingId),
        getVideoMeetingPreparation(meetingId, signal),
      ]);
      if (meeting.meetingId !== meetingId || preparation.meetingId !== meetingId)
        throw new Error('Invalid preparation binding');
      return { meeting, preparation: validatePreparationMaterialBoundary(preparation) };
    },
    enabled: authenticated && !revoked,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    meta: { accessSensitive: true },
  });
  const accessDenied = revoked || denied(query.error);
  const snapshot = query.data;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
    };
  }, []);
  useEffect(() => {
    if (!denied(query.error)) return;
    generation.current += 1;
    setRevoked(true);
    setEditor(null);
    client.removeQueries({ queryKey: ['meetings', 'preparation', scope] });
  }, [query.error, client, scope]);
  const refresh = async () => {
    setRevoked(false);
    await client.invalidateQueries({ queryKey });
  };
  const command = async (
    fingerprint: string,
    operation: (key: string) => Promise<VideoMeetingPreparation>,
    kind: 'agenda' | 'response' | 'material' | 'personal'
  ) => {
    if (pending.current || !authenticated || accessDenied || query.isError || !snapshot)
      return false;
    pending.current = true;
    setBusy(true);
    setCommandError(false);
    if (kind === 'agenda') setAgendaConflict(false);
    if (kind === 'material') setMaterialConflict(false);
    if (kind === 'personal') setPersonalPreparationConflict(false);
    const current = generation.current;
    if (attempt.current?.fingerprint !== fingerprint)
      attempt.current = { fingerprint, key: crypto.randomUUID() };
    try {
      const preparation = validatePreparationMaterialBoundary(await operation(attempt.current.key));
      if (
        !mounted.current ||
        generation.current !== current ||
        denied(client.getQueryState(queryKey)?.error)
      )
        return false;
      if (preparation.meetingId !== meetingId) throw new Error('Invalid preparation binding');
      attempt.current = null;
      client.setQueryData(queryKey, { ...snapshot, preparation });
      if (kind === 'agenda') setEditor(null);
      else if (kind === 'response') setInvitationConflict(false);
      else if (kind === 'material') setMaterialConflict(false);
      else setPersonalPreparationConflict(false);
      toast.success(
        t(
          kind === 'agenda'
            ? 'preparation.agendaSaved'
            : kind === 'response'
              ? 'preparation.responseSaved'
              : kind === 'material'
                ? 'preparation.materialSaved'
                : 'preparation.personalPreparationSaved'
        )
      );
      void client.invalidateQueries({ queryKey });
      return true;
    } catch (error) {
      if (!mounted.current || generation.current !== current) return false;
      if (denied(error)) {
        generation.current += 1;
        setRevoked(true);
        setEditor(null);
        client.removeQueries({ queryKey });
      } else if (error instanceof HttpError && error.status === 409) {
        if (kind === 'agenda') setAgendaConflict(true);
        else if (kind === 'response') setInvitationConflict(true);
        else if (kind === 'material') setMaterialConflict(true);
        else setPersonalPreparationConflict(true);
        await query.refetch();
      } else setCommandError(true);
      return false;
    } finally {
      if (mounted.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  };
  const saveAgenda = (items: VideoMeetingAgendaInput[], version: number) => {
    if (!snapshot?.preparation.canEditAgenda) return;
    void command(
      JSON.stringify(['agenda', version, items]),
      (key) => replaceVideoMeetingAgenda(meetingId, items, version, key),
      'agenda'
    );
  };
  const respond = (response: 'ACCEPTED' | 'TENTATIVE' | 'DECLINED') => {
    const preparation = snapshot?.preparation;
    if (!preparation?.canRespond || !preparation.myResponse || invitationConflict) return;
    const revision = preparation.invitationRevision;
    const version = preparation.myResponse.version;
    void command(
      JSON.stringify(['response', response, revision, version]),
      (key) => respondVideoMeetingInvitation(meetingId, response, revision, version, key),
      'response'
    );
  };
  const updatePersonalPreparation = (agendaItemId: string, prepared: boolean) => {
    const preparation = snapshot?.preparation;
    if (!preparation?.canPrepare || personalPreparationConflict) return;
    const preparedIds = new Set(preparation.myPreparation.preparedAgendaItemIds);
    if (prepared) preparedIds.add(agendaItemId);
    else preparedIds.delete(agendaItemId);
    const next = [...preparedIds].sort();
    void command(
      JSON.stringify([
        'personal-preparation',
        preparation.agendaVersion,
        preparation.myPreparation.version,
        next,
      ]),
      (key) =>
        replaceMyVideoMeetingPreparation(
          meetingId,
          next,
          preparation.agendaVersion,
          preparation.myPreparation.version,
          key
        ),
      'personal'
    );
  };
  const registerMaterial = (
    input: RegisterVideoMeetingMaterialInput,
    expectedMaterialsVersion: number
  ) =>
    command(
      JSON.stringify(['material-register', expectedMaterialsVersion, input]),
      (key) => registerVideoMeetingMaterial(meetingId, input, expectedMaterialsVersion, key),
      'material'
    );
  const removeMaterial = (
    materialId: string,
    expectedMaterialsVersion: number,
    expectedVersion: number
  ) =>
    command(
      JSON.stringify(['material-remove', materialId, expectedMaterialsVersion, expectedVersion]),
      (key) =>
        removeVideoMeetingMaterial(
          meetingId,
          materialId,
          expectedMaterialsVersion,
          expectedVersion,
          key
        ),
      'material'
    );
  const accessMaterial = async (
    materialId: string,
    expectedVersion: number
  ): Promise<VideoMeetingMaterialAccessTicket | null> => {
    if (pending.current || !authenticated || accessDenied || query.isError || !snapshot)
      return null;
    pending.current = true;
    setBusy(true);
    setCommandError(false);
    const current = generation.current;
    try {
      const ticket = await issueVideoMeetingMaterialAccessTicket(
        meetingId,
        materialId,
        expectedVersion
      );
      if (
        !mounted.current ||
        generation.current !== current ||
        denied(client.getQueryState(queryKey)?.error)
      )
        return null;
      return ticket;
    } catch (error) {
      if (!mounted.current || generation.current !== current) return null;
      if (denied(error)) {
        generation.current += 1;
        setRevoked(true);
        setEditor(null);
        client.removeQueries({ queryKey });
      } else setCommandError(true);
      return null;
    } finally {
      if (mounted.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  };
  return (
    <PageCanvas mode="workspace" topInset="compact">
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <ActionButton
          intent="quiet"
          startIcon={<ArrowLeft size={16} aria-hidden="true" />}
          onClick={onBack}
          disabled={busy}
          sx={{ minHeight: 44 }}
        >
          {t('preparation.back')}
        </ActionButton>
        <ActionIconButton
          label={t('actions.refresh')}
          loading={query.isFetching}
          onClick={() => void refresh()}
        >
          <RefreshCw size={18} aria-hidden="true" />
        </ActionIconButton>
      </Stack>
      {!authenticated || accessDenied ? (
        <ErrorState
          title={t('preparation.accessTitle')}
          description={t('preparation.accessDescription')}
          retryLabel={t('actions.retry')}
          onRetry={() => void refresh()}
        />
      ) : (
        <>
          {query.isError ? (
            <ErrorState
              title={t('preparation.loadError')}
              description={t('preparation.loadErrorHint')}
              retryLabel={t('actions.retry')}
              onRetry={() => void refresh()}
            />
          ) : !snapshot ? (
            <LoadingState label={t('preparation.loading')} variant="skeleton" skeletonRows={5} />
          ) : (
            <Box data-testid="meeting-preparation">
              {commandError && (
                <InlineFeedback severity="error" sx={{ mb: 2 }}>
                  {t('preparation.commandError')}
                </InlineFeedback>
              )}
              <MeetingPreparationContext
                meeting={snapshot.meeting}
                busy={busy}
                onEnter={onEnterMeeting}
              />
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'minmax(0,8fr) minmax(0,4fr)' },
                  gap: { xs: 2, md: 3 },
                  alignItems: 'start',
                }}
              >
                <MeetingPreparationContent
                  meeting={snapshot.meeting}
                  preparation={snapshot.preparation}
                  busy={busy}
                  materialConflict={materialConflict}
                  personalPreparationConflict={personalPreparationConflict}
                  onRegisterMaterial={registerMaterial}
                  onRemoveMaterial={removeMaterial}
                  onAccessMaterial={accessMaterial}
                  onEdit={() => {
                    setAgendaConflict(false);
                    setEditor(snapshot.preparation);
                  }}
                  onReviewPersonalPreparation={() => setPersonalPreparationConflict(false)}
                  onUpdatePersonalPreparation={updatePersonalPreparation}
                />
                <MeetingPreparationPeople
                  preparation={snapshot.preparation}
                  meeting={snapshot.meeting}
                  busy={busy}
                  invitationConflict={invitationConflict}
                  onReviewInvitation={() => setInvitationConflict(false)}
                  onRespond={respond}
                />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                {t('preparation.observedAt', { value: snapshot.preparation.observedAt })}
              </Typography>
            </Box>
          )}
          {editor && snapshot && (
            <MeetingPreparationAgendaEditor
              initial={editor}
              latest={{
                ...snapshot.preparation,
                canEditAgenda: snapshot.preparation.canEditAgenda && !query.isError,
              }}
              meeting={snapshot.meeting}
              busy={busy || query.isFetching}
              conflict={agendaConflict}
              commandError={commandError}
              onClose={() => setEditor(null)}
              onSubmit={saveAgenda}
            />
          )}
        </>
      )}
    </PageCanvas>
  );
}
