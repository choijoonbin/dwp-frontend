// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PerformanceReviewAnswerField } from './performance-review-answer-fields';
import { PerformanceReviewWorkspaceView } from './performance-review-workspace';
import { validatePerformanceReviewAnswers } from '../model/performance-review-draft';
import { assignedPerformanceReviewFixture } from '../model/performance-review-test-fixtures';

const review = assignedPerformanceReviewFixture();
const noopAsync = async () => true;
const emittedCss = () =>
  [...document.styleSheets]
    .flatMap((sheet) => [...sheet.cssRules].map((rule) => rule.cssText))
    .join('\n');
const baseProps = {
  review,
  answers: review.answers,
  validation: validatePerformanceReviewAnswers(review.form, review.answers, true),
  validationVisible: false,
  submission: null,
  dirty: false,
  pendingKind: null,
  commandBusy: false,
  commandConnected: true,
  feedback: null,
  loadFailure: null,
  commandFailure: null,
  denied: false,
  loading: false,
  fetching: false,
  empty: false,
  partial: false,
  onAnswerChange: vi.fn(),
  onSaveDraft: noopAsync,
  onSubmit: noopAsync,
  onRetryPending: noopAsync,
  onReload: noopAsync,
  onDiscardAndReload: noopAsync,
} as const;

describe('assigned performance-review workspace', () => {
  it('renders distinct loading, empty, and opaque denied states', () => {
    const loading = renderToStaticMarkup(
      <PerformanceReviewWorkspaceView {...baseProps} review={undefined} loading />
    );
    expect(loading).toContain('Loading assigned review');
    expect(loading).toContain('aria-busy="true"');

    const empty = renderToStaticMarkup(
      <PerformanceReviewWorkspaceView {...baseProps} review={undefined} empty />
    );
    expect(empty).toContain('Select an assigned review');

    const denied = renderToStaticMarkup(
      <PerformanceReviewWorkspaceView
        {...baseProps}
        review={undefined}
        denied
        loadFailure={{ kind: 'DENIED', message: 'This review is unavailable.' }}
      />
    );
    expect(denied).toContain('absent or outside your current assignment');
    expect(denied).not.toContain(review.participantId);
    expect(denied).not.toContain(review.reviewerAssignmentId);
  });

  it('keeps a partial draft usable with its recovery controls', () => {
    const html = renderToStaticMarkup(
      <PerformanceReviewWorkspaceView
        {...baseProps}
        partial
        dirty
        commandFailure={{
          kind: 'RETRYABLE',
          message: 'The result is not confirmed. Retry the same request.',
        }}
        pendingKind="SAVE_DRAFT"
      />
    );
    expect(html).toContain('Some review data may be stale');
    expect(html).toContain('Review form sections');
    expect(html).toContain('Describe your most important outcome');
    expect(html).toContain('Overall impact');
    expect(html).toContain('Development focus');
    expect(html).toContain('Retry same request');
    expect(html).toContain('Unsaved changes');
  });

  it('installs responsive, zoom-safe, reduced-motion, and forced-color CSS rules', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const mount = document.createElement('div');
    document.body.append(mount);
    const root = createRoot(mount);
    await act(async () => {
      root.render(<PerformanceReviewWorkspaceView {...baseProps} partial />);
    });
    const css = emittedCss();
    expect(css).toContain('@media (min-width:600px)');
    expect(css).toContain('@media (min-width:900px)');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('@media (forced-colors: active)');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(css).toContain('grid-template-columns: minmax(12rem, 0.28fr) minmax(0, 1fr)');
    expect(css).toContain('overflow-wrap: anywhere');
    expect(css).toContain('min-width: 0px');
    await act(async () => root.unmount());
    mount.remove();
  });

  it('keeps long text and decimal prompts visible as wrapping associated labels', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const mount = document.createElement('div');
    document.body.append(mount);
    const root = createRoot(mount);
    const textItem = review.form.items.find((candidate) => candidate.kind === 'TEXT');
    const decimalItem = review.form.items.find((candidate) => candidate.kind === 'DECIMAL');
    const textAnswer = review.answers.find((candidate) => candidate.kind === 'TEXT');
    const decimalAnswer = review.answers.find((candidate) => candidate.kind === 'DECIMAL');
    if (!textItem || !decimalItem || !textAnswer || !decimalAnswer) {
      throw new Error('The review fixture must contain text and decimal answers.');
    }
    const longPrompt =
      '주요 성과와 협업 영향을 구체적인 근거와 함께 설명해 주세요 ACCOUNTABILITY COLLABORATION CUSTOMER IMPACT';
    await act(async () => {
      root.render(
        <>
          <PerformanceReviewAnswerField
            item={{ ...textItem, label: longPrompt }}
            form={review.form}
            answer={textAnswer}
            disabled={false}
            onChange={vi.fn()}
          />
          <PerformanceReviewAnswerField
            item={decimalItem}
            form={review.form}
            answer={decimalAnswer}
            issue={{
              itemKey: decimalItem.itemKey,
              code: 'OUT_OF_RANGE',
              message: 'Enter a value within the allowed range.',
            }}
            disabled={false}
            onChange={vi.fn()}
          />
        </>
      );
    });

    const textInput = mount.querySelector('#performance-review-item-2') as HTMLTextAreaElement;
    const textLabel = mount.querySelector(
      'label[for="performance-review-item-2"]'
    ) as HTMLLabelElement;
    expect(textLabel.textContent).toContain(longPrompt);
    expect([...textInput.labels!]).toContain(textLabel);
    expect(textInput.required).toBe(true);
    expect(textInput.getAttribute('aria-describedby')).toBe(
      'performance-review-item-2-helper-text'
    );
    expect(mount.querySelector('#performance-review-item-2-helper-text')?.textContent).toBe(
      textItem.helpText
    );
    expect(getComputedStyle(textLabel).whiteSpace).toBe('normal');
    expect(getComputedStyle(textLabel).overflowWrap).toBe('anywhere');
    expect(mount.querySelector('.MuiInputLabel-root[for="performance-review-item-2"]')).toBeNull();

    const decimalInput = mount.querySelector('#performance-review-item-3') as HTMLInputElement;
    const decimalLabel = mount.querySelector(
      'label[for="performance-review-item-3"]'
    ) as HTMLLabelElement;
    expect([...decimalInput.labels!]).toContain(decimalLabel);
    expect(decimalInput.getAttribute('aria-invalid')).toBe('true');
    expect(decimalInput.getAttribute('aria-describedby')).toBe(
      'performance-review-item-3-helper-text'
    );
    expect(mount.querySelector('#performance-review-item-3-helper-text')?.textContent).toBe(
      'Enter a value within the allowed range.'
    );
    expect(getComputedStyle(decimalLabel).whiteSpace).toBe('normal');
    expect(getComputedStyle(decimalLabel).overflowWrap).toBe('anywhere');
    expect(mount.querySelector('.MuiInputLabel-root[for="performance-review-item-3"]')).toBeNull();
    await act(async () => root.unmount());
    mount.remove();
  });

  it('blocks final submission until a partial snapshot is reloaded', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const mount = document.createElement('div');
    document.body.append(mount);
    const root = createRoot(mount);
    await act(async () => {
      root.render(<PerformanceReviewWorkspaceView {...baseProps} partial />);
    });
    const acknowledge = mount.querySelector('input[type="checkbox"]') as HTMLInputElement;
    await act(async () => acknowledge.click());
    const submit = [...mount.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Submit review'
    ) as HTMLButtonElement;
    expect(acknowledge.checked).toBe(true);
    expect(submit.disabled).toBe(true);
    await act(async () => root.unmount());
    mount.remove();
  });

  it('makes the form and acknowledgement read-only without a command executor', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const mount = document.createElement('div');
    document.body.append(mount);
    const root = createRoot(mount);
    await act(async () => {
      root.render(<PerformanceReviewWorkspaceView {...baseProps} commandConnected={false} dirty />);
    });
    expect((mount.querySelector('textarea[name="a_text"]') as HTMLTextAreaElement).disabled).toBe(
      true
    );
    expect(
      [...mount.querySelectorAll('input[type="radio"]')].every(
        (input) => (input as HTMLInputElement).disabled
      )
    ).toBe(true);
    expect((mount.querySelector('input[type="checkbox"]') as HTMLInputElement).disabled).toBe(true);
    await act(async () => root.unmount());
    mount.remove();
  });

  it('locks answer and acknowledgement controls while an ambiguous command awaits retry', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const mount = document.createElement('div');
    document.body.append(mount);
    const root = createRoot(mount);
    await act(async () => {
      root.render(
        <PerformanceReviewWorkspaceView
          {...baseProps}
          pendingKind="SAVE_DRAFT"
          commandFailure={{
            kind: 'RETRYABLE',
            message: 'The result is not confirmed. Retry the same request.',
          }}
        />
      );
    });
    expect((mount.querySelector('textarea[name="a_text"]') as HTMLTextAreaElement).disabled).toBe(
      true
    );
    expect((mount.querySelector('input[type="checkbox"]') as HTMLInputElement).disabled).toBe(true);
    const retry = [...mount.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Retry same request'
    ) as HTMLButtonElement;
    expect(retry.disabled).toBe(false);
    expect(mount.querySelector('button[aria-label="Reload latest review"]')).toBeNull();
    await act(async () => {
      root.render(
        <PerformanceReviewWorkspaceView
          {...baseProps}
          pendingKind="SAVE_DRAFT"
          commandBusy
          commandFailure={{
            kind: 'RETRYABLE',
            message: 'The result is not confirmed. Retry the same request.',
          }}
        />
      );
    });
    const busyRetry = mount.querySelector(
      'button[aria-label="Retry same request"]'
    ) as HTMLButtonElement;
    expect(busyRetry.disabled).toBe(true);
    expect(busyRetry.getAttribute('aria-busy')).toBe('true');
    await act(async () => root.unmount());
    mount.remove();
  });

  it('focuses the validation summary after a guarded submit is rejected', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const mount = document.createElement('div');
    document.body.append(mount);
    const root = createRoot(mount);
    const incomplete = review.answers.filter((answer) => answer.itemKey !== 'c_rating');
    const validation = validatePerformanceReviewAnswers(review.form, incomplete, true);
    const onSubmit = vi.fn(async () => false);
    const user = userEvent.setup();
    await act(async () => {
      root.render(
        <PerformanceReviewWorkspaceView
          {...baseProps}
          answers={incomplete}
          validation={validation}
          validationVisible
          onSubmit={onSubmit}
        />
      );
    });
    const acknowledge = mount.querySelector('input[type="checkbox"]') as HTMLInputElement;
    acknowledge.focus();
    await act(async () => user.keyboard('[Space]'));
    const submit = [...mount.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Submit review'
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
    await act(async () => user.tab());
    expect(document.activeElement).toBe(submit);
    await act(async () => {
      await user.keyboard('[Enter]');
      await vi.waitFor(() => expect(document.activeElement?.getAttribute('role')).toBe('alert'));
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(document.activeElement?.getAttribute('role')).toBe('alert');
    expect(document.activeElement?.textContent).toContain('Complete 1 review item');
    const ratingGroup = mount.querySelector('#performance-review-item-4 [role="radiogroup"]')!;
    expect(ratingGroup.getAttribute('aria-labelledby')).toBe('performance-review-item-4-label');
    expect(ratingGroup.getAttribute('aria-describedby')).toBe('performance-review-item-4-error');
    expect(ratingGroup.getAttribute('aria-invalid')).toBe('true');
    expect(ratingGroup.getAttribute('aria-required')).toBe('true');
    const ratingFieldset = mount.querySelector('#performance-review-item-4')!;
    expect(ratingFieldset.tagName).toBe('FIELDSET');
    expect(ratingFieldset.getAttribute('aria-labelledby')).toBeNull();
    expect(ratingFieldset.getAttribute('aria-describedby')).toBeNull();
    expect(ratingFieldset.getAttribute('aria-invalid')).toBeNull();
    expect(ratingFieldset.getAttribute('aria-required')).toBeNull();
    expect(mount.querySelector('#performance-review-item-4-label')?.textContent).toContain(
      'Overall impact'
    );
    expect(mount.querySelector('#performance-review-item-4-error')?.textContent).toBe(
      'Enter a response.'
    );
    await act(async () => user.tab());
    expect(document.activeElement?.tagName).toBe('A');
    await act(async () => user.keyboard('[Enter]'));
    expect(document.activeElement).toBe(
      mount.querySelector('input#performance-review-item-4-option-0')
    );
    await act(async () => root.unmount());
    mount.remove();
  });

  it('confirms before discarding dirty answers and preserves them when cancelled', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const mount = document.createElement('div');
    document.body.append(mount);
    const root = createRoot(mount);
    const onReload = vi.fn(async () => true);
    const onDiscardAndReload = vi.fn(async () => true);
    const user = userEvent.setup();
    await act(async () => {
      root.render(
        <PerformanceReviewWorkspaceView
          {...baseProps}
          dirty
          onReload={onReload}
          onDiscardAndReload={onDiscardAndReload}
        />
      );
    });

    await user.click(mount.querySelector('button[aria-label="Reload latest review"]')!);
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      'Discard unsaved changes?'
    );
    expect(onReload).not.toHaveBeenCalled();
    const keepEditing = [...document.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Keep editing'
    )!;
    await user.click(keepEditing);
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
    expect((mount.querySelector('textarea[name="a_text"]') as HTMLTextAreaElement).value).toBe(
      'Delivered the governed review workflow.'
    );
    expect(onDiscardAndReload).not.toHaveBeenCalled();

    await user.click(mount.querySelector('button[aria-label="Reload latest review"]')!);
    const discard = [...document.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Discard changes and reload'
    )!;
    await user.click(discard);
    await vi.waitFor(() => expect(onDiscardAndReload).toHaveBeenCalledTimes(1));
    expect(onReload).not.toHaveBeenCalled();
    await act(async () => root.unmount());
    mount.remove();
  });

  it('removes a cleared required text answer so a partial draft can still be saved', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const mount = document.createElement('div');
    document.body.append(mount);
    const root = createRoot(mount);
    const item = review.form.items.find((candidate) => candidate.itemKey === 'a_text')!;
    const answer = review.answers.find((candidate) => candidate.itemKey === 'a_text');
    const onChange = vi.fn();
    await act(async () => {
      root.render(
        <PerformanceReviewAnswerField
          item={item}
          form={review.form}
          answer={answer}
          disabled={false}
          onChange={onChange}
        />
      );
    });
    const field = mount.querySelector('textarea[name="a_text"]') as HTMLTextAreaElement;
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    await act(async () => {
      setValue?.call(field, '');
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith(null);
    await act(async () => root.unmount());
    mount.remove();
  });

  it('lets optional rating and choice answers be cleared accessibly', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const mount = document.createElement('div');
    document.body.append(mount);
    const root = createRoot(mount);
    const ratingItem = review.form.items.find((candidate) => candidate.kind === 'RATING');
    const choiceItem = review.form.items.find((candidate) => candidate.kind === 'CHOICE');
    const ratingAnswer = review.answers.find((candidate) => candidate.kind === 'RATING');
    const choiceAnswer = review.answers.find((candidate) => candidate.kind === 'CHOICE');
    if (!ratingItem || !choiceItem || !ratingAnswer || !choiceAnswer) {
      throw new Error('The review fixture must contain rating and choice answers.');
    }
    const onRatingChange = vi.fn();
    const onChoiceChange = vi.fn();
    await act(async () => {
      root.render(
        <>
          <PerformanceReviewAnswerField
            item={{ ...ratingItem, required: false, helpText: 'Choose an optional rating.' }}
            form={review.form}
            answer={ratingAnswer}
            disabled={false}
            onChange={onRatingChange}
          />
          <PerformanceReviewAnswerField
            item={{ ...choiceItem, required: false }}
            form={review.form}
            answer={choiceAnswer}
            disabled={false}
            onChange={onChoiceChange}
          />
        </>
      );
    });
    const clearButtons = [...mount.querySelectorAll('button')].filter(
      (button) => button.textContent?.trim() === 'Clear response'
    );
    expect(clearButtons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Clear response for Overall impact',
      'Clear response for Development focus',
    ]);
    const ratingGroup = mount.querySelector('#performance-review-item-4 [role="radiogroup"]')!;
    expect(ratingGroup.getAttribute('aria-labelledby')).toBe('performance-review-item-4-label');
    expect(ratingGroup.getAttribute('aria-describedby')).toBe('performance-review-item-4-help');
    expect(ratingGroup.getAttribute('aria-required')).toBe('false');
    expect(mount.querySelector('#performance-review-item-4-help')?.textContent).toBe(
      'Choose an optional rating.'
    );
    const fieldsets = [...mount.querySelectorAll('fieldset')];
    expect(fieldsets).toHaveLength(2);
    for (const fieldset of fieldsets) {
      expect(fieldset.getAttribute('aria-required')).toBeNull();
    }
    await act(async () => {
      clearButtons.forEach((button) => button.click());
    });
    expect(onRatingChange).toHaveBeenCalledWith(null);
    expect(onChoiceChange).toHaveBeenCalledWith(null);
    await act(async () => root.unmount());
    mount.remove();
  });
});
