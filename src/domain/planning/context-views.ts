import type { PlanRetrievedContext } from "./types.js";

export function buildDraftContextView(context: PlanRetrievedContext) {
  return {
    book: context.book,
    hardConstraints: context.hardConstraints,
    recentChapters: context.recentChapters,
    riskReminders: context.riskReminders,
    supportingOutlines: context.softReferences.outlines,
  };
}

export function buildReviewContextView(context: PlanRetrievedContext) {
  return {
    book: context.book,
    hardConstraints: context.hardConstraints,
    recentChapters: context.recentChapters,
    riskReminders: context.riskReminders,
  };
}

export function buildRepairContextView(context: PlanRetrievedContext) {
  return {
    book: context.book,
    hardConstraints: context.hardConstraints,
    recentChapters: context.recentChapters,
    riskReminders: context.riskReminders,
    supportingOutlines: context.softReferences.outlines,
  };
}

export function buildApproveContextView(context: PlanRetrievedContext) {
  return {
    book: context.book,
    hardConstraints: context.hardConstraints,
    recentChapters: context.recentChapters,
    riskReminders: context.riskReminders,
    supportingOutlines: context.softReferences.outlines,
  };
}

export function buildApproveDiffContextView(context: PlanRetrievedContext) {
  return {
    book: context.book,
    hardConstraints: context.hardConstraints,
    recentChapters: context.recentChapters,
    riskReminders: context.riskReminders,
  };
}
