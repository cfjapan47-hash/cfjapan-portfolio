module.exports = async function handler(req, res) {
  res.setHeader('Set-Cookie',
    'salon-auth=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict'
  );
  return res.status(200).json({ success: true });
};

