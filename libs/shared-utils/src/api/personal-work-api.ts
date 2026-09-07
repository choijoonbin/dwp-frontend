import { axiosInstance } from '../axios-instance';
import type { ApiResponse } from '../types';
import type {
  PersonalDayPlan,
  PersonalWorkPage,
  PersonalWorkStatus,
  PersonalWorkTask,
  PersonalWorkTaskInput,
  PersonalWorkTimelineEvent,
  WorkSourceReference,
} from './personal-work-contracts';

export type * from './personal-work-contracts';
const base = '/api/platform/v1/workspace/work-hub';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function mutationConfig(idempotencyKey: string) {
  if (!uuid.test(idempotencyKey)) throw new Error('A stable UUID idempotency key is required');
  return { headers: { 'Idempotency-Key': idempotencyKey } };
}

function datePath(date: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/u.test(date) ||
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
  ) {
    throw new Error('A valid calendar date is required');
  }
  return `${base}/day-plans/${date}`;
}

export async function getPersonalWorkTasks(
  options: { page?: number; size?: number; status?: PersonalWorkStatus } = {}
): Promise<PersonalWorkPage<PersonalWorkTask>> {
  const params = new URLSearchParams({
    page: String(options.page ?? 0),
    size: String(options.size ?? 50),
  });
  if (options.status) params.set('status', options.status);
  const response = await axiosInstance.get<ApiResponse<PersonalWorkPage<PersonalWorkTask>>>(
    `${base}/personal-tasks?${params}`,
    { timeoutMs: 8_000 }
  );
  return response.data.data;
}

export async function getPersonalWorkTask(taskId: string): Promise<PersonalWorkTask> {
  return (
    await axiosInstance.get<ApiResponse<PersonalWorkTask>>(
      `${base}/personal-tasks/${encodeURIComponent(taskId)}`
    )
  ).data.data;
}

export async function createPersonalWorkTask(
  input: PersonalWorkTaskInput,
  idempotencyKey: string
): Promise<PersonalWorkTask> {
  return (
    await axiosInstance.post<ApiResponse<PersonalWorkTask>, PersonalWorkTaskInput>(
      `${base}/personal-tasks`,
      input,
      mutationConfig(idempotencyKey)
    )
  ).data.data;
}

export async function updatePersonalWorkTask(
  taskId: string,
  input: PersonalWorkTaskInput & { version: number },
  idempotencyKey: string
): Promise<PersonalWorkTask> {
  return (
    await axiosInstance.put<ApiResponse<PersonalWorkTask>, typeof input>(
      `${base}/personal-tasks/${encodeURIComponent(taskId)}`,
      input,
      mutationConfig(idempotencyKey)
    )
  ).data.data;
}

export async function transitionPersonalWorkTask(
  taskId: string,
  command: 'status' | 'complete' | 'reopen' | 'archive',
  input: { version: number; status?: PersonalWorkStatus },
  idempotencyKey: string
): Promise<PersonalWorkTask> {
  if (command === 'status' && !['OPEN', 'IN_PROGRESS', 'WAITING'].includes(input.status ?? ''))
    throw new Error('Use the lifecycle command for completion, reopening or archive');
  const payload = command === 'status' ? input : { version: input.version };
  return (
    await axiosInstance.post<ApiResponse<PersonalWorkTask>, typeof payload>(
      `${base}/personal-tasks/${encodeURIComponent(taskId)}/${command}`,
      payload,
      mutationConfig(idempotencyKey)
    )
  ).data.data;
}

export async function getPersonalWorkTimeline(
  taskId: string,
  page = 0,
  size = 50
): Promise<PersonalWorkPage<PersonalWorkTimelineEvent>> {
  return (
    await axiosInstance.get<ApiResponse<PersonalWorkPage<PersonalWorkTimelineEvent>>>(
      `${base}/personal-tasks/${encodeURIComponent(taskId)}/timeline?page=${page}&size=${size}`
    )
  ).data.data;
}

export async function getPersonalDayPlan(date: string): Promise<PersonalDayPlan> {
  return (await axiosInstance.get<ApiResponse<PersonalDayPlan>>(datePath(date))).data.data;
}

export async function replacePersonalDayPlan(
  date: string,
  input: { version: number; items: WorkSourceReference[] },
  idempotencyKey: string
): Promise<PersonalDayPlan> {
  return (
    await axiosInstance.put<ApiResponse<PersonalDayPlan>, typeof input>(
      datePath(date),
      input,
      mutationConfig(idempotencyKey)
    )
  ).data.data;
}
