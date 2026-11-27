import { sastInputTime } from '../utils/quotes';

const field = 'mt-1 w-full rounded-lg border border-home-control bg-home-canvas p-3 text-white';
const pad = (n: number) => String(n).padStart(2, '0');

export default function AppointmentFields({ prefix, minDate, defaultValue }: { prefix: string; minDate: string; defaultValue?: string }) {
  const initial = defaultValue && new Date(defaultValue).getTime() > Date.now() ? sastInputTime(defaultValue) : '';
  return <fieldset className="appointment-fields">
    <legend>Appointment <span className="text-emerald-300/75">· South African time</span></legend>
    <div className="appointment-fields__grid">
      <label>Date<input className={field} type="date" name={`${prefix}Date`} min={minDate} defaultValue={initial.slice(0, 10)} required /></label>
      <div><span className="appointment-fields__label">Time · 24 hour</span><div className="appointment-fields__time">
        <label><span className="sr-only">Hour</span><select className={field} name={`${prefix}Hour`} defaultValue={initial ? initial.slice(11, 13) : ''} required aria-label="Appointment hour"><option value="" disabled>Hour</option>{Array.from({ length: 24 }, (_, i) => <option key={i} value={pad(i)}>{pad(i)}</option>)}</select></label>
        <span aria-hidden="true">:</span>
        <label><span className="sr-only">Minute</span><select className={field} name={`${prefix}Minute`} defaultValue={initial ? initial.slice(14, 16) : ''} required aria-label="Appointment minute"><option value="" disabled>Min</option>{Array.from({ length: 60 }, (_, i) => <option key={i} value={pad(i)}>{pad(i)}</option>)}</select></label>
      </div></div>
    </div>
  </fieldset>;
}

export function appointmentValue(data: FormData, prefix: string) {
  return `${String(data.get(`${prefix}Date`) ?? '')}T${String(data.get(`${prefix}Hour`) ?? '')}:${String(data.get(`${prefix}Minute`) ?? '')}`;
}
