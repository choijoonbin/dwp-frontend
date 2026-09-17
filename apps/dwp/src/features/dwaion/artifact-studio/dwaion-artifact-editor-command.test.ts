import { describe, expect, it } from 'vitest';

import { applyDwaionArtifactEditorCommand } from './dwaion-artifact-editor-command';

describe('DWAI.ON artifact editor commands', () => {
  it('formats complete selected lines without losing adjacent content', () => {
    expect(applyDwaionArtifactEditorCommand('First\nSecond\nThird', 7, 13, 'HEADING_TWO')).toEqual({
      value: 'First\n## Second\nThird',
      selectionStart: 6,
      selectionEnd: 15,
    });
    expect(applyDwaionArtifactEditorCommand('one\ntwo', 0, 7, 'BULLET_LIST').value).toBe(
      '- one\n- two'
    );
  });

  it('wraps a selection and inserts governed source identity', () => {
    expect(applyDwaionArtifactEditorCommand('review this', 7, 11, 'BOLD')).toEqual({
      value: 'review **this**',
      selectionStart: 9,
      selectionEnd: 13,
    });
    expect(
      applyDwaionArtifactEditorCommand('', 0, 0, 'CITATION', {
        sourceType: 'WORK_ITEM',
        reference: 'work-item-1042',
      }).value
    ).toBe('[WORK_ITEM · work-item-1042]');
  });
});
