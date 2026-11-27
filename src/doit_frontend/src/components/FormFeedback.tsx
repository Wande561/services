import { useState, type FormEvent, type ReactNode } from 'react';

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
export default function FormFeedback({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  function invalid(event: FormEvent<HTMLDivElement>) {
    event.preventDefault();
    const control = event.target as Control;
    control.classList.add('field-invalid');
    const first = control.form?.querySelector<Control>(':invalid');
    if (first === control) {
      const label = control.getAttribute('aria-label') || control.labels?.[0]?.textContent?.trim().split('\n')[0] || 'this field';
      setMessage(control.validity.valueMissing ? `Please complete ${label.toLowerCase()}.` : control.validity.rangeUnderflow ? `Please choose a later value for ${label.toLowerCase()}.` : `Please check ${label.toLowerCase()} and try again.`);
      control.focus();
    }
  }
  function changed(event: FormEvent<HTMLDivElement>) {
    const control = event.target as Control;
    if (control.validity?.valid) { control.classList.remove('field-invalid'); setMessage(''); }
  }
  return <div onInvalidCapture={invalid} onInputCapture={changed} onChangeCapture={changed}>{children}{message && <div className="form-feedback" role="alert"><span aria-hidden="true">!</span><p>{message}</p><button type="button" aria-label="Dismiss message" onClick={() => setMessage('')}>×</button></div>}</div>;
}
