import { describe, expect, it } from 'vitest';

import { deriveArtifactTitle } from './dwaion-artifact-answer-action';

describe('DWAI·ON answer artifact title', () => {
  it('normalizes whitespace and stays within the server 200-character contract', () => {
    const title = deriveArtifactTitle(
      `  Weekly\n review   ${'🚀'.repeat(210)}  `,
      'DWAI·ON answer'
    );

    expect(title.startsWith('Weekly review ')).toBe(true);
    expect(Array.from(title)).toHaveLength(200);
    expect(title.endsWith('\ud83d')).toBe(false);
  });

  it('uses a localized fallback when the supplied question is empty', () => {
    expect(deriveArtifactTitle(' \n ', 'Saved answer')).toBe('Saved answer');
  });
});
