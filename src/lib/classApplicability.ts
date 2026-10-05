import type { EditorDict } from "@/i18n/editor";

// which picker groups have an effect on the selected element, following each CSS
// property's "Applies to" (MDN / CSS specs). Values are read from a stand-in of the
// element (see ElementInspector) because the lifted element is position:fixed, which
// blockifies its display.
export type ElementContext = {
  tag: string;
  display: string;
  parentDisplay: string;
  position: string;
  overflow: string;
  columnCount: string;
};

export type Needs =
  | "flex-container"
  | "grid-container"
  | "flex-or-grid-container"
  | "gap-container"
  | "flex-item"
  | "flex-or-grid-item"
  | "grid-item"
  | "self-alignable"
  | "positioned"
  | "z-index"
  | "replaced"
  | "list"
  | "inline-or-cell"
  | "scroll-container"
  | "not-inline"
  | "block-container"
  | "floatable";

// object-fit / object-position apply to these; form controls are also sized like replaced boxes
const MEDIA = new Set(["img", "video", "iframe", "embed", "object", "canvas"]);
const REPLACED = new Set([...MEDIA, "input", "select", "textarea", "button"]);
const isFlex = (d: string) => d === "flex" || d === "inline-flex";
const isGrid = (d: string) => d === "grid" || d === "inline-grid";
// width/height, vertical margins, transforms, overflow… skip non-replaced inline boxes
const isInlineBox = (c: ElementContext) => c.display === "inline" && !REPLACED.has(c.tag);

export type BlockReason = keyof EditorDict["applicability"];

// the reason key (worded by the editor dictionary) when the group has no effect, else null
export function blockedReason(needs: Needs | undefined, c: ElementContext | undefined): BlockReason | null {
  if (!needs || !c) return null;
  const flexOrGrid = (d: string) => isFlex(d) || isGrid(d);
  switch (needs) {
    case "flex-container":
      return isFlex(c.display) ? null : "flexContainer";
    case "grid-container":
      return isGrid(c.display) ? null : "gridContainer";
    case "flex-or-grid-container":
      return flexOrGrid(c.display) ? null : "flexOrGridContainer";
    case "gap-container":
      return flexOrGrid(c.display) || c.columnCount !== "auto" ? null : "gapContainer";
    case "flex-item":
      return isFlex(c.parentDisplay) ? null : "flexItem";
    case "flex-or-grid-item":
      return flexOrGrid(c.parentDisplay) ? null : "flexOrGridItem";
    case "grid-item":
      return isGrid(c.parentDisplay) ? null : "gridItem";
    case "self-alignable":
      return flexOrGrid(c.parentDisplay) || c.position === "absolute" || c.position === "fixed"
        ? null
        : "selfAlignable";
    case "positioned":
      return c.position !== "static" ? null : "positioned";
    case "z-index":
      return c.position !== "static" || flexOrGrid(c.parentDisplay) ? null : "zIndex";
    case "replaced":
      return MEDIA.has(c.tag) ? null : "replaced";
    case "list":
      return c.display === "list-item" || ["ul", "ol", "li", "menu"].includes(c.tag) ? null : "list";
    case "inline-or-cell":
      return c.display.startsWith("inline") || c.display === "table-cell" ? null : "inlineOrCell";
    case "scroll-container":
      return c.overflow !== "visible" ? null : "scrollContainer";
    case "not-inline":
      return isInlineBox(c) ? "notInline" : null;
    case "block-container":
      return ["block", "inline-block", "list-item", "flow-root", "table-cell"].includes(c.display)
        ? null
        : "blockContainer";
    case "floatable":
      return flexOrGrid(c.parentDisplay) ? "floatable" : null;
  }
}
