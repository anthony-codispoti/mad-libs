const { getDb } = require('./_lib/db');
const { currentMonth } = require('./_lib/costCap');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body || {};
  if (!password || password !== process.env.PARENT_OVERRIDE_PASSWORD) {
    return res.status(401).json({ error: 'invalid_password' });
  }

  const sql = getDb();
  const month = currentMonth();

  await sql`
    insert into usage_monthly (month, overridden, overridden_at)
    values (${month}, true, now())
    on conflict (month) do update set overridden = true, overridden_at = now()
  `;

  return res.status(200).json({ overridden: true });
};
