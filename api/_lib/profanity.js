const Filter = require('bad-words');
const filter = new Filter();

// Checks a list of {blank_id, word} entries. Returns the ids of any words
// flagged as profane. Skipped entirely in adult mode.
function findProfaneBlankIds(filledWords, ageMode) {
  if (ageMode === 'adult') return [];
  const flagged = [];
  for (const { blank_id, word } of filledWords) {
    if (typeof word === 'string' && filter.isProfane(word)) {
      flagged.push(blank_id);
    }
  }
  return flagged;
}

module.exports = { findProfaneBlankIds };
