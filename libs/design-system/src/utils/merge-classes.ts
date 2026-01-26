/**
 * State-based class names (compatible with minimal-shared StateProps).
 * [boolean, string] => use string when boolean is true; string key => use key when value is true.
 */
export type StateProps = {
  [key: string]: boolean | undefined | [boolean, string];
};

/**
 * Merges class names with state-based class names.
 * @param className - Base class name(s).
 * @param state - Object with boolean or [boolean, string] values; keys/values are applied when truthy.
 * @returns Merged class string.
 */
export const mergeClasses = (
  className?: string | (string | undefined)[] | null,
  state?: StateProps
): string => {
  const base = className
    ? Array.isArray(className)
      ? className.filter(Boolean)
      : [className]
    : [];
  const fromState = (Object.entries(state ?? {}) as [string, StateProps[string]][])
    .filter(([, value]) => value !== undefined && value !== false)
    .map(([key, value]) =>
      Array.isArray(value) ? (value[0] ? value[1] : '') : value ? key : ''
    )
    .filter(Boolean);
  return [...base.filter(Boolean), ...fromState].join(' ');
};
