import type { Dispatch, MouseEvent, SetStateAction } from 'react';

import { useState, useCallback } from 'react';

export type UsePopoverReturn<T extends HTMLElement = HTMLElement> = {
  open: boolean;
  anchorEl: T | null;
  onClose: () => void;
  onOpen: (event: MouseEvent<T>) => void;
  setAnchorEl: Dispatch<SetStateAction<T | null>>;
};

/**
 * Manages popover open state and anchor element (compatible with minimal-shared usePopover).
 */
export const usePopover = <T extends HTMLElement = HTMLElement>(): UsePopoverReturn<T> => {
  const [anchorEl, setAnchorEl] = useState<T | null>(null);
  const onOpen = useCallback((event: MouseEvent<T>) => {
    setAnchorEl(event.currentTarget);
  }, []);
  const onClose = useCallback(() => {
    setAnchorEl(null);
  }, []);
  return {
    open: Boolean(anchorEl),
    anchorEl,
    onOpen,
    onClose,
    setAnchorEl,
  };
};
