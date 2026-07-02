const { getSupabase } = require('./_lib/supabase');
const { MONTHLY_CAP_CENTS } = require('./_lib/pricing');
const { currentMonth } = require('./_lib/costCap');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabase();
  const month = currentMonth();

  const { data, error } = await supabase
    .from('usage_monthly')
    .select('*')
    .eq('month', month)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });

  const totalCents = data ? Number(data.total_cost_cents) : 0;
  const overridden = data ? data.overridden : false;

  return res.status(200).json({
    month,
    total_cents: totalCents,
    cap_cents: MONTHLY_CAP_CENTS,
    overridden,
    remaining_cents: Math.max(0, MONTHLY_CAP_CENTS - totalCents),
  });
};
