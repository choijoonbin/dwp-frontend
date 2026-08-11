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
import { GripVertical, LockKeyhole, X } from 'lucide-react';
import { ActionIconButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';

import {
  HOME_WIDGET_REGISTRY,
  reorderHomeWidgets,
  setHomeWidgetVisibility,
} from './home-widget-registry';

import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import type { HomeWidgetKey, HomeWidgetPreference } from '@dwp-frontend/shared-utils';

type HomeWidgetLayoutProps = {
  widgets: readonly HomeWidgetPreference[];
  editing: boolean;
  busy?: boolean;
  onChange: (widgets: HomeWidgetPreference[]) => void;
  renderWidget: (widgetKey: HomeWidgetKey) => React.ReactNode;
};

type SortableHomeWidgetProps = {
  widget: HomeWidgetPreference;
  editing: boolean;
  busy: boolean;
  onRemove: (widgetKey: HomeWidgetKey) => void;
  children: React.ReactNode;
};

function SortableHomeWidget({
  widget,
  editing,
  busy,
  onRemove,
  children,
}: SortableHomeWidgetProps) {
  const { t } = useTranslation('home');
  const definition = HOME_WIDGET_REGISTRY.find((candidate) => candidate.key === widget.widgetKey);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.widgetKey,
    disabled: !editing || busy,
  });

  if (!definition) return null;
  const label = t(`widgets.registry.${definition.key}.label`, { defaultValue: definition.label });
  const showSectionRule = definition.key === 'focus' || definition.desktopSpan === 3;

  return (
    <Box
      ref={setNodeRef}
      data-home-widget={widget.widgetKey}
      sx={{
        position: 'relative',
        minWidth: 0,
        gridColumn: { xs: '1 / -1', lg: `span ${definition.desktopSpan}` },
        borderTop: showSectionRule ? 1 : 0,
        borderBottom: showSectionRule ? 1 : 0,
        borderColor: 'divider',
        opacity: isDragging ? 0.3 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 3 : 1,
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        '& > section': { gridColumn: '1 / -1' },
      }}
    >
      {children}
      {editing && (
        <>
          <Box
            {...attributes}
            {...listeners}
            role="button"
            tabIndex={busy ? -1 : 0}
            aria-label={t('editor.dragWidgetLabel', { widget: label })}
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 5,
              border: 2,
              borderColor: 'rgba(96,165,250,0.78)',
              borderRadius: 1,
              bgcolor: 'rgba(219,234,254,0.06)',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.42)',
              cursor: busy ? 'wait' : 'grab',
              touchAction: 'none',
              '&:active': { cursor: busy ? 'wait' : 'grabbing' },
              '&:focus-visible': {
                outline: '3px solid rgba(37,99,235,0.30)',
                outlineOffset: 2,
              },
            }}
          >
            <Chip
              icon={<GripVertical size={15} aria-hidden="true" />}
              label={label}
              size="small"
              sx={{
                position: 'absolute',
                top: 10,
                left: 10,
                height: 30,
                maxWidth: 'calc(100% - 58px)',
                bgcolor: 'rgba(255,255,255,0.94)',
                color: 'text.primary',
                boxShadow: '0 6px 18px rgba(15,23,42,0.14)',
                backdropFilter: 'blur(12px)',
              }}
            />
            {!definition.canHide && (
              <Tooltip title={t('editor.governed')}>
                <Box
                  sx={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    width: 26,
                    height: 26,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: '50%',
                    bgcolor: 'rgba(255,255,255,0.94)',
                    color: 'text.secondary',
                    boxShadow: '0 5px 14px rgba(15,23,42,0.14)',
                  }}
                >
                  <LockKeyhole size={14} aria-label={t('editor.governed')} />
                </Box>
              </Tooltip>
            )}
          </Box>
          {definition.canHide && (
            <ActionIconButton
              label={t('editor.removeWidgetLabel', { widget: label })}
              tooltip={t('editor.removeWidget')}
              size="small"
              disabled={busy}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onRemove(widget.widgetKey);
              }}
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                zIndex: 6,
                width: 28,
                height: 28,
                bgcolor: 'grey.900',
                color: 'common.white',
                border: 1,
                borderColor: 'rgba(255,255,255,0.84)',
                boxShadow: '0 5px 14px rgba(15,23,42,0.22)',
                '&:hover': { bgcolor: 'error.main' },
              }}
            >
              <X size={15} strokeWidth={2.3} />
            </ActionIconButton>
          )}
        </>
      )}
    </Box>
  );
}

export function HomeWidgetLayout({
  widgets,
  editing,
  busy = false,
  onChange,
  renderWidget,
}: HomeWidgetLayoutProps) {
  const { t } = useTranslation('home');
  const [activeKey, setActiveKey] = useState<HomeWidgetKey | null>(null);
  const visibleWidgets = useMemo(() => widgets.filter((widget) => widget.visible), [widgets]);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 260, tolerance: 7 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveKey(String(active.id) as HomeWidgetKey);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveKey(null);
    if (!over) return;
    onChange(
      reorderHomeWidgets(
        widgets,
        String(active.id) as HomeWidgetKey,
        String(over.id) as HomeWidgetKey
      )
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragCancel={() => setActiveKey(null)}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={visibleWidgets.map((widget) => widget.widgetKey)}
        strategy={rectSortingStrategy}
      >
        <Box
          sx={{
            mt: 1,
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(12, minmax(0, 1fr))' },
            columnGap: { xs: 0, lg: 3 },
            rowGap: 3,
          }}
        >
          {visibleWidgets.map((widget) => (
            <SortableHomeWidget
              key={widget.widgetKey}
              widget={widget}
              editing={editing}
              busy={busy}
              onRemove={(widgetKey) => onChange(setHomeWidgetVisibility(widgets, widgetKey, false))}
            >
              {renderWidget(widget.widgetKey)}
            </SortableHomeWidget>
          ))}
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
            {t(`widgets.registry.${activeKey}.label`)}
          </Box>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
