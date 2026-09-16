import { useEffect, useMemo, useRef } from 'react';
import { sendHomeV2ShadowReceipt } from '@dwp-frontend/shared-utils';

import {
  compareHomeShadowSnapshots,
  projectHomeV2ShadowSnapshot,
} from './home-v2-shadow-comparator';

import type { HomeShadowSemanticSnapshot } from './home-v2-shadow-comparator';
import type { useHomeV2Runtime } from './use-home-v2-runtime';

type HomeV2Runtime = ReturnType<typeof useHomeV2Runtime>;

/** Best-effort aggregate receipt. It cannot alter Home rendering or rollout authority. */
export function useHomeV2ShadowReceipt({
  legacy,
  runtime,
  settled,
}: Readonly<{
  legacy: HomeShadowSemanticSnapshot | null;
  runtime: HomeV2Runtime;
  settled: boolean;
}>) {
  const sentKeys = useRef<string[]>([]);
  const shadowResult = runtime.activation.kind === 'SHADOW' ? runtime.activation.result : null;
  const homeV2 = useMemo(
    () => (shadowResult ? projectHomeV2ShadowSnapshot(shadowResult.snapshot.data) : null),
    [shadowResult]
  );
  const comparison = useMemo(
    () => compareHomeShadowSnapshots(settled ? legacy : null, homeV2),
    [homeV2, legacy, settled]
  );

  useEffect(() => {
    if (!settled || !shadowResult) return;
    const metadata = shadowResult.metadata;
    if (
      metadata.runtimeState !== 'SHADOW_COMPARE' ||
      metadata.renderAuthority !== 'LEGACY' ||
      metadata.actionAuthority !== 'DISABLED'
    ) {
      return;
    }
    const deviceClass = shadowResult.snapshot.data.view.deviceClass;
    const receipt = {
      schemaVersion: 1,
      outcome: comparison.outcome,
      reasons: comparison.reasons,
      mismatchCount: comparison.count,
      homeMode: shadowResult.snapshot.data.mode,
      deviceClass,
      runtimeState: 'SHADOW_COMPARE',
      rolloutRing: metadata.rolloutRing,
      rolloutRevision: metadata.rolloutRevision,
    } as const;
    const key = [
      metadata.rolloutRevision,
      shadowResult.snapshot.data.changeVersion,
      deviceClass,
      comparison.outcome,
      comparison.reasons.join(','),
    ].join('|');
    if (sentKeys.current.includes(key)) return;
    sentKeys.current = [...sentKeys.current.slice(-7), key];
    void sendHomeV2ShadowReceipt(receipt, metadata.decisionRevision).catch(() => {
      // A diagnostic receipt is best-effort and never changes SHADOW render authority.
    });
  }, [comparison, settled, shadowResult]);

  return shadowResult && settled ? comparison : null;
}
