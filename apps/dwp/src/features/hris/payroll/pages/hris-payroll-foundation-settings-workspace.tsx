import { ProductSurfaceHighRiskCommandDialog } from '../../../../components/product-surface-high-risk-command';
import { useProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';
import { payrollFoundationSettingsDataSource } from '../api/payroll-foundation-settings-api';
import { usePayrollFoundationSettingsCommandExecutors } from '../hooks/use-payroll-foundation-settings-command-executors';
import { PayrollFoundationStudio } from './payroll-foundation-studio';

import type { PayrollFoundationDataSource } from '../api/payroll-foundation-api';

export type HrisPayrollFoundationSettingsWorkspaceProps = Readonly<{
  dataSource?: PayrollFoundationDataSource;
}>;

/** HCM-management adapter for the Foundation tab; it never inherits operations authority. */
export function HrisPayrollFoundationSettingsWorkspace({
  dataSource = payrollFoundationSettingsDataSource,
}: HrisPayrollFoundationSettingsWorkspaceProps) {
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.management',
  });
  const commands = usePayrollFoundationSettingsCommandExecutors();

  return (
    <div
      data-testid="hris-payroll-foundation-settings-workspace"
      data-authority-surface="hcm.management"
    >
      <PayrollFoundationStudio
        requestScope={requestScope}
        dataSource={dataSource}
        commandExecutors={commands.commandExecutors}
      />
      <ProductSurfaceHighRiskCommandDialog controller={commands.publishController} />
      <ProductSurfaceHighRiskCommandDialog controller={commands.reverseController} />
    </div>
  );
}

export default HrisPayrollFoundationSettingsWorkspace;
