export const measurementTheme = {
  normal: { color: '#ffe45e', width: 2, dash: '' },
  hover: { color: '#56edff', width: 3, dash: '' },
  selected: { color: '#ff83dc', width: 3, dash: '' },
  drawing: { color: '#7dff91', width: 2.5, dash: '5,2' },
  halo: '#071018', markerRadius: 5,
} as const;
export type MeasurementState = 'normal' | 'hover' | 'selected' | 'drawing';
export const measurementState = (drawing: boolean, selected: boolean, hovered: boolean): MeasurementState => drawing ? 'drawing' : selected ? 'selected' : hovered ? 'hover' : 'normal';
export const measurementVariables = {
  '--measure-normal': measurementTheme.normal.color, '--measure-hover': measurementTheme.hover.color,
  '--measure-selected': measurementTheme.selected.color, '--measure-drawing': measurementTheme.drawing.color,
  '--measure-halo': measurementTheme.halo,
};
