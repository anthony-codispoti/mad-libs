const ALL_BADGES = [
  { id: 'first_story', icon: '📖', name: 'First Story', desc: 'Complete your first Mad Lib', check: (s) => s.stories_completed >= 1 },
  { id: 'five_stories', icon: '🎉', name: 'Story Squad', desc: 'Complete 5 stories', check: (s) => s.stories_completed >= 5 },
  { id: 'ten_stories', icon: '🏆', name: 'Mad Libs Master', desc: 'Complete 10 stories', check: (s) => s.stories_completed >= 10 },
  { id: 'week_streak', icon: '🔥', name: 'Week Streak', desc: '7 days in a row', check: (s) => s.current_streak_days >= 7 },
  { id: 'five_star', icon: '⭐', name: 'Five Star Fan', desc: 'Rate a story 5 stars', check: (s, story) => story?.rating === 5 },
  { id: 'framework_saver', icon: '💾', name: 'Framework Fanatic', desc: 'Save a reusable framework', check: (s) => (s.frameworks_saved || 0) >= 1 },
];

function computeNewBadges(stats, story) {
  const earned = new Set(stats.badges_earned || []);
  const newlyEarned = [];
  for (const badge of ALL_BADGES) {
    if (!earned.has(badge.id) && badge.check(stats, story)) {
      newlyEarned.push(badge);
      earned.add(badge.id);
    }
  }
  return { badgesEarned: Array.from(earned), newlyEarned };
}

module.exports = { ALL_BADGES, computeNewBadges };
