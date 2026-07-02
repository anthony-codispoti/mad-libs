const { getDb } = require('./_lib/db');

module.exports = async function handler(req, res) {
  const sql = getDb();

  if (req.method === 'GET') {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;
    const rows = await sql`
      select * from frameworks order by created_at desc limit ${limit} offset ${offset}
    `;
    return res.status(200).json(rows);
  }

  if (req.method === 'POST') {
    const { created_by_profile_id, topic, title, template, blanks, age_mode } = req.body || {};
    if (!topic || !template || !Array.isArray(blanks)) {
      return res.status(400).json({ error: 'topic, template, and blanks are required' });
    }
    const rows = await sql`
      insert into frameworks (created_by_profile_id, topic, title, template, blanks, age_mode)
      values (${created_by_profile_id || null}, ${topic}, ${title || null}, ${template},
        ${JSON.stringify(blanks)}::jsonb, ${age_mode || 'kid'})
      returning *
    `;

    if (created_by_profile_id) {
      await sql`
        update profile_stats set frameworks_saved = coalesce(frameworks_saved, 0) + 1, updated_at = now()
        where profile_id = ${created_by_profile_id}
      `;
    }

    return res.status(201).json(rows[0]);
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
};
