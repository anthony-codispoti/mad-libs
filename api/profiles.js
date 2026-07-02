const { getSupabase } = require('./_lib/supabase');

module.exports = async function handler(req, res) {
  const supabase = getSupabase();

  if (req.method === 'GET') {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });

    const { data: stats } = await supabase.from('profile_stats').select('*');
    const statsById = new Map((stats || []).map((s) => [s.profile_id, s]));
    const merged = profiles.map((p) => ({ ...p, stats: statsById.get(p.id) || null }));

    return res.status(200).json(merged);
  }

  if (req.method === 'POST') {
    const { name, age, age_mode, avatar_emoji } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    const insert = { name: name.trim() };
    if (age !== undefined) insert.age = age;
    if (age_mode !== undefined) insert.age_mode = age_mode;
    if (avatar_emoji !== undefined) insert.avatar_emoji = avatar_emoji;

    const { data, error } = await supabase
      .from('profiles')
      .insert(insert)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    await supabase.from('profile_stats').insert({ profile_id: data.id });

    return res.status(201).json(data);
  }

  if (req.method === 'PATCH') {
    const { id } = req.query || {};
    if (!id) return res.status(400).json({ error: 'id query param is required' });
    const { name, age, age_mode, avatar_emoji } = req.body || {};
    const update = {};
    if (name !== undefined) update.name = name;
    if (age !== undefined) update.age = age;
    if (age_mode !== undefined) update.age_mode = age_mode;
    if (avatar_emoji !== undefined) update.avatar_emoji = avatar_emoji;

    const { data, error } = await supabase
      .from('profiles')
      .update(update)
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  res.setHeader('Allow', 'GET, POST, PATCH');
  return res.status(405).json({ error: 'Method not allowed' });
};
