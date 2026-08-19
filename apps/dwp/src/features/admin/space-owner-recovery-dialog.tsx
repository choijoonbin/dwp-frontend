import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Search, UserRoundCheck } from 'lucide-react';
import { useDeferredValue, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionButton, FormDialog, FormField } from '@dwp-frontend/design-system';
import { listPeople } from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { PersonAvatar } from '../../components/person-avatar';

import type { PersonSummary } from '@dwp-frontend/shared-utils';

export function SpaceOwnerRecoveryDialog({
  open,
  spaceName,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  spaceName: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (personPublicId: string, reason: string) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<PersonSummary | null>(null);
  const [reason, setReason] = useState('');
  const deferredQuery = useDeferredValue(query.trim());
  const canSearch = deferredQuery.length >= 2;
  const people = useQuery({
    queryKey: ['spaces', 'owner-recovery', 'people', deferredQuery],
    queryFn: () =>
      listPeople({ query: deferredQuery, status: 'ACTIVE', size: 8, surface: 'directory' }),
    enabled: open && canSearch,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelected(null);
      setReason('');
    }
  }, [open]);

  const valid = Boolean(selected) && reason.trim().length >= 10;

  return (
    <FormDialog
      open={open}
      title={t('spaces.operations.ownerRecovery.title')}
      description={t('spaces.operations.ownerRecovery.description', { space: spaceName })}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t('spaces.operations.ownerRecovery.submit')}
      submittingLabel={t('spaces.operations.ownerRecovery.submitting')}
      submitDisabled={!valid}
      busy={busy}
      onClose={onClose}
      onSubmit={() => {
        if (!selected) return;
        return onSubmit(selected.personId, reason.trim());
      }}
      maxWidth="sm"
    >
      <Stack gap={2.5}>
        <Box>
          <FormField
            autoFocus
            label={t('spaces.operations.ownerRecovery.search')}
            placeholder={t('spaces.operations.ownerRecovery.searchPlaceholder')}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(null);
            }}
            supportingText={t('spaces.operations.ownerRecovery.searchHelp')}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={17} />
                  </InputAdornment>
                ),
              },
              htmlInput: { maxLength: 120 },
            }}
          />
          <Stack gap={0.75} sx={{ mt: 1 }} aria-live="polite">
            {people.isFetching ? (
              <Typography variant="caption" color="text.secondary">
                {t('spaces.operations.ownerRecovery.searching')}
              </Typography>
            ) : null}
            {people.isError ? (
              <Alert severity="error">{t('spaces.operations.ownerRecovery.searchError')}</Alert>
            ) : null}
            {canSearch && !people.isFetching && people.data?.items.length === 0 ? (
              <Typography variant="caption" color="text.secondary" sx={{ py: 1 }}>
                {t('spaces.operations.ownerRecovery.noResults')}
              </Typography>
            ) : null}
            {people.data?.items.map((person) => {
              const active = selected?.personId === person.personId;
              return (
                <ActionButton
                  key={person.personId}
                  intent="quiet"
                  aria-pressed={active}
                  onClick={() => setSelected(person)}
                  sx={{
                    width: '100%',
                    minHeight: 58,
                    px: 1.25,
                    justifyContent: 'flex-start',
                    border: 1,
                    borderColor: active ? 'primary.main' : 'divider',
                    bgcolor: active ? 'action.selected' : 'background.paper',
                  }}
                >
                  <Stack direction="row" alignItems="center" gap={1.25} sx={{ width: '100%' }}>
                    <PersonAvatar name={person.displayName} size={34} />
                    <Box sx={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                      <Typography variant="body2" fontWeight={750} noWrap>
                        {person.displayName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {[person.businessTitle, person.organizationName, person.workEmail]
                          .filter(Boolean)
                          .join(' · ')}
                      </Typography>
                    </Box>
                    {active ? <CheckCircle2 size={18} /> : null}
                  </Stack>
                </ActionButton>
              );
            })}
          </Stack>
        </Box>

        {selected ? (
          <Stack
            direction="row"
            alignItems="center"
            gap={1}
            sx={{ px: 1.5, py: 1.25, bgcolor: 'action.selected', borderRadius: 1 }}
          >
            <UserRoundCheck size={18} />
            <Typography variant="body2" fontWeight={750} sx={{ flex: 1 }}>
              {t('spaces.operations.ownerRecovery.selected', { name: selected.displayName })}
            </Typography>
            <Chip size="small" color="success" label={t('common.status.ACTIVE')} />
          </Stack>
        ) : null}

        <FormField
          required
          multiline
          minRows={3}
          label={t('spaces.operations.ownerRecovery.reason')}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          supportingText={t('spaces.operations.ownerRecovery.reasonHelp')}
          slotProps={{ htmlInput: { maxLength: 1000 } }}
        />
      </Stack>
    </FormDialog>
  );
}
