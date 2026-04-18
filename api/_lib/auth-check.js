// api/_lib/auth-check.js
// Vercel Serverless Functions 用のシンプルな認証チェック。
// 既存の api/auth.js がセットする salon-auth=authenticated Cookie を検証する。
//
// Next.js proxy(middleware) でもガードしているが、Vercel Functions が
// proxy でカバーされないエッジケースに備え二重化する。

function getSalonAuthCookie(req) {
  const cookieHeader = req.headers?.cookie || '';
  const pair = cookieHeader
    .split(';')
    .map((s) => s.trim())
    .find((c) => c.startsWith('salon-auth='));
  if (!pair) return null;
  return pair.slice('salon-auth='.length);
}

/**
 * 認証チェック。未認証なら 401 を返して false、認証済みなら true を返す。
 * 呼び出し側:
 *   if (!requireAuth(req, res)) return;
 */
function requireAuth(req, res) {
  const token = getSalonAuthCookie(req);
  if (token !== 'authenticated') {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

module.exports = { requireAuth, getSalonAuthCookie };
