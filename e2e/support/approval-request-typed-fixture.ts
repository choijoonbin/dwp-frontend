import type { ApprovalTypedFormSchema } from '@dwp-frontend/shared-utils/api/approval-form-typed-contract';

export const APPROVAL_REQUEST_TYPED_TEST_SCHEMA: ApprovalTypedFormSchema = {
  schemaContract: 'DWP_APPROVAL_FORM_TYPED_V2',
  schemaVersion: 2,
  fields: [
    { key: 'summary', type: 'TEXTAREA', labelKo: '요청 내용', labelEn: 'Summary', required: true },
    {
      key: 'category',
      type: 'SELECT',
      labelKo: '분류',
      labelEn: 'Category',
      required: true,
      options: ['STANDARD', 'OTHER'],
    },
    {
      key: 'details',
      type: 'TEXTAREA',
      labelKo: '추가 내용',
      labelEn: 'Additional details',
      required: true,
      visibleWhen: { op: 'EQ', field: 'category', value: 'OTHER' },
    },
    {
      key: 'items',
      type: 'REPEATING_GROUP',
      labelKo: '항목',
      labelEn: 'Items',
      required: true,
      minRows: 1,
      maxRows: 3,
      fields: [
        {
          key: 'quantity',
          type: 'NUMBER',
          labelKo: '수량',
          labelEn: 'Quantity',
          required: true,
          min: '0.00000001',
          max: '1000',
        },
        {
          key: 'price',
          type: 'NUMBER',
          labelKo: '단가',
          labelEn: 'Price',
          required: true,
          min: '0',
          max: '1000000',
        },
        {
          key: 'lineTotal',
          type: 'CALCULATED_NUMBER',
          labelKo: '소계',
          labelEn: 'Line total',
          required: true,
          calculation: {
            op: 'MULTIPLY',
            args: [
              { op: 'FIELD', field: 'quantity' },
              { op: 'FIELD', field: 'price' },
            ],
          },
        },
      ],
    },
    {
      key: 'total',
      type: 'CALCULATED_NUMBER',
      labelKo: '합계',
      labelEn: 'Total',
      required: true,
      calculation: { op: 'SUM', group: 'items', field: 'lineTotal' },
    },
    {
      key: 'justification',
      type: 'TEXT',
      labelKo: '고액 사유',
      labelEn: 'Amount justification',
      requiredWhen: { op: 'GTE', field: 'total', value: '100' },
    },
  ],
};

export const APPROVAL_REQUEST_TYPED_TEST_INPUT = {
  category: 'STANDARD',
  items: [{ quantity: '2.00', price: '10.25' }],
};
