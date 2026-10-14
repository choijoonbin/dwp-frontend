import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import type {
  PerformanceReviewAnswer,
  PerformanceReviewForm,
  PerformanceReviewFormItem,
  PerformanceReviewValidationIssue,
} from '../model/performance-review-types';

export type PerformanceReviewAnswerFieldProps = Readonly<{
  item: PerformanceReviewFormItem;
  form: PerformanceReviewForm;
  answer: PerformanceReviewAnswer | undefined;
  issue?: PerformanceReviewValidationIssue;
  disabled: boolean;
  onChange: (answer: PerformanceReviewAnswer | null) => void;
}>;

function helperText(
  item: PerformanceReviewFormItem,
  issue: PerformanceReviewValidationIssue | undefined
): string | undefined {
  return issue?.message ?? item.helpText ?? undefined;
}

export function PerformanceReviewAnswerField({
  item,
  form,
  answer,
  issue,
  disabled,
  onChange,
}: PerformanceReviewAnswerFieldProps) {
  const controlId = 'performance-review-item-' + String(item.sequence);
  const label = item.label + (item.required ? ' (required)' : '');

  if (item.kind === 'TEXT' && item.answerConstraints.kind === 'TEXT') {
    const value = answer?.kind === 'TEXT' ? answer.textValue : '';
    return (
      <Box sx={{ minWidth: 0 }}>
        <FormLabel
          htmlFor={controlId}
          required={item.required}
          disabled={disabled}
          error={Boolean(issue)}
          sx={{ display: 'block', mb: 0.75, whiteSpace: 'normal', overflowWrap: 'anywhere' }}
        >
          {label}
        </FormLabel>
        <TextField
          id={controlId}
          name={item.itemKey}
          fullWidth
          required={item.required}
          disabled={disabled}
          error={Boolean(issue)}
          value={value}
          multiline={item.answerConstraints.multiline}
          minRows={item.answerConstraints.multiline ? 4 : undefined}
          inputProps={{ maxLength: item.answerConstraints.maxLength }}
          helperText={helperText(item, issue)}
          onChange={(event) =>
            onChange(
              event.target.value === ''
                ? null
                : { itemKey: item.itemKey, kind: 'TEXT', textValue: event.target.value }
            )
          }
        />
      </Box>
    );
  }

  if (item.kind === 'DECIMAL' && item.answerConstraints.kind === 'DECIMAL') {
    const value = answer?.kind === 'DECIMAL' ? answer.decimalValue : '';
    const range = [
      item.answerConstraints.minimum === null ? null : 'Minimum ' + item.answerConstraints.minimum,
      item.answerConstraints.maximum === null ? null : 'Maximum ' + item.answerConstraints.maximum,
    ]
      .filter(Boolean)
      .join(' · ');
    return (
      <Box sx={{ minWidth: 0 }}>
        <FormLabel
          htmlFor={controlId}
          required={item.required}
          disabled={disabled}
          error={Boolean(issue)}
          sx={{ display: 'block', mb: 0.75, whiteSpace: 'normal', overflowWrap: 'anywhere' }}
        >
          {label}
        </FormLabel>
        <TextField
          id={controlId}
          name={item.itemKey}
          fullWidth
          required={item.required}
          disabled={disabled}
          error={Boolean(issue)}
          value={value}
          inputProps={{ inputMode: 'decimal' }}
          helperText={helperText(item, issue) ?? range}
          onChange={(event) =>
            onChange(
              event.target.value === ''
                ? null
                : { itemKey: item.itemKey, kind: 'DECIMAL', decimalValue: event.target.value }
            )
          }
        />
      </Box>
    );
  }

  if (item.kind === 'RATING' && item.answerConstraints.kind === 'RATING') {
    const scaleKey = item.answerConstraints.scaleKey;
    const scale = form.rubricScales.find((candidate) => candidate.scaleKey === scaleKey);
    const value = answer?.kind === 'RATING' ? answer.ratingValue : '';
    const labelId = controlId + '-label';
    const helpId = controlId + '-help';
    const errorId = controlId + '-error';
    const describedBy = [item.helpText ? helpId : null, issue ? errorId : null]
      .filter(Boolean)
      .join(' ');
    return (
      <FormControl
        id={controlId}
        component="fieldset"
        required={item.required}
        disabled={disabled}
        error={Boolean(issue)}
        fullWidth
      >
        <FormLabel id={labelId} component="legend">
          {label}
        </FormLabel>
        {item.helpText && (
          <Typography id={helpId} variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {item.helpText}
          </Typography>
        )}
        <RadioGroup
          name={item.itemKey}
          value={value}
          aria-labelledby={labelId}
          aria-describedby={describedBy || undefined}
          aria-invalid={issue ? 'true' : undefined}
          aria-required={item.required}
          onChange={(event) =>
            onChange({ itemKey: item.itemKey, kind: 'RATING', ratingValue: event.target.value })
          }
          sx={{ mt: 0.5 }}
        >
          {scale?.levels.map((level, index) => (
            <FormControlLabel
              key={level.levelKey}
              value={level.numericValue}
              control={<Radio inputProps={{ id: controlId + '-option-' + String(index) }} />}
              label={level.label}
            />
          ))}
        </RadioGroup>
        {!item.required && (
          <Button
            type="button"
            size="small"
            disabled={disabled || value === ''}
            aria-label={'Clear response for ' + item.label}
            onClick={() => onChange(null)}
            sx={{ alignSelf: 'flex-start', mt: 0.5 }}
          >
            Clear response
          </Button>
        )}
        {issue && <FormHelperText id={errorId}>{issue.message}</FormHelperText>}
      </FormControl>
    );
  }

  if (item.kind === 'CHOICE' && item.answerConstraints.kind === 'CHOICE') {
    const value = answer?.kind === 'CHOICE' ? answer.optionKey : '';
    const labelId = controlId + '-label';
    const helpId = controlId + '-help';
    const errorId = controlId + '-error';
    const describedBy = [item.helpText ? helpId : null, issue ? errorId : null]
      .filter(Boolean)
      .join(' ');
    return (
      <FormControl
        id={controlId}
        component="fieldset"
        required={item.required}
        disabled={disabled}
        error={Boolean(issue)}
        fullWidth
      >
        <FormLabel id={labelId} component="legend">
          {label}
        </FormLabel>
        {item.helpText && (
          <Typography id={helpId} variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {item.helpText}
          </Typography>
        )}
        <RadioGroup
          name={item.itemKey}
          value={value}
          aria-labelledby={labelId}
          aria-describedby={describedBy || undefined}
          aria-invalid={issue ? 'true' : undefined}
          aria-required={item.required}
          onChange={(event) =>
            onChange({ itemKey: item.itemKey, kind: 'CHOICE', optionKey: event.target.value })
          }
          sx={{ mt: 0.5 }}
        >
          {item.answerConstraints.options.map((option, index) => (
            <FormControlLabel
              key={option.optionKey}
              value={option.optionKey}
              control={<Radio inputProps={{ id: controlId + '-option-' + String(index) }} />}
              label={option.label}
            />
          ))}
        </RadioGroup>
        {!item.required && (
          <Button
            type="button"
            size="small"
            disabled={disabled || value === ''}
            aria-label={'Clear response for ' + item.label}
            onClick={() => onChange(null)}
            sx={{ alignSelf: 'flex-start', mt: 0.5 }}
          >
            Clear response
          </Button>
        )}
        {issue && <FormHelperText id={errorId}>{issue.message}</FormHelperText>}
      </FormControl>
    );
  }

  return (
    <Box role="alert" id={controlId}>
      <Typography color="error">This review item cannot be displayed safely.</Typography>
    </Box>
  );
}
