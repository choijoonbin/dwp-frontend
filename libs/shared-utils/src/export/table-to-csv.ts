/**
 * 테이블 데이터를 CSV로 내보내기 (프론트 전용)
 * @see SynapseX Phase2~4 - 모든 리스트 화면 csv export 기본 제공
 */

// ----------------------------------------------------------------------

export type CsvColumn<T> = {
  id: keyof T | string;
  label: string;
  getValue?: (row: T) => string | number | null | undefined;
};

/**
 * 배열 데이터를 CSV 문자열로 변환
 */
export function tableToCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: CsvColumn<T>[],
  options?: { delimiter?: string; includeHeader?: boolean }
): string {
  const delimiter = options?.delimiter ?? ',';
  const includeHeader = options?.includeHeader ?? true;

  const escape = (val: string | number | null | undefined): string => {
    if (val == null) return '';
    const str = String(val);
    if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines: string[] = [];

  if (includeHeader) {
    lines.push(columns.map((c) => escape(c.label)).join(delimiter));
  }

  for (const row of rows) {
    const values = columns.map((col) => {
      const val = col.getValue
        ? col.getValue(row)
        : (row[col.id as keyof T] as string | number | null | undefined);
      return escape(val);
    });
    lines.push(values.join(delimiter));
  }

  return lines.join('\n');
}

/**
 * CSV 문자열을 Blob으로 만들어 다운로드
 */
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
