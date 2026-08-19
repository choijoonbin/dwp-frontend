import { describe, expect, it } from 'vitest';

import { buildDwaionActionDraftInputs } from './dwaion-action-draft';

describe('buildDwaionActionDraftInputs', () => {
  it('does not invent calendar times when the request has not been structurally interpreted', () => {
    expect(
      buildDwaionActionDraftInputs(
        'CALENDAR.EVENT.CREATE',
        '프로젝트 점검 회의를 내일 오후 3시 일정 초안으로 준비해줘',
        null
      )
    ).toEqual({
      title: '프로젝트 점검 회의를 내일 오후 3시 일정 초안으로 준비해줘',
    });
  });
});
