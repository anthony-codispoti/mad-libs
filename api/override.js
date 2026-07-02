const { getSupabase } = require('./_lib/supabase');
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

  const supabase = getSupabase();
  const month = currentMonth();

  const { error: insertError } = await supabase
    .from('usage_monthly')
    .insert({ month })
    .select()
    .maybeSingle();
  if (insertError && insertError.code !== '23505') {
    return res.status(500).json({ error: insertError.message });
  }

  const { error } = await supabase
    .from('usage_monthly')
    .update({ overridden: true, overridden_at: new Date().toISOString() })
    .eq('month', month);
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ overridden: true });
};
