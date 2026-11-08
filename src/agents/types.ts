import type { EffortLevel } from "@anthropic-ai/claude-agent-sdk";
import type { AgentResult } from "../orchestrator/types.js";
import type {
  AgentActivity,
  AgentContextUsage,
  AgentId,
  PermissionDecision,
  PermissionRequest,
} from "../types.js";

export const AUTO_MODEL_LABEL = "auto (detected on first turn)";

export interface ModelSelection {
  model: string;
  effort?: string;
}

export function isClaudeEffort(value: string): value is EffortLevel {
  return value === "low" || value === "medium" || value === "high" || value === "xhigh" || value === "max";
}

export interface ModelEffort {
  id: string;
  description?: string;
}

export interface AvailableModel {
  id: string;
  label: string;
  description?: string;
  efforts: readonly ModelEffort[];
  defaultEffort?: string;
}

export interface AgentSendOptions {
  cwd: string;
  writeAccess: boolean;
  onTextDelta?: (delta: string) => void;
  /** Latest occupancy of the resumed conversation's model context. */
  onContextUsage?: (usage: AgentContextUsage) => void;
  /** Ephemeral tool/command state for the single-line dynamic footer. */
  onActivity?: (activity: AgentActivity) => void;
  /**
   * Permission request callback. The toolUseId should come from the SDK when available.
   */
  onPermissionRequest?: (req: PermissionRequest) => Promise<PermissionDecision>;
  /**
   * Abort signal for cancellation support.
   */
  signal?: AbortSignal;
}

export interface CodingAgent {
  readonly id: AgentId;
  readonly label: string;
  currentModel(): string;
  hasExplicitModel(): boolean;
  setModel(model: string, effort?: string): void;
  listModels(cwd: string, signal: AbortSignal): Promise<AvailableModel[]>;
  /** Drops the resumed session/thread id so the next send() starts a fresh conversation. */
  resetSession(): void;
  /**
   * Send a message to the agent and return a discriminated result.
   * Returns success | error | cancelled — never throws for expected failures.
   */
  send(message: string, options: AgentSendOptions): Promise<AgentResult>;
  /**
   * Interrupt any in-flight request and wait for cleanup.
   * Safe to call multiple times or when nothing is running.
   */
  stop(): Promise<void>;
}
