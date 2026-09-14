import { File as NodeFile, Blob as NodeBlob } from 'node:buffer';
import { webcrypto } from 'node:crypto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';

import {
  attachmentSource,
  attachmentUpload,
  attachmentItem,
  ATTACHMENT_BYTES,
  ATTACHMENT_FILE_NAME,
  ATTACHMENT_SHA,
  ATTACHMENT_UPLOAD_ID,
  ATTACHMENT_ID,
} from '../../../../../e2e/support/approval-attachment-fixtures';
import { ApprovalAttachmentClientController } from './approval-attachment-client-controller';
import {
  sameApprovalAttachmentSource,
  approvalAttachmentOwnerVersion,
} from './approval-attachment-client-model';

import type {
  ApprovalAttachmentClientCommand,
  ApprovalAttachmentClientEnvironment,
} from './approval-attachment-client-controller';
import type { ApprovalAttachmentSource } from './approval-attachment-client-model';

function harness() {
  let source = attachmentSource();
  let epoch = 'original-actor-epoch';
  let current = true;
  let upload = attachmentUpload();
  const commands: ApprovalAttachmentClientCommand[] = [];
  const transferred: Blob[] = [];
  const execute = vi.fn<ApprovalAttachmentClientEnvironment['execute']>(
    async (command, blob, onDispatch) => {
      onDispatch();
      commands.push(command);
      if (command.kind === 'RESERVE') return upload;
      if (command.kind === 'CONTENT') {
        if (blob) transferred.push(blob);
        upload = { ...upload, state: 'QUARANTINED', version: 2, reason: 'AWAITING_SCAN' };
        return upload;
      }
      if (command.kind === 'CANCEL')
        return { ...upload, state: 'CANCELLED', version: upload.version + 1 };
      if (command.kind === 'RECONCILE') return upload;
      if (command.kind === 'SELECT')
        return {
          ...source.attachments,
          manifest: {
            ...source.attachments.manifest,
            selectionVersion: command.input.expectedSelectionVersion + 1,
            items: command.input.attachmentIds.length ? [attachmentItem()] : [],
          },
        };
    }
  );
  const inspect = vi.fn<ApprovalAttachmentClientEnvironment['inspect']>(async () => upload);
  const environment: ApprovalAttachmentClientEnvironment = {
    current: () => (current ? { source, epoch } : undefined),
    assertCurrent: (command) => {
      if (
        !current ||
        command.epoch !== epoch ||
        !sameApprovalAttachmentSource(command.source, source)
      )
        throw new HttpError('Changed source', 409);
    },
    execute,
    inspect,
    sourceUpdated: (attachments) => {
      source = { ...source, attachments };
    },
  };
  const controller = new ApprovalAttachmentClientController(environment);
  controller.configure(environment, epoch);
  const choose = () =>
    controller.choose(
      new NodeFile([ATTACHMENT_BYTES], ATTACHMENT_FILE_NAME, { type: 'text/plain' }) as File
    );
  return {
    controller,
    commands,
    execute,
    inspect,
    transferred,
    choose,
    setCurrent: (value: boolean) => {
      current = value;
    },
    setSource: (value: ApprovalAttachmentSource) => {
      source = value;
    },
    source: () => source,
    setUpload: (value: typeof upload) => {
      upload = value;
    },
    changeActor: () => {
      epoch = 'new-actor-epoch';
      controller.configure(environment, epoch);
    },
  };
}

describe('approval attachment immutable original transfer controller', () => {
  beforeEach(() => {
    vi.stubGlobal('Blob', NodeBlob);
    vi.stubGlobal('crypto', webcrypto);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hashes the full actual File and transmits original bytes with one reserve/content key and upload CAS', async () => {
    const h = harness();
    await h.choose();
    expect(h.controller.getSnapshot().file?.sha256).toBe(ATTACHMENT_SHA);
    await Promise.all([h.controller.upload(), h.controller.upload()]);
    expect(h.commands.map((command) => command.kind)).toEqual(['RESERVE', 'CONTENT']);
    expect(h.commands[0].input.idempotencyKey).toBe(h.commands[1].input.idempotencyKey);
    expect(h.commands[1].input.expectedVersion).toBe(0);
    expect(new Uint8Array(await h.transferred[0].arrayBuffer())).toEqual(ATTACHMENT_BYTES);
    expect(h.controller.getSnapshot().uploads[0].upload.state).toBe('QUARANTINED');
    expect(h.controller.getSnapshot().file).toBeUndefined();
  });

  it('rejects type/size before hashing or reserve', async () => {
    const h = harness();
    await h.controller.choose(
      new NodeFile([ATTACHMENT_BYTES], 'bad.csv', { type: 'text/csv' }) as File
    );
    expect(h.controller.getSnapshot().problem).toBe('REJECTED');
    expect(h.execute).not.toHaveBeenCalled();
  });

  it('does not attach QUARANTINED/SCANNING files; only AV and passive-content clear with explicit selection CAS', async () => {
    const h = harness();
    await h.choose();
    await h.controller.upload();
    await h.controller.select([ATTACHMENT_ID]);
    expect(h.commands).toHaveLength(2);
    const upload = h.controller.getSnapshot().uploads[0].upload;
    h.setUpload({
      ...upload,
      state: 'AVAILABLE',
      version: 3,
      avState: 'AV_CLEAR',
      passiveContentState: 'PASSIVE_ALLOWED',
    });
    await h.controller.inspect(ATTACHMENT_UPLOAD_ID);
    await h.controller.select([ATTACHMENT_ID]);
    expect(h.commands[2].kind).toBe('SELECT');
    expect(h.source().attachments.manifest.selectionVersion).toBe(1);
    expect(h.source().attachments.manifest.sealed).toBe(false);
  });

  it('a fresh manifest GET cannot advance upload provenance or enable a new selection', async () => {
    const h = harness();
    await h.choose();
    await h.controller.upload();
    const upload = h.controller.getSnapshot().uploads[0].upload;
    h.setUpload({
      ...upload,
      state: 'AVAILABLE',
      version: 3,
      avState: 'AV_CLEAR',
      passiveContentState: 'PASSIVE_ALLOWED',
    });
    await h.controller.inspect(upload.uploadId);
    const source = h.source();
    h.setSource({
      ...source,
      attachments: {
        ...source.attachments,
        manifest: { ...source.attachments.manifest, selectionVersion: 1 },
      },
    });
    await h.controller.select([upload.attachmentId]);
    expect(h.commands).toHaveLength(2);
  });

  it('an acknowledgement with the original ID but substituted File SHA never rebases provenance', async () => {
    const h = harness();
    const execute = h.execute.getMockImplementation()!;
    h.execute.mockImplementation(async (command, blob, dispatch) => {
      const result = await execute(command, blob, dispatch);
      if (result && 'manifest' in result)
        return {
          ...result,
          manifest: {
            ...result.manifest,
            items: result.manifest.items.map((item) => ({ ...item, sha256: 'f'.repeat(64) })),
          },
        };
      return result;
    });
    await h.choose();
    await h.controller.upload();
    const upload = h.controller.getSnapshot().uploads[0].upload;
    h.setUpload({
      ...upload,
      state: 'AVAILABLE',
      version: 3,
      avState: 'AV_CLEAR',
      passiveContentState: 'PASSIVE_ALLOWED',
    });
    await h.controller.inspect(upload.uploadId);
    await h.controller.select([upload.attachmentId]);
    expect(h.controller.getSnapshot().unknownKind).toBe('SELECT');
    expect(h.source().attachments.manifest.selectionVersion).toBe(0);
    await h.controller.select([upload.attachmentId]);
    expect(h.commands).toHaveLength(3);
  });

  it('keeps ambiguous PUT private, blocks new reserve/PUT even after status GET shows AVAILABLE, and reconciles explicitly', async () => {
    const h = harness();
    const originalExecute = h.execute.getMockImplementation()!;
    h.execute.mockImplementation(async (command, blob, dispatch) => {
      if (command.kind === 'CONTENT') {
        dispatch();
        h.commands.push(command);
        throw new Error('Lost PUT result');
      }
      return originalExecute(command, blob, dispatch);
    });
    await h.choose();
    await h.controller.upload();
    expect(h.controller.getSnapshot().unknownKind).toBe('CONTENT');
    const upload = h.controller.getSnapshot().uploads[0].upload;
    h.setUpload({
      ...upload,
      state: 'AVAILABLE',
      version: 3,
      avState: 'AV_CLEAR',
      passiveContentState: 'PASSIVE_ALLOWED',
    });
    await h.controller.inspect(ATTACHMENT_UPLOAD_ID);
    expect(h.controller.getSnapshot().problem).toBe('UNKNOWN');
    await h.controller.retryOriginal();
    await h.controller.upload();
    await h.controller.select([ATTACHMENT_ID]);
    expect(h.commands.map((command) => command.kind)).toEqual(['RESERVE', 'CONTENT']);
    await h.controller.reconcile(ATTACHMENT_UPLOAD_ID);
    expect(h.commands.at(-1)?.kind).toBe('RECONCILE');
    expect(h.controller.unresolved).toBe(false);
  });

  it('reserve UNKNOWN retries the identical original descriptor/key/File, not a fresh reservation', async () => {
    const h = harness();
    const execute = h.execute.getMockImplementation()!;
    let first = true;
    h.execute.mockImplementation(async (command, blob, dispatch) => {
      if (command.kind === 'RESERVE' && first) {
        first = false;
        dispatch();
        h.commands.push(command);
        throw new Error('Lost reserve');
      }
      return execute(command, blob, dispatch);
    });
    await h.choose();
    await h.controller.upload();
    await h.controller.upload();
    expect(h.commands).toHaveLength(1);
    await h.controller.retryOriginal();
    expect(h.commands[1]).toBe(h.commands[0]);
    expect(h.controller.unresolved).toBe(false);
  });

  it('a known pre-dispatch content conflict keeps original bytes/key and never becomes ambiguous merely by refresh', async () => {
    const h = harness();
    const execute = h.execute.getMockImplementation()!;
    let blocked = true;
    h.execute.mockImplementation(async (command, blob, dispatch) => {
      if (command.kind === 'CONTENT' && blocked)
        throw new HttpError('Before content dispatch', 409);
      return execute(command, blob, dispatch);
    });
    await h.choose();
    await h.controller.upload();
    expect(h.commands).toHaveLength(1);
    expect(h.controller.getSnapshot().problem).toBe('CONFLICT');
    h.controller.recoverSource();
    expect(h.controller.getSnapshot().problem).toBe('CONFLICT');
    blocked = false;
    await h.controller.retryOriginal();
    expect(h.commands.map((command) => command.kind)).toEqual(['RESERVE', 'CONTENT']);
    expect(h.commands[0].input.idempotencyKey).toBe(h.commands[1].input.idempotencyKey);
    expect(h.controller.unresolved).toBe(false);
  });

  it('retains original UNKNOWN through 403/503 source failure and qualified recovery; wrong version cannot heal it', async () => {
    const h = harness();
    h.execute.mockImplementation(async (command, _blob, dispatch) => {
      dispatch();
      h.commands.push(command);
      throw new Error('Unknown reserve');
    });
    await h.choose();
    await h.controller.upload();
    h.setCurrent(false);
    await h.controller.retryOriginal();
    expect(h.commands).toHaveLength(1);
    expect(h.controller.getSnapshot().file?.sha256).toBe(ATTACHMENT_SHA);
    h.setCurrent(true);
    h.setSource({ ...h.source(), tools: { ...h.source().tools, requestVersion: 99 } });
    await h.controller.retryOriginal();
    expect(h.commands).toHaveLength(1);
    expect(h.controller.getSnapshot().problem).toBe('UNKNOWN');
  });

  it('actor epoch change purges private bytes/descriptors and ignores late reserve result', async () => {
    const h = harness();
    let resolve!: (upload: ReturnType<typeof attachmentUpload>) => void;
    h.execute.mockImplementation((_command, _blob, dispatch) => {
      dispatch();
      return new Promise((r) => {
        resolve = r;
      });
    });
    await h.choose();
    const pending = h.controller.upload();
    h.changeActor();
    resolve(attachmentUpload());
    await pending;
    expect(h.controller.getSnapshot()).toEqual({ busy: false, uploads: [] });
    expect(h.controller.unresolved).toBe(false);
    expect(h.execute).toHaveBeenCalledTimes(1);
  });

  it('cancellation uses a distinct original key and upload CAS, not request CAS', async () => {
    const h = harness();
    await h.choose();
    await h.controller.upload();
    await h.controller.cancel(ATTACHMENT_UPLOAD_ID);
    expect(h.commands.at(-1)?.kind).toBe('CANCEL');
    expect(h.commands.at(-1)?.input.expectedVersion).toBe(2);
    expect(h.commands.at(-1)?.input.idempotencyKey).not.toBe(h.commands[0].input.idempotencyKey);
    expect(h.controller.getSnapshot().uploads[0].upload.state).toBe('CANCELLED');
  });

  it('task downloads pin task version rather than borrowing request version', () => {
    const source = attachmentSource(true, true);
    expect(approvalAttachmentOwnerVersion(source)).toBe(19);
    expect(approvalAttachmentOwnerVersion(source)).not.toBe(source.tools.requestVersion);
  });

  it.each(['payload', 'selection', 'policy', 'actorOwner'] as const)(
    'detects exact %s source drift',
    (kind) => {
      const original = attachmentSource();
      const changed: ApprovalAttachmentSource = {
        ...original,
        owner: kind === 'actorOwner' ? { type: 'TASK', id: original.owner.id } : original.owner,
        attachments: {
          ...original.attachments,
          policyVersion: original.attachments.policyVersion + (kind === 'policy' ? 1 : 0),
          manifest: {
            ...original.attachments.manifest,
            payloadRevision:
              original.attachments.manifest.payloadRevision + (kind === 'payload' ? 1 : 0),
            selectionVersion:
              original.attachments.manifest.selectionVersion + (kind === 'selection' ? 1 : 0),
          },
        },
      };
      expect(sameApprovalAttachmentSource(original, changed)).toBe(false);
    }
  );
});
