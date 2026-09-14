import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FormField, InlineFeedback } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ApprovalRequestDynamicFields } from './approval-request-dynamic-fields';
import { ApprovalRequestTypedFields } from './approval-request-typed-fields';

import type { ApprovalFormField } from '@dwp-frontend/shared-utils';
import type { useApprovalRequestFormEvaluation } from './use-approval-request-form-evaluation';
import type {
  ApprovalRequestUserContext,
  ApprovalRequestUserSourceState,
} from './approval-request-user-picker';

type ApprovalInformationResponseFieldsProps = {
  responseMessage: string;
  responsePayload: Record<string, unknown>;
  responseFields: ApprovalFormField[];
  detailReady: boolean;
  evaluation: ReturnType<typeof useApprovalRequestFormEvaluation>;
  disabled?: boolean;
  verifyOnlyUserValues?: boolean;
  korean: boolean;
  detailStatus?: ReactNode;
  onResponseMessageChange: (value: string) => void;
  onResponsePayloadChange: (key: string, value: unknown) => void;
  userBinding?: ApprovalRequestUserContext;
  onUserSourceReadyChange?: (
    path: string,
    value: unknown,
    state: ApprovalRequestUserSourceState
  ) => void;
};

export function ApprovalInformationResponseFields({
  responseMessage,
  responsePayload,
  responseFields,
  detailReady,
  evaluation,
  disabled,
  verifyOnlyUserValues,
  korean,
  detailStatus,
  onResponseMessageChange,
  onResponsePayloadChange,
  userBinding,
  onUserSourceReadyChange,
}: ApprovalInformationResponseFieldsProps) {
  const { t } = useTranslation('approvals');

  return (
    <Stack gap={2}>
      <FormField
        autoFocus
        required
        multiline
        minRows={4}
        label={t('requests.responseLabel')}
        supportingText={t('requests.responseHelp')}
        value={responseMessage}
        disabled={disabled}
        onChange={(event) => onResponseMessageChange(event.target.value)}
        inputProps={{ maxLength: 2000 }}
      />
      <Box>
        <Typography component="h3" variant="subtitle2">
          {t('requests.amendmentTitle')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('requests.amendmentHelp')}
        </Typography>
      </Box>
      {detailStatus}
      {evaluation.problemKey && (
        <InlineFeedback severity="warning">{t(evaluation.problemKey)}</InlineFeedback>
      )}
      {detailReady &&
        (evaluation.compiled ? (
          <ApprovalRequestTypedFields
            compiled={evaluation.compiled}
            evaluation={evaluation.draftEvaluation}
            values={responsePayload}
            korean={korean}
            disabled={disabled}
            verifyOnlyUserValues={verifyOnlyUserValues}
            onChange={onResponsePayloadChange}
            includeSummary
            userBinding={userBinding}
            onUserSourceReadyChange={onUserSourceReadyChange}
          />
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 1.25,
            }}
          >
            <ApprovalRequestDynamicFields
              fields={responseFields}
              values={evaluation.legacyValues}
              korean={korean}
              idPrefix="approval-amendment"
              disabled={disabled}
              onChange={onResponsePayloadChange}
            />
          </Box>
        ))}
    </Stack>
  );
}
