module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, password } = req.body;

  // ログアウト
  if (action === 'logout') {
    res.setHeader('Set-Cookie', 'salon-auth=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
    return res.status(200).json({ success: true });
  }

  // ログイン
  if (action === 'login') {
    const correctPassword = process.env.DASHBOARD_PASSWORD;
    if (!correctPassword) return res.status(500).json({ error: 'Password not configured' });
    if (password !== correctPassword) return res.status(401).json({ error: 'パスワードが違います' });

    res.setHeader(
      'Set-Cookie',
      `salon-auth=authenticated; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax`
    );
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Invalid action' });
};

