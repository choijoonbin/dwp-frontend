import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';

/** Keeps a parent-owned value invisible to every other authorization owner, including first paint. */
export function useOwnerScopedState<Value>(
  owner: string | null,
  initialValue: Value
): [Value, Dispatch<SetStateAction<Value>>] {
  const [owned, setOwned] = useState<{ owner: string | null; value: Value }>(() => ({
    owner,
    value: initialValue,
  }));
  const currentOwner = useRef(owner);
  currentOwner.current = owner;
  const value = owned.owner === owner ? owned.value : initialValue;
  const setValue = useMemo<Dispatch<SetStateAction<Value>>>(
    () => (update) => {
      setOwned((current) => {
        if (currentOwner.current !== owner) return current;
        const previous = current.owner === owner ? current.value : initialValue;
        return {
          owner,
          value:
            typeof update === 'function' ? (update as (value: Value) => Value)(previous) : update,
        };
      });
    },
    [initialValue, owner]
  );
  return [value, setValue];
}
