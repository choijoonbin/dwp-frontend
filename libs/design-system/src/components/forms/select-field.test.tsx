import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SelectField } from './select-field';

describe('SelectField accessibility contract', () => {
  it('forwards an accessible name to the interactive combobox instead of the form-control root', () => {
    const markup = renderToStaticMarkup(
      <SelectField
        aria-label="Time zone"
        value="Asia/Seoul"
        options={[{ value: 'Asia/Seoul', label: 'Seoul' }]}
        onValueChange={() => undefined}
      />
    );

    expect(markup).toMatch(/role="combobox"[^>]*aria-label="Time zone"/u);
    expect(markup).not.toMatch(/MuiFormControl-root[^>]*aria-label=/u);
  });
});
