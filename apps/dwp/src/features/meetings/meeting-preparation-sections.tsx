import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CalendarClock,
  Camera,
  ClipboardList,
  FileText,
  MessageSquare,
  Pencil,
  ShieldCheck,
  Target,
  UsersRound,
} from 'lucide-react';
import {
  ActionButton,
  SectionHeader,
  InlineFeedback,
  foundationTokens,
} from '@dwp-frontend/design-system';
import type { VideoMeetingSummary } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import type {
  RegisterVideoMeetingMaterialInput,
  VideoMeetingMaterialAccessTicket,
  VideoMeetingPreparation,
} from '@dwp-frontend/shared-utils/api/video-meeting-preparation-api';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { preparationEntryAllowed, preparationInvitationChanged } from './meeting-preparation-model';
import { MeetingStatusChip } from './meeting-components';
import { MeetingPreparationMaterials } from './meeting-preparation-materials';
import { meetingSurface, type MeetingSurfaceTone } from './meeting-visual-system';

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
      gap={2}
      sx={(theme) => ({
        ...meetingSurface(theme, { tone, elevated: tone !== 'neutral' }),
        p: { xs: 2, md: 3 },
        minWidth: 0,
        boxShadow: theme.shadows[tone === 'neutral' ? 1 : 2],
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
        <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 560 }}>
          {t('preparation.entryNotice')}
        </Typography>
        <ActionButton
          intent="primary"
          disabled={busy || !preparationEntryAllowed(meeting)}
          onClick={onEnter}
          startIcon={<Camera size={18} aria-hidden="true" />}
          sx={{ minHeight: 44, flexShrink: 0 }}
        >
          {t('preparation.enter')}
        </ActionButton>
      </Box>
      {!preparationEntryAllowed(meeting) && (
        <Typography variant="caption" color="text.secondary">
          {t('preparation.entryUnavailable')}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary">
        {t('preparation.scheduleManagementHint')}
      </Typography>
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
      <PreparationSection
        id="preparation-purpose"
        icon={Target}
        title={t('preparation.purpose')}
        tone="primary"
      >
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {meeting.description || t('preparation.noPurpose')}
        </Typography>
        <InlineFeedback severity="info">
          <Typography variant="body2">{t('preparation.briefingUnavailable')}</Typography>
        </InlineFeedback>
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
            open={personalPreparationConflict || !preparationComplete || undefined}
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
                    bgcolor: 'action.hover',
                    borderRadius: foundationTokens.radius.surface + 'px',
                    minWidth: 0,
                  }}
                >
                  <Typography variant="caption" color="primary.main" sx={{ pt: 0.5 }}>
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
          <Typography variant="body2" color="text.secondary">
            {t('preparation.chatUnavailable')}
          </Typography>
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
}: {
  preparation: VideoMeetingPreparation;
  meeting: VideoMeetingSummary;
  busy: boolean;
  invitationConflict: boolean;
  onReviewInvitation: () => void;
  onRespond: (value: 'ACCEPTED' | 'TENTATIVE' | 'DECLINED') => void;
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
              borderRadius: foundationTokens.radius.surface + 'px',
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {t('preparation.myResponse')}
            </Typography>
            <Chip
              size="small"
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
              <Stack gap={0.75} sx={{ mt: 1.5 }}>
                {(['ACCEPTED', 'TENTATIVE', 'DECLINED'] as const).map((value) => (
                  <ActionButton
                    key={value}
                    intent={value === 'ACCEPTED' ? 'secondary' : 'quiet'}
                    disabled={busy || invitationConflict}
                    onClick={() => onRespond(value)}
                    sx={{ minHeight: 44 }}
                  >
                    {t('preparation.responseActions.' + value)}
                  </ActionButton>
                ))}
              </Stack>
            )}
          </Box>
        )}
        <Stack component="ul" gap={1.5} sx={{ p: 0, m: 0, listStyle: 'none' }}>
          {preparation.invitationResponses.map((person) => (
            <Stack
              component="li"
              key={person.participantId}
              direction="row"
              justifyContent="space-between"
              alignItems="start"
              gap={1}
            >
              <Typography variant="body2" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                {person.displayName}
                {person.mine ? ` · ${t('preparation.me')}` : ''}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
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
      <PreparationSection id="preparation-devices" icon={Camera} title={t('preparation.devices')}>
        <Typography variant="body2" color="text.secondary">
          {t('preparation.devicesNotice')}
        </Typography>
      </PreparationSection>
      <PreparationSection
        id="preparation-policy"
        icon={ShieldCheck}
        title={t('preparation.policy')}
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
            <Box key={label}>
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
