export const measurementTheme = {
  normal: { color: '#ffe45e', width: 1.2, dash: '' },
  hover: { color: '#56edff', width: 1.6, dash: '' },
  selected: { color: '#ff83dc', width: 1.6, dash: '' },
  drawing: { color: '#7dff91', width: 1.4, dash: '5,2' },
  halo: '#071018', markerRadius: 5,
} as const;
export type MeasurementState = 'normal' | 'hover' | 'selected' | 'drawing';
export const measurementState = (drawing: boolean, selected: boolean, hovered: boolean): MeasurementState => drawing ? 'drawing' : hovered ? 'hover' : selected ? 'selected' : 'normal';
export const measurementVariables = {
  '--measure-normal': measurementTheme.normal.color, '--measure-hover': measurementTheme.hover.color,
  '--measure-selected': measurementTheme.selected.color, '--measure-drawing': measurementTheme.drawing.color,
  '--measure-halo': measurementTheme.halo,
};
