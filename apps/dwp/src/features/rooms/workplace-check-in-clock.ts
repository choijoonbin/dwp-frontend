export function workplaceCheckInClock(deadline: string | null | undefined, now: number) {
  const deadlineAt = deadline ? Date.parse(deadline) : Number.NaN;
  if (!Number.isFinite(deadlineAt) || !Number.isFinite(now)) return null;
  const seconds = Math.max(0, Math.ceil((deadlineAt - now) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts = [minutes, seconds % 60].map((value) => String(value).padStart(2, '0'));
  if (hours) parts.unshift(String(hours).padStart(2, '0'));
  return { remaining: parts.join(':'), elapsed: deadlineAt <= now };
}
