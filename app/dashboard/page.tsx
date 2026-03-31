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

type Memo = {
  id: string;
  text: string;
  createdAt: string;
  staffName: string;
};

type Customer = {
  lineUserId: string;
  displayName: string;
  profileImageUrl?: string;
  firstVisit?: string;
  lastVisit?: string;
  visitCount: number;
  tags: string[];
  memos: Memo[];
  aiSummary?: string;
  profile?: {
    skinType?: string;
    skinConcerns?: string[];
    hasChildren?: boolean;
  };
};

const GREEN = '#2d5a27';
const LIGHT_GREEN = '#e8f5e9';

export default function UnifiedDashboard() {
  const [activeTab, setActiveTab] = useState<'messages' | 'customers'>('messages');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'sent' | 'all'>('pending');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [sending, setSending] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [custLoading, setCustLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newMemo, setNewMemo] = useState('');
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [summarizing, setSummarizing] = useState(false);

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/get-messages');
      const data = await res.json();
      if (data.messages) setMessages(data.messages);
    } catch (e) { console.error(e); }
    finally { setMsgLoading(false); }
  }, []);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  const pendingCount = messages.filter(m => !m.status || m.status === 'pending').length;

  const userList = Array.from(
    new Map(messages.map(m => [m.lineUserId, m.displayName])).entries()
  ).map(([id, name]) => ({ id, name }));

  const filteredMessages = messages.filter(m => {
    const statusOk = filter === 'all' ? true : filter === 'pending' ? (!m.status || m.status === 'pending') : m.status === 'sent';
    const userOk = userFilter === 'all' || m.lineUserId === userFilter;
    return statusOk && userOk;
  });

  const handleSend = async (msg: Message, replyText?: string) => {
    setSending(msg.id);
    try {
      const res = await fetch('/api/send-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: msg.id, lineUserId: msg.lineUserId, replyText: replyText || msg.aiReply }),
      });
      if (res.ok) { setEditingId(null); await loadMessages(); }
    } catch (e) { console.error(e); }
    finally { setSending(null); }
  };

  const handleDelete = async (msgId: string) => {
    if (!confirm('この返信案を削除しますか？')) return;
    try {
      const res = await fetch('/api/delete-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: msgId }),
      });
      if (res.ok) await loadMessages();
    } catch (e) { console.error(e); }
  };

  const loadCustomers = useCallback(async (): Promise<Customer[]> => {
    try {
      const res = await fetch('/api/get-customers');
      const data = await res.json();
      if (data.customers) { setCustomers(data.customers); return data.customers; }
    } catch (e) { console.error(e); }
    finally { setCustLoading(false); }
    return [];
  }, []);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const refreshSelected = async (id: string) => {
    const latest = await loadCustomers();
    const updated = latest.find(c => c.lineUserId === id);
    if (updated) setSelectedCustomer(updated);
  };

  const filteredCustomers = customers.filter(c =>
    c.displayName?.includes(search) || c.tags?.some(t => t.includes(search))
  );

  const handleAddMemo = async () => {
    if (!newMemo.trim() || !selectedCustomer) return;
    setSaving(true);
    const id = selectedCustomer.lineUserId;
    try {
      const res = await fetch('/api/customer-memo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId: id, action: 'add', text: newMemo.trim(), staffName: '白石' }),
      });
      if (res.ok) { setNewMemo(''); await refreshSelected(id); }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDeleteMemo = async (memoId: string) => {
    if (!selectedCustomer) return;
    const id = selectedCustomer.lineUserId;
    try {
      await fetch('/api/customer-memo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId: id, action: 'delete', memoId }),
      });
      await refreshSelected(id);
    } catch (e) { console.error(e); }
  };

  const handleAddTag = async () => {
    if (!newTag.trim() || !selectedCustomer) return;
    const id = selectedCustomer.lineUserId;
    const tag = newTag.trim();
    try {
      const res = await fetch('/api/customer-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId: id, action: 'add', tag }),
      });
      if (res.ok) { setNewTag(''); await refreshSelected(id); }
    } catch (e) { console.error(e); }
  };

  const handleRemoveTag = async (tag: string) => {
    if (!selectedCustomer) return;
    const id = selectedCustomer.lineUserId;
    try {
      const res = await fetch('/api/customer-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId: id, action: 'remove', tag }),
      });
      if (res.ok) await refreshSelected(id);
    } catch (e) { console.error(e); }
  };

  const handleSummarize = async () => {
    if (!selectedCustomer) return;
    setSummarizing(true);
    const id = selectedCustomer.lineUserId;
    try {
      await fetch('/api/customer-summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId: id }),
      });
      await refreshSelected(id);
    } catch (e) { console.error(e); }
    finally { setSummarizing(false); }
  };

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('ja-JP') : '-';

  const showCustomerList = !isMobile || !selectedCustomer;
  const showCustomerDetail = !isMobile || !!selectedCustomer;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', fontFamily: "'Noto Sans JP', sans-serif", backgroundColor: '#f5f5f5' }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet" />

      <div style={{ backgroundColor: GREEN, color: '#fff', padding: isMobile ? '10px 16px' : '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: isMobile ? 13 : 16, fontWeight: 700 }}>
            {isMobile ? 'メナードサロン 若泉' : 'メナードフェイシャルサロン 若泉１丁目'}
          </div>
          <div style={{ fontSize: 10, opacity: 0.8 }}>AI返信管理システム</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setActiveTab('messages')} style={{ padding: isMobile ? '7px 14px' : '8px 20px', borderRadius: 20, border: 'none', fontSize: isMobile ? 12 : 13, fontWeight: activeTab === 'messages' ? 700 : 400, backgroundColor: activeTab === 'messages' ? '#fff' : 'transparent', color: activeTab === 'messages' ? GREEN : 'rgba(255,255,255,0.85)', cursor: 'pointer', position: 'relative' }}>
            💬 {isMobile ? '返信' : '返信管理'}
            {pendingCount > 0 && (
              <span style={{ position: 'absolute', top: 2, right: 2, backgroundColor: '#e74c3c', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {pendingCount}
              </span>
            )}
          </button>
          <button onClick={() => { setActiveTab('customers'); setSelectedCustomer(null); }} style={{ padding: isMobile ? '7px 14px' : '8px 20px', borderRadius: 20, border: 'none', fontSize: isMobile ? 12 : 13, fontWeight: activeTab === 'customers' ? 700 : 400, backgroundColor: activeTab === 'customers' ? '#fff' : 'transparent', color: activeTab === 'customers' ? GREEN : 'rgba(255,255,255,0.85)', cursor: 'pointer' }}>
            👤 {isMobile ? '顧客' : '顧客管理'}
          </button>
        </div>
      </div>

      {activeTab === 'messages' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 12 : 24 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {[
              { key: 'pending' as const, label: '未送信', color: '#e74c3c' },
              { key: 'sent' as const, label: '送信済み', color: '#27ae60' },
              { key: 'all' as const, label: 'すべて', color: '#666' },
            ].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{ padding: isMobile ? '7px 14px' : '8px 18px', border: 'none', borderRadius: 20, fontSize: isMobile ? 13 : 14, fontWeight: filter === f.key ? 700 : 400, backgroundColor: filter === f.key ? f.color : '#fff', color: filter === f.key ? '#fff' : '#666', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                {f.label}{f.key === 'pending' && <span style={{ marginLeft: 5, fontSize: 11 }}>({pendingCount})</span>}
              </button>
            ))}
          </div>

          {userList.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#888' }}>お客様：</span>
              <button onClick={() => setUserFilter('all')} style={{ padding: '4px 12px', border: 'none', borderRadius: 16, fontSize: 12, backgroundColor: userFilter === 'all' ? GREEN : '#fff', color: userFilter === 'all' ? '#fff' : '#666', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>全員</button>
              {userList.map(u => (
                <button key={u.id} onClick={() => setUserFilter(u.id)} style={{ padding: '4px 12px', border: 'none', borderRadius: 16, fontSize: 12, backgroundColor: userFilter === u.id ? GREEN : '#fff', color: userFilter === u.id ? '#fff' : '#555', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', fontWeight: userFilter === u.id ? 700 : 400 }}>
                  {u.name}
                </button>
              ))}
            </div>
          )}

          {msgLoading ? (
            <p style={{ textAlign: 'center', color: '#888', padding: 40 }}>読み込み中...</p>
          ) : filteredMessages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
              <p style={{ fontSize: 36, marginBottom: 10 }}>{filter === 'pending' ? '✅' : '📭'}</p>
              <p style={{ fontSize: 14 }}>{filter === 'pending' ? '未送信のメッセージはありません' : 'メッセージがありません'}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 800, margin: '0 auto' }}>
              {filteredMessages.map(msg => (
                <div key={msg.id} style={{ border: '1px solid #e0e0e0', borderRadius: 12, padding: isMobile ? 14 : 18, backgroundColor: msg.status === 'sent' ? '#f8fff8' : '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, color: '#333' }}>{msg.displayName || 'お客様'}</span>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, backgroundColor: msg.status === 'sent' ? '#d4edda' : '#fff3cd', color: msg.status === 'sent' ? '#155724' : '#856404' }}>
                        {msg.status === 'sent' ? '送信済み' : '未送信'}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: '#999' }}>
                      {msg.createdAt ? new Date(msg.createdAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <div style={{ backgroundColor: LIGHT_GREEN, borderRadius: 10, padding: isMobile ? 10 : 12, marginBottom: 8, fontSize: isMobile ? 13 : 14 }}>
                    <div style={{ fontSize: 10, color: '#666', marginBottom: 3 }}>お客様</div>
                    {msg.customerMessage}
                  </div>
                  <div style={{ backgroundColor: msg.status === 'sent' ? '#e3f2fd' : '#fff8e1', borderRadius: 10, padding: isMobile ? 10 : 12, marginBottom: 10, fontSize: isMobile ? 13 : 14 }}>
                    <div style={{ fontSize: 10, color: '#666', marginBottom: 3 }}>{msg.status === 'sent' ? '送信した返信' : 'AI返信案'}</div>
                    {msg.sentReply || msg.aiReply}
                  </div>
                  {editingId === msg.id && (
                    <div style={{ marginBottom: 10 }}>
                      <textarea value={editText} onChange={e => setEditText(e.target.value)} style={{ width: '100%', minHeight: isMobile ? 120 : 100, padding: 10, borderRadius: 8, border: '1px solid #ccc', fontSize: 14, fontFamily: "'Noto Sans JP', sans-serif", resize: 'vertical', boxSizing: 'border-box' }} />
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button onClick={() => handleSend(msg, editText)} disabled={sending === msg.id} style={{ flex: 1, padding: '10px', backgroundColor: GREEN, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontWeight: 700 }}>
                          {sending === msg.id ? '送信中...' : 'この内容で送信'}
                        </button>
                        <button onClick={() => { setEditingId(null); setEditText(''); }} style={{ padding: '10px 16px', backgroundColor: '#eee', color: '#666', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>戻る</button>
                      </div>
                    </div>
                  )}
                  {msg.status !== 'sent' && editingId !== msg.id && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                      <button onClick={() => handleSend(msg)} disabled={sending === msg.id} style={{ flex: 1, padding: '10px', backgroundColor: GREEN, color: '#fff', border: 'none', borderRadius: 8, fontSize: isMobile ? 14 : 13, cursor: 'pointer', fontWeight: 700 }}>
                        {sending === msg.id ? '送信中...' : 'このまま送信'}
                      </button>
                      <button onClick={() => { setEditingId(msg.id); setEditText(msg.aiReply); }} style={{ flex: 1, padding: '10px', backgroundColor: '#fff', color: GREEN, border: '1px solid ' + GREEN, borderRadius: 8, fontSize: isMobile ? 14 : 13, cursor: 'pointer' }}>修正する</button>
                      <button onClick={() => handleDelete(msg.id)} style={{ padding: '10px 16px', backgroundColor: '#fff', color: '#e74c3c', border: '1px solid #e74c3c', borderRadius: 8, fontSize: isMobile ? 14 : 13, cursor: 'pointer' }}>削除</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'customers' && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {showCustomerList && (
            <div style={{ width: isMobile ? '100%' : 280, backgroundColor: '#fff', borderRight: isMobile ? 'none' : '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #e0e0e0' }}>
                <input type="text" placeholder="名前・タグで検索..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {custLoading ? (
                  <p style={{ textAlign: 'center', color: '#888', padding: 20 }}>読み込み中...</p>
                ) : filteredCustomers.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#aaa', padding: 20 }}>お客様がいません</p>
                ) : filteredCustomers.map(customer => (
                  <div key={customer.lineUserId} onClick={() => setSelectedCustomer(customer)} style={{ padding: '14px 16px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', backgroundColor: selectedCustomer?.lineUserId === customer.lineUserId ? LIGHT_GREEN : '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: GREEN, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, flexShrink: 0 }}>
                        {customer.displayName?.[0] || '?'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 500, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{customer.displayName || '不明'}</div>
                        <div style={{ fontSize: 12, color: '#888' }}>来店 {customer.visitCount || 0}回 ・ {formatDate(customer.lastVisit)}</div>
                      </div>
                      {isMobile && <span style={{ color: '#ccc', fontSize: 18 }}>›</span>}
                    </div>
                    {customer.tags?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingLeft: 52 }}>
                        {customer.tags.slice(0, 4).map(tag => (
                          <span key={tag} style={{ fontSize: 11, padding: '2px 8px', backgroundColor: LIGHT_GREEN, color: GREEN, borderRadius: 10 }}>{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {showCustomerDetail && (
            selectedCustomer ? (
              <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 12 : 20 }}>
                {isMobile && (
                  <button onClick={() => setSelectedCustomer(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, background: 'none', border: 'none', color: GREEN, fontSize: 15, cursor: 'pointer', fontWeight: 700, padding: 0 }}>
                    ‹ お客様一覧に戻る
                  </button>
                )}
                <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', backgroundColor: GREEN, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, flexShrink: 0 }}>
                      {selectedCustomer.displayName?.[0] || '?'}
                    </div>
                    <div>
                      <h2 style={{ fontSize: 18, color: '#333', marginBottom: 2 }}>{selectedCustomer.displayName}</h2>
                      <div style={{ fontSize: 12, color: '#888' }}>初来店：{formatDate(selectedCustomer.firstVisit)} ／ 最終：{formatDate(selectedCustomer.lastVisit)} ／ {selectedCustomer.visitCount || 0}回</div>
                    </div>
                  </div>
                  {selectedCustomer.profile && Object.keys(selectedCustomer.profile).length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                      {selectedCustomer.profile.skinType && <span style={{ fontSize: 11, padding: '2px 10px', backgroundColor: '#fff3e0', color: '#e65100', borderRadius: 12 }}>肌：{selectedCustomer.profile.skinType}</span>}
                      {selectedCustomer.profile.skinConcerns?.map(c => <span key={c} style={{ fontSize: 11, padding: '2px 10px', backgroundColor: '#fce4ec', color: '#c62828', borderRadius: 12 }}>{c}</span>)}
                      {selectedCustomer.profile.hasChildren && <span style={{ fontSize: 11, padding: '2px 10px', backgroundColor: '#e3f2fd', color: '#1565c0', borderRadius: 12 }}>お子様あり</span>}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    {selectedCustomer.tags?.map(tag => (
                      <span key={tag} style={{ fontSize: 12, padding: '4px 10px', backgroundColor: LIGHT_GREEN, color: GREEN, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {tag}<span onClick={() => handleRemoveTag(tag)} style={{ color: '#999', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>×</span>
                      </span>
                    ))}
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, width: '100%' }}>
                      <input type="text" placeholder="タグを追加..." value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddTag()} style={{ flex: 1, padding: '8px 12px', border: '1px dashed #ccc', borderRadius: 20, fontSize: 13, outline: 'none' }} />
                      <button onClick={handleAddTag} style={{ padding: '8px 16px', backgroundColor: GREEN, color: '#fff', border: 'none', borderRadius: 20, fontSize: 13, cursor: 'pointer', fontWeight: 700 }}>追加</button>
                    </div>
                  </div>
                </div>

                <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <h3 style={{ fontSize: 14, color: '#333' }}>AI要約</h3>
                    <button onClick={handleSummarize} disabled={summarizing} style={{ fontSize: 12, padding: '6px 14px', backgroundColor: summarizing ? '#ccc' : '#1565c0', color: '#fff', border: 'none', borderRadius: 8, cursor: summarizing ? 'default' : 'pointer' }}>
                      {summarizing ? '生成中...' : 'AI要約を更新'}
                    </button>
                  </div>
                  {selectedCustomer.aiSummary
                    ? <p style={{ fontSize: 13, color: '#555', lineHeight: 1.7, backgroundColor: '#f8f9fa', padding: 12, borderRadius: 8, margin: 0 }}>{selectedCustomer.aiSummary}</p>
                    : <p style={{ fontSize: 13, color: '#aaa', margin: 0 }}>まだ要約がありません。「AI要約を更新」を押してください。</p>
                  }
                </div>

                <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <h3 style={{ fontSize: 14, color: '#333', marginBottom: 12 }}>メモ</h3>
                  <div style={{ marginBottom: 14 }}>
                    <textarea value={newMemo} onChange={e => setNewMemo(e.target.value)} placeholder="新しいメモを入力...（例：乾燥肌を気にされている、次回はホワイトニングを提案）" style={{ width: '100%', minHeight: 80, padding: 10, border: '1px solid #ddd', borderRadius: 8, fontSize: 14, fontFamily: "'Noto Sans JP', sans-serif", resize: 'vertical', boxSizing: 'border-box', outline: 'none' }} />
                    <button onClick={handleAddMemo} disabled={saving || !newMemo.trim()} style={{ marginTop: 8, width: '100%', padding: '11px', backgroundColor: saving || !newMemo.trim() ? '#ccc' : GREEN, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, cursor: saving || !newMemo.trim() ? 'default' : 'pointer', fontWeight: 700 }}>
                      {saving ? '保存中...' : 'メモを保存'}
                    </button>
                  </div>
                  {(!selectedCustomer.memos || selectedCustomer.memos.length === 0) ? (
                    <p style={{ fontSize: 13, color: '#aaa' }}>メモがありません</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[...selectedCustomer.memos].reverse().map(memo => (
                        <div key={memo.id} style={{ padding: 12, backgroundColor: '#fffde7', borderRadius: 8, borderLeft: '3px solid #f9a825' }}>
                          <p style={{ fontSize: 13, color: '#333', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{memo.text}</p>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                            <span style={{ fontSize: 11, color: '#888' }}>{memo.staffName} ・ {memo.createdAt ? new Date(memo.createdAt).toLocaleString('ja-JP') : ''}</span>
                            <button onClick={() => handleDeleteMemo(memo.id)} style={{ fontSize: 12, color: '#e74c3c', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>削除</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              !isMobile && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', flexDirection: 'column', gap: 10 }}>
                  <span style={{ fontSize: 48 }}>👤</span>
                  <p>左からお客様を選んでください</p>
                </div>
              )
            )
          )}
        </div>
      )}
    </div>
  );
}
