import { useInput } from "ink";
import { useEffect, useState } from "react";
import type { AvailableModel } from "../../agents/types.js";
import type { AgentId } from "../../types.js";
import { SELECTION_PALETTE_ROWS, SelectionPalette } from "./SelectionPalette.js";

export const MODEL_PICKER_ROWS = SELECTION_PALETTE_ROWS;
const CATALOG_TIMEOUT_MS = 8_000;

/** The two selection steps share the command palette's fixed viewport. */
export function ModelPicker(props: {
  agent: AgentId;
  loadModels: (agent: AgentId, signal: AbortSignal) => Promise<AvailableModel[]>;
  onSelect: (model: string, effort?: string) => void;
  onCancel: () => void;
  width: number;
}) {
  const { agent, loadModels, onSelect, onCancel, width } = props;
  const [models, setModels] = useState<AvailableModel[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [modelIndex, setModelIndex] = useState(0);
  const [effortIndex, setEffortIndex] = useState<number | null>(null);
  const selectedModel = models?.[modelIndex];
  const choosingEffort = effortIndex !== null && selectedModel !== undefined;

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoadError(true);
      controller.abort();
    }, CATALOG_TIMEOUT_MS);
    void loadModels(agent, controller.signal).then(
      (result) => {
        if (!controller.signal.aborted) setModels(result);
      },
      () => {
        if (!controller.signal.aborted) setLoadError(true);
      },
    ).finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [agent, loadModels]);

  const efforts = choosingEffort ? [
    {
      key: "provider-default",
      label: selectedModel.defaultEffort ? `Default (${selectedModel.defaultEffort})` : "Default",
      description: selectedModel.label,
      value: selectedModel.defaultEffort,
    },
    ...selectedModel.efforts.map(({ id, description }) => ({
      key: id,
      label: id,
      description,
      value: id,
    })),
  ] : [];
  const items = choosingEffort ? efforts : (models ?? []).map((model) => ({
    key: `${model.id}:${model.label}`,
    label: model.label,
    description: model.description,
  }));
  const selectedIndex = choosingEffort ? effortIndex : modelIndex;

  useInput((_input, key) => {
    if (key.escape) {
      if (choosingEffort) setEffortIndex(null);
      else onCancel();
      return;
    }
    if (!items.length) return;
    if (key.upArrow || key.downArrow) {
      const delta = key.upArrow ? -1 : 1;
      const nextIndex = (selectedIndex + delta + items.length) % items.length;
      if (choosingEffort) setEffortIndex(nextIndex);
      else setModelIndex(nextIndex);
      return;
    }
    if ((!key.tab && !key.return) || !selectedModel) return;
    if (choosingEffort) onSelect(selectedModel.id, efforts[effortIndex]?.value);
    else if (selectedModel.efforts.length) setEffortIndex(0);
    else onSelect(selectedModel.id);
  });

  const emptyLabel = loadError
    ? `Could not load models. Retry or use /model ${agent} <id>.`
    : models === null ? "Loading models…" : "No models available";

  return (
    <SelectionPalette
      items={items}
      selectedIndex={selectedIndex}
      width={width}
      actionLabel={choosingEffort ? "Tab or Enter set effort" : "Tab or Enter select"}
      escapeLabel={choosingEffort ? "Esc back" : undefined}
      emptyLabel={emptyLabel}
    />
  );
}
