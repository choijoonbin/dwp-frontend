import { ProductSurfaceHighRiskCommandDialog } from '../../../../components/product-surface-high-risk-command';
import { usePerformanceCycleCommandExecutors } from '../hooks/use-performance-cycle-command-executors';
import { HrisPerformanceCycleStudio } from './hris-performance-cycle-studio';

import type { PerformanceCycleDataSource } from '../api/performance-cycle-api';

export type HrisPerformanceCycleOperationsWorkspaceProps = Readonly<{
  dataSource?: PerformanceCycleDataSource;
}>;

/** Production route adapter. The reusable studio remains fail-closed without this exact binding. */
export function HrisPerformanceCycleOperationsWorkspace({
  dataSource,
}: HrisPerformanceCycleOperationsWorkspaceProps) {
  const commands = usePerformanceCycleCommandExecutors();
  return (
    <>
      <HrisPerformanceCycleStudio
        dataSource={dataSource}
        commandExecutors={commands.commandExecutors}
      />
      <ProductSurfaceHighRiskCommandDialog controller={commands.publishController} />
    </>
  );
}

export default HrisPerformanceCycleOperationsWorkspace;
