import { HttpError } from '@dwp-frontend/shared-utils';
import {
  ApprovalAttachmentResponseError,
  approvalAttachmentBlobSha256,
} from '@dwp-frontend/shared-utils/api/approval-attachment-api';

import {
  approvalAttachmentFileAllowed,
  approvalAttachmentOriginalKey,
  approvalAttachmentOwnerVersion,
  approvalAttachmentScanEligible,
  approvalAttachmentUploadMatches,
  approvalAttachmentItemMatches,
  sameApprovalAttachmentSource,
} from './approval-attachment-client-model';
import { approvalRequestCommandResultUnknown } from './approval-request-command-model';

import type { ApprovalAttachmentSource } from './approval-attachment-client-model';
import type {
  ApprovalAttachments,
  ApprovalAttachmentUpload,
  ApprovalAttachmentItem,
  ApprovalAttachmentReserveInput,
  ApprovalAttachmentCommandInput,
  ApprovalAttachmentSelectionInput,
  ApprovalAttachmentDownloadInput,
} from '@dwp-frontend/shared-utils/api/approval-attachment-contract';

type Pins = Readonly<{ source: ApprovalAttachmentSource; epoch: string }>;
export type ApprovalAttachmentClientCommand = Pins &
  (
    | Readonly<{ kind: 'RESERVE'; input: ApprovalAttachmentReserveInput }>
    | Readonly<{
        kind: 'CONTENT' | 'RECONCILE' | 'CANCEL';
        upload: ApprovalAttachmentUpload;
        input: ApprovalAttachmentCommandInput;
      }>
    | Readonly<{ kind: 'SELECT'; input: ApprovalAttachmentSelectionInput }>
    | Readonly<{
        kind: 'DOWNLOAD';
        item: ApprovalAttachmentItem;
        input: ApprovalAttachmentDownloadInput;
      }>
  );

export type ApprovalAttachmentClientState = Readonly<{
  busy: boolean;
  file?: Readonly<{ fileName: string; mediaType: string; sizeBytes: number; sha256: string }>;
  uploads: readonly Readonly<{
    fileName: string;
    mediaType: string;
    upload: ApprovalAttachmentUpload;
  }>[];
  problem?: 'REJECTED' | 'CONFLICT' | 'DENIED' | 'ERROR' | 'UNKNOWN';
  unknownKind?: ApprovalAttachmentClientCommand['kind'];
}>;

export type ApprovalAttachmentClientEnvironment = {
  current: () => Pins | undefined;
  assertCurrent: (command: ApprovalAttachmentClientCommand) => void;
  execute: (
    command: ApprovalAttachmentClientCommand,
    blob: Blob | undefined,
    onDispatch: () => void
  ) => Promise<ApprovalAttachmentUpload | ApprovalAttachments | void>;
  inspect: (upload: ApprovalAttachmentUpload) => Promise<ApprovalAttachmentUpload>;
  sourceUpdated: (source: ApprovalAttachments) => void;
};

const INITIAL: ApprovalAttachmentClientState = Object.freeze({ busy: false, uploads: [] });

/** File bytes and unresolved descriptors stay private; GET observations never resolve a command. */
export class ApprovalAttachmentClientController {
  private state = INITIAL;
  private listeners = new Set<() => void>();
  private file?: Blob;
  private filePins?: Pins;
  private pending?: ApprovalAttachmentClientCommand;
  private uploadPins = new Map<string, Pins>();
  private epoch = '';
  private serial = 0;

  constructor(private environment: ApprovalAttachmentClientEnvironment) {}

  configure(environment: ApprovalAttachmentClientEnvironment, epoch: string) {
    this.environment = environment;
    if (this.epoch !== epoch) {
      this.epoch = epoch;
      this.serial += 1;
      this.file = undefined;
      this.filePins = undefined;
      this.pending = undefined;
      this.uploadPins.clear();
      this.state = INITIAL;
    }
  }

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private update(patch: Partial<ApprovalAttachmentClientState>) {
    this.state = Object.freeze({ ...this.state, ...patch });
    this.listeners.forEach((listener) => listener());
  }

  private pins() {
    const pins = this.environment.current();
    if (!pins || pins.epoch !== this.epoch) throw new HttpError('Attachment source changed.', 409);
    return pins;
  }

  get unresolved() {
    return Boolean(this.pending);
  }

  isOriginalUnknown(command: ApprovalAttachmentClientCommand) {
    return this.pending === command && this.state.unknownKind === command.kind;
  }

  recoverSource() {
    if (this.state.busy) return;
    if (this.pending) {
      try {
        this.environment.assertCurrent(this.pending);
      } catch {
        return;
      }
      this.update({
        problem: this.isOriginalUnknown(this.pending) ? 'UNKNOWN' : 'CONFLICT',
      });
    } else if (this.filePins) {
      const pins = this.environment.current();
      if (!pins || pins.epoch !== this.filePins.epoch) return;
      this.update({ problem: undefined });
    } else this.update({ problem: undefined });
  }

  async choose(file: File) {
    if (this.state.busy || this.pending || this.state.file) return;
    const pins = this.pins();
    if (!approvalAttachmentFileAllowed(file, pins.source)) {
      this.update({ problem: 'REJECTED' });
      return;
    }
    const serial = this.serial;
    const blob = file.slice(0, file.size, file.type);
    this.update({ busy: true, problem: undefined });
    try {
      const sha256 = await approvalAttachmentBlobSha256(blob);
      if (serial !== this.serial) return;
      const descriptor = {
        ...pins,
        kind: 'RESERVE' as const,
        input: {
          expectedVersion: approvalAttachmentOwnerVersion(pins.source),
          expectedPayloadRevision: pins.source.attachments.manifest.payloadRevision,
          expectedPolicyVersion: pins.source.attachments.policyVersion,
          fileName: file.name,
          mediaType: file.type,
          sizeBytes: file.size,
          sha256,
          idempotencyKey: approvalAttachmentOriginalKey(),
        },
      };
      this.environment.assertCurrent(descriptor);
      this.file = blob;
      this.filePins = pins;
      this.update({
        file: Object.freeze({
          fileName: file.name,
          mediaType: file.type,
          sizeBytes: file.size,
          sha256,
        }),
      });
    } catch (error) {
      if (serial === this.serial) this.fail(error, false);
    } finally {
      if (serial === this.serial) this.update({ busy: false });
    }
  }

  clearFile() {
    if (this.state.busy || this.pending) return;
    this.file = undefined;
    this.filePins = undefined;
    this.update({ file: undefined, problem: undefined });
  }

  private fail(error: unknown, dispatched: boolean) {
    const unknown = dispatched && approvalRequestCommandResultUnknown(error);
    this.update({
      problem: unknown
        ? 'UNKNOWN'
        : error instanceof HttpError && [401, 403, 404].includes(error.status)
          ? 'DENIED'
          : error instanceof HttpError && error.status === 409
            ? 'CONFLICT'
            : 'ERROR',
      unknownKind: unknown ? this.pending?.kind : undefined,
    });
    if (!unknown) this.pending = undefined;
  }

  private async run(command: ApprovalAttachmentClientCommand) {
    if (this.state.busy) return;
    const serial = this.serial;
    const prior = this.pending;
    const priorUnknown = prior && this.isOriginalUnknown(prior);
    const wasUnknown = prior === command && priorUnknown;
    let dispatched = false;
    let resultReceived = false;
    this.pending = command;
    this.update({ busy: true, problem: undefined });
    try {
      this.environment.assertCurrent(command);
      const result = await this.environment.execute(command, this.file, () => {
        this.environment.assertCurrent(command);
        dispatched = true;
      });
      if (serial !== this.serial) return;
      resultReceived = true;
      this.environment.assertCurrent(command);
      if (result && 'uploadId' in result) {
        const existing = this.state.uploads.find((row) => row.upload.uploadId === result.uploadId);
        if (existing && !approvalAttachmentUploadMatches(existing.upload, result))
          throw new HttpError('Attachment upload changed.', 409);
        const fileName = command.kind === 'RESERVE' ? command.input.fileName : existing?.fileName;
        const mediaType =
          command.kind === 'RESERVE' ? command.input.mediaType : existing?.mediaType;
        if (!fileName || !mediaType) throw new HttpError('Original file metadata is missing.', 409);
        this.uploadPins.set(result.uploadId, { source: command.source, epoch: command.epoch });
        this.pending = undefined;
        this.update({ unknownKind: undefined });
        this.update({
          uploads: [
            ...this.state.uploads.filter((row) => row.upload.uploadId !== result.uploadId),
            Object.freeze({ fileName, mediaType, upload: result }),
          ],
        });
        if (command.kind === 'RESERVE') {
          const content: ApprovalAttachmentClientCommand = Object.freeze({
            ...command,
            kind: 'CONTENT',
            upload: result,
            input: Object.freeze({
              expectedVersion: result.version,
              idempotencyKey: command.input.idempotencyKey,
            }),
          });
          this.update({ busy: false });
          await this.run(content);
        } else if (['CONTENT', 'RECONCILE', 'CANCEL'].includes(command.kind)) {
          this.file = undefined;
          this.filePins = undefined;
          this.update({ file: undefined });
        }
      } else if (result && 'manifest' in result) {
        if (
          command.kind !== 'SELECT' ||
          result.manifest.selectionVersion !== command.input.expectedSelectionVersion + 1 ||
          result.manifest.sealed ||
          result.manifest.manifestSha256 !== null ||
          JSON.stringify([...result.manifest.items.map((item) => item.attachmentId)].sort()) !==
            JSON.stringify([...command.input.attachmentIds].sort()) ||
          result.manifest.items.some((item) => {
            const previous = command.source.attachments.manifest.items.find(
              (entry) => entry.attachmentId === item.attachmentId
            );
            if (previous) return !approvalAttachmentItemMatches(previous, item);
            const row = this.state.uploads.find(
              (entry) => entry.upload.attachmentId === item.attachmentId
            );
            return (
              !row ||
              !approvalAttachmentScanEligible(row.upload) ||
              row.fileName !== item.fileName ||
              row.mediaType !== item.mediaType ||
              row.upload.sha256 !== item.sha256 ||
              row.upload.sizeBytes !== item.sizeBytes ||
              item.avState !== 'AV_CLEAR' ||
              item.passiveContentState !== 'PASSIVE_ALLOWED'
            );
          }) ||
          !sameApprovalAttachmentSource(
            {
              ...command.source,
              attachments: { ...command.source.attachments, manifest: result.manifest },
            },
            { ...command.source, attachments: result }
          )
        )
          throw new ApprovalAttachmentResponseError(
            'Selection response did not match the original command.'
          );
        this.environment.sourceUpdated(result);
        const acknowledgedPins = Object.freeze({
          epoch: command.epoch,
          source: Object.freeze({ ...command.source, attachments: result }),
        });
        // Only an exact command acknowledgement advances upload provenance, never a GET.
        for (const [uploadId, pins] of this.uploadPins) {
          if (
            pins.epoch === command.epoch &&
            sameApprovalAttachmentSource(pins.source, command.source)
          )
            this.uploadPins.set(uploadId, acknowledgedPins);
        }
        if (
          this.filePins?.epoch === command.epoch &&
          sameApprovalAttachmentSource(this.filePins.source, command.source)
        )
          this.filePins = acknowledgedPins;
        this.pending = undefined;
        this.update({ unknownKind: undefined });
      } else {
        this.pending = undefined;
        this.update({ unknownKind: undefined });
      }
    } catch (error) {
      if (serial === this.serial) {
        if (
          wasUnknown ||
          (priorUnknown &&
            prior?.kind === 'CONTENT' &&
            (!dispatched || !approvalRequestCommandResultUnknown(error)))
        ) {
          this.pending = prior;
          this.update({ problem: 'UNKNOWN', unknownKind: prior?.kind });
        } else if (command.kind === 'CONTENT' && !dispatched) {
          this.update({ problem: 'CONFLICT', unknownKind: undefined });
        } else {
          this.fail(
            resultReceived ? new ApprovalAttachmentResponseError(error) : error,
            dispatched
          );
        }
      }
    } finally {
      if (serial === this.serial) this.update({ busy: false });
    }
  }

  async upload() {
    if (this.state.busy || this.pending || !this.state.file || !this.file || !this.filePins) return;
    const file = this.state.file;
    await this.run(
      Object.freeze({
        ...this.filePins,
        kind: 'RESERVE',
        input: Object.freeze({
          expectedVersion: approvalAttachmentOwnerVersion(this.filePins.source),
          expectedPayloadRevision: this.filePins.source.attachments.manifest.payloadRevision,
          expectedPolicyVersion: this.filePins.source.attachments.policyVersion,
          ...file,
          idempotencyKey: approvalAttachmentOriginalKey(),
        }),
      })
    );
  }

  async retryOriginal() {
    const command = this.pending;
    if (!command || (command.kind === 'CONTENT' && this.state.problem === 'UNKNOWN')) return;
    await this.run(command);
  }

  async inspect(uploadId: string) {
    if (this.state.busy) return;
    const original = this.state.uploads.find((row) => row.upload.uploadId === uploadId);
    if (!original) return;
    const serial = this.serial;
    this.update({ busy: true });
    try {
      const fresh = await this.environment.inspect(original.upload);
      if (serial !== this.serial) return;
      if (!approvalAttachmentUploadMatches(original.upload, fresh))
        throw new HttpError('Attachment status did not match the original upload.', 409);
      this.update({
        uploads: this.state.uploads.map((row) =>
          row === original ? Object.freeze({ ...row, upload: fresh }) : row
        ),
      });
    } catch (error) {
      if (serial === this.serial) {
        if (this.pending)
          this.update({ problem: this.isOriginalUnknown(this.pending) ? 'UNKNOWN' : 'CONFLICT' });
        else this.fail(error, false);
      }
    } finally {
      if (serial === this.serial) this.update({ busy: false });
    }
  }

  async reconcile(uploadId: string) {
    if (this.state.busy) return;
    if (this.pending && this.pending.kind !== 'CONTENT') return;
    const row = this.state.uploads.find((item) => item.upload.uploadId === uploadId);
    if (!row || ['CANCELLED', 'REJECTED'].includes(row.upload.state)) return;
    const pins = this.pending ?? this.pins();
    await this.run(
      Object.freeze({
        source: pins.source,
        epoch: pins.epoch,
        kind: 'RECONCILE',
        upload: row.upload,
        input: Object.freeze({
          expectedVersion: row.upload.version,
          idempotencyKey: approvalAttachmentOriginalKey(),
        }),
      })
    );
  }

  async cancel(uploadId: string) {
    if (this.state.busy || this.pending) return;
    const row = this.state.uploads.find((item) => item.upload.uploadId === uploadId);
    if (!row || row.upload.state === 'CANCELLED') return;
    const originalPins = this.uploadPins.get(uploadId);
    if (!originalPins) return;
    await this.run(
      Object.freeze({
        ...originalPins,
        kind: 'CANCEL',
        upload: row.upload,
        input: Object.freeze({
          expectedVersion: row.upload.version,
          idempotencyKey: approvalAttachmentOriginalKey(),
        }),
      })
    );
  }

  async select(attachmentIds: readonly string[]) {
    if (this.state.busy || this.pending) return;
    const pins = this.pins();
    const manifest = pins.source.attachments.manifest;
    if (manifest.sealed || new Set(attachmentIds).size !== attachmentIds.length) return;
    const eligible = new Set([
      ...manifest.items
        .filter(
          (item) => item.avState === 'AV_CLEAR' && item.passiveContentState === 'PASSIVE_ALLOWED'
        )
        .map((item) => item.attachmentId),
      ...this.state.uploads
        .filter((row) => approvalAttachmentScanEligible(row.upload))
        .map((row) => row.upload.attachmentId),
    ]);
    if (attachmentIds.some((id) => !eligible.has(id))) return;
    if (
      this.state.uploads.some(
        (row) =>
          attachmentIds.includes(row.upload.attachmentId) &&
          !sameApprovalAttachmentSource(
            this.uploadPins.get(row.upload.uploadId)?.source ?? pins.source,
            pins.source
          )
      )
    )
      return;
    await this.run(
      Object.freeze({
        ...pins,
        kind: 'SELECT',
        input: Object.freeze({
          expectedVersion: approvalAttachmentOwnerVersion(pins.source),
          expectedPayloadRevision: manifest.payloadRevision,
          expectedSelectionVersion: manifest.selectionVersion,
          expectedPolicyVersion: pins.source.attachments.policyVersion,
          attachmentIds: [...attachmentIds],
          idempotencyKey: approvalAttachmentOriginalKey(),
        }),
      })
    );
  }

  async download(item: ApprovalAttachmentItem, reason: string) {
    if (this.state.busy || this.pending || !reason.trim() || reason.length > 500) return;
    const pins = this.pins();
    await this.run(
      Object.freeze({
        ...pins,
        kind: 'DOWNLOAD',
        item: Object.freeze({ ...item }),
        input: Object.freeze({
          expectedVersion: approvalAttachmentOwnerVersion(pins.source),
          expectedPayloadRevision: pins.source.attachments.manifest.payloadRevision,
          expectedPolicyVersion: pins.source.attachments.policyVersion,
          reason: reason.trim(),
          idempotencyKey: approvalAttachmentOriginalKey(),
        }),
      })
    );
  }
}
