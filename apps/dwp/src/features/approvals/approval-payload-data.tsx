import { useTranslation } from 'react-i18next';
import { formatDate, formatNumber, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { isApprovalTypedFormSchema } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import type {
  ApprovalFormField,
  ApprovalFormSchema,
  ApprovalTypedField,
  ApprovalTypedScalarField,
} from '@dwp-frontend/shared-utils';

type ApprovalPayloadDataProps = {
  payload: Record<string, unknown>;
  formSchema?: ApprovalFormSchema;
  hideSystemFields?: boolean;
  labelWidth?: string;
};

type PayloadField = ApprovalFormField | ApprovalTypedField;
type ApprovalLocale = 'ko' | 'en';

function compareKeys(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function orderedEntries(
  record: Record<string, unknown>,
  fields: readonly PayloadField[] = []
): Array<readonly [string, unknown, PayloadField | undefined]> {
  const fieldByKey = new Map(fields.map((field) => [field.key, field]));
  const known = fields
    .filter((field) => Object.prototype.hasOwnProperty.call(record, field.key))
    .map((field) => [field.key, record[field.key], field] as const);
  const unknown = Object.keys(record)
    .filter((key) => !fieldByKey.has(key))
    .sort(compareKeys)
    .map((key) => [key, record[key], undefined] as const);
  return [...known, ...unknown];
}

function formatExactDecimal(value: string, locale: ApprovalLocale) {
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return value;
  const separatorSample = formatNumber(
    1000.1,
    { useGrouping: true, minimumFractionDigits: 1, maximumFractionDigits: 1 },
    locale
  ).replace(/[+\-0-9]/g, '');
  const group = separatorSample[0] ?? ',';
  const decimal = separatorSample.at(-1) ?? '.';
  const integer = match[2].replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return `${match[1]}${integer}${match[3] ? `${decimal}${match[3]}` : ''}`;
}

function formatScalar(value: unknown, field: PayloadField | undefined, locale: ApprovalLocale) {
  if (value == null || value === '') return undefined;
  if (field?.type === 'DATE' && (typeof value === 'string' || typeof value === 'number')) {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime()))
      return formatDate(parsed, { dateStyle: 'medium' }, locale);
  }
  if (
    (field?.type === 'NUMBER' || field?.type === 'CALCULATED_NUMBER') &&
    typeof value === 'string'
  ) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return formatNumber(value, {}, locale);
  if (typeof value === 'string' || typeof value === 'bigint') return String(value);
  return undefined;
}

function structuredMoney(
  value: Record<string, unknown>,
  locale: ApprovalLocale
): string | undefined {
  const keys = Object.keys(value).sort(compareKeys);
  if (keys.length !== 2 || keys[0] !== 'amount' || keys[1] !== 'currency') return undefined;
  const amount = value.amount;
  const currency = value.currency;
  if (
    (typeof amount !== 'number' && typeof amount !== 'string') ||
    typeof currency !== 'string' ||
    !/^[A-Z]{3}$/.test(currency)
  )
    return undefined;
  if (typeof amount === 'number') {
    if (!Number.isFinite(amount)) return undefined;
    try {
      return formatNumber(amount, { style: 'currency', currency, currencyDisplay: 'code' }, locale);
    } catch {
      return `${currency} ${amount}`;
    }
  }
  return `${currency} ${formatExactDecimal(amount, locale)}`;
}

function ApprovalPayloadValue({
  value,
  field,
  locale,
  trueLabel,
  falseLabel,
}: {
  value: unknown;
  field?: PayloadField;
  locale: ApprovalLocale;
  trueLabel: string;
  falseLabel: string;
}) {
  if (value == null || value === '') return <>—</>;
  if (typeof value === 'boolean') return <>{value ? trueLabel : falseLabel}</>;

  const scalar = formatScalar(value, field, locale);
  if (scalar !== undefined) return <>{scalar}</>;

  if (Array.isArray(value)) {
    if (value.length === 0) return <>—</>;
    return (
      <Box component="ul" sx={{ m: 0, pl: 2.25, display: 'grid', gap: 0.5 }}>
        {value.map((item, index) => (
          <Box component="li" key={index} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
            <ApprovalPayloadValue
              value={item}
              locale={locale}
              trueLabel={trueLabel}
              falseLabel={falseLabel}
            />
          </Box>
        ))}
      </Box>
    );
  }

  if (isRecord(value)) {
    const money = structuredMoney(value, locale);
    if (money) return <>{money}</>;
    return (
      <Box component="dl" sx={{ m: 0, display: 'grid', gap: 0.75 }}>
        {orderedEntries(value).map(([key, child]) => (
          <Box
            key={key}
            sx={{
              minWidth: 0,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'minmax(96px, .34fr) minmax(0, 1fr)' },
              gap: { xs: 0.2, sm: 1 },
            }}
          >
            <Typography component="dt" variant="caption" color="text.secondary">
              {key}
            </Typography>
            <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
              <ApprovalPayloadValue
                value={child}
                locale={locale}
                trueLabel={trueLabel}
                falseLabel={falseLabel}
              />
            </Typography>
          </Box>
        ))}
      </Box>
    );
  }

  return <>{String(value)}</>;
}

function ApprovalRepeatingPayload({
  field,
  value,
  korean,
  locale,
  trueLabel,
  falseLabel,
}: {
  field: Extract<ApprovalTypedField, { type: 'REPEATING_GROUP' }>;
  value: unknown;
  korean: boolean;
  locale: ApprovalLocale;
  trueLabel: string;
  falseLabel: string;
}) {
  if (!Array.isArray(value) || value.length === 0)
    return (
      <Typography component="dd" sx={{ m: 0 }}>
        —
      </Typography>
    );
  return (
    <Box component="ol" sx={{ m: 0, p: 0, display: 'grid', gap: 1.25, listStyle: 'none' }}>
      {value.map((row, index) => {
        const record = isRecord(row) ? row : { value: row };
        return (
          <Box
            component="li"
            key={index}
            sx={{ minWidth: 0, pl: 1.25, borderLeft: 2, borderColor: 'divider' }}
          >
            <Typography variant="caption" color="text.secondary">
              {index + 1}
            </Typography>
            <Box component="dl" sx={{ m: 0, mt: 0.5, display: 'grid', gap: 0.75 }}>
              {orderedEntries(record, field.fields).map(([key, childValue, childField]) => (
                <Box key={key} sx={{ minWidth: 0 }}>
                  <Typography component="dt" variant="caption" color="text.secondary">
                    {childField ? (korean ? childField.labelKo : childField.labelEn) : key}
                  </Typography>
                  <Typography
                    component="dd"
                    variant="body2"
                    sx={{ m: 0, overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' }}
                  >
                    <ApprovalPayloadValue
                      value={childValue}
                      field={childField as ApprovalTypedScalarField | undefined}
                      locale={locale}
                      trueLabel={trueLabel}
                      falseLabel={falseLabel}
                    />
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

export function ApprovalPayloadData({
  payload,
  formSchema,
  hideSystemFields = false,
  labelWidth = 'minmax(120px, .4fr)',
}: ApprovalPayloadDataProps) {
  const { t, i18n } = useTranslation('approvals');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const korean = locale === 'ko';
  const schemaFields = formSchema?.fields ?? [];
  const repeatingFields = new Map(
    formSchema && isApprovalTypedFormSchema(formSchema)
      ? formSchema.fields
          .filter((field) => field.type === 'REPEATING_GROUP')
          .map((field) => [field.key, field])
      : []
  );
  const entries = orderedEntries(payload, schemaFields).filter(
    ([key]) => !hideSystemFields || key !== 'createdFrom'
  );
  const trueLabel = t('inbox.payload.booleanTrue');
  const falseLabel = t('inbox.payload.booleanFalse');

  if (entries.length === 0) {
    return (
      <Typography role="status" variant="body2" color="text.secondary">
        {t('inbox.payload.empty')}
      </Typography>
    );
  }

  return (
    <Box component="dl" sx={{ m: 0, display: 'grid' }}>
      {entries.map(([key, value, field]) => (
        <Box
          key={key}
          sx={{
            minWidth: 0,
            py: 1.25,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: `${labelWidth} minmax(0, 1fr)` },
            gap: { xs: 0.35, sm: 2 },
            borderBottom: 1,
            borderColor: 'divider',
            '&:first-of-type': { pt: 0 },
            '&:last-of-type': { pb: 0, borderBottom: 0 },
          }}
        >
          <Typography component="dt" variant="caption" color="text.secondary">
            {field
              ? (korean ? field.labelKo : field.labelEn) || field.key
              : t(`requestFields.${key}`, { defaultValue: key })}
          </Typography>
          {repeatingFields.has(key) ? (
            <ApprovalRepeatingPayload
              field={repeatingFields.get(key)!}
              value={value}
              korean={korean}
              locale={locale}
              trueLabel={trueLabel}
              falseLabel={falseLabel}
            />
          ) : (
            <Typography
              component="dd"
              variant="body2"
              sx={{
                m: 0,
                minWidth: 0,
                overflowWrap: 'anywhere',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <ApprovalPayloadValue
                value={value}
                field={field}
                locale={locale}
                trueLabel={trueLabel}
                falseLabel={falseLabel}
              />
            </Typography>
          )}
        </Box>
      ))}
    </Box>
  );
}
