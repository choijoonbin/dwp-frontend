import type { PersonalWorkTask } from '@dwp-frontend/shared-utils/api/personal-work-contracts';

import type { WorkLayoutContext } from '../../layouts/work-layout';
import type { createWorkHubController } from './work-hub-controller';
import type { WorkHubItem, WorkHubSnapshot } from './work-hub-contracts';
import { canUseWorkHubGenericAdjunct } from './work-hub-command-authority';
import {
  executeFreshWorkSchedule,
  type WorkHubSnapshotRefetchResult,
} from './work-hub-page-helpers';
import { WorkHubScheduleDialog } from './work-hub-schedule-dialog';
import { workHubScheduleLinksQueryKey } from './work-hub-schedule-links';
import { WorkTaskDialog, type WorkTaskDialogProps } from './work-task-dialog';

export function WorkHubTaskEditorDialog({
  open,
  task,
  items,
  disabled,
  onClose,
  onSubmit,
}: {
  open: boolean;
  task: PersonalWorkTask | null;
  items: readonly WorkHubItem[];
  disabled: boolean;
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
              sourceReference:
                task.source?.availability !== 'UNAVAILABLE'
                  ? (task.source?.reference ?? null)
                  : null,
              version: task.version,
            }
          : undefined
      }
      sourceLabel={task?.source?.availability === 'AVAILABLE' ? task.source.title : null}
      sourceOptions={items
        .filter(
          (item) =>
            item.reference.sourceSystem !== 'PERSONAL_TASK' &&
            canUseWorkHubGenericAdjunct(item, 'PERSONAL_TASK_SOURCE')
        )
        .map((item) => ({ reference: item.reference, label: item.title }))}
      disabled={disabled}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

export function WorkHubScheduleExecutionDialog({
  item,
  snapshot,
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
  canSchedule: boolean;
  ownerFingerprint: string | null;
  coordinator?: WorkLayoutContext['scheduleCoordinator'];
  controller: ReturnType<typeof createWorkHubController>;
  refresh: () => Promise<WorkHubSnapshotRefetchResult>;
  onClose: () => void;
  onOpenCalendar: () => void;
  onInvalidateLinks: (queryKey: typeof workHubScheduleLinksQueryKey) => Promise<unknown>;
}) {
  return (
    <WorkHubScheduleDialog
      open={Boolean(item) && canSchedule}
      item={canSchedule ? item : null}
      ownerFingerprint={ownerFingerprint}
      canSchedule={canSchedule}
      coordinator={coordinator}
      onClose={onClose}
      onOpenCalendar={onOpenCalendar}
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
