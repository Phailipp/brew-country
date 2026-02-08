import { useState, useEffect, useCallback, useRef } from 'react';
import type { User, ChatMessage, UserPresence } from '../domain/types';
import { GAME } from '../config/constants';
import { BEER_MAP } from '../domain/beers';
import { appEvents } from '../domain/events';
import { sendMessage, subscribeMessages } from '../services/firestoreService';
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
  const now = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const time = `${hh}:${mm}`;

  // Same day? Just time
  if (d.toDateString() === now.toDateString()) return time;

  // Otherwise date + time
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mo}. ${time}`;
}

export function ChatPanel({ user, friendshipId, friendUser, friendPresence, onBack }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const friendBeer = BEER_MAP.get(friendUser.beerId);
  const isOnline = friendPresence
    ? Date.now() - friendPresence.lastSeen < GAME.PRESENCE_ONLINE_THRESHOLD_MS
    : false;

  // Subscribe to messages (real-time)
  useEffect(() => {
    const unsub = subscribeMessages(friendshipId, (msgs) => {
      setMessages(msgs);
    });
    return () => unsub();
  }, [friendshipId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      await sendMessage(friendshipId, user.id, text);
      setInput('');
      appEvents.emit({
        type: 'chat:message',
        message: { id: '', senderId: user.id, text, createdAt: Date.now() },
        friendshipId,
      });
    } catch (e) {
      console.error('sendMessage error:', e);
    } finally {
      setSending(false);
    }
  }, [input, sending, friendshipId, user.id]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const charsLeft = GAME.MAX_CHAT_MESSAGE_LENGTH - input.length;

  return (
    <div className="chat-panel">
      {/* Header */}
      <div className="chat-header">
        <button className="chat-back-btn" onClick={onBack} title="Zurück">
          ←
        </button>
        <div className="chat-header-info">
          {friendBeer && (
            <img src={friendBeer.svgLogo} alt={friendBeer.name} className="chat-header-logo" />
          )}
          <div className="chat-header-text">
            <span className="chat-header-name">
              {friendBeer?.name ?? friendUser.beerId}
            </span>
            <span className={`chat-header-status ${isOnline ? 'online' : ''}`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <span className={`chat-header-dot ${isOnline ? 'online' : 'offline'}`} />
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages" ref={messagesContainerRef}>
        {messages.length === 0 && (
          <p className="chat-empty">Noch keine Nachrichten. Sag Prost! 🍻</p>
        )}
        {messages.map((msg) => {
          const isMine = msg.senderId === user.id;
          return (
            <div key={msg.id} className={`chat-bubble ${isMine ? 'mine' : 'theirs'}`}>
              <div className="chat-bubble-text">{msg.text}</div>
              <span className="chat-bubble-time">{formatTime(msg.createdAt)}</span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <div className="chat-input-wrapper">
          <input
            type="text"
            className="chat-input"
            placeholder="Nachricht..."
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, GAME.MAX_CHAT_MESSAGE_LENGTH))}
            onKeyDown={handleKeyDown}
            disabled={sending}
            maxLength={GAME.MAX_CHAT_MESSAGE_LENGTH}
          />
          {input.length > 400 && (
            <span className="chat-char-count">{charsLeft}</span>
          )}
        </div>
        <button
          className="chat-send-btn"
          onClick={handleSend}
          disabled={!input.trim() || sending}
        >
          {sending ? '...' : '➤'}
        </button>
      </div>
    </div>
  );
}
