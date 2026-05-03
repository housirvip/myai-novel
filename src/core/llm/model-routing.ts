import { env } from "../../config/env.js";

export type LlmModelTier = "low" | "mid" | "high";

export function resolveLlmModel(options: {
  explicitModel?: string;
  tier: LlmModelTier;
}): string | undefined {
  if (options.explicitModel) {
    return options.explicitModel;
  }

  switch (options.tier) {
    case "low":
      return env.LLM_LOW_MODEL;
    case "mid":
      return env.LLM_MID_MODEL;
    case "high":
      return env.LLM_HIGH_MODEL;
    default:
      throw new Error(`Unsupported LLM model tier: ${options.tier satisfies never}`);
  }
}
