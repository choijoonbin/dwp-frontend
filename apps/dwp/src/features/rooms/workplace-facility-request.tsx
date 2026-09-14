import { useWorkplaceExperienceAuthority } from './workplace-experience-authority';
import { InlineFeedback } from '@dwp-frontend/design-system';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ActionButton, FormDialog, FormField, SelectField } from '@dwp-frontend/design-system';
import { createWorkplaceFacilityRequest, HttpError } from '@dwp-frontend/shared-utils';
import type {
  WorkplaceFacilityCategory,
  WorkplaceFacilityRequest,
} from '@dwp-frontend/shared-utils';
import Stack from '@mui/material/Stack';
import { useRoomsCapabilities } from './rooms-capabilities';

type Submission = {
  scope: string;
  generation: number;
  resourceId: string;
  key: string;
  category: WorkplaceFacilityCategory;
  description: string;
};
export function WorkplaceFacilityRequestDialog({
  resourceId,
  resourceName,
  onClose,
}: {
  resourceId: string | null;
  resourceName: string;
  onClose: () => void;
}) {
  const { t } = useTranslation('rooms');
  const authorityKey = useWorkplaceExperienceAuthority();
  const capabilities = useRoomsCapabilities();
  const queryClient = useQueryClient();
  const scope = `${authorityKey}:${resourceId}`;
  const activeScope = useRef(scope);
  activeScope.current = scope;
  const commandContext = useRef({ scope, generation: 0 });
  if (commandContext.current.scope !== scope)
    commandContext.current = { scope, generation: commandContext.current.generation + 1 };
  const inFlight = useRef<Submission | null>(null);
  useEffect(
    () => () => {
      commandContext.current.generation += 1;
      inFlight.current = null;
    },
    []
  );
  const [category, setCategory] = useState<WorkplaceFacilityCategory>('REPAIR');
  const [description, setDescription] = useState('');
  const [retrySubmission, setRetrySubmission] = useState<Submission | null>(null);
  const [saved, setSaved] = useState<WorkplaceFacilityRequest | null>(null);
  const canSubmit =
    capabilities.isLoaded &&
    capabilities.canViewWorkplace &&
    capabilities.canCreateWorkplaceBooking &&
    Boolean(resourceId);
  const matchesSubmission = (submission: Submission) =>
    submission.scope === activeScope.current &&
    submission.generation === commandContext.current.generation;
  const mutation = useMutation({
    mutationFn: async (submission: Submission) => {
      if (!canSubmit || !matchesSubmission(submission))
        throw new Error('Facility request scope changed');
      return createWorkplaceFacilityRequest(
        submission.resourceId,
        { category: submission.category, description: submission.description },
        submission.key
      );
    },
    onSuccess: (result, submission) => {
      if (!matchesSubmission(submission)) return;
      setSaved(result);
      setRetrySubmission(null);
      void queryClient.invalidateQueries({ queryKey: ['workplace', 'facility-requests'] });
    },
    onError: (error, submission) => {
      if (!matchesSubmission(submission)) return;
      if (!(error instanceof HttpError) || ![400, 401, 403, 404].includes(error.status))
        setRetrySubmission(submission);
    },
    onSettled: (_data, _error, submission) => {
      if (inFlight.current === submission) inFlight.current = null;
    },
  });
  const resetMutation = mutation.reset;
  useEffect(() => {
    setCategory('REPAIR');
    setDescription('');
    setRetrySubmission(null);
    setSaved(null);
    resetMutation();
  }, [scope, resetMutation]);
  const dispatch = (submission: Submission) => {
    if (inFlight.current) return;
    inFlight.current = submission;
    mutation.mutate(submission);
  };
  const frozen = mutation.isPending || Boolean(retrySubmission) || Boolean(saved);
  return (
    <FormDialog
      open={Boolean(resourceId)}
      title={t('workplace.experience.request')}
      description={resourceName}
      submitLabel={t('workplace.experience.requestSubmit')}
      cancelLabel={t('actions.close')}
      onClose={onClose}
      submitDisabled={
        !canSubmit || frozen || description.trim().length < 1 || description.trim().length > 2000
      }
      busy={mutation.isPending}
      onSubmit={() =>
        dispatch({
          scope,
          generation: commandContext.current.generation,
          resourceId: resourceId!,
          key: crypto.randomUUID(),
          category,
          description: description.trim(),
        })
      }
      mobileFullScreen
    >
      <Stack gap={2}>
        <InlineFeedback severity="info">
          {t('workplace.experience.requestDescription')}
        </InlineFeedback>
        {saved ? (
          <InlineFeedback severity="success">
            {t('workplace.experience.requestSaved')} · {saved.requestId}
          </InlineFeedback>
        ) : null}
        {mutation.isError ? (
          <InlineFeedback severity="error">
            {t(
              retrySubmission
                ? 'workplace.experience.changeUnknown'
                : 'workplace.experience.permissionChanged'
            )}
          </InlineFeedback>
        ) : null}
        <SelectField
          label={t('workplace.experience.category')}
          value={category}
          disabled={!canSubmit || frozen}
          options={(['REPAIR', 'CLEANING', 'ACCESS', 'OTHER'] as const).map((value) => ({
            value,
            label: t(`workplace.experience.requestCategories.${value}`),
          }))}
          onValueChange={(value) => setCategory(value as WorkplaceFacilityCategory)}
        />
        <FormField
          required
          multiline
          minRows={4}
          label={t('workplace.experience.description')}
          value={description}
          inputProps={{ maxLength: 2000 }}
          disabled={!canSubmit || frozen}
          onChange={(event) => setDescription(event.target.value)}
        />
        {retrySubmission ? (
          <ActionButton
            intent="secondary"
            disabled={!canSubmit || mutation.isPending}
            onClick={() => dispatch(retrySubmission)}
          >
            {t('workplace.experience.sameRequestRetry')}
          </ActionButton>
        ) : null}
      </Stack>
    </FormDialog>
  );
}
