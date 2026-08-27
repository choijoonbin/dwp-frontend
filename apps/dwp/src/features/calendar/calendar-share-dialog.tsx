import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, Trash2, UserRoundPlus } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteCalendarShare,
  getCalendarShares,
  listPeople,
  putCalendarShare,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  AutocompleteField,
  ConfirmDialog,
  ContentDialog,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { alpha } from '@mui/material/styles';

import type {
  CalendarShare,
  CalendarShareInput,
  CalendarSummary,
  PersonSummary,
} from '@dwp-frontend/shared-utils';

type ShareAccessLevel = CalendarShareInput['accessLevel'];

const SHARE_ACCESS_LEVELS: readonly ShareAccessLevel[] = [
  'VIEW_FREE_BUSY',
  'VIEW_DETAILS',
  'EDIT',
  'MANAGE',
];

function personInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part.slice(0, 1))
    .join('')
    .toUpperCase();
}

function ShareAccessLadder({
  value,
  disabled,
  onChange,
}: {
  value: ShareAccessLevel;
  disabled: boolean;
  onChange: (value: ShareAccessLevel) => void;
}) {
  const { t } = useTranslation('calendar');
  return (
    <RadioGroup
      value={value}
      onChange={(_, nextValue) => onChange(nextValue as ShareAccessLevel)}
      aria-label={t('sharing.accessLabel')}
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
        gap: 1,
      }}
    >
      {SHARE_ACCESS_LEVELS.map((level) => {
        const selected = value === level;
        return (
          <FormControlLabel
            key={level}
            value={level}
            disabled={disabled}
            labelPlacement="start"
            control={<Radio size="small" />}
            label={
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600}>
                  {t(`sharing.access.${level}.label`)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.45 }}>
                  {t(`sharing.access.${level}.description`)}
                </Typography>
              </Box>
            }
            sx={(theme) => ({
              m: 0,
              minHeight: 72,
              p: 1.25,
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 1,
              textAlign: 'left',
              border: 1,
              borderColor: selected ? 'primary.main' : 'divider',
              borderRadius: 1,
              bgcolor: selected
                ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.18 : 0.07)
                : 'transparent',
              cursor: disabled ? 'default' : 'pointer',
              '&:hover': { bgcolor: disabled ? undefined : 'action.hover' },
              '&:focus-visible': {
                outline: `2px solid ${theme.palette.primary.main}`,
                outlineOffset: 2,
              },
              '&:has(.Mui-focusVisible)': {
                outline: `2px solid ${theme.palette.primary.main}`,
                outlineOffset: 2,
              },
              '& .MuiFormControlLabel-label': { flex: 1, minWidth: 0 },
              '& .MuiRadio-root': { p: 0.25 },
            })}
          />
        );
      })}
    </RadioGroup>
  );
}

export function CalendarShareDialog({
  calendar,
  open,
  onClose,
}: Readonly<{
  calendar: CalendarSummary | null;
  open: boolean;
  onClose: () => void;
}>) {
  const { t } = useTranslation('calendar');
  const compact = useMediaQuery('(max-width:599.95px)', { noSsr: true });
  const toast = useToast();
  const queryClient = useQueryClient();
  const [person, setPerson] = useState<PersonSummary | null>(null);
  const [personQuery, setPersonQuery] = useState('');
  const [accessLevel, setAccessLevel] = useState<ShareAccessLevel>('VIEW_FREE_BUSY');
  const [removeTarget, setRemoveTarget] = useState<CalendarShare | null>(null);
  const [elevatedTarget, setElevatedTarget] = useState<{
    input: CalendarShareInput;
    name: string;
  } | null>(null);
  const calendarId = calendar?.calendarId ?? '';

  useEffect(() => {
    if (open) return;
    setPerson(null);
    setPersonQuery('');
    setAccessLevel('VIEW_FREE_BUSY');
    setRemoveTarget(null);
    setElevatedTarget(null);
  }, [open]);

  const sharesQuery = useQuery({
    queryKey: ['calendar', 'shares', calendarId],
    queryFn: () => getCalendarShares(calendarId),
    enabled: open && Boolean(calendarId),
    staleTime: 20_000,
    retry: 1,
  });
  const peopleQuery = useQuery({
    queryKey: ['calendar', 'share-people', personQuery],
    queryFn: ({ signal }) =>
      listPeople({ query: personQuery, size: 100, surface: 'directory', signal }),
    enabled: open,
    staleTime: 60_000,
    retry: 1,
  });

  const activeShares = useMemo(
    () =>
      (sharesQuery.data ?? []).filter(
        (share) => share.principalType === 'PERSON' && share.lifecycleState !== 'REVOKED'
      ),
    [sharesQuery.data]
  );
  const people = useMemo(() => {
    const sharedPersonIds = new Set(
      activeShares.map((share) => share.principalPersonPublicId).filter(Boolean)
    );
    return (peopleQuery.data?.items ?? []).filter(
      (candidate) =>
        candidate.personId !== calendar?.ownerPersonPublicId &&
        !sharedPersonIds.has(candidate.personId)
    );
  }, [activeShares, calendar?.ownerPersonPublicId, peopleQuery.data?.items]);

  const saveMutation = useMutation({
    mutationFn: (input: CalendarShareInput) => putCalendarShare(calendarId, input),
    onSuccess: async () => {
      setElevatedTarget(null);
      setPerson(null);
      setPersonQuery('');
      setAccessLevel('VIEW_FREE_BUSY');
      await queryClient.invalidateQueries({ queryKey: ['calendar', 'shares', calendarId] });
      toast.success(t('sharing.saved'));
    },
    onError: () => toast.error(t('sharing.saveError')),
  });
  const removeMutation = useMutation({
    mutationFn: (share: CalendarShare) =>
      deleteCalendarShare(calendarId, share.grantId, share.version),
    onSuccess: async () => {
      setRemoveTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['calendar', 'shares', calendarId] });
      toast.success(t('sharing.removed'));
    },
    onError: () => toast.error(t('sharing.removeError')),
  });
  const busy = saveMutation.isPending || removeMutation.isPending;
  const accessOptions = SHARE_ACCESS_LEVELS.map((value) => ({
    value,
    label: t(`sharing.access.${value}.label`),
  }));

  const persistShare = (input: CalendarShareInput, name: string) => {
    if (input.accessLevel === 'EDIT' || input.accessLevel === 'MANAGE') {
      setElevatedTarget({ input, name });
      return;
    }
    saveMutation.mutate(input);
  };

  const savePerson = () => {
    if (!person || !calendarId || sharesQuery.isError) return;
    persistShare(
      {
        principalPersonPublicId: person.personId,
        principalDisplayName: person.displayName,
        accessLevel,
        canViewPrivate: false,
        validUntil: null,
        version: 0,
      },
      person.displayName
    );
  };

  const changeShareAccess = (share: CalendarShare, nextAccessLevel: ShareAccessLevel) => {
    if (!share.principalPersonPublicId) return;
    persistShare(
      {
        principalPersonPublicId: share.principalPersonPublicId,
        principalDisplayName: share.principalDisplayName,
        accessLevel: nextAccessLevel,
        canViewPrivate: share.canViewPrivate,
        validUntil: share.lifecycleState === 'EXPIRED' ? null : (share.validUntil ?? null),
        version: share.version,
      },
      share.principalDisplayName
    );
  };

  return (
    <>
      <ContentDialog
        open={open}
        fullScreen={compact}
        maxWidth="md"
        title={t('sharing.title', { name: calendar?.name ?? '' })}
        description={t('sharing.description')}
        closeLabel={t('actions.close')}
        onClose={onClose}
        busy={busy}
        contentDividers
        contentSx={{ p: { xs: 2, sm: 3 } }}
        footerContent={
          <ActionButton intent="primary" onClick={onClose} disabled={busy}>
            {t('actions.done')}
          </ActionButton>
        }
      >
        <Stack spacing={3}>
          <Alert severity="info" icon={<ShieldCheck size={19} />}>
            {t('sharing.privacyBoundary')}
          </Alert>

          <Box component="section" aria-labelledby="calendar-add-share-title">
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <UserRoundPlus size={18} />
              <Typography
                id="calendar-add-share-title"
                variant="subtitle1"
                sx={{ fontWeight: 700 }}
              >
                {t('sharing.addPerson')}
              </Typography>
            </Stack>
            {peopleQuery.isError && (
              <Alert
                severity="error"
                sx={{ mb: 1.5 }}
                action={
                  <ActionButton intent="quiet" size="small" onClick={() => peopleQuery.refetch()}>
                    {t('actions.retry')}
                  </ActionButton>
                }
              >
                {t('sharing.peopleLoadError')}
              </Alert>
            )}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' },
                gap: 1.25,
                alignItems: 'start',
              }}
            >
              <AutocompleteField<PersonSummary>
                label={t('sharing.personLabel')}
                options={people}
                value={person}
                loading={peopleQuery.isLoading}
                disabled={sharesQuery.isError || busy}
                filterOptions={(options) => options}
                getOptionLabel={(candidate) => candidate.displayName}
                isOptionEqualToValue={(option, value) => option.personId === value.personId}
                onInputChange={(_, value, reason) => {
                  if (reason === 'input') setPersonQuery(value);
                }}
                onChange={(_, value) => setPerson(value)}
                supportingText={
                  person
                    ? [person.organizationName, person.workEmail].filter(Boolean).join(' · ')
                    : t('sharing.personHint')
                }
              />
              <ActionButton
                intent="primary"
                onClick={savePerson}
                disabled={!person || sharesQuery.isLoading || sharesQuery.isError}
                loading={saveMutation.isPending}
                sx={{ minHeight: 40 }}
              >
                {t('sharing.share')}
              </ActionButton>
              <Box sx={{ gridColumn: '1 / -1' }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  {t('sharing.accessLabel')}
                </Typography>
                <Box sx={{ mt: 0.75 }}>
                  <ShareAccessLadder
                    value={accessLevel}
                    disabled={busy}
                    onChange={setAccessLevel}
                  />
                </Box>
              </Box>
            </Box>
          </Box>

          <Divider />

          <Box component="section" aria-labelledby="calendar-current-shares-title">
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 1.25 }}
            >
              <Typography
                id="calendar-current-shares-title"
                variant="subtitle1"
                sx={{ fontWeight: 700 }}
              >
                {t('sharing.currentPeople')}
              </Typography>
              <Chip size="small" label={activeShares.length} />
            </Stack>
            {sharesQuery.isError ? (
              <Alert
                severity="error"
                action={
                  <ActionButton intent="quiet" size="small" onClick={() => sharesQuery.refetch()}>
                    {t('actions.retry')}
                  </ActionButton>
                }
              >
                {t('sharing.loadError')}
              </Alert>
            ) : sharesQuery.isLoading ? (
              <Stack spacing={1}>
                {Array.from({ length: 3 }, (_, index) => (
                  <Skeleton key={index} height={64} />
                ))}
              </Stack>
            ) : activeShares.length ? (
              <Stack divider={<Divider flexItem />}>
                {activeShares.map((share) => (
                  <Stack
                    key={share.grantId}
                    direction={{ xs: 'column', sm: 'row' }}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    spacing={1.5}
                    sx={{ py: 1.5 }}
                  >
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={1.25}
                      sx={{ minWidth: 0, flex: 1 }}
                    >
                      <Avatar
                        sx={{
                          width: 36,
                          height: 36,
                          bgcolor: 'action.selected',
                          color: 'text.primary',
                          fontSize: '0.8rem',
                        }}
                      >
                        {personInitials(share.principalDisplayName)}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 650 }}
                          noWrap
                          title={share.principalDisplayName}
                        >
                          {share.principalDisplayName}
                        </Typography>
                        {share.lifecycleState === 'EXPIRED' && (
                          <Chip
                            size="small"
                            color="warning"
                            variant="outlined"
                            label={t('sharing.expired')}
                            sx={{ mt: 0.5 }}
                          />
                        )}
                        <Typography variant="caption" color="text.secondary">
                          {t(`sharing.access.${share.accessLevel}.description`)}
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={0.5}
                      sx={{ width: { xs: 1, sm: 'auto' } }}
                    >
                      <SelectField<ShareAccessLevel>
                        aria-label={t('sharing.changeAccessFor', {
                          name: share.principalDisplayName,
                        })}
                        value={share.accessLevel as ShareAccessLevel}
                        options={accessOptions}
                        disabled={busy || !share.principalPersonPublicId}
                        onValueChange={(value) => value && changeShareAccess(share, value)}
                        fullWidth
                        size="small"
                        sx={{ minWidth: { xs: 0, sm: 180 }, flex: 1 }}
                      />
                      <ActionIconButton
                        label={t('sharing.removeFor', { name: share.principalDisplayName })}
                        intent="danger"
                        disabled={busy}
                        onClick={() => setRemoveTarget(share)}
                      >
                        <Trash2 size={17} />
                      </ActionIconButton>
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            ) : (
              <Box
                sx={{
                  p: 2.5,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  bgcolor: 'action.hover',
                }}
              >
                <Typography variant="subtitle2">{t('sharing.emptyTitle')}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t('sharing.emptyDescription')}
                </Typography>
              </Box>
            )}
          </Box>
        </Stack>
      </ContentDialog>

      <ConfirmDialog
        open={Boolean(elevatedTarget)}
        title={t('sharing.elevatedAccessTitle')}
        description={t('sharing.elevatedAccessDescription', {
          name: elevatedTarget?.name,
          access: elevatedTarget
            ? t(`sharing.access.${elevatedTarget.input.accessLevel}.label`)
            : '',
        })}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('sharing.confirmElevatedAccess')}
        confirmingLabel={t('actions.saving')}
        busy={saveMutation.isPending}
        onClose={() => setElevatedTarget(null)}
        onConfirm={() => {
          if (elevatedTarget) saveMutation.mutate(elevatedTarget.input);
        }}
      />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title={t('sharing.removeTitle')}
        description={t('sharing.removeDescription', { name: removeTarget?.principalDisplayName })}
        cancelLabel={t('actions.close')}
        confirmLabel={t('sharing.remove')}
        confirmingLabel={t('sharing.removing')}
        intent="danger"
        busy={removeMutation.isPending}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (removeTarget) removeMutation.mutate(removeTarget);
        }}
      />
    </>
  );
}
