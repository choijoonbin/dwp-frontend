import { useEffect } from 'react';

function isSourceShortcut(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  const editing =
    target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '');
  return (
    !editing &&
    !event.defaultPrevented &&
    !event.isComposing &&
    (event.metaKey || event.ctrlKey) &&
    event.key.toLocaleLowerCase() === 'b'
  );
}

export function useCalendarSourceShortcut(
  desktopSources: boolean,
  onToggleSources: () => void,
  onOpenSources: () => void
) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isSourceShortcut(event)) return;
      event.preventDefault();
      if (desktopSources) onToggleSources();
      else onOpenSources();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [desktopSources, onOpenSources, onToggleSources]);
}
