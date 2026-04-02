export interface ChartMargin {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface TooltipState {
  x: number;
  y: number;
  items: { label: string; value: string; color: string }[];
}

export interface LegendItem {
  label: string;
  color: string;
}
