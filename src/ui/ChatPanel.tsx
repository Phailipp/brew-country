import { useState, useEffect, useCallback, useRef } from 'react';
import type { User, ChatMessage, UserPresence } from '../domain/types';
import { GAME } from '../config/constants';
import { appEvents } from '../domain/events';
import { sendMessage, subscribeMessages } from '../services/firestoreService';
import { BeerBadge } from './kit/BeerBadge';
import { beerName } from './kit/beer';
import { haptic } from './kit/haptics';
import './ChatPanel.css';

interface Props {
  user: User;
  friendshipId: string;
  friendUser: User;
  friendPresence: UserPresence | undefined;
  onBack: () => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatDay(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Heute';
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Gestern';
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mo}.${d.getFullYear() !== now.getFullYear() ? d.getFullYear() : ''}`;
}

export function ChatPanel({ user, friendshipId, friendUser, friendPresence, onBack }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const friendName = friendUser.nickname || beerName(friendUser.beerId);
  const isOnline = friendPresence
    ? Date.now() - friendPresence.lastSeen < GAME.PRESENCE_ONLINE_THRESHOLD_MS
    : false;

  // Real-time subscription
  useEffect(() => {
    const unsub = subscribeMessages(friendshipId, (msgs) => {
      setMessages(msgs);
    });
    return () => unsub();
  }, [friendshipId]);

  // Auto-scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setError('');
    try {
      await sendMessage(friendshipId, user.id, text);
      setInput('');
      haptic('light');
      appEvents.emit({
        type: 'chat:message',
        message: { id: '', senderId: user.id, text, createdAt: Date.now() },
        friendshipId,
      });
    } catch (e) {
      console.error('sendMessage error:', e);
      setError('Nachricht nicht gesendet. Tippe nochmal auf Senden.');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, sending, friendshipId, user.id]);

  const charsLeft = GAME.MAX_CHAT_MESSAGE_LENGTH - input.length;

  return (
    <div className="chat" aria-label={`Chat mit ${friendName}`}>
      <header className="chat-header">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Zurück zur Crew">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <span className="chat-avatar">
          <BeerBadge beerId={friendUser.beerId} />
          <span className={`chat-dot${isOnline ? ' online' : ''}`} aria-hidden="true" />
        </span>
        <div className="chat-header-text">
          <span className="chat-header-name">{friendName}</span>
          <span className={`chat-header-status${isOnline ? ' online' : ''}`}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </header>

      <div className="chat-messages" role="log" aria-live="polite" aria-label="Nachrichten">
        {messages.length === 0 && (
          <div className="empty chat-empty">
            <span className="empty-icon" aria-hidden="true">🍻</span>
            <span className="empty-title">Sag Prost!</span>
            <p>Noch keine Nachrichten mit {friendName}. Mach den ersten Schritt.</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const isMine = msg.senderId === user.id;
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(msg.createdAt).toDateString();
          const groupedWithPrev = !newDay && prev?.senderId === msg.senderId;
          const lastOfGroup = !next || next.senderId !== msg.senderId;
          return (
            <div key={msg.id || `${msg.createdAt}-${i}`} className="chat-item">
              {newDay && <div className="chat-day"><span>{formatDay(msg.createdAt)}</span></div>}
              <div
                className={`chat-bubble ${isMine ? 'mine' : 'theirs'}${groupedWithPrev ? ' grouped' : ''}${lastOfGroup ? ' tail' : ''}`}
              >
                <span className="sr-only">{isMine ? 'Du' : friendName}: </span>
                <span className="chat-bubble-text">{msg.text}</span>
                <time className="chat-bubble-time" dateTime={new Date(msg.createdAt).toISOString()}>
                  {formatTime(msg.createdAt)}
                </time>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form
        className="chat-composer"
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
      >
        {error && <p className="chat-error" role="alert">{error}</p>}
        <div className="chat-composer-row">
          <label htmlFor="chat-input" className="sr-only">Nachricht an {friendName}</label>
          <div className="chat-input-wrap">
            <input
              id="chat-input"
              ref={inputRef}
              type="text"
              className="chat-input"
              placeholder="Nachricht …"
              autoComplete="off"
              enterKeyHint="send"
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, GAME.MAX_CHAT_MESSAGE_LENGTH))}
              maxLength={GAME.MAX_CHAT_MESSAGE_LENGTH}
            />
            {input.length > 400 && (
              <span className={`chat-count num${charsLeft < 20 ? ' low' : ''}`} aria-live="polite">{charsLeft}</span>
            )}
          </div>
          <button
            type="submit"
            className="chat-send"
            disabled={!input.trim() || sending}
            aria-label="Senden"
          >
            {sending ? (
              <span className="spinner" aria-hidden="true" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
