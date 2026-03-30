'use client';
import { useState, useEffect } from 'react';

const SALON_ID = 'menard-wakuizumi';
const PROJECT_ID = 'salon-ai-reply';
const API_KEY = 'AIzaSyCYk8omS7tsygGdisrYF1c89AXU5ATGOxc';

type Message = {
  id: string;
  lineUserId: string;
  customerMessage: string;
  aiReply: string;
  editedReply: string | null;
  feedback: string | null;
  status: string | null;
  createdAt: any;
};

async function firestoreGet(path: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}?key=${API_KEY}`;
  const res = await fetch(url);
  return res.json();
}

async function firestoreList(path: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}?key=${API_KEY}&orderBy=createdAt+desc&pageSize=50`;
  const res = await fetch(url);
  return res.json();
}

function parseFirestoreDoc(doc: any): Message {
  const f = doc.fields || {};
  return {
    id: doc.name.split('/').pop(),
    lineUserId: f.lineUserId?.stringValue || '',
    customerMessage: f.customerMessage?.stringValue || '',
    aiReply: f.aiReply?.stringValue || '',
    editedReply: f.editedReply?.stringValue || null,
    feedback: f.feedback?.stringValue || null,
    status: f.status?.stringValue || null,
    createdAt: f.createdAt?.timestampValue || null,
  };
}

function formatTime(ts: string | null) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Dashboard() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [sending, setSending] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unsent' | 'sent'>('unsent');

  const loadMessages = async () => {
  try {
    const res = await fetch('/api/get-messages');
    const data = await res.json();
    if (data.messages) setMessages(data.messages);
  } catch (e) {
    console.error('Load error:', e);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
  }, []);

  const filtered = messages.filter(m => {
    if (filter === 'unsent') return !m.status || m.status !== 'sent';
    if (filter === 'sent') return m.status === 'sent';
    return true;
  });

  const startEdit = (msg: Message) => {
    setEditingId(msg.id);
    setEditText(msg.editedReply || msg.aiReply);
  };

  const sendReply = async (msg: Message) => {
    const text = editingId === msg.id ? editText : (msg.editedReply || msg.aiReply);
    setSending(msg.id);
    try {
      const res = await fetch('/api/send-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: msg.id,
          salonId: SALON_ID,
          lineUserId: msg.lineUserId,
          replyText: text,
          feedback: 'good',
        }),
      });
      if (!res.ok) throw new Error('送信失敗');
      setEditingId(null);
      await loadMessages();
    } catch (e) {
      alert('送信に失敗しました。もう一度試してください。');
    } finally {
      setSending(null);
    }
  };

  const skipMessage = async (msg: Message) => {
    await fetch('/api/send-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId: msg.id,
        salonId: SALON_ID,
        lineUserId: msg.lineUserId,
        replyText: msg.aiReply,
        feedback: 'bad',
      }),
    });
    await loadMessages();
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F1EFE8', fontFamily: 'sans-serif' }}>
      <div style={{ background: '#06C755', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ color: 'white', fontSize: 16, fontWeight: 700 }}>メナードフェイシャルサロン</div>
        <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>AI返信管理</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={loadMessages} style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', borderRadius: 20, padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}>更新</button>
          <div style={{ background: 'rgba(255,255,255,0.2)', color: 'white', padding: '4px 12px', borderRadius: 20, fontSize: 12 }}>
            未対応 {messages.filter(m => !m.status || m.status !== 'sent').length}件
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '12px 16px', background: 'white', borderBottom: '1px solid #E5E5E5' }}>
        {(['unsent', 'sent', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13,
            background: filter === f ? '#06C755' : '#F1EFE8',
            color: filter === f ? 'white' : '#5F5E5A',
            fontWeight: filter === f ? 700 : 400,
          }}>
            {f === 'unsent' ? '未送信' : f === 'sent' ? '送信済み' : 'すべて'}
          </button>
        ))}
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640, margin: '0 auto' }}>
        {loading && <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>読み込み中...</div>}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>
            {filter === 'unsent' ? '未送信のメッセージはありません' : 'メッセージがありません'}
          </div>
        )}

        {filtered.map(msg => (
          <div key={msg.id} style={{ background: 'white', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden', opacity: msg.status === 'sent' ? 0.7 : 1 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1EFE8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#2C2C2A' }}>お客様</div>
                <div style={{ fontSize: 11, color: '#888' }}>{formatTime(msg.createdAt)}</div>
              </div>
              <div style={{ fontSize: 14, color: '#2C2C2A', lineHeight: 1.6 }}>{msg.customerMessage}</div>
            </div>

            <div style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <div style={{ fontSize: 11, background: '#E1F5EE', color: '#0F6E56', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>AI返信案</div>
                {msg.status === 'sent' && <div style={{ fontSize: 11, background: '#E8FAF0', color: '#06C755', padding: '2px 8px', borderRadius: 10 }}>送信済み</div>}
              </div>

              {editingId === msg.id ? (
                <textarea value={editText} onChange={e => setEditText(e.target.value)}
                  style={{ width: '100%', minHeight: 120, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #06C755', fontSize: 14, lineHeight: 1.6, resize: 'vertical', fontFamily: 'sans-serif', boxSizing: 'border-box' }} />
              ) : (
                <div style={{ fontSize: 14, color: '#2C2C2A', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{msg.editedReply || msg.aiReply}</div>
              )}

              {msg.status !== 'sent' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  {editingId === msg.id ? (
                    <>
                      <button onClick={() => sendReply(msg)} disabled={sending === msg.id}
                        style={{ flex: 1, padding: '10px', background: '#06C755', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: sending === msg.id ? 0.6 : 1 }}>
                        {sending === msg.id ? '送信中...' : '✓ この内容で送信'}
                      </button>
                      <button onClick={() => setEditingId(null)}
                        style={{ padding: '10px 16px', background: '#F1EFE8', color: '#5F5E5A', border: 'none', borderRadius: 10, fontSize: 13, cursor: 'pointer' }}>
                        キャンセル
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => sendReply(msg)} disabled={sending === msg.id}
                        style={{ flex: 1, padding: '10px', background: '#06C755', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: sending === msg.id ? 0.6 : 1 }}>
                        {sending === msg.id ? '送信中...' : '送信する'}
                      </button>
                      <button onClick={() => startEdit(msg)}
                        style={{ padding: '10px 16px', background: '#F1EFE8', color: '#2C2C2A', border: 'none', borderRadius: 10, fontSize: 13, cursor: 'pointer' }}>
                        修正する
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
