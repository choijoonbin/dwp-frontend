import { foundationTokens, productExperienceRegistry } from '@dwp-frontend/design-system';

import { darken, lighten } from '@mui/material/styles';

export type MessagingVisualTone = {
  foreground: string;
  surface: string;
};

export const messagingVisualTokens = {
  radius: {
    compact: `${foundationTokens.radius.compact}px`,
    control: `${foundationTokens.radius.control}px`,
    surface: `${foundationTokens.radius.surface}px`,
  },
  tones: {
    channel: productExperienceRegistry.messaging.accent,
    direct: foundationTokens.color.data.violet,
    pinned: darken(foundationTokens.color.data.saffron, 0.28),
  },
};

const MESSAGING_VISUAL_TONES: readonly MessagingVisualTone[] = [
  messagingVisualTokens.tones.channel,
  messagingVisualTokens.tones.direct,
  productExperienceRegistry.services.accent,
  productExperienceRegistry.communications.accent,
  messagingVisualTokens.tones.pinned,
  darken(foundationTokens.color.data.cyan, 0.2),
].map((foreground) => ({ foreground, surface: lighten(foreground, 0.9) }));

export function messagingVisualTone(seed: string | number | null | undefined) {
  const value = String(seed ?? 'messaging');
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return MESSAGING_VISUAL_TONES[Math.abs(hash) % MESSAGING_VISUAL_TONES.length]!;
}
