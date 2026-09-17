import type { ComponentProps, ReactNode } from 'react';

import type { HomePresentation } from '@dwp-frontend/shared-utils';

import type { FlowHome } from '../../features/home/flow-home/flow-home';
import { FLOW_FUTURE_WIDGET_OWNER_DEFINITION_KEYS } from '../../features/home/flow-home/flow-future-widget-mesh';
import { ActiveHomeOwnerWidgetRegion } from '../../features/home/runtime/home-owner-widget-region';

import type { useHomeV2Runtime } from '../../features/home/runtime/use-home-v2-runtime';

type HomeV2Runtime = ReturnType<typeof useHomeV2Runtime>;
type FlowFutureRuntimeProps = Pick<
  ComponentProps<typeof FlowHome>,
  | 'futureRuntimeWidgets'
  | 'futureRuntimeRefreshing'
  | 'onOpenFutureRuntimeSource'
  | 'onRetryFutureRuntime'
>;

type HomeActiveRuntimeRegions = Readonly<{
  flowFutureRuntimeProps: FlowFutureRuntimeProps;
  ownerWidgetRegion: ReactNode;
}>;

/** Projects ACTIVE v2 owners once, with the expressive Flow mesh owning its five dedicated slots. */
export function resolveHomeActiveRuntimeRegions(
  runtime: HomeV2Runtime,
  modeKey: 'CLASSIC' | 'FLOW_V1',
  presentation: HomePresentation,
  onNavigate: (route: string) => void
): HomeActiveRuntimeRegions {
  const activeModel =
    runtime.activation.kind === 'ACTIVE' ? runtime.activation.result.snapshot.data : null;
  const expressiveFlowRuntimeActive = Boolean(
    activeModel && modeKey === 'FLOW_V1' && presentation === 'expressive'
  );

  return {
    flowFutureRuntimeProps: {
      futureRuntimeWidgets: expressiveFlowRuntimeActive ? activeModel?.widgets : undefined,
      futureRuntimeRefreshing:
        expressiveFlowRuntimeActive && runtime.query.isFetching && !runtime.query.isLoading,
      onOpenFutureRuntimeSource: onNavigate,
      onRetryFutureRuntime: () => void runtime.query.refetch(),
    },
    ownerWidgetRegion: (
      <ActiveHomeOwnerWidgetRegion
        runtime={runtime}
        excludedDefinitionKeys={
          expressiveFlowRuntimeActive ? FLOW_FUTURE_WIDGET_OWNER_DEFINITION_KEYS : undefined
        }
      />
    ),
  };
}
