import type {
  HomeDeviceLayoutOverlay,
  HomeWidgetPreference,
  HomeWidgetSize,
  PersonalHomeWidgetPreference,
} from '@dwp-frontend/shared-utils';

export type HomeDeviceWidthControl = {
  /** The legacy key the device overlay API persists. */
  storageKey: string;
  /** The current size used when the device overlay has no saved override. */
  sourceSize: HomeWidgetSize | undefined;
  /** Studio-only label; this does not rename the underlying storage key. */
  labelKey: `content.widgetLabels.${string}`;
  allowedSizes: readonly HomeWidgetSize[];
};

const FLOW_DEVICE_WIDTHS = {
  'command-rail': ['large', 'full'],
  schedule: ['fifth', 'quarter', 'compact', 'medium'],
  'daily-brief': ['compact', 'large', 'full'],
  focus: ['quarter', 'compact', 'medium', 'large', 'full'],
  activity: ['fifth', 'quarter', 'compact', 'medium'],
  'focus-balance': ['quarter', 'compact', 'medium'],
  'meeting-load': ['quarter', 'compact', 'medium'],
} as const satisfies Record<string, readonly HomeWidgetSize[]>;

const HOME_WIDGET_SIZES = new Set<HomeWidgetSize>([
  'fifth',
  'quarter',
  'compact',
  'medium',
  'large',
  'full',
]);

/**
 * Builds the width controls for Flow Home while preserving the legacy storage
 * contract. Every Flow purpose widget keeps its own storage key so device
 * overrides never merge Request status (`focus`) and Role pulse (`activity`)
 * into an obsolete composite control.
 */
export function buildFlowDeviceWidthControls(
  widgets: readonly PersonalHomeWidgetPreference<string>[]
): HomeDeviceWidthControl[] {
  return widgets.flatMap((widget): HomeDeviceWidthControl[] => {
    if (widget.visible === false) return [];
    const allowedSizes = FLOW_DEVICE_WIDTHS[widget.widgetKey as keyof typeof FLOW_DEVICE_WIDTHS];
    if (allowedSizes) {
      return [
        {
          storageKey: widget.widgetKey,
          sourceSize: widget.size ?? undefined,
          labelKey: `content.widgetLabels.${widget.widgetKey}`,
          allowedSizes,
        },
      ];
    }
    return [];
  });
}

/**
 * Saves visible edits without deleting a hidden purpose widget's independent
 * width. Both old and edited values are normalized against the Flow registry,
 * so malformed or forward-incompatible keys never reach the API payload.
 */
export function mergeFlowDeviceWidthOverrides(
  saved: Readonly<Record<string, string>>,
  editedVisible: Readonly<Record<string, HomeWidgetSize>>
): Record<string, HomeWidgetSize> {
  const merged = { ...saved, ...editedVisible };
  return Object.fromEntries(
    Object.entries(merged).filter(([storageKey, size]) => {
      const allowed = FLOW_DEVICE_WIDTHS[storageKey as keyof typeof FLOW_DEVICE_WIDTHS];
      return allowed?.includes(size as never) === true;
    })
  ) as Record<string, HomeWidgetSize>;
}

export function applyHomeDeviceOverlay(
  widgets: readonly HomeWidgetPreference[],
  overlay: HomeDeviceLayoutOverlay | null | undefined
): HomeWidgetPreference[] {
  if (!overlay) return [...widgets];
  return widgets.map((widget) => {
    const requestedSize = overlay.widgetSizes[widget.widgetKey] as HomeWidgetSize | undefined;
    if (!requestedSize || !HOME_WIDGET_SIZES.has(requestedSize)) return widget;
    return { ...widget, size: requestedSize };
  });
}
