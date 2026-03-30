'use client';
// app/dashboard/page.tsx
// サロンAI返信 管理画面

import { useState, useEffect, useCallback } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

function initFirebase() {
  if (getApps().length === 0) {
    initializeApp(firebaseConfig);
  }
  return getFirestore();
}

type Message = {
  id: string;
  lineUserId: string;
  customerMessage: string;
  aiReply: string;
  editedReply: string | null;
  feedback: string | null;
  status: string | null;
  createdAt: { seconds: number } | null;
  displayName?: string;
};

export default function Dashboard() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [sending, setSending] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unsent' | 'sent'>('unsent');
  const salonId = process.env.NEXT_PUBLIC_SALON_ID || 'menard-wakuizumi';

  useEffect(() => {
    const db = initFirebase();
    const q = query(
      collection(db, 'salons', salonId, 'messages'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      })) as Message[];
      setMessages(msgs);
    });

    return () => unsub();
  }, [salonId]);

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
          salonId,
          lineUserId: msg.lineUserId,
          replyText: text,
          feedback: 'good',
        }),
      });
      if (!res.ok) throw new Error('送信失敗');
      setEditingId(null);
    } catch (e) {
      alert('送信に失敗しました。もう一度試してください。');
    } finally {
      setSending(null);
    }
  };

  const skipMessage = async (msg: Message) => {
    const db = initFirebase();
    await updateDoc(doc(db, 'salons', salonId, 'messages', msg.id), {
      status: 'skipped',
      feedback: 'bad',
    });
  };

  const formatTime = (ts: { seconds: number } | null) => {
    if (!ts) return '';
    const d = new Date(ts.seconds * 1000);
    return d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F1EFE8', fontFamily: 'sans-serif' }}>
      {/* ヘッダー */}
      <div style={{ background: '#06C755', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>メナードフェイシャルサロン</div>
        <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>AI返信管理</div>
        <div style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', color: 'white', padding: '4px 12px', borderRadius: 20, fontSize: 12 }}>
          未対応 {messages.filter(m => m.status !== 'sent' && m.status !== 'skipped').length}件
        </div>
      </div>

      {/* フィルター */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px', background: 'white', borderBottom: '1px solid #E5E5E5' }}>
        {(['unsent', 'sent', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13,
              background: filter === f ? '#06C755' : '#F1EFE8',
              color: filter === f ? 'white' : '#5F5E5A',
              fontWeight: filter === f ? 700 : 400,
            }}
          >
            {f === 'unsent' ? '未送信' : f === 'sent' ? '送信済み' : 'すべて'}
          </button>
        ))}
      </div>

      {/* メッセージ一覧 */}
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640, margin: '0 auto' }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>
            {filter === 'unsent' ? '未送信のメッセージはありません' : 'メッセージがありません'}
          </div>
        )}

        {filtered.map(msg => (
          <div key={msg.id} style={{
            background: 'white', borderRadius: 16,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            overflow: 'hidden',
            opacity: msg.status === 'sent' ? 0.7 : 1,
          }}>
            {/* 顧客メッセージ */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1EFE8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#0F6E56', fontWeight: 700 }}>
                    客
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#2C2C2A' }}>お客様</div>
                </div>
                <div style={{ fontSize: 11, color: '#888' }}>{formatTime(msg.createdAt)}</div>
              </div>
              <div style={{ fontSize: 14, color: '#2C2C2A', lineHeight: 1.6, paddingLeft: 40 }}>
                {msg.customerMessage}
              </div>
            </div>

            {/* AI返信案 */}
            <div style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <div style={{ fontSize: 11, background: '#E1F5EE', color: '#0F6E56', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>AI返信案</div>
                {msg.status === 'sent' && <div style={{ fontSize: 11, background: '#E8FAF0', color: '#06C755', padding: '2px 8px', borderRadius: 10 }}>送信済み</div>}
                {msg.status === 'skipped' && <div style={{ fontSize: 11, background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: 10 }}>スキップ</div>}
              </div>

              {editingId === msg.id ? (
                <textarea
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  style={{
                    width: '100%', minHeight: 120, padding: '10px 12px',
                    borderRadius: 10, border: '1.5px solid #06C755',
                    fontSize: 14, lineHeight: 1.6, color: '#2C2C2A',
                    resize: 'vertical', fontFamily: 'sans-serif',
                    boxSizing: 'border-box',
                  }}
                />
              ) : (
                <div style={{ fontSize: 14, color: '#2C2C2A', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {msg.editedReply || msg.aiReply}
                </div>
              )}

              {/* ボタン */}
              {msg.status !== 'sent' && msg.status !== 'skipped' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  {editingId === msg.id ? (
                    <>
                      <button
                        onClick={() => sendReply(msg)}
                        disabled={sending === msg.id}
                        style={{
                          flex: 1, padding: '10px', background: '#06C755', color: 'white',
                          border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
                          cursor: 'pointer', opacity: sending === msg.id ? 0.6 : 1,
                        }}
                      >
                        {sending === msg.id ? '送信中...' : '✓ この内容で送信'}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        style={{
                          padding: '10px 16px', background: '#F1EFE8', color: '#5F5E5A',
                          border: 'none', borderRadius: 10, fontSize: 13, cursor: 'pointer',
                        }}
                      >
                        キャンセル
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => sendReply(msg)}
                        disabled={sending === msg.id}
                        style={{
                          flex: 1, padding: '10px', background: '#06C755', color: 'white',
                          border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
                          cursor: 'pointer', opacity: sending === msg.id ? 0.6 : 1,
                        }}
                      >
                        {sending === msg.id ? '送信中...' : '送信する'}
                      </button>
                      <button
                        onClick={() => startEdit(msg)}
                        style={{
                          padding: '10px 16px', background: '#F1EFE8', color: '#2C2C2A',
                          border: 'none', borderRadius: 10, fontSize: 13, cursor: 'pointer',
                        }}
                      >
                        修正する
                      </button>
                      <button
                        onClick={() => skipMessage(msg)}
                        style={{
                          padding: '10px 16px', background: '#FEF3C7', color: '#92400E',
                          border: 'none', borderRadius: 10, fontSize: 13, cursor: 'pointer',
                        }}
                      >
                        スキップ
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
