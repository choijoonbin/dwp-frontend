import type {
  PersonalWorkSource,
  PersonalWorkTask,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';

import type { WorkLayoutContext } from '../../layouts/work-layout';
import type { createWorkHubController } from './work-hub-controller';
import type { WorkHubItem, WorkHubSnapshot } from './work-hub-contracts';
import {
  canUseWorkHubGenericAdjunct,
  isWorkHubItemCommandReady,
} from './work-hub-command-authority';
import {
  executeFreshWorkSchedule,
  verifiedWorkHubSnapshotFromRefetch,
  type WorkHubSnapshotRefetchResult,
} from './work-hub-page-helpers';
import { WorkHubScheduleDialog } from './work-hub-schedule-dialog';
import { workHubScheduleLinksQueryKey } from './work-hub-schedule-links';
import type { WorkScheduleDraftInput } from './work-hub-scheduling';
import { WorkTaskDialog, type WorkTaskDialogProps } from './work-task-dialog';

export function WorkHubTaskEditorDialog({
  open,
  task,
  items,
  disabled,
  canScheduleAfterCreate,
  captureSource,
  captureSourceState,
  onRetryCaptureSource,
  onClose,
  onSubmit,
}: {
  open: boolean;
  task: PersonalWorkTask | null;
  items: readonly WorkHubItem[];
  disabled: boolean;
  canScheduleAfterCreate: boolean;
  captureSource?: PersonalWorkSource | null;
  captureSourceState?: WorkTaskDialogProps['sourcePreflightState'];
  onRetryCaptureSource?: () => void;
  onClose: () => void;
  onSubmit: WorkTaskDialogProps['onSubmit'];
}) {
  return (
    <WorkTaskDialog
      open={open}
      mode={task ? 'edit' : 'create'}
      initialValue={
        task
          ? {
              title: task.title,
              checklist: task.checklist ?? [],
              sources: task.sources ?? (task.source ? [task.source] : []),
              description: task.description,
              priority: task.priority,
              dueAt: task.dueAt,
              source: task.source,
              sourceReference:
                task.source?.availability !== 'UNAVAILABLE'
                  ? (task.source?.reference ?? null)
                  : null,
              version: task.version,
            }
          : captureSource
            ? {
                sourceReference: captureSource.reference,
                source: captureSource,
              }
            : undefined
      }
      sourceLabel={
        task?.source?.availability === 'AVAILABLE'
          ? task.source.title
          : captureSource?.availability === 'AVAILABLE'
            ? captureSource.title
            : null
      }
      sourceOptions={items
        .filter(
          (item) =>
            item.reference.sourceSystem !== 'PERSONAL_TASK' &&
            canUseWorkHubGenericAdjunct(item, 'PERSONAL_TASK_SOURCE')
        )
        .map((item) => ({ reference: item.reference, label: item.title }))}
      sourcePreflightState={captureSourceState}
      disabled={disabled}
      canScheduleAfterCreate={canScheduleAfterCreate}
      onRetrySource={onRetryCaptureSource}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

export function WorkHubScheduleExecutionDialog({
  item,
  snapshot,
  plannedForToday,
  canSchedule,
  ownerFingerprint,
  coordinator,
  controller,
  refresh,
  onClose,
  onOpenCalendar,
  onInvalidateLinks,
}: {
  item: WorkHubItem | null;
  snapshot: WorkHubSnapshot;
  plannedForToday: boolean;
  canSchedule: boolean;
  ownerFingerprint: string | null;
  coordinator?: WorkLayoutContext['scheduleCoordinator'];
  controller: ReturnType<typeof createWorkHubController>;
  refresh: () => Promise<WorkHubSnapshotRefetchResult>;
  onClose: () => void;
  onOpenCalendar: (draft: WorkScheduleDraftInput) => void;
  onInvalidateLinks: (queryKey: typeof workHubScheduleLinksQueryKey) => Promise<unknown>;
}) {
  return (
    <WorkHubScheduleDialog
      open={Boolean(item) && canSchedule}
      item={canSchedule ? item : null}
      plannedForToday={plannedForToday}
      ownerFingerprint={ownerFingerprint}
      canSchedule={canSchedule}
      coordinator={coordinator}
      onClose={onClose}
      onOpenCalendar={onOpenCalendar}
      reviewHandoff={async (reviewedItem, guard) => {
        if (guard.signal?.aborted || !(guard.canContinue?.() ?? true)) return false;
        const refreshed = await refresh();
        if (guard.signal?.aborted || !(guard.canContinue?.() ?? true)) return false;
        const fresh = verifiedWorkHubSnapshotFromRefetch(refreshed);
        return isWorkHubItemCommandReady(fresh, reviewedItem);
      }}
      prepare={(calendar, input) => {
        if (!item) throw new Error('selection unavailable');
        controller.adopt(snapshot);
        controller.select(item.reference);
        return controller.prepareSchedule(calendar, input);
      }}
      execute={async (command, confirmedEvent, guard) => {
        const result = await executeFreshWorkSchedule({
          command,
          confirmedEvent,
          guard,
          refresh,
          execute: controller.executeSchedule,
        });
        if (
          result.state === 'SCHEDULED' ||
          result.state === 'LINK_REMOVED' ||
          ('reason' in result && result.reason === 'INVALID_RECEIPT')
        ) {
          await onInvalidateLinks(workHubScheduleLinksQueryKey);
        }
        return result;
      }}
    />
  );
}
