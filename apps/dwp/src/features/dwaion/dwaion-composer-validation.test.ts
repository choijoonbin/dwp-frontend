import { describe, expect, it } from 'vitest';
import { questionCharacterCount, questionValidation } from './dwaion-composer-validation';

describe('question request length contract', () => {
  it('rejects empty and one-character requests after the same trimming used for submission', () => {
    expect(questionValidation('   ')).toBe('empty');
    expect(questionValidation(' x ')).toBe('short');
    expect(questionValidation(' xy ')).toBe('valid');
  });
  it('counts Unicode code points consistently with the server rather than UTF-16 units', () => {
    expect(questionCharacterCount('🙂')).toBe(1);
    expect(questionValidation('🙂🙂')).toBe('valid');
    expect(questionValidation('🙂'.repeat(4000))).toBe('valid');
    expect(questionValidation('🙂'.repeat(4001))).toBe('long');
  });
  it('keeps the 4000-character boundary exact for Korean and Latin input', () => {
    expect(questionValidation('가'.repeat(4000))).toBe('valid');
    expect(questionValidation('a'.repeat(4001))).toBe('long');
  });
});
