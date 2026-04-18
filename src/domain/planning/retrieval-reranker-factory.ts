import { env } from "../../config/env.js";
import { HeuristicReranker } from "./retrieval-reranker-heuristic.js";
import { DirectPassThroughReranker, type RetrievalReranker } from "./retrieval-pipeline.js";

export function createConfiguredReranker(): RetrievalReranker {
  // reranker 工厂只做配置分流，不承担策略本身。
  // 这样 workflow 层永远只依赖统一接口，实验链路可以在环境变量里随时切换。
  switch (env.PLANNING_RETRIEVAL_RERANKER) {
    case "heuristic":
      return new HeuristicReranker();
    case "none":
    default:
      return new DirectPassThroughReranker();
  }
}
