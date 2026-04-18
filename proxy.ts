import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Next.js 16 で middleware は proxy にリネームされた(deprecation warning 回避)。
// ページルート: /dashboard/* と /login
// API:         /api/* のうち /api/auth と /api/line-webhook/* 以外を保護
export function proxy(request: NextRequest) {
  const token = request.cookies.get('salon-auth')?.value;
  const { pathname } = request.nextUrl;
  const authed = token === 'authenticated';

  // --- 公開 API: 認証不要 ---
  // /api/auth 自体(ログイン・ログアウト)
  // /api/line-webhook/* (LINE Platform が署名で検証するため Cookie 不可)
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/line-webhook')
  ) {
    return NextResponse.next();
  }

  // --- 保護 API: 未認証は 401 JSON ---
  if (pathname.startsWith('/api/')) {
    if (!authed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // --- ログインページ ---
  if (pathname === '/login') {
    if (authed) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // --- ダッシュボード: 未認証はログインへリダイレクト ---
  if (!authed) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/api/:path*'],
};
