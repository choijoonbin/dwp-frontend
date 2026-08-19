import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical, Maximize2, Minus, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useBlocker } from 'react-router-dom';
import { saveWorkplaceLayout, useToast } from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  ConfirmDialog,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import type { DragEndEvent } from '@dnd-kit/core';
import type { WorkplaceFloor, WorkplaceResource } from '@dwp-frontend/shared-utils';

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function DraggableResource({
  resource,
  selected,
  editable,
  showEditAction,
  onEdit,
  onSelect,
}: {
  resource: WorkplaceResource;
  selected: boolean;
  editable: boolean;
  showEditAction: boolean;
  onEdit: (resource: WorkplaceResource) => void;
  onSelect: (resourceId: string) => void;
}) {
  const { t } = useTranslation('rooms');
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: resource.resourceId,
    disabled: !editable,
  });
  return (
    <Box
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-testid={`layout-resource-${resource.resourceId}`}
      onClick={() => onSelect(resource.resourceId)}
      sx={{
        position: 'absolute',
        left: `${resource.positionX}%`,
        top: `${resource.positionY}%`,
        width: `${resource.widthPercent}%`,
        height: `${resource.heightPercent}%`,
        minWidth: 42,
        minHeight: 38,
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 5 : selected ? 2 : 1,
        border: selected ? 2 : 1,
        borderColor: selected ? 'primary.main' : 'text.disabled',
        bgcolor: resource.mode === 'ASSIGNED' ? '#F2ECFF' : 'background.paper',
        color: 'text.primary',
        boxShadow: isDragging ? 6 : selected ? 2 : 0,
        cursor: editable ? (isDragging ? 'grabbing' : 'grab') : 'default',
        display: 'grid',
        gridTemplateColumns: '18px minmax(0, 1fr) 28px',
        alignItems: 'center',
        gap: 0.3,
        p: 0.5,
        touchAction: 'none',
      }}
    >
      <GripVertical size={15} aria-hidden="true" />
      <Typography variant="caption" noWrap fontWeight={700}>
        {resource.code}
      </Typography>
      {showEditAction && (
        <ActionIconButton
          size="small"
          label={`${resource.name} ${t('actions.edit')}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onEdit(resource);
          }}
        >
          <Pencil size={14} />
        </ActionIconButton>
      )}
    </Box>
  );
}

export function WorkplaceLayoutEditor({
  floor,
  resources,
  availableResources = [],
  onEdit,
  onDirtyChange,
  onSaveLayout,
  onSaved,
  saveSuccessMessage,
  saveErrorMessage,
  showResourceEditActions = true,
  allowPlacementManagement = false,
  blockNavigation = true,
  editable = true,
}: {
  floor: WorkplaceFloor;
  resources: readonly WorkplaceResource[];
  availableResources?: readonly WorkplaceResource[];
  onEdit: (resource: WorkplaceResource) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSaveLayout?: (
    resources: readonly WorkplaceResource[],
    dirtyResources: readonly WorkplaceResource[],
    removedResourceIds: readonly string[]
  ) => Promise<unknown>;
  onSaved?: () => void | Promise<void>;
  saveSuccessMessage?: string;
  saveErrorMessage?: string;
  showResourceEditActions?: boolean;
  allowPlacementManagement?: boolean;
  blockNavigation?: boolean;
  editable?: boolean;
}) {
  const { t } = useTranslation('rooms');
  const toast = useToast();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const currentFloorIdRef = useRef(floor.floorId);
  const inputSignatureRef = useRef('');
  const [items, setItems] = useState<WorkplaceResource[]>([...resources]);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resourceToAdd, setResourceToAdd] = useState('');
  const [zoom, setZoom] = useState(100);
  const inputSignature = useMemo(
    () =>
      resources
        .map(
          (resource) =>
            `${resource.resourceId}:${resource.positionX}:${resource.positionY}:${resource.widthPercent}:${resource.heightPercent}:${resource.rotationDegrees}:${resource.version}`
        )
        .join('|'),
    [resources]
  );
  useEffect(() => {
    const floorChanged = currentFloorIdRef.current !== floor.floorId;
    const inputChanged = inputSignatureRef.current !== inputSignature;
    currentFloorIdRef.current = floor.floorId;
    inputSignatureRef.current = inputSignature;
    if (floorChanged || (inputChanged && dirtyIds.size === 0 && removedIds.size === 0)) {
      setItems([...resources]);
      setDirtyIds(new Set());
      setRemovedIds(new Set());
      setSelectedId(null);
    }
  }, [dirtyIds.size, floor.floorId, inputSignature, removedIds.size, resources]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );
  const dirty = useMemo(
    () => items.filter((resource) => dirtyIds.has(resource.resourceId)),
    [dirtyIds, items]
  );
  const dirtyCount = dirtyIds.size + removedIds.size;
  useLayoutEffect(() => {
    onDirtyChange?.(dirtyCount > 0);
  }, [dirtyCount, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => {
    if (editable) return;
    setItems([...resources]);
    setDirtyIds(new Set());
    setRemovedIds(new Set());
    setSelectedId(null);
  }, [editable, resources]);
  useEffect(() => {
    if (dirtyCount === 0) return undefined;
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', preventUnload);
    return () => window.removeEventListener('beforeunload', preventUnload);
  }, [dirtyCount]);
  const saveMutation = useMutation({
    mutationFn: () => {
      if (!editable) throw new Error(t('permissions.adminUpdateRestricted'));
      if (onSaveLayout) return onSaveLayout(items, dirty, [...removedIds]);
      return saveWorkplaceLayout(
        floor.floorId,
        dirty.map((resource) => ({
          resourceId: resource.resourceId,
          positionX: resource.positionX,
          positionY: resource.positionY,
          widthPercent: resource.widthPercent,
          heightPercent: resource.heightPercent,
          rotationDegrees: resource.rotationDegrees,
          version: resource.version,
        }))
      );
    },
    onSuccess: async () => {
      setDirtyIds(new Set());
      setRemovedIds(new Set());
      await queryClient.invalidateQueries({ queryKey: ['workplace'] });
      await onSaved?.();
      toast.success(saveSuccessMessage ?? t('workplace.admin.locations.layoutSaved'));
    },
    onError: () => toast.error(saveErrorMessage ?? t('workplace.admin.locations.layoutSaveError')),
  });
  const onDragEnd = ({ active, delta }: DragEndEvent) => {
    if (!editable) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resource = items.find((candidate) => candidate.resourceId === active.id);
    if (!resource) return;
    const rect = canvas.getBoundingClientRect();
    const x = clamp(
      resource.positionX + (delta.x / rect.width) * 100,
      0,
      100 - resource.widthPercent
    );
    const y = clamp(
      resource.positionY + (delta.y / rect.height) * 100,
      0,
      100 - resource.heightPercent
    );
    setItems((current) =>
      current.map((candidate) =>
        candidate.resourceId === resource.resourceId
          ? { ...candidate, positionX: Number(x.toFixed(2)), positionY: Number(y.toFixed(2)) }
          : candidate
      )
    );
    setDirtyIds((current) => new Set(current).add(resource.resourceId));
    setSelectedId(resource.resourceId);
  };
  const selectedResource = items.find((resource) => resource.resourceId === selectedId) ?? null;
  const unplacedResources = useMemo(
    () =>
      availableResources.filter(
        (resource) => !items.some((item) => item.resourceId === resource.resourceId)
      ),
    [availableResources, items]
  );
  useEffect(() => {
    if (!unplacedResources.length) setResourceToAdd('');
    else if (!unplacedResources.some((resource) => resource.resourceId === resourceToAdd)) {
      setResourceToAdd(unplacedResources[0].resourceId);
    }
  }, [resourceToAdd, unplacedResources]);
  const updateSelectedCoordinate = (axis: 'positionX' | 'positionY', value: number) => {
    if (!selectedResource || !Number.isFinite(value)) return;
    const maximum =
      axis === 'positionX'
        ? 100 - selectedResource.widthPercent
        : 100 - selectedResource.heightPercent;
    setItems((current) =>
      current.map((resource) =>
        resource.resourceId === selectedResource.resourceId
          ? { ...resource, [axis]: Number(clamp(value, 0, maximum).toFixed(2)) }
          : resource
      )
    );
    setDirtyIds((current) => new Set(current).add(selectedResource.resourceId));
  };
  const addResource = () => {
    const resource = unplacedResources.find((candidate) => candidate.resourceId === resourceToAdd);
    if (!resource || !editable) return;
    const index = items.length;
    const placed = {
      ...resource,
      positionX: Math.min(82, 4 + (index % 5) * 18),
      positionY: Math.min(88, 4 + Math.floor(index / 5) * 14),
      widthPercent: clamp(resource.widthPercent || 12, 4, 30),
      heightPercent: clamp(resource.heightPercent || 8, 4, 30),
    };
    setItems((current) => [...current, placed]);
    setRemovedIds((current) => {
      const next = new Set(current);
      next.delete(resource.resourceId);
      return next;
    });
    setDirtyIds((current) => new Set(current).add(resource.resourceId));
    setSelectedId(resource.resourceId);
  };
  const removeSelected = () => {
    if (!selectedResource || !editable) return;
    const originallyPlaced = resources.some(
      (resource) => resource.resourceId === selectedResource.resourceId
    );
    setItems((current) =>
      current.filter((resource) => resource.resourceId !== selectedResource.resourceId)
    );
    setDirtyIds((current) => {
      const next = new Set(current);
      next.delete(selectedResource.resourceId);
      return next;
    });
    if (originallyPlaced) {
      setRemovedIds((current) => new Set(current).add(selectedResource.resourceId));
    }
    setSelectedId(null);
  };

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        gap={1}
        sx={{ mb: 1 }}
      >
        <Stack direction="row" gap={1} alignItems="center">
          <Chip
            size="small"
            label={t('workplace.admin.locations.resourceCount', { count: items.length })}
          />
          {dirtyCount > 0 && (
            <Chip
              size="small"
              color="warning"
              label={t('workplace.admin.locations.unsavedCount', { count: dirtyCount })}
            />
          )}
        </Stack>
        <Stack direction="row" gap={0.5} alignItems="center">
          <ActionIconButton
            size="small"
            label={t('workplace.admin.locations.zoomOut')}
            disabled={zoom <= 50}
            onClick={() => setZoom((value) => value - 10)}
          >
            <Minus size={17} />
          </ActionIconButton>
          <Typography variant="caption" sx={{ minWidth: 42, textAlign: 'center' }}>
            {zoom}%
          </Typography>
          <ActionIconButton
            size="small"
            label={t('workplace.admin.locations.zoomIn')}
            disabled={zoom >= 140}
            onClick={() => setZoom((value) => value + 10)}
          >
            <Plus size={17} />
          </ActionIconButton>
          <ActionIconButton
            size="small"
            label={t('workplace.admin.locations.fitToWidth')}
            disabled={zoom === 100}
            onClick={() => setZoom(100)}
          >
            <Maximize2 size={17} />
          </ActionIconButton>
          <ActionButton
            intent="primary"
            startIcon={<Save size={16} />}
            disabled={dirtyCount === 0 || !editable}
            loading={saveMutation.isPending}
            loadingLabel={t('actions.saving')}
            onClick={() => saveMutation.mutate()}
          >
            {t('workplace.admin.locations.saveLayout')}
          </ActionButton>
        </Stack>
      </Stack>
      {allowPlacementManagement && editable ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: 'minmax(240px, 1.4fr) auto minmax(110px, 0.5fr) minmax(110px, 0.5fr) auto',
            },
            gap: 1,
            alignItems: 'end',
            mb: 1,
            p: 1,
            border: 1,
            borderColor: 'divider',
          }}
        >
          <SelectField
            label={t('workplace.admin.locations.unplacedResource')}
            value={resourceToAdd}
            disabled={!unplacedResources.length}
            options={unplacedResources.map((resource) => ({
              value: resource.resourceId,
              label: `${resource.name} (${resource.code})`,
            }))}
            onValueChange={setResourceToAdd}
          />
          <ActionButton
            intent="secondary"
            startIcon={<Plus size={16} />}
            disabled={!resourceToAdd}
            onClick={addResource}
          >
            {t('workplace.admin.locations.addToLayout')}
          </ActionButton>
          <FormField
            type="number"
            label={t('workplace.admin.locations.positionX')}
            value={selectedResource?.positionX ?? ''}
            disabled={!selectedResource}
            inputProps={{ min: 0, max: 100, step: 0.5 }}
            onChange={(event) => updateSelectedCoordinate('positionX', Number(event.target.value))}
          />
          <FormField
            type="number"
            label={t('workplace.admin.locations.positionY')}
            value={selectedResource?.positionY ?? ''}
            disabled={!selectedResource}
            inputProps={{ min: 0, max: 100, step: 0.5 }}
            onChange={(event) => updateSelectedCoordinate('positionY', Number(event.target.value))}
          />
          <ActionButton
            intent="danger"
            startIcon={<Trash2 size={16} />}
            disabled={!selectedResource}
            onClick={removeSelected}
          >
            {t('workplace.admin.locations.removeFromLayout')}
          </ActionButton>
        </Box>
      ) : null}
      <Box
        sx={{
          overflow: 'auto',
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.default',
          p: 1,
        }}
      >
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <Box
            ref={canvasRef}
            data-testid="workplace-layout-editor"
            sx={(theme) => ({
              position: 'relative',
              width: `${zoom}%`,
              minWidth: 0,
              aspectRatio: `${floor.planWidth} / ${floor.planHeight}`,
              minHeight: { xs: 240, sm: 440 },
              overflow: 'hidden',
              bgcolor: theme.palette.mode === 'dark' ? '#171B21' : '#F8FAFC',
              backgroundImage: floor.backgroundAssetPath
                ? `linear-gradient(${alpha(theme.palette.background.paper, 0.1)}, ${alpha(theme.palette.background.paper, 0.1)}), url(${floor.backgroundAssetPath})`
                : `linear-gradient(${alpha(theme.palette.divider, 0.35)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(theme.palette.divider, 0.35)} 1px, transparent 1px)`,
              backgroundSize: floor.backgroundAssetPath ? 'contain' : '40px 40px',
              backgroundRepeat: floor.backgroundAssetPath ? 'no-repeat' : 'repeat',
              backgroundPosition: 'center',
            })}
          >
            {items.map((resource) => (
              <DraggableResource
                key={resource.resourceId}
                resource={resource}
                selected={resource.resourceId === selectedId}
                editable={editable}
                showEditAction={showResourceEditActions}
                onEdit={onEdit}
                onSelect={setSelectedId}
              />
            ))}
          </Box>
        </DndContext>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        {t('workplace.admin.locations.keyboardHint')}
      </Typography>
      {blockNavigation ? <LayoutNavigationGuard dirty={dirtyCount > 0} /> : null}
    </Box>
  );
}

function LayoutNavigationGuard({ dirty }: { dirty: boolean }) {
  const { t } = useTranslation('rooms');
  const navigationBlocker = useBlocker(dirty);
  return (
    <ConfirmDialog
      open={navigationBlocker.state === 'blocked'}
      title={t('workplace.admin.locations.unsavedTitle')}
      description={t('workplace.admin.locations.unsavedDescription')}
      cancelLabel={t('actions.keep')}
      confirmLabel={t('workplace.admin.locations.discardChanges')}
      intent="danger"
      onClose={() => navigationBlocker.reset?.()}
      onConfirm={() => navigationBlocker.proceed?.()}
    />
  );
}
