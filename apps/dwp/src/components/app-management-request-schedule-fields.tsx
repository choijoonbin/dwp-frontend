import { useTranslation } from 'react-i18next';
import { DateTimePickerField } from '@dwp-frontend/design-system/enterprise/date-time/date-picker-field';

export function AppManagementRequestScheduleFields({
  validTo,
  reviewDueAt,
  invalidValidity,
  invalidReview,
  onValidToChange,
  onReviewDueAtChange,
}: {
  validTo: string;
  reviewDueAt: string;
  invalidValidity: boolean;
  invalidReview: boolean;
  onValidToChange: (value: string) => void;
  onReviewDueAtChange: (value: string) => void;
}) {
  const { t } = useTranslation('work');

  return (
    <>
      <DateTimePickerField
        required
        label={t('appsPage.managementRequest.validTo')}
        value={validTo || null}
        onValueChange={(value) => onValidToChange(value ?? '')}
        errorMessage={
          invalidValidity ? t('appsPage.managementRequest.validityFutureError') : undefined
        }
      />
      <DateTimePickerField
        required
        label={t('appsPage.managementRequest.reviewDueAt')}
        value={reviewDueAt || null}
        onValueChange={(value) => onReviewDueAtChange(value ?? '')}
        errorMessage={invalidReview ? t('appsPage.managementRequest.reviewWindowError') : undefined}
      />
    </>
  );
}
