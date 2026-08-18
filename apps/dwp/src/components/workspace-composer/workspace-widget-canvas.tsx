import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, GripVertical, LockKeyhole, X } from 'lucide-react';
import { ActionIconButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import { alpha } from '@mui/material/styles';

import {
  reorderWorkspaceWidgets,
  moveWorkspaceWidget,
  setWorkspaceWidgetHeight,
  setWorkspaceWidgetSize,
  setWorkspaceWidgetVisibility,
} from './workspace-composer-model';
import {
  WORKSPACE_WIDGET_GRID_COLUMNS,
  workspaceWidgetBlockSize,
  workspaceWidgetGridColumn,
  workspaceWidgetSpacing,
} from './workspace-widget-layout-policy';
import { WorkspaceWidgetFootprintPicker } from './workspace-widget-footprint-picker';

import type {
  CollisionDetection,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import type {
  HomePresentation,
  HomeWidgetHeight,
  HomeWidgetSize,
  PersonalHomeWidgetPreference,
} from '@dwp-frontend/shared-utils';
import type { WorkspaceWidgetDefinition } from './workspace-composer-model';

type WorkspaceWidgetCanvasProps<WidgetKey extends string> = {
  registry: readonly WorkspaceWidgetDefinition<WidgetKey>[];
  widgets: readonly PersonalHomeWidgetPreference<WidgetKey>[];
  governedWidgets?: readonly GovernedWorkspaceWidget[];
  editing: boolean;
  busy?: boolean;
  presentation?: HomePresentation;
  getLabel: (widgetKey: WidgetKey) => string;
  onChange: (widgets: PersonalHomeWidgetPreference<WidgetKey>[]) => void;
  renderWidget: (
    widgetKey: WidgetKey,
    size: HomeWidgetSize,
    height: HomeWidgetHeight
  ) => React.ReactNode;
};

export type GovernedWorkspaceWidget = {
  widgetKey: string;
  label: string;
  size: HomeWidgetSize;
  height: HomeWidgetHeight;
  surface?: 'card' | 'plain';
  content: React.ReactNode;
};

type SortableWidgetProps<WidgetKey extends string> = {
  definition: WorkspaceWidgetDefinition<WidgetKey>;
  widget: PersonalHomeWidgetPreference<WidgetKey>;
  editing: boolean;
  busy: boolean;
  label: string;
  onRemove: () => void;
  onResize: (size: HomeWidgetSize) => void;
  onResizeHeight: (height: HomeWidgetHeight) => void;
  onMove: (direction: -1 | 1) => void;
  first: boolean;
  last: boolean;
  inlineInset: Readonly<{ xs: number; sm: number; lg: number }>;
  children: React.ReactNode;
};

const workspaceWidgetCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args);
};

function reorderWidgetKeys<WidgetKey extends string>(
  keys: readonly WidgetKey[],
  activeKey: WidgetKey,
  overKey: WidgetKey
): WidgetKey[] {
  const activeIndex = keys.indexOf(activeKey);
  const overIndex = keys.indexOf(overKey);
  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) return [...keys];
  const next = [...keys];
  const [active] = next.splice(activeIndex, 1);
  if (!active) return [...keys];
  next.splice(overIndex, 0, active);
  return next;
}

function WorkspaceWidgetContent({ children }: { children: React.ReactNode }) {
  return (
    <Box
      data-workspace-widget-content
      sx={{
        flex: 1,
        minHeight: 0,
        overflowX: { xs: 'visible', sm: 'hidden' },
        overflowY: { xs: 'visible', sm: 'auto' },
        overscrollBehavior: 'contain',
        scrollbarGutter: 'stable',
        '& > section': {
          height: 'auto !important',
          minHeight: '100% !important',
          overflow: 'visible !important',
        },
      }}
    >
      {children}
    </Box>
  );
}

function SortableWidget<WidgetKey extends string>({
  definition,
  widget,
  editing,
  busy,
  label,
  onRemove,
  onResize,
  onResizeHeight,
  onMove,
  first,
  last,
  inlineInset,
  children,
}: SortableWidgetProps<WidgetKey>) {
  const { t } = useTranslation('composer');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.widgetKey,
    disabled: !editing || busy,
  });
  const size = widget.size ?? definition.defaultSize;
  const height = widget.height ?? definition.defaultHeight;
  const blockSize = workspaceWidgetBlockSize(height);
  const dropPreviewTransform = isDragging ? null : transform;

  return (
    <Box
      ref={setNodeRef}
      data-workspace-widget={widget.widgetKey}
      data-workspace-widget-size={size}
      data-workspace-widget-height={height}
      data-workspace-widget-policy="PERSONAL"
      data-workspace-widget-surface={definition.surface ?? 'card'}
      data-widget-drop-preview={isDragging ? 'true' : undefined}
      sx={(theme) => ({
        position: 'relative',
        minWidth: 0,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        pt: editing ? 5 : 0,
        px: {
          xs: `${inlineInset.xs}px`,
          sm: `${inlineInset.sm}px`,
          lg: `${inlineInset.lg}px`,
        },
        gridColumn: workspaceWidgetGridColumn(size),
        height: {
          xs: 'auto',
          sm: blockSize.sm + (editing ? 40 : 0),
        },
        opacity: 1,
        transform: CSS.Transform.toString(dropPreviewTransform),
        transition,
        zIndex: isDragging ? 4 : 1,
        willChange: isDragging ? 'transform' : 'auto',
        borderRadius: 1,
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        '& > [data-workspace-widget-content]': {
          opacity: isDragging ? 0 : 1,
          visibility: isDragging ? 'hidden' : 'visible',
          transition: 'opacity 120ms ease',
        },
        '&::after': editing
          ? {
              content: '""',
              position: 'absolute',
              insetBlock: 0,
              left: {
                xs: `${inlineInset.xs}px`,
                sm: `${inlineInset.sm}px`,
                lg: `${inlineInset.lg}px`,
              },
              right: {
                xs: `${inlineInset.xs}px`,
                sm: `${inlineInset.sm}px`,
                lg: `${inlineInset.lg}px`,
              },
              border: isDragging
                ? `2px dashed ${theme.palette.primary.main}`
                : '2px solid rgba(37,99,235,0.52)',
              borderRadius: 1,
              backgroundColor: isDragging
                ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.1)
                : 'transparent',
              boxShadow: isDragging
                ? `inset 0 0 0 1px ${alpha(theme.palette.common.white, 0.5)}, 0 10px 30px ${alpha(
                    theme.palette.primary.main,
                    0.18
                  )}`
                : 'none',
              pointerEvents: 'none',
              zIndex: 5,
              transition:
                'background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease',
            }
          : undefined,
      })}
    >
      <WorkspaceWidgetContent>{children}</WorkspaceWidgetContent>
      {isDragging && (
        <Box
          data-widget-drop-slot
          aria-hidden="true"
          sx={{
            position: 'absolute',
            insetBlock: 0,
            left: {
              xs: `${inlineInset.xs}px`,
              sm: `${inlineInset.sm}px`,
              lg: `${inlineInset.lg}px`,
            },
            right: {
              xs: `${inlineInset.xs}px`,
              sm: `${inlineInset.sm}px`,
              lg: `${inlineInset.lg}px`,
            },
            zIndex: 6,
            display: 'grid',
            placeItems: 'center',
            pointerEvents: 'none',
          }}
        >
          <Box
            sx={(theme) => ({
              width: 42,
              height: 42,
              display: 'grid',
              placeItems: 'center',
              border: 1,
              borderColor: alpha(theme.palette.primary.main, 0.4),
              borderRadius: '50%',
              bgcolor: alpha(theme.palette.background.paper, 0.9),
              color: 'primary.main',
              boxShadow: `0 8px 22px ${alpha(theme.palette.common.black, 0.14)}`,
              backdropFilter: 'blur(12px)',
            })}
          >
            <GripVertical size={20} />
          </Box>
        </Box>
      )}
      {editing && (
        <Box
          sx={{
            position: 'absolute',
            top: 6,
            left: {
              xs: inlineInset.xs + 8,
              sm: inlineInset.sm + 8,
              lg: inlineInset.lg + 8,
            },
            right: {
              xs: inlineInset.xs + 8,
              sm: inlineInset.sm + 8,
              lg: inlineInset.lg + 8,
            },
            zIndex: 7,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            pointerEvents: 'none',
            opacity: isDragging ? 0 : 1,
            visibility: isDragging ? 'hidden' : 'visible',
            transition: 'opacity 100ms ease',
          }}
        >
          <Chip
            {...attributes}
            {...listeners}
            component="button"
            type="button"
            clickable
            disabled={busy}
            icon={<GripVertical size={15} aria-hidden="true" />}
            label={label}
            aria-label={t('moveWidget', { widget: label })}
            sx={{
              pointerEvents: 'auto',
              height: 30,
              maxWidth: 'calc(100% - 142px)',
              bgcolor: 'rgba(255,255,255,0.94)',
              color: 'text.primary',
              cursor: busy ? 'wait' : 'grab',
              boxShadow: '0 6px 18px rgba(15,23,42,0.16)',
              backdropFilter: 'blur(12px)',
              '&:active': { cursor: busy ? 'wait' : 'grabbing' },
            }}
          />
          <Box sx={{ display: 'flex', gap: 0.5, pointerEvents: 'auto' }}>
            <ActionIconButton
              label={t('moveWidgetEarlier', { widget: label })}
              size="small"
              disabled={busy || first}
              onClick={() => onMove(-1)}
              sx={{
                width: 28,
                height: 28,
                bgcolor: 'grey.900',
                color: 'common.white',
                border: 1,
                borderColor: 'rgba(255,255,255,0.8)',
                '&:hover': { bgcolor: 'grey.800' },
              }}
            >
              <ArrowUp size={14} />
            </ActionIconButton>
            <ActionIconButton
              label={t('moveWidgetLater', { widget: label })}
              size="small"
              disabled={busy || last}
              onClick={() => onMove(1)}
              sx={{
                width: 28,
                height: 28,
                bgcolor: 'grey.900',
                color: 'common.white',
                border: 1,
                borderColor: 'rgba(255,255,255,0.8)',
                '&:hover': { bgcolor: 'grey.800' },
              }}
            >
              <ArrowDown size={14} />
            </ActionIconButton>
            {(definition.allowedSizes.length > 1 || definition.allowedHeights.length > 1) && (
              <WorkspaceWidgetFootprintPicker
                label={label}
                value={size}
                options={definition.allowedSizes}
                height={height}
                heightOptions={definition.allowedHeights}
                disabled={busy}
                onChange={onResize}
                onHeightChange={onResizeHeight}
              />
            )}
            {definition.canHide ? (
              <ActionIconButton
                label={t('removeWidget', { widget: label })}
                size="small"
                disabled={busy}
                onClick={onRemove}
                sx={{
                  width: 28,
                  height: 28,
                  bgcolor: 'grey.900',
                  color: 'common.white',
                  border: 1,
                  borderColor: 'rgba(255,255,255,0.8)',
                  '&:hover': { bgcolor: 'error.main' },
                }}
              >
                <X size={15} />
              </ActionIconButton>
            ) : (
              <Tooltip title={t('governed')}>
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: '50%',
                    bgcolor: 'rgba(255,255,255,0.94)',
                    color: 'text.secondary',
                    boxShadow: '0 5px 14px rgba(15,23,42,0.14)',
                  }}
                >
                  <LockKeyhole size={14} aria-label={t('governed')} />
                </Box>
              </Tooltip>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}

function GovernedWidget({
  widget,
  editing,
  inlineInset,
}: {
  widget: GovernedWorkspaceWidget;
  editing: boolean;
  inlineInset: Readonly<{ xs: number; sm: number; lg: number }>;
}) {
  const { t } = useTranslation('composer');
  return (
    <Box
      data-workspace-widget={widget.widgetKey}
      data-workspace-widget-size={widget.size}
      data-workspace-widget-height={widget.height}
      data-workspace-widget-policy="GOVERNED"
      data-workspace-widget-surface={widget.surface ?? 'plain'}
      sx={{
        position: 'relative',
        minWidth: 0,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        pt: editing ? 5 : 0,
        px: {
          xs: `${inlineInset.xs}px`,
          sm: `${inlineInset.sm}px`,
          lg: `${inlineInset.lg}px`,
        },
        gridColumn: workspaceWidgetGridColumn(widget.size),
        height: {
          xs: 'auto',
          sm: workspaceWidgetBlockSize(widget.height).sm + (editing ? 40 : 0),
        },
        '&::after': editing
          ? {
              content: '""',
              position: 'absolute',
              insetBlock: 0,
              left: {
                xs: `${inlineInset.xs}px`,
                sm: `${inlineInset.sm}px`,
                lg: `${inlineInset.lg}px`,
              },
              right: {
                xs: `${inlineInset.xs}px`,
                sm: `${inlineInset.sm}px`,
                lg: `${inlineInset.lg}px`,
              },
              border: '1px dashed',
              borderColor: 'text.disabled',
              borderRadius: 1,
              pointerEvents: 'none',
              zIndex: 5,
            }
          : undefined,
      }}
    >
      <WorkspaceWidgetContent>{widget.content}</WorkspaceWidgetContent>
      {editing && (
        <Chip
          icon={<LockKeyhole size={14} aria-hidden="true" />}
          label={`${widget.label} (${t('governed')})`}
          size="small"
          sx={{
            position: 'absolute',
            top: 6,
            left: {
              xs: inlineInset.xs + 8,
              sm: inlineInset.sm + 8,
              lg: inlineInset.lg + 8,
            },
            zIndex: 7,
            maxWidth: 'calc(100% - 32px)',
            bgcolor: 'rgba(255,255,255,0.94)',
            color: 'text.secondary',
            boxShadow: '0 6px 18px rgba(15,23,42,0.12)',
            backdropFilter: 'blur(12px)',
          }}
        />
      )}
    </Box>
  );
}

export function WorkspaceWidgetCanvas<WidgetKey extends string>({
  registry,
  widgets,
  governedWidgets = [],
  editing,
  busy = false,
  presentation = 'balanced',
  getLabel,
  onChange,
  renderWidget,
}: WorkspaceWidgetCanvasProps<WidgetKey>) {
  const { t } = useTranslation('composer');
  const [activeKey, setActiveKey] = useState<WidgetKey | null>(null);
  const [previewOrder, setPreviewOrder] = useState<WidgetKey[] | null>(null);
  const dropTargetKeyRef = useRef<WidgetKey | null>(null);
  const definitionByKey = useMemo(
    () => new Map(registry.map((definition) => [definition.key, definition])),
    [registry]
  );
  const visible = useMemo(
    () => widgets.filter((widget) => widget.visible && definitionByKey.has(widget.widgetKey)),
    [definitionByKey, widgets]
  );
  const previewVisible = useMemo(() => {
    if (!previewOrder) return visible;
    const visibleByKey = new Map(visible.map((widget) => [widget.widgetKey, widget]));
    return previewOrder
      .map((widgetKey) => visibleByKey.get(widgetKey))
      .filter((widget): widget is PersonalHomeWidgetPreference<WidgetKey> => widget !== undefined);
  }, [previewOrder, visible]);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 240, tolerance: 7 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const clearDragPreview = () => {
    setActiveKey(null);
    setPreviewOrder(null);
    dropTargetKeyRef.current = null;
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    const nextActiveKey = String(active.id) as WidgetKey;
    setActiveKey(nextActiveKey);
    setPreviewOrder(visible.map((widget) => widget.widgetKey));
    dropTargetKeyRef.current = null;
  };

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const nextActiveKey = String(active.id) as WidgetKey;
    const nextOverKey = String(over.id) as WidgetKey;
    if (nextOverKey === nextActiveKey) return;
    dropTargetKeyRef.current = nextOverKey;
    setPreviewOrder((current) =>
      reorderWidgetKeys(
        current ?? visible.map((widget) => widget.widgetKey),
        nextActiveKey,
        nextOverKey
      )
    );
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const nextActiveKey = String(active.id) as WidgetKey;
    const nextOverKey = dropTargetKeyRef.current;
    clearDragPreview();
    if (!over || !nextOverKey) return;
    onChange(reorderWorkspaceWidgets(widgets, nextActiveKey, nextOverKey));
  };
  const spacing = workspaceWidgetSpacing(presentation);
  const inlineInset = spacing.inlineInset;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={workspaceWidgetCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragCancel={clearDragPreview}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={previewVisible.map((widget) => widget.widgetKey)}
        strategy={rectSortingStrategy}
      >
        <Box
          data-workspace-presentation={presentation}
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              sm: `repeat(${WORKSPACE_WIDGET_GRID_COLUMNS}, minmax(0, 1fr))`,
            },
            mx: {
              xs: `${-inlineInset.xs}px`,
              sm: `${-inlineInset.sm}px`,
              lg: `${-inlineInset.lg}px`,
            },
            columnGap: {
              xs: spacing.virtualColumnGapPx.xs,
              sm: `${spacing.virtualColumnGapPx.sm}px`,
            },
            rowGap: spacing.rowGap,
            alignItems: 'start',
          }}
        >
          {governedWidgets.map((widget) => (
            <GovernedWidget
              key={widget.widgetKey}
              widget={widget}
              editing={editing}
              inlineInset={inlineInset}
            />
          ))}
          {previewVisible.map((widget, index) => {
            const definition = definitionByKey.get(widget.widgetKey);
            if (!definition) return null;
            const size = widget.size ?? definition.defaultSize;
            const height = widget.height ?? definition.defaultHeight;
            return (
              <SortableWidget
                key={widget.widgetKey}
                definition={definition}
                widget={widget}
                editing={editing}
                busy={busy}
                label={getLabel(widget.widgetKey)}
                onRemove={() =>
                  onChange(setWorkspaceWidgetVisibility(widgets, registry, widget.widgetKey, false))
                }
                onResize={(nextSize) =>
                  onChange(setWorkspaceWidgetSize(widgets, registry, widget.widgetKey, nextSize))
                }
                onResizeHeight={(nextHeight) =>
                  onChange(
                    setWorkspaceWidgetHeight(widgets, registry, widget.widgetKey, nextHeight)
                  )
                }
                onMove={(direction) =>
                  onChange(moveWorkspaceWidget(widgets, widget.widgetKey, direction))
                }
                first={index === 0}
                last={index === previewVisible.length - 1}
                inlineInset={inlineInset}
              >
                {renderWidget(widget.widgetKey, size, height)}
              </SortableWidget>
            );
          })}
        </Box>
      </SortableContext>
      <DragOverlay dropAnimation={null}>
        {activeKey ? (
          <Box
            data-widget-drag-overlay
            sx={(theme) => ({
              minWidth: 260,
              maxWidth: 360,
              minHeight: 62,
              px: 1.5,
              py: 1.25,
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              border: '1.5px solid',
              borderColor: 'primary.main',
              borderRadius: 1,
              bgcolor: alpha(theme.palette.background.paper, 0.96),
              color: 'text.primary',
              boxShadow: `0 22px 54px ${alpha(theme.palette.common.black, 0.26)}, 0 0 0 1px ${alpha(
                theme.palette.common.white,
                0.6
              )} inset`,
              backdropFilter: 'blur(18px)',
              cursor: 'grabbing',
            })}
          >
            <Box
              aria-hidden="true"
              sx={(theme) => ({
                width: 38,
                height: 38,
                flex: '0 0 auto',
                display: 'grid',
                placeItems: 'center',
                borderRadius: 1,
                bgcolor: alpha(theme.palette.primary.main, 0.12),
                color: 'primary.main',
              })}
            >
              <GripVertical size={19} />
            </Box>
            <Box
              component="span"
              sx={{
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontWeight: 700,
                fontSize: '0.875rem',
              }}
            >
              {getLabel(activeKey) || t('widgetFallback')}
            </Box>
          </Box>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
