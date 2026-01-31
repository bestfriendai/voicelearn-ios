import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Component } from "../types";
import { getTypeColors, getLanguageColor, formatNumber } from "../utils/layout";
import { useArchStore } from "../store";

interface ComponentNodeData {
  component: Component;
  [key: string]: unknown;
}

export const ComponentNode = memo(function ComponentNode({
  data,
  selected,
}: NodeProps) {
  const { component } = data as ComponentNodeData;
  const { selectComponent, drillInto, darkMode } = useArchStore();
  const colors = getTypeColors(component.type, darkMode);
  const hasChildren = component.children.length > 0 || component.files.length > 0;
  const langColor = component.language ? getLanguageColor(component.language) : null;

  return (
    <div
      className={`
        relative rounded-xl border-2 backdrop-blur-sm
        min-w-[240px] max-w-[320px]
        ${colors.bg} ${colors.border}
        ${selected ? "node-selected" : ""}
        hover:scale-[1.02] transition-transform duration-150
        cursor-pointer
      `}
      onClick={() => selectComponent(component.id)}
      onDoubleClick={() => hasChildren && drillInto(component)}
    >
      <Handle type="target" position={Position.Left} className="!bg-zinc-500 !w-2 !h-2 !border-0" />
      <Handle type="source" position={Position.Right} className="!bg-zinc-500 !w-2 !h-2 !border-0" />

      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold text-sm truncate ${darkMode ? "text-zinc-100" : "text-zinc-900"}`}>
              {component.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${colors.badge}`}>
                {component.type}
              </span>
              {component.framework && (
                <span className={`text-[10px] ${darkMode ? "text-zinc-500" : "text-zinc-400"}`}>
                  {component.framework}
                </span>
              )}
            </div>
          </div>
          {hasChildren && (
            <button
              className={`
                shrink-0 w-6 h-6 rounded-lg flex items-center justify-center
                text-xs font-bold
                ${darkMode ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200" : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300"}
              `}
              onClick={(e) => {
                e.stopPropagation();
                drillInto(component);
              }}
              title="Drill into component"
            >
              &darr;
            </button>
          )}
        </div>
      </div>

      {/* Metrics bar */}
      <div className={`px-4 pb-3 flex items-center gap-3 text-[11px] ${darkMode ? "text-zinc-500" : "text-zinc-400"}`}>
        {langColor && (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: langColor }} />
            <span>{component.language}</span>
          </div>
        )}
        {component.metrics?.files > 0 && (
          <span>{formatNumber(component.metrics.files)} files</span>
        )}
        {component.metrics?.lines > 0 && (
          <span>{formatNumber(component.metrics.lines)} loc</span>
        )}
        {component.port && (
          <span className={`font-mono ${darkMode ? "text-blue-400" : "text-blue-600"}`}>:{component.port}</span>
        )}
      </div>

      {/* Children indicator */}
      {component.children.length > 0 && (
        <div className={`
          px-4 py-1.5 border-t text-[10px]
          ${darkMode ? "border-zinc-800/50 text-zinc-600" : "border-zinc-200 text-zinc-400"}
        `}>
          {component.children.length} sub-component{component.children.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
});
