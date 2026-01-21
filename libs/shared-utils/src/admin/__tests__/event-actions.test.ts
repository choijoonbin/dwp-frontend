// ----------------------------------------------------------------------

import { it, expect, describe } from 'vitest';

import { isValidUiAction, normalizeAction } from '../event-actions';

import type { UiAction } from '../event-actions';

/**
 * Unit tests for Event Actions
 */
describe('Event Actions', () => {
  describe('isValidUiAction', () => {
    it('should validate standard UiAction values', () => {
      const validActions: UiAction[] = [
        'VIEW',
        'CLICK',
        'EXECUTE',
        'SCROLL',
        'SEARCH',
        'FILTER',
        'DOWNLOAD',
        'OPEN',
        'CLOSE',
        'SUBMIT',
      ];

      validActions.forEach((action) => {
        expect(isValidUiAction(action)).toBe(true);
      });
    });

    it('should reject invalid action strings', () => {
      const invalidActions = [
        'view', // lowercase
        'click', // lowercase
        'INVALID',
        'custom_action',
        '',
        'VIEW_CLICK',
      ];

      invalidActions.forEach((action) => {
        expect(isValidUiAction(action)).toBe(false);
      });
    });
  });

  describe('normalizeAction', () => {
    it('should normalize lowercase to uppercase', () => {
      expect(normalizeAction('view')).toBe('VIEW');
      expect(normalizeAction('click')).toBe('CLICK');
      expect(normalizeAction('execute')).toBe('EXECUTE');
    });

    it('should return null for invalid actions', () => {
      expect(normalizeAction('invalid')).toBeNull();
      expect(normalizeAction('custom_action')).toBeNull();
      expect(normalizeAction('')).toBeNull();
    });

    it('should handle already uppercase actions', () => {
      expect(normalizeAction('VIEW')).toBe('VIEW');
      expect(normalizeAction('CLICK')).toBe('CLICK');
    });
  });
});
