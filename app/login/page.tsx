'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const GREEN = '#2d5a27';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push('/dashboard');
      } else {
        const data = await res.json();
        setError(data.error || 'ログインに失敗しました');
      }
    } catch {
      setError('エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f5f5f5',
      fontFamily: "'Noto Sans JP', sans-serif",
      padding: 20,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet" />

      <div style={{ width: '100%', maxWidth: 380 }}>

        {/* ロゴ・タイトル */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            backgroundColor: GREEN, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, margin: '0 auto 16px',
          }}>
            🌿
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#333', marginBottom: 4 }}>
            メナードフェイシャルサロン
          </h1>
          <p style={{ fontSize: 13, color: '#888' }}>若泉１丁目 管理システム</p>
        </div>

        {/* ログインフォーム */}
        <form onSubmit={handleLogin} style={{
          backgroundColor: '#fff',
          borderRadius: 16,
          padding: 28,
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#333', marginBottom: 20, textAlign: 'center' }}>
            ログイン
          </h2>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: '#555', display: 'block', marginBottom: 6, fontWeight: 500 }}>
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="パスワードを入力..."
              autoFocus
              style={{
                width: '100%',
                padding: '12px 14px',
                border: '1px solid #ddd',
                borderRadius: 10,
                fontSize: 15,
                boxSizing: 'border-box',
                outline: 'none',
                fontFamily: "'Noto Sans JP', sans-serif",
                transition: 'border 0.2s',
              }}
              onFocus={e => e.target.style.border = '1px solid ' + GREEN}
              onBlur={e => e.target.style.border = '1px solid #ddd'}
            />
          </div>

          {error && (
            <div style={{
              backgroundColor: '#fff0f0',
              color: '#e74c3c',
              fontSize: 13,
              padding: '10px 14px',
              borderRadius: 8,
              marginBottom: 14,
              border: '1px solid #fdd',
            }}>
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width: '100%',
              padding: '13px',
              backgroundColor: loading || !password ? '#ccc' : GREEN,
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 700,
              cursor: loading || !password ? 'default' : 'pointer',
              fontFamily: "'Noto Sans JP', sans-serif",
              transition: 'background 0.2s',
            }}
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#bbb', marginTop: 20 }}>
          © メナードフェイシャルサロン 若泉１丁目
        </p>
      </div>
    </div>
  );
}

