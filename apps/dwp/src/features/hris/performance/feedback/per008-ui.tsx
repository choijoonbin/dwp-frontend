import { useEffect, useId, useRef, useState } from 'react';
import {
  ActionButton,
  dayjs,
  DwpDateTimeProvider,
  FormDialog,
  FormField,
  InlineFeedback,
  LoadingState,
  LocalDateTimePickerField,
} from '@dwp-frontend/design-system';
import { formatDate, resolveZonedDateTimeParts } from '@dwp-frontend/shared-i18n';
import MenuItem from '@mui/material/MenuItem';

import { Per008ClientError } from './per008-client';

import type {
  Per008AssignedFeedbackDetail,
  Per008AnonymityMode,
  Per008CreateFeedbackRequestCommand,
  Per008FeedbackAnswer,
  Per008FeedbackResponseCommand,
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
  return formatDate(
    value,
    {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone,
    },
    locale
  );
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
  const parts = resolveZonedDateTimeParts(value, timeZone);
  if (!parts) throw new RangeError('Unable to resolve the requested zoned date-time.');
  return parts;
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

export const personalCopy = {
  en: {
    eyebrow: 'My performance',
    title: 'Feedback inbox',
    description:
      'Request feedback for your explicit SELF assignment and respond to work assigned to you.',
    inbox: 'Assigned feedback',
    detail: 'Feedback details',
    status: 'Status',
    window: 'Response window',
    select: 'Open feedback',
    noSelection: 'Select an assignment to view its protected details.',
    unavailableDetail: 'The selected assignment details are not available.',
    response: 'Your response',
    submit: 'Submit final response',
    submitting: 'Submitting…',
    submitted: 'Your response was submitted.',
    reviewSubmit: 'Review final response',
    confirmTitle: 'Submit this immutable response?',
    confirmImpact:
      'After submission, this response cannot be edited or replaced. Review every answer before continuing.',
    confirmSubmit: 'Confirm and submit',
    backToEdit: 'Back to editing',
    requiredMissing: 'Complete all required questions.',
    responseLocked: 'A response is available only while this assignment is open and assigned.',
    release: 'Released feedback',
    openRelease: 'Open release status',
    privacy: 'Privacy mode',
    releasedAt: 'Released',
    selfUnavailable: 'SELF request is unavailable.',
    outcomeUnknown:
      'The command outcome is unknown. Replay with the same request key to confirm it safely.',
    replay: 'Replay safely',
    previous: 'Previous page',
    next: 'Next page',
    page: 'Page',
  },
  ko: {
    eyebrow: '나의 성과',
    title: '피드백 받은 편지함',
    description:
      '명시적으로 확인된 SELF 배정으로 피드백을 요청하고 나에게 배정된 응답을 처리합니다.',
    inbox: '배정된 피드백',
    detail: '피드백 상세',
    status: '상태',
    window: '응답 기간',
    select: '피드백 열기',
    noSelection: '배정을 선택하면 보호된 상세 정보를 볼 수 있습니다.',
    unavailableDetail: '선택한 배정의 상세 정보를 사용할 수 없습니다.',
    response: '나의 응답',
    submit: '최종 응답 제출',
    submitting: '제출 중…',
    submitted: '응답을 제출했습니다.',
    reviewSubmit: '최종 응답 검토',
    confirmTitle: '변경할 수 없는 응답을 제출할까요?',
    confirmImpact:
      '제출한 응답은 수정하거나 교체할 수 없습니다. 계속하기 전에 모든 답변을 확인하세요.',
    confirmSubmit: '확인 후 제출',
    backToEdit: '수정으로 돌아가기',
    requiredMissing: '필수 질문에 모두 답해 주세요.',
    responseLocked: '요청과 배정이 모두 열려 있을 때만 응답할 수 있습니다.',
    release: '공개된 피드백',
    openRelease: '공개 상태 열기',
    privacy: '개인정보 보호 방식',
    releasedAt: '공개 시각',
    selfUnavailable: 'SELF 요청을 사용할 수 없습니다.',
    outcomeUnknown:
      '명령 결과를 확인할 수 없습니다. 동일한 요청 키로 안전하게 재실행해 확인하세요.',
    replay: '동일 키로 재실행',
    previous: '이전 페이지',
    next: '다음 페이지',
    page: '페이지',
  },
} as const;

const localizedCodes: Record<Per008Locale, Readonly<Record<string, string>>> = {
  en: {
    ASSIGNED: 'Assigned',
    SUBMITTED: 'Submitted',
    DECLINED: 'Declined',
    CANCELLED: 'Cancelled',
    DRAFT: 'Draft',
    OPEN: 'Open',
    CLOSED: 'Closed',
    AGGREGATED: 'Aggregated',
    RELEASED: 'Released',
  },
  ko: {
    ASSIGNED: '배정됨',
    SUBMITTED: '제출됨',
    DECLINED: '거절됨',
    CANCELLED: '취소됨',
    DRAFT: '초안',
    OPEN: '진행 중',
    CLOSED: '마감됨',
    AGGREGATED: '집계 완료',
    RELEASED: '공개됨',
  },
};

export function localizedCode(value: string, locale: Per008Locale): string {
  return localizedCodes[locale][value] ?? value.replaceAll('_', ' ');
}

export function showsProtectedRows(state: Per008ProtectedState): boolean {
  return state === 'COMPLETE' || state === 'PARTIAL' || state === 'STALE';
}

export function stateFromError(error: unknown): Per008ProtectedState {
  if (!(error instanceof Per008ClientError)) return 'UNAVAILABLE';
  if (error.code === 'DENIED' || error.code === 'NOT_FOUND') return 'DENIED';
  if (error.code === 'STALE') return 'STALE';
  if (error.code === 'SUPPRESSED') return 'SUPPRESSED';
  return 'UNAVAILABLE';
}

type ResponseFormProps = Readonly<{
  detail: Per008AssignedFeedbackDetail;
  locale: Per008Locale;
  busy?: boolean;
  onSubmit: (command: Per008FeedbackResponseCommand) => void;
}>;

export function Per008ResponseForm({ detail, locale, busy = false, onSubmit }: ResponseFormProps) {
  const labels = personalCopy[locale];
  const [pending, setPending] = useState<Per008FeedbackResponseCommand>();
  const [validationMessage, setValidationMessage] = useState<string>();

  const answerText = (answer: Per008FeedbackAnswer): string => {
    if (answer.textValue !== null) return answer.textValue;
    if (answer.numberValue !== null) return String(answer.numberValue);
    const question = detail.questions.find(
      (candidate) => candidate.questionPublicId === answer.questionPublicId
    );
    return answer.choiceOptionPublicIds
      .map(
        (id) =>
          question?.choiceOptions.find((option) => option.choiceOptionPublicId === id)?.label ?? id
      )
      .join(', ');
  };
  return (
    <>
      <form
        className="per008-response-form"
        aria-labelledby="per008-response-heading"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const answers: Per008FeedbackAnswer[] = [];
          let missingRequired = false;
          for (const question of detail.questions) {
            const values = data.getAll(question.questionPublicId).map(String);
            const base = {
              questionPublicId: question.questionPublicId,
              answerType: question.answerType,
            };
            if (question.answerType === 'TEXT') {
              const textValue = String(values[0] ?? '').trim();
              if (!textValue) {
                missingRequired ||= question.required;
                continue;
              }
              answers.push({ ...base, textValue, numberValue: null, choiceOptionPublicIds: [] });
              continue;
            }
            if (question.answerType === 'NUMBER') {
              const raw = String(values[0] ?? '').trim();
              if (!raw) {
                missingRequired ||= question.required;
                continue;
              }
              const numberValue = Number(raw);
              if (!Number.isFinite(numberValue)) {
                missingRequired = true;
                continue;
              }
              answers.push({ ...base, textValue: null, numberValue, choiceOptionPublicIds: [] });
              continue;
            }
            if (values.length === 0) {
              missingRequired ||= question.required;
              continue;
            }
            answers.push({
              ...base,
              textValue: null,
              numberValue: null,
              choiceOptionPublicIds: values.sort(),
            });
          }
          if (missingRequired || answers.length === 0) {
            setValidationMessage(labels.requiredMissing);
            return;
          }
          setValidationMessage(undefined);
          setPending({
            expectedRequestVersion: detail.expectedRequestVersion,
            templateContentHash: detail.templateContentHash,
            response: { schemaKey: 'PerformanceFeedbackResponse.v1', answers },
          });
        }}
      >
        <h3 id="per008-response-heading">{labels.response}</h3>
        {detail.questions.map((question, index) => (
          <fieldset
            key={question.questionPublicId}
            className="per008-question"
            disabled={busy || !!pending}
          >
            <legend>
              <span>{index + 1}.</span> {question.prompt}
            </legend>
            {question.answerType === 'TEXT' && (
              <textarea name={question.questionPublicId} required={question.required} rows={5} />
            )}
            {question.answerType === 'NUMBER' && (
              <input
                name={question.questionPublicId}
                type="number"
                required={question.required}
                step="any"
              />
            )}
            {(question.answerType === 'SINGLE_CHOICE' ||
              question.answerType === 'MULTI_CHOICE') && (
              <div className="per008-choice-list" role="group" aria-required={question.required}>
                {question.choiceOptions.map((option) => (
                  <label key={option.choiceOptionPublicId}>
                    <input
                      name={question.questionPublicId}
                      type={question.answerType === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'}
                      value={option.choiceOptionPublicId}
                      required={question.answerType === 'SINGLE_CHOICE' && question.required}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        ))}
        {validationMessage && (
          <p className="per008-validation" role="alert">
            {validationMessage}
          </p>
        )}
        <div className="per008-actions">
          <button
            className="per008-button per008-button--primary"
            type="submit"
            disabled={busy || !!pending}
          >
            {busy ? labels.submitting : labels.reviewSubmit}
          </button>
        </div>
      </form>
      <FormDialog
        open={!!pending}
        title={labels.confirmTitle}
        description={labels.confirmImpact}
        cancelLabel={labels.backToEdit}
        submitLabel={labels.confirmSubmit}
        submittingLabel={labels.submitting}
        busy={busy}
        submitIntent="danger"
        mobileFullScreen
        onClose={() => setPending(undefined)}
        onSubmit={() => {
          if (!pending) return;
          const command = pending;
          setPending(undefined);
          onSubmit(command);
        }}
      >
        <ol className="per008-confirmation__answers">
          {pending?.response.answers.map((answer) => (
            <li key={answer.questionPublicId}>
              <strong>
                {
                  detail.questions.find(
                    (question) => question.questionPublicId === answer.questionPublicId
                  )?.prompt
                }
              </strong>
              <span>{answerText(answer)}</span>
            </li>
          ))}
        </ol>
      </FormDialog>
    </>
  );
}
