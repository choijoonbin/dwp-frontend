import { useEffect, useId, useRef, useState } from 'react';
import {
  ActionButton,
  dayjs,
  DwpDateTimeProvider,
  FormField,
  InlineFeedback,
  LoadingState,
  LocalDateTimePickerField,
} from '@dwp-frontend/design-system';
import MenuItem from '@mui/material/MenuItem';

import type {
  Per008AnonymityMode,
  Per008CreateFeedbackRequestCommand,
  Per008ProtectedState,
  Per008RequestOptions,
} from './per008-model';

export type Per008Locale = 'en' | 'ko';

export const per008Copy = {
  en: {
    retry: 'Try again',
    loading: 'Loading protected feedback information…',
    empty: 'There is no feedback work available for this scope.',
    partial: 'Some information is unavailable. Actions based on incomplete evidence are hidden.',
    unavailable: 'Feedback information is temporarily unavailable.',
    denied: 'You do not have permission to view this feedback information.',
    stale: 'This information changed. Refresh before continuing.',
    suppressed: 'This request cannot be shown or completed under the current privacy policy.',
    current: 'Current',
    lastRefresh: 'Last successful refresh',
    masked: 'Restricted',
    omitted: 'Not available',
    requestFeedback: 'Request feedback',
    requestHeading: 'Create a feedback request',
    requestHint: 'Choose a finalized form, privacy mode, release threshold and response window.',
    template: 'Feedback form',
    anonymity: 'Privacy mode',
    threshold: 'Minimum release threshold',
    opensAt: 'Opens at',
    closesAt: 'Closes at',
    cancel: 'Cancel',
    create: 'Create draft request',
    saving: 'Saving…',
    requestCreated: 'Draft feedback request created.',
    windowInvalid: 'Choose a valid response window within the allowed duration.',
    timeZone: 'Display time zone',
    actionDenied: 'You do not have permission to complete this feedback action.',
    actionStale: 'The action authorization changed. Refresh the evidence before continuing.',
    actionSuppressed: 'The current privacy policy does not allow this feedback action.',
    actionUnavailable: 'This feedback action is temporarily unavailable.',
  },
  ko: {
    retry: '다시 시도',
    loading: '보호된 피드백 정보를 불러오는 중입니다…',
    empty: '현재 범위에 처리할 피드백 업무가 없습니다.',
    partial: '일부 정보를 불러오지 못했습니다. 불완전한 근거에 기반한 작업은 숨겼습니다.',
    unavailable: '피드백 정보를 일시적으로 사용할 수 없습니다.',
    denied: '이 피드백 정보를 볼 권한이 없습니다.',
    stale: '정보가 변경되었습니다. 계속하기 전에 새로 고침해 주세요.',
    suppressed: '현재 개인정보 보호 정책에서는 이 요청을 표시하거나 완료할 수 없습니다.',
    current: '최신',
    lastRefresh: '마지막 정상 갱신',
    masked: '접근 제한',
    omitted: '표시할 수 없음',
    requestFeedback: '피드백 요청',
    requestHeading: '피드백 요청 만들기',
    requestHint: '확정된 양식, 개인정보 보호 방식, 공개 기준과 응답 기간을 선택하세요.',
    template: '피드백 양식',
    anonymity: '개인정보 보호 방식',
    threshold: '최소 공개 기준',
    opensAt: '응답 시작',
    closesAt: '응답 마감',
    cancel: '취소',
    create: '초안 요청 만들기',
    saving: '저장 중…',
    requestCreated: '피드백 요청 초안을 만들었습니다.',
    windowInvalid: '허용된 최대 기간 안에서 유효한 응답 기간을 선택하세요.',
    timeZone: '표시 시간대',
    actionDenied: '이 피드백 작업을 수행할 권한이 없습니다.',
    actionStale: '작업 권한 근거가 변경되었습니다. 계속하기 전에 정보를 새로 고쳐 주세요.',
    actionSuppressed: '현재 개인정보 보호 정책에서는 이 피드백 작업을 수행할 수 없습니다.',
    actionUnavailable: '피드백 작업을 일시적으로 수행할 수 없습니다.',
  },
} as const;

const anonymityLabels: Record<Per008Locale, Record<Per008AnonymityMode, string>> = {
  en: {
    IDENTIFIED: 'Identified',
    MASKED: 'Masked',
    ANONYMOUS_AGGREGATE: 'Anonymous aggregate',
  },
  ko: {
    IDENTIFIED: '실명',
    MASKED: '가명 처리',
    ANONYMOUS_AGGREGATE: '익명 집계',
  },
};

type NoticeProps = Readonly<{
  state: Per008ProtectedState;
  locale?: Per008Locale;
  onRetry?: () => void;
}>;

export function Per008ProtectedNotice({ state, locale = 'ko', onRetry }: NoticeProps) {
  if (state === 'COMPLETE') return null;
  const labels = per008Copy[locale];
  const message =
    state === 'LOADING'
      ? labels.loading
      : state === 'EMPTY'
        ? labels.empty
        : state === 'PARTIAL'
          ? labels.partial
          : state === 'DENIED'
            ? labels.denied
            : state === 'STALE'
              ? labels.stale
              : state === 'SUPPRESSED'
                ? labels.suppressed
                : labels.unavailable;
  const retryable = state === 'UNAVAILABLE' || state === 'STALE' || state === 'PARTIAL';
  return (
    <div className={`per008-notice per008-notice--${state.toLowerCase()}`}>
      {state === 'LOADING' ? (
        <LoadingState label={message} embedded />
      ) : (
        <InlineFeedback
          severity={state === 'DENIED' || state === 'UNAVAILABLE' ? 'error' : 'warning'}
          role="alert"
          action={
            retryable && onRetry ? (
              <ActionButton intent="quiet" type="button" onClick={onRetry}>
                {labels.retry}
              </ActionButton>
            ) : undefined
          }
        >
          {message}
        </InlineFeedback>
      )}
    </div>
  );
}

export function Per008ActionNotice({ state, locale = 'ko' }: Omit<NoticeProps, 'onRetry'>) {
  const labels = per008Copy[locale];
  const message =
    state === 'DENIED'
      ? labels.actionDenied
      : state === 'STALE'
        ? labels.actionStale
        : state === 'SUPPRESSED'
          ? labels.actionSuppressed
          : labels.actionUnavailable;
  return (
    <div className={`per008-notice per008-notice--${state.toLowerCase()}`}>
      <InlineFeedback severity="error" role="alert">
        {message}
      </InlineFeedback>
    </div>
  );
}

export function formatPer008Instant(value: string, locale: Per008Locale, timeZone: string): string {
  return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(value));
}

export function formatPer008AnonymityMode(mode: Per008AnonymityMode, locale: Per008Locale): string {
  return anonymityLabels[locale][mode];
}

type Per008ZonedParts = Readonly<{
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
}>;

function zonedParts(value: string | number, timeZone: string): Per008ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return {
    year: part('year'),
    month: part('month'),
    day: part('day'),
    hour: part('hour'),
    minute: part('minute'),
    second: part('second'),
  };
}

function inputValue(value: string | number, timeZone: string): string {
  const parts = zonedParts(value, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function zonedOffsetAt(value: number, timeZone: string): number {
  const parts = zonedParts(value, timeZone);
  const represented = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return represented - Math.floor(value / 1_000) * 1_000;
}

function inputInstant(value: string, timeZone: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const localAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute)
  );
  if (!Number.isFinite(localAsUtc)) return null;
  const canonical = `${year}-${month}-${day}T${hour}:${minute}`;
  const offsets = new Set([
    zonedOffsetAt(localAsUtc - 86_400_000, timeZone),
    zonedOffsetAt(localAsUtc, timeZone),
    zonedOffsetAt(localAsUtc + 86_400_000, timeZone),
  ]);
  const candidates = [...offsets]
    .map((offset) => localAsUtc - offset)
    .filter((candidate) => inputValue(candidate, timeZone) === canonical)
    .sort((left, right) => left - right);
  return candidates[0] === undefined ? null : new Date(candidates[0]).toISOString();
}

function requestWindowDefaults(options: Per008RequestOptions, timeZone: string) {
  const minute = 60_000;
  const earliest = Math.ceil(Date.parse(options.windowLimits.earliestOpensAt) / minute) * minute;
  const latest = Math.floor(Date.parse(options.windowLimits.latestClosesAt) / minute) * minute;
  const maximumClose = earliest + options.windowLimits.maximumDurationDays * 86_400_000;
  const closes = Math.min(latest, maximumClose);
  return {
    opensAt: inputValue(earliest, timeZone),
    closesAt: inputValue(closes, timeZone),
  };
}

type RequestComposerProps = Readonly<{
  options: Per008RequestOptions;
  locale?: Per008Locale;
  timeZone: string;
  busy?: boolean;
  onCancel: () => void;
  onSubmit: (command: Per008CreateFeedbackRequestCommand) => void;
}>;

export function Per008RequestComposer({
  options,
  locale = 'ko',
  timeZone,
  busy = false,
  onCancel,
  onSubmit,
}: RequestComposerProps) {
  const labels = per008Copy[locale];
  const titleId = useId();
  const timeZoneId = useId();
  const windowErrorId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const initialWindow = requestWindowDefaults(options, timeZone);
  const [templateVersionId, setTemplateVersionId] = useState(
    options.templates[0]!.templateVersionId
  );
  const [anonymityMode, setAnonymityMode] = useState<Per008AnonymityMode>(
    options.anonymityModes[0]!
  );
  const [minimumReleaseCount, setMinimumReleaseCount] = useState(options.thresholdLimits.minimum);
  const [opensAt, setOpensAt] = useState(initialWindow.opensAt);
  const [closesAt, setClosesAt] = useState(initialWindow.closesAt);
  const [windowError, setWindowError] = useState(false);

  useEffect(() => {
    setTemplateVersionId(options.templates[0]!.templateVersionId);
    setAnonymityMode(options.anonymityModes[0]!);
    setMinimumReleaseCount(options.thresholdLimits.minimum);
    const nextWindow = requestWindowDefaults(options, timeZone);
    setOpensAt(nextWindow.opensAt);
    setClosesAt(nextWindow.closesAt);
    setWindowError(false);
    headingRef.current?.focus();
  }, [options, timeZone]);

  return (
    <section className="per008-composer" aria-labelledby={titleId}>
      <header>
        <div>
          <h2 id={titleId} ref={headingRef} tabIndex={-1}>
            {labels.requestHeading}
          </h2>
          <p>{labels.requestHint}</p>
          <p id={timeZoneId} className="per008-muted">
            {labels.timeZone}: {timeZone}
          </p>
        </div>
        <ActionButton
          intent="quiet"
          className="per008-button per008-button--quiet"
          type="button"
          onClick={onCancel}
          disabled={busy}
        >
          {labels.cancel}
        </ActionButton>
      </header>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const opensAtInstant = inputInstant(opensAt, timeZone);
          const closesAtInstant = inputInstant(closesAt, timeZone);
          const duration =
            opensAtInstant && closesAtInstant
              ? Date.parse(closesAtInstant) - Date.parse(opensAtInstant)
              : Number.NaN;
          const invalidWindow =
            !opensAtInstant ||
            !closesAtInstant ||
            duration <= 0 ||
            duration > options.windowLimits.maximumDurationDays * 86_400_000 ||
            Date.parse(opensAtInstant) < Date.parse(options.windowLimits.earliestOpensAt) ||
            Date.parse(closesAtInstant) > Date.parse(options.windowLimits.latestClosesAt);
          setWindowError(invalidWindow);
          if (invalidWindow || !Number.isFinite(minimumReleaseCount)) {
            event.currentTarget.reportValidity();
            return;
          }
          onSubmit({
            cycleVersionId: options.cycleVersionId,
            subjectWorkerPublicId: options.subjectWorkerPublicId,
            subjectAssignmentPublicId: options.subjectAssignmentPublicId,
            templateVersionId,
            anonymityMode,
            minimumReleaseCount,
            opensAt: opensAtInstant,
            closesAt: closesAtInstant,
          });
        }}
      >
        <DwpDateTimeProvider locale={locale} timeZone={timeZone}>
          <div className="per008-form-grid">
            <FormField
              select
              label={labels.template}
              sx={{ gridColumn: '1 / -1' }}
              value={templateVersionId}
              disabled={busy}
              onChange={(event) => setTemplateVersionId(event.target.value)}
            >
              {options.templates.map((template) => (
                <MenuItem key={template.templateVersionId} value={template.templateVersionId}>
                  {template.label}
                </MenuItem>
              ))}
            </FormField>
            <FormField
              select
              label={labels.anonymity}
              value={anonymityMode}
              disabled={busy}
              onChange={(event) => setAnonymityMode(event.target.value as Per008AnonymityMode)}
            >
              {options.anonymityModes.map((mode) => (
                <MenuItem key={mode} value={mode}>
                  {formatPer008AnonymityMode(mode, locale)}
                </MenuItem>
              ))}
            </FormField>
            <FormField
              label={labels.threshold}
              type="number"
              value={Number.isFinite(minimumReleaseCount) ? minimumReleaseCount : ''}
              required
              disabled={busy}
              inputProps={{
                min: options.thresholdLimits.minimum,
                max: options.thresholdLimits.maximum,
              }}
              onChange={(event) =>
                setMinimumReleaseCount(
                  event.target.value === '' ? Number.NaN : Number(event.target.value)
                )
              }
            />
            <LocalDateTimePickerField
              label={labels.opensAt}
              minDateTime={dayjs.utc(inputValue(options.windowLimits.earliestOpensAt, timeZone))}
              maxDateTime={dayjs.utc(inputValue(options.windowLimits.latestClosesAt, timeZone))}
              value={opensAt}
              disabled={busy}
              required
              supportingText={`${labels.timeZone}: ${timeZone}`}
              errorMessage={windowError ? labels.windowInvalid : undefined}
              onValueChange={(value) => {
                setOpensAt(value ?? '');
                setWindowError(false);
              }}
            />
            <LocalDateTimePickerField
              label={labels.closesAt}
              minDateTime={opensAt ? dayjs.utc(opensAt) : undefined}
              maxDateTime={dayjs.utc(inputValue(options.windowLimits.latestClosesAt, timeZone))}
              value={closesAt}
              required
              disabled={busy}
              supportingText={`${labels.timeZone}: ${timeZone}`}
              errorMessage={windowError ? labels.windowInvalid : undefined}
              onValueChange={(value) => {
                setClosesAt(value ?? '');
                setWindowError(false);
              }}
            />
          </div>
        </DwpDateTimeProvider>
        <div className="per008-actions">
          <ActionButton
            intent="primary"
            className="per008-button per008-button--primary"
            type="submit"
            disabled={busy}
          >
            {busy ? labels.saving : labels.create}
          </ActionButton>
        </div>
        {windowError && (
          <p id={windowErrorId} className="per008-validation" role="alert">
            {labels.windowInvalid}
          </p>
        )}
      </form>
    </section>
  );
}
