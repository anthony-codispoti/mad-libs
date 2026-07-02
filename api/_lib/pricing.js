// Single source of truth for AI cost estimation used by the monthly spend cap.
// Uses durable (non-introductory) published rates so the cap doesn't silently
// misbehave if a provider's promotional pricing changes later.

const CLAUDE_INPUT_PER_TOKEN_CENTS = (3.0 / 1_000_000) * 100; // $3.00 / 1M input tokens
const CLAUDE_OUTPUT_PER_TOKEN_CENTS = (15.0 / 1_000_000) * 100; // $15.00 / 1M output tokens
const TTS_PER_CHAR_CENTS = (15.0 / 1_000_000) * 100; // $15.00 / 1M characters (OpenAI tts-1)
const MONTHLY_CAP_CENTS = 500; // $5.00

function claudeCostCents(usage) {
  const input = usage?.input_tokens || 0;
  const output = usage?.output_tokens || 0;
  return input * CLAUDE_INPUT_PER_TOKEN_CENTS + output * CLAUDE_OUTPUT_PER_TOKEN_CENTS;
}

function ttsCostCents(text) {
  return (text?.length || 0) * TTS_PER_CHAR_CENTS;
}

module.exports = {
  CLAUDE_INPUT_PER_TOKEN_CENTS,
  CLAUDE_OUTPUT_PER_TOKEN_CENTS,
  TTS_PER_CHAR_CENTS,
  MONTHLY_CAP_CENTS,
  claudeCostCents,
  ttsCostCents,
};
