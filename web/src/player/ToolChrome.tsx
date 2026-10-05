import type { Lesson } from "@pire/content";
import { getFile } from "@pire/content";
import { toolOf } from "../engine/lesson";
import { cx } from "../ui/bits";
import { useTarget, useView } from "./view";

const TOOL_NAMES = { x64dbg: "x64dbg", hex: "Hex viewer", pe: "PE viewer" } as const;
const MENUS = {
  hex: ["File", "Edit", "Search", "View", "Analysis", "Tools", "Window", "Help"],
  pe: ["File", "Settings", "View", "Compare", "Info"],
};

/** Title, menu, and the tabs that switch tools and files for the hex viewer and the PE viewer. */
export function ToolChrome({ lesson }: { lesson: Lesson }) {
  const view = useView();
  const tool = toolOf(view.session);
  if (tool === "x64dbg") return null;
  const file = view.file!;
  const tools = lesson.workbench?.tools ?? [];
  const files = lesson.workbench?.files ?? [];
  return (
    <div className="flex shrink-0 flex-col bg-panel select-none">
      <div className="flex h-6.5 items-center justify-center border-b border-line text-xs text-muted" data-testid="window-title">
        {(tool === "hex" ? "pire hex viewer - " : "PE viewer - ") + file.name}
      </div>
      <div className="flex h-6 items-center border-b border-line px-1.5 text-xs">
        {MENUS[tool].map((m) => (
          <span key={m} className="px-1.75 py-0.5 text-faint">
            {m}
          </span>
        ))}
      </div>
      {(tools.length > 1 || files.length > 1) && (
        <div className="flex h-7 items-end gap-4 border-b border-line px-1">
          {tools.length > 1 && (
            <div className="flex items-end gap-px" role="tablist" aria-label="Tools">
              {tools.map((t) => (
                <SwitchTab key={t} id={"tool:" + t} label={TOOL_NAMES[t]} active={tool === t} />
              ))}
            </div>
          )}
          {files.length > 1 && (
            <div className="flex items-end gap-px" role="tablist" aria-label="Files">
              {files.map((f) => (
                <SwitchTab key={f} id={"file:" + f} label={getFile(f).name} active={file.id === f} mono />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SwitchTab({ id, label, active, mono }: { id: string; label: string; active: boolean; mono?: boolean }) {
  const view = useView();
  const pane = view.session.tool === "pe" ? "petree" : "hex";
  const { props } = useTarget(id, pane, cx("rounded-t-sm px-3 py-1 text-[11px]/4 whitespace-nowrap", mono && "font-mono"));
  return (
    <span {...props} role="tab" aria-selected={active} className={cx(props.className, active ? "bg-raised text-fg" : "text-muted hover:text-fg")}>
      {label}
    </span>
  );
}

