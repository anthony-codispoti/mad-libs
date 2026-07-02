const { MONTHLY_CAP_CENTS } = require('./pricing');

function currentMonth() {
  return new Date().toISOString().slice(0, 7); // 'YYYY-MM'
}

// Pre-flight check: throws { capReached: true, current_cents, cap_cents } if the
// month is already over the cap and not overridden. Call this BEFORE making any
// paid API call.
async function assertUnderCap(supabase) {
  const month = currentMonth();
  const { data, error } = await supabase.rpc('record_ai_cost', {
    p_month: month,
    p_claude_cents: 0,
    p_tts_cents: 0,
    p_cap_cents: MONTHLY_CAP_CENTS,
  });
  if (error) throw error;
  const row = data[0];
  if (row.was_capped) {
    const err = new Error('cap_reached');
    err.capReached = true;
    err.current_cents = Number(row.total_cost_cents);
    err.cap_cents = MONTHLY_CAP_CENTS;
    throw err;
  }
  return month;
}

// Post-call recording: call AFTER a paid API call succeeds, with the real cost.
async function recordCost(supabase, month, { claudeCents = 0, ttsCents = 0 }) {
  const { error } = await supabase.rpc('record_ai_cost', {
    p_month: month,
    p_claude_cents: claudeCents,
    p_tts_cents: ttsCents,
    p_cap_cents: MONTHLY_CAP_CENTS,
  });
  if (error) throw error;
}

module.exports = { currentMonth, assertUnderCap, recordCost, MONTHLY_CAP_CENTS };
