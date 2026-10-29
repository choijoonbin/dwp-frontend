import {
  HCM_CONTROLLED_TRANSFER_MUTATION_API_CONTRACT,
  createControlledTransfer,
} from './administration/operations/api/controlled-transfer-api';
import { HCM_CERTIFICATE_ISSUE_MUTATION_API_CONTRACT } from './employee-services/certificates/certificate-api';
import { HCM_EMPLOYEE_CHANGE_MUTATION_API_CONTRACTS } from './employee-services/employee-change/api/employee-change-api';
import { HCM_EMPLOYMENT_EVENT_MUTATION_API_CONTRACTS } from './employment/assignment-proposal-model';
import { HCM_SEPARATION_CASE_MUTATION_API_CONTRACT } from './employment/separation-case-api';
import { HCM_EXPLORER_MUTATION_API_CONTRACTS } from './explorer/work-explorer-api';
import { HCM_PAYROLL_CALCULATION_MUTATION_API_CONTRACTS } from './payroll/api/payroll-calculation-api';
import { HCM_PAYROLL_RUN_PREPARE_MUTATION_API_CONTRACT } from './payroll/population/payroll-population-api';
import { HCM_COUNTRY_PACK_ACTIVATION_MUTATION_API_CONTRACT } from './payroll/statutory-insurance/statutory-insurance-api';
import { HCM_WORKFORCE_INGESTION_MUTATION_API_CONTRACT } from './people/data-quality/data-quality-api';
import { HCM_EMPLOYMENT_CONTRACT_ISSUE_MUTATION_API_CONTRACT } from './people/contracts-compensation-basis/contracts-compensation-basis-api';
import { HCM_PERFORMANCE_REVIEW_MUTATION_API_CONTRACTS } from './performance/api/performance-review-api';
import { HCM_PERFORMANCE_FEEDBACK_MUTATION_API_CONTRACTS } from './performance/feedback/per008-axios-adapter';
import { HCM_TIMECARD_MUTATION_API_CONTRACTS } from './time/api/timecard-api';
import { HCM_TIME_CLOSE_MUTATION_API_CONTRACTS } from './time/close/api/time-close-api';
import { HCM_TIME_INTERPRETATION_MUTATION_API_CONTRACT } from './time/interpretation/api/time-interpretation-api';

export const HCM_OPERATIONAL_MUTATION_API_CONTRACTS = [
  HCM_CONTROLLED_TRANSFER_MUTATION_API_CONTRACT,
  ...HCM_EMPLOYMENT_EVENT_MUTATION_API_CONTRACTS,
  HCM_CERTIFICATE_ISSUE_MUTATION_API_CONTRACT,
  HCM_COUNTRY_PACK_ACTIVATION_MUTATION_API_CONTRACT,
  ...HCM_EMPLOYEE_CHANGE_MUTATION_API_CONTRACTS,
  HCM_EMPLOYMENT_CONTRACT_ISSUE_MUTATION_API_CONTRACT,
  HCM_PAYROLL_RUN_PREPARE_MUTATION_API_CONTRACT,
  ...HCM_PAYROLL_CALCULATION_MUTATION_API_CONTRACTS,
  HCM_SEPARATION_CASE_MUTATION_API_CONTRACT,
  ...HCM_TIME_CLOSE_MUTATION_API_CONTRACTS,
  HCM_TIME_INTERPRETATION_MUTATION_API_CONTRACT,
  HCM_WORKFORCE_INGESTION_MUTATION_API_CONTRACT,
  ...HCM_PERFORMANCE_REVIEW_MUTATION_API_CONTRACTS,
  ...HCM_PERFORMANCE_FEEDBACK_MUTATION_API_CONTRACTS,
  ...HCM_TIMECARD_MUTATION_API_CONTRACTS,
  ...HCM_EXPLORER_MUTATION_API_CONTRACTS,
] as const;

export function assertHcmOperationalMutationApiRegistry(): void {
  const runtimeContracts: ReadonlyArray<{
    apiFunction: string;
    routeContractKey: string;
    method: string;
    path: string;
  }> = HCM_OPERATIONAL_MUTATION_API_CONTRACTS;
  const apiFunctions = runtimeContracts.map(({ apiFunction }) => apiFunction);
  const routeContractKeys = runtimeContracts.map(({ routeContractKey }) => routeContractKey);
  const invalidContract = runtimeContracts.some(
    ({ method, path, routeContractKey }) =>
      method === 'GET' ||
      !path.startsWith('/api/') ||
      !routeContractKey.startsWith('route.hcm.') ||
      !routeContractKey.endsWith('.action')
  );

  if (
    typeof createControlledTransfer !== 'function' ||
    runtimeContracts.length === 0 ||
    new Set(apiFunctions).size !== apiFunctions.length ||
    new Set(routeContractKeys).size !== routeContractKeys.length ||
    invalidContract
  ) {
    throw new Error('HCM operational mutation API registry is invalid.');
  }
}
