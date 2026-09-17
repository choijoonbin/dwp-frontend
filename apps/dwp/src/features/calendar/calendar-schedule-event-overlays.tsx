import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@dwp-frontend/design-system';

import { CalendarEventDrawer } from './calendar-components';
import { CalendarEventDialog } from './calendar-event-dialog';

import type {
  CalendarEvent,
  CalendarResponseStatus,
} from '@dwp-frontend/shared-utils';

type OverlayState = Readonly<{
  selected: CalendarEvent | null;
  editing: CalendarEvent | null;
  cancelling: CalendarEvent | null;
  trashing: CalendarEvent | null;
}>;

type OverlayCapabilities = Readonly<{
  canUpdate: boolean;
  canEditSelected: boolean;
  canDeleteSelected: boolean;
  canStarSelected: boolean;
  canRespondSelected: boolean;
}>;

type OverlayBusyState = Readonly<{
  starring: boolean;
  cancelling: boolean;
  trashing: boolean;
}>;

type OverlayActions = Readonly<{
  closeSelected: () => void;
  editSelected: () => void;
  cancelSelected: () => void;
  trashSelected: () => void;
  toggleSelectedStar: () => void;
  respondToSelected: (
    response: Exclude<CalendarResponseStatus, 'NEEDS_ACTION'>
  ) => void;
  closeEditing: () => void;
  saveEditing: (event: CalendarEvent) => void;
  closeCancelling: () => void;
  confirmCancelling: () => void;
  closeTrashing: () => void;
  confirmTrashing: () => void;
}>;

/** Owns overlays for an existing event; creation stays with the handoff-aware schedule workflow. */
export function CalendarScheduleEventOverlays({
  state,
  capabilities,
  busy,
  actions,
}: {
  state: OverlayState;
  capabilities: OverlayCapabilities;
  busy: OverlayBusyState;
  actions: OverlayActions;
}) {
  const { t } = useTranslation('calendar');

  return (
    <>
      {capabilities.canUpdate && (
        <CalendarEventDialog
          open={Boolean(state.editing)}
          event={state.editing}
          onClose={actions.closeEditing}
          onSaved={actions.saveEditing}
        />
      )}
      <CalendarEventDrawer
        event={state.selected}
        open={Boolean(state.selected)}
        canEdit={capabilities.canEditSelected}
        canDelete={capabilities.canDeleteSelected}
        canStar={capabilities.canStarSelected}
        starBusy={busy.starring}
        onClose={actions.closeSelected}
        onEdit={capabilities.canUpdate ? actions.editSelected : undefined}
        onCancel={actions.cancelSelected}
        onTrash={actions.trashSelected}
        onToggleStar={actions.toggleSelectedStar}
        onRespond={capabilities.canRespondSelected ? actions.respondToSelected : undefined}
      />
      <ConfirmDialog
        open={capabilities.canUpdate && Boolean(state.cancelling)}
        title={t('event.cancelTitle')}
        description={t('event.cancelDescription', { title: state.cancelling?.title })}
        cancelLabel={t('actions.close')}
        confirmLabel={t('event.cancelEvent')}
        confirmingLabel={t('event.cancelling')}
        intent="danger"
        busy={busy.cancelling}
        onClose={actions.closeCancelling}
        onConfirm={actions.confirmCancelling}
      />
      <ConfirmDialog
        open={Boolean(state.trashing)}
        title={t('event.trashTitle')}
        description={t('event.trashDescription', { title: state.trashing?.title })}
        cancelLabel={t('actions.close')}
        confirmLabel={t('event.moveToTrash')}
        confirmingLabel={t('event.trashing')}
        intent="danger"
        busy={busy.trashing}
        onClose={actions.closeTrashing}
        onConfirm={actions.confirmTrashing}
      />
    </>
  );
}
