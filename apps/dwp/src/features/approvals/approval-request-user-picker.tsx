import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { RefreshCw } from 'lucide-react';
import { ActionIconButton, AutocompleteField } from '@dwp-frontend/design-system';
import { searchApprovalFormUserCandidates } from '@dwp-frontend/shared-utils/api/approval-form-user-api';

import { useApprovalManagementCommandScope } from './approval-management-command-scope';
import { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';

import type {
  ApprovalFormUserBinding,
  ApprovalFormUserCandidate,
} from '@dwp-frontend/shared-utils/api/approval-form-user-api';

export type ApprovalRequestUserSourceState = Readonly<{
  ready: boolean;
  validUntil?: string;
  isCurrent?: () => boolean;
}>;
export type ApprovalRequestUserContext = Omit<ApprovalFormUserBinding, 'fieldKey' | 'groupKey'> &
  Readonly<{ requestVersion?: number }>;
export type ApprovalRequestUserBinding = ApprovalFormUserBinding &
  Readonly<{ requestVersion?: number }>;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function ApprovalRequestUserPicker({
  binding,
  value,
  label,
  required = false,
  disabled = false,
  verifyOnlyValue = false,
  supportingText,
  sourceUnavailableText,
  onChange,
  onSourceReadyChange,
}: {
  binding?: ApprovalRequestUserBinding;
  value: string;
  label: string;
  required?: boolean;
  disabled?: boolean;
  verifyOnlyValue?: boolean;
  supportingText?: string;
  sourceUnavailableText?: string;
  onChange: (value: string) => void;
  onSourceReadyChange?: (state: ApprovalRequestUserSourceState) => void;
}) {
  const { t } = useTranslation('approvals');
  const scope = useProductSurfaceRequestScope({
    productKey: 'approvals',
    surfaceKey: binding?.surface === 'ADMIN' ? 'approvals.admin' : 'approvals.work',
  });
  const commandScope = useApprovalManagementCommandScope(scope.cacheKey);
  const queryClient = useQueryClient();
  const { requestId, requestVersion, ...schemaBinding } = binding ?? {};
  const owner = JSON.stringify([requestId, requestVersion]);
  const identity = JSON.stringify([commandScope.binding, schemaBinding]);
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const [input, setInput] = useState({ identity, text: '', search: '' });
  const [query, setQuery] = useState({ identity, text: '' });
  const [selection, setSelection] = useState<
    | Readonly<{
        identity: string;
        owner: string;
        person: ApprovalFormUserCandidate;
        validUntil: string;
      }>
    | undefined
  >();
  const [, tick] = useState(0);
  const callback = useRef(onSourceReadyChange);
  callback.current = onSourceReadyChange;
  const bound =
    Boolean(
      binding &&
      uuid.test(binding.formId) &&
      uuid.test(binding.formVersionId) &&
      /^[0-9a-f]{64}$/.test(binding.schemaSha256) &&
      (!requestId ||
        (uuid.test(requestId) && Number.isSafeInteger(requestVersion) && requestVersion! >= 0))
    ) &&
    scope.governed &&
    scope.ready &&
    Boolean(scope.contextScopeKey && scope.queryMeta.decisionRevision);
  const canVerifyOriginal = verifyOnlyValue && uuid.test(value);
  const searchText = query.identity === identity ? query.text.trim() : '';
  const searchEnabled = searchText.length >= 2 && searchText.length <= 100;
  const queryKey = [
    'approvals',
    ...scope.cacheKey,
    'form-user-candidates',
    identity,
    owner,
    searchText,
  ];
  const candidates = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      searchApprovalFormUserCandidates(binding!, searchText, 10, scope.contextScopeKey, signal),
    enabled:
      bound &&
      (!disabled || canVerifyOriginal || Boolean(selection && selection.owner !== owner)) &&
      searchEnabled,
    meta: scope.queryMeta,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const data = candidates.data;
  const fresh =
    bound &&
    !candidates.isError &&
    !candidates.isFetching &&
    Boolean(
      data &&
      data.decisionRevision === scope.queryMeta.decisionRevision &&
      data.requestId === (requestId ?? null) &&
      data.requestVersion === (requestId ? requestVersion : null) &&
      Date.parse(data.validUntil) > Date.now()
    );
  const failed = candidates.isError || Boolean(data && !candidates.isFetching && !fresh);
  const selected =
    selection?.identity === identity &&
    selection.owner === owner &&
    selection.person.personPublicId === value &&
    Date.parse(selection.validUntil) > Date.now() &&
    !failed
      ? selection
      : undefined;
  const queryCurrent = input.identity === identity && input.search.trim() === searchText;
  const ready =
    bound && queryCurrent && !failed && !candidates.isFetching && (!value || Boolean(selected));
  const expiry = selected?.validUntil;
  const mounted = useRef(true);
  const authority = useRef({ ready, binding, queryKey, value, selected, scope, commandScope });
  authority.current = { ready, binding, queryKey, value, selected, scope, commandScope };
  const isCurrent = useCallback(() => {
    const live = authority.current;
    if (
      !mounted.current ||
      !live.ready ||
      !live.scope.ready ||
      !live.scope.governed ||
      !live.binding ||
      !live.commandScope.isCurrent(live.commandScope.binding)
    )
      return false;
    const source = queryClient.getQueryState<typeof data>(live.queryKey);
    if (!live.value) return !source?.error && source?.fetchStatus !== 'fetching';
    const current = source?.data;
    const path = live.binding.groupKey
      ? `${live.binding.groupKey}.${live.binding.fieldKey}`
      : live.binding.fieldKey;
    return Boolean(
      source?.status === 'success' &&
      source.fetchStatus === 'idle' &&
      source.fetchFailureCount === 0 &&
      !source.error &&
      current &&
      current.formVersionId === live.binding.formVersionId &&
      current.schemaSha256 === live.binding.schemaSha256 &&
      current.fieldPath === path &&
      current.requestId === (live.binding.requestId ?? null) &&
      current.requestVersion === (live.binding.requestId ? live.binding.requestVersion : null) &&
      current.decisionRevision === live.scope.queryMeta.decisionRevision &&
      Date.parse(current.validUntil) > Date.now() &&
      live.selected &&
      Date.parse(live.selected.validUntil) > Date.now() &&
      current.people.some((person) => person.personPublicId === live.value)
    );
  }, [queryClient]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    setSelection(undefined);
    setInput({ identity, text: '', search: '' });
    setQuery({ identity, text: '' });
  }, [identity]);
  useEffect(() => {
    const captured = identity;
    const timer = window.setTimeout(() => {
      if (currentIdentity.current === captured)
        setQuery({ identity: captured, text: input.search });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [identity, input.search]);
  useEffect(() => {
    if (failed) setSelection(undefined);
  }, [failed]);
  useEffect(() => {
    if (
      !fresh ||
      !data ||
      !selection ||
      selection.identity !== identity ||
      selection.owner === owner ||
      selection.person.personPublicId !== value
    )
      return;
    const current = data.people.find((person) => person.personPublicId === value);
    // Renew evidence for the same stored reference only; never replace an editing value.
    if (current) setSelection({ identity, owner, person: current, validUntil: data.validUntil });
  }, [fresh, data, selection, identity, owner, value]);
  useEffect(() => {
    const validUntil = expiry ?? data?.validUntil;
    if (!validUntil) return;
    const timer = window.setTimeout(
      () => tick((value) => value + 1),
      Math.max(0, Date.parse(validUntil) - Date.now())
    );
    return () => window.clearTimeout(timer);
  }, [expiry, data?.validUntil]);
  useEffect(() => {
    callback.current?.({ ready, validUntil: expiry, isCurrent });
  }, [identity, value, ready, expiry, isCurrent]);

  const displayed =
    selected?.person ??
    (value ? { personPublicId: value, displayName: t('requests.typed.userStored') } : null);
  return (
    <Stack direction="row" alignItems="flex-start" gap={1}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <AutocompleteField<ApprovalFormUserCandidate>
          label={label}
          required={required}
          disabled={(disabled && !canVerifyOriginal) || !bound}
          value={displayed}
          inputValue={input.identity === identity ? input.text : ''}
          options={
            fresh && queryCurrent
              ? (data?.people ?? []).filter(
                  (person) => !verifyOnlyValue || person.personPublicId === value
                )
              : []
          }
          freeSolo={false}
          slotProps={{
            popper: { role: 'region', 'aria-label': label },
            clearIndicator: { sx: { display: verifyOnlyValue ? 'none' : undefined } },
          }}
          openOnFocus
          getOptionLabel={(person) => person.displayName}
          isOptionEqualToValue={(option, selected) =>
            option.personPublicId === selected.personPublicId
          }
          filterOptions={(options) => options}
          loading={candidates.isFetching}
          loadingText={t('requests.typed.schemaLoading')}
          noOptionsText={t(
            searchEnabled ? 'requests.typed.userNoResults' : 'requests.typed.userSearch'
          )}
          onInputChange={(_, text, reason) => {
            if (reason === 'input' && bound && (!disabled || canVerifyOriginal))
              setInput({ identity, text, search: text });
          }}
          onChange={(_, person) => {
            if ((disabled && !canVerifyOriginal) || !bound || currentIdentity.current !== identity)
              return;
            if (
              verifyOnlyValue &&
              (!canVerifyOriginal || !person || person.personPublicId !== value)
            )
              return;
            if (!person) {
              setSelection(undefined);
              setInput({ identity, text: '', search: '' });
              onChange('');
              return;
            }
            if (
              !fresh ||
              !queryCurrent ||
              !data ||
              Date.parse(data.validUntil) <= Date.now() ||
              !data?.people.some((candidate) => candidate.personPublicId === person.personPublicId)
            )
              return;
            setSelection({ identity, owner, person, validUntil: data.validUntil });
            setInput({ identity, text: person.displayName, search: searchText });
            if (!verifyOnlyValue) onChange(person.personPublicId);
          }}
          errorMessage={
            failed ? (sourceUnavailableText ?? t('requests.typed.userUnavailable')) : undefined
          }
          supportingText={
            !bound
              ? (sourceUnavailableText ?? t('requests.typed.userSourceUnavailable'))
              : data?.mayBeTruncated && fresh
                ? t('requests.typed.userTruncated')
                : verifyOnlyValue && !ready
                  ? t('requests.typed.userVerifyOriginal')
                  : (supportingText ??
                    t(
                      value && !selected ? 'requests.typed.userStored' : 'requests.typed.userSearch'
                    ))
          }
        />
      </Box>
      {(verifyOnlyValue || failed) && (
        <ActionIconButton
          type="button"
          label={t('requests.typed.userRefresh')}
          disabled={
            !bound || !searchEnabled || candidates.isFetching || (disabled && !canVerifyOriginal)
          }
          sx={{ mt: 1, minWidth: 44, minHeight: 44 }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (
              bound &&
              searchEnabled &&
              !candidates.isFetching &&
              (!disabled || canVerifyOriginal) &&
              currentIdentity.current === identity &&
              commandScope.isCurrent(commandScope.binding)
            )
              void candidates.refetch();
          }}
        >
          <RefreshCw size={18} aria-hidden="true" />
        </ActionIconButton>
      )}
    </Stack>
  );
}
