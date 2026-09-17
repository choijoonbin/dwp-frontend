import { describe, expect, it } from 'vitest';

import { parseDwaionResearchMarkdown } from './dwaion-research-report';

describe('parseDwaionResearchMarkdown', () => {
  it('keeps headings, strong content, and GFM tables as structured report nodes', () => {
    const nodes = parseDwaionResearchMarkdown(
      '# Executive summary\n\n**Approved** for review.\n\n| Scenario | Cost |\n| --- | ---: |\n| Base | 120 |'
    );

    expect(nodes[0]).toMatchObject({ kind: 'heading', depth: 1 });
    expect(nodes[1]).toMatchObject({ kind: 'paragraph' });
    expect(nodes[1]?.kind === 'paragraph' ? nodes[1].children[0] : null).toMatchObject({
      kind: 'strong',
      children: [{ kind: 'text', value: 'Approved' }],
    });
    expect(nodes[2]).toMatchObject({
      kind: 'table',
      align: [null, 'right'],
      header: [[{ kind: 'text', value: 'Scenario' }], [{ kind: 'text', value: 'Cost' }]],
      rows: [
        [
          [
            {
              kind: 'text',
              value: 'Base',
            },
          ],
          [{ kind: 'text', value: '120' }],
        ],
      ],
    });
  });

  it('leaves HTML, images, and unsafe links inert', () => {
    const nodes = parseDwaionResearchMarkdown(
      '<script>alert(1)</script> ![tracking](https://example.com/pixel.png) [unsafe](javascript:alert(1))'
    );
    expect(JSON.stringify(nodes)).toContain('<script>alert(1)</script>');
    expect(JSON.stringify(nodes)).toContain('![tracking](https://example.com/pixel.png)');
    expect(JSON.stringify(nodes)).not.toContain('"kind":"link"');
  });
});
