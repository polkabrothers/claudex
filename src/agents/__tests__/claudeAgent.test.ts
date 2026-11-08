import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({ query: queryMock }));

import { ClaudeAgent } from "../claudeAgent.js";

async function* messages(items: unknown[]) {
  for (const item of items) yield item;
}

function successResult() {
  return {
    type: "result",
    subtype: "success",
    is_error: false,
    session_id: "session-1",
    modelUsage: { "claude-test": { contextWindow: 200_000 } },
  };
}

describe("ClaudeAgent streaming", () => {
  beforeEach(() => queryMock.mockReset());

  it("lists models without sending a prompt or loading project hooks", async () => {
    const close = vi.fn();
    queryMock.mockReturnValue({
      supportedModels: async () => [
        { value: "opus", resolvedModel: "claude-opus-5-5", displayName: "Opus 5.5",
          supportedEffortLevels: ["low", "high"] },
      ],
      close,
    });

    expect(await new ClaudeAgent().listModels("/project", new AbortController().signal))
      .toEqual([{ id: "claude-opus-5-5", label: "Opus 5.5", efforts: [{ id: "low" }, { id: "high" }] }]);
    expect(queryMock).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({ settingSources: [], strictMcpConfig: true, persistSession: false }),
    }));
    expect(close).toHaveBeenCalledOnce();
  });

  it("passes selected effort to the SDK on the next turn", async () => {
    queryMock.mockReturnValue(messages([successResult()]));
    const agent = new ClaudeAgent();
    agent.setModel("opus", "high");
    expect(agent.currentModel()).toContain("effort high");
    await agent.send("Topic", { cwd: "/tmp", writeAccess: false });
    expect(queryMock).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({ model: "opus", effort: "high" }),
    }));
  });

  it("emits actual text_delta events without repeating the final assistant message", async () => {
    queryMock.mockReturnValue(
      messages([
        {
          type: "stream_event",
          session_id: "session-1",
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "Bon" },
          },
        },
        {
          type: "stream_event",
          session_id: "session-1",
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "jour" },
          },
        },
        {
          type: "assistant",
          session_id: "session-1",
          message: {
            model: "claude-test",
            usage: {
              input_tokens: 1_000,
              cache_creation_input_tokens: 200,
              cache_read_input_tokens: 2_000,
              output_tokens: 300,
            },
            content: [{ type: "text", text: "Bonjour" }],
          },
        },
        successResult(),
      ]) as never,
    );

    const deltas: string[] = [];
    const contexts: unknown[] = [];
    const agent = new ClaudeAgent(undefined, "Opus 4.5");
    expect(agent.currentModel()).toBe("Opus 4.5");
    expect(agent.hasExplicitModel()).toBe(false);

    const result = await agent.send("Topic", {
      cwd: "/tmp",
      writeAccess: false,
      onTextDelta: (delta) => deltas.push(delta),
      onContextUsage: (usage) => contexts.push(usage),
    });

    expect(deltas).toEqual(["Bon", "jour"]);
    expect(contexts).toEqual([{ usedTokens: 3_500, contextWindow: 200_000 }]);
    expect(result).toMatchObject({ kind: "success", text: "Bonjour" });
    expect(agent.currentModel()).toBe("Test");
    expect(queryMock.mock.calls[0]?.[0]?.options.model).toBeUndefined();
    expect(queryMock.mock.calls[0]?.[0]?.options.includePartialMessages).toBe(true);
    // Measured: user settings cost 13,300 system-prompt tokens per call for
    // plugin catalogues an agent limited to Read/Grep/Glob cannot use. Claudex
    // reads and explicitly passes the only useful field, the default model.
    expect(queryMock.mock.calls[0]?.[0]?.options.settingSources).toEqual(["project"]);

    agent.resetSession();
    expect(agent.currentModel()).toBe("Opus 4.5");
  });

  it("shows the model that answered rather than the first model in modelUsage", async () => {
    // Measured on SDK 0.3.310: with model "opus", modelUsage lists the engine's
    // background Haiku first, then the model that actually answered.
    queryMock.mockReturnValue(
      messages([
        {
          type: "assistant",
          session_id: "session-1",
          message: {
            model: "claude-opus-5-5",
            usage: { input_tokens: 1_000, output_tokens: 100 },
            content: [{ type: "text", text: "Summary" }],
          },
        },
        {
          ...successResult(),
          modelUsage: {
            "claude-haiku-5-5": { contextWindow: 200_000 },
            "claude-opus-5-5": { contextWindow: 200_000 },
          },
        },
      ]) as never,
    );

    const agent = new ClaudeAgent("opus");
    expect(agent.currentModel()).toBe("Opus");
    await agent.send("Topic", { cwd: "/tmp", writeAccess: false });

    expect(agent.currentModel()).toBe("Opus 5.5");
  });

  it("shows the selected alias until Claude resolves it", () => {
    const agent = new ClaudeAgent();
    agent.setModel("sonnet");
    expect(agent.currentModel()).toBe("Sonnet");
    expect(agent.hasExplicitModel()).toBe(true);
  });

  it("explains when automatic selection has not yet resolved", () => {
    expect(new ClaudeAgent().currentModel()).toBe("auto (detected on first turn)");
  });

  it("keeps the complete assistant message as a fallback", async () => {
    queryMock.mockReturnValue(
      messages([
        {
          type: "assistant",
          session_id: "session-1",
          message: { content: [{ type: "text", text: "Complete response" }] },
        },
        successResult(),
      ]) as never,
    );

    const deltas: string[] = [];
    const result = await new ClaudeAgent().send("Topic", {
      cwd: "/tmp",
      writeAccess: false,
      onTextDelta: (delta) => deltas.push(delta),
    });

    expect(deltas).toEqual(["Complete response"]);
    expect(result).toMatchObject({ kind: "success", text: "Complete response" });
  });

  it("turns a session limit into an explicit recoverable error", async () => {
    queryMock.mockReturnValue(
      messages([
        {
          type: "result",
          subtype: "error_during_execution",
          is_error: true,
          session_id: "session-1",
          modelUsage: {},
          errors: ["You've hit your session limit · resets 11:50pm"],
        },
      ]) as never,
    );

    const result = await new ClaudeAgent().send("Topic", { cwd: "/tmp", writeAccess: false });

    expect(result).toMatchObject({ kind: "error" });
    if (result.kind === "error") {
      expect(result.message).toContain("Claude Code limit reached");
      expect(result.message).toContain("/resume");
      expect(result.message).not.toContain("Unknown SDK error");
    }
  });
});

describe("ClaudeAgent — settings by phase", () => {
  beforeEach(() => queryMock.mockReset());

  /**
   * Omitting user settings keeps debate context lean, while the user's project
   * instructions stay in both phases and implementation keeps global tooling.
   */
  it("loads user settings only during implementation", async () => {
    queryMock.mockReturnValue(messages([successResult()]));
    const agent = new ClaudeAgent();
    await agent.send("Apply the specification", { cwd: "/tmp", writeAccess: true });

    const options = queryMock.mock.calls[0]?.[0]?.options;
    expect(options.settingSources).toEqual(["project", "user"]);
    expect(options.tools).toEqual({ type: "preset", preset: "claude_code" });
  });

  it("passes the configured model that Claudex read itself to the SDK", async () => {
    queryMock.mockReturnValue(messages([successResult()]));
    const agent = new ClaudeAgent("opus");
    await agent.send("Topic", { cwd: "/tmp", writeAccess: false });

    expect(queryMock.mock.calls[0]?.[0]?.options.model).toBe("opus");
  });

  /**
   * In debate mode, read-only behavior relies only on `tools` and `canUseTool`:
   * `permissionMode: "plan"` and `allowedTools` do not enforce it in the installed
   * SDK (limits.md, 2026-08-29). This test locks in these settings so an SDK
   * update cannot silently loosen them.
   */
  it("restricts debate to Read, Grep, and Glob under human oversight", async () => {
    queryMock.mockReturnValue(messages([successResult()]));
    const agent = new ClaudeAgent();
    await agent.send("Topic", {
      cwd: "/tmp",
      writeAccess: false,
      onPermissionRequest: async () => ({ behavior: "deny" }),
    });

    const options = queryMock.mock.calls[0]?.[0]?.options;
    expect(options.tools).toEqual(["Read", "Grep", "Glob"]);
    expect(options.permissionMode).toBe("default");
    expect(options.allowedTools).toEqual([]);
    expect(options.settingSources).toEqual(["project"]);
    expect(typeof options.canUseTool).toBe("function");
  });
});
