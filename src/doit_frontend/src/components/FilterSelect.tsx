import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, SlidersHorizontal } from 'lucide-react';

interface Option { value: string; label: string }
export default function FilterSelect({ label, name, options, defaultValue }: { label: string; name: string; options: Option[]; defaultValue: string }) {
  const [value, setValue] = useState(options.some(option => option.value === defaultValue) ? defaultValue : options[0].value);
  const [open, setOpen] = useState(false); const [active, setActive] = useState(0);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 260, above: false });
  const trigger = useRef<HTMLButtonElement>(null); const popup = useRef<HTMLDivElement>(null); const list = useRef<HTMLDivElement>(null); const id = useId();
  const selected = options.find(option => option.value === value) ?? options[0];
  function place() { const rect = trigger.current?.getBoundingClientRect(); if (!rect) return; const width = Math.min(Math.max(rect.width, 240), window.innerWidth - 24); const height = Math.min(options.length * 43 + 55, 330); const above = window.innerHeight - rect.bottom < height && rect.top > window.innerHeight - rect.bottom; setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top: above ? rect.top - 8 : rect.bottom + 8, width, above }); }
  function show() { place(); setActive(Math.max(0, options.findIndex(option => option.value === value))); setOpen(true); }
  function choose(index: number) { setValue(options[index].value); setOpen(false); trigger.current?.focus(); }
  useEffect(() => { if (!open) return; const outside = (event: PointerEvent) => { const target = event.target as Node; if (!trigger.current?.contains(target) && !popup.current?.contains(target)) setOpen(false); }; document.addEventListener('pointerdown', outside); window.addEventListener('resize', place); window.addEventListener('scroll', place, true); return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); }; }, [open]);
  useEffect(() => { if (!open || !list.current) return; const item = list.current.querySelector<HTMLElement>('[data-active="true"]'); if (!item) return; if (item.offsetTop < list.current.scrollTop) list.current.scrollTop = item.offsetTop; else if (item.offsetTop + item.offsetHeight > list.current.scrollTop + list.current.clientHeight) list.current.scrollTop = item.offsetTop + item.offsetHeight - list.current.clientHeight; }, [active, open]);
  function keydown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) { event.preventDefault(); show(); return; }
    if (!open) return;
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); return; }
    if (event.key === 'Tab') { setOpen(false); return; }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(active); return; }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); setActive(index => event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))); }
  }
  return <div className="filter-select"><span className="filter-select__label" id={`${id}-label`}>{label}</span><input type="hidden" name={name} value={value} /><button ref={trigger} type="button" className="filter-select__trigger" role="combobox" aria-labelledby={`${id}-label ${id}-value`} aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open ? `${id}-${active}` : undefined} aria-haspopup="listbox" onClick={() => open ? setOpen(false) : show()} onKeyDown={keydown}><span id={`${id}-value`}>{selected.label}</span><ChevronDown size={16} aria-hidden="true" /></button>
    {open && createPortal(<div ref={popup} className={`filter-select__popover ${position.above ? 'is-above' : ''}`} style={{ left: position.left, top: position.top, width: position.width }}><div className="filter-select__head"><SlidersHorizontal size={14} aria-hidden="true" /> CHOOSE {label.toUpperCase()}</div><div ref={list} id={`${id}-list`} className="filter-select__options" role="listbox" aria-label={label}>{options.map((option, index) => <button key={option.value} id={`${id}-${index}`} type="button" role="option" aria-selected={option.value === value} tabIndex={-1} data-active={index === active} onMouseEnter={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}><span>{option.label}</span>{option.value === value && <Check size={15} aria-hidden="true" />}</button>)}</div></div>, document.body)}
  </div>;
}
