import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ArrowRightLeft, CheckCircle2, LibraryBig, UserRoundCog } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listOrphanedSavedViews,
  listOrphanLifecycleActions,
  listSavedViewCustodyUsers,
  listSavedViewOwnershipTransfers,
  previewSavedViewOwnership,
  transferSavedViewOwnership,
  useAuth,
  usePermissions,
  useToast,
  type SavedViewCustodyUser,
  type SavedViewOwnershipDisposition,
  type SavedViewOwnershipPlanRequest,
  type SavedViewOwnershipPreview,
  type SavedViewOwnershipReason,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  AutocompleteField,
  DateTimePickerField,
  EnterpriseDataGrid,
  FormField,
  GuidedEmptyState,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

import {
  classifySavedViewOwnershipExecutionFailure,
  classifySavedViewTargetEligibilityFailure,
  countSavedViewScopes,
  isDueWithin,
  isEligibleSavedViewCustodyTarget,
  isValidSavedViewRetentionDate,
  SAVED_VIEW_OWNERSHIP_REASONS,
  sortCustodySourceUsers,
  type SavedViewCustodyWorkspaceTab,
  type SavedViewTargetEligibilityFailure,
} from './saved-view-custody-model';
import { SavedViewCustodyConfirmDialog } from './saved-view-custody-confirm-dialog';
import {
  SavedViewCustodyTargetField,
  SavedViewTargetEligibilityNotice,
} from './saved-view-custody-target-field';
import { SavedViewOrphanActionHistory } from './saved-view-orphan-action-history';
import { SavedViewNameConflictNotice } from './saved-view-name-conflict-notice';
import { useSavedViewCandidateColumns } from './saved-view-custody-preview-columns';
import {
  OrphanedSavedViewRegister,
  SavedViewOwnershipHistory,
} from './saved-view-custody-registers';
import {
  displayDate,
  dispositionLabel,
  SavedViewCustodyExplainer,
  SavedViewCustodyMetrics,
  SectionLoadError,
  StepTitle,
  statusLabel,
  userIdentityLabel,
  userOptionLabel,
} from './saved-view-custody-ui';

export function SavedViewCustodyManager() {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('ADMIN.SAVED_VIEW_CUSTODY', 'MANAGE');

  const [tab, setTab] = useState<SavedViewCustodyWorkspaceTab>('PLAN');
  const [sourceOwner, setSourceOwner] = useState<SavedViewCustodyUser | null>(null);
  const [targetOwner, setTargetOwner] = useState<SavedViewCustodyUser | null>(null);
  const [sourceSearch, setSourceSearch] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  const [debouncedSourceSearch, setDebouncedSourceSearch] = useState('');
  const [debouncedTargetSearch, setDebouncedTargetSearch] = useState('');
  const [disposition, setDisposition] = useState<SavedViewOwnershipDisposition>('TRANSFER');
  const [reasonCode, setReasonCode] = useState<SavedViewOwnershipReason>('OFFBOARDING');
  const [sourceReference, setSourceReference] = useState('');
  const [reason, setReason] = useState('');
  const [retentionUntil, setRetentionUntil] = useState<string | null>(null);
  const [preview, setPreview] = useState<SavedViewOwnershipPreview | null>(null);
  const [previewPlanKey, setPreviewPlanKey] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [executionConflict, setExecutionConflict] = useState(false);
  const [nameConflictTarget, setNameConflictTarget] = useState<string | null>(null);
  const [targetEligibilityFailure, setTargetEligibilityFailure] = useState<{
    reason: Exclude<SavedViewTargetEligibilityFailure, 'UNKNOWN'>;
    targetName: string;
  } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const executionKeyRef = useRef<string | null>(null);
  const previewHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const conflictNoticeRef = useRef<HTMLDivElement | null>(null);
  const nameConflictNoticeRef = useRef<HTMLDivElement | null>(null);
  const targetInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSourceSearch(sourceSearch.trim()), 220);
    return () => window.clearTimeout(timeout);
  }, [sourceSearch]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedTargetSearch(targetSearch.trim()), 220);
    return () => window.clearTimeout(timeout);
  }, [targetSearch]);

  useEffect(() => {
    setNameConflictTarget(null);
    setTargetEligibilityFailure(null);
    if (disposition === 'TRANSFER') setRetentionUntil(null);
    else setTargetOwner(null);
  }, [disposition]);

  const sourceUsers = useQuery({
    queryKey: ['admin', 'identity-users', 'saved-view-custody', 'source', debouncedSourceSearch],
    queryFn: () => listSavedViewCustodyUsers(debouncedSourceSearch, false, 30),
    staleTime: 20_000,
    retry: 1,
  });
  const targetUsers = useQuery({
    queryKey: [
      'admin',
      'identity-users',
      'saved-view-custody',
      'target',
      sourceOwner?.userId,
      debouncedTargetSearch,
    ],
    queryFn: () => listSavedViewCustodyUsers(debouncedTargetSearch, true, 30, sourceOwner?.userId),
    enabled: disposition === 'TRANSFER' && Boolean(sourceOwner),
    staleTime: 20_000,
    retry: 1,
  });
  const orphaned = useQuery({
    queryKey: ['admin', 'saved-view-custody', 'orphaned'],
    queryFn: listOrphanedSavedViews,
    retry: 1,
  });
  const history = useQuery({
    queryKey: ['admin', 'saved-view-custody', 'transfers'],
    queryFn: () => listSavedViewOwnershipTransfers(50),
    retry: 1,
  });
  const orphanActionHistory = useQuery({
    queryKey: ['admin', 'saved-view-custody', 'orphan-actions'],
    queryFn: () => listOrphanLifecycleActions(50),
    retry: 1,
  });

  const sourceOptions = useMemo(
    () => sortCustodySourceUsers(sourceUsers.data ?? []),
    [sourceUsers.data]
  );
  const targetOptions = useMemo(
    () =>
      (targetUsers.data ?? [])
        .filter(
          (user) =>
            user.status === 'ACTIVE' &&
            user.identityPlane !== 'PROVIDER' &&
            ![auth.user?.userId, sourceOwner?.userId].some(
              (userId) => userId != null && user.userId === userId
            )
        )
        .sort((left, right) => left.displayName.localeCompare(right.displayName)),
    [auth.user?.userId, sourceOwner, targetUsers.data]
  );
  const knownUsers = useMemo(() => {
    const values = [
      ...(sourceUsers.data ?? []),
      ...(targetUsers.data ?? []),
      ...(sourceOwner ? [sourceOwner] : []),
      ...(targetOwner ? [targetOwner] : []),
    ];
    return new Map(values.map((user) => [user.userId, user]));
  }, [sourceOwner, sourceUsers.data, targetOwner, targetUsers.data]);

  const sourceValid = Boolean(sourceOwner);
  const targetValid =
    disposition === 'TRANSFER'
      ? Boolean(
          isEligibleSavedViewCustodyTarget(targetOwner, [auth.user?.userId, sourceOwner?.userId])
        )
      : isValidSavedViewRetentionDate(retentionUntil);
  const referenceValid = sourceReference.trim().length >= 3;
  const reasonValid = reason.trim().length >= 10;
  const valid = sourceValid && targetValid && referenceValid && reasonValid;

  const plan = (): SavedViewOwnershipPlanRequest => ({
    sourceOwnerUserId: sourceOwner?.userId ?? 0,
    disposition,
    targetOwnerUserId: disposition === 'TRANSFER' ? (targetOwner?.userId ?? null) : null,
    reasonCode,
    reason: reason.trim(),
    sourceReference: sourceReference.trim(),
    retentionUntil: disposition === 'RETAIN_ORPHANED' ? retentionUntil : null,
  });

  const currentPlanKey = JSON.stringify([
    sourceOwner?.userId ?? null,
    disposition,
    targetOwner?.userId ?? null,
    reasonCode,
    reason.trim(),
    sourceReference.trim(),
    retentionUntil,
  ]);
  const currentPreview = preview && previewPlanKey === currentPlanKey ? preview : null;
  const previewIsStale = Boolean(preview && !currentPreview);
  const missingCount = [sourceValid, targetValid, referenceValid, reasonValid].filter(
    (value) => !value
  ).length;

  const refresh = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['admin', 'saved-view-custody'],
      }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit-events'] }),
    ]);
  };

  const handlePreview = async () => {
    setValidationAttempted(true);
    setPreviewFailed(false);
    setExecutionConflict(false);
    setNameConflictTarget(null);
    setTargetEligibilityFailure(null);
    if (!canManage || !valid) return;
    setPreviewing(true);
    try {
      const evaluated = await previewSavedViewOwnership(plan());
      setPreview(evaluated);
      setPreviewPlanKey(currentPlanKey);
      executionKeyRef.current = null;
      window.requestAnimationFrame(() => previewHeadingRef.current?.focus());
    } catch (error) {
      const eligibilityFailure = classifySavedViewTargetEligibilityFailure(error);
      if (disposition === 'TRANSFER' && eligibilityFailure !== 'UNKNOWN') {
        setTargetEligibilityFailure({
          reason: eligibilityFailure,
          targetName: targetOwner?.displayName ?? '-',
        });
        setTargetOwner(null);
        setTargetSearch('');
        window.requestAnimationFrame(() => targetInputRef.current?.focus());
      } else {
        setPreviewFailed(true);
        toast.error(t('savedViewCustody.toasts.previewFailed'));
      }
    } finally {
      setPreviewing(false);
    }
  };

  const handleExecute = async () => {
    if (!currentPreview || currentPreview.affectedCount === 0 || nameConflicts.length) return;
    setExecuting(true);
    if (!executionKeyRef.current) {
      executionKeyRef.current = 'saved-view-ownership-' + crypto.randomUUID();
    }
    try {
      const result = await transferSavedViewOwnership({
        ...plan(),
        idempotencyKey: executionKeyRef.current,
        expectedCount: currentPreview.affectedCount,
        ownershipFingerprint: currentPreview.ownershipFingerprint,
      });
      await refresh();
      executionKeyRef.current = null;
      setConfirmOpen(false);
      setPreview(null);
      setPreviewPlanKey('');
      setTab('HISTORY');
      toast.success(
        t('savedViewCustody.toasts.completed', {
          count: result.transferredCount,
        })
      );
    } catch (error) {
      const failure = classifySavedViewOwnershipExecutionFailure(error);
      if (failure === 'PERSONAL_NAME_CONFLICT') {
        setConfirmOpen(false);
        setPreview(null);
        setPreviewPlanKey('');
        executionKeyRef.current = null;
        setNameConflictTarget(targetOwner?.displayName ?? null);
        window.requestAnimationFrame(() => nameConflictNoticeRef.current?.focus());
      } else if (failure !== 'UNKNOWN') {
        setConfirmOpen(false);
        setPreview(null);
        setPreviewPlanKey('');
        executionKeyRef.current = null;
        setExecutionConflict(true);
        await refresh();
        window.requestAnimationFrame(() => conflictNoticeRef.current?.focus());
      } else {
        const eligibilityFailure = classifySavedViewTargetEligibilityFailure(error);
        if (disposition === 'TRANSFER' && eligibilityFailure !== 'UNKNOWN') {
          setConfirmOpen(false);
          setPreview(null);
          setPreviewPlanKey('');
          executionKeyRef.current = null;
          setTargetEligibilityFailure({
            reason: eligibilityFailure,
            targetName: targetOwner?.displayName ?? '-',
          });
          setTargetOwner(null);
          setTargetSearch('');
          await targetUsers.refetch();
          window.requestAnimationFrame(() => targetInputRef.current?.focus());
        } else {
          await refresh();
          toast.error(t('savedViewCustody.toasts.executeFailed'));
        }
      }
    } finally {
      setExecuting(false);
    }
  };

  const scopeCounts = countSavedViewScopes(currentPreview?.views ?? []);
  const nameConflicts = currentPreview?.nameConflicts ?? [];
  const expiringSoon = (orphaned.data ?? []).filter((view) =>
    isDueWithin(view.retentionUntil, 7)
  ).length;
  const registersUpdatedAt = Math.max(
    orphaned.dataUpdatedAt,
    history.dataUpdatedAt,
    orphanActionHistory.dataUpdatedAt
  );

  const candidateColumns = useSavedViewCandidateColumns();
  const executeLabel =
    disposition === 'TRANSFER'
      ? t('savedViewCustody.actions.transfer', {
          count: currentPreview?.affectedCount ?? 0,
          name: targetOwner?.displayName ?? '',
        })
      : t('savedViewCustody.actions.suspend', {
          count: currentPreview?.affectedCount ?? 0,
        });

  return (
    <Stack gap={3} sx={{ width: '100%', maxWidth: 1440, mx: 'auto' }}>
      <SavedViewCustodyExplainer />
      <SavedViewCustodyMetrics
        orphanedCount={orphaned.isError ? null : (orphaned.data?.length ?? 0)}
        expiringSoon={orphaned.isError ? null : expiringSoon}
        historyCount={
          history.isError || orphanActionHistory.isError
            ? null
            : (history.data?.length ?? 0) + (orphanActionHistory.data?.length ?? 0)
        }
        updatedAt={registersUpdatedAt > 0 ? new Date(registersUpdatedAt).toISOString() : null}
        refreshing={orphaned.isFetching || history.isFetching || orphanActionHistory.isFetching}
        onOpenOrphaned={() => setTab('ORPHANED')}
        onOpenHistory={() => setTab('HISTORY')}
      />

      <Tabs
        value={tab}
        onChange={(_, value: SavedViewCustodyWorkspaceTab) => setTab(value)}
        aria-label={t('savedViewCustody.tabs.label')}
        variant="scrollable"
        allowScrollButtonsMobile
      >
        <Tab
          id="saved-view-custody-tab-PLAN"
          aria-controls="saved-view-custody-panel-PLAN"
          value="PLAN"
          label={t('savedViewCustody.tabs.plan')}
        />
        <Tab
          id="saved-view-custody-tab-ORPHANED"
          aria-controls="saved-view-custody-panel-ORPHANED"
          value="ORPHANED"
          label={
            orphaned.isSuccess
              ? t('savedViewCustody.tabs.orphaned', {
                  count: orphaned.data.length,
                })
              : t('savedViewCustody.tabs.orphanedPlain')
          }
        />
        <Tab
          id="saved-view-custody-tab-HISTORY"
          aria-controls="saved-view-custody-panel-HISTORY"
          value="HISTORY"
          label={t('savedViewCustody.tabs.history')}
        />
      </Tabs>

      {tab === 'PLAN' && (
        <Stack
          id="saved-view-custody-panel-PLAN"
          role="tabpanel"
          aria-labelledby="saved-view-custody-tab-PLAN"
          gap={2.5}
        >
          {!canManage && <Alert severity="info">{t('savedViewCustody.readOnly')}</Alert>}
          <Box
            component="section"
            aria-labelledby="saved-view-plan-title"
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                lg: 'minmax(360px, 440px) minmax(0, 1fr)',
              },
              gap: { xs: 3, lg: 4 },
              alignItems: 'start',
            }}
          >
            <Box
              component="form"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void handlePreview();
              }}
            >
              <Stack gap={2.25}>
                <Box>
                  <Typography id="saved-view-plan-title" component="h2" variant="h6">
                    {t('savedViewCustody.plan.title')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                    {t('savedViewCustody.plan.description')}
                  </Typography>
                </Box>

                <StepTitle
                  step={1}
                  title={t('savedViewCustody.steps.owner.title')}
                  description={t('savedViewCustody.steps.owner.description')}
                />
                {sourceUsers.isError && (
                  <SectionLoadError
                    message={t('savedViewCustody.errors.users')}
                    retryLabel={t('savedViewCustody.actions.retry')}
                    onRetry={() => void sourceUsers.refetch()}
                  />
                )}
                <AutocompleteField<SavedViewCustodyUser>
                  required
                  disabled={!canManage}
                  label={t('savedViewCustody.fields.sourceOwner')}
                  supportingText={t('savedViewCustody.fields.sourceOwnerHelp')}
                  errorMessage={
                    validationAttempted && !sourceValid
                      ? t('savedViewCustody.validation.sourceOwner')
                      : undefined
                  }
                  value={sourceOwner}
                  options={sourceOptions}
                  loading={sourceUsers.isLoading}
                  loadingText={t('savedViewCustody.fields.loadingUsers')}
                  noOptionsText={t('savedViewCustody.fields.noUsers')}
                  openOnFocus
                  filterOptions={(options) => options}
                  getOptionLabel={(option) => userOptionLabel(option, t)}
                  isOptionEqualToValue={(option, value) => option.userId === value.userId}
                  onInputChange={(_, value, changeReason) => {
                    if (changeReason === 'input' || changeReason === 'clear') {
                      setSourceSearch(value);
                    }
                  }}
                  onChange={(_, value) => {
                    setSourceOwner(value);
                    setTargetOwner(null);
                    setTargetSearch('');
                    setTargetEligibilityFailure(null);
                  }}
                />
                {sourceOwner && (
                  <Box
                    sx={{
                      p: 1.5,
                      borderLeft: 3,
                      borderColor: sourceOwner.status === 'ACTIVE' ? 'info.main' : 'warning.main',
                      bgcolor: 'action.hover',
                    }}
                  >
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      gap={1}
                    >
                      <Box>
                        <Typography variant="body2" fontWeight={700}>
                          {userIdentityLabel(sourceOwner)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t('savedViewCustody.fields.selectedOwnerHelp')}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        variant="outlined"
                        sx={{
                          color: 'text.primary',
                          borderColor:
                            sourceOwner.status === 'ACTIVE' ? 'success.dark' : 'warning.dark',
                        }}
                        label={statusLabel(sourceOwner.status, t)}
                      />
                    </Stack>
                  </Box>
                )}

                <Divider />
                <StepTitle
                  step={2}
                  title={t('savedViewCustody.steps.disposition.title')}
                  description={t('savedViewCustody.steps.disposition.description')}
                />
                <FormControl component="fieldset" disabled={!canManage}>
                  <FormLabel component="legend">
                    {t('savedViewCustody.fields.disposition')}
                  </FormLabel>
                  <RadioGroup
                    value={disposition}
                    onChange={(event) =>
                      setDisposition(event.target.value as SavedViewOwnershipDisposition)
                    }
                    sx={{ gap: 1, mt: 1 }}
                  >
                    {(['TRANSFER', 'RETAIN_ORPHANED'] as SavedViewOwnershipDisposition[]).map(
                      (value) => {
                        const selected = disposition === value;
                        return (
                          <Box
                            component="label"
                            key={value}
                            sx={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 1,
                              p: 1.5,
                              border: 1,
                              borderColor: selected ? 'primary.main' : 'divider',
                              borderRadius: 1.5,
                              bgcolor: selected ? 'action.selected' : 'background.paper',
                              cursor: canManage ? 'pointer' : 'default',
                            }}
                          >
                            <Radio value={value} size="small" sx={{ mt: -0.5, ml: -0.5 }} />
                            <Box>
                              <Typography variant="body2" fontWeight={700}>
                                {dispositionLabel(value, t)}
                              </Typography>
                              <Typography
                                component="p"
                                variant="caption"
                                color="text.secondary"
                                sx={{ mt: 0.25 }}
                              >
                                {t('savedViewCustody.dispositionHelp.' + value)}
                              </Typography>
                            </Box>
                          </Box>
                        );
                      }
                    )}
                  </RadioGroup>
                </FormControl>

                {disposition === 'TRANSFER' ? (
                  <>
                    {targetUsers.isError && (
                      <SectionLoadError
                        message={t('savedViewCustody.errors.users')}
                        retryLabel={t('savedViewCustody.actions.retry')}
                        onRetry={() => void targetUsers.refetch()}
                      />
                    )}
                    {targetEligibilityFailure ? (
                      <SavedViewTargetEligibilityNotice
                        reason={targetEligibilityFailure.reason}
                        targetName={targetEligibilityFailure.targetName}
                      />
                    ) : null}
                    <SavedViewCustodyTargetField
                      disabled={!canManage}
                      label={t('savedViewCustody.fields.targetOwner')}
                      supportingText={t('savedViewCustody.fields.targetOwnerHelp')}
                      errorMessage={
                        validationAttempted && !targetValid
                          ? t('savedViewCustody.validation.targetOwner')
                          : undefined
                      }
                      inputRef={targetInputRef}
                      value={targetOwner}
                      options={targetOptions}
                      loading={targetUsers.isLoading}
                      reopenOnReady={Boolean(targetEligibilityFailure)}
                      onInputChange={setTargetSearch}
                      onChange={(value) => {
                        setTargetOwner(value);
                        setNameConflictTarget(null);
                        setTargetEligibilityFailure(null);
                      }}
                    />
                  </>
                ) : (
                  <>
                    <Alert severity="warning">
                      {t('savedViewCustody.fields.retentionWarning')}
                    </Alert>
                    <DateTimePickerField
                      required
                      disabled={!canManage}
                      label={t('savedViewCustody.fields.retentionUntil')}
                      supportingText={t('savedViewCustody.fields.retentionHelp')}
                      errorMessage={
                        validationAttempted && !targetValid
                          ? t('savedViewCustody.validation.retentionUntil')
                          : undefined
                      }
                      value={retentionUntil}
                      onValueChange={setRetentionUntil}
                    />
                  </>
                )}

                <Divider />
                <StepTitle
                  step={3}
                  title={t('savedViewCustody.steps.evidence.title')}
                  description={t('savedViewCustody.steps.evidence.description')}
                />
                <SelectField
                  required
                  disabled={!canManage}
                  label={t('savedViewCustody.fields.reasonCode')}
                  value={reasonCode}
                  options={SAVED_VIEW_OWNERSHIP_REASONS.map((value) => ({
                    value,
                    label: t('savedViewCustody.reasons.' + value),
                  }))}
                  onValueChange={(value) => value && setReasonCode(value)}
                />
                <FormField
                  required
                  disabled={!canManage}
                  label={t('savedViewCustody.fields.sourceReference')}
                  supportingText={t('savedViewCustody.fields.sourceReferenceHelp')}
                  errorMessage={
                    validationAttempted && !referenceValid
                      ? t('savedViewCustody.validation.sourceReference')
                      : undefined
                  }
                  value={sourceReference}
                  inputProps={{ maxLength: 240 }}
                  onChange={(event) => setSourceReference(event.target.value)}
                />
                <FormField
                  required
                  multiline
                  minRows={3}
                  disabled={!canManage}
                  label={t('savedViewCustody.fields.reason')}
                  supportingText={t('savedViewCustody.fields.reasonHelp')}
                  errorMessage={
                    validationAttempted && !reasonValid
                      ? t('savedViewCustody.validation.reason')
                      : undefined
                  }
                  value={reason}
                  inputProps={{ maxLength: 1000 }}
                  onChange={(event) => setReason(event.target.value)}
                />
                <Stack gap={0.75}>
                  <ActionButton
                    type="submit"
                    intent="primary"
                    startIcon={<LibraryBig size={16} />}
                    disabled={!canManage}
                    loading={previewing}
                    loadingLabel={t('savedViewCustody.actions.previewing')}
                    fullWidth
                  >
                    {t('savedViewCustody.actions.preview')}
                  </ActionButton>
                  {!valid && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      textAlign="center"
                      aria-live="polite"
                    >
                      {t('savedViewCustody.validation.remaining', {
                        count: missingCount,
                      })}
                    </Typography>
                  )}
                </Stack>
              </Stack>
            </Box>

            <Stack
              gap={1.5}
              sx={{
                minWidth: 0,
                position: { lg: 'sticky' },
                top: { lg: 16 },
              }}
            >
              <Box>
                <Typography
                  ref={previewHeadingRef}
                  tabIndex={-1}
                  component="h2"
                  variant="h6"
                  sx={{ outline: 'none' }}
                >
                  {t('savedViewCustody.preview.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {t('savedViewCustody.preview.description')}
                </Typography>
              </Box>

              {previewFailed && (
                <SectionLoadError
                  message={t('savedViewCustody.errors.preview')}
                  retryLabel={t('savedViewCustody.actions.retryPreview')}
                  onRetry={() => void handlePreview()}
                />
              )}
              {executionConflict && (
                <Alert
                  ref={conflictNoticeRef}
                  tabIndex={-1}
                  severity="warning"
                  aria-live="assertive"
                  sx={{
                    '& .MuiAlert-message': { width: '100%' },
                    '&:focus-visible': { outline: '3px solid', outlineColor: 'warning.main' },
                  }}
                >
                  <Stack gap={1} alignItems="flex-start">
                    <Typography variant="body2">
                      {t('savedViewCustody.errors.executionConflict')}
                    </Typography>
                    <ActionButton
                      intent="secondary"
                      size="small"
                      disabled={!valid || !canManage}
                      onClick={() => void handlePreview()}
                    >
                      {t('savedViewCustody.actions.reviewCurrentImpact')}
                    </ActionButton>
                  </Stack>
                </Alert>
              )}
              {nameConflictTarget && (
                <SavedViewNameConflictNotice
                  ref={nameConflictNoticeRef}
                  targetName={nameConflictTarget}
                  runtime
                />
              )}
              {previewIsStale && (
                <Alert severity="info" aria-live="polite">
                  {t('savedViewCustody.preview.invalidated')}
                </Alert>
              )}

              {!currentPreview ? (
                <GuidedEmptyState
                  kind="first-use"
                  title={t('savedViewCustody.preview.emptyTitle')}
                  description={t(
                    previewIsStale
                      ? 'savedViewCustody.preview.staleDescription'
                      : 'savedViewCustody.preview.emptyDescription'
                  )}
                  size="standard"
                />
              ) : (
                <>
                  <Box
                    role="status"
                    sx={{
                      p: 2,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1.5,
                      bgcolor: 'action.hover',
                    }}
                  >
                    <Stack gap={1.5}>
                      <Typography component="p" variant="subtitle1" fontWeight={700}>
                        {currentPreview.disposition === 'TRANSFER'
                          ? t('savedViewCustody.preview.transferSummary', {
                              source: sourceOwner?.displayName ?? '',
                              target: targetOwner?.displayName ?? '',
                              count: currentPreview.affectedCount,
                            })
                          : t('savedViewCustody.preview.suspendSummary', {
                              source: sourceOwner?.displayName ?? '',
                              count: currentPreview.affectedCount,
                              date: displayDate(retentionUntil),
                            })}
                      </Typography>
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        alignItems={{ xs: 'flex-start', sm: 'center' }}
                        gap={1}
                      >
                        <Chip
                          size="small"
                          icon={<UserRoundCog size={15} />}
                          label={sourceOwner ? userIdentityLabel(sourceOwner) : '-'}
                        />
                        <ArrowRight size={17} aria-hidden="true" />
                        <Chip
                          size="small"
                          color={currentPreview.disposition === 'TRANSFER' ? 'primary' : 'warning'}
                          variant="outlined"
                          label={
                            currentPreview.disposition === 'TRANSFER'
                              ? targetOwner
                                ? userIdentityLabel(targetOwner)
                                : '-'
                              : t('savedViewCustody.preview.archiveTarget', {
                                  value: displayDate(retentionUntil),
                                })
                          }
                        />
                      </Stack>
                      <Stack direction="row" gap={0.75} flexWrap="wrap">
                        {(['PERSONAL', 'TEAM', 'TENANT'] as const).map((scope) => (
                          <Chip
                            key={scope}
                            size="small"
                            variant="outlined"
                            label={t('savedViewCustody.preview.scopeCount', {
                              scope: t('savedViewCustody.scopes.' + scope),
                              count: scopeCounts[scope],
                            })}
                          />
                        ))}
                        <Chip
                          size="small"
                          variant="outlined"
                          icon={<CheckCircle2 size={14} />}
                          label={t('savedViewCustody.preview.evaluatedAt', {
                            value: displayDate(currentPreview.evaluatedAt),
                          })}
                        />
                      </Stack>
                    </Stack>
                  </Box>

                  {nameConflicts.length > 0 ? (
                    <SavedViewNameConflictNotice
                      conflicts={nameConflicts}
                      targetName={targetOwner?.displayName}
                    />
                  ) : null}

                  {currentPreview.affectedCount > 0 ? (
                    <EnterpriseDataGrid
                      ariaLabel={t('savedViewCustody.preview.gridLabel')}
                      rows={currentPreview.views}
                      columns={candidateColumns}
                      getRowId={(row) => row.savedViewId}
                      minVisibleRows={4}
                      maxVisibleRows={8}
                      sx={{ borderRadius: 0 }}
                    />
                  ) : (
                    <GuidedEmptyState
                      kind="empty"
                      title={t('savedViewCustody.preview.noViewsTitle')}
                      description={t('savedViewCustody.preview.noViewsDescription')}
                      size="compact"
                    />
                  )}

                  <Alert severity={disposition === 'RETAIN_ORPHANED' ? 'warning' : 'info'}>
                    {t(
                      disposition === 'RETAIN_ORPHANED'
                        ? 'savedViewCustody.preview.suspendImpact'
                        : 'savedViewCustody.preview.transferImpact'
                    )}
                  </Alert>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    gap={1.5}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {t('savedViewCustody.preview.confirmHelp')}
                    </Typography>
                    <ActionButton
                      intent="primary"
                      startIcon={<ArrowRightLeft size={16} />}
                      disabled={
                        !canManage || currentPreview.affectedCount === 0 || nameConflicts.length > 0
                      }
                      onClick={() => setConfirmOpen(true)}
                    >
                      {executeLabel}
                    </ActionButton>
                  </Stack>
                </>
              )}
            </Stack>
          </Box>
        </Stack>
      )}

      {tab === 'ORPHANED' && (
        <Box
          id="saved-view-custody-panel-ORPHANED"
          role="tabpanel"
          aria-labelledby="saved-view-custody-tab-ORPHANED"
        >
          <OrphanedSavedViewRegister
            data={orphaned.data ?? []}
            loading={orphaned.isLoading}
            error={orphaned.isError}
            canManage={canManage}
            onRetry={() => void orphaned.refetch()}
            onChanged={refresh}
          />
        </Box>
      )}

      {tab === 'HISTORY' && (
        <Box
          id="saved-view-custody-panel-HISTORY"
          role="tabpanel"
          aria-labelledby="saved-view-custody-tab-HISTORY"
        >
          <Stack gap={4}>
            <SavedViewOwnershipHistory
              data={history.data ?? []}
              loading={history.isLoading}
              error={history.isError}
              knownUsers={knownUsers}
              onRetry={() => void history.refetch()}
            />
            <SavedViewOrphanActionHistory
              data={orphanActionHistory.data ?? []}
              loading={orphanActionHistory.isLoading}
              error={orphanActionHistory.isError}
              knownUsers={knownUsers}
              onRetry={() => void orphanActionHistory.refetch()}
            />
          </Stack>
        </Box>
      )}

      <SavedViewCustodyConfirmDialog
        open={confirmOpen}
        preview={currentPreview}
        disposition={disposition}
        sourceOwner={sourceOwner}
        targetOwner={targetOwner}
        retentionUntil={retentionUntil}
        reasonCode={reasonCode}
        reason={reason}
        sourceReference={sourceReference}
        busy={executing}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleExecute}
      />
    </Stack>
  );
}
