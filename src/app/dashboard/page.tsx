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
  tags: string[];
  memos: Memo[];
  visitCount: number;
  firstVisit?: string;
  lastVisit?: string;
  aiSummary?: string;
  profile?: {
    skinType?: string;
    skinConcerns?: string[];
    hasChildren?: boolean;
    birthday?: string;
    phone?: string;
  };
};

type Reservation = {
  id: string;
  lineUserId: string;
  displayName: string;
  date: string;
  time: string;
  course: string;
  memo: string;
};

const GREEN = '#2d5a27';
const LIGHT_GREEN = '#e8f5e9';
const COURSES = ['フェイシャルコース', 'ホワイトニングコース', 'モイスチャーコース', 'スペシャルケアコース', 'クイックケアコース', 'その他'];
const SKIN_TYPES = ['普通肌', '乾燥肌', '脂性肌', '混合肌', '敏感肌'];
const SKIN_CONCERNS = ['シミ・そばかす', 'シワ・たるみ', '毛穴の開き', 'ニキビ', '乾燥・カサつき', 'くすみ', '赤み・敏感'];
const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

export default function UnifiedDashboard() {
  const [activeTab, setActiveTab] = useState<'messages' | 'customers' | 'reservations' | 'stats'>('messages');
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
  const [userFilter, setUserFilter] = useState('all');
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
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ skinType: '', skinConcerns: [] as string[], birthday: '', phone: '' });

  const today = new Date();
  const [calMonth, setCalMonth] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [resLoading, setResLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newRes, setNewRes] = useState({ displayName: '', lineUserId: '', time: '10:00', course: '', memo: '' });
  const [resSaving, setResSaving] = useState(false);

  type StatsData = { months: { key: string; label: string; messages: number; reservations: number }[]; totalCustomers: number };
  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

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
    const iv = setInterval(loadMessages, 5000);
    return () => clearInterval(iv);
  }, [loadMessages]);

  const pendingCount = messages.filter(m => !m.status || m.status === 'pending').length;
  const userList = Array.from(new Map(messages.map(m => [m.lineUserId, m.displayName])).entries()).map(([id, name]) => ({ id, name }));
  const filteredMessages = messages.filter(m => {
    const s = filter === 'all' ? true : filter === 'pending' ? (!m.status || m.status === 'pending') : m.status === 'sent';
    const u = userFilter === 'all' || m.lineUserId === userFilter;
    return s && u;
  });

  const handleSend = async (msg: Message, replyText?: string) => {
    setSending(msg.id);
    try {
      const res = await fetch('/api/send-reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messageId: msg.id, lineUserId: msg.lineUserId, replyText: replyText || msg.aiReply }) });
      if (res.ok) { setEditingId(null); await loadMessages(); }
    } catch (e) { console.error(e); }
    finally { setSending(null); }
  };

  const handleDelete = async (msgId: string) => {
    if (!confirm('この返信案を削除しますか？')) return;
    try {
      const res = await fetch('/api/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'message', messageId: msgId }) });
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

  const filteredCustomers = customers.filter(c => c.displayName?.includes(search) || c.tags?.some(t => t.includes(search)));

  const handleAddMemo = async () => {
    if (!newMemo.trim() || !selectedCustomer) return;
    setSaving(true);
    const id = selectedCustomer.lineUserId;
    try {
      const res = await fetch('/api/customer-memo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lineUserId: id, action: 'add', text: newMemo.trim(), staffName: '白石' }) });
      if (res.ok) { setNewMemo(''); await refreshSelected(id); }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDeleteMemo = async (memoId: string) => {
    if (!selectedCustomer) return;
    const id = selectedCustomer.lineUserId;
    try {
      await fetch('/api/customer-memo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lineUserId: id, action: 'delete', memoId }) });
      await refreshSelected(id);
    } catch (e) { console.error(e); }
  };

  const handleAddTag = async () => {
    if (!newTag.trim() || !selectedCustomer) return;
    const id = selectedCustomer.lineUserId;
    const tag = newTag.trim();
    try {
      const res = await fetch('/api/customer-tag', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lineUserId: id, action: 'add', tag }) });
      if (res.ok) { setNewTag(''); await refreshSelected(id); }
    } catch (e) { console.error(e); }
  };

  const handleRemoveTag = async (tag: string) => {
    if (!selectedCustomer) return;
    const id = selectedCustomer.lineUserId;
    try {
      const res = await fetch('/api/customer-tag', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lineUserId: id, action: 'remove', tag }) });
      if (res.ok) await refreshSelected(id);
    } catch (e) { console.error(e); }
  };

  const handleSummarize = async () => {
    if (!selectedCustomer) return;
    setSummarizing(true);
    const id = selectedCustomer.lineUserId;
    try {
      await fetch('/api/customer-summarize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lineUserId: id }) });
      await refreshSelected(id);
    } catch (e) { console.error(e); }
    finally { setSummarizing(false); }
  };

  useEffect(() => {
    if (selectedCustomer) {
      setProfileForm({
        skinType: selectedCustomer.profile?.skinType || '',
        skinConcerns: selectedCustomer.profile?.skinConcerns || [],
        birthday: selectedCustomer.profile?.birthday || '',
        phone: selectedCustomer.profile?.phone || '',
      });
      setEditingProfile(false);
    }
  }, [selectedCustomer?.lineUserId]);

  const handleUpdateProfile = async () => {
    if (!selectedCustomer) return;
    const id = selectedCustomer.lineUserId;
    try {
      await fetch('/api/customer-memo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lineUserId: id, action: 'profile', ...profileForm }) });
      setEditingProfile(false);
      await refreshSelected(id);
    } catch (e) { console.error(e); }
  };

  const loadReservations = useCallback(async (month: string) => {
    setResLoading(true);
    try {
      const res = await fetch('/api/get-reservations?month=' + month);
      const data = await res.json();
      if (data.reservations) setReservations(data.reservations);
    } catch (e) { console.error(e); }
    finally { setResLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === 'reservations') loadReservations(calMonth);
  }, [activeTab, calMonth, loadReservations]);

  const handleSaveReservation = async () => {
    if (!newRes.displayName || !selectedDate) return;
    setResSaving(true);
    try {
      const res = await fetch('/api/save-reservation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newRes, date: selectedDate }) });
      if (res.ok) {
        setShowForm(false);
        setNewRes({ displayName: '', lineUserId: '', time: '10:00', course: '', memo: '' });
        await loadReservations(calMonth);
      }
    } catch (e) { console.error(e); }
    finally { setResSaving(false); }
  };

  const handleDeleteReservation = async (id: string) => {
    if (!confirm('この予約を削除しますか？')) return;
    try {
      const res = await fetch('/api/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'reservation', id }) });
      if (res.ok) await loadReservations(calMonth);
    } catch (e) { console.error(e); }
  };

  const buildCalendar = (month: string) => {
    const [y, m] = month.split('-').map(Number);
    const firstDay = new Date(y, m - 1, 1).getDay();
    const daysInMonth = new Date(y, m, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  };

  const calCells = buildCalendar(calMonth);
  const [calYear, calMonthNum] = calMonth.split('-').map(Number);
  const resOnDate = (date: string) => reservations.filter(r => r.date === date);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch('/api/get-stats');
      const data = await res.json();
      if (data.months) setStats(data);
    } catch (e) { console.error(e); }
    finally { setStatsLoading(false); }
  }, []);

  useEffect(() => { if (activeTab === 'stats') loadStats(); }, [activeTab, loadStats]);

  const prevMonth = () => { const d = new Date(calYear, calMonthNum - 2, 1); setCalMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); setSelectedDate(null); };
  const nextMonth = () => { const d = new Date(calYear, calMonthNum, 1); setCalMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); setSelectedDate(null); };

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('ja-JP') : '-';
  const showCustomerList = !isMobile || !selectedCustomer;
  const showCustomerDetail = !isMobile || !!selectedCustomer;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', fontFamily: "'Noto Sans JP', sans-serif", backgroundColor: '#f5f5f5' }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet" />

      <div style={{ backgroundColor: GREEN, color: '#fff', padding: isMobile ? '10px 12px' : '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: isMobile ? 12 : 16, fontWeight: 700 }}>{isMobile ? 'メナードサロン 若泉' : 'メナードフェイシャルサロン 若泉１丁目'}</div>
          <div style={{ fontSize: 10, opacity: 0.8 }}>AI返信管理システム</div>
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          {([
            { key: 'messages', icon: '💬', label: isMobile ? '返信' : '返信管理' },
            { key: 'reservations', icon: '📅', label: isMobile ? '予約' : '予約管理' },
            { key: 'customers', icon: '👤', label: isMobile ? '顧客' : '顧客管理' },
            { key: 'stats', icon: '📊', label: isMobile ? '統計' : '統計' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => { setActiveTab(t.key); setSelectedCustomer(null); }}
              style={{ padding: isMobile ? '6px 10px' : '8px 16px', borderRadius: 20, border: 'none', fontSize: isMobile ? 11 : 13, fontWeight: activeTab === t.key ? 700 : 400, backgroundColor: activeTab === t.key ? '#fff' : 'transparent', color: activeTab === t.key ? GREEN : 'rgba(255,255,255,0.85)', cursor: 'pointer', position: 'relative' }}>
              {t.icon} {t.label}
              {t.key === 'messages' && pendingCount > 0 && (
                <span style={{ position: 'absolute', top: 2, right: 2, backgroundColor: '#e74c3c', color: '#fff', borderRadius: '50%', width: 15, height: 15, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
                  <button
            onClick={async () => {
              await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
              window.location.href = '/login';
            }}
            style={{
              padding: isMobile ? '6px 8px' : '6px 12px',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.4)',
              backgroundColor: 'transparent',
              color: 'rgba(255,255,255,0.8)',
              fontSize: isMobile ? 10 : 12,
              cursor: 'pointer',
              marginLeft: 4,
            }}
          >
            {isMobile ? '出る' : 'ログアウト'}
          </button>

      </div>

      {activeTab === 'messages' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 12 : 24 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {[{ key: 'pending' as const, label: '未送信', color: '#e74c3c' }, { key: 'sent' as const, label: '送信済み', color: '#27ae60' }, { key: 'all' as const, label: 'すべて', color: '#666' }].map(f => (
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
                <button key={u.id} onClick={() => setUserFilter(u.id)} style={{ padding: '4px 12px', border: 'none', borderRadius: 16, fontSize: 12, backgroundColor: userFilter === u.id ? GREEN : '#fff', color: userFilter === u.id ? '#fff' : '#555', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', fontWeight: userFilter === u.id ? 700 : 400 }}>{u.name}</button>
              ))}
            </div>
          )}
          {msgLoading ? <p style={{ textAlign: 'center', color: '#888', padding: 40 }}>読み込み中...</p>
            : filteredMessages.length === 0 ? (
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
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, backgroundColor: msg.status === 'sent' ? '#d4edda' : '#fff3cd', color: msg.status === 'sent' ? '#155724' : '#856404' }}>{msg.status === 'sent' ? '送信済み' : '未送信'}</span>
                      </div>
                      <span style={{ fontSize: 11, color: '#999' }}>{msg.createdAt ? new Date(msg.createdAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    </div>
                    <div style={{ backgroundColor: LIGHT_GREEN, borderRadius: 10, padding: isMobile ? 10 : 12, marginBottom: 8, fontSize: isMobile ? 13 : 14 }}>
                      <div style={{ fontSize: 10, color: '#666', marginBottom: 3 }}>お客様</div>{msg.customerMessage}
                    </div>
                    <div style={{ backgroundColor: msg.status === 'sent' ? '#e3f2fd' : '#fff8e1', borderRadius: 10, padding: isMobile ? 10 : 12, marginBottom: 10, fontSize: isMobile ? 13 : 14 }}>
                      <div style={{ fontSize: 10, color: '#666', marginBottom: 3 }}>{msg.status === 'sent' ? '送信した返信' : 'AI返信案'}</div>{msg.sentReply || msg.aiReply}
                    </div>
                    {editingId === msg.id && (
                      <div style={{ marginBottom: 10 }}>
                        <textarea value={editText} onChange={e => setEditText(e.target.value)} style={{ width: '100%', minHeight: 110, padding: 10, borderRadius: 8, border: '1px solid #ccc', fontSize: 14, fontFamily: "'Noto Sans JP', sans-serif", resize: 'vertical', boxSizing: 'border-box' }} />
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button onClick={() => handleSend(msg, editText)} disabled={sending === msg.id} style={{ flex: 1, padding: '10px', backgroundColor: GREEN, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontWeight: 700 }}>{sending === msg.id ? '送信中...' : 'この内容で送信'}</button>
                          <button onClick={() => { setEditingId(null); setEditText(''); }} style={{ padding: '10px 16px', backgroundColor: '#eee', color: '#666', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>戻る</button>
                        </div>
                      </div>
                    )}
                    {msg.status !== 'sent' && editingId !== msg.id && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                        <button onClick={() => handleSend(msg)} disabled={sending === msg.id} style={{ flex: 1, padding: '10px', backgroundColor: GREEN, color: '#fff', border: 'none', borderRadius: 8, fontSize: isMobile ? 14 : 13, cursor: 'pointer', fontWeight: 700 }}>{sending === msg.id ? '送信中...' : 'このまま送信'}</button>
                        <button onClick={() => { setEditingId(msg.id); setEditText(msg.aiReply); }} style={{ flex: 1, padding: '10px', backgroundColor: '#fff', color: GREEN, border: '1px solid ' + GREEN, borderRadius: 8, fontSize: isMobile ? 14 : 13, cursor: 'pointer' }}>修正する</button>
                        <button onClick={() => handleDelete(msg.id)} style={{ padding: '10px 14px', backgroundColor: '#fff', color: '#e74c3c', border: '1px solid #e74c3c', borderRadius: 8, fontSize: isMobile ? 14 : 13, cursor: 'pointer' }}>削除</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {activeTab === 'reservations' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', overflow: 'hidden' }}>
          <div style={{ flex: isMobile ? 'none' : 1, overflowY: 'auto', padding: isMobile ? 12 : 24, maxWidth: isMobile ? '100%' : 560 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <button onClick={prevMonth} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', backgroundColor: '#fff', fontSize: 18, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>‹</button>
              <h2 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700, color: '#333' }}>{calYear}年{calMonthNum}月</h2>
              <button onClick={nextMonth} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', backgroundColor: '#fff', fontSize: 18, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>›</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 3 }}>
              {WEEK.map((w, i) => (
                <div key={w} style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: i === 0 ? '#e74c3c' : i === 6 ? '#1565c0' : '#666', padding: '4px 0' }}>{w}</div>
              ))}
            </div>
            {resLoading ? <p style={{ textAlign: 'center', color: '#888', padding: 40 }}>読み込み中...</p> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                {calCells.map((day, idx) => {
                  if (!day) return <div key={idx} />;
                  const dateStr = `${calMonth}-${String(day).padStart(2, '0')}`;
                  const dayRes = resOnDate(dateStr);
                  const isToday = dateStr === todayStr;
                  const isSelected = dateStr === selectedDate;
                  const dow = idx % 7;
                  return (
                    <div key={idx} onClick={() => { setSelectedDate(dateStr); setShowForm(false); }}
                      style={{ minHeight: isMobile ? 52 : 70, backgroundColor: isSelected ? GREEN : isToday ? LIGHT_GREEN : '#fff', borderRadius: 8, padding: '6px 4px', cursor: 'pointer', border: isToday && !isSelected ? '2px solid ' + GREEN : '1px solid #e8e8e8', boxShadow: isSelected ? '0 2px 6px rgba(45,90,39,0.3)' : '0 1px 2px rgba(0,0,0,0.05)', transition: 'all 0.1s' }}>
                      <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: isToday || isSelected ? 700 : 400, color: isSelected ? '#fff' : dow === 0 ? '#e74c3c' : dow === 6 ? '#1565c0' : '#333', textAlign: 'center', marginBottom: 3 }}>{day}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {dayRes.slice(0, isMobile ? 2 : 3).map(r => (
                          <div key={r.id} style={{ fontSize: 9, backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : '#e8f5e9', color: isSelected ? '#fff' : GREEN, borderRadius: 3, padding: '1px 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.time && r.time + ' '}{r.displayName}
                          </div>
                        ))}
                        {dayRes.length > (isMobile ? 2 : 3) && <div style={{ fontSize: 9, color: isSelected ? 'rgba(255,255,255,0.7)' : '#888', textAlign: 'center' }}>+{dayRes.length - (isMobile ? 2 : 3)}件</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ marginTop: 14, padding: '10px 16px', backgroundColor: '#fff', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#666' }}>今月の予約合計</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: GREEN }}>{reservations.length}件</span>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 12 : 24, borderLeft: isMobile ? 'none' : '1px solid #e0e0e0', borderTop: isMobile ? '1px solid #e0e0e0' : 'none' }}>
            {!selectedDate ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#aaa', gap: 10, paddingTop: isMobile ? 20 : 0 }}>
                <span style={{ fontSize: 40 }}>📅</span>
                <p style={{ fontSize: 14 }}>日付をタップして予約を確認</p>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#333' }}>
                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}
                  </h3>
                  <button onClick={() => setShowForm(true)} style={{ padding: '8px 16px', backgroundColor: GREEN, color: '#fff', border: 'none', borderRadius: 20, fontSize: 13, cursor: 'pointer', fontWeight: 700 }}>＋ 予約追加</button>
                </div>

                {showForm && (
                  <div style={{ backgroundColor: '#f0f7f0', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid #c8e6c9' }}>
                    <h4 style={{ fontSize: 14, color: GREEN, marginBottom: 12 }}>新しい予約</h4>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>お客様名 *</label>
                      <select value={newRes.lineUserId} onChange={e => { const c = customers.find(c => c.lineUserId === e.target.value); setNewRes(prev => ({ ...prev, lineUserId: e.target.value, displayName: c?.displayName || '' })); }}
                        style={{ width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, marginBottom: 6, backgroundColor: '#fff', outline: 'none' }}>
                        <option value="">-- 顧客リストから選択 --</option>
                        {customers.map(c => <option key={c.lineUserId} value={c.lineUserId}>{c.displayName}</option>)}
                      </select>
                      <input type="text" placeholder="または名前を直接入力" value={newRes.displayName} onChange={e => setNewRes(prev => ({ ...prev, displayName: e.target.value, lineUserId: '' }))}
                        style={{ width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>時間</label>
                      <input type="time" value={newRes.time} onChange={e => setNewRes(prev => ({ ...prev, time: e.target.value }))} style={{ padding: '9px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, outline: 'none' }} />
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>コース</label>
                      <select value={newRes.course} onChange={e => setNewRes(prev => ({ ...prev, course: e.target.value }))} style={{ width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, backgroundColor: '#fff', outline: 'none' }}>
                        <option value="">-- 選択してください --</option>
                        {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>メモ</label>
                      <textarea value={newRes.memo} onChange={e => setNewRes(prev => ({ ...prev, memo: e.target.value }))} placeholder="備考など..."
                        style={{ width: '100%', minHeight: 60, padding: 10, border: '1px solid #ddd', borderRadius: 8, fontSize: 13, fontFamily: "'Noto Sans JP', sans-serif", resize: 'vertical', boxSizing: 'border-box', outline: 'none' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={handleSaveReservation} disabled={resSaving || !newRes.displayName} style={{ flex: 1, padding: '11px', backgroundColor: resSaving || !newRes.displayName ? '#ccc' : GREEN, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, cursor: resSaving || !newRes.displayName ? 'default' : 'pointer', fontWeight: 700 }}>{resSaving ? '保存中...' : '予約を保存'}</button>
                      <button onClick={() => { setShowForm(false); setNewRes({ displayName: '', lineUserId: '', time: '10:00', course: '', memo: '' }); }} style={{ padding: '11px 18px', backgroundColor: '#eee', color: '#666', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>キャンセル</button>
                    </div>
                  </div>
                )}

                {resOnDate(selectedDate).length === 0 && !showForm ? (
                  <div style={{ textAlign: 'center', padding: 30, color: '#aaa' }}><p style={{ fontSize: 13 }}>この日の予約はありません</p></div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {resOnDate(selectedDate).map(r => (
                      <div key={r.id} style={{ backgroundColor: '#fff', borderRadius: 10, padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderLeft: '4px solid ' + GREEN }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                              <span style={{ fontSize: 15, fontWeight: 700, color: '#333' }}>{r.displayName}</span>
                              {r.time && <span style={{ fontSize: 13, color: '#fff', backgroundColor: GREEN, borderRadius: 10, padding: '2px 10px' }}>{r.time}</span>}
                            </div>
                            {r.course && <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>📋 {r.course}</div>}
                            {r.memo && <div style={{ fontSize: 12, color: '#888', backgroundColor: '#f9f9f9', padding: '6px 10px', borderRadius: 6 }}>{r.memo}</div>}
                          </div>
                          <button onClick={() => handleDeleteReservation(r.id)} style={{ fontSize: 12, color: '#e74c3c', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', flexShrink: 0 }}>削除</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
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
                {custLoading ? <p style={{ textAlign: 'center', color: '#888', padding: 20 }}>読み込み中...</p>
                  : filteredCustomers.length === 0 ? <p style={{ textAlign: 'center', color: '#aaa', padding: 20 }}>お客様がいません</p>
                  : filteredCustomers.map(customer => (
                    <div key={customer.lineUserId} onClick={() => setSelectedCustomer(customer)} style={{ padding: '14px 16px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', backgroundColor: selectedCustomer?.lineUserId === customer.lineUserId ? LIGHT_GREEN : '#fff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: GREEN, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, flexShrink: 0 }}>{customer.displayName?.[0] || '?'}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 500, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{customer.displayName || '不明'}</div>
                          <div style={{ fontSize: 12, color: '#888' }}>来店 {customer.visitCount || 0}回 ・ {formatDate(customer.lastVisit)}</div>
                        </div>
                        {isMobile && <span style={{ color: '#ccc', fontSize: 18 }}>›</span>}
                      </div>
                      {customer.tags?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingLeft: 52 }}>
                          {customer.tags.slice(0, 4).map(tag => <span key={tag} style={{ fontSize: 11, padding: '2px 8px', backgroundColor: LIGHT_GREEN, color: GREEN, borderRadius: 10 }}>{tag}</span>)}
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
                {isMobile && <button onClick={() => setSelectedCustomer(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, background: 'none', border: 'none', color: GREEN, fontSize: 15, cursor: 'pointer', fontWeight: 700, padding: 0 }}>‹ お客様一覧に戻る</button>}
                <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', backgroundColor: GREEN, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, flexShrink: 0 }}>{selectedCustomer.displayName?.[0] || '?'}</div>
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
                {/* 肌カルテ */}
                <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <h3 style={{ fontSize: 14, color: '#333' }}>🌸 肌カルテ</h3>
                    <button onClick={() => setEditingProfile(!editingProfile)} style={{ fontSize: 12, padding: '5px 12px', backgroundColor: editingProfile ? '#eee' : LIGHT_GREEN, color: editingProfile ? '#666' : GREEN, border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>{editingProfile ? 'キャンセル' : '編集'}</button>
                  </div>
                  {editingProfile ? (
                    <div>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: 600 }}>肌タイプ</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {SKIN_TYPES.map(t => (
                            <button key={t} onClick={() => setProfileForm(p => ({ ...p, skinType: p.skinType === t ? '' : t }))}
                              style={{ padding: '6px 14px', border: 'none', borderRadius: 20, fontSize: 12, cursor: 'pointer', backgroundColor: profileForm.skinType === t ? '#e65100' : '#f5f5f5', color: profileForm.skinType === t ? '#fff' : '#555', fontWeight: profileForm.skinType === t ? 700 : 400 }}>{t}</button>
                          ))}
                        </div>
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: 600 }}>肌悩み（複数選択可）</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {SKIN_CONCERNS.map(c => {
                            const checked = profileForm.skinConcerns.includes(c);
                            return <button key={c} onClick={() => setProfileForm(p => ({ ...p, skinConcerns: checked ? p.skinConcerns.filter(x => x !== c) : [...p.skinConcerns, c] }))}
                              style={{ padding: '6px 14px', border: 'none', borderRadius: 20, fontSize: 12, cursor: 'pointer', backgroundColor: checked ? '#c62828' : '#f5f5f5', color: checked ? '#fff' : '#555', fontWeight: checked ? 700 : 400 }}>{c}</button>;
                          })}
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 12, color: '#666', marginBottom: 4, fontWeight: 600 }}>誕生日</div>
                          <input type="date" value={profileForm.birthday} onChange={e => setProfileForm(p => ({ ...p, birthday: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: '#666', marginBottom: 4, fontWeight: 600 }}>電話番号</div>
                          <input type="tel" value={profileForm.phone} onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))} placeholder="090-xxxx-xxxx" style={{ width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                      </div>
                      <button onClick={handleUpdateProfile} style={{ width: '100%', padding: '10px', backgroundColor: GREEN, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>保存する</button>
                    </div>
                  ) : (
                    <div>
                      {!selectedCustomer.profile?.skinType && !selectedCustomer.profile?.skinConcerns?.length && !selectedCustomer.profile?.birthday && !selectedCustomer.profile?.phone ? (
                        <p style={{ fontSize: 13, color: '#aaa' }}>「編集」から肌カルテを入力してください</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {selectedCustomer.profile?.skinType && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={{ fontSize: 12, color: '#888', width: 60 }}>肌タイプ</span><span style={{ fontSize: 13, padding: '3px 12px', backgroundColor: '#fff3e0', color: '#e65100', borderRadius: 12 }}>{selectedCustomer.profile.skinType}</span></div>}
                          {selectedCustomer.profile?.skinConcerns?.length ? <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}><span style={{ fontSize: 12, color: '#888', width: 60, marginTop: 3 }}>肌悩み</span><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{selectedCustomer.profile.skinConcerns.map(c => <span key={c} style={{ fontSize: 12, padding: '3px 10px', backgroundColor: '#fce4ec', color: '#c62828', borderRadius: 12 }}>{c}</span>)}</div></div> : null}
                          {selectedCustomer.profile?.birthday && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={{ fontSize: 12, color: '#888', width: 60 }}>誕生日</span><span style={{ fontSize: 13, color: '#333' }}>🎂 {selectedCustomer.profile.birthday}</span></div>}
                          {selectedCustomer.profile?.phone && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={{ fontSize: 12, color: '#888', width: 60 }}>電話</span><span style={{ fontSize: 13, color: '#333' }}>📞 {selectedCustomer.profile.phone}</span></div>}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <h3 style={{ fontSize: 14, color: '#333' }}>AI要約</h3>
                    <button onClick={handleSummarize} disabled={summarizing} style={{ fontSize: 12, padding: '6px 14px', backgroundColor: summarizing ? '#ccc' : '#1565c0', color: '#fff', border: 'none', borderRadius: 8, cursor: summarizing ? 'default' : 'pointer' }}>{summarizing ? '生成中...' : 'AI要約を更新'}</button>
                  </div>
                  {selectedCustomer.aiSummary ? <p style={{ fontSize: 13, color: '#555', lineHeight: 1.7, backgroundColor: '#f8f9fa', padding: 12, borderRadius: 8, margin: 0 }}>{selectedCustomer.aiSummary}</p> : <p style={{ fontSize: 13, color: '#aaa', margin: 0 }}>まだ要約がありません。「AI要約を更新」を押してください。</p>}
                </div>
                <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <h3 style={{ fontSize: 14, color: '#333', marginBottom: 12 }}>メモ</h3>
                  <div style={{ marginBottom: 14 }}>
                    <textarea value={newMemo} onChange={e => setNewMemo(e.target.value)} placeholder="新しいメモを入力..." style={{ width: '100%', minHeight: 80, padding: 10, border: '1px solid #ddd', borderRadius: 8, fontSize: 14, fontFamily: "'Noto Sans JP', sans-serif", resize: 'vertical', boxSizing: 'border-box', outline: 'none' }} />
                    <button onClick={handleAddMemo} disabled={saving || !newMemo.trim()} style={{ marginTop: 8, width: '100%', padding: '11px', backgroundColor: saving || !newMemo.trim() ? '#ccc' : GREEN, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, cursor: saving || !newMemo.trim() ? 'default' : 'pointer', fontWeight: 700 }}>{saving ? '保存中...' : 'メモを保存'}</button>
                  </div>
                  {(!selectedCustomer.memos || selectedCustomer.memos.length === 0) ? <p style={{ fontSize: 13, color: '#aaa' }}>メモがありません</p> : (
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
              !isMobile && <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', flexDirection: 'column', gap: 10 }}><span style={{ fontSize: 48 }}>👤</span><p>左からお客様を選んでください</p></div>
            )
          )}
        </div>
      )}
      {activeTab === 'stats' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 12 : 24 }}>
          {statsLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>読み込み中...</div>
          ) : stats ? (
            <>
              {/* サマリーカード */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                {[
                  { label: '今月のメッセージ', value: stats.months[stats.months.length - 1]?.messages ?? 0, color: GREEN },
                  { label: '顧客数合計', value: stats.totalCustomers, color: '#1565c0' },
                  { label: '今月の予約', value: stats.months[stats.months.length - 1]?.reservations ?? 0, color: '#e67e22' },
                ].map((card, i) => (
                  <div key={i} style={{ backgroundColor: '#fff', borderRadius: 12, padding: isMobile ? '14px 10px' : 20, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                    <div style={{ fontSize: isMobile ? 24 : 32, fontWeight: 700, color: card.color }}>{card.value}</div>
                    <div style={{ fontSize: isMobile ? 10 : 12, color: '#888', marginTop: 4 }}>{card.label}</div>
                  </div>
                ))}
              </div>

              {/* メッセージ棒グラフ */}
              <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: isMobile ? 14 : 20, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                <h3 style={{ fontSize: 14, color: '#333', marginBottom: 16, margin: '0 0 16px' }}>💬 月別メッセージ数</h3>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 130, paddingTop: 20 }}>
                  {stats.months.map((m, i) => {
                    const max = Math.max(...stats.months.map(x => x.messages), 1);
                    const h = Math.max((m.messages / max) * 100, m.messages > 0 ? 4 : 0);
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#555' }}>{m.messages}</div>
                        <div style={{ width: '100%', height: `${h}%`, backgroundColor: GREEN, borderRadius: '4px 4px 0 0', opacity: m.messages === 0 ? 0.2 : 1, minHeight: m.messages > 0 ? 4 : 0 }} />
                        <div style={{ fontSize: 10, color: '#888' }}>{m.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 予約棒グラフ */}
              <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: isMobile ? 14 : 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                <h3 style={{ fontSize: 14, color: '#333', margin: '0 0 16px' }}>📅 月別予約数</h3>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 130, paddingTop: 20 }}>
                  {stats.months.map((m, i) => {
                    const max = Math.max(...stats.months.map(x => x.reservations), 1);
                    const h = Math.max((m.reservations / max) * 100, m.reservations > 0 ? 4 : 0);
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#555' }}>{m.reservations}</div>
                        <div style={{ width: '100%', height: `${h}%`, backgroundColor: '#e67e22', borderRadius: '4px 4px 0 0', opacity: m.reservations === 0 ? 0.2 : 1, minHeight: m.reservations > 0 ? 4 : 0 }} />
                        <div style={{ fontSize: 10, color: '#888' }}>{m.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>データがありません</div>
          )}
        </div>
      )}
    </div>
  );
}
