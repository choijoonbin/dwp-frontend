export function mailInboxFirstAutoSelection(input: {
  desktopSplitView: boolean;
  fetching: boolean;
  selectedId: string | null;
  threadIds: readonly string[];
}) {
  if (!input.desktopSplitView || input.fetching || input.selectedId) return null;
  return input.threadIds[0] ?? null;
}
