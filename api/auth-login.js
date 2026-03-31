module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { password } = req.body;
  const correct = process.env.DASHBOARD_PASSWORD || 'menard2024';

  if (password === correct) {
    res.setHeader('Set-Cookie',
      'salon-auth=authenticated; HttpOnly; Path=/; Max-Age=604800; SameSite=Strict'
    );
    return res.status(200).json({ success: true });
  }

  return res.status(401).json({ error: 'パスワードが正しくありません' });
};

