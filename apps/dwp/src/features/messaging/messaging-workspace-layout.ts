export const messagingConversationHeaderResponsiveLayout = {
  flexWrap: { xs: 'wrap', sm: 'nowrap' },
  titleFlex: { xs: '1 1 calc(100% - 52px)', sm: '1 1 auto' },
  actionsWidth: { xs: 1, sm: 'auto' },
} as const;

export const messagingMobileThreadDrawerLayout = {
  left: { xs: 0, sm: 'auto' },
  right: 0,
  width: { xs: 'auto', sm: 440 },
  maxWidth: { xs: 'none', sm: 'calc(100vw - 16px)' },
  minWidth: 0,
  boxSizing: 'border-box',
  overflowX: 'hidden',
} as const;

export const messagingMobileThreadTransitionDuration = 0;

export function messagingWorkspaceGridColumns(
  threadRootId: string | null,
  contextCollapsed: boolean
) {
  const threadOpen = Boolean(threadRootId);
  return {
    desktop: threadOpen
      ? 'minmax(0, 1fr) minmax(336px, 372px)'
      : 'minmax(260px, 292px) minmax(0, 1fr)',
    wide: threadOpen
      ? 'minmax(0, 1fr) 340px'
      : contextCollapsed
        ? '240px minmax(0, 1fr)'
        : '224px minmax(0, 1fr) 248px',
    extraWide: threadOpen
      ? '258px minmax(0, 1fr) 340px'
      : contextCollapsed
        ? '258px minmax(0, 1fr)'
        : '258px minmax(0, 1fr) 288px',
  } as const;
}
