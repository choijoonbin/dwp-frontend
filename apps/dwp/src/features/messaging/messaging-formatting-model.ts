export type MessagingFormatAction =
  'bold' | 'italic' | 'inlineCode' | 'codeBlock' | 'bulletList' | 'numberedList';

export type MessagingFormattingEdit = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

function replace(
  value: string,
  start: number,
  end: number,
  text: string,
  offset: number,
  length: number
): MessagingFormattingEdit {
  return {
    value: value.slice(0, start) + text + value.slice(end),
    selectionStart: start + offset,
    selectionEnd: start + offset + length,
  };
}

function wrap(value: string, start: number, end: number, marker: string): MessagingFormattingEdit {
  const selected = value.slice(start, end);
  if (selected.trim() && selected.trim() !== selected) {
    return wrap(
      value,
      start + selected.length - selected.trimStart().length,
      end - selected.length + selected.trimEnd().length,
      marker
    );
  }
  const selectedMarkerIsActive =
    marker !== '*' ||
    ((selected.match(/^\*+/u)?.[0].length ?? 0) % 2 === 1 &&
      (selected.match(/\*+$/u)?.[0].length ?? 0) % 2 === 1);
  if (
    selectedMarkerIsActive &&
    selected.length >= marker.length * 2 &&
    selected.startsWith(marker) &&
    selected.endsWith(marker)
  ) {
    const content = selected.slice(marker.length, -marker.length);
    return replace(value, start, end, content, 0, content.length);
  }
  if (
    (marker !== '*' ||
      ((value.slice(0, start).match(/\*+$/u)?.[0].length ?? 0) % 2 === 1 &&
        (value.slice(end).match(/^\*+/u)?.[0].length ?? 0) % 2 === 1)) &&
    start >= marker.length &&
    value.slice(start - marker.length, start) === marker &&
    value.slice(end, end + marker.length) === marker
  ) {
    return replace(value, start - marker.length, end + marker.length, selected, 0, selected.length);
  }
  return replace(value, start, end, marker + selected + marker, marker.length, selected.length);
}

export function applyMessagingFormat(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  action: MessagingFormatAction
): MessagingFormattingEdit {
  const start = Math.max(0, Math.min(selectionStart, value.length));
  const end = Math.max(start, Math.min(selectionEnd, value.length));
  const selected = value.slice(start, end);
  if (action === 'bold' || action === 'italic')
    return wrap(value, start, end, action === 'bold' ? '**' : '*');
  if (action === 'inlineCode') {
    const longest = Math.max(
      0,
      ...Array.from(selected.matchAll(/`+/gu), (match) => match[0].length)
    );
    if (!longest) return wrap(value, start, end, '`');
    const marker = '`'.repeat(longest + 1);
    return replace(
      value,
      start,
      end,
      `${marker} ${selected} ${marker}`,
      marker.length + 1,
      selected.length
    );
  }
  if (action === 'codeBlock') {
    const longest = Math.max(
      2,
      ...Array.from(selected.matchAll(/`+/gu), (match) => match[0].length)
    );
    const fence = '`'.repeat(longest + 1);
    const prefix = `${start > 0 && value[start - 1] !== '\n' ? '\n' : ''}${fence}\n`;
    const suffix = `\n${fence}${end < value.length && value[end] !== '\n' ? '\n' : ''}`;
    return replace(value, start, end, prefix + selected + suffix, prefix.length, selected.length);
  }
  const lineStart = start === 0 ? 0 : value.lastIndexOf('\n', start - 1) + 1;
  const lastIncluded = end > start && value[end - 1] === '\n' ? end - 1 : end;
  const nextNewline = value.indexOf('\n', lastIncluded);
  const lineEnd = nextNewline < 0 ? value.length : nextNewline;
  const lines = value.slice(lineStart, lineEnd).split('\n');
  const marker = action === 'bulletList' ? /^(\s*)[-+*] /u : /^(\s*)\d+[.)] /u;
  const remove =
    lines.some((line) => marker.test(line)) &&
    lines.every((line) => !line.trim() || marker.test(line));
  let number = 0;
  const result = lines
    .map((line) => {
      if (remove) return line.replace(marker, '$1');
      const content = line.replace(/^(\s*)(?:[-+*]|\d+[.)]) /u, '$1');
      const indent = content.match(/^\s*/u)?.[0] ?? '';
      number += 1;
      return (
        indent + (action === 'bulletList' ? '- ' : `${number}. `) + content.slice(indent.length)
      );
    })
    .join('\n');
  if (start === end) {
    const delta = result.split('\n')[0]!.length - lines[0]!.length;
    return replace(value, lineStart, lineEnd, result, Math.max(0, start - lineStart + delta), 0);
  }
  return replace(value, lineStart, lineEnd, result, 0, result.length);
}
