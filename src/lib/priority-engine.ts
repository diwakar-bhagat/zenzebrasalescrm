import type { DerivedSignals, Project, PriorityScore, Severity } from "@/types/crm";

// Scoring weights (tunable constants)
export const PRIORITY_WEIGHTS = {
  DELAY_PER_DAY: 10,
  DELAY_CAP: 50,
  DEADLINE_WINDOW: 30,
  BLOCKED_PENALTY: 25,
  INACTIVITY_THRESHOLD_HOURS: 24,
  INACTIVITY_PENALTY: 15,
  CASCADE_PENALTY: 40,
} as const;

/**
 * Computes the severity based on the total score.
 * Thresholds: >=80 Critical, >=50 High, >=25 Medium, <25 Low
 */
export function getSeverity(score: number): Severity {
  if (score >= 80) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

/**
 * Computes reason codes for the UI based on signals.
 */
export function getReasonCodes(signals: DerivedSignals): string[] {
  const codes: string[] = [];
  if (signals.isDelayed) codes.push("DELAYED");
  if (signals.cascadeRisk) codes.push("CASCADE_RISK");
  if (signals.isBlocked) codes.push("BLOCKED");
  if (signals.inactivityHours > PRIORITY_WEIGHTS.INACTIVITY_THRESHOLD_HOURS) {
    codes.push("ASSIGNEE_SILENT");
  }
  if (signals.deadlineProximity <= 7 && !signals.isDelayed) {
    codes.push("DEADLINE_CRUNCH");
  }
  return codes;
}

/**
 * Maps severity and reason codes to a recommended action string.
 */
export function getRecommendedAction(severity: Severity, codes: string[]): string {
  if (severity === "critical") {
    if (codes.includes("CASCADE_RISK")) return "Urgent assignee follow-up";
    if (codes.includes("BLOCKED")) return "Escalate to management";
    return "Immediate action required";
  }
  if (severity === "high") {
    if (codes.includes("CASCADE_RISK")) return "Review cascading dependencies";
    return "Prioritize follow-up today";
  }
  if (severity === "medium") {
    if (codes.includes("DEADLINE_CRUNCH")) return "Monitor daily progress";
    return "Check status within 48h";
  }
  if (codes.includes("ASSIGNEE_SILENT")) return "Send automated reminder";
  return "No action needed";
}

/**
 * Core Priority Engine:
 * A pure, deterministic function that takes normalized signals and returns a priority score.
 * Constraint: Must execute in < 1ms.
 */
export function computePriorityScore(project: Project, signals: DerivedSignals): PriorityScore {
  let score = 0;

  // 1. Delay Severity (Cap at 50)
  if (signals.isDelayed) {
    score += Math.min(signals.delayDays * PRIORITY_WEIGHTS.DELAY_PER_DAY, PRIORITY_WEIGHTS.DELAY_CAP);
  }

  // 2. Deadline Proximity (Closer = Higher Priority)
  // Max score 30 for 0 days left, decreasing to 0 for 30+ days left
  score += Math.max(0, PRIORITY_WEIGHTS.DEADLINE_WINDOW - signals.deadlineProximity);

  // 3. Blocking Issues
  if (signals.isBlocked) {
    score += PRIORITY_WEIGHTS.BLOCKED_PENALTY;
  }

  // 4. Assignee Inactivity
  if (signals.inactivityHours > PRIORITY_WEIGHTS.INACTIVITY_THRESHOLD_HOURS) {
    score += PRIORITY_WEIGHTS.INACTIVITY_PENALTY;
  }

  // 5. Cascade Risk (Critical)
  if (signals.cascadeRisk) {
    score += PRIORITY_WEIGHTS.CASCADE_PENALTY;
  }

  const severity = getSeverity(score);
  const reasonCodes = getReasonCodes(signals);
  const recommendedAction = getRecommendedAction(severity, reasonCodes);

  return {
    projectId: project.id,
    score,
    severity,
    reasonCodes,
    recommendedAction,
  };
}

/**
 * Computes derived signals from raw project data.
 * This simulates the logic that compares current state to external constraints.
 */
export function computeDerivedSignals(project: Project): DerivedSignals {
  const now = new Date();

  // Calculate inactivity hours
  const inactivityMs = now.getTime() - new Date(project.assigneeLastActive).getTime();
  const inactivityHours = Math.floor(inactivityMs / (1000 * 60 * 60));

  // Calculate deadline proximity
  const proximityMs = new Date(project.deliveryDate).getTime() - now.getTime();
  const deadlineProximity = Math.max(0, Math.floor(proximityMs / (1000 * 60 * 60 * 24)));

  // Determine delays
  const isDelayed = project.phase1Status === "delayed" || project.phase2Status === "delayed" || project.phase3Status === "delayed";

  // Simulated logic for delay days (in reality, we'd compare target vs actual dates)
  let delayDays = 0;
  if (isDelayed) {
    if (project.phase1Status === "delayed") delayDays += 5;
    else if (project.phase2Status === "delayed") delayDays += 3;
    else delayDays += 2;
  }

  // Determine blocks
  const isBlocked = project.approvalPending && isDelayed;
  const blockedReason = isBlocked ? "Approvals pending" : null;

  // Determine cascade risk
  const cascadeRisk = isDelayed && project.phase1Status === "delayed" && project.phase2Status === "pending";
  const cascadeReason = cascadeRisk ? "Phase 1 delay cascading to Phase 2" : null;

  return {
    projectId: project.id,
    isDelayed,
    delayDays,
    isBlocked,
    blockedReason,
    inactivityHours,
    cascadeRisk,
    cascadeReason,
    deadlineProximity,
  };
}
