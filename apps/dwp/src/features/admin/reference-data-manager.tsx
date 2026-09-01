import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useToast,
  getReferenceSet,
  listReferenceSets,
  listReferenceSetAuditEvents,
  createReferenceSet,
  updateReferenceSet,
  retireReferenceSet,
  activateReferenceSet,
  createReferenceItem,
  updateReferenceItem,
  retireReferenceItem,
  activateReferenceItem,
} from '@dwp-frontend/shared-utils';

import {
  ManagementPanelError,
  ManagementPanelLoading,
} from '../../components/management-panel-state';
import { ConfirmActionDialog, ReferenceItemDialog, ReferenceSetDialog } from './reference-dialogs';
import {
  REQUIRED_REFERENCE_LOCALES as REQUIRED_LOCALES,
  hasReferenceLocale as hasLocale,
  isReferenceItemAvailable as isAvailableNow,
  referenceDataErrorMessage as errorMessage,
} from './reference-data-manager-model';
import { ReferenceDataManagerView } from './reference-data-manager-view';

import type {
  ReferenceSetDetail,
  CreateReferenceSetRequest,
  CreateReferenceItemRequest,
  UpdateReferenceSetRequest,
  UpdateReferenceItemRequest,
} from '@dwp-frontend/shared-utils';
import type {
  DetailView,
  ItemDialogState,
  ItemFilter,
  PendingAction,
  SetDialogMode,
} from './reference-data-manager-model';

export function ReferenceDataManager() {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detailView, setDetailView] = useState<DetailView>('values');
  const [itemFilter, setItemFilter] = useState<ItemFilter>('ALL');
  const [itemQuery, setItemQuery] = useState('');
  const deferredItemQuery = useDeferredValue(itemQuery);
  const [setDialogMode, setSetDialogMode] = useState<SetDialogMode>(null);
  const [itemDialog, setItemDialog] = useState<ItemDialogState>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);

  const setsQuery = useQuery({
    queryKey: ['admin', 'reference-sets', deferredQuery],
    queryFn: () => listReferenceSets(deferredQuery),
  });
  const sets = useMemo(() => setsQuery.data?.content ?? [], [setsQuery.data]);

  useEffect(() => {
    if (sets.length === 0) {
      setSelectedKey(null);
      return;
    }
    if (!selectedKey || !sets.some((set) => set.setKey === selectedKey)) {
      setSelectedKey(sets[0].setKey);
    }
  }, [selectedKey, sets]);

  useEffect(() => {
    setItemFilter('ALL');
    setItemQuery('');
  }, [selectedKey]);

  const detailQuery = useQuery({
    queryKey: ['admin', 'reference-set', selectedKey],
    queryFn: () => getReferenceSet(selectedKey!),
    enabled: Boolean(selectedKey),
  });
  const detail = detailQuery.data;

  const activityQuery = useQuery({
    queryKey: ['admin', 'reference-set-activity', selectedKey],
    queryFn: () => listReferenceSetAuditEvents(selectedKey!),
    enabled: Boolean(selectedKey) && detailView === 'activity',
  });
  const activities = activityQuery.data?.content ?? [];

  const catalogSummary = useMemo(
    () => ({
      catalogs: sets.length,
      values: sets.reduce((total, set) => total + set.itemCount, 0),
      active: sets.filter((set) => set.lifecycleState === 'ACTIVE').length,
      draft: sets.filter((set) => set.lifecycleState === 'DRAFT').length,
    }),
    [sets]
  );

  const detailSummary = useMemo(() => {
    const items = detail?.items ?? [];
    const translatedLabels = items.reduce(
      (total, item) =>
        total + REQUIRED_LOCALES.filter((required) => hasLocale(item, required)).length,
      0
    );
    return {
      available: items.filter((item) => isAvailableNow(item)).length,
      draft: items.filter((item) => item.lifecycleState === 'DRAFT').length,
      scheduled: items.filter((item) => item.validFrom || item.validTo).length,
      roots: items.filter((item) => !item.parentCode).length,
      translationCoverage:
        items.length === 0
          ? 0
          : Math.round((translatedLabels / (items.length * REQUIRED_LOCALES.length)) * 100),
    };
  }, [detail]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = deferredItemQuery.trim().toLowerCase();
    return (detail?.items ?? []).filter((item) => {
      if (itemFilter !== 'ALL' && item.lifecycleState !== itemFilter) return false;
      if (!normalizedQuery) return true;
      return (
        item.code.toLowerCase().includes(normalizedQuery) ||
        item.labels.some((label) => label.label.toLowerCase().includes(normalizedQuery))
      );
    });
  }, [deferredItemQuery, detail, itemFilter]);

  const acceptDetail = async (next: ReferenceSetDetail, message: string) => {
    setSelectedKey(next.setKey);
    queryClient.setQueryData(['admin', 'reference-set', next.setKey], next);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'reference-sets'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'reference-set-activity', next.setKey] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit-events'] }),
    ]);
    toast.success(message);
  };

  const run = async (operation: () => Promise<ReferenceSetDetail>, successMessage: string) => {
    setBusy(true);
    try {
      await acceptDetail(await operation(), successMessage);
      return true;
    } catch (error) {
      toast.error(errorMessage(error, t('common.operationError')));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveSet = async (request: CreateReferenceSetRequest) => {
    const completed = await run(
      () => createReferenceSet(request),
      t('referenceData.toasts.setCreated')
    );
    if (completed) setSetDialogMode(null);
  };

  const updateSet = async (request: UpdateReferenceSetRequest) => {
    if (!detail) return;
    const completed = await run(
      () => updateReferenceSet(detail.setKey, request),
      t('referenceData.toasts.setUpdated')
    );
    if (completed) setSetDialogMode(null);
  };

  const saveItem = async (request: CreateReferenceItemRequest) => {
    if (!detail) return;
    const completed = await run(
      () => createReferenceItem(detail.setKey, request),
      t('referenceData.toasts.itemCreated')
    );
    if (completed) setItemDialog(null);
  };

  const updateItem = async (request: UpdateReferenceItemRequest) => {
    if (!detail || itemDialog?.mode !== 'edit') return;
    const completed = await run(
      () => updateReferenceItem(detail.setKey, itemDialog.item.code, request),
      t('referenceData.toasts.itemUpdated')
    );
    if (completed) setItemDialog(null);
  };

  const confirmAction = async () => {
    if (!detail || !pendingAction) return;
    let completed = false;
    if (pendingAction.kind === 'activate-set') {
      completed = await run(
        () => activateReferenceSet(detail.setKey, detail.version),
        t('referenceData.toasts.setActivated')
      );
    } else if (pendingAction.kind === 'retire-set') {
      completed = await run(
        () => retireReferenceSet(detail.setKey, detail.version),
        t('referenceData.toasts.setRetired')
      );
    } else if (pendingAction.kind === 'activate-item') {
      completed = await run(
        () =>
          activateReferenceItem(detail.setKey, pendingAction.item.code, pendingAction.item.version),
        t('referenceData.toasts.itemActivated')
      );
    } else {
      completed = await run(
        () =>
          retireReferenceItem(detail.setKey, pendingAction.item.code, pendingAction.item.version),
        t('referenceData.toasts.itemRetired')
      );
    }
    if (completed) setPendingAction(null);
  };

  if (setsQuery.isLoading) {
    return <ManagementPanelLoading label={t('referenceData.loading')} />;
  }
  if (setsQuery.isError) {
    return (
      <ManagementPanelError message={errorMessage(setsQuery.error, t('common.operationError'))} />
    );
  }

  const confirmCopy = pendingAction
    ? pendingAction.kind === 'activate-set'
      ? {
          title: t('referenceData.confirm.activateSetTitle'),
          message: t('referenceData.confirm.activateSetMessage'),
          confirmLabel: t('referenceData.actions.activate'),
          destructive: false,
        }
      : pendingAction.kind === 'retire-set'
        ? {
            title: t('referenceData.confirm.retireSetTitle'),
            message: t('referenceData.confirm.retireSetMessage'),
            confirmLabel: t('referenceData.actions.retire'),
            destructive: true,
          }
        : pendingAction.kind === 'activate-item'
          ? {
              title: t('referenceData.confirm.activateItemTitle', {
                code: pendingAction.item.code,
              }),
              message: t('referenceData.confirm.activateItemMessage'),
              confirmLabel: t('referenceData.actions.activate'),
              destructive: false,
            }
          : {
              title: t('referenceData.confirm.retireItemTitle', {
                code: pendingAction.item.code,
              }),
              message: t('referenceData.confirm.retireItemMessage'),
              confirmLabel: t('referenceData.actions.retire'),
              destructive: true,
            }
    : null;

  return (
    <>
      <ReferenceDataManagerView
        sets={sets}
        catalogSummary={catalogSummary}
        query={query}
        setQuery={setQuery}
        selectedKey={selectedKey}
        setSelectedKey={setSelectedKey}
        detail={detail}
        detailQuery={detailQuery}
        detailSummary={detailSummary}
        detailView={detailView}
        setDetailView={setDetailView}
        itemFilter={itemFilter}
        setItemFilter={setItemFilter}
        itemQuery={itemQuery}
        setItemQuery={setItemQuery}
        filteredItems={filteredItems}
        activityQuery={activityQuery}
        activities={activities}
        setSetDialogMode={setSetDialogMode}
        setItemDialog={setItemDialog}
        setPendingAction={setPendingAction}
      />

      <ReferenceSetDialog
        open={Boolean(setDialogMode)}
        value={setDialogMode === 'edit' ? detail : null}
        busy={busy}
        onClose={() => setSetDialogMode(null)}
        onCreate={saveSet}
        onUpdate={updateSet}
      />
      <ReferenceItemDialog
        open={Boolean(itemDialog)}
        value={itemDialog?.mode === 'edit' ? itemDialog.item : null}
        busy={busy}
        onClose={() => setItemDialog(null)}
        onCreate={saveItem}
        onUpdate={updateItem}
      />
      {confirmCopy && (
        <ConfirmActionDialog
          open
          {...confirmCopy}
          busy={busy}
          onClose={() => setPendingAction(null)}
          onConfirm={confirmAction}
        />
      )}
    </>
  );
}
