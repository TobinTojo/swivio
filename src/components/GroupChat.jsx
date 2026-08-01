import { useEffect, useRef, useState } from 'react';
import { sendChatMessage, subscribeChat } from '../lib/daily.js';

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function GroupChat({ roomId, userId, displayName, avatarUrl }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    return subscribeChat(roomId, setMessages);
  }, [roomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await sendChatMessage(roomId, userId, displayName, avatarUrl, text);
      setText('');
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="group-chat">
      <div className="group-chat__messages">
        {messages.length === 0 && (
          <p className="group-chat__empty">No messages yet. Say hi to your group!</p>
        )}
        {messages.map((msg) => {
          const isSelf = msg.userId === userId;
          return (
            <div
              key={msg.id}
              className={`group-chat__msg ${isSelf ? 'group-chat__msg--self' : ''}`}
            >
              {msg.avatarUrl ? (
                <img className="group-chat__avatar" src={msg.avatarUrl} alt="" />
              ) : (
                <span className="group-chat__avatar group-chat__avatar--letter">
                  {msg.displayName?.charAt(0)?.toUpperCase() || '?'}
                </span>
              )}
              <div className="group-chat__bubble">
                <span className="group-chat__author">{msg.displayName}</span>
                <p>{msg.body}</p>
                <time className="group-chat__time">{formatTime(msg.createdAt)}</time>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form className="group-chat__form" onSubmit={handleSend}>
        <input
          className="group-chat__input"
          type="text"
          placeholder="Message the group…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
        />
        <button type="submit" className="btn btn--primary" disabled={sending || !text.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
