const { getSupabase } = require('./_lib/supabase');
const { computeNewBadges } = require('./_lib/badges');

function todayUTC() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

function yesterdayUTC() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function updateStatsAfterStory(supabase, profileId, blanks, rating) {
  const { data: stats } = await supabase
    .from('profile_stats')
    .select('*')
    .eq('profile_id', profileId)
    .single();

  const today = todayUTC();
  let currentStreak = stats.current_streak_days || 0;
  if (stats.last_completed_date === yesterdayUTC()) {
    currentStreak += 1;
  } else if (stats.last_completed_date !== today) {
    currentStreak = 1;
  }
  const longestStreak = Math.max(stats.longest_streak_days || 0, currentStreak);

  const wordTypeCounts = { ...(stats.word_type_counts || {}) };
  for (const b of blanks || []) {
    if (b.word_type) wordTypeCounts[b.word_type] = (wordTypeCounts[b.word_type] || 0) + 1;
  }
  let favoriteWordType = stats.favorite_word_type;
  let maxCount = 0;
  for (const [type, count] of Object.entries(wordTypeCounts)) {
    if (count > maxCount) {
      maxCount = count;
      favoriteWordType = type;
    }
  }

  const updatedStats = {
    ...stats,
    stories_completed: (stats.stories_completed || 0) + 1,
    current_streak_days: currentStreak,
    longest_streak_days: longestStreak,
    last_completed_date: today,
    word_type_counts: wordTypeCounts,
    favorite_word_type: favoriteWordType,
  };

  const { newlyEarned, badgesEarned } = computeNewBadges(updatedStats, { rating });
  updatedStats.badges_earned = badgesEarned;

  const { data: saved, error } = await supabase
    .from('profile_stats')
    .update({
      stories_completed: updatedStats.stories_completed,
      current_streak_days: updatedStats.current_streak_days,
      longest_streak_days: updatedStats.longest_streak_days,
      last_completed_date: updatedStats.last_completed_date,
      word_type_counts: updatedStats.word_type_counts,
      favorite_word_type: updatedStats.favorite_word_type,
      badges_earned: updatedStats.badges_earned,
      updated_at: new Date().toISOString(),
    })
    .eq('profile_id', profileId)
    .select()
    .single();
  if (error) throw error;

  return { stats: saved, newly_earned_badges: newlyEarned };
}

module.exports = async function handler(req, res) {
  const supabase = getSupabase();

  if (req.method === 'GET') {
    const { profile_id } = req.query || {};
    if (!profile_id) return res.status(400).json({ error: 'profile_id query param is required' });
    const { data, error } = await supabase
      .from('stories')
      .select('*')
      .eq('profile_id', profile_id)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const {
      profile_id,
      framework_id,
      title,
      template,
      blanks,
      filled_words,
      assembled_text,
      rating,
      is_favorite,
    } = req.body || {};
    if (!profile_id || !template || !Array.isArray(blanks) || !Array.isArray(filled_words) || !assembled_text) {
      return res.status(400).json({
        error: 'profile_id, template, blanks, filled_words, and assembled_text are required',
      });
    }

    const insert = {
      profile_id,
      framework_id: framework_id || null,
      title: title || null,
      template,
      blanks,
      filled_words,
      assembled_text,
    };
    if (rating !== undefined) insert.rating = rating;
    if (is_favorite !== undefined) insert.is_favorite = is_favorite;

    const { data: story, error } = await supabase.from('stories').insert(insert).select().single();
    if (error) return res.status(500).json({ error: error.message });

    let statsResult = { stats: null, newly_earned_badges: [] };
    try {
      statsResult = await updateStatsAfterStory(supabase, profile_id, blanks, rating);
    } catch (e) {
      // Story is already saved; stats update failure shouldn't fail the request.
    }

    return res.status(201).json({ story, ...statsResult });
  }

  if (req.method === 'DELETE') {
    const { id, profile_id } = req.query || {};
    if (!id || !profile_id) {
      return res.status(400).json({ error: 'id and profile_id query params are required' });
    }
    const { error } = await supabase.from('stories').delete().eq('id', id).eq('profile_id', profile_id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
};
