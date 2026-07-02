const OpenAI = require('openai');
const { getSupabase } = require('./_lib/supabase');
const { assertUnderCap, recordCost } = require('./_lib/costCap');
const { ttsCostCents } = require('./_lib/pricing');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, profile_id } = req.body || {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }
  if (!profile_id) {
    return res.status(400).json({ error: 'profile_id is required' });
  }

  const supabase = getSupabase();

  let month;
  try {
    month = await assertUnderCap(supabase);
  } catch (err) {
    if (err.capReached) {
      return res.status(402).json({
        error: 'cap_reached',
        current_cents: err.current_cents,
        cap_cents: err.cap_cents,
      });
    }
    return res.status(500).json({ error: err.message });
  }

  const openai = new OpenAI();

  let speech;
  try {
    speech = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: text,
    });
  } catch (err) {
    return res.status(502).json({ error: `OpenAI TTS request failed: ${err.message}` });
  }

  const arrayBuffer = await speech.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const ttsCents = ttsCostCents(text);
  try {
    await recordCost(supabase, month, { ttsCents });
  } catch (err) {
    // Non-fatal: still return the audio even if cost recording fails.
  }

  res.setHeader('Content-Type', 'audio/mpeg');
  return res.status(200).send(buffer);
};
