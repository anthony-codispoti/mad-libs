const Anthropic = require('@anthropic-ai/sdk');
const { getSupabase } = require('./_lib/supabase');
const { assertUnderCap, recordCost } = require('./_lib/costCap');
const { claudeCostCents } = require('./_lib/pricing');

const MODEL = 'claude-sonnet-5';

const BLANKS_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'A short, fun title for the story' },
    template: {
      type: 'string',
      description:
        'The full story text with blanks marked as {{blank_1}}, {{blank_2}}, etc., matching the ids in the blanks array',
    },
    blanks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'e.g. blank_1, must match a {{blank_id}} in template' },
          word_type: { type: 'string', description: 'e.g. noun, verb, adjective, animal, silly word, name, place, number' },
          emoji: { type: 'string', description: 'A single emoji representing this blank type' },
          suggestions: {
            type: 'array',
            items: { type: 'string' },
            description: '3-4 silly, on-theme suggested words for this blank',
          },
        },
        required: ['id', 'word_type', 'emoji', 'suggestions'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'template', 'blanks'],
  additionalProperties: false,
};

const AGE_MODE_INSTRUCTIONS = {
  kid: 'Keep all content squeaky-clean and appropriate for young children. No violence, scary themes, romance, or crude humor.',
  teen: 'Keep content appropriate for teenagers. Mild humor is fine, but avoid explicit or mature content.',
  adult: 'This is for adults. You may use more mature humor and themes, but keep it in good taste and non-explicit.',
};

async function buildPersonalizationContext(supabase, profileId) {
  if (!profileId) return '';
  const { data } = await supabase
    .from('stories')
    .select('title, template, rating')
    .eq('profile_id', profileId)
    .gte('rating', 4)
    .order('rating', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(5);

  if (!data || data.length === 0) return '';

  const items = data.map((s) => `${s.title || 'a story'} (${s.rating} stars)`).join(', ');
  return `This person has previously loved stories like: ${items}. If relevant, you can draw light inspiration from themes they've enjoyed before, but prioritize their current topic request.`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { profile_id, topic } = req.body || {};
  if (!profile_id || !topic || typeof topic !== 'string' || !topic.trim()) {
    return res.status(400).json({ error: 'profile_id and topic are required' });
  }

  const supabase = getSupabase();

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('age_mode')
    .eq('id', profile_id)
    .single();
  if (profileError || !profile) {
    return res.status(404).json({ error: 'profile not found' });
  }
  const ageMode = profile.age_mode || 'kid';

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

  const personalization = await buildPersonalizationContext(supabase, profile_id);

  const systemPrompt = `You write funny Mad Libs-style story templates. Given a topic, create a short story (150-300 words) with 8-15 blanks for the reader to fill in. ${AGE_MODE_INSTRUCTIONS[ageMode] || AGE_MODE_INSTRUCTIONS.kid}

Each blank needs a word_type (noun, verb, adjective, animal, silly word, name, place, number, etc.), a matching emoji, and 3-4 on-theme silly suggested words that would make the story funnier. Vary the word types across the story.

${personalization}`.trim();

  const anthropic = new Anthropic();

  let response;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4000,
      thinking: { type: 'disabled' },
      system: systemPrompt,
      messages: [{ role: 'user', content: `Write a Mad Libs story about: ${topic.trim()}` }],
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: BLANKS_SCHEMA },
      },
    });
  } catch (err) {
    return res.status(502).json({ error: `Claude request failed: ${err.message}` });
  }

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock) {
    return res.status(502).json({ error: 'No text content in Claude response' });
  }

  let framework;
  try {
    framework = JSON.parse(textBlock.text);
  } catch (err) {
    return res.status(502).json({ error: 'Claude returned invalid JSON' });
  }

  const claudeCents = claudeCostCents(response.usage);
  try {
    await recordCost(supabase, month, { claudeCents });
  } catch (err) {
    // Cost recording failure shouldn't block the user from getting their story.
  }

  return res.status(200).json({
    title: framework.title,
    template: framework.template,
    blanks: framework.blanks,
    age_mode: ageMode,
  });
};
