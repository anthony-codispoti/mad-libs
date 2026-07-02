const { MONTHLY_CAP_CENTS } = require('./pricing');

function currentMonth() {
  return new Date().toISOString().slice(0, 7); // 'YYYY-MM'
}

// Pre-flight check: throws { capReached: true, current_cents, cap_cents } if the
// month is already over the cap and not overridden. Call this BEFORE making any
// paid API call.
async function assertUnderCap(sql) {
  const month = currentMonth();
  const rows = await sql`select * from record_ai_cost(${month}, 0, 0, ${MONTHLY_CAP_CENTS})`;
  const row = rows[0];
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
async function recordCost(sql, month, { claudeCents = 0, ttsCents = 0 }) {
  await sql`select * from record_ai_cost(${month}, ${claudeCents}, ${ttsCents}, ${MONTHLY_CAP_CENTS})`;
}

module.exports = { currentMonth, assertUnderCap, recordCost, MONTHLY_CAP_CENTS };
