import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CalendarClock,
  Camera,
  Copy,
  Mic,
  Sparkles,
  Volume2,
  ClipboardList,
  FileText,
  MessageSquare,
  Pencil,
  ShieldCheck,
  Target,
  UsersRound,
} from 'lucide-react';
import { ActionButton, SectionHeader, InlineFeedback } from '@dwp-frontend/design-system';
import type { VideoMeetingSummary } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import type {
  RegisterVideoMeetingMaterialInput,
  VideoMeetingMaterialAccessTicket,
  VideoMeetingPreparation,
} from '@dwp-frontend/shared-utils/api/video-meeting-preparation-api';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { preparationEntryAllowed, preparationInvitationChanged } from './meeting-preparation-model';
import { MeetingStatusChip } from './meeting-components';
import { MeetingPreparationMaterials } from './meeting-preparation-materials';
import { MeetingPreparationDisclosure } from './meeting-preparation-disclosure';
import {
  meetingInsetSurface as meetingInset,
  meetingShape,
  meetingSurface,
  type MeetingSurfaceTone,
} from './meeting-visual-system';

function PreparationSection({
  id,
  icon,
  title,
  meta,
  children,
  tone = 'neutral',
}: {
  id: string;
  icon: typeof Target;
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  tone?: MeetingSurfaceTone;
}) {
  return (
    <Stack
      component="section"
      aria-labelledby={id}
      gap={{ xs: 1.25, md: 2 }}
      sx={(theme) => ({
        ...meetingSurface(theme, { tone, elevated: tone !== 'neutral' }),
        p: { xs: 2, md: 3 },
        minWidth: 0,
      })}
    >
      <SectionHeader
        id={id}
        icon={icon}
        title={title}
        meta={meta}
        density="compact"
        glyph="plain"
      />
      {children}
    </Stack>
  );
}

export function MeetingPreparationContext({
  meeting,
  onEnter,
  busy,
}: {
  meeting: VideoMeetingSummary;
  onEnter: () => void;
  busy: boolean;
}) {
  const { t, i18n } = useTranslation('meetings');
  const [copyStatus, setCopyStatus] = useState<'copied' | 'copyFailed' | null>(null);
  const copyInvitation = async () => {
    try {
      const url = new URL('/meetings/join', window.location.origin);
      url.searchParams.set('code', meeting.meetingCode);
      await navigator.clipboard.writeText(url.href);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('copyFailed');
    }
  };
  return (
    <Stack
      component="section"
      gap={2}
      aria-labelledby="preparation-title"
      sx={(theme) => ({
        ...meetingSurface(theme, { tone: 'primary', elevated: true }),
        p: { xs: 2, md: 3 },
        mb: { xs: 2, md: 3 },
      })}
    >
      <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
        <MeetingStatusChip state={meeting.lifecycleState} />
        {meeting.myRole && (
          <Chip size="small" variant="outlined" label={t('room.roles.' + meeting.myRole)} />
        )}
        <Typography variant="caption" color="text.secondary">
          {t('access.' + meeting.accessScope)}
        </Typography>
      </Stack>
      <Typography
        id="preparation-title"
        component="h1"
        variant="h3"
        sx={{ typography: { xs: 'h5', md: 'h3' }, overflowWrap: 'anywhere' }}
      >
        {meeting.title}
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={1.5} alignItems="center">
        <CalendarClock size={16} aria-hidden="true" />
        <Typography variant="body2">
          {formatDate(
            meeting.startsAt,
            {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              timeZone: meeting.timeZone,
            },
            resolveSupportedLocale(i18n.language)
          )}{' '}
          · {t('units.minutes', { count: meeting.durationMinutes })} · {meeting.timeZone}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('preparation.host', { name: meeting.organizerName })}
        </Typography>
      </Stack>
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', md: 'center' },
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          gap={1}
          sx={{ width: { xs: '100%', md: 'auto' }, ml: { md: 'auto' } }}
        >
          <ActionButton
            intent="primary"
            disabled={busy || !preparationEntryAllowed(meeting)}
            onClick={onEnter}
            startIcon={<Camera size={18} aria-hidden="true" />}
            sx={{ minHeight: 44, flexShrink: 0 }}
          >
            {t('preparation.enter')}
          </ActionButton>
          <ActionButton
            intent="secondary"
            disabled={busy || !meeting.meetingCode}
            onClick={() => void copyInvitation()}
            startIcon={<Copy size={16} aria-hidden="true" />}
            sx={{ minHeight: 44, order: { sm: -1 } }}
          >
            {t('home.design.copyLink')}
          </ActionButton>
        </Stack>
      </Box>
      {copyStatus && (
        <Typography
          role="status"
          variant="caption"
          color={copyStatus === 'copyFailed' ? 'error.main' : 'success.main'}
        >
          {t(`home.design.${copyStatus === 'copied' ? 'linkCopied' : 'copyFailed'}`)}
        </Typography>
      )}
      {!preparationEntryAllowed(meeting) && (
        <Typography variant="caption" color="text.secondary">
          {t('preparation.entryUnavailable')}
        </Typography>
      )}
      <MeetingPreparationDisclosure label={t('preparation.design.entrySafety')}>
        <Stack gap={0.75}>
          <Typography variant="caption" color="text.secondary">
            {t('preparation.entryNotice')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('preparation.scheduleManagementHint')}
          </Typography>
        </Stack>
      </MeetingPreparationDisclosure>
    </Stack>
  );
}

export function MeetingPreparationContent({
  meeting,
  preparation,
  busy,
  materialConflict,
  personalPreparationConflict,
  onRegisterMaterial,
  onRemoveMaterial,
  onAccessMaterial,
  onEdit,
  onReviewPersonalPreparation,
  onUpdatePersonalPreparation,
}: {
  meeting: VideoMeetingSummary;
  preparation: VideoMeetingPreparation;
  busy: boolean;
  materialConflict: boolean;
  personalPreparationConflict: boolean;
  onRegisterMaterial: (
    input: RegisterVideoMeetingMaterialInput,
    expectedMaterialsVersion: number
  ) => Promise<boolean>;
  onRemoveMaterial: (
    materialId: string,
    expectedMaterialsVersion: number,
    expectedVersion: number
  ) => Promise<boolean>;
  onAccessMaterial: (
    materialId: string,
    expectedVersion: number
  ) => Promise<VideoMeetingMaterialAccessTicket | null>;
  onEdit: () => void;
  onReviewPersonalPreparation: () => void;
  onUpdatePersonalPreparation: (agendaItemId: string, prepared: boolean) => void;
}) {
  const { t } = useTranslation('meetings');
  const preparedAgendaItemIds = new Set(preparation.myPreparation.preparedAgendaItemIds);
  const preparedCount = preparation.agendaItems.filter((item) =>
    preparedAgendaItemIds.has(item.itemId)
  ).length;
  const preparationComplete =
    preparation.agendaItems.length > 0 && preparedCount === preparation.agendaItems.length;
  return (
    <Stack gap={{ xs: 2, md: 3 }} sx={{ minWidth: 0 }}>
      <PreparationSection id="preparation-purpose" icon={Target} title={t('preparation.purpose')}>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {meeting.description || t('preparation.noPurpose')}
        </Typography>
        <Stack
          gap={1}
          sx={(theme) => ({ ...meetingInset(theme, 'primary'), p: 2 })}
          data-testid="meeting-preparation-briefing"
        >
          <SectionHeader
            icon={Sparkles}
            glyph="plain"
            density="compact"
            title={t('preparation.design.briefing')}
          />
          <Typography variant="body2" color="text.secondary">
            {t('preparation.briefingUnavailable')}
          </Typography>
          <MeetingPreparationDisclosure label={t('preparation.design.moreInformation')}>
            <Typography variant="caption" color="text.secondary">
              {t('preparation.design.briefingEvidence')}
            </Typography>
          </MeetingPreparationDisclosure>
        </Stack>
      </PreparationSection>
      <PreparationSection
        id="preparation-agenda"
        icon={ClipboardList}
        title={t('preparation.agenda')}
        meta={
          preparation.canEditAgenda ? (
            <ActionButton
              intent="quiet"
              size="small"
              startIcon={<Pencil size={15} aria-hidden="true" />}
              disabled={busy}
              onClick={onEdit}
              sx={{ minHeight: 44 }}
            >
              {t('preparation.editAgenda')}
            </ActionButton>
          ) : (
            t('preparation.readOnly')
          )
        }
      >
        <Typography variant="caption" color="text.secondary">
          {t('preparation.agendaVersion', { version: preparation.agendaVersion })}
        </Typography>
        {preparation.agendaItems.length > 0 && (
          <Box
            component="details"
            open={personalPreparationConflict || undefined}
            sx={{
              borderTop: 1,
              borderColor: 'divider',
              pt: 1,
              '& > summary': {
                minHeight: 44,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                listStyle: 'none',
                '&::-webkit-details-marker': { display: 'none' },
              },
            }}
          >
            <Box component="summary">
              <Typography component="span" variant="subtitle2" sx={{ flex: 1 }}>
                {t('preparation.personalChecklist')}
              </Typography>
              <Typography
                component="span"
                variant="caption"
                color={preparationComplete ? 'success.main' : 'text.secondary'}
                role="status"
                aria-live="polite"
              >
                {t('preparation.personalChecklistProgress', {
                  completed: preparedCount,
                  total: preparation.agendaItems.length,
                })}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              {t('preparation.personalChecklistHint')}
            </Typography>
            {personalPreparationConflict && (
              <InlineFeedback severity="warning" sx={{ mb: 1 }}>
                <Stack gap={1}>
                  <Typography variant="body2">
                    {t('preparation.personalPreparationConflict')}
                  </Typography>
                  <ActionButton
                    intent="quiet"
                    disabled={busy}
                    onClick={onReviewPersonalPreparation}
                    sx={{ alignSelf: 'flex-start', minHeight: 44 }}
                  >
                    {t('preparation.reviewPersonalPreparation')}
                  </ActionButton>
                </Stack>
              </InlineFeedback>
            )}
          </Box>
        )}
        {preparation.agendaItems.length ? (
          <Stack component="ol" gap={1.5} sx={{ m: 0, p: 0, listStyle: 'none' }}>
            {[...preparation.agendaItems]
              .sort((a, b) => a.position - b.position)
              .map((item, index) => (
                <Box
                  component="li"
                  key={item.itemId}
                  sx={{
                    display: 'flex',
                    gap: 1.5,
                    p: 1.5,
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: meetingShape.card,
                    minWidth: 0,
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    color="primary.main"
                    sx={(theme) => ({
                      ...meetingInset(theme, 'primary'),
                      p: 0.75,
                      alignSelf: 'flex-start',
                      minWidth: 32,
                      textAlign: 'center',
                    })}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </Typography>
                  <Stack gap={0.75} sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      component="h3"
                      variant="subtitle1"
                      sx={{ overflowWrap: 'anywhere' }}
                    >
                      {item.title}
                    </Typography>
                    {item.objective && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                      >
                        {item.objective}
                      </Typography>
                    )}
                    <Stack
                      direction="row"
                      flexWrap="wrap"
                      gap={1}
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <Stack direction="row" flexWrap="wrap" gap={1}>
                        <Typography variant="caption" color="text.secondary">
                          {item.ownerDisplayName ?? t('preparation.unassigned')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.plannedMinutes
                            ? t('units.minutes', { count: item.plannedMinutes })
                            : t('preparation.noTime')}
                        </Typography>
                      </Stack>
                      <FormControlLabel
                        sx={{ m: 0, minHeight: 44 }}
                        control={
                          <Checkbox
                            checked={preparedAgendaItemIds.has(item.itemId)}
                            disabled={
                              busy || personalPreparationConflict || !preparation.canPrepare
                            }
                            onChange={(_, checked) =>
                              onUpdatePersonalPreparation(item.itemId, checked)
                            }
                            inputProps={{
                              'aria-label': t('preparation.personalAgendaItemLabel', {
                                title: item.title,
                              }),
                            }}
                            sx={{ p: 1.25 }}
                          />
                        }
                        label={t(
                          preparedAgendaItemIds.has(item.itemId)
                            ? 'preparation.prepared'
                            : 'preparation.markPrepared'
                        )}
                        slotProps={{ typography: { variant: 'caption' } }}
                      />
                    </Stack>
                  </Stack>
                </Box>
              ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {t('preparation.noAgenda')}
          </Typography>
        )}
      </PreparationSection>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        <PreparationSection
          id="preparation-materials"
          icon={FileText}
          title={t('preparation.materials')}
        >
          <MeetingPreparationMaterials
            preparation={preparation}
            busy={busy}
            conflict={materialConflict}
            onRegister={onRegisterMaterial}
            onRemove={onRemoveMaterial}
            onAccess={onAccessMaterial}
          />
        </PreparationSection>
        <PreparationSection
          id="preparation-chat"
          icon={MessageSquare}
          title={t('preparation.chat')}
        >
          <Box sx={(theme) => ({ ...meetingInset(theme), p: 2 })}>
            <Typography variant="body2" color="text.secondary">
              {t('preparation.chatUnavailable')}
            </Typography>
          </Box>
          <MeetingPreparationDisclosure label={t('preparation.design.moreInformation')}>
            <Typography variant="caption" color="text.secondary">
              {t('preparation.design.chatBoundary')}
            </Typography>
          </MeetingPreparationDisclosure>
        </PreparationSection>
      </Box>
    </Stack>
  );
}

export function MeetingPreparationPeople({
  preparation,
  meeting,
  busy,
  invitationConflict,
  onReviewInvitation,
  onRespond,
  onEnter,
}: {
  preparation: VideoMeetingPreparation;
  meeting: VideoMeetingSummary;
  busy: boolean;
  invitationConflict: boolean;
  onReviewInvitation: () => void;
  onRespond: (value: 'ACCEPTED' | 'TENTATIVE' | 'DECLINED') => void;
  onEnter: () => void;
}) {
  const { t } = useTranslation('meetings');
  const counts = preparation.invitationCounts;
  return (
    <Stack gap={{ xs: 2, md: 3 }} sx={{ minWidth: 0 }}>
      <PreparationSection id="preparation-people" icon={UsersRound} title={t('preparation.people')}>
        <Typography variant="body2">{t('preparation.responseCounts', counts)}</Typography>
        {preparation.myResponse && (
          <Box
            sx={{
              p: 1.5,
              bgcolor: 'action.hover',
              borderRadius: meetingShape.inset,
            }}
          >
            <MeetingPreparationDisclosure
              label={
                <>
                  {t('preparation.design.responseChange')} ·{' '}
                  {t('preparation.responses.' + preparation.myResponse.response)}
                </>
              }
              forceOpen={
                invitationConflict ||
                preparationInvitationChanged(preparation) ||
                ['PENDING', 'NEEDS_RESPONSE', 'RECONFIRM_REQUIRED'].includes(
                  preparation.myResponse.response
                )
              }
            >
              <Typography variant="subtitle2" sx={{ mb: 1, display: { xs: 'none', md: 'block' } }}>
                {t('preparation.myResponse')}
              </Typography>
              <Chip
                size="small"
                sx={{ display: { xs: 'none', md: 'inline-flex' } }}
                label={t('preparation.responses.' + preparation.myResponse.response)}
              />
              {(invitationConflict || preparationInvitationChanged(preparation)) && (
                <InlineFeedback severity="warning" sx={{ mt: 1 }}>
                  {t('preparation.invitationChanged')}
                  {invitationConflict && (
                    <ActionButton intent="quiet" onClick={onReviewInvitation} disabled={busy}>
                      {t('preparation.reviewInvitation')}
                    </ActionButton>
                  )}
                </InlineFeedback>
              )}
              {preparation.canRespond && (
                <Stack direction="row" gap={0.75} sx={{ mt: 1.5 }}>
                  {(['ACCEPTED', 'TENTATIVE', 'DECLINED'] as const).map((value) => (
                    <ActionButton
                      key={value}
                      intent={value === 'ACCEPTED' ? 'secondary' : 'quiet'}
                      disabled={busy || invitationConflict}
                      onClick={() => onRespond(value)}
                      sx={{ minHeight: 44, minWidth: 0, flex: 1, px: 0.5, whiteSpace: 'normal' }}
                    >
                      {t('preparation.responseActions.' + value)}
                    </ActionButton>
                  ))}
                </Stack>
              )}
            </MeetingPreparationDisclosure>
          </Box>
        )}
        <Stack
          component="ul"
          tabIndex={0}
          aria-label={t('preparation.people')}
          onKeyDown={(event) => {
            const list = event.currentTarget;
            if (
              event.target !== list ||
              event.altKey ||
              event.ctrlKey ||
              event.metaKey ||
              list.scrollWidth <= list.clientWidth ||
              !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)
            )
              return;
            event.preventDefault();
            list.scrollLeft =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? list.scrollWidth
                  : list.scrollLeft + list.clientWidth * (event.key === 'ArrowLeft' ? -0.7 : 0.7);
          }}
          direction={{ xs: 'row', md: 'column' }}
          gap={1.5}
          data-testid="meeting-preparation-roster"
          sx={{
            p: 0,
            pb: { xs: 1, md: 0 },
            m: 0,
            listStyle: 'none',
            overflowX: { xs: 'auto', md: 'visible' },
            '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: 2 },
          }}
        >
          {preparation.invitationResponses.map((person) => (
            <Stack
              component="li"
              key={person.participantId}
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              alignItems="center"
              gap={1}
              sx={{
                flex: { xs: '0 0 4rem', md: '0 1 auto' },
                minWidth: 0,
                textAlign: { xs: 'center', md: 'left' },
              }}
            >
              <Avatar
                aria-hidden="true"
                sx={{
                  width: { xs: 44, md: 32 },
                  height: { xs: 44, md: 32 },
                  bgcolor: 'primary.main',
                  fontSize: 'caption.fontSize',
                  '@media (forced-colors: active)': {
                    color: 'CanvasText',
                    bgcolor: 'Canvas',
                    border: '1px solid CanvasText',
                  },
                }}
              >
                {person.displayName.slice(0, 2)}
              </Avatar>
              <Typography
                variant="body2"
                sx={{ flex: { md: 1 }, minWidth: 0, overflowWrap: 'anywhere' }}
              >
                {person.displayName}
                {person.mine ? ` · ${t('preparation.me')}` : ''}
              </Typography>
              <Typography
                variant="caption"
                color={person.response === 'ACCEPTED' ? 'success.main' : 'text.secondary'}
                sx={{ flexShrink: 0, maxWidth: '100%', overflowWrap: 'anywhere' }}
              >
                {t('preparation.responses.' + person.response)}
              </Typography>
            </Stack>
          ))}
        </Stack>
        {!preparation.invitationResponses.length && (
          <Typography variant="body2" color="text.secondary">
            {t('preparation.noPeople')}
          </Typography>
        )}
      </PreparationSection>
      <PreparationSection
        id="preparation-devices"
        icon={Camera}
        title={t('preparation.devices')}
        meta={t('preparation.design.deviceUnchecked')}
      >
        <MeetingPreparationDisclosure label={t('preparation.design.moreInformation')}>
          <Stack component="dl" gap={1.5} sx={{ m: 0 }}>
            {[
              [Mic, 'room.microphone'],
              [Camera, 'room.camera'],
              [Volume2, 'preferences.audio.speaker'],
            ].map(([Glyph, label]) => {
              const Icon = Glyph as typeof Mic;
              return (
                <Stack
                  key={String(label)}
                  direction="row"
                  alignItems="center"
                  gap={1}
                  sx={(theme) => ({ ...meetingInset(theme, 'primary'), p: 1.25 })}
                >
                  <Icon size={16} aria-hidden="true" />
                  <Typography component="dt" variant="body2" sx={{ flex: 1 }}>
                    {t(String(label))}
                  </Typography>
                  <Typography component="dd" variant="caption" color="text.secondary" sx={{ m: 0 }}>
                    {t('preparation.design.deviceUnchecked')}
                  </Typography>
                </Stack>
              );
            })}
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            {t('preparation.devicesNotice')}
          </Typography>
        </MeetingPreparationDisclosure>
        <ActionButton
          intent="secondary"
          disabled={busy || !preparationEntryAllowed(meeting)}
          onClick={onEnter}
          startIcon={<Camera size={16} aria-hidden="true" />}
          sx={{ minHeight: 44 }}
        >
          {t('room.deviceCheck')}
        </ActionButton>
      </PreparationSection>
      <PreparationSection
        id="preparation-policy"
        icon={ShieldCheck}
        title={t('preparation.policy')}
        tone="primary"
      >
        <Stack component="dl" gap={1.5} sx={{ m: 0 }}>
          {[
            ['preparation.access', t('access.' + meeting.accessScope)],
            [
              'preparation.waitingRoom',
              t(meeting.waitingRoomEnabled ? 'preparation.required' : 'preparation.notRequired'),
            ],
            [
              'preparation.beforeHost',
              t(meeting.allowJoinBeforeHost ? 'preparation.allowed' : 'preparation.notAllowed'),
            ],
          ].map(([label, value]) => (
            <Box
              key={label}
              sx={{ display: { xs: 'flex', md: 'block' }, justifyContent: 'space-between', gap: 1 }}
            >
              <Typography component="dt" variant="caption" color="text.secondary">
                {t(label)}
              </Typography>
              <Typography component="dd" variant="body2" sx={{ m: 0 }}>
                {value}
              </Typography>
            </Box>
          ))}
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {t('preparation.contentNotice')}
        </Typography>
      </PreparationSection>
    </Stack>
  );
}
