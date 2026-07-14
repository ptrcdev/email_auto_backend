import { Logger } from '@nestjs/common';
import OpenAI from 'openai';

/**
 * Error status codes that indicate the model is unavailable or rate-limited —
 * worth retrying with the next model in the chain rather than giving up.
 */
const FALLBACK_STATUS_CODES = new Set([402, 429, 503]);

function isFallbackableError(error: unknown): boolean {
  if (error instanceof OpenAI.APIError) {
    return FALLBACK_STATUS_CODES.has(error.status);
  }
  // Some OpenRouter errors surface as plain objects with a `status` field
  if (typeof error === 'object' && error !== null && 'status' in error) {
    return FALLBACK_STATUS_CODES.has((error as { status: number }).status);
  }
  return false;
}

/**
 * Calls `fn` with each model in `models` in order.
 * - On a 402/429/503 response, moves to the next model immediately.
 * - On other errors, retries the same model with exponential backoff up to
 *   `retriesPerModel` times before moving to the next.
 * - Throws only if all models are exhausted.
 */
export async function llmWithFallback<T>(
  models: string[],
  fn: (model: string) => Promise<T>,
  logger: Logger,
  retriesPerModel = 2,
): Promise<T> {
  let lastError: unknown;

  for (const model of models) {
    for (let attempt = 0; attempt <= retriesPerModel; attempt++) {
      try {
        const result = await fn(model);
        if (attempt > 0 || model !== models[0]) {
          logger.log(`LLM call succeeded with model: ${model}`);
        }
        return result;
      } catch (error) {
        lastError = error;

        if (isFallbackableError(error)) {
          // Model unavailable / quota hit — skip remaining retries, try next model
          logger.warn(
            `Model ${model} returned ${(error as InstanceType<typeof OpenAI.APIError>).status} — falling back to next model`,
          );
          break;
        }

        // Transient error — retry with backoff
        if (attempt < retriesPerModel) {
          const delay = Math.pow(2, attempt) * 1000;
          logger.warn(
            `LLM error on model ${model} (attempt ${attempt + 1}/${retriesPerModel}), retrying in ${delay}ms: ${(error as Error).message}`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          logger.warn(
            `Model ${model} failed after ${retriesPerModel + 1} attempts — falling back to next model`,
          );
        }
      }
    }
  }

  throw lastError;
}

/**
 * Default ordered model chain for this project.
 * Override via LLM_MODELS env var (comma-separated model IDs).
 */
export const DEFAULT_MODEL_CHAIN = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'nvidia/nemotron-super-49b-v1:free',
  'openrouter/auto',
];

/**
 * Parses the LLM_MODELS env var into an ordered list, falling back to the
 * default chain if the env var is absent or empty.
 */
export function resolveModelChain(envValue: string | undefined): string[] {
  if (!envValue) return DEFAULT_MODEL_CHAIN;
  const parsed = envValue
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_MODEL_CHAIN;
}
