import {
  SELECTION_PALETTE_ROWS,
  SelectionPalette,
} from "./SelectionPalette.js";

export interface CommandSuggestion {
  /** Text inserted by Tab. A trailing space leaves the cursor ready for arguments. */
  completion: string;
  /** Compact usage shown in the palette. */
  usage: string;
  description: string;
}

export const COMMAND_PALETTE_ROWS = SELECTION_PALETTE_ROWS;

export const WELCOME_COMMANDS: readonly CommandSuggestion[] = [
  {
    completion: "/model claude ",
    usage: "/model claude",
    description: "choose a Claude model and effort",
  },
  {
    completion: "/model codex ",
    usage: "/model codex",
    description: "choose a Codex model and effort",
  },
  { completion: "/decisions", usage: "/decisions", description: "view confirmed decisions" },
  { completion: "/help", usage: "/help", description: "show all commands" },
  { completion: "/quit", usage: "/quit", description: "quit Claudex" },
] as const;

export const DEBATE_COMMANDS: readonly CommandSuggestion[] = [
  { completion: "/topic", usage: "/topic", description: "show the complete topic" },
  { completion: "/decisions", usage: "/decisions", description: "view confirmed decisions" },
  {
    completion: "/claude ",
    usage: "/claude <text>",
    description: "write to Claude only",
  },
  { completion: "/codex ", usage: "/codex <text>", description: "write to Codex only" },
  { completion: "/pause", usage: "/pause", description: "stop after the current turn" },
  { completion: "/resume", usage: "/resume", description: "resume the automatic debate" },
  { completion: "/cancel", usage: "/cancel", description: "cancel the active turn without losing the session" },
  {
    completion: "/autonomy ",
    usage: "/autonomy unbounded|starts N|time 5m [--remember]",
    description: "explicitly set the automatic window",
  },
  {
    completion: "/accept-topic",
    usage: "/accept-topic",
    description: "manually accept a topic after a protocol error",
  },
  {
    completion: "/model claude ",
    usage: "/model claude",
    description: "choose a Claude model and effort",
  },
  {
    completion: "/model codex ",
    usage: "/model codex",
    description: "choose a Codex model and effort",
  },
  {
    completion: "/handoff",
    usage: "/handoff",
    description: "generate the implementation prompt",
  },
  {
    completion: "/implement ",
    usage: "/implement [agent] [details]",
    description: "switch to implementation",
  },
  {
    completion: "/decide ",
    usage: "/decide <topic> | <approach>",
    description: "record a decision",
  },
  { completion: "/limit ", usage: "/limit <text>", description: "record a constraint" },
  { completion: "/save", usage: "/save", description: "save a snapshot" },
  { completion: "/new", usage: "/new", description: "start a new topic" },
  { completion: "/retry", usage: "/retry", description: "retry a failed shutdown or archive" },
  { completion: "/help", usage: "/help", description: "show all commands" },
  { completion: "/quit", usage: "/quit", description: "save and quit" },
  {
    completion: "/emergency-exit",
    usage: "/emergency-exit",
    description: "quit without an archive guarantee",
  },
] as const;

export function matchingCommands(
  commands: readonly CommandSuggestion[],
  value: string,
): readonly CommandSuggestion[] {
  if (!value.startsWith("/")) return [];
  const query = value.toLowerCase();
  return commands.filter((command) => command.completion.toLowerCase().startsWith(query));
}

/** Keep an explicit no-result state for a command name, then close once arguments begin. */
export function isCommandPaletteEligible(
  value: string,
  matches: readonly CommandSuggestion[],
): boolean {
  return value.startsWith("/") && (matches.length > 0 || !/\s/.test(value));
}

export function CommandPalette(props: {
  commands: readonly CommandSuggestion[];
  selectedIndex: number;
  width: number;
}) {
  return (
    <SelectionPalette
      items={props.commands.map((command) => ({
        key: command.completion,
        label: command.usage,
        description: command.description,
      }))}
      selectedIndex={props.selectedIndex}
      width={props.width}
      actionLabel="Tab complete"
      emptyLabel="No matching commands"
    />
  );
}
