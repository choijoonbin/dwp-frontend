import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserRoundPlus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { listPeople } from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  AutocompleteField,
  ContentDialog,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import type {
  CalendarDelegation,
  CalendarDelegationScope,
  CreateCalendarDelegationInput,
  PersonSummary,
} from '@dwp-frontend/shared-utils';

const ALL_SCOPES: readonly CalendarDelegationScope[] = [
  'RESPOND',
  'EDIT_SCHEDULE',
  'CREATE',
];

function localDateTimeValue(value: Date): string {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function initialValidity() {
  const from = new Date();
  from.setSeconds(0, 0);
  const until = new Date(from);
  until.setDate(until.getDate() + 30);
  return { from: localDateTimeValue(from), until: localDateTimeValue(until) };
}

export function CalendarDelegationDialog({
  open,
  existing,
  busy,
  onClose,
  onSubmit,
}: Readonly<{
  open: boolean;
  existing: readonly CalendarDelegation[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: CreateCalendarDelegationInput) => void;
}>) {
  const { t } = useTranslation('calendar');
  const compact = useMediaQuery('(max-width:599.95px)', { noSsr: true });
  const [person, setPerson] = useState<PersonSummary | null>(null);
  const [personQuery, setPersonQuery] = useState('');
  const [scopes, setScopes] = useState<CalendarDelegationScope[]>(['RESPOND']);
  const [{ from, until }, setValidity] = useState(initialValidity);

  useEffect(() => {
    if (open) return;
    setPerson(null);
    setPersonQuery('');
    setScopes(['RESPOND']);
    setValidity(initialValidity());
  }, [open]);

  const peopleQuery = useQuery({
    queryKey: ['calendar', 'delegation-people', personQuery],
    queryFn: ({ signal }) =>
      listPeople({ query: personQuery, size: 100, surface: 'directory', signal }),
    enabled: open,
    staleTime: 60_000,
    retry: 1,
  });
  const blockedIds = useMemo(
    () =>
      new Set(
        existing
          .filter((delegation) =>
            ['ACTIVE', 'SCHEDULED'].includes(delegation.status)
          )
          .map((delegation) => delegation.delegatePersonPublicId)
      ),
    [existing]
  );
  const people = useMemo(
    () => (peopleQuery.data?.items ?? []).filter((candidate) => !blockedIds.has(candidate.personId)),
    [blockedIds, peopleQuery.data?.items]
  );
  const validRange = Boolean(from && until && Date.parse(until) > Date.parse(from));
  const canSubmit = Boolean(person && scopes.length && validRange && !busy);

  const toggleScope = (scope: CalendarDelegationScope, selected: boolean) => {
    setScopes((current) =>
      selected ? [...new Set([...current, scope])] : current.filter((value) => value !== scope)
    );
  };
  const submit = () => {
    if (!person || !canSubmit) return;
    onSubmit({
      delegatePersonPublicId: person.personId,
      scopes,
      validFrom: new Date(from).toISOString(),
      validUntil: new Date(until).toISOString(),
    });
  };

  return (
    <ContentDialog
      open={open}
      fullScreen={compact}
      maxWidth="sm"
      title={t('settings.delegation.dialogTitle')}
      description={t('settings.delegation.dialogDescription')}
      closeLabel={t('actions.close')}
      onClose={onClose}
      busy={busy}
      contentDividers
      footerContent={
        <>
          <ActionButton intent="secondary" onClick={onClose} disabled={busy}>
            {t('actions.cancel')}
          </ActionButton>
          <ActionButton
            intent="primary"
            startIcon={<UserRoundPlus size={16} />}
            disabled={!canSubmit}
            loading={busy}
            onClick={submit}
          >
            {t('settings.delegation.create')}
          </ActionButton>
        </>
      }
    >
      <Stack spacing={2.5} sx={{ p: { xs: 2, sm: 3 } }}>
        <Alert severity="warning">{t('settings.delegation.auditWarning')}</Alert>
        {peopleQuery.isError ? (
          <Alert
            severity="error"
            action={
              <ActionButton intent="quiet" size="small" onClick={() => peopleQuery.refetch()}>
                {t('actions.retry')}
              </ActionButton>
            }
          >
            {t('settings.delegation.peopleLoadError')}
          </Alert>
        ) : null}
        <AutocompleteField<PersonSummary>
          label={t('settings.delegation.person')}
          options={people}
          value={person}
          loading={peopleQuery.isLoading}
          disabled={busy || peopleQuery.isError}
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
              : t('settings.delegation.personHint')
          }
        />
        <Stack spacing={0.75} component="fieldset" sx={{ m: 0, p: 0, border: 0 }}>
          <Typography component="legend" variant="subtitle2">
            {t('settings.delegation.scopes')}
          </Typography>
          <FormGroup>
            {ALL_SCOPES.map((scope) => (
              <FormControlLabel
                key={scope}
                control={
                  <Checkbox
                    checked={scopes.includes(scope)}
                    disabled={busy}
                    onChange={(_, selected) => toggleScope(scope, selected)}
                  />
                }
                label={
                  <Stack spacing={0.1}>
                    <Typography variant="body2" fontWeight={650}>
                      {t(`settings.delegation.scope.${scope}.label`)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t(`settings.delegation.scope.${scope}.description`)}
                    </Typography>
                  </Stack>
                }
              />
            ))}
          </FormGroup>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            fullWidth
            type="datetime-local"
            label={t('settings.delegation.validFrom')}
            value={from}
            disabled={busy}
            slotProps={{ inputLabel: { shrink: true } }}
            onChange={(event) =>
              setValidity((current) => ({ ...current, from: event.target.value }))
            }
          />
          <TextField
            fullWidth
            type="datetime-local"
            label={t('settings.delegation.validUntil')}
            value={until}
            disabled={busy}
            error={Boolean(from && until && !validRange)}
            helperText={!validRange ? t('settings.delegation.invalidValidity') : ' '}
            slotProps={{ inputLabel: { shrink: true } }}
            onChange={(event) =>
              setValidity((current) => ({ ...current, until: event.target.value }))
            }
          />
        </Stack>
      </Stack>
    </ContentDialog>
  );
}
