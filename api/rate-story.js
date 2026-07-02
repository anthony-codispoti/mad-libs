const { getSupabase } = require('./_lib/supabase');
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

  const supabase = getSupabase();
  const update = {};
  if (rating !== undefined) update.rating = rating;
  if (is_favorite !== undefined) update.is_favorite = is_favorite;

  const { data: story, error } = await supabase
    .from('stories')
    .update(update)
    .eq('id', story_id)
    .eq('profile_id', profile_id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  let newly_earned_badges = [];
  if (rating !== undefined) {
    const { data: stats } = await supabase
      .from('profile_stats')
      .select('*')
      .eq('profile_id', profile_id)
      .single();
    if (stats) {
      const { newlyEarned, badgesEarned } = computeNewBadges(stats, { rating });
      if (newlyEarned.length > 0) {
        await supabase
          .from('profile_stats')
          .update({ badges_earned: badgesEarned, updated_at: new Date().toISOString() })
          .eq('profile_id', profile_id);
      }
      newly_earned_badges = newlyEarned;
    }
  }

  return res.status(200).json({ story, newly_earned_badges });
};
