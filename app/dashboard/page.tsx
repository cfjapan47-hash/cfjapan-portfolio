'use client';

import { useState, useEffect, useCallback } from 'react';

type Message = {
  id: string;
  lineUserId: string;
  displayName: string;
  customerMessage: string;
  aiReply: string;
  sentReply?: string;
  status: string;
  createdAt: string;
};

export default function Dashboard() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'sent' | 'all'>('pending');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [sending, setSending] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/get-messages');
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch (e) {
      console.error('Load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  const filteredMessages = messages.filter(m => {
    if (filter === 'pending') return !m.status || m.status === 'pending';
    if (filter === 'sent') return m.status === 'sent';
    return true;
  });

  const handleSend = async (msg: Message, replyText?: string) => {
    setSending(msg.id);
    try {
      const res = await fetch('/api/send-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: msg.id,
          lineUserId: msg.lineUserId,
          replyText: replyText || msg.aiReply,
        }),
      });
      if (res.ok) {
        setEditingId(null);
        await loadMessages();
      }
    } catch (e) {
      console.error('Send error:', e);
    } finally {
      setSending(null);
    }
  };

  const handleDelete = async (msgId: string) => {
    if (!confirm('この返信案を削除しますか？')) return;
    try {
      const res = await fetch('/api/delete-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: msgId }),
      });
      if (res.ok) {
        await loadMessages();
      }
    } catch (e) {
      console.error('Delete error:', e);
    }
  };

  const handleEdit = (msg: Message) => {
    setEditingId(msg.id);
    setEditText(msg.aiReply);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 20, fontFamily: "'Noto Sans JP', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet" />

      <h1 style={{ fontSize: 22, marginBottom: 5, color: '#2d5a27' }}>
        メナードフェイシャルサロン 管理画面
      </h1>
      <p style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>
        お客様からのメッセージとAI返信案
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[
          { key: 'pending' as const, label: '未送信', color: '#e74c3c' },
          { key: 'sent' as const, label: '送信済み', color: '#27ae60' },
          { key: 'all' as const, label: 'すべて', color: '#666' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '8px 18px',
              border: 'none',
              borderRadius: 20,
              fontSize: 14,
              fontWeight: filter === f.key ? 700 : 400,
              backgroundColor: filter === f.key ? f.color : '#f0f0f0',
              color: filter === f.key ? '#fff' : '#666',
              cursor: 'pointer',
            }}
          >
            {f.label}
            {f.key === 'pending' && (
              <span style={{ marginLeft: 6, fontSize: 12 }}>
                ({messages.filter(m => !m.status || m.status === 'pending').length})
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: '#888', padding: 40 }}>読み込み中...</p>
      ) : filteredMessages.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
          <p style={{ fontSize: 40, marginBottom: 10 }}>
            {filter === 'pending' ? '✅' : '📭'}
          </p>
          <p>{filter === 'pending' ? '未送信のメッセージはありません' : 'メッセージがありません'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filteredMessages.map(msg => (
            <div
              key={msg.id}
              style={{
                border: '1px solid #e0e0e0',
                borderRadius: 12,
                padding: 18,
                backgroundColor: msg.status === 'sent' ? '#f8fff8' : '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#333' }}>
                    {msg.displayName || 'お客様'}
                  </span>
                  <span style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 10,
                    backgroundColor: msg.status === 'sent' ? '#d4edda' : '#fff3cd',
                    color: msg.status === 'sent' ? '#155724' : '#856404',
                  }}>
                    {msg.status === 'sent' ? '送信済み' : '未送信'}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: '#999' }}>
                  {msg.createdAt ? new Date(msg.createdAt).toLocaleString('ja-JP') : ''}
                </span>
              </div>

              <div style={{
                backgroundColor: '#e8f5e9',
                borderRadius: 10,
                padding: 12,
                marginBottom: 10,
                fontSize: 14,
              }}>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>お客様</div>
                {msg.customerMessage}
              </div>

              <div style={{
                backgroundColor: msg.status === 'sent' ? '#e3f2fd' : '#fff8e1',
                borderRadius: 10,
                padding: 12,
                marginBottom: 12,
                fontSize: 14,
              }}>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>
                  {msg.status === 'sent' ? '送信した返信' : 'AI返信案'}
                </div>
                {msg.sentReply || msg.aiReply}
              </div>

              {editingId === msg.id && (
                <div style={{ marginBottom: 12 }}>
                  <textarea
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    style={{
                      width: '100%',
                      minHeight: 100,
                      padding: 10,
                      borderRadius: 8,
                      border: '1px solid #ccc',
                      fontSize: 14,
                      fontFamily: "'Noto Sans JP', sans-serif",
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      onClick={() => handleSend(msg, editText)}
                      disabled={sending === msg.id}
                      style={{
                        padding: '8px 20px',
                        backgroundColor: '#2d5a27',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        fontSize: 14,
                        cursor: 'pointer',
                      }}
                    >
                      {sending === msg.id ? '送信中...' : 'この内容で送信'}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      style={{
                        padding: '8px 20px',
                        backgroundColor: '#eee',
                        color: '#666',
                        border: 'none',
                        borderRadius: 8,
                        fontSize: 14,
                        cursor: 'pointer',
                      }}
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              )}

              {msg.status !== 'sent' && editingId !== msg.id && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleSend(msg)}
                    disabled={sending === msg.id}
                    style={{
                      padding: '8px 18px',
                      backgroundColor: '#2d5a27',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    {sending === msg.id ? '送信中...' : 'このまま送信'}
                  </button>
                  <button
                    onClick={() => handleEdit(msg)}
                    style={{
                      padding: '8px 18px',
                      backgroundColor: '#fff',
                      color: '#2d5a27',
                      border: '1px solid #2d5a27',
                      borderRadius: 8,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    修正する
                  </button>
                  <button
                    onClick={() => handleDelete(msg.id)}
                    style={{
                      padding: '8px 18px',
                      backgroundColor: '#fff',
                      color: '#e74c3c',
                      border: '1px solid #e74c3c',
                      borderRadius: 8,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    削除
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
