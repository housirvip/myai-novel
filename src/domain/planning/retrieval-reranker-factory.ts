import { env } from "../../config/env.js";
import { HeuristicReranker } from "./retrieval-reranker-heuristic.js";
import { DirectPassThroughReranker, type RetrievalReranker } from "./retrieval-pipeline.js";

export function createConfiguredReranker(): RetrievalReranker {
  switch (env.PLANNING_RETRIEVAL_RERANKER) {
    case "heuristic":
      return new HeuristicReranker();
    case "none":
    default:
      return new DirectPassThroughReranker();
  }
}
