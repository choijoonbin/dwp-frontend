export type PayrollCalculationCopy = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  loading: string;
  emptyTitle: string;
  emptyDescription: string;
  deniedTitle: string;
  deniedDescription: string;
  unavailableTitle: string;
  unavailableDescription: string;
  partialTitle: string;
  partialDescription: string;
  staleTitle: string;
  staleDescription: string;
  refresh: string;
  lastRefresh: string;
  runs: string;
  runCount: string;
  selected: string;
  inspect: string;
  noSelection: string;
  payPeriod: string;
  runType: string;
  state: string;
  workers: string;
  version: string;
  gross: string;
  net: string;
  commands: string;
  comment: string;
  calculate: string;
  approve: string;
  finalize: string;
  commandGuard: string;
  reviewCalculateTitle: string;
  reviewApproveTitle: string;
  reviewFinalizeTitle: string;
  reviewDescription: string;
  impactTitle: string;
  impactCalculate: string;
  impactApprove: string;
  impactFinalize: string;
  recoveryTitle: string;
  recoveryDescription: string;
  confirm: string;
  cancel: string;
  receipts: string;
  noReceipts: string;
  receipt: string;
  command: string;
  created: string;
  resultReference: string;
  successTitle: string;
  successDescription: string;
  stepUpTitle: string;
  stepUpDescription: string;
  unknownTitle: string;
  unknownDescription: string;
  retryExact: string;
  checkReceipt: string;
  permissionTitle: string;
  permissionDescription: string;
  conflictTitle: string;
  conflictDescription: string;
  rejectedTitle: string;
  rejectedDescription: string;
}>;

export const payrollCalculationCopy: PayrollCalculationCopy = Object.freeze({
  eyebrow: 'HRIS / Payroll operations',
  title: 'Payroll calculation command center',
  description:
    'Review exceptions first, calculate a frozen payroll run, and hand approved evidence to the release officer.',
  loading: 'Loading payroll runs…',
  emptyTitle: 'No payroll runs in this workspace',
  emptyDescription: 'Choose an authorized payroll run to begin operational review.',
  deniedTitle: 'Payroll run access is not authorized',
  deniedDescription:
    'The current surface scope cannot disclose these runs. Cross-scope records remain opaque.',
  unavailableTitle: 'Payroll runs are unavailable',
  unavailableDescription: 'The PAY owner could not return a safe run projection. Try again.',
  partialTitle: 'Some runs could not be disclosed',
  partialDescription:
    'Available evidence remains visible, but commands are paused until every requested run is resolved.',
  staleTitle: 'Payroll evidence may be stale',
  staleDescription: 'Refresh and review the current object version before issuing a command.',
  refresh: 'Refresh evidence',
  lastRefresh: 'Last refresh',
  runs: 'Payroll runs',
  runCount: '{{count}} runs',
  selected: 'Selected',
  inspect: 'Inspect',
  noSelection: 'Select a payroll run to inspect its current owner projection.',
  payPeriod: 'Pay period',
  runType: 'Run type',
  state: 'State',
  workers: 'Workers',
  version: 'Object version',
  gross: 'Gross',
  net: 'Net',
  commands: 'Controlled actions',
  comment: 'Operator comment (optional)',
  calculate: 'Calculate run',
  approve: 'Approve run',
  finalize: 'Finalize payroll',
  commandGuard:
    'Actions use the selected version. Approval and finalization require fresh path-bound step-up and maker-checker authority.',
  reviewCalculateTitle: 'Calculate this payroll run?',
  reviewApproveTitle: 'Approve this calculated payroll?',
  reviewFinalizeTitle: 'Finalize this approved payroll?',
  reviewDescription:
    'Confirm the selected run and object version. The command will be recorded under the current governed scope.',
  impactTitle: 'Impact',
  impactCalculate: 'Creates one calculation attempt from the frozen input snapshot.',
  impactApprove: 'Moves a validated run into the approved state after maker-checker verification.',
  impactFinalize: 'Finalizes monetary facts. Corrections require a new run or successor attempt.',
  recoveryTitle: 'Recovery and audit',
  recoveryDescription:
    'A durable receipt is retained. Unknown outcomes are reconciled before any exact replay.',
  confirm: 'Confirm controlled action',
  cancel: 'Cancel',
  receipts: 'Receipt and recovery evidence',
  noReceipts: 'No command receipt has been observed in this session.',
  receipt: 'Receipt',
  command: 'Command',
  created: 'Created',
  resultReference: 'Result reference',
  successTitle: 'Payroll command completed',
  successDescription: 'The owner returned a bound durable receipt. Run evidence is refreshing.',
  stepUpTitle: 'Verification required',
  stepUpDescription: 'The high-risk command is waiting for exact step-up authority.',
  unknownTitle: 'Command outcome needs reconciliation',
  unknownDescription:
    'No success is assumed and no new command is created. Check the preserved receipt or retry the exact command identity.',
  retryExact: 'Retry exact command',
  checkReceipt: 'Check durable receipt',
  permissionTitle: 'Command not authorized',
  permissionDescription: 'The exact Payroll owner action is unavailable in this scope.',
  conflictTitle: 'Payroll version changed',
  conflictDescription:
    'Refresh before creating another command. The stale command had no side effects.',
  rejectedTitle: 'Payroll command was not completed',
  rejectedDescription: 'No finalized result is inferred. Review the run and receipt evidence.',
});

export function payrollCalculationCopyValue(
  template: string,
  values: Readonly<Record<string, string | number>>
) {
  return Object.entries(values).reduce(
    (current, [key, value]) => current.replace(`{{${key}}}`, String(value)),
    template
  );
}
