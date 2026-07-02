const { getDb } = require('./_lib/db');
const { computeNewBadges } = require('./_lib/badges');

function todayUTC() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

function yesterdayUTC() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function updateStatsAfterStory(sql, profileId, blanks, rating) {
  const stats = (await sql`select * from profile_stats where profile_id = ${profileId}`)[0];

  const today = todayUTC();
  let currentStreak = stats.current_streak_days || 0;
  const lastCompleted = stats.last_completed_date ? new Date(stats.last_completed_date).toISOString().slice(0, 10) : null;
  if (lastCompleted === yesterdayUTC()) {
    currentStreak += 1;
  } else if (lastCompleted !== today) {
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

  const rows = await sql`
    update profile_stats set
      stories_completed = ${updatedStats.stories_completed},
      current_streak_days = ${updatedStats.current_streak_days},
      longest_streak_days = ${updatedStats.longest_streak_days},
      last_completed_date = ${updatedStats.last_completed_date},
      word_type_counts = ${JSON.stringify(updatedStats.word_type_counts)}::jsonb,
      favorite_word_type = ${updatedStats.favorite_word_type},
      badges_earned = ${JSON.stringify(updatedStats.badges_earned)}::jsonb,
      updated_at = now()
    where profile_id = ${profileId}
    returning *
  `;

  return { stats: rows[0], newly_earned_badges: newlyEarned };
}

module.exports = async function handler(req, res) {
  const sql = getDb();

  if (req.method === 'GET') {
    const { profile_id } = req.query || {};
    if (!profile_id) return res.status(400).json({ error: 'profile_id query param is required' });
    const rows = await sql`
      select * from stories where profile_id = ${profile_id} order by created_at desc
    `;
    return res.status(200).json(rows);
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

    const rows = await sql`
      insert into stories (profile_id, framework_id, title, template, blanks, filled_words, assembled_text, rating, is_favorite)
      values (${profile_id}, ${framework_id || null}, ${title || null}, ${template},
        ${JSON.stringify(blanks)}::jsonb, ${JSON.stringify(filled_words)}::jsonb, ${assembled_text},
        ${rating ?? null}, ${is_favorite ?? false})
      returning *
    `;
    const story = rows[0];

    let statsResult = { stats: null, newly_earned_badges: [] };
    try {
      statsResult = await updateStatsAfterStory(sql, profile_id, blanks, rating);
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
    await sql`delete from stories where id = ${id} and profile_id = ${profile_id}`;
    return res.status(204).end();
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
};
