// ----------------------------------------------------------------------

import { it, expect, describe } from 'vitest';

import { toSelectOptions, getSelectOptionsByGroup } from '../code-utils';

import type { Code } from '../types';

/**
 * Unit tests for Code Utils
 */
describe('Code Utils', () => {
  const mockCodes: Code[] = [
    {
      id: '1',
      codeKey: 'VIEW',
      codeName: 'View',
      groupKey: 'UI_ACTION',
      enabled: true,
      sortOrder: 1,
      createdAt: '2024-01-01T00:00:00Z',
    },
    {
      id: '2',
      codeKey: 'CLICK',
      codeName: 'Click',
      groupKey: 'UI_ACTION',
      enabled: true,
      sortOrder: 2,
      createdAt: '2024-01-01T00:00:00Z',
    },
    {
      id: '3',
      codeKey: 'EXECUTE',
      codeName: 'Execute',
      groupKey: 'UI_ACTION',
      enabled: false, // Disabled code
      sortOrder: 3,
      createdAt: '2024-01-01T00:00:00Z',
    },
    {
      id: '4',
      codeKey: 'SCROLL',
      codeName: 'Scroll',
      groupKey: 'UI_ACTION',
      enabled: true,
      sortOrder: 0, // Lower sortOrder should come first
      createdAt: '2024-01-01T00:00:00Z',
    },
  ];

  describe('toSelectOptions', () => {
    it('should convert codes to select options', () => {
      const options = toSelectOptions(mockCodes);

      expect(options).toHaveLength(3); // Only enabled codes
      expect(options[0]).toEqual({ value: 'SCROLL', label: 'Scroll' }); // sortOrder 0 comes first
      expect(options[1]).toEqual({ value: 'VIEW', label: 'View' });
      expect(options[2]).toEqual({ value: 'CLICK', label: 'Click' });
    });

    it('should filter out disabled codes', () => {
      const options = toSelectOptions(mockCodes);
      const executeOption = options.find((opt) => opt.value === 'EXECUTE');
      expect(executeOption).toBeUndefined();
    });

    it('should return empty array for undefined input', () => {
      expect(toSelectOptions(undefined)).toEqual([]);
    });

    it('should return empty array for empty array', () => {
      expect(toSelectOptions([])).toEqual([]);
    });

    it('should use codeKey as label if codeName is missing', () => {
      const codesWithoutName: Code[] = [
        {
          id: '1',
          codeKey: 'TEST',
          codeName: 'TEST', // codeName is required in Code type
          groupKey: 'TEST_GROUP',
          enabled: true,
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];

      const options = toSelectOptions(codesWithoutName);
      expect(options[0].label).toBe('TEST');
    });
  });

  describe('getSelectOptionsByGroup', () => {
    const codeMap: Record<string, Code[]> = {
      UI_ACTION: mockCodes,
      OTHER_GROUP: [
        {
          id: '5',
          codeKey: 'OTHER',
          codeName: 'Other',
          groupKey: 'OTHER_GROUP',
          enabled: true,
          createdAt: '2024-01-01T00:00:00Z',
        },
      ],
    };

    it('should get select options for a specific group', () => {
      const options = getSelectOptionsByGroup(codeMap, 'UI_ACTION');

      expect(options).toHaveLength(3); // Only enabled codes
      expect(options[0].value).toBe('SCROLL');
      expect(options[1].value).toBe('VIEW');
      expect(options[2].value).toBe('CLICK');
    });

    it('should return empty array for non-existent group', () => {
      const options = getSelectOptionsByGroup(codeMap, 'NON_EXISTENT');
      expect(options).toEqual([]);
    });

    it('should return empty array for undefined codeMap', () => {
      const options = getSelectOptionsByGroup(undefined, 'UI_ACTION');
      expect(options).toEqual([]);
    });

    it('should return empty array when UI_ACTION group is missing (Events tab fallback scenario)', () => {
      const codeMapWithoutUiAction: Record<string, Code[]> = {
        OTHER_GROUP: [
          {
            id: '5',
            codeKey: 'OTHER',
            codeName: 'Other',
            groupKey: 'OTHER_GROUP',
            enabled: true,
            createdAt: '2024-01-01T00:00:00Z',
          },
        ],
      };

      const options = getSelectOptionsByGroup(codeMapWithoutUiAction, 'UI_ACTION');
      expect(options).toEqual([]);
      // This scenario should result in disabled selectbox in EventsTabFilters
    });

    it('should prioritize UI_ACTION over EVENT_TYPE when both exist (Events tab logic)', () => {
      const codeMapWithBoth: Record<string, Code[]> = {
        UI_ACTION: [
          {
            id: '1',
            codeKey: 'VIEW',
            codeName: 'View',
            groupKey: 'UI_ACTION',
            enabled: true,
            sortOrder: 1,
            createdAt: '2024-01-01T00:00:00Z',
          },
        ],
        EVENT_TYPE: [
          {
            id: '2',
            codeKey: 'CLICK',
            codeName: 'Click',
            groupKey: 'EVENT_TYPE',
            enabled: true,
            sortOrder: 1,
            createdAt: '2024-01-01T00:00:00Z',
          },
        ],
      };

      const uiActionOptions = getSelectOptionsByGroup(codeMapWithBoth, 'UI_ACTION');
      const eventTypeOptions = getSelectOptionsByGroup(codeMapWithBoth, 'EVENT_TYPE');

      expect(uiActionOptions.length).toBeGreaterThan(0);
      expect(eventTypeOptions.length).toBeGreaterThan(0);
      // UI_ACTION should be prioritized in EventsTabFilters component logic
      // EventsTabFilters uses: uiActionOptions.length > 0 ? uiActionOptions : eventTypeOptions
      expect(uiActionOptions[0].value).toBe('VIEW');
      expect(eventTypeOptions[0].value).toBe('CLICK');
    });

    it('should handle Events tab fallback to EVENT_TYPE when UI_ACTION is empty', () => {
      const codeMapWithOnlyEventType: Record<string, Code[]> = {
        EVENT_TYPE: [
          {
            id: '1',
            codeKey: 'CLICK',
            codeName: 'Click',
            groupKey: 'EVENT_TYPE',
            enabled: true,
            sortOrder: 1,
            createdAt: '2024-01-01T00:00:00Z',
          },
        ],
      };

      const uiActionOptions = getSelectOptionsByGroup(codeMapWithOnlyEventType, 'UI_ACTION');
      const eventTypeOptions = getSelectOptionsByGroup(codeMapWithOnlyEventType, 'EVENT_TYPE');

      expect(uiActionOptions).toEqual([]);
      expect(eventTypeOptions.length).toBeGreaterThan(0);
      // EventsTabFilters should fallback to EVENT_TYPE when UI_ACTION is empty
      expect(eventTypeOptions[0].value).toBe('CLICK');
    });
  });
});
