export type HomeOverviewQueryFailureInput = Readonly<{
  hasData: boolean;
  isError: boolean;
  isRefetchError: boolean;
}>;

export type HomeOverviewQueryFailureState = Readonly<{
  hardFailed: boolean;
  refreshPartial: boolean;
}>;

export function resolveHomeOverviewQueryFailureState({
  hasData,
  isError,
  isRefetchError,
}: HomeOverviewQueryFailureInput): HomeOverviewQueryFailureState {
  return {
    hardFailed: isError && !hasData,
    refreshPartial: isRefetchError && hasData,
  };
}
