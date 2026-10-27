import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { DetailInspector } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { PAY004_FIELD_GROUPS } from '../retirement-contract';

import type { Pay004Copy } from '../retirement-copy';
import type {
  Pay004FieldDecision,
  Pay004MoneyValue,
  Pay004PolicyValue,
  Pay004RetirementItem,
  Pay004StatusValue,
} from '../retirement-contract';

type FieldGroup = (typeof PAY004_FIELD_GROUPS)[number];

function DetailValue({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <Box component="div" sx={{ minWidth: 0 }}>
      <Typography component="dt" variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        component="dd"
        variant="body2"
        fontWeight="subtitle2.fontWeight"
        sx={{ m: 0, mt: 0.25, overflowWrap: 'anywhere' }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function ViewedDecision({
  group,
  decision,
  copy,
  locale,
}: Readonly<{
  group: FieldGroup;
  decision: Extract<Pay004FieldDecision, { decision: 'VIEW' }>;
  copy: Pay004Copy;
  locale: string;
}>) {
  if (group === 'RETIREMENT_RESULT') {
    const value = decision.value as Pay004MoneyValue;
    return (
      <Stack component="dl" gap={1} sx={{ m: 0 }}>
        <DetailValue label={copy.amount} value={value.amount} />
        <DetailValue label={copy.currency} value={value.currency} />
      </Stack>
    );
  }
  if (group === 'POLICY_VERSION') {
    const value = decision.value as Pay004PolicyValue;
    const format = (date: string) =>
      formatDate(
        `${date}T00:00:00Z`,
        { dateStyle: 'medium', timeZone: 'UTC' },
        resolveSupportedLocale(locale)
      );
    return (
      <Stack component="dl" gap={1} sx={{ m: 0 }}>
        <DetailValue label={copy.policyKey} value={value.policyKey} />
        <DetailValue label={copy.revision} value={String(value.revision)} />
        <DetailValue label={copy.effectiveFrom} value={format(value.effectiveFrom)} />
        <DetailValue
          label={copy.effectiveTo}
          value={value.effectiveTo ? format(value.effectiveTo) : '—'}
        />
        <DetailValue label={copy.status} value={value.status.replaceAll('_', ' ')} />
      </Stack>
    );
  }
  const value = decision.value as Pay004StatusValue;
  return (
    <Stack component="dl" gap={1} sx={{ m: 0 }}>
      <DetailValue label={copy.status} value={value.code.replaceAll('_', ' ')} />
      <DetailValue label={copy.revision} value={String(value.revision)} />
    </Stack>
  );
}

function DecisionCard({
  group,
  decision,
  copy,
  locale,
}: Readonly<{
  group: FieldGroup;
  decision: Pay004FieldDecision;
  copy: Pay004Copy;
  locale: string;
}>) {
  return (
    <Paper component="section" variant="outlined" sx={{ p: 1.5, minWidth: 0 }}>
      <Typography component="h3" variant="subtitle2" fontWeight="fontWeightBold">
        {copy.fieldLabels[group]}
      </Typography>
      <Divider sx={{ my: 1 }} />
      {decision.decision === 'MASK' ? (
        <Typography variant="body2" color="text.secondary">
          {copy.masked}
        </Typography>
      ) : (
        <ViewedDecision group={group} decision={decision} copy={copy} locale={locale} />
      )}
    </Paper>
  );
}

export function RetirementInspector({
  item,
  copy,
  locale,
  variant,
  onClose,
  onPrevious,
  onNext,
  previousDisabled,
  nextDisabled,
}: Readonly<{
  item: Pay004RetirementItem | null;
  copy: Pay004Copy;
  locale: string;
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
          data-testid="pay-004-retirement-inspector"
          data-governed-deep-link={`${item.deepLink.route}?tab=overview&focus=${encodeURIComponent(
            item.deepLink.resourcePublicId
          )}`}
          data-available-actions={item.availableActions.length}
        >
          {PAY004_FIELD_GROUPS.flatMap((group) => {
            const decision = item.fieldGroups[group];
            return decision
              ? [
                  <DecisionCard
                    key={group}
                    group={group}
                    decision={decision}
                    copy={copy}
                    locale={locale}
                  />,
                ]
              : [];
          })}
        </Stack>
      ) : null}
    </DetailInspector>
  );
}
