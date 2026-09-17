import { axiosInstance } from '../axios-instance';
import { HttpError } from '../http-error';

import type { ApiResponse } from '../types';
import {
  assertAgentRevision,
  assertAgentUuid,
  isAgentDate,
  isAgentRecord,
} from './agent-governed-api';
import {
  productSurfaceHighRiskMutationConfig,
  type ProductSurfaceGovernedMutationAuthority,
} from './product-surface-governed-mutation';

export type DwaionPersonalDataEvidenceAction =
  'BACKUP_LEDGER' | 'SRE_ESCALATION' | 'LEGAL_HOLD_APPEAL' | 'SIGNED_CERTIFICATE' | 'SIEM_SYNC';

export type DwaionPersonalDataEvidenceCommand = {
  commandId: string;
  deletionJobId: string;
  action: DwaionPersonalDataEvidenceAction;
  state: 'PENDING' | 'COMPLETED' | 'FAILED';
  expectedRevision: number;
  receiptId: string | null;
  providerReceiptId: string | null;
  resultFingerprint: string | null;
  result: Record<string, unknown> | null;
  safeErrorCode: string | null;
  recoveryHint: string | null;
  downloadAvailable: boolean;
  createdAt: string;
  completedAt: string | null;
};

export function buildDwaionBackupLedgerSnapshot(command: DwaionPersonalDataEvidenceCommand): Blob {
  if (
    command.action !== 'BACKUP_LEDGER' ||
    command.state !== 'COMPLETED' ||
    !command.result ||
    !validCompletedResult(command.action, command.result) ||
    !command.receiptId ||
    !command.providerReceiptId ||
    !command.resultFingerprint
  ) {
    throw new HttpError('Backup-ledger evidence is incomplete.', 502, command);
  }
  return new Blob(
    [
      JSON.stringify(
        {
          schema: 'dwp.personal-data.backup-ledger-snapshot.v1',
          deletionJobId: command.deletionJobId,
          commandId: command.commandId,
          receiptId: command.receiptId,
          providerReceiptId: command.providerReceiptId,
          resultFingerprint: command.resultFingerprint,
          completedAt: command.completedAt,
          result: command.result,
        },
        null,
        2
      ),
    ],
    { type: 'application/json' }
  );
}

const LEGACY_AUTHORITY = { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/u;
const SAFE_CODE = /^[A-Z][A-Z0-9_.-]{1,127}$/u;

export async function executeDwaionPersonalDataEvidenceAction(
  deletionJobId: string,
  expectedRevision: number,
  action: DwaionPersonalDataEvidenceAction,
  commandId: string,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionPersonalDataEvidenceCommand> {
  assertAgentUuid(deletionJobId, 'Deletion evidence job');
  assertAgentUuid(commandId, 'Deletion evidence command');
  assertAgentRevision(expectedRevision, 'Deletion evidence revision', 0);
  const response = await axiosInstance.post<ApiResponse<unknown>, object>(
    `/api/agent/v1/personal-data/deletions/${encodeURIComponent(deletionJobId)}/evidence-actions/${action}`,
    {
      commandId,
      expectedRevision,
      reasonCode: `USER_${action}`,
      changeReason: actionReason(action),
      parameters: actionParameters(action),
    },
    productSurfaceHighRiskMutationConfig(authority, { objectVersionHeader: true })
  );
  return parseDwaionPersonalDataEvidenceCommand(response.data.data, deletionJobId, commandId);
}

export async function getDwaionPersonalDataEvidenceAction(
  deletionJobId: string,
  commandId: string,
  signal?: AbortSignal
): Promise<DwaionPersonalDataEvidenceCommand> {
  assertAgentUuid(deletionJobId, 'Deletion evidence job');
  assertAgentUuid(commandId, 'Deletion evidence command');
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `/api/agent/v1/personal-data/deletions/${encodeURIComponent(deletionJobId)}/evidence-actions/${encodeURIComponent(commandId)}`,
    { signal }
  );
  return parseDwaionPersonalDataEvidenceCommand(response.data.data, deletionJobId, commandId);
}

export function downloadDwaionPersonalDataReceiptIndex(): Promise<Blob> {
  return download(
    '/api/agent/v1/personal-data/deletions/evidence/receipt-index.json',
    'application/json'
  );
}

export function downloadDwaionPersonalDataLegalHoldEvidence(deletionJobId: string): Promise<Blob> {
  assertAgentUuid(deletionJobId, 'Deletion evidence job');
  return download(
    `/api/agent/v1/personal-data/deletions/${encodeURIComponent(deletionJobId)}/evidence/legal-hold.json`,
    'application/json'
  );
}

export function downloadDwaionPersonalDataCertificate(
  deletionJobId: string,
  commandId: string
): Promise<Blob> {
  assertAgentUuid(deletionJobId, 'Deletion evidence job');
  assertAgentUuid(commandId, 'Deletion evidence command');
  return download(
    `/api/agent/v1/personal-data/deletions/${encodeURIComponent(deletionJobId)}/evidence-actions/${encodeURIComponent(commandId)}/download`,
    'application/pdf'
  );
}

export function parseDwaionPersonalDataEvidenceCommand(
  value: unknown,
  deletionJobId?: string,
  commandId?: string
): DwaionPersonalDataEvidenceCommand {
  if (
    !isAgentRecord(value) ||
    !uuid(value.commandId) ||
    !uuid(value.deletionJobId) ||
    !ACTIONS.has(value.action as DwaionPersonalDataEvidenceAction) ||
    !STATES.has(String(value.state)) ||
    !Number.isSafeInteger(value.expectedRevision) ||
    Number(value.expectedRevision) < 0 ||
    !nullableUuid(value.receiptId) ||
    !(value.providerReceiptId === null || nonempty(value.providerReceiptId, 240)) ||
    !(value.resultFingerprint === null || sha(value.resultFingerprint)) ||
    !(value.result === null || isAgentRecord(value.result)) ||
    !(value.safeErrorCode === null || safeCode(value.safeErrorCode)) ||
    !(value.recoveryHint === null || nonempty(value.recoveryHint, 1_000)) ||
    typeof value.downloadAvailable !== 'boolean' ||
    !isAgentDate(value.createdAt) ||
    !(value.completedAt === null || isAgentDate(value.completedAt)) ||
    (deletionJobId !== undefined && value.deletionJobId !== deletionJobId) ||
    (commandId !== undefined && value.commandId !== commandId)
  ) {
    throw new HttpError('Personal-data evidence command response is invalid.', 502, value);
  }
  const command = value as DwaionPersonalDataEvidenceCommand;
  if (
    (command.state === 'PENDING' &&
      (command.receiptId !== null ||
        command.providerReceiptId !== null ||
        command.resultFingerprint !== null ||
        command.result !== null ||
        command.safeErrorCode !== null ||
        command.recoveryHint !== null ||
        command.completedAt !== null ||
        command.downloadAvailable)) ||
    (command.state === 'COMPLETED' &&
      (command.receiptId === null ||
        command.providerReceiptId === null ||
        command.resultFingerprint === null ||
        command.result === null ||
        command.safeErrorCode !== null ||
        command.recoveryHint !== null ||
        command.completedAt === null)) ||
    (command.state === 'FAILED' &&
      (command.receiptId === null ||
        command.resultFingerprint === null ||
        command.result === null ||
        command.safeErrorCode === null ||
        command.recoveryHint === null ||
        command.completedAt === null ||
        command.downloadAvailable)) ||
    command.downloadAvailable !==
      (command.state === 'COMPLETED' && command.action === 'SIGNED_CERTIFICATE')
  ) {
    throw new HttpError('Personal-data evidence terminal receipt is invalid.', 502, value);
  }
  if (
    command.state === 'COMPLETED' &&
    (!command.result || !validCompletedResult(command.action, command.result))
  ) {
    throw new HttpError('Personal-data evidence effect receipt is invalid.', 502, value);
  }
  return command;
}

async function download(path: string, accept: string): Promise<Blob> {
  const response = await axiosInstance.get<Blob>(path, {
    responseType: 'blob',
    headers: { Accept: accept },
  });
  if (!(response.data instanceof Blob) || response.data.size < 1) {
    throw new HttpError('Personal-data evidence download is empty or invalid.', 502);
  }
  return response.data;
}

function actionReason(action: DwaionPersonalDataEvidenceAction): string {
  return {
    BACKUP_LEDGER: 'The user requested the governed backup destruction ledger for this deletion.',
    SRE_ESCALATION: 'The user requested audited SRE assistance for the delayed deletion pipeline.',
    LEGAL_HOLD_APPEAL: 'The user requested a governed explanation and appeal for the legal hold.',
    SIGNED_CERTIFICATE:
      'The user requested a signed destruction certificate for completed deletion.',
    SIEM_SYNC: 'The user requested an audited SIEM synchronization of deletion evidence.',
  }[action];
}

function uuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

function nullableUuid(value: unknown): value is string | null {
  return value === null || uuid(value);
}

function sha(value: unknown): value is string {
  return typeof value === 'string' && SHA256.test(value);
}

function safeCode(value: unknown): value is string {
  return typeof value === 'string' && SAFE_CODE.test(value);
}

function nonempty(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maximum;
}

function validCompletedResult(
  action: DwaionPersonalDataEvidenceAction,
  value: Record<string, unknown>
): boolean {
  switch (action) {
    case 'BACKUP_LEDGER': {
      const destroyed = stringArray(value.destroyedPartitionIds, true);
      const retained = stringArray(value.retainedPartitionIds, true);
      const entries = stringArray(value.ledgerEntryIds, false);
      return (
        value.schemaVersion === 1 &&
        nonempty(value.ledgerScope, 120) &&
        destroyed !== null &&
        retained !== null &&
        destroyed.length + retained.length > 0 &&
        !destroyed.some((partition) => retained.includes(partition)) &&
        entries !== null &&
        isAgentDate(value.observedAt)
      );
    }
    case 'SRE_ESCALATION':
      return (
        value.schemaVersion === 1 &&
        nonempty(value.caseId, 240) &&
        nonempty(value.queue, 240) &&
        ['P0', 'P1', 'P2', 'P3', 'P4'].includes(String(value.severity)) &&
        value.state === 'ACCEPTED' &&
        isAgentDate(value.acceptedAt)
      );
    case 'LEGAL_HOLD_APPEAL':
      return (
        value.schemaVersion === 1 &&
        nonempty(value.holdId, 240) &&
        nonempty(value.appealId, 240) &&
        sha(value.requestParametersSha256) &&
        value.state === 'SUBMITTED' &&
        isAgentDate(value.submittedAt)
      );
    case 'SIEM_SYNC':
      return (
        value.schemaVersion === 1 &&
        nonempty(value.syncId, 240) &&
        nonempty(value.destination, 240) &&
        Number.isSafeInteger(value.acceptedEventCount) &&
        Number(value.acceptedEventCount) >= 1 &&
        sha(value.sourceDigest) &&
        isAgentDate(value.acceptedAt)
      );
    case 'SIGNED_CERTIFICATE':
      return (
        nonempty(value.signature, 8_192) &&
        nonempty(value.signingKeyId, 240) &&
        ['RSA-PSS-SHA256', 'ECDSA-P256-SHA256', 'ED25519'].includes(
          String(value.signingAlgorithm)
        ) &&
        sha(value.evidenceDigest) &&
        sha(value.signedPayloadSha256) &&
        nonempty(value.signedPayloadBase64Url, 16_384) &&
        sha(value.signingKeyFingerprint) &&
        sha(value.documentSha256)
      );
  }
}

function actionParameters(action: DwaionPersonalDataEvidenceAction): Record<string, string> {
  switch (action) {
    case 'BACKUP_LEDGER':
      return { ledgerScope: 'latest' };
    case 'SRE_ESCALATION':
      return { priority: 'P2' };
    case 'LEGAL_HOLD_APPEAL':
      return { appealReason: actionReason(action) };
    case 'SIGNED_CERTIFICATE':
      return { locale: 'ko-KR' };
    case 'SIEM_SYNC':
      return {};
  }
}

function stringArray(value: unknown, allowEmpty: boolean): string[] | null {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || value.length > 1_000) {
    return null;
  }
  const normalized = value.filter((item): item is string => nonempty(item, 240));
  if (normalized.length !== value.length || new Set(normalized).size !== normalized.length) {
    return null;
  }
  return normalized;
}

const ACTIONS = new Set<DwaionPersonalDataEvidenceAction>([
  'BACKUP_LEDGER',
  'SRE_ESCALATION',
  'LEGAL_HOLD_APPEAL',
  'SIGNED_CERTIFICATE',
  'SIEM_SYNC',
]);
const STATES = new Set(['PENDING', 'COMPLETED', 'FAILED']);
