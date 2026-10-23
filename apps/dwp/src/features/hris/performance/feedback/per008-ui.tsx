import { useEffect, useId, useRef, useState } from 'react';

import type {
  Per008AnonymityMode,
  Per008CreateFeedbackRequestCommand,
  Per008ProtectedState,
  Per008RequestOptions,
} from './per008-model';

export type Per008Locale = 'en' | 'ko';

export const per008Copy = {
  en: {
    retry: 'Try again', loading: 'Loading protected feedback information…',
    empty: 'There is no feedback work available for this scope.',
    partial: 'Some information is unavailable. Actions based on incomplete evidence are hidden.',
    unavailable: 'Feedback information is temporarily unavailable.',
    denied: 'You do not have permission to view this feedback information.',
    stale: 'This information changed. Refresh before continuing.',
    suppressed: 'This request cannot be shown or completed under the current privacy policy.',
    current: 'Current', lastRefresh: 'Last successful refresh', masked: 'Restricted', omitted: 'Not available',
    requestFeedback: 'Request feedback', requestHeading: 'Create a feedback request',
    requestHint: 'Choose a finalized form, privacy mode, release threshold and response window.',
    template: 'Feedback form', anonymity: 'Privacy mode', threshold: 'Minimum release threshold',
    opensAt: 'Opens at', closesAt: 'Closes at', cancel: 'Cancel', create: 'Create draft request',
    saving: 'Saving…', requestCreated: 'Draft feedback request created.',
    windowInvalid: 'Choose a valid response window within the allowed duration.',
  },
  ko: {
    retry: '다시 시도', loading: '보호된 피드백 정보를 불러오는 중입니다…',
    empty: '현재 범위에 처리할 피드백 업무가 없습니다.',
    partial: '일부 정보를 불러오지 못했습니다. 불완전한 근거에 기반한 작업은 숨겼습니다.',
    unavailable: '피드백 정보를 일시적으로 사용할 수 없습니다.',
    denied: '이 피드백 정보를 볼 권한이 없습니다.',
    stale: '정보가 변경되었습니다. 계속하기 전에 새로 고침해 주세요.',
    suppressed: '현재 개인정보 보호 정책에서는 이 요청을 표시하거나 완료할 수 없습니다.',
    current: '최신', lastRefresh: '마지막 정상 갱신', masked: '접근 제한', omitted: '표시할 수 없음',
    requestFeedback: '피드백 요청', requestHeading: '피드백 요청 만들기',
    requestHint: '확정된 양식, 개인정보 보호 방식, 공개 기준과 응답 기간을 선택하세요.',
    template: '피드백 양식', anonymity: '개인정보 보호 방식', threshold: '최소 공개 기준',
    opensAt: '응답 시작', closesAt: '응답 마감', cancel: '취소', create: '초안 요청 만들기',
    saving: '저장 중…', requestCreated: '피드백 요청 초안을 만들었습니다.',
    windowInvalid: '허용된 최대 기간 안에서 유효한 응답 기간을 선택하세요.',
  },
} as const;

type NoticeProps = Readonly<{
  state: Per008ProtectedState;
  locale?: Per008Locale;
  onRetry?: () => void;
}>;

export function Per008ProtectedNotice({ state, locale = 'ko', onRetry }: NoticeProps) {
  if (state === 'COMPLETE') return null;
  const labels = per008Copy[locale];
  const message = state === 'LOADING' ? labels.loading
    : state === 'EMPTY' ? labels.empty
    : state === 'PARTIAL' ? labels.partial
    : state === 'DENIED' ? labels.denied
    : state === 'STALE' ? labels.stale
    : state === 'SUPPRESSED' ? labels.suppressed : labels.unavailable;
  const retryable = state === 'UNAVAILABLE' || state === 'STALE' || state === 'PARTIAL';
  return (
    <div className={`per008-notice per008-notice--${state.toLowerCase()}`}
      role={state === 'LOADING' ? 'status' : 'alert'}
      aria-live={state === 'LOADING' ? 'polite' : 'assertive'}>
      <p>{message}</p>
      {retryable && onRetry && <button type="button" onClick={onRetry}>{labels.retry}</button>}
    </div>
  );
}

export function formatPer008Instant(value: string, locale: Per008Locale): string {
  return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(value));
}

function inputValue(value: string): string {
  const date = new Date(value);
  const part = (number: number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}` +
    `T${part(date.getHours())}:${part(date.getMinutes())}`;
}
function inputInstant(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) ? date.toISOString() : null;
}

type RequestComposerProps = Readonly<{
  options: Per008RequestOptions;
  locale?: Per008Locale;
  busy?: boolean;
  onCancel: () => void;
  onSubmit: (command: Per008CreateFeedbackRequestCommand) => void;
}>;

export function Per008RequestComposer({ options, locale = 'ko', busy = false, onCancel,
  onSubmit }: RequestComposerProps) {
  const labels = per008Copy[locale];
  const titleId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [templateVersionId, setTemplateVersionId] = useState(options.templates[0]!.templateVersionId);
  const [anonymityMode, setAnonymityMode] = useState<Per008AnonymityMode>(options.anonymityModes[0]!);
  const [minimumReleaseCount, setMinimumReleaseCount] = useState(options.thresholdLimits.minimum);
  const [opensAt, setOpensAt] = useState(inputValue(options.windowLimits.earliestOpensAt));
  const [closesAt, setClosesAt] = useState(inputValue(options.windowLimits.latestClosesAt));
  const [windowError, setWindowError] = useState(false);

  useEffect(() => {
    setTemplateVersionId(options.templates[0]!.templateVersionId);
    setAnonymityMode(options.anonymityModes[0]!);
    setMinimumReleaseCount(options.thresholdLimits.minimum);
    setOpensAt(inputValue(options.windowLimits.earliestOpensAt));
    setClosesAt(inputValue(options.windowLimits.latestClosesAt));
    setWindowError(false);
    headingRef.current?.focus();
  }, [options]);

  return (
    <section className="per008-composer" aria-labelledby={titleId}>
      <header>
        <div>
          <h2 id={titleId} ref={headingRef} tabIndex={-1}>{labels.requestHeading}</h2>
          <p>{labels.requestHint}</p>
        </div>
        <button className="per008-button per008-button--quiet" type="button" onClick={onCancel}
          disabled={busy}>{labels.cancel}</button>
      </header>
      <form onSubmit={(event) => {
        event.preventDefault();
        const opensAtInstant = inputInstant(opensAt);
        const closesAtInstant = inputInstant(closesAt);
        const duration = opensAtInstant && closesAtInstant
          ? Date.parse(closesAtInstant) - Date.parse(opensAtInstant) : Number.NaN;
        const invalidWindow = !opensAtInstant || !closesAtInstant || duration <= 0 ||
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
      }}>
        <div className="per008-form-grid">
          <label>{labels.template}
            <select value={templateVersionId} disabled={busy}
              onChange={(event) => setTemplateVersionId(event.target.value)}>
              {options.templates.map((template) => (
                <option key={template.templateVersionId} value={template.templateVersionId}>{template.label}</option>
              ))}
            </select>
          </label>
          <label>{labels.anonymity}
            <select value={anonymityMode} disabled={busy}
              onChange={(event) => setAnonymityMode(event.target.value as Per008AnonymityMode)}>
              {options.anonymityModes.map((mode) => <option key={mode} value={mode}>{mode.replaceAll('_', ' ')}</option>)}
            </select>
          </label>
          <label>{labels.threshold}
            <input type="number" min={options.thresholdLimits.minimum} max={options.thresholdLimits.maximum}
              value={Number.isFinite(minimumReleaseCount) ? minimumReleaseCount : ''} required disabled={busy}
              onChange={(event) => setMinimumReleaseCount(event.currentTarget.valueAsNumber)} />
          </label>
          <label>{labels.opensAt}
            <input type="datetime-local" min={inputValue(options.windowLimits.earliestOpensAt)}
              max={inputValue(options.windowLimits.latestClosesAt)} value={opensAt} disabled={busy}
              required onChange={(event) => setOpensAt(event.target.value)} />
          </label>
          <label>{labels.closesAt}
            <input type="datetime-local" min={opensAt} max={inputValue(options.windowLimits.latestClosesAt)}
              value={closesAt} required disabled={busy} onChange={(event) => setClosesAt(event.target.value)} />
          </label>
        </div>
        <div className="per008-actions">
          <button className="per008-button per008-button--primary" type="submit" disabled={busy}>
            {busy ? labels.saving : labels.create}
          </button>
        </div>
        {windowError && <p className="per008-validation" role="alert">{labels.windowInvalid}</p>}
      </form>
    </section>
  );
}
