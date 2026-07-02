const { getDb } = require('./_lib/db');
const { MONTHLY_CAP_CENTS } = require('./_lib/pricing');
const { currentMonth } = require('./_lib/costCap');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sql = getDb();
  const month = currentMonth();

  const rows = await sql`select * from usage_monthly where month = ${month}`;
  const row = rows[0];

  const totalCents = row ? Number(row.total_cost_cents) : 0;
  const overridden = row ? row.overridden : false;

  return res.status(200).json({
    month,
    total_cents: totalCents,
    cap_cents: MONTHLY_CAP_CENTS,
    overridden,
    remaining_cents: Math.max(0, MONTHLY_CAP_CENTS - totalCents),
  });
};
