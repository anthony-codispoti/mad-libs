const { getDb } = require('./_lib/db');
const { computeNewBadges } = require('./_lib/badges');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { story_id, profile_id, rating, is_favorite } = req.body || {};
  if (!story_id || !profile_id) {
    return res.status(400).json({ error: 'story_id and profile_id are required' });
  }
  if (rating === undefined && is_favorite === undefined) {
    return res.status(400).json({ error: 'rating or is_favorite must be provided' });
  }

  const sql = getDb();

  const current = (await sql`select * from stories where id = ${story_id} and profile_id = ${profile_id}`)[0];
  if (!current) return res.status(404).json({ error: 'story not found' });

  const mergedRating = rating !== undefined ? rating : current.rating;
  const mergedFavorite = is_favorite !== undefined ? is_favorite : current.is_favorite;

  const rows = await sql`
    update stories set rating = ${mergedRating}, is_favorite = ${mergedFavorite}
    where id = ${story_id} and profile_id = ${profile_id}
    returning *
  `;
  const story = rows[0];

  let newly_earned_badges = [];
  if (rating !== undefined) {
    const stats = (await sql`select * from profile_stats where profile_id = ${profile_id}`)[0];
    if (stats) {
      const { newlyEarned, badgesEarned } = computeNewBadges(stats, { rating });
      if (newlyEarned.length > 0) {
        await sql`
          update profile_stats set badges_earned = ${JSON.stringify(badgesEarned)}::jsonb, updated_at = now()
          where profile_id = ${profile_id}
        `;
      }
      newly_earned_badges = newlyEarned;
    }
  }

  return res.status(200).json({ story, newly_earned_badges });
};
