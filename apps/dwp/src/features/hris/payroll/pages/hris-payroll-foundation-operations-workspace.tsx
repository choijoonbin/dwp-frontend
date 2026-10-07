import { ProductSurfaceHighRiskCommandDialog } from '../../../../components/product-surface-high-risk-command';
import { usePayrollFoundationCommandExecutors } from '../hooks/use-payroll-foundation-command-executors';
import { HrisPayrollFoundationStudio } from './hris-payroll-foundation-studio';

import type { PayrollFoundationDataSource } from '../api/payroll-foundation-api';

export type HrisPayrollFoundationOperationsWorkspaceProps = Readonly<{
  dataSource?: PayrollFoundationDataSource;
}>;

/** Production route adapter. The reusable studio remains fail-closed without this exact binding. */
export function HrisPayrollFoundationOperationsWorkspace({
  dataSource,
}: HrisPayrollFoundationOperationsWorkspaceProps) {
  const commands = usePayrollFoundationCommandExecutors();
  return (
    <>
      <HrisPayrollFoundationStudio
        dataSource={dataSource}
        commandExecutors={commands.commandExecutors}
      />
      <ProductSurfaceHighRiskCommandDialog controller={commands.publishController} />
      <ProductSurfaceHighRiskCommandDialog controller={commands.reverseController} />
    </>
  );
}

export default HrisPayrollFoundationOperationsWorkspace;
