/**
 * agent-events API 응답 → StreamTimelineStep 변환
 * 표준 이벤트 + 레거시 호환, 중복 억제
 */

import type { StreamTimelineStep } from './stream-store';
import type { AgentEventItemDto } from '../api/synapse-operations-api';

const STANDARD_EVENT_TYPES = [
  'NODE_START',
  'NODE_END',
  'TOOL_CALL',
  'TOOL_RESULT',
  'EVIDENCE_ADDED',
  'EVIDENCE_REJECTED',
  'GATE_APPLIED',
  'COMPLETED',
  'FAILED',
] as const;

function parseEventType(raw: string | undefined): StreamTimelineStep['type'] {
  if (!raw) return 'step';
  const upper = String(raw).toUpperCase();
  if (STANDARD_EVENT_TYPES.includes(upper as (typeof STANDARD_EVENT_TYPES)[number])) {
    return upper as StreamTimelineStep['type'];
  }
  return 'step';
}

/** API 이벤트 → StreamTimelineStep 변환. BE: timestamp | occurred_at */
export function agentEventToTimelineStep(item: AgentEventItemDto): StreamTimelineStep {
  const eventType = (item.event_type ?? (item as { eventType?: string }).eventType) as
    | string
    | undefined;
  const occurredAt =
    item.occurred_at ?? (item as { occurredAt?: string }).occurredAt ?? item.timestamp;
  const summaryMessage =
    item.summary_message ?? (item as { summary_message?: string }).summary_message ?? '';
  const node = item.node ?? (item as { node?: string }).node;
  const decisionCode =
    item.decision_code ?? (item as { decision_code?: string }).decision_code;
  const tool = item.tool ?? (item as { tool?: string }).tool;
  const latencyMs = item.latency_ms ?? (item as { latency_ms?: number }).latency_ms;
  const evidenceIds =
    item.evidence_ids ?? (item as { evidence_ids?: string[] }).evidence_ids;
  const inputHash = item.input_hash ?? (item as { input_hash?: string }).input_hash;
  const errorMessage =
    item.error_message ?? (item as { error_message?: string }).error_message;

  const at = occurredAt ? new Date(String(occurredAt)).getTime() : undefined;
  const type = parseEventType(eventType);

  let message = summaryMessage;
  if (!message && type === 'FAILED' && errorMessage) message = errorMessage;
  if (!message && node) message = node;
  if (!message && type) message = String(type);

  return {
    type,
    label: eventType ?? type,
    node,
    decision_code: decisionCode,
    tool,
    latency_ms: typeof latencyMs === 'number' ? latencyMs : undefined,
    evidence_ids: Array.isArray(evidenceIds) ? evidenceIds : undefined,
    input_hash: inputHash,
    message,
    detail: message,
    at,
  };
}

/** dedupe key: event_type + node + input_hash + timestamp(초단위) */
export function dedupeAgentEvents(steps: StreamTimelineStep[]): StreamTimelineStep[] {
  const seen = new Set<string>();
  return steps.filter((s) => {
    const tsSec = s.at != null ? Math.floor(s.at / 1000) : '';
    const key = `${s.type}|${s.node ?? ''}|${s.input_hash ?? ''}|${tsSec}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** API events 배열 → StreamTimelineStep[] (정렬: occurred_at 기준) */
export function agentEventsToTimelineSteps(
  events: AgentEventItemDto[] | undefined
): StreamTimelineStep[] {
  if (!Array.isArray(events) || events.length === 0) return [];
  const steps = events.map(agentEventToTimelineStep);
  const sorted = [...steps].sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
  return dedupeAgentEvents(sorted);
}
