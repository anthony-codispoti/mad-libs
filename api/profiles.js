const { getDb } = require('./_lib/db');

module.exports = async function handler(req, res) {
  const sql = getDb();

  if (req.method === 'GET') {
    const profiles = await sql`select * from profiles order by created_at asc`;
    const stats = await sql`select * from profile_stats`;
    const statsById = new Map(stats.map((s) => [s.profile_id, s]));
    const merged = profiles.map((p) => ({ ...p, stats: statsById.get(p.id) || null }));
    return res.status(200).json(merged);
  }

  if (req.method === 'POST') {
    const { name, age, age_mode, avatar_emoji } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    const rows = await sql`
      insert into profiles (name, age, age_mode, avatar_emoji)
      values (${name.trim()}, ${age ?? null}, ${age_mode || 'kid'}, ${avatar_emoji || '🙂'})
      returning *
    `;
    const profile = rows[0];
    await sql`insert into profile_stats (profile_id) values (${profile.id})`;
    return res.status(201).json(profile);
  }

  if (req.method === 'PATCH') {
    const { id } = req.query || {};
    if (!id) return res.status(400).json({ error: 'id query param is required' });
    const { name, age, age_mode, avatar_emoji } = req.body || {};

    const current = (await sql`select * from profiles where id = ${id}`)[0];
    if (!current) return res.status(404).json({ error: 'profile not found' });

    const merged = {
      name: name !== undefined ? name : current.name,
      age: age !== undefined ? age : current.age,
      age_mode: age_mode !== undefined ? age_mode : current.age_mode,
      avatar_emoji: avatar_emoji !== undefined ? avatar_emoji : current.avatar_emoji,
    };

    const rows = await sql`
      update profiles set name = ${merged.name}, age = ${merged.age},
        age_mode = ${merged.age_mode}, avatar_emoji = ${merged.avatar_emoji}
      where id = ${id}
      returning *
    `;
    return res.status(200).json(rows[0]);
  }

  res.setHeader('Allow', 'GET, POST, PATCH');
  return res.status(405).json({ error: 'Method not allowed' });
};
