export interface ChartMargin {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface TooltipExtraRow {
  /** Optional swatch color. Omit for no swatch. */
  color?: string;
  label: string;
  value?: string;
}

export interface TooltipExtraSection {
  /** Section heading rendered as small caps above the rows. */
  title?: string;
  rows: TooltipExtraRow[];
}

export interface TooltipState {
  x: number;
  y: number;
  items: { label: string; value: string; color: string }[];
  /** Optional title rendered above the items (e.g. timestamp). */
  title?: string;
  /** Optional extra sections rendered below the main items. */
  extras?: TooltipExtraSection[];
}

export interface LegendItem {
  label: string;
  color: string;
}
