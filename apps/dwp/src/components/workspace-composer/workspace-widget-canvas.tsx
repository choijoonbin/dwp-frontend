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
  WORKSPACE_WIDGET_EDITOR_CHROME_PX,
  WORKSPACE_WIDGET_GRID_COLUMNS,
  workspaceWidgetBlockSize,
  workspaceWidgetGridColumn,
  workspaceWidgetSpacing,
} from './workspace-widget-layout-policy';
import { WorkspaceWidgetFootprintPicker } from './workspace-widget-footprint-picker';
import {
  GovernedWidget,
  WorkspaceWidgetContent,
  type GovernedWorkspaceWidget,
} from './workspace-widget-frame';
import {
  WORKSPACE_WIDGET_SETTLE_DURATION_MS,
  WORKSPACE_WIDGET_SETTLE_FALLBACK_EASING,
  WORKSPACE_WIDGET_SETTLE_SPRING_EASING,
  useReadModeWidgetLongPress,
  workspaceWidgetSettle,
  workspaceWidgetSettleDelayMs,
} from './workspace-edit-motion';

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

export type { GovernedWorkspaceWidget } from './workspace-widget-frame';

type WorkspaceWidgetCanvasProps<WidgetKey extends string> = {
  registry: readonly WorkspaceWidgetDefinition<WidgetKey>[];
  widgets: readonly PersonalHomeWidgetPreference<WidgetKey>[];
  governedWidgets?: readonly GovernedWorkspaceWidget[];
  trailingGovernedWidgets?: readonly GovernedWorkspaceWidget[];
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
  onStartEditing?: () => void;
  scrollMode?: 'contained' | 'document';
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
  keyboardDragging: boolean;
  motionDelayMs: number;
  inlineInset: Readonly<{ xs: number; sm: number; lg: number }>;
  scrollMode: 'contained' | 'document';
  onStartEditing?: () => void;
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

function widgetKeyOrdersMatch<WidgetKey extends string>(
  left: readonly WidgetKey[] | null,
  right: readonly WidgetKey[]
): boolean {
  return (
    left !== null &&
    left.length === right.length &&
    left.every((key, index) => key === right[index])
  );
}

export type WorkspaceWidgetDropOutcome = Readonly<{
  moved: boolean;
  position: number;
}>;

export function resolveWorkspaceWidgetDropOutcome<WidgetKey extends string>(
  keys: readonly WidgetKey[],
  activeKey: WidgetKey,
  finalOverKey: WidgetKey | null,
  previewTargetKey: WidgetKey | null
): WorkspaceWidgetDropOutcome {
  const targetKey = resolveWorkspaceWidgetDropTarget(activeKey, finalOverKey, previewTargetKey);
  const originalPosition = Math.max(0, keys.indexOf(activeKey)) + 1;
  if (!targetKey) return { moved: false, position: originalPosition };
  const next = reorderWidgetKeys(keys, activeKey, targetKey);
  const nextPosition = Math.max(0, next.indexOf(activeKey)) + 1;
  return { moved: nextPosition !== originalPosition, position: nextPosition };
}

export function resolveWorkspaceWidgetDropTarget<WidgetKey extends string>(
  activeKey: WidgetKey,
  finalOverKey: WidgetKey | null,
  previewTargetKey: WidgetKey | null
): WidgetKey | null {
  if (!finalOverKey) return null;
  // Once the destination footprint moves under the pointer, collision
  // detection naturally reports the active widget itself. Preserve the last
  // meaningful destination instead of treating that stable preview as a
  // cancelled drop.
  if (finalOverKey === activeKey) return previewTargetKey;
  return previewTargetKey ?? finalOverKey;
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
  keyboardDragging,
  motionDelayMs,
  inlineInset,
  scrollMode,
  onStartEditing,
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
  const documentScroll = scrollMode === 'document';
  const dropPreviewTransform = isDragging ? null : transform;
  const readModeLongPress = useReadModeWidgetLongPress(
    !editing && !busy ? onStartEditing : undefined
  );

  return (
    <Box
      {...readModeLongPress}
      ref={setNodeRef}
      data-workspace-widget={widget.widgetKey}
      data-workspace-widget-size={size}
      data-workspace-widget-height={height}
      data-workspace-widget-policy="PERSONAL"
      data-workspace-widget-surface={definition.surface ?? 'card'}
      data-workspace-widget-motion={editing ? 'settle' : 'idle'}
      data-workspace-widget-long-press={!editing && onStartEditing ? 'enabled' : undefined}
      data-widget-drop-preview={isDragging ? 'true' : undefined}
      sx={(theme) => ({
        position: 'relative',
        minWidth: 0,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        pt: editing ? `${WORKSPACE_WIDGET_EDITOR_CHROME_PX}px` : 0,
        px: {
          xs: `${inlineInset.xs}px`,
          sm: `${inlineInset.sm}px`,
          lg: `${inlineInset.lg}px`,
        },
        gridColumn: workspaceWidgetGridColumn(size),
        // Document scrolling owns wheel input. Height tokens are an edit-mode
        // footprint only; read mode is content-adaptive so sparse widgets do
        // not turn the selected footprint into blank space. Contained canvases
        // keep their fixed viewport.
        height: documentScroll
          ? editing
            ? {
                xs: 'auto',
                sm: blockSize.sm + WORKSPACE_WIDGET_EDITOR_CHROME_PX,
              }
            : 'auto'
          : {
              xs: 'auto',
              sm: blockSize.sm + (editing ? WORKSPACE_WIDGET_EDITOR_CHROME_PX : 0),
            },
        minHeight: 0,
        alignSelf: documentScroll ? 'start' : 'stretch',
        opacity: 1,
        transform: CSS.Transform.toString(dropPreviewTransform),
        transformOrigin: 'center',
        animation: 'none',
        transition,
        zIndex: isDragging ? 4 : 1,
        willChange: isDragging ? 'transform' : 'auto',
        borderRadius: 1,
        '& > [data-workspace-widget-content]': {
          opacity: isDragging ? 0 : editing ? 0.68 : 1,
          visibility: isDragging ? 'hidden' : 'visible',
          transition: 'opacity 120ms ease',
          transformOrigin: 'center',
          animationName: editing && !isDragging ? `${workspaceWidgetSettle}` : 'none',
          animationDuration:
            editing && !isDragging ? `${WORKSPACE_WIDGET_SETTLE_DURATION_MS}ms` : '0ms',
          animationTimingFunction: WORKSPACE_WIDGET_SETTLE_FALLBACK_EASING,
          animationDelay: editing && !isDragging ? `${motionDelayMs}ms` : '0ms',
          animationIterationCount: 1,
          animationFillMode: 'backwards',
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
              transformOrigin: 'center',
              animation: !isDragging
                ? `${workspaceWidgetSettle} ${WORKSPACE_WIDGET_SETTLE_DURATION_MS}ms ${WORKSPACE_WIDGET_SETTLE_FALLBACK_EASING} ${motionDelayMs}ms 1 backwards`
                : 'none',
              pointerEvents: 'none',
              zIndex: 5,
              transition:
                'background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease',
            }
          : undefined,
        '@supports (animation-timing-function: linear(0, 1))': {
          '& > [data-workspace-widget-content]': {
            animationTimingFunction: WORKSPACE_WIDGET_SETTLE_SPRING_EASING,
          },
          '&::after': {
            animationTimingFunction: WORKSPACE_WIDGET_SETTLE_SPRING_EASING,
          },
        },
        '@media (prefers-reduced-transparency: reduce)': {
          '&::after': {
            backgroundColor: isDragging ? theme.palette.background.paper : 'transparent',
            boxShadow: 'none',
          },
        },
        '@media (forced-colors: active)': {
          '&::after': {
            borderColor: 'CanvasText',
            backgroundColor: isDragging ? 'Canvas' : 'transparent',
            boxShadow: 'none',
          },
        },
        'html[data-motion="reduced"] &': {
          animation: 'none',
          transition: 'none',
          translate: 'none',
          rotate: 'none',
          '& > [data-workspace-widget-content], &::after': {
            animation: 'none',
            transition: 'none',
            transform: 'none',
            willChange: 'auto',
          },
        },
        '@media (prefers-reduced-motion: reduce)': {
          animation: 'none',
          transition: 'none',
          translate: 'none',
          rotate: 'none',
          '& > [data-workspace-widget-content], &::after': {
            animation: 'none',
            transition: 'none',
            transform: 'none',
            willChange: 'auto',
          },
        },
      })}
    >
      <WorkspaceWidgetContent editing={editing} scrollMode={scrollMode}>
        {children}
      </WorkspaceWidgetContent>
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
              WebkitBackdropFilter: 'blur(12px)',
              '@media (prefers-reduced-transparency: reduce)': {
                bgcolor: 'background.paper',
                boxShadow: 'none',
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
              },
              '@media (forced-colors: active)': {
                bgcolor: 'Canvas',
                color: 'CanvasText',
                borderColor: 'CanvasText',
                boxShadow: 'none',
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
              },
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
            top: 0,
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
            opacity: isDragging && !keyboardDragging ? 0 : 1,
            visibility: isDragging && !keyboardDragging ? 'hidden' : 'visible',
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
              minHeight: 44,
              maxWidth: 'calc(100% - 206px)',
              bgcolor: 'rgba(255,255,255,0.94)',
              color: 'text.primary',
              cursor: busy ? 'wait' : 'grab',
              boxShadow: '0 6px 18px rgba(15,23,42,0.16)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              '&:active': { cursor: busy ? 'wait' : 'grabbing' },
              '@media (prefers-reduced-transparency: reduce)': {
                bgcolor: 'background.paper',
                boxShadow: 'none',
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
              },
              '@media (forced-colors: active)': {
                bgcolor: 'Canvas',
                color: 'CanvasText',
                border: '1px solid CanvasText',
                boxShadow: 'none',
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
              },
            }}
          />
          <Box sx={{ display: 'flex', gap: 0.5, pointerEvents: 'auto' }}>
            <ActionIconButton
              label={t('moveWidgetEarlier', { widget: label })}
              size="small"
              disabled={busy || first}
              onClick={() => onMove(-1)}
              sx={{
                width: 44,
                height: 44,
                bgcolor: 'background.paper',
                color: 'text.primary',
                border: 1,
                borderColor: 'divider',
                boxShadow: '0 4px 12px rgba(15,23,42,0.12)',
                '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' },
                '@media (forced-colors: active)': {
                  bgcolor: 'ButtonFace',
                  color: 'ButtonText',
                  borderColor: 'ButtonText',
                },
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
                width: 44,
                height: 44,
                bgcolor: 'background.paper',
                color: 'text.primary',
                border: 1,
                borderColor: 'divider',
                boxShadow: '0 4px 12px rgba(15,23,42,0.12)',
                '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' },
                '@media (forced-colors: active)': {
                  bgcolor: 'ButtonFace',
                  color: 'ButtonText',
                  borderColor: 'ButtonText',
                },
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
                  width: 44,
                  height: 44,
                  bgcolor: 'background.paper',
                  color: 'text.primary',
                  border: 1,
                  borderColor: 'divider',
                  boxShadow: '0 4px 12px rgba(15,23,42,0.12)',
                  '&:hover': {
                    bgcolor: 'action.hover',
                    color: 'error.main',
                    borderColor: 'error.main',
                  },
                  '@media (forced-colors: active)': {
                    bgcolor: 'ButtonFace',
                    color: 'ButtonText',
                    borderColor: 'ButtonText',
                  },
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
                    '@media (prefers-reduced-transparency: reduce)': {
                      bgcolor: 'background.paper',
                      boxShadow: 'none',
                    },
                    '@media (forced-colors: active)': {
                      bgcolor: 'Canvas',
                      color: 'CanvasText',
                      border: '1px solid CanvasText',
                      boxShadow: 'none',
                    },
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

export function WorkspaceWidgetCanvas<WidgetKey extends string>({
  registry,
  widgets,
  governedWidgets = [],
  trailingGovernedWidgets = [],
  editing,
  busy = false,
  presentation = 'balanced',
  getLabel,
  onChange,
  renderWidget,
  onStartEditing,
  scrollMode = 'contained',
}: WorkspaceWidgetCanvasProps<WidgetKey>) {
  const { t } = useTranslation('composer');
  const [activeKey, setActiveKey] = useState<WidgetKey | null>(null);
  const [activeInput, setActiveInput] = useState<'keyboard' | 'pointer' | null>(null);
  const [previewOrder, setPreviewOrder] = useState<WidgetKey[] | null>(null);
  const dropTargetKeyRef = useRef<WidgetKey | null>(null);
  const dropOutcomeRef = useRef<
    Readonly<{ activeKey: WidgetKey; outcome: WorkspaceWidgetDropOutcome }> | undefined
  >(undefined);
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
    setActiveInput(null);
    setPreviewOrder(null);
    dropTargetKeyRef.current = null;
  };

  const handleDragStart = ({ active, activatorEvent }: DragStartEvent) => {
    const nextActiveKey = String(active.id) as WidgetKey;
    dropOutcomeRef.current = undefined;
    setActiveKey(nextActiveKey);
    setActiveInput(activatorEvent.type === 'keydown' ? 'keyboard' : 'pointer');
    setPreviewOrder(visible.map((widget) => widget.widgetKey));
    dropTargetKeyRef.current = null;
  };

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const nextActiveKey = String(active.id) as WidgetKey;
    const nextOverKey = String(over.id) as WidgetKey;
    const baseOrder = visible.map((widget) => widget.widgetKey);
    if (nextOverKey === nextActiveKey) {
      // The active footprint moves into the destination slot. Its own
      // collision must not clear the target and move the DOM back, otherwise
      // pointer collisions oscillate indefinitely between both orders.
      return;
    }

    // Drag-over can fire repeatedly for the same collision target while the
    // preview itself is moving. Reordering the current preview toggles the
    // dragged item back and forth and can create a React update loop. Always
    // derive the preview from the stable committed order and ignore duplicate
    // target events.
    if (dropTargetKeyRef.current === nextOverKey) return;
    dropTargetKeyRef.current = nextOverKey;
    const nextOrder = reorderWidgetKeys(baseOrder, nextActiveKey, nextOverKey);
    setPreviewOrder((current) => (widgetKeyOrdersMatch(current, nextOrder) ? current : nextOrder));
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const nextActiveKey = String(active.id) as WidgetKey;
    const finalOverKey = over ? (String(over.id) as WidgetKey) : null;
    const nextOverKey = resolveWorkspaceWidgetDropTarget(
      nextActiveKey,
      finalOverKey,
      dropTargetKeyRef.current
    );
    dropOutcomeRef.current = {
      activeKey: nextActiveKey,
      outcome: resolveWorkspaceWidgetDropOutcome(
        visible.map((widget) => widget.widgetKey),
        nextActiveKey,
        finalOverKey,
        dropTargetKeyRef.current
      ),
    };
    clearDragPreview();
    if (!nextOverKey) return;
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
      accessibility={{
        screenReaderInstructions: {
          draggable: t('drag.instructions'),
        },
        announcements: {
          onDragStart: ({ active }) =>
            t('drag.pickedUp', {
              widget: getLabel(String(active.id) as WidgetKey),
              count: previewVisible.length,
            }),
          onDragOver: ({ over }) =>
            over
              ? t('drag.over', {
                  widget: getLabel(String(over.id) as WidgetKey),
                  position:
                    previewVisible.findIndex((widget) => widget.widgetKey === String(over.id)) + 1,
                  count: previewVisible.length,
                })
              : t('drag.notOver'),
          onDragEnd: ({ active, over }) => {
            const activeKey = String(active.id) as WidgetKey;
            const cached = dropOutcomeRef.current;
            const outcome =
              cached?.activeKey === activeKey
                ? cached.outcome
                : resolveWorkspaceWidgetDropOutcome(
                    visible.map((widget) => widget.widgetKey),
                    activeKey,
                    over ? (String(over.id) as WidgetKey) : null,
                    dropTargetKeyRef.current
                  );
            return outcome.moved
              ? t('drag.placed', {
                  widget: getLabel(activeKey),
                  position: outcome.position,
                  count: previewVisible.length,
                })
              : t('drag.returned', { widget: getLabel(activeKey) });
          },
          onDragCancel: ({ active }) =>
            t('drag.cancelled', { widget: getLabel(String(active.id) as WidgetKey) }),
        },
      }}
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
            alignItems: scrollMode === 'document' ? 'start' : 'stretch',
          }}
        >
          {governedWidgets.map((widget) => (
            <GovernedWidget
              key={widget.widgetKey}
              widget={widget}
              editing={editing}
              inlineInset={inlineInset}
              scrollMode={scrollMode}
              onStartEditing={!editing && !busy ? onStartEditing : undefined}
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
                keyboardDragging={activeKey === widget.widgetKey && activeInput === 'keyboard'}
                motionDelayMs={workspaceWidgetSettleDelayMs(index)}
                inlineInset={inlineInset}
                scrollMode={scrollMode}
                onStartEditing={!editing && !busy ? onStartEditing : undefined}
              >
                {renderWidget(widget.widgetKey, size, height)}
              </SortableWidget>
            );
          })}
          {trailingGovernedWidgets.map((widget) => (
            <GovernedWidget
              key={widget.widgetKey}
              widget={widget}
              editing={editing}
              inlineInset={inlineInset}
              scrollMode={scrollMode}
              onStartEditing={!editing && !busy ? onStartEditing : undefined}
            />
          ))}
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
              WebkitBackdropFilter: 'blur(18px)',
              cursor: 'grabbing',
              '@media (prefers-reduced-transparency: reduce)': {
                bgcolor: 'background.paper',
                boxShadow: 'none',
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
              },
              '@media (forced-colors: active)': {
                bgcolor: 'Canvas',
                color: 'CanvasText',
                borderColor: 'CanvasText',
                boxShadow: 'none',
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
              },
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
                '@media (forced-colors: active)': {
                  bgcolor: 'Canvas',
                  color: 'CanvasText',
                  border: '1px solid CanvasText',
                },
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
