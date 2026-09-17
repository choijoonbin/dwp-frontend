import type { DwaionArtifactSourceReference } from './dwaion-artifact-model';

export type DwaionArtifactEditorCommand =
  | 'HEADING_ONE'
  | 'HEADING_TWO'
  | 'BOLD'
  | 'BULLET_LIST'
  | 'TABLE'
  | 'CITATION';

export type DwaionArtifactEditorCommandResult = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

export function applyDwaionArtifactEditorCommand(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  command: DwaionArtifactEditorCommand,
  source?: DwaionArtifactSourceReference
): DwaionArtifactEditorCommandResult {
  const start = clamp(selectionStart, 0, value.length);
  const end = clamp(selectionEnd, start, value.length);

  if (command === 'HEADING_ONE' || command === 'HEADING_TWO' || command === 'BULLET_LIST') {
    const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const lineEndProbe = end > lineStart && value[end - 1] === '\n' ? end - 1 : end;
    const nextBreak = value.indexOf('\n', lineEndProbe);
    const lineEnd = nextBreak === -1 ? value.length : nextBreak;
    const block = value.slice(lineStart, lineEnd);
    const prefix = command === 'HEADING_ONE' ? '# ' : command === 'HEADING_TWO' ? '## ' : '- ';
    const replacement = block
      .split('\n')
      .map((line) => {
        if (command === 'BULLET_LIST') return line.trim() ? `- ${line.replace(/^\s*[-*+]\s+/u, '')}` : line;
        return `${prefix}${line.replace(/^\s*#{1,6}\s+/u, '')}`;
      })
      .join('\n');
    return replaceRange(value, lineStart, lineEnd, replacement, lineStart, lineStart + replacement.length);
  }

  if (command === 'BOLD') {
    const selected = value.slice(start, end) || 'text';
    const replacement = `**${selected}**`;
    const innerStart = start + 2;
    return replaceRange(value, start, end, replacement, innerStart, innerStart + selected.length);
  }

  if (command === 'TABLE') {
    const insertion =
      '| Column 1 | Column 2 |\n| --- | --- |\n| Value 1 | Value 2 |';
    return replaceRange(value, start, end, insertion, start, start + insertion.length);
  }

  if (!source) throw new TypeError('A governed artifact source is required for a citation.');
  const citation = `[${source.sourceType} · ${source.reference}]`;
  return replaceRange(value, start, end, citation, start, start + citation.length);
}

function replaceRange(
  value: string,
  start: number,
  end: number,
  replacement: string,
  selectionStart: number,
  selectionEnd: number
): DwaionArtifactEditorCommandResult {
  return {
    value: `${value.slice(0, start)}${replacement}${value.slice(end)}`,
    selectionStart,
    selectionEnd,
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? Math.trunc(value) : minimum));
}
