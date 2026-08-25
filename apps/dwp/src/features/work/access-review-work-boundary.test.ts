import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('access review Work boundary source contract', () => {
  it('never imports or calls the tenant-admin campaign/detail reviewer API', () => {
    const source = [
      fs.readFileSync(new URL('./access-review-work-item.tsx', import.meta.url), 'utf8'),
      fs.readFileSync(new URL('../../pages/work.tsx', import.meta.url), 'utf8'),
    ].join('\n');
    expect(source).toContain('getAccessReviewWorkDetail');
    expect(source).toContain('decideAccessReviewWork');
    expect(source).not.toContain('getAccessReviewCampaign');
    expect(source).not.toContain('decideAccessReviewItem');
    expect(source).not.toContain('/api/auth/admin/access/reviews');
  });

  it('contains no reviewer shortcut into the tenant administration router', () => {
    const source = fs.readFileSync(
      new URL('../../routes/administration-routes.tsx', import.meta.url),
      'utf8'
    );
    expect(source).not.toContain('assignedReviewerAccess');
    expect(source).not.toContain('reviewerAccessible');
    expect(source).not.toContain("pathname === '/admin/identity/access-reviews'");
  });
});
