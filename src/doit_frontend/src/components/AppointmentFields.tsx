import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Clock3 } from 'lucide-react';
import { sastInputTime } from '../utils/quotes';
import DatePicker from './DatePicker';

const pad = (n: number) => String(n).padStart(2, '0');

function TimePicker({ name, label, count, initial }: { name: string; label: string; count: number; initial: string }) {
  const options = Array.from({ length: count === 60 ? 12 : count }, (_, i) => count === 60 ? i * 5 : i);
  const [value, setValue] = useState(initial);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(initial ? Math.max(0, options.indexOf(Number(initial))) : 0);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 260, above: false });
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const control = useRef<HTMLSelectElement>(null);
  const id = useId();
  const columns = count === 24 ? 4 : 6;
  function place() {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(Math.max(rect.width, count === 24 ? 240 : 280), window.innerWidth - 24);
    const above = window.innerHeight - rect.bottom < 300 && rect.top > window.innerHeight - rect.bottom;
    setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top: above ? rect.top - 8 : rect.bottom + 8, width, above });
  }
  function show() { place(); setActive(value ? Math.max(0, options.indexOf(Number(value))) : 0); setOpen(true); }
  function choose(index: number) {
    setValue(pad(options[index])); setOpen(false); control.current?.classList.remove('field-invalid');
    requestAnimationFrame(() => { control.current?.dispatchEvent(new Event('input', { bubbles: true })); trigger.current?.focus(); });
  }
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { const target = event.target as Node; if (!trigger.current?.contains(target) && !list.current?.contains(target)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open]);
  useEffect(() => { if (open) list.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }); }, [active, open]);
  function keydown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) { event.preventDefault(); show(); return; }
    if (!open) return;
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); return; }
    if (event.key === 'Tab') { setOpen(false); return; }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(active); return; }
    const offsets: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns };
    if (event.key === 'Home' || event.key === 'End' || event.key in offsets) { event.preventDefault(); setActive(previous => event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : Math.max(0, Math.min(options.length - 1, previous + offsets[event.key]))); }
  }
  return <div className="time-picker">
    <select ref={control} className="time-picker__native" name={name} value={value} onChange={event => setValue(event.target.value)} onFocus={() => trigger.current?.focus()} required aria-label={`Appointment ${label.toLowerCase()}`} aria-hidden="true" tabIndex={-1}><option value="" />{initial && !options.includes(Number(initial)) && <option value={initial}>{initial}</option>}{options.map(option => <option key={option} value={pad(option)}>{pad(option)}</option>)}</select>
    <button ref={trigger} type="button" className="time-picker__trigger" role="combobox" aria-required="true" aria-label={`Appointment ${label.toLowerCase()}${value ? `: ${value}` : ''}`} aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open ? `${id}-${active}` : undefined} aria-haspopup="listbox" onClick={() => open ? setOpen(false) : show()} onKeyDown={keydown}><span>{value || label}</span><ChevronDown size={16} aria-hidden="true" /></button>
    {open && createPortal(<div ref={list} className={`time-picker__popover ${position.above ? 'is-above' : ''}`} style={{ left: position.left, top: position.top, width: position.width }}><div className="time-picker__head"><span><Clock3 size={15} aria-hidden="true" /> SELECT {label.toUpperCase()}</span><small>24 HOUR</small></div><div id={`${id}-list`} role="listbox" aria-label={`Choose ${label.toLowerCase()}`} className={`time-picker__grid ${count === 24 ? 'is-hours' : 'is-minutes'}`}>{options.map((option, i) => <button key={option} id={`${id}-${i}`} type="button" role="option" aria-selected={value === pad(option)} tabIndex={-1} data-active={active === i} onMouseEnter={() => setActive(i)} onClick={() => choose(i)}>{pad(option)}{value === pad(option) && <Check size={11} aria-hidden="true" />}</button>)}</div></div>, document.body)}
  </div>;
}
export default function AppointmentFields({ prefix, minDate, defaultValue }: { prefix: string; minDate: string; defaultValue?: string }) {
  const initial = defaultValue && new Date(defaultValue).getTime() > Date.now() ? sastInputTime(defaultValue) : '';
  return <fieldset className="appointment-fields">
    <legend>Appointment <span className="text-emerald-300/75">· South African time</span></legend>
    <div className="appointment-fields__grid">
      <DatePicker name={`${prefix}Date`} minDate={minDate} initial={initial.slice(0, 10)} />
      <div><span className="appointment-fields__label">Time · 24 hour</span><div className="appointment-fields__time">
        <TimePicker name={`${prefix}Hour`} label="Hour" count={24} initial={initial ? initial.slice(11, 13) : ''} />
        <span aria-hidden="true">:</span>
        <TimePicker name={`${prefix}Minute`} label="Minute" count={60} initial={initial ? initial.slice(14, 16) : ''} />
      </div></div>
    </div>
  </fieldset>;
}

export function appointmentValue(data: FormData, prefix: string) {
  return `${String(data.get(`${prefix}Date`) ?? '')}T${String(data.get(`${prefix}Hour`) ?? '')}:${String(data.get(`${prefix}Minute`) ?? '')}`;
}
