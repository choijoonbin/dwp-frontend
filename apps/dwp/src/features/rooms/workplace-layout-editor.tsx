import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical, Minus, Pencil, Plus, Save } from 'lucide-react';
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
import { ActionButton, ActionIconButton, ConfirmDialog } from '@dwp-frontend/design-system';

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
  onEdit,
}: {
  resource: WorkplaceResource;
  selected: boolean;
  onEdit: (resource: WorkplaceResource) => void;
}) {
  const { t } = useTranslation('rooms');
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: resource.resourceId,
  });
  return (
    <Box
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-testid={`layout-resource-${resource.resourceId}`}
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
        cursor: isDragging ? 'grabbing' : 'grab',
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
    </Box>
  );
}

export function WorkplaceLayoutEditor({
  floor,
  resources,
  onEdit,
  onDirtyChange,
}: {
  floor: WorkplaceFloor;
  resources: readonly WorkplaceResource[];
  onEdit: (resource: WorkplaceResource) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { t } = useTranslation('rooms');
  const toast = useToast();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const currentFloorIdRef = useRef(floor.floorId);
  const [items, setItems] = useState<WorkplaceResource[]>([...resources]);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  useEffect(() => {
    const floorChanged = currentFloorIdRef.current !== floor.floorId;
    currentFloorIdRef.current = floor.floorId;
    setItems((current) => {
      if (floorChanged || dirtyIds.size === 0) return [...resources];
      const localById = new Map(current.map((resource) => [resource.resourceId, resource]));
      return resources.map((resource) => {
        const local = localById.get(resource.resourceId);
        if (!local || !dirtyIds.has(resource.resourceId)) return resource;
        return {
          ...resource,
          positionX: local.positionX,
          positionY: local.positionY,
          widthPercent: local.widthPercent,
          heightPercent: local.heightPercent,
          rotationDegrees: local.rotationDegrees,
        };
      });
    });
    if (floorChanged) {
      setDirtyIds(new Set());
      setSelectedId(null);
    }
  }, [dirtyIds, floor.floorId, resources]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );
  const dirty = useMemo(
    () => items.filter((resource) => dirtyIds.has(resource.resourceId)),
    [dirtyIds, items]
  );
  const navigationBlocker = useBlocker(dirty.length > 0);
  useEffect(() => {
    onDirtyChange?.(dirty.length > 0);
  }, [dirty.length, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => {
    if (dirty.length === 0) return undefined;
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', preventUnload);
    return () => window.removeEventListener('beforeunload', preventUnload);
  }, [dirty.length]);
  const saveMutation = useMutation({
    mutationFn: () =>
      saveWorkplaceLayout(
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
      ),
    onSuccess: async () => {
      setDirtyIds(new Set());
      await queryClient.invalidateQueries({ queryKey: ['workplace'] });
      toast.success(t('workplace.admin.locations.layoutSaved'));
    },
    onError: () => toast.error(t('workplace.admin.locations.layoutSaveError')),
  });
  const onDragEnd = ({ active, delta }: DragEndEvent) => {
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
          {dirty.length > 0 && (
            <Chip
              size="small"
              color="warning"
              label={t('workplace.admin.locations.unsavedCount', { count: dirty.length })}
            />
          )}
        </Stack>
        <Stack direction="row" gap={0.5} alignItems="center">
          <ActionIconButton
            size="small"
            label={t('workplace.admin.locations.zoomOut')}
            disabled={zoom <= 80}
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
          <ActionButton
            intent="primary"
            startIcon={<Save size={16} />}
            disabled={dirty.length === 0}
            loading={saveMutation.isPending}
            loadingLabel={t('actions.saving')}
            onClick={() => saveMutation.mutate()}
          >
            {t('workplace.admin.locations.saveLayout')}
          </ActionButton>
        </Stack>
      </Stack>
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
              minWidth: 760,
              aspectRatio: `${floor.planWidth} / ${floor.planHeight}`,
              minHeight: 440,
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
                onEdit={onEdit}
              />
            ))}
          </Box>
        </DndContext>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        {t('workplace.admin.locations.keyboardHint')}
      </Typography>
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
    </Box>
  );
}
