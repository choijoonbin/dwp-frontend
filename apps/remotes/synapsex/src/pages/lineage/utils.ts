import type { VendorMasterChange } from '../../components/evidence/types';

/**
 * Time-travel 관련 유틸리티 함수
 */

/**
 * 두 snapshot 간의 변경된 필드를 추출
 */
export function getChangedFields(
  oldData: Record<string, any>,
  newData: Record<string, any>
): VendorMasterChange[] {
  const changes: VendorMasterChange[] = [];

  Object.keys(oldData).forEach((key) => {
    if (oldData[key] !== newData[key]) {
      changes.push({
        field: key,
        oldValue: String(oldData[key]),
        newValue: String(newData[key]),
      });
    }
  });

  return changes;
}

/**
 * 날짜/시간 포맷팅
 */
export function formatDateTime(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return timestamp;
  }
}

export function formatDate(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleDateString();
  } catch {
    return timestamp;
  }
}

export function formatTime(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return timestamp;
  }
}

/**
 * Key/Value 안전 렌더링
 */
export function safeRenderKeyValue(value: any): string {
  if (typeof value === 'number') {
    return value.toLocaleString();
  }
  return String(value);
}

/**
 * CamelCase를 읽기 쉬운 형태로 변환
 */
export function formatKeyName(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .replace(/^./, (str) => str.toUpperCase());
}
