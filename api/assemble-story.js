const { findProfaneBlankIds } = require('./_lib/profanity');

// Splits a template containing {{blank_id}} placeholders into an ordered list
// of text/blank parts, so the frontend can render emoji accents precisely
// next to each filled-in word.
function splitTemplate(template, blanksById, wordsById) {
  const parts = [];
  const regex = /\{\{(.*?)\}\}/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(template)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: template.slice(lastIndex, match.index) });
    }
    const blankId = match[1];
    const blank = blanksById.get(blankId);
    parts.push({
      type: 'blank',
      blank_id: blankId,
      word: wordsById.get(blankId) || '',
      emoji: blank?.emoji || '',
    });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < template.length) {
    parts.push({ type: 'text', value: template.slice(lastIndex) });
  }
  return parts;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { template, blanks, filled_words, age_mode } = req.body || {};
  if (!template || !Array.isArray(blanks) || !Array.isArray(filled_words)) {
    return res.status(400).json({ error: 'template, blanks, and filled_words are required' });
  }

  const flagged = findProfaneBlankIds(filled_words, age_mode);
  if (flagged.length > 0) {
    return res.status(400).json({ error: 'profanity_detected', flagged_blank_ids: flagged });
  }

  const blanksById = new Map(blanks.map((b) => [b.id, b]));
  const wordsById = new Map(filled_words.map((w) => [w.blank_id, w.word]));

  const parts = splitTemplate(template, blanksById, wordsById);
  const assembled_text = parts
    .map((p) => (p.type === 'text' ? p.value : p.word))
    .join('');
  const emoji_by_blank = {};
  for (const b of blanks) emoji_by_blank[b.id] = b.emoji || '';

  return res.status(200).json({ assembled_text, parts, emoji_by_blank });
};
