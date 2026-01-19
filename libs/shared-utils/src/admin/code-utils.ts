import type { Code } from './types';

// ----------------------------------------------------------------------

/**
 * Select option type
 */
export type SelectOption = {
  value: string;
  label: string;
};

/**
 * Convert codes array to select options
 * Filters enabled codes and sorts by sortOrder
 */
export const toSelectOptions = (codes: Code[] | undefined): SelectOption[] => {
  if (!codes || codes.length === 0) return [];

  return codes
    .filter((code) => code.enabled)
    .sort((a, b) => {
      const aOrder = a.sortOrder ?? 0;
      const bOrder = b.sortOrder ?? 0;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.codeName || a.codeKey).localeCompare(b.codeName || b.codeKey);
    })
    .map((code) => ({
      value: code.codeKey,
      label: code.codeName || code.codeKey,
    }));
};

/**
 * Get codes by group key from code usage map
 */
export const getCodesByGroupFromMap = (codeMap: Record<string, Code[]> | undefined, groupKey: string): Code[] => {
  if (!codeMap) return [];
  return codeMap[groupKey] || [];
};

/**
 * Get select options by group key from code usage map
 */
export const getSelectOptionsByGroup = (
  codeMap: Record<string, Code[]> | undefined,
  groupKey: string
): SelectOption[] => {
  const codes = getCodesByGroupFromMap(codeMap, groupKey);
  return toSelectOptions(codes);
};
