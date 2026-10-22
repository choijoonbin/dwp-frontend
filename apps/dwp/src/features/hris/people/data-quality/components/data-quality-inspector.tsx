import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { DetailInspector } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { HRM012_QUERY_CONTRACT } from '../data-quality-contract';

import type { Hrm012Copy } from '../data-quality-copy';
import type {
  Hrm012AuditValue,
  Hrm012FieldDecision,
  Hrm012Item,
  Hrm012ReceiptValue,
  Hrm012StatusValue,
} from '../data-quality-contract';

type FieldGroup = (typeof HRM012_QUERY_CONTRACT.fieldGroups)[number];

function DetailValue({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <Box component="div" sx={{ minWidth: 0 }}>
      <Typography component="dt" variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        component="dd"
        variant="body2"
        fontWeight={650}
        sx={{ m: 0, mt: 0.25, overflowWrap: 'anywhere' }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function viewedValue(
  group: FieldGroup,
  decision: Extract<Hrm012FieldDecision, { decision: 'VIEW' }>,
  copy: Hrm012Copy,
  locale: string,
  timeZone: string
) {
  if (group === 'INGESTION_STATUS') {
    const value = decision.value as Hrm012StatusValue;
    return (
      <Stack component="dl" gap={1} sx={{ m: 0 }}>
        <DetailValue label={copy.code} value={value.code.replaceAll('_', ' ')} />
        <DetailValue label={copy.revision} value={String(value.revision)} />
      </Stack>
    );
  }
  if (group === 'QUALITY_FINDING') {
    const value = decision.value as Hrm012AuditValue;
    return (
      <Stack component="dl" gap={1} sx={{ m: 0 }}>
        <DetailValue label={copy.code} value={value.decisionCode.replaceAll('_', ' ')} />
        <DetailValue
          label={copy.occurredAt}
          value={formatDate(
            value.occurredAt,
            { dateStyle: 'medium', timeStyle: 'short', timeZone },
            resolveSupportedLocale(locale)
          )}
        />
        <DetailValue label={copy.revision} value={String(value.revision)} />
        <DetailValue label={copy.evidenceDigest} value={value.evidenceDigest} />
      </Stack>
    );
  }
  const value = decision.value as Hrm012ReceiptValue;
  return (
    <Stack component="dl" gap={1} sx={{ m: 0 }}>
      <DetailValue label={copy.receiptId} value={value.receiptId} />
      <DetailValue label={copy.state} value={value.state.replaceAll('_', ' ')} />
      <DetailValue
        label={copy.occurredAt}
        value={formatDate(
          value.occurredAt,
          { dateStyle: 'medium', timeStyle: 'short', timeZone },
          resolveSupportedLocale(locale)
        )}
      />
      <DetailValue label={copy.revision} value={String(value.revision)} />
    </Stack>
  );
}

function FieldDecisionCard({
  group,
  decision,
  copy,
  locale,
  timeZone,
}: Readonly<{
  group: FieldGroup;
  decision: Hrm012FieldDecision;
  copy: Hrm012Copy;
  locale: string;
  timeZone: string;
}>) {
  return (
    <Paper component="section" variant="outlined" sx={{ p: 1.5, minWidth: 0 }}>
      <Typography component="h3" variant="subtitle2" fontWeight={750}>
        {copy.fieldLabels[group]}
      </Typography>
      <Divider sx={{ my: 1 }} />
      {decision.decision === 'MASK' ? (
        <Typography variant="body2" color="text.secondary">
          {copy.masked}
        </Typography>
      ) : (
        viewedValue(group, decision, copy, locale, timeZone)
      )}
    </Paper>
  );
}

export function DataQualityInspector({
  item,
  copy,
  locale,
  timeZone,
  variant,
  onClose,
  onPrevious,
  onNext,
  previousDisabled,
  nextDisabled,
}: Readonly<{
  item: Hrm012Item | null;
  copy: Hrm012Copy;
  locale: string;
  timeZone: string;
  variant: 'inline' | 'drawer';
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
}>) {
  return (
    <DetailInspector
      variant={variant}
      width={480}
      open={item !== null}
      title={item?.title ?? copy.title}
      subtitle={item?.itemPublicId}
      closeLabel={copy.inspectorClose}
      onClose={onClose}
      previousLabel={copy.previousItem}
      nextLabel={copy.nextItem}
      onPrevious={onPrevious}
      onNext={onNext}
      previousDisabled={previousDisabled}
      nextDisabled={nextDisabled}
      status={item ? <Chip size="small" variant="outlined" label={item.statusCode} /> : undefined}
    >
      {item ? (
        <Stack
          gap={1.25}
          data-testid="hrm-012-data-quality-inspector"
          data-governed-deep-link={`${item.deepLink.route}?tab=overview&focus=${encodeURIComponent(
            item.deepLink.resourcePublicId
          )}`}
        >
          {HRM012_QUERY_CONTRACT.fieldGroups.flatMap((group) => {
            const decision = item.fieldGroups[group];
            return decision
              ? [
                  <FieldDecisionCard
                    key={group}
                    group={group}
                    decision={decision}
                    copy={copy}
                    locale={locale}
                    timeZone={timeZone}
                  />,
                ]
              : [];
          })}
        </Stack>
      ) : null}
    </DetailInspector>
  );
}
