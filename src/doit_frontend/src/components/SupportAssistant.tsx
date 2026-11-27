import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Bot, LifeBuoy, LoaderCircle, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AppContext';
import { ApiRequestError, apiRequest } from '../utils/apiRequest';
import type { AccountRole } from '../types';

const MAX_MESSAGE_LENGTH = 2000;
const supportWelcome = "Hello! I'm your Service Connect Support Assistant. I can help you understand how the platform works, navigate bookings, manage your account and find answers to common questions.";
const providerWelcome = "Hello! I'm your Provider Assistant. I can summarise your workload and help prepare client or quote drafts for you to review.";
const supportQuestions: Record<AccountRole, string[]> = {
  client: ['How do I verify my account?', 'How do booking requests work?', 'How do I request a quote?', 'How do I update my profile?', 'How do I cancel a booking?', 'How do I contact support?'],
  provider: ['How do I verify my account?', 'How do I respond to a quote request?', 'How do I manage my bookings?', 'How do I update my profile?', 'How do I cancel a booking?', 'How do I contact support?'],
};
const providerQuestions = ['Give me my daily business summary.', 'What requires my attention today?', "What's coming up this week?", 'Show my new booking requests.', 'Which quotes are expiring soon?', 'Help me prepare a quote response.', 'Draft a professional reply to a client.', 'Summarise my notifications.'];
type AssistantMode = 'support' | 'provider';
type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string; time: string; createdAt: string; draftKind?: 'message' | 'quote' };
type ChatState = { messages: ChatMessage[]; draft: string; conversationId?: string; isSending: boolean; error: string; sessionExpired: boolean };
type SupportReply = { conversationId: string; answer: string };
const emptyChat = (): ChatState => ({ messages: [], draft: '', isSending: false, error: '', sessionExpired: false });

function message(text: string, role: ChatMessage['role'], draftKind?: ChatMessage['draftKind']): ChatMessage {
  const createdAt = new Date().toISOString();
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, role, text, time: new Date(createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), createdAt, ...(draftKind ? { draftKind } : {}) };
}

export default function SupportAssistant({ role, visible }: { role: AccountRole; visible: boolean }) {
  const { currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AssistantMode>(role === 'provider' ? 'provider' : 'support');
  const [copiedDraft, setCopiedDraft] = useState('');
  const [chats, setChats] = useState<Record<AssistantMode, ChatState>>({ support: emptyChat(), provider: emptyChat() });
  const chatsRef = useRef(chats);
  const sendingRef = useRef<Record<AssistantMode, boolean>>({ support: false, provider: false });
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const activeChat = chats[mode];

  useEffect(() => { chatsRef.current = chats; }, [chats]);
  useEffect(() => {
    const fresh = { support: emptyChat(), provider: emptyChat() };
    chatsRef.current = fresh;
    sendingRef.current = { support: false, provider: false };
    setChats(fresh);
    setMode(role === 'provider' ? 'provider' : 'support');
  }, [currentUser?.id, role]);
  useEffect(() => { if (!visible) setOpen(false); }, [visible]);
  useEffect(() => {
    if (!open) return;
    composerRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open, mode]);
  useEffect(() => {
    if (open && feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [open, mode, activeChat.messages, activeChat.isSending]);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  function updateChat(target: AssistantMode, update: (previous: ChatState) => ChatState) {
    setChats(previous => {
      const next = { ...previous, [target]: update(previous[target]) };
      chatsRef.current = next;
      return next;
    });
  }

  function startNewConversation() {
    if (sendingRef.current[mode]) return;
    updateChat(mode, () => emptyChat());
    composerRef.current?.focus();
  }

  async function sendMessage(text: string, target = mode) {
    const trimmed = text.trim();
    if (!trimmed || sendingRef.current[target] || !currentUser || (target === 'provider' && role !== 'provider')) return;
    sendingRef.current[target] = true;
    const quoteDraft = target === 'provider' && /\b(draft|prepare|write|suggest)\b/i.test(trimmed) && /\b(?:quote|quotation)\b/i.test(trimmed);
    const messageDraft = target === 'provider' && (/\b(draft|write|reply|respond|response|explain)\b|\bmessage\s+(?:the|a|my)\s+client\b|\bask\s+the\s+client\b|\brequest\s+(?:more\s+)?information\b/i.test(trimmed)) && !quoteDraft;
    const draftKind = quoteDraft ? 'quote' : messageDraft ? 'message' : undefined;
    updateChat(target, previous => ({ ...previous, isSending: true, error: '', sessionExpired: false, draft: '', messages: [...previous.messages, message(trimmed, 'user')] }));
    try {
      const result = await apiRequest<SupportReply>(target === 'provider' ? '/ai/provider' : '/ai/support/chat', {
        method: 'POST',
        data: { message: trimmed, ...(chatsRef.current[target].conversationId ? { conversationId: chatsRef.current[target].conversationId } : {}) },
      });
      updateChat(target, previous => ({ ...previous, conversationId: result.conversationId, messages: [...previous.messages, message(result.answer, 'assistant', draftKind)] }));
    } catch (cause) {
      const error = cause instanceof ApiRequestError && cause.status === 401
        ? 'Your sign-in session has expired. Sign in again to continue.'
        : cause instanceof ApiRequestError && cause.status === 403
          ? target === 'provider' ? 'The Provider Assistant is only available in provider mode.' : 'AI Support is not available for this account mode.'
          : cause instanceof ApiRequestError && cause.status === 429
            ? 'You have reached the assistant message limit. Please wait a little and try again.'
            : 'We could not send your message. Your chat is still here; please try again.';
      updateChat(target, previous => ({ ...previous, error, sessionExpired: cause instanceof ApiRequestError && cause.status === 401 }));
    } finally {
      sendingRef.current[target] = false;
      updateChat(target, previous => ({ ...previous, isSending: false }));
      if (open && mode === target) composerRef.current?.focus();
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void sendMessage(activeChat.draft); }
  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(activeChat.draft); }
  }
  function keepFocusInDialog(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Tab' || !panelRef.current) return;
    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], textarea:not(:disabled)'));
    if (!focusable.length) return;
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  async function copyDraft(item: ChatMessage) {
    try { await navigator.clipboard.writeText(item.text); setCopiedDraft(item.id); }
    catch { setCopiedDraft(''); }
  }

  const title = mode === 'provider' ? 'Provider Assistant' : 'Service Connect AI Support';
  const description = mode === 'provider' ? 'Your workload, organised around your records.' : 'Here to help you navigate Service Connect.';
  const activeSuggestions = mode === 'provider' ? providerQuestions : supportQuestions[role];
  const activeWelcome = mode === 'provider' ? providerWelcome : supportWelcome;
  const endpointTitle = mode === 'provider' ? 'Provider Assistant' : 'AI Support';

  return <>
    {visible && <button ref={triggerRef} type="button" className="support-assistant-trigger" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} aria-controls="service-connect-ai-assistant">
      <Sparkles size={18} aria-hidden="true" /><span>{role === 'provider' ? 'Provider Assistant' : 'AI Support'}</span>
    </button>}
    {open && <div className="support-assistant-overlay">
      <button type="button" className="support-assistant-backdrop" aria-label="Close assistant" onClick={() => { setOpen(false); triggerRef.current?.focus(); }} />
      <section ref={panelRef} id="service-connect-ai-assistant" className="support-assistant-panel" role="dialog" aria-modal="true" aria-labelledby="support-assistant-title" aria-describedby="support-assistant-description" onKeyDown={keepFocusInDialog}>
        <header className="support-assistant-header">
          <span className="support-assistant-avatar"><Bot size={21} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1"><h2 id="support-assistant-title">{title}</h2><p id="support-assistant-description">{description}</p></div>
          <button type="button" className="support-assistant-icon-button" onClick={startNewConversation} disabled={activeChat.isSending} aria-label={`Start a new ${endpointTitle} conversation`} title="New conversation"><RotateCcw size={17} aria-hidden="true" /></button>
          <button type="button" className="support-assistant-icon-button" onClick={() => { setOpen(false); triggerRef.current?.focus(); }} aria-label="Close assistant"><X size={19} aria-hidden="true" /></button>
        </header>
        {role === 'provider' && <div className="support-assistant-mode-tabs" role="tablist" aria-label="Choose an assistant">
          <button type="button" role="tab" aria-selected={mode === 'support'} className={mode === 'support' ? 'is-active' : ''} onClick={() => setMode('support')}>AI Support</button>
          <button type="button" role="tab" aria-selected={mode === 'provider'} className={mode === 'provider' ? 'is-active' : ''} onClick={() => setMode('provider')}>Provider Assistant</button>
        </div>}
        <div className="support-assistant-feed" ref={feedRef} aria-live="polite" aria-relevant="additions text">
          {!activeChat.messages.length && <div className="support-assistant-welcome"><span className="support-assistant-welcome-icon"><Sparkles size={18} aria-hidden="true" /></span><p>{activeWelcome}</p>
            <div className="support-assistant-suggestions"><p>Try asking</p>{activeSuggestions.map(question => <button type="button" key={question} onClick={() => void sendMessage(question)} disabled={activeChat.isSending}>{question}</button>)}</div>
          </div>}
          {activeChat.messages.map(item => <article key={item.id} className={`support-assistant-message is-${item.role}`}>
            {item.role === 'assistant' && <span className="support-assistant-message-icon"><Bot size={15} aria-hidden="true" /></span>}
            <div className="support-assistant-bubble"><p>{item.text}</p><time dateTime={item.createdAt}>{item.time}</time>{item.draftKind && <div className="support-assistant-draft-actions"><small>Draft only · review and edit before using</small><div><button type="button" onClick={() => void copyDraft(item)}>{copiedDraft === item.id ? 'Copied' : 'Copy draft'}</button><Link to={item.draftKind === 'quote' ? '/quotes' : '/messages'} onClick={() => setOpen(false)}>Open {item.draftKind === 'quote' ? 'Quotes' : 'Messages'}</Link></div></div>}{item.role === 'assistant' && /complaints\s*&\s*support|visit support|contact support/i.test(item.text) && <Link to="/complaints" className="support-assistant-escalation" onClick={() => setOpen(false)}><LifeBuoy size={15} aria-hidden="true" /> Go to Complaints &amp; Support</Link>}</div>
          </article>)}
          {activeChat.isSending && <div className="support-assistant-typing" role="status"><span className="support-assistant-message-icon"><Bot size={15} aria-hidden="true" /></span><span><LoaderCircle size={16} className="support-assistant-spinner" aria-hidden="true" /> {mode === 'provider' ? 'Provider Assistant' : 'AI Support'} is responding…</span></div>}
          {activeChat.error && <div className="support-assistant-error" role="alert"><p>{activeChat.error}</p>{activeChat.sessionExpired && <Link to="/signin" onClick={() => setOpen(false)}>Sign in</Link>}</div>}
        </div>
        <form className="support-assistant-composer" onSubmit={submit}>
          <label className="sr-only" htmlFor="support-assistant-input">Your message</label>
          <textarea ref={composerRef} id="support-assistant-input" value={activeChat.draft} onChange={event => updateChat(mode, previous => ({ ...previous, draft: event.target.value.slice(0, MAX_MESSAGE_LENGTH) }))} onKeyDown={onComposerKeyDown} placeholder={mode === 'provider' ? 'Ask about your work…' : 'Ask a question…'} rows={2} maxLength={MAX_MESSAGE_LENGTH} disabled={activeChat.isSending} />
          <div className="support-assistant-composer-footer"><span>{activeChat.draft.length}/{MAX_MESSAGE_LENGTH} · Enter to send, Shift+Enter for a new line</span><button type="submit" disabled={!activeChat.draft.trim() || activeChat.isSending} aria-label="Send message"><Send size={17} aria-hidden="true" /></button></div>
        </form>
      </section>
    </div>}
  </>;
}
