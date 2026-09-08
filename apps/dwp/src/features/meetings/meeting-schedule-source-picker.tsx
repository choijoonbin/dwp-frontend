import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { History } from 'lucide-react';
import {
  ActionButton,
  FormDialog,
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';
import { HttpError } from '@dwp-frontend/shared-utils';
import {
  getVideoMeeting,
  getVideoMeetings,
  type VideoMeetingSummary,
} from '@dwp-frontend/shared-utils/api/video-meeting-api';
import { getVideoMeetingPreparation } from '@dwp-frontend/shared-utils/api/video-meeting-preparation-api';
import {
  applyVideoMeetingTemplate,
  getVideoMeetingTemplate,
  getVideoMeetingTemplates,
  type VideoMeetingTemplate,
} from '@dwp-frontend/shared-utils/api/video-meeting-templates-api';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { emptyMeetingSchedule, type MeetingScheduleDraft } from './meeting-schedule-model';
import { meetingShape } from './meeting-visual-system';
import { MeetingScheduleTemplateSelection } from './meeting-schedule-template-selection';

/** Copy only authorable structure: never participants, access, consent or previous invitation identity. */
export function copyMeetingScheduleStructure(
  draft: MeetingScheduleDraft,
  meeting: VideoMeetingSummary,
  preparation: Awaited<ReturnType<typeof getVideoMeetingPreparation>>
) {
  const { sourceTemplateId: _id, sourceTemplateVersion: _version, ...rest } = draft;
  return {
    ...rest,
    title: meeting.title,
    agenda: meeting.agenda ?? '',
    durationMinutes: meeting.durationMinutes,
    agendaItems: preparation.agendaItems.map((item) => ({
      key: crypto.randomUUID(),
      title: item.title,
      objective: item.objective ?? '',
      plannedMinutes: item.plannedMinutes ?? 5,
      ownerUserId: null,
    })),
  };
}

export function MeetingScheduleSourcePicker({
  kind,
  draft,
  busy,
  update,
  onRevoke,
}: {
  kind: 'template' | 'recent';
  draft: MeetingScheduleDraft;
  busy: boolean;
  update: (draft: MeetingScheduleDraft) => void;
  onRevoke: () => void;
}) {
  const { t } = useTranslation('meetings');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Array<VideoMeetingTemplate | VideoMeetingSummary>>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const alive = useRef(false);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const attempt = useRef<{ id: string; version: number; key: string } | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const current = ++generation.current;
    setLoading(true);
    setItems([]);
    setSelected(null);
    setFailed(false);
    const request =
      kind === 'template'
        ? getVideoMeetingTemplates({ page: 0, pageSize: 30 }, controller.signal)
        : getVideoMeetings(0, 10);
    void request
      .then((result) => {
        if (alive.current && current === generation.current && !controller.signal.aborted)
          setItems(result.items);
      })
      .catch((error) => {
        if (!alive.current || current !== generation.current || controller.signal.aborted) return;
        if (error instanceof HttpError && [401, 403].includes(error.status)) {
          setOpen(false);
          onRevoke();
        } else setFailed(true);
      })
      .finally(() => {
        if (alive.current && current === generation.current && !controller.signal.aborted)
          setLoading(false);
      });
    return () => controller.abort();
  }, [open, retry, kind, onRevoke]);
  const apply = async () => {
    if (inFlight.current || !selected || busy) return;
    inFlight.current = true;
    setApplying(true);
    setFailed(false);
    const current = generation.current;
    try {
      let result: MeetingScheduleDraft;
      if (kind === 'template') {
        const template = await getVideoMeetingTemplate(selected);
        if (!alive.current || current !== generation.current) return;
        const listed = items.find((item) => 'templateId' in item && item.templateId === selected);
        if (!listed || template.templateId !== selected || template.version !== listed.version)
          throw new Error(
            'The selected template changed; review the refreshed source before applying'
          );
        if (attempt.current?.id !== selected || attempt.current.version !== template.version)
          attempt.current = { id: selected, version: template.version, key: crypto.randomUUID() };
        const source = await applyVideoMeetingTemplate(
          selected,
          template.version,
          attempt.current.key
        );
        if (
          source.sourceTemplateId !== selected ||
          source.sourceTemplateVersion !== template.version
        )
          throw new Error('The template application does not match the selected revision');
        const structure = emptyMeetingSchedule(draft.timeZone, source);
        result = {
          ...draft,
          title: structure.title,
          agenda: structure.agenda,
          durationMinutes: structure.durationMinutes,
          agendaItems: structure.agendaItems,
          sourceTemplateId: structure.sourceTemplateId,
          sourceTemplateVersion: structure.sourceTemplateVersion,
        };
      } else {
        const [meeting, preparation] = await Promise.all([
          getVideoMeeting(selected),
          getVideoMeetingPreparation(selected),
        ]);
        if (meeting.meetingId !== selected || preparation.meetingId !== selected)
          throw new Error('The meeting source does not match the selected reference');
        result = copyMeetingScheduleStructure(draft, meeting, preparation);
      }
      if (!alive.current || current !== generation.current) return;
      update(result);
      setOpen(false);
      attempt.current = null;
    } catch (error) {
      if (!alive.current || current !== generation.current) return;
      if (error instanceof HttpError && [401, 403].includes(error.status)) {
        setOpen(false);
        onRevoke();
      } else setFailed(true);
    } finally {
      if (alive.current && current === generation.current) {
        inFlight.current = false;
        setApplying(false);
      }
    }
  };
  return (
    <>
      {kind === 'template' ? (
        <MeetingScheduleTemplateSelection
          templateId={draft.sourceTemplateId}
          version={draft.sourceTemplateVersion}
          busy={busy}
          onChoose={() => setOpen(true)}
          onRevoke={onRevoke}
        />
      ) : (
        <ActionButton
          intent="secondary"
          startIcon={<History size={17} aria-hidden="true" />}
          disabled={busy}
          onClick={() => setOpen(true)}
        >
          {t('scheduleWorkspace.design.copyRecent')}
        </ActionButton>
      )}
      <FormDialog
        open={open}
        title={t(
          'scheduleWorkspace.design.' + (kind === 'template' ? 'chooseTemplate' : 'copyRecent')
        )}
        description={t('scheduleWorkspace.design.replaceStructureHint')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('scheduleWorkspace.design.applyStructure')}
        submitDisabled={!selected || loading}
        busy={applying}
        mobileFullScreen
        onClose={() => {
          if (!applying) {
            generation.current++;
            setOpen(false);
          }
        }}
        onSubmit={apply}
      >
        <Stack gap={1.5}>
          {loading && <LoadingState label={t('templates.loading')} />}
          {failed && (
            <InlineFeedback severity="warning">
              <Stack gap={1}>
                <Typography variant="body2">
                  {t('scheduleWorkspace.design.sourceFailed')}
                </Typography>
                <ActionButton intent="secondary" onClick={() => setRetry((value) => value + 1)}>
                  {t('actions.retry')}
                </ActionButton>
              </Stack>
            </InlineFeedback>
          )}
          {!loading && !failed && !items.length && (
            <Typography variant="body2">{t('scheduleWorkspace.design.sourceEmpty')}</Typography>
          )}
          {items.map((item) => {
            const isTemplate = 'templateId' in item;
            const id = isTemplate ? item.templateId : item.meetingId;
            return (
              <ActionButton
                key={id}
                intent={selected === id ? 'secondary' : 'quiet'}
                aria-pressed={selected === id}
                onClick={() => setSelected(id)}
                sx={{
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  whiteSpace: 'normal',
                  p: 1.5,
                  border: 1,
                  borderColor: selected === id ? 'primary.main' : 'divider',
                  borderRadius: meetingShape.card,
                }}
              >
                <Stack gap={0.5}>
                  <Typography variant="subtitle2">{isTemplate ? item.name : item.title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('units.minutes', { count: item.durationMinutes })} ·{' '}
                    {isTemplate ? t('templates.scopes.' + item.scope) : item.organizerName}
                  </Typography>
                </Stack>
              </ActionButton>
            );
          })}
        </Stack>
      </FormDialog>
    </>
  );
}
