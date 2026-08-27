import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, CalendarClock, UserRoundCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  archiveOrphanedSavedView,
  extendOrphanedSavedViewRetention,
  listSavedViewCustodyUsers,
  reassignOrphanedSavedView,
  useAuth,
  useToast,
  type OrphanedSavedView,
  type OrphanLifecycleAction,
  type OrphanLifecycleResult,
  type SavedViewCustodyUser,
  type SavedViewOwnershipReason,
} from '@dwp-frontend/shared-utils';
import {
  ConfirmDialog,
  DateTimePickerField,
  FormDialog,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  classifySavedViewOwnershipExecutionFailure,
  classifySavedViewTargetEligibilityFailure,
  isEligibleSavedViewCustodyTarget,
  isValidOrphanRetentionExtension,
} from './saved-view-custody-model';
import { displayDate, surfaceLabel, userIdentityLabel } from './saved-view-custody-ui';
import {
  SavedViewCustodyTargetField,
  SavedViewTargetEligibilityNotice,
} from './saved-view-custody-target-field';
import { SavedViewNameConflictNotice } from './saved-view-name-conflict-notice';

import type { LucideIcon } from 'lucide-react';
import type { SavedViewTargetEligibilityFailure } from './saved-view-custody-model';

const ACTIONS: Array<{ value: OrphanLifecycleAction; icon: LucideIcon }> = [
  { value: 'REASSIGN', icon: UserRoundCheck },
  { value: 'EXTEND_RETENTION', icon: CalendarClock },
  { value: 'ARCHIVE', icon: Archive },
];

const REASONS: SavedViewOwnershipReason[] = [
  'OFFBOARDING',
  'TEAM_REORGANIZATION',
  'OWNER_CORRECTION',
];

export function SavedViewOrphanActionDialog({
  view,
  onClose,
  onCompleted,
  onConflict,
}: {
  view: OrphanedSavedView | null;
  onClose: () => void;
  onCompleted: (result: OrphanLifecycleResult) => void | Promise<void>;
  onConflict: (viewName: string) => void | Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const auth = useAuth();
  const [action, setAction] = useState<OrphanLifecycleAction>('REASSIGN');
  const [targetOwner, setTargetOwner] = useState<SavedViewCustodyUser | null>(null);
  const [targetSearch, setTargetSearch] = useState('');
  const [debouncedTargetSearch, setDebouncedTargetSearch] = useState('');
  const [retentionUntil, setRetentionUntil] = useState<string | null>(null);
  const [reasonCode, setReasonCode] = useState<SavedViewOwnershipReason>('OFFBOARDING');
  const [sourceReference, setSourceReference] = useState('');
  const [reason, setReason] = useState('');
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [nameConflictTarget, setNameConflictTarget] = useState<string | null>(null);
  const [runtimeSharedNameConflict, setRuntimeSharedNameConflict] = useState(false);
  const [targetEligibilityFailure, setTargetEligibilityFailure] = useState<{
    reason: Exclude<SavedViewTargetEligibilityFailure, 'UNKNOWN'>;
    targetName: string;
  } | null>(null);
  const commandKeyRef = useRef<string | null>(null);
  const nameConflictRef = useRef<HTMLDivElement | null>(null);
  const sharedNameConflictRef = useRef<HTMLDivElement | null>(null);
  const targetInputRef = useRef<HTMLInputElement | null>(null);
  const reassignBlocked =
    runtimeSharedNameConflict || view?.reassignmentBlockReason === 'SHARED_NAME_CONFLICT';

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedTargetSearch(targetSearch.trim()), 220);
    return () => window.clearTimeout(timeout);
  }, [targetSearch]);

  useEffect(() => {
    if (!view) return;
    setAction(
      view.reassignmentBlockReason === 'SHARED_NAME_CONFLICT' ? 'EXTEND_RETENTION' : 'REASSIGN'
    );
    setTargetOwner(null);
    setTargetSearch('');
    setRetentionUntil(null);
    setReasonCode('OFFBOARDING');
    setSourceReference('');
    setReason('');
    setValidationAttempted(false);
    setConfirmOpen(false);
    setExecuting(false);
    setNameConflictTarget(null);
    setRuntimeSharedNameConflict(false);
    setTargetEligibilityFailure(null);
    commandKeyRef.current = null;
  }, [view]);

  useEffect(() => {
    setNameConflictTarget(null);
    setTargetEligibilityFailure(null);
    if (action !== 'REASSIGN') {
      setTargetOwner(null);
    }
    if (action !== 'EXTEND_RETENTION') setRetentionUntil(null);
  }, [action]);

  useEffect(() => {
    commandKeyRef.current = null;
  }, [action, reason, reasonCode, retentionUntil, sourceReference, targetOwner, view?.version]);

  useEffect(() => {
    if (!runtimeSharedNameConflict || confirmOpen || executing) return;
    const timeout = window.setTimeout(() => sharedNameConflictRef.current?.focus(), 300);
    return () => window.clearTimeout(timeout);
  }, [confirmOpen, executing, runtimeSharedNameConflict]);

  useEffect(() => {
    if (!nameConflictTarget || confirmOpen || executing) return;
    const timeout = window.setTimeout(() => nameConflictRef.current?.focus(), 300);
    return () => window.clearTimeout(timeout);
  }, [confirmOpen, executing, nameConflictTarget]);

  useEffect(() => {
    if (!targetEligibilityFailure || confirmOpen || executing) return;
    const timeout = window.setTimeout(() => targetInputRef.current?.focus(), 300);
    return () => window.clearTimeout(timeout);
  }, [confirmOpen, executing, targetEligibilityFailure]);

  const targetUsers = useQuery({
    queryKey: [
      'admin',
      'identity-users',
      'saved-view-custody',
      'orphan-reassign',
      view?.savedViewId,
      debouncedTargetSearch,
    ],
    queryFn: () =>
      listSavedViewCustodyUsers(debouncedTargetSearch, true, 30, undefined, view?.savedViewId),
    enabled: Boolean(view) && action === 'REASSIGN' && !reassignBlocked,
    staleTime: 20_000,
    retry: 1,
  });
  const targetOptions = useMemo(
    () =>
      (targetUsers.data ?? [])
        .filter(
          (user) =>
            user.status === 'ACTIVE' &&
            user.identityPlane !== 'PROVIDER' &&
            user.userId !== auth.user?.userId
        )
        .sort((left, right) => left.displayName.localeCompare(right.displayName)),
    [auth.user?.userId, targetUsers.data]
  );

  const actionTargetValid =
    action === 'REASSIGN'
      ? !reassignBlocked && isEligibleSavedViewCustodyTarget(targetOwner, [auth.user?.userId])
      : action === 'EXTEND_RETENTION'
        ? isValidOrphanRetentionExtension(retentionUntil, view?.retentionUntil)
        : true;
  const referenceValid = sourceReference.trim().length >= 3;
  const reasonValid = reason.trim().length >= 10;
  const valid = actionTargetValid && referenceValid && reasonValid;

  const handleReview = () => {
    setValidationAttempted(true);
    if (valid) setConfirmOpen(true);
  };

  const handleExecute = async () => {
    if (!view || !valid) return;
    setExecuting(true);
    if (!commandKeyRef.current) {
      commandKeyRef.current = 'saved-view-orphan-' + crypto.randomUUID();
    }
    const evidence = {
      idempotencyKey: commandKeyRef.current,
      version: view.version,
      reasonCode,
      reason: reason.trim(),
      sourceReference: sourceReference.trim(),
    };
    try {
      const result =
        action === 'REASSIGN'
          ? await reassignOrphanedSavedView(view.savedViewId, {
              ...evidence,
              targetOwnerUserId: targetOwner!.userId,
            })
          : action === 'EXTEND_RETENTION'
            ? await extendOrphanedSavedViewRetention(view.savedViewId, {
                ...evidence,
                retentionUntil: retentionUntil!,
              })
            : await archiveOrphanedSavedView(view.savedViewId, evidence);
      commandKeyRef.current = null;
      setConfirmOpen(false);
      await onCompleted(result);
      toast.success(t('savedViewCustody.orphanActions.toasts.' + action));
    } catch (error) {
      const failure = classifySavedViewOwnershipExecutionFailure(error);
      if (failure === 'PERSONAL_NAME_CONFLICT') {
        const blockedTarget = targetOwner ? userIdentityLabel(targetOwner) : '-';
        commandKeyRef.current = null;
        setConfirmOpen(false);
        setTargetOwner(null);
        setTargetSearch('');
        setNameConflictTarget(blockedTarget);
      } else if (failure === 'SHARED_NAME_CONFLICT') {
        commandKeyRef.current = null;
        setConfirmOpen(false);
        setTargetOwner(null);
        setTargetSearch('');
        setAction('EXTEND_RETENTION');
        setRuntimeSharedNameConflict(true);
      } else if (failure === 'STALE_REVIEW') {
        commandKeyRef.current = null;
        setConfirmOpen(false);
        await onConflict(view.name);
      } else {
        const eligibilityFailure = classifySavedViewTargetEligibilityFailure(error);
        if (action === 'REASSIGN' && eligibilityFailure !== 'UNKNOWN') {
          const blockedTarget = targetOwner ? userIdentityLabel(targetOwner) : '-';
          commandKeyRef.current = null;
          setConfirmOpen(false);
          setTargetOwner(null);
          setTargetSearch('');
          setTargetEligibilityFailure({
            reason: eligibilityFailure,
            targetName: blockedTarget,
          });
          await targetUsers.refetch();
        } else {
          toast.error(t('savedViewCustody.orphanActions.toasts.failed'));
        }
      }
    } finally {
      setExecuting(false);
    }
  };

  const confirmTitle = view
    ? t('savedViewCustody.orphanActions.confirm.' + action + '.title', { name: view.name })
    : '';
  const confirmDescription = t('savedViewCustody.orphanActions.confirm.' + action + '.description');
  const confirmLabel = t('savedViewCustody.orphanActions.confirm.' + action + '.action');

  return (
    <>
      <FormDialog
        open={Boolean(view)}
        title={t('savedViewCustody.orphanActions.title')}
        cancelLabel={t('savedViewCustody.actions.cancel')}
        submitLabel={t('savedViewCustody.orphanActions.reviewAction')}
        submitIntent="primary"
        busy={executing || confirmOpen}
        submitDisabled={executing || (action === 'REASSIGN' && reassignBlocked)}
        maxWidth="sm"
        onClose={onClose}
        onSubmit={handleReview}
      >
        <Stack gap={2.25} sx={{ pt: 0.5 }}>
          {view && (
            <Box
              sx={{
                p: 1.5,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1.5,
                bgcolor: 'action.hover',
              }}
            >
              <Typography variant="subtitle2">{view.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {surfaceLabel(view.surfaceKey, t)} ·{' '}
                {t('savedViewCustody.orphanActions.currentArchive', {
                  value: displayDate(view.retentionUntil),
                })}
              </Typography>
            </Box>
          )}

          <FormControl component="fieldset" disabled={executing}>
            <FormLabel component="legend">
              {t('savedViewCustody.orphanActions.actionLabel')}
            </FormLabel>
            <RadioGroup
              value={action}
              onChange={(event) => {
                setAction(event.target.value as OrphanLifecycleAction);
                setValidationAttempted(false);
              }}
              sx={{ gap: 1, mt: 1 }}
            >
              {ACTIONS.map(({ value, icon: Icon }) => {
                const selected = action === value;
                const disabled = value === 'REASSIGN' && reassignBlocked;
                return (
                  <Box
                    component="label"
                    key={value}
                    aria-disabled={disabled || undefined}
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1,
                      p: 1.25,
                      border: 1,
                      borderColor: selected
                        ? value === 'ARCHIVE'
                          ? 'error.main'
                          : 'primary.main'
                        : 'divider',
                      borderRadius: 1.5,
                      bgcolor: selected ? 'action.selected' : 'background.paper',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: disabled ? 0.62 : 1,
                    }}
                  >
                    <Radio
                      value={value}
                      size="small"
                      disabled={disabled}
                      sx={{ mt: -0.5, ml: -0.5 }}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" alignItems="center" gap={0.75}>
                        <Icon size={16} aria-hidden="true" />
                        <Typography variant="body2" fontWeight={700}>
                          {t('savedViewCustody.orphanActions.actions.' + value + '.title')}
                        </Typography>
                      </Stack>
                      <Typography component="p" variant="caption" color="text.secondary">
                        {t('savedViewCustody.orphanActions.actions.' + value + '.description')}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </RadioGroup>
          </FormControl>

          {reassignBlocked && view ? (
            <Alert
              ref={sharedNameConflictRef}
              tabIndex={-1}
              severity="warning"
              aria-live="assertive"
              sx={{ '&:focus-visible': { outline: '3px solid', outlineColor: 'warning.main' } }}
            >
              <Typography component="p" variant="subtitle2" fontWeight={700}>
                {t('savedViewCustody.orphanActions.sharedNameConflict.title')}
              </Typography>
              <Typography component="p" variant="body2">
                {t('savedViewCustody.orphanActions.sharedNameConflict.description', {
                  scope: t('savedViewCustody.scopes.' + view.scope),
                  name: view.name,
                })}
              </Typography>
              <Typography component="p" variant="caption" color="text.secondary">
                {t('savedViewCustody.orphanActions.sharedNameConflict.guidance')}
              </Typography>
            </Alert>
          ) : null}

          {action === 'REASSIGN' && (
            <>
              {nameConflictTarget && view ? (
                <SavedViewNameConflictNotice
                  ref={nameConflictRef}
                  runtime
                  targetName={nameConflictTarget}
                  savedViewName={view.name}
                  surfaceKey={view.surfaceKey}
                />
              ) : null}
              {targetEligibilityFailure ? (
                <SavedViewTargetEligibilityNotice
                  reason={targetEligibilityFailure.reason}
                  targetName={targetEligibilityFailure.targetName}
                />
              ) : null}
              {targetUsers.isError && (
                <Alert severity="error">
                  {t('savedViewCustody.orphanActions.targetLoadError')}
                </Alert>
              )}
              <SavedViewCustodyTargetField
                disabled={executing}
                label={t('savedViewCustody.orphanActions.targetOwner')}
                supportingText={t('savedViewCustody.orphanActions.targetOwnerHelp')}
                errorMessage={
                  validationAttempted && !actionTargetValid
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
          )}
          {action === 'EXTEND_RETENTION' && (
            <DateTimePickerField
              required
              disabled={executing}
              label={t('savedViewCustody.orphanActions.newRetentionUntil')}
              supportingText={t('savedViewCustody.orphanActions.newRetentionHelp', {
                value: displayDate(view?.retentionUntil),
              })}
              errorMessage={
                validationAttempted && !actionTargetValid
                  ? t('savedViewCustody.orphanActions.retentionValidation', {
                      value: displayDate(view?.retentionUntil),
                    })
                  : undefined
              }
              value={retentionUntil}
              onValueChange={setRetentionUntil}
            />
          )}
          {action === 'ARCHIVE' && (
            <Alert severity="warning">{t('savedViewCustody.orphanActions.archiveWarning')}</Alert>
          )}

          <SelectField
            required
            disabled={executing}
            label={t('savedViewCustody.fields.reasonCode')}
            value={reasonCode}
            options={REASONS.map((value) => ({
              value,
              label: t('savedViewCustody.reasons.' + value),
            }))}
            onValueChange={(value) => value && setReasonCode(value)}
          />
          <FormField
            required
            disabled={executing}
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
            disabled={executing}
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
        </Stack>
      </FormDialog>

      <ConfirmDialog
        open={confirmOpen && Boolean(view)}
        title={confirmTitle}
        description={confirmDescription}
        cancelLabel={t('savedViewCustody.orphanActions.back')}
        confirmLabel={confirmLabel}
        confirmingLabel={t('savedViewCustody.orphanActions.executing')}
        busy={executing}
        intent={action === 'ARCHIVE' ? 'danger' : 'primary'}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleExecute}
        details={
          view ? (
            <Stack
              component="dl"
              gap={1.1}
              sx={{ m: 0, p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}
            >
              <ConfirmDetail
                label={t('savedViewCustody.orphanActions.confirm.view')}
                value={view.name}
                emphasized
              />
              <ConfirmDetail
                label={t('savedViewCustody.orphanActions.confirm.outcome')}
                value={
                  action === 'REASSIGN'
                    ? t('savedViewCustody.orphanActions.confirm.reassignOutcome', {
                        owner: targetOwner ? userIdentityLabel(targetOwner) : '-',
                      })
                    : action === 'EXTEND_RETENTION'
                      ? t('savedViewCustody.orphanActions.confirm.extendOutcome', {
                          value: displayDate(retentionUntil),
                        })
                      : t('savedViewCustody.orphanActions.confirm.archiveOutcome')
                }
                emphasized
              />
              <ConfirmDetail
                label={t('savedViewCustody.confirm.reasonType')}
                value={t('savedViewCustody.reasons.' + reasonCode)}
              />
              <ConfirmDetail
                label={t('savedViewCustody.confirm.sourceReference')}
                value={sourceReference.trim()}
              />
              <ConfirmDetail
                label={t('savedViewCustody.confirm.administratorNote')}
                value={reason.trim()}
                preserveWhitespace
              />
            </Stack>
          ) : null
        }
      />
    </>
  );
}

function ConfirmDetail({
  label,
  value,
  emphasized = false,
  preserveWhitespace = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
  preserveWhitespace?: boolean;
}) {
  return (
    <Box component="div">
      <Typography component="dt" variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        component="dd"
        variant="body2"
        fontWeight={emphasized ? 700 : undefined}
        sx={{
          m: 0,
          overflowWrap: 'anywhere',
          whiteSpace: preserveWhitespace ? 'pre-wrap' : undefined,
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}
