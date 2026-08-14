import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
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
import { ArrowDown, ArrowUp, GripVertical, LockKeyhole, Maximize2, X } from 'lucide-react';
import { ActionIconButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';

import {
  reorderWorkspaceWidgets,
  moveWorkspaceWidget,
  setWorkspaceWidgetSize,
  setWorkspaceWidgetVisibility,
} from './workspace-composer-model';

import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import type {
  HomePresentation,
  HomeWidgetSize,
  PersonalHomeWidgetPreference,
} from '@dwp-frontend/shared-utils';
import type { WorkspaceWidgetDefinition } from './workspace-composer-model';

const sizeColumns: Record<HomeWidgetSize, number> = {
  compact: 4,
  medium: 6,
  large: 8,
  full: 12,
};

const sizeGlyph: Record<HomeWidgetSize, string> = {
  compact: '1/3',
  medium: '1/2',
  large: '2/3',
  full: '1/1',
};

type WorkspaceWidgetCanvasProps<WidgetKey extends string> = {
  registry: readonly WorkspaceWidgetDefinition<WidgetKey>[];
  widgets: readonly PersonalHomeWidgetPreference<WidgetKey>[];
  editing: boolean;
  busy?: boolean;
  presentation?: HomePresentation;
  getLabel: (widgetKey: WidgetKey) => string;
  onChange: (widgets: PersonalHomeWidgetPreference<WidgetKey>[]) => void;
  renderWidget: (widgetKey: WidgetKey, size: HomeWidgetSize) => React.ReactNode;
};

type SortableWidgetProps<WidgetKey extends string> = {
  definition: WorkspaceWidgetDefinition<WidgetKey>;
  widget: PersonalHomeWidgetPreference<WidgetKey>;
  editing: boolean;
  busy: boolean;
  label: string;
  onRemove: () => void;
  onResize: (size: HomeWidgetSize) => void;
  onMove: (direction: -1 | 1) => void;
  first: boolean;
  last: boolean;
  children: React.ReactNode;
};

function SortableWidget<WidgetKey extends string>({
  definition,
  widget,
  editing,
  busy,
  label,
  onRemove,
  onResize,
  onMove,
  first,
  last,
  children,
}: SortableWidgetProps<WidgetKey>) {
  const { t } = useTranslation('composer');
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.widgetKey,
    disabled: !editing || busy,
  });
  const size = widget.size ?? definition.defaultSize;

  return (
    <Box
      ref={setNodeRef}
      data-workspace-widget={widget.widgetKey}
      data-workspace-widget-size={size}
      sx={{
        position: 'relative',
        minWidth: 0,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        pt: editing ? 5 : 0,
        gridColumn: {
          xs: '1 / -1',
          md: size === 'compact' ? 'span 6' : '1 / -1',
          lg: `span ${sizeColumns[size]}`,
        },
        opacity: isDragging ? 0.32 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 4 : 1,
        outline: editing ? '2px solid rgba(37,99,235,0.52)' : 'none',
        outlineOffset: editing ? 3 : 0,
        borderRadius: 1,
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        '& > section': { flex: 1, minHeight: 0 },
      }}
    >
      {children}
      {editing && (
        <Box
          sx={{
            position: 'absolute',
            top: 6,
            left: 8,
            right: 8,
            zIndex: 7,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            pointerEvents: 'none',
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
            {definition.allowedSizes.length > 1 && (
              <ActionIconButton
                label={t('resizeWidget', { widget: label })}
                size="small"
                disabled={busy}
                onClick={(event) => setAnchor(event.currentTarget)}
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
                <Maximize2 size={14} />
              </ActionIconButton>
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
          <Menu
            anchorEl={anchor}
            open={Boolean(anchor)}
            onClose={() => setAnchor(null)}
            slotProps={{ paper: { sx: { minWidth: 180, borderRadius: 1 } } }}
          >
            {definition.allowedSizes.map((allowedSize) => (
              <MenuItem
                key={allowedSize}
                selected={allowedSize === size}
                onClick={() => {
                  onResize(allowedSize);
                  setAnchor(null);
                }}
              >
                <ListItemIcon sx={{ minWidth: 34 }}>
                  <Box
                    aria-hidden="true"
                    sx={{
                      width: 22,
                      height: 14,
                      border: 1,
                      borderColor: 'currentColor',
                      borderRadius: 0.5,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: '0.55rem',
                    }}
                  >
                    {sizeGlyph[allowedSize]}
                  </Box>
                </ListItemIcon>
                <ListItemText>{t(`sizes.${allowedSize}`)}</ListItemText>
              </MenuItem>
            ))}
          </Menu>
        </Box>
      )}
    </Box>
  );
}

export function WorkspaceWidgetCanvas<WidgetKey extends string>({
  registry,
  widgets,
  editing,
  busy = false,
  presentation = 'balanced',
  getLabel,
  onChange,
  renderWidget,
}: WorkspaceWidgetCanvasProps<WidgetKey>) {
  const { t } = useTranslation('composer');
  const [activeKey, setActiveKey] = useState<WidgetKey | null>(null);
  const definitionByKey = useMemo(
    () => new Map(registry.map((definition) => [definition.key, definition])),
    [registry]
  );
  const visible = useMemo(
    () => widgets.filter((widget) => widget.visible && definitionByKey.has(widget.widgetKey)),
    [definitionByKey, widgets]
  );
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 240, tolerance: 7 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveKey(null);
    if (!over) return;
    onChange(
      reorderWorkspaceWidgets(widgets, String(active.id) as WidgetKey, String(over.id) as WidgetKey)
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={({ active }: DragStartEvent) => setActiveKey(String(active.id) as WidgetKey)}
      onDragCancel={() => setActiveKey(null)}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={visible.map((widget) => widget.widgetKey)}
        strategy={rectSortingStrategy}
      >
        <Box
          data-workspace-presentation={presentation}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(12, minmax(0, 1fr))' },
            gap: {
              xs: presentation === 'focused' ? 1 : 1.5,
              md: presentation === 'focused' ? 1.25 : presentation === 'expressive' ? 3 : 2,
            },
            alignItems: 'stretch',
          }}
        >
          {visible.map((widget, index) => {
            const definition = definitionByKey.get(widget.widgetKey);
            if (!definition) return null;
            const size = widget.size ?? definition.defaultSize;
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
                onMove={(direction) =>
                  onChange(moveWorkspaceWidget(widgets, widget.widgetKey, direction))
                }
                first={index === 0}
                last={index === visible.length - 1}
              >
                {renderWidget(widget.widgetKey, size)}
              </SortableWidget>
            );
          })}
        </Box>
      </SortableContext>
      <DragOverlay dropAnimation={null}>
        {activeKey ? (
          <Box
            sx={{
              minWidth: 240,
              px: 2,
              py: 1.5,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              border: 1,
              borderColor: 'primary.main',
              borderRadius: 1,
              bgcolor: 'background.paper',
              boxShadow: '0 20px 46px rgba(15,23,42,0.24)',
            }}
          >
            <GripVertical size={18} aria-hidden="true" />
            {getLabel(activeKey) || t('widgetFallback')}
          </Box>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
