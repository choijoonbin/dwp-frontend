import { FormField } from '@dwp-frontend/design-system';

export function ApprovalFormIntegerField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number | undefined;
  min: number;
  max: number;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <FormField
      size="small"
      type="number"
      label={label}
      value={value ?? ''}
      slotProps={{ htmlInput: { min, max, step: 1 } }}
      onChange={(event) => {
        if (event.target.value === '') {
          onChange(undefined);
          return;
        }
        if (!(event.target instanceof HTMLInputElement)) return;
        const next = event.target.valueAsNumber;
        if (Number.isSafeInteger(next) && next >= min && next <= max) onChange(next);
      }}
    />
  );
}
