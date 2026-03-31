'use client';

import { useState, useEffect, useCallback } from 'react';

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

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newMemo, setNewMemo] = useState('');
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [summarizing, setSummarizing] = useState(false);

  const loadCustomers = useCallback(async (): Promise<Customer[]> => {
    try {
      const res = await fetch('/api/get-customers');
      const data = await res.json();
      if (data.customers) {
        setCustomers(data.customers);
        return data.customers;
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
    return [];
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const filteredCustomers = customers.filter(c =>
    c.displayName?.includes(search) ||
    c.tags?.some(t => t.includes(search))
  );

  // loadCustomers後に選択中の顧客を最新データで更新するヘルパー
  const refreshSelected = async (currentId: string) => {
    const latest = await loadCustomers();
    const updated = latest.find(c => c.lineUserId === currentId);
    if (updated) setSelectedCustomer(updated);
  };

  const handleAddMemo = async () => {
    if (!newMemo.trim() || !selectedCustomer) return;
    setSaving(true);
    const id = selectedCustomer.lineUserId;
    try {
      const res = await fetch('/api/customer-memo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineUserId: id,
          action: 'add',
          text: newMemo.trim(),
          staffName: '白石',
        }),
      });
      if (res.ok) {
        setNewMemo('');
        await refreshSelected(id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
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
    } catch (e) {
      console.error(e);
    }
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
      if (res.ok) {
        setNewTag('');
        await refreshSelected(id);
      }
    } catch (e) {
      console.error(e);
    }
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
    } catch (e) {
      console.error(e);
    }
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
    } catch (e) {
      console.error(e);
    } finally {
      setSummarizing(false);
    }
  };


  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ja-JP');
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: "'Noto Sans JP', sans-serif", backgroundColor: '#f5f5f5' }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet" />

      {/* 左：顧客一覧 */}
      <div style={{ width: 320, backgroundColor: '#fff', borderRight: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #e0e0e0' }}>
          <h2 style={{ fontSize: 18, color: '#2d5a27', marginBottom: 12 }}>お客様一覧</h2>
          <input
            type="text"
            placeholder="名前・タグで検索..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: 8,
              fontSize: 13,
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: '#888', padding: 20 }}>読み込み中...</p>
          ) : filteredCustomers.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#aaa', padding: 20 }}>お客様がいません</p>
          ) : (
            filteredCustomers.map(customer => (
              <div
                key={customer.lineUserId}
                onClick={() => setSelectedCustomer(customer)}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #f0f0f0',
                  cursor: 'pointer',
                  backgroundColor: selectedCustomer?.lineUserId === customer.lineUserId ? '#e8f5e9' : '#fff',
                  transition: 'background 0.1s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    backgroundColor: '#2d5a27',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    {customer.displayName?.[0] || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {customer.displayName || '不明'}
                    </div>
                    <div style={{ fontSize: 11, color: '#888' }}>
                      来店 {customer.visitCount || 0}回 ・ 最終 {formatDate(customer.lastVisit)}
                    </div>
                  </div>
                </div>
                {customer.tags?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                    {customer.tags.slice(0, 3).map(tag => (
                      <span key={tag} style={{
                        fontSize: 10,
                        padding: '2px 6px',
                        backgroundColor: '#e8f5e9',
                        color: '#2d5a27',
                        borderRadius: 10,
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 右：顧客詳細 */}
      {selectedCustomer ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

          {/* ヘッダー */}
          <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <div style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                backgroundColor: '#2d5a27',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                fontWeight: 700,
              }}>
                {selectedCustomer.displayName?.[0] || '?'}
              </div>
              <div>
                <h2 style={{ fontSize: 20, color: '#333', marginBottom: 4 }}>{selectedCustomer.displayName}</h2>
                <div style={{ fontSize: 13, color: '#888' }}>
                  初来店：{formatDate(selectedCustomer.firstVisit)} ／
                  最終来店：{formatDate(selectedCustomer.lastVisit)} ／
                  来店回数：{selectedCustomer.visitCount || 0}回
                </div>
              </div>
            </div>

            {/* プロフィール情報 */}
            {selectedCustomer.profile && Object.keys(selectedCustomer.profile).length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {selectedCustomer.profile.skinType && (
                  <span style={{ fontSize: 12, padding: '3px 10px', backgroundColor: '#fff3e0', color: '#e65100', borderRadius: 12 }}>
                    肌：{selectedCustomer.profile.skinType}
                  </span>
                )}
                {selectedCustomer.profile.skinConcerns?.map(c => (
                  <span key={c} style={{ fontSize: 12, padding: '3px 10px', backgroundColor: '#fce4ec', color: '#c62828', borderRadius: 12 }}>
                    {c}
                  </span>
                ))}
                {selectedCustomer.profile.hasChildren && (
                  <span style={{ fontSize: 12, padding: '3px 10px', backgroundColor: '#e3f2fd', color: '#1565c0', borderRadius: 12 }}>
                    お子様あり
                  </span>
                )}
              </div>
            )}

            {/* タグ */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {selectedCustomer.tags?.map(tag => (
                <span
                  key={tag}
                  style={{
                    fontSize: 12,
                    padding: '3px 10px',
                    backgroundColor: '#e8f5e9',
                    color: '#2d5a27',
                    borderRadius: 12,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {tag}
                  <span onClick={() => handleRemoveTag(tag)} style={{ color: '#999', fontWeight: 700 }}>×</span>
                </span>
              ))}
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  type="text"
                  placeholder="タグを追加..."
                  value={newTag}
                  onChange={e => setNewTag(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                  style={{
                    padding: '3px 8px',
                    border: '1px dashed #ccc',
                    borderRadius: 12,
                    fontSize: 12,
                    outline: 'none',
                    width: 100,
                  }}
                />
                <button
                  onClick={handleAddTag}
                  style={{ fontSize: 11, padding: '3px 8px', backgroundColor: '#2d5a27', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer' }}
                >
                  追加
                </button>
              </div>
            </div>
          </div>

          {/* AI要約 */}
          <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ fontSize: 15, color: '#333' }}>AI要約</h3>
              <button
                onClick={handleSummarize}
                disabled={summarizing}
                style={{
                  fontSize: 12,
                  padding: '5px 12px',
                  backgroundColor: summarizing ? '#ccc' : '#1565c0',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: summarizing ? 'default' : 'pointer',
                }}
              >
                {summarizing ? '生成中...' : 'AI要約を更新'}
              </button>
            </div>
            {selectedCustomer.aiSummary ? (
              <p style={{ fontSize: 13, color: '#555', lineHeight: 1.7, backgroundColor: '#f8f9fa', padding: 12, borderRadius: 8 }}>
                {selectedCustomer.aiSummary}
              </p>
            ) : (
              <p style={{ fontSize: 13, color: '#aaa' }}>まだ要約がありません。「AI要約を更新」を押してください。</p>
            )}
          </div>

          {/* メモ */}
          <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <h3 style={{ fontSize: 15, color: '#333', marginBottom: 12 }}>メモ</h3>

            {/* メモ追加 */}
            <div style={{ marginBottom: 16 }}>
              <textarea
                value={newMemo}
                onChange={e => setNewMemo(e.target.value)}
                placeholder="新しいメモを入力...（例：乾燥肌を気にされている、次回はホワイトニングコースを提案）"
                style={{
                  width: '100%',
                  minHeight: 80,
                  padding: 10,
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  fontSize: 13,
                  fontFamily: "'Noto Sans JP', sans-serif",
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
              <button
                onClick={handleAddMemo}
                disabled={saving || !newMemo.trim()}
                style={{
                  marginTop: 8,
                  padding: '8px 20px',
                  backgroundColor: saving || !newMemo.trim() ? '#ccc' : '#2d5a27',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  cursor: saving || !newMemo.trim() ? 'default' : 'pointer',
                }}
              >
                {saving ? '保存中...' : 'メモを保存'}
              </button>
            </div>

            {/* メモ一覧 */}
            {(!selectedCustomer.memos || selectedCustomer.memos.length === 0) ? (
              <p style={{ fontSize: 13, color: '#aaa' }}>メモがありません</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[...selectedCustomer.memos].reverse().map(memo => (
                  <div key={memo.id} style={{
                    padding: 12,
                    backgroundColor: '#fffde7',
                    borderRadius: 8,
                    borderLeft: '3px solid #f9a825',
                    position: 'relative',
                  }}>
                    <p style={{ fontSize: 13, color: '#333', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                      {memo.text}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                      <span style={{ fontSize: 11, color: '#888' }}>
                        {memo.staffName} ・ {memo.createdAt ? new Date(memo.createdAt).toLocaleString('ja-JP') : ''}
                      </span>
                      <button
                        onClick={() => handleDeleteMemo(memo.id)}
                        style={{ fontSize: 11, color: '#e74c3c', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        削除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 48 }}>👤</span>
          <p>左からお客様を選んでください</p>
        </div>
      )}
    </div>
  );
}
