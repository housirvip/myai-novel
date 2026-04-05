export const BUILTIN_CASES = [
  'llm-provider-smoke',
  'secondary-provider-smoke',
  'database-backend-smoke',
  'sqlite-backend-smoke',
  'mysql-backend-smoke',
  'mixed-config-validation',
  'hook-pressure-smoke',
  'chapter-drop-safety',
  'review-layering-smoke',
  'volume-plan-smoke',
  'mission-carry-smoke',
  'thread-progression-smoke',
  'ending-readiness-smoke',
  'volume-doctor-smoke',
] as const

export const BUILTIN_VOLUME_CASES = [
  'volume-plan-smoke',
  'thread-progression-smoke',
  'ending-readiness-smoke',
  'volume-doctor-smoke',
] as const

export type RegressionCaseName = (typeof BUILTIN_CASES)[number]
export type RegressionVolumeCaseName = (typeof BUILTIN_VOLUME_CASES)[number]
