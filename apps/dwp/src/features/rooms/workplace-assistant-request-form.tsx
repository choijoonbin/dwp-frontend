import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { ActionButton, FormField, InlineFeedback, SelectField } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workplaceMemberCard, workplaceMemberSoftSurface } from './workplace-member-surfaces';
import { useWorkplaceAssistantCopy } from './workplace-assistant-copy';
import {
  workplaceAssistantBrowserTimeZone,
  workplaceAssistantInitialLocalRange,
  workplaceAssistantLocalDateTimeToInstant,
} from './workplace-assistant-time';
import { WorkplaceAssistantVoiceInput } from './workplace-assistant-voice-input';

import type {
  WorkplaceAssistantCreateInput,
  WorkplaceAssistantRequestedBookingItem,
} from '@dwp-frontend/shared-utils/api/workplace-assistant-contract';
import type {
  WorkplaceFloor,
  WorkplaceResourceType,
  WorkplaceSite,
} from '@dwp-frontend/shared-utils/api/workplace-api';
import type { WorkplaceAuthorizedBookingBeneficiary } from '@dwp-frontend/shared-utils/api/workplace-booking-orchestration-api';

const RESOURCE_TYPES: readonly WorkplaceResourceType[] = [
  'DESK',
  'ROOM',
  'PARKING',
  'LOCKER',
  'FOCUS_POD',
  'PHONE_BOOTH',
  'EQUIPMENT',
];
const RAW_PERSONAL_DATA =
  /(?:\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\+?\d[\d .()-]{7,}\d|\b\d{6}-?[1-4]\d{6}\b)/iu;
const BENEFICIARY_TARGETS = ['SELF', 'DELEGATE', 'TEAM'] as const;
type BeneficiaryTarget = (typeof BENEFICIARY_TARGETS)[number];

type DraftItem = {
  draftId: number;
  beneficiaryRef: string;
  resourceType: WorkplaceResourceType;
  siteId: string;
  floorId: string;
  startsAt: string;
  endsAt: string;
  purpose: string;
  requiredFeatures: string;
  accessibleOnly: boolean;
  visibleToColleagues: boolean;
};

function beneficiaryReference(value: WorkplaceAuthorizedBookingBeneficiary) {
  return value.beneficiaryPersonPublicId ?? `user:${value.beneficiaryUserId}`;
}

function defaultItem(draftId: number, beneficiaryRef: string, timeZone: string): DraftItem {
  const range = workplaceAssistantInitialLocalRange(timeZone);
  return {
    draftId,
    beneficiaryRef,
    resourceType: 'DESK',
    siteId: '',
    floorId: '',
    startsAt: range.startsAt,
    endsAt: range.endsAt,
    purpose: '',
    requiredFeatures: '',
    accessibleOnly: false,
    visibleToColleagues: false,
  };
}

function toInput(
  item: DraftItem,
  index: number,
  beneficiaries: readonly WorkplaceAuthorizedBookingBeneficiary[],
  sites: readonly WorkplaceSite[],
  browserTimeZone: string
): WorkplaceAssistantRequestedBookingItem {
  const beneficiary = beneficiaries.find(
    (candidate) => beneficiaryReference(candidate) === item.beneficiaryRef
  );
  if (!beneficiary) throw new Error('The selected beneficiary is no longer authorized.');
  const timeZone = sites.find((site) => site.siteId === item.siteId)?.timeZone ?? browserTimeZone;
  return {
    clientItemKey: `assistant-item-${index + 1}-${item.startsAt.replace(/[^0-9]/gu, '')}`.slice(
      0,
      120
    ),
    beneficiaryUserId: beneficiary.beneficiaryUserId,
    beneficiaryPersonPublicId: beneficiary.beneficiaryPersonPublicId,
    beneficiaryDisplayName: beneficiary.displayName,
    delegationGrantId: beneficiary.self ? null : beneficiary.delegationGrantId,
    resourceType: item.resourceType,
    preferredResourceId: null,
    siteId: item.siteId || null,
    floorId: item.floorId || null,
    startsAt: workplaceAssistantLocalDateTimeToInstant(item.startsAt, timeZone),
    endsAt: workplaceAssistantLocalDateTimeToInstant(item.endsAt, timeZone),
    purpose: item.purpose.trim() || null,
    visibleToColleagues: item.visibleToColleagues,
    accessibleOnly: item.accessibleOnly,
    requiredFeatures: item.requiredFeatures
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  };
}

export function WorkplaceAssistantRequestForm({
  beneficiaries,
  beneficiarySourceState,
  onRetryBeneficiaries,
  sites,
  floors,
  disabled,
  loading,
  onSubmit,
}: {
  beneficiaries: readonly WorkplaceAuthorizedBookingBeneficiary[];
  beneficiarySourceState: 'LOADING' | 'READY' | 'STALE' | 'DENIED' | 'UNAVAILABLE';
  onRetryBeneficiaries: () => void;
  sites: readonly WorkplaceSite[];
  floors: readonly WorkplaceFloor[];
  disabled: boolean;
  loading: boolean;
  onSubmit: (input: WorkplaceAssistantCreateInput) => void;
}) {
  const copy = useWorkplaceAssistantCopy();
  const browserTimeZone = useMemo(workplaceAssistantBrowserTimeZone, []);
  const [requestText, setRequestText] = useState('');
  const [reason, setReason] = useState('');
  const [beneficiaryTarget, setBeneficiaryTarget] = useState<BeneficiaryTarget>('SELF');
  const [processingConsent, setProcessingConsent] = useState(false);
  const [feedbackConsent, setFeedbackConsent] = useState(false);
  const [items, setItems] = useState(() => [defaultItem(1, '', browserTimeZone)]);
  const [error, setError] = useState(false);
  const visibleBeneficiaries = useMemo(
    () =>
      beneficiaries.filter((beneficiary) => {
        if (beneficiaryTarget === 'SELF') return beneficiary.self;
        if (beneficiaryTarget === 'DELEGATE') return !beneficiary.self;
        return true;
      }),
    [beneficiaries, beneficiaryTarget]
  );
  const siteOptions = useMemo(
    () => [
      { value: '', label: copy.anySite },
      ...sites
        .filter((site) => site.state === 'ACTIVE')
        .map((site) => ({ value: site.siteId, label: site.name })),
    ],
    [copy.anySite, sites]
  );
  const update = (draftId: number, patch: Partial<DraftItem>) =>
    setItems((current) =>
      current.map((item) => (item.draftId === draftId ? { ...item, ...patch } : item))
    );
  useEffect(() => {
    const allowed = new Set(visibleBeneficiaries.map(beneficiaryReference));
    const fallbackBeneficiary = visibleBeneficiaries[0];
    const fallback = fallbackBeneficiary ? beneficiaryReference(fallbackBeneficiary) : '';
    setItems((current) =>
      current.map((item) => {
        if (allowed.has(item.beneficiaryRef)) return item;
        return {
          ...item,
          beneficiaryRef: fallback,
          resourceType:
            fallbackBeneficiary && !fallbackBeneficiary.resourceTypes.includes(item.resourceType)
              ? (fallbackBeneficiary.resourceTypes[0] ?? item.resourceType)
              : item.resourceType,
        };
      })
    );
  }, [visibleBeneficiaries]);
  const submit = () => {
    const invalidItem = items.some(
      (item) =>
        !visibleBeneficiaries.some(
          (beneficiary) =>
            beneficiaryReference(beneficiary) === item.beneficiaryRef &&
            beneficiary.resourceTypes.includes(item.resourceType)
        ) ||
        !Number.isFinite(Date.parse(item.startsAt)) ||
        !Number.isFinite(Date.parse(item.endsAt)) ||
        Date.parse(item.endsAt) <= Date.parse(item.startsAt) ||
        RAW_PERSONAL_DATA.test(item.purpose)
    );
    if (
      disabled ||
      beneficiarySourceState !== 'READY' ||
      visibleBeneficiaries.length === 0 ||
      !processingConsent ||
      !requestText.trim() ||
      !reason.trim() ||
      RAW_PERSONAL_DATA.test(requestText) ||
      invalidItem
    ) {
      setError(true);
      return;
    }
    setError(false);
    try {
      onSubmit({
        requestText: requestText.trim(),
        requestedItems: items.map((item, index) =>
          toInput(item, index, visibleBeneficiaries, sites, browserTimeZone)
        ),
        requestProcessingConsent: true,
        feedbackUseConsent: feedbackConsent,
        reason: reason.trim(),
      });
    } catch {
      setError(true);
    }
  };

  return (
    <Box sx={(theme) => ({ ...workplaceMemberCard(theme), p: { xs: 1.5, md: 2 } })}>
      <Stack spacing={2}>
        <Box>
          <Typography component="h2" variant="h6" fontWeight="fontWeightBold">
            {copy.createTitle}
          </Typography>
          <Typography color="text.secondary" variant="body2">
            {copy.noStorage}
          </Typography>
        </Box>
        {error && <InlineFeedback severity="error">{copy.commandError}</InlineFeedback>}
        {beneficiarySourceState !== 'READY' && (
          <InlineFeedback severity={beneficiarySourceState === 'LOADING' ? 'info' : 'warning'}>
            {beneficiarySourceState === 'LOADING'
              ? copy.beneficiaryLoading
              : beneficiarySourceState === 'DENIED'
                ? copy.beneficiaryDenied
                : beneficiarySourceState === 'STALE'
                  ? copy.beneficiaryStale
                  : copy.beneficiaryUnavailable}
            {beneficiarySourceState !== 'LOADING' && (
              <ActionButton
                intent="quiet"
                size="small"
                startIcon={<RefreshCw size={15} />}
                onClick={onRetryBeneficiaries}
              >
                {copy.retryBeneficiaries}
              </ActionButton>
            )}
          </InlineFeedback>
        )}
        {beneficiarySourceState === 'READY' && visibleBeneficiaries.length === 0 && (
          <InlineFeedback severity="warning">{copy.beneficiaryTargetUnavailable}</InlineFeedback>
        )}
        <FormField
          multiline
          minRows={3}
          label={copy.requestText}
          supportingText={`${copy.requestTextHint} ${copy.submitShortcut}`}
          value={requestText}
          inputProps={{ maxLength: 4000 }}
          onChange={(event) => setRequestText(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault();
              submit();
            }
          }}
        />
        <WorkplaceAssistantVoiceInput
          value={requestText}
          disabled={disabled || loading}
          onChange={setRequestText}
        />
        <SelectField
          label={copy.beneficiaryTarget}
          value={beneficiaryTarget}
          options={BENEFICIARY_TARGETS.map((value) => ({
            value,
            label: copy.beneficiaryTargets[value],
          }))}
          onValueChange={(value) => value && setBeneficiaryTarget(value)}
        />
        {items.map((item, index) => {
          const selectedBeneficiary = visibleBeneficiaries.find(
            (beneficiary) => beneficiaryReference(beneficiary) === item.beneficiaryRef
          );
          const selectedSite = sites.find((site) => site.siteId === item.siteId);
          const timeZone = selectedSite?.timeZone ?? browserTimeZone;
          const floorOptions = [
            { value: '', label: copy.anyFloor },
            ...floors
              .filter(
                (floor) =>
                  floor.state === 'ACTIVE' && (!item.siteId || floor.siteId === item.siteId)
              )
              .map((floor) => ({ value: floor.floorId, label: floor.name })),
          ];
          return (
            <Box
              key={item.draftId}
              sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.5 })}
            >
              <Stack spacing={1.5}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                  <Typography component="h3" fontWeight="fontWeightBold">
                    {copy.text(copy.requirement, { index: index + 1 })}
                  </Typography>
                  {items.length > 1 && (
                    <ActionButton
                      intent="quiet"
                      size="small"
                      startIcon={<Trash2 size={15} />}
                      aria-label={`${copy.removeItem} ${index + 1}`}
                      onClick={() =>
                        setItems((current) =>
                          current.filter(({ draftId }) => draftId !== item.draftId)
                        )
                      }
                    >
                      {copy.removeItem}
                    </ActionButton>
                  )}
                </Stack>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                    gap: 1.5,
                  }}
                >
                  <SelectField
                    label={copy.beneficiary}
                    value={selectedBeneficiary ? item.beneficiaryRef : ''}
                    options={visibleBeneficiaries.map((beneficiary) => ({
                      value: beneficiaryReference(beneficiary),
                      label: `${beneficiary.displayName} · ${
                        beneficiary.self ? copy.beneficiarySelf : copy.beneficiaryDelegate
                      }`,
                    }))}
                    onValueChange={(value) => {
                      if (!value) return;
                      const beneficiary = visibleBeneficiaries.find(
                        (candidate) => beneficiaryReference(candidate) === value
                      );
                      update(item.draftId, {
                        beneficiaryRef: value,
                        ...(beneficiary && !beneficiary.resourceTypes.includes(item.resourceType)
                          ? { resourceType: beneficiary.resourceTypes[0] ?? item.resourceType }
                          : {}),
                      });
                    }}
                  />
                  <SelectField
                    label={copy.resourceType}
                    value={
                      selectedBeneficiary?.resourceTypes.includes(item.resourceType)
                        ? item.resourceType
                        : ''
                    }
                    options={RESOURCE_TYPES.filter((value) =>
                      selectedBeneficiary?.resourceTypes.includes(value)
                    ).map((value) => ({ value, label: copy.resourceTypes[value] }))}
                    onValueChange={(value) =>
                      value && update(item.draftId, { resourceType: value })
                    }
                  />
                  <SelectField
                    label={copy.site}
                    value={item.siteId}
                    options={siteOptions}
                    onValueChange={(value) => update(item.draftId, { siteId: value, floorId: '' })}
                  />
                  <SelectField
                    label={copy.floor}
                    value={item.floorId}
                    options={floorOptions}
                    onValueChange={(value) => update(item.draftId, { floorId: value })}
                  />
                  <FormField
                    label={copy.features}
                    value={item.requiredFeatures}
                    inputProps={{ maxLength: 500 }}
                    onChange={(event) =>
                      update(item.draftId, { requiredFeatures: event.target.value })
                    }
                  />
                  <FormField
                    type="datetime-local"
                    label={copy.startsAt}
                    value={item.startsAt}
                    slotProps={{ inputLabel: { shrink: true } }}
                    onChange={(event) => update(item.draftId, { startsAt: event.target.value })}
                  />
                  <FormField
                    type="datetime-local"
                    label={copy.endsAt}
                    value={item.endsAt}
                    slotProps={{ inputLabel: { shrink: true } }}
                    onChange={(event) => update(item.draftId, { endsAt: event.target.value })}
                  />
                </Box>
                <FormField
                  label={copy.purpose}
                  value={item.purpose}
                  inputProps={{ maxLength: 500 }}
                  onChange={(event) => update(item.draftId, { purpose: event.target.value })}
                />
                <Typography variant="caption" color="text.secondary">
                  {copy.text(selectedSite ? copy.siteTimeZone : copy.browserTimeZone, {
                    zone: timeZone,
                  })}
                </Typography>
                <Stack direction={{ xs: 'column', md: 'row' }} gap={{ xs: 0, md: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={item.accessibleOnly}
                        onChange={(event) =>
                          update(item.draftId, { accessibleOnly: event.target.checked })
                        }
                      />
                    }
                    label={copy.accessibleOnly}
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={item.visibleToColleagues}
                        onChange={(event) =>
                          update(item.draftId, { visibleToColleagues: event.target.checked })
                        }
                      />
                    }
                    label={copy.visibleToColleagues}
                  />
                </Stack>
              </Stack>
            </Box>
          );
        })}
        <ActionButton
          intent="secondary"
          startIcon={<Plus size={16} />}
          disabled={items.length >= 50}
          onClick={() =>
            setItems((current) => [
              ...current,
              defaultItem(
                Math.max(...current.map(({ draftId }) => draftId)) + 1,
                visibleBeneficiaries[0] ? beneficiaryReference(visibleBeneficiaries[0]) : '',
                browserTimeZone
              ),
            ])
          }
        >
          {copy.addItem}
        </ActionButton>
        <FormField
          label={copy.reason}
          value={reason}
          inputProps={{ maxLength: 500 }}
          onChange={(event) => setReason(event.target.value)}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={processingConsent}
              onChange={(event) => setProcessingConsent(event.target.checked)}
            />
          }
          label={copy.processingConsent}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={feedbackConsent}
              onChange={(event) => setFeedbackConsent(event.target.checked)}
            />
          }
          label={copy.feedbackConsent}
        />
        <ActionButton
          intent="primary"
          startIcon={<Sparkles size={17} />}
          disabled={
            disabled ||
            beneficiarySourceState !== 'READY' ||
            visibleBeneficiaries.length === 0 ||
            !processingConsent
          }
          loading={loading}
          onClick={submit}
        >
          {copy.create}
        </ActionButton>
      </Stack>
    </Box>
  );
}
