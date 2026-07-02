const { getSupabase } = require('./_lib/supabase');

module.exports = async function handler(req, res) {
  const supabase = getSupabase();

  if (req.method === 'GET') {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;
    const { data, error } = await supabase
      .from('frameworks')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const { created_by_profile_id, topic, title, template, blanks, age_mode } = req.body || {};
    if (!topic || !template || !Array.isArray(blanks)) {
      return res.status(400).json({ error: 'topic, template, and blanks are required' });
    }
    const { data, error } = await supabase
      .from('frameworks')
      .insert({
        created_by_profile_id: created_by_profile_id || null,
        topic,
        title: title || null,
        template,
        blanks,
        age_mode: age_mode || 'kid',
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    if (created_by_profile_id) {
      const { data: stats } = await supabase
        .from('profile_stats')
        .select('frameworks_saved')
        .eq('profile_id', created_by_profile_id)
        .single();
      if (stats) {
        await supabase
          .from('profile_stats')
          .update({ frameworks_saved: (stats.frameworks_saved || 0) + 1 })
          .eq('profile_id', created_by_profile_id);
      }
    }

    return res.status(201).json(data);
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
};
