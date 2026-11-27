import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { sastInputTime } from '../utils/quotes';

const dateValue = (date: Date) => date.toISOString().slice(0, 10);
const parseDate = (value: string) => new Date(`${value}T00:00:00Z`);
const monthLabel = new Intl.DateTimeFormat('en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const fullLabel = new Intl.DateTimeFormat('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortLabel = new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export default function DatePicker({ name, minDate, initial }: { name: string; minDate: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [active, setActive] = useState(initial && initial >= minDate ? initial : minDate);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 300, above: false });
  const trigger = useRef<HTMLButtonElement>(null); const control = useRef<HTMLInputElement>(null); const popup = useRef<HTMLDivElement>(null); const id = useId();
  const current = parseDate(active); const year = current.getUTCFullYear(); const month = current.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1)); const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const previousDisabled = dateValue(new Date(Date.UTC(year, month, 0))) < minDate;
  const today = sastInputTime(new Date()).slice(0, 10);
  function place() {
    const rect = trigger.current?.getBoundingClientRect(); if (!rect) return;
    const width = Math.min(Math.max(rect.width, 300), window.innerWidth - 24);
    const above = window.innerHeight - rect.bottom < 370 && rect.top > window.innerHeight - rect.bottom;
    setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top: above ? rect.top - 8 : rect.bottom + 8, width, above });
  }
  function show() { place(); setActive(value && value >= minDate ? value : minDate); setOpen(true); }
  function choose(date: string) { setValue(date); setOpen(false); control.current?.classList.remove('field-invalid'); requestAnimationFrame(() => { control.current?.dispatchEvent(new Event('input', { bubbles: true })); trigger.current?.focus(); }); }
  function moveDays(delta: number) { const date = parseDate(active); date.setUTCDate(date.getUTCDate() + delta); const next = dateValue(date); if (next >= minDate) setActive(next); }
  function moveMonth(delta: number) { const lastDay = new Date(Date.UTC(year, month + delta + 1, 0)).getUTCDate(); const next = dateValue(new Date(Date.UTC(year, month + delta, Math.min(current.getUTCDate(), lastDay)))); setActive(next < minDate ? minDate : next); }
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { const target = event.target as Node; if (!trigger.current?.contains(target) && !popup.current?.contains(target)) setOpen(false); };
    document.addEventListener('pointerdown', outside); window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open]);
  function keydown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) { event.preventDefault(); show(); return; }
    if (!open) return;
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); return; }
    if (event.key === 'Tab') { setOpen(false); return; }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(active); return; }
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (event.key in offsets) { event.preventDefault(); moveDays(offsets[event.key]); }
    if (event.key === 'PageUp' || event.key === 'PageDown') { event.preventDefault(); moveMonth(event.key === 'PageUp' ? -1 : 1); }
    if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); moveDays(event.key === 'Home' ? -current.getUTCDay() : 6 - current.getUTCDay()); }
  }
  return <div className="date-picker"><span className="date-picker__label">Date</span>
    <input ref={control} className="date-picker__native" type="date" name={name} min={minDate} value={value} onChange={event => setValue(event.target.value)} onFocus={() => trigger.current?.focus()} required aria-label="Appointment date" aria-hidden="true" tabIndex={-1} />
    <button ref={trigger} type="button" className="date-picker__trigger" role="combobox" aria-label={`Appointment date${value ? `: ${fullLabel.format(parseDate(value))}` : ''}`} aria-required="true" aria-expanded={open} aria-controls={`${id}-grid`} aria-activedescendant={open ? `${id}-${active}` : undefined} aria-haspopup="listbox" aria-describedby={`${id}-help`} onClick={() => open ? setOpen(false) : show()} onKeyDown={keydown}><span>{value ? shortLabel.format(parseDate(value)) : 'Choose a date'}</span><CalendarDays size={18} aria-hidden="true" /></button>
    <span id={`${id}-help`} className="sr-only">Use arrow keys to move between dates, Page Up and Page Down to change month, and Enter to select.</span>
    {open && createPortal(<div ref={popup} className={`date-picker__popover ${position.above ? 'is-above' : ''}`} style={{ left: position.left, top: position.top, width: position.width }}><div className="date-picker__heading"><div><span>CHOOSE A DATE</span><strong>{monthLabel.format(first)}</strong></div><div className="date-picker__nav"><button type="button" tabIndex={-1} aria-label="Previous month" disabled={previousDisabled} onMouseDown={event => event.preventDefault()} onClick={() => moveMonth(-1)}><ChevronLeft size={17} /></button><button type="button" tabIndex={-1} aria-label="Next month" onMouseDown={event => event.preventDefault()} onClick={() => moveMonth(1)}><ChevronRight size={17} /></button></div></div><div className="date-picker__weekdays" aria-hidden="true">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <span key={index}>{day}</span>)}</div><div id={`${id}-grid`} role="listbox" aria-label={monthLabel.format(first)} className="date-picker__grid">{Array.from({ length: first.getUTCDay() }, (_, i) => <span key={`blank-${i}`} aria-hidden="true" />)}{Array.from({ length: days }, (_, i) => { const date = dateValue(new Date(Date.UTC(year, month, i + 1))); return <button key={date} id={`${id}-${date}`} type="button" role="option" aria-label={fullLabel.format(parseDate(date))} aria-selected={value === date} disabled={date < minDate} tabIndex={-1} data-active={active === date} data-today={today === date} onMouseEnter={() => { if (date >= minDate) setActive(date); }} onMouseDown={event => event.preventDefault()} onClick={() => choose(date)}>{i + 1}</button>; })}</div><p className="date-picker__foot">South African time · Select an available day</p></div>, document.body)}
  </div>;
}
