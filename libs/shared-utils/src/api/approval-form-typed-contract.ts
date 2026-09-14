export const APPROVAL_TYPED_FORM_CONTRACT = 'DWP_APPROVAL_FORM_TYPED_V2' as const;

/** Decimal strings are canonical. JSON numbers are accepted only for safe integers. */
export type ApprovalTypedDecimalInput = string | number;

export type ApprovalTypedCalculation =
  | { readonly op: 'CONST'; readonly value: ApprovalTypedDecimalInput }
  | { readonly op: 'FIELD'; readonly field: string }
  | { readonly op: 'SUM'; readonly group: string; readonly field: string }
  | {
      readonly op: 'ADD' | 'SUBTRACT' | 'MULTIPLY' | 'DIVIDE' | 'MIN' | 'MAX';
      readonly args: readonly [ApprovalTypedCalculation, ApprovalTypedCalculation];
    }
  | {
      readonly op: 'ROUND';
      readonly args: readonly [ApprovalTypedCalculation];
      readonly scale: number;
    };

export type ApprovalTypedCondition =
  | { readonly op: 'PRESENT'; readonly field: string }
  | {
      readonly op: 'EQ' | 'NE' | 'GT' | 'GTE' | 'LT' | 'LTE';
      readonly field: string;
      readonly value: ApprovalTypedDecimalInput;
    }
  | {
      readonly op: 'IN';
      readonly field: string;
      readonly values: readonly ApprovalTypedDecimalInput[];
    }
  | { readonly op: 'AND' | 'OR'; readonly args: readonly ApprovalTypedCondition[] }
  | { readonly op: 'NOT'; readonly args: readonly [ApprovalTypedCondition] };

interface ApprovalTypedFieldBase {
  readonly key: string;
  readonly labelKo: string;
  readonly labelEn: string;
  readonly helpKo?: string | null;
  readonly helpEn?: string | null;
  readonly required?: boolean;
  readonly visibleWhen?: ApprovalTypedCondition | null;
  readonly requiredWhen?: ApprovalTypedCondition | null;
}

export type ApprovalTypedScalarField = ApprovalTypedFieldBase &
  (
    | {
        readonly type: 'TEXT' | 'TEXTAREA' | 'USER';
        readonly minLength?: number;
        readonly maxLength?: number;
      }
    | { readonly type: 'DATE' }
    | { readonly type: 'SELECT'; readonly options: readonly string[] }
    | {
        readonly type: 'NUMBER';
        readonly min?: ApprovalTypedDecimalInput;
        readonly max?: ApprovalTypedDecimalInput;
      }
    | {
        readonly type: 'CALCULATED_NUMBER';
        readonly calculation: ApprovalTypedCalculation;
        readonly min?: ApprovalTypedDecimalInput;
        readonly max?: ApprovalTypedDecimalInput;
      }
  );

export type ApprovalTypedField =
  | ApprovalTypedScalarField
  | (ApprovalTypedFieldBase & {
      readonly type: 'REPEATING_GROUP';
      readonly fields: readonly ApprovalTypedScalarField[];
      readonly minRows?: number;
      readonly maxRows?: number;
    });

export interface ApprovalTypedFormSchema {
  readonly schemaContract: typeof APPROVAL_TYPED_FORM_CONTRACT;
  readonly schemaVersion: 2;
  readonly fields: readonly ApprovalTypedField[];
}

export interface ApprovalTypedFormEvaluation {
  readonly payload: Readonly<Record<string, unknown>>;
  readonly visibleFields: readonly string[];
  readonly requiredFields: readonly string[];
  readonly schemaSha256: string;
}
