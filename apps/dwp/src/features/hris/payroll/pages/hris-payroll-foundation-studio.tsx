import { useProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';
import { PayrollFoundationStudio } from './payroll-foundation-studio';

import type { PayrollFoundationDataSource } from '../api/payroll-foundation-api';
import type { PayrollFoundationCommandExecutors } from '../hooks/use-payroll-foundation-studio';

/**
 * Route-bound adapter for the payroll operations workbench.
 *
 * The reusable studio deliberately accepts an explicit scope so it can also be
 * exercised in isolation.  Production operations routes must never inherit the
 * personal-pay surface, however: their reads and cache partition are bound to
 * the governed HCM operations decision here.
 */
export type HrisPayrollFoundationStudioProps = Readonly<{
  dataSource?: PayrollFoundationDataSource;
  commandExecutors?: PayrollFoundationCommandExecutors;
}>;

export function HrisPayrollFoundationStudio({
  dataSource,
  commandExecutors,
}: HrisPayrollFoundationStudioProps) {
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.operations',
  });

  return (
    <PayrollFoundationStudio
      requestScope={requestScope}
      dataSource={dataSource}
      commandExecutors={commandExecutors}
    />
  );
}

export default HrisPayrollFoundationStudio;
