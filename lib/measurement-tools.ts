import * as tools from '@cornerstonejs/tools';
import { measurementState, measurementTheme } from './measurement-theme';

/** Keep Cornerstone hit testing/geometry; apply one theme to every annotation state. */
export function themedMeasurement(Base: any) {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
      const baseStyle = this.getAnnotationStyle.bind(this);
      this.getAnnotationStyle = (context: any) => {
        const annotation = context.annotation;
        const drawing = !!this.editData?.newAnnotation && this.editData.annotation === annotation;
        const state = measurementState(drawing, tools.annotation.selection.isAnnotationSelected(annotation.annotationUID), !!annotation.highlighted);
        const style = measurementTheme[state];
        return { ...baseStyle(context), color: style.color, lineWidth: style.width, lineDash: style.dash, shadow: true };
      };
      if (Base.toolName !== tools.LengthTool.toolName) return;
      const render = this.renderAnnotation.bind(this);
      this.renderAnnotation = (enabled: any, svg: any) => {
        const result = render(enabled, svg);
        const annotations = this.filterInteractableAnnotationsForElement(enabled.viewport.element,
          tools.annotation.state.getAnnotations(Base.toolName, enabled.viewport.element) || []);
        for (const annotation of annotations) {
          const uid = annotation.annotationUID;
          if (!uid || !tools.annotation.visibility.isAnnotationVisible(uid)) continue;
          const style = this.getAnnotationStyle({ annotation, styleSpecifier: { annotationUID: uid, toolName: Base.toolName, viewportId: enabled.viewport.id, toolGroupId: this.toolGroupId } });
          annotation.data.handles.points.forEach((point: number[], index: number) => {
            const [x, y] = enabled.viewport.worldToCanvas(point), r = measurementTheme.markerRadius;
            for (const sign of [-1, 1]) {
              const a: [number, number] = [x-r, y-sign*r], b: [number, number] = [x+r, y+sign*r];
              tools.drawing.drawLine(svg, uid, `end-halo-${index}-${sign}`, a, b, { color: measurementTheme.halo, lineWidth: style.lineWidth + 3 });
              tools.drawing.drawLine(svg, uid, `end-x-${index}-${sign}`, a, b, { color: style.color, lineWidth: style.lineWidth }, `${uid}-endpoint-${index}`);
            }
          });
        }
        return result;
      };
    }
  };
}

export function installMeasurementTheme() {
  const theme = measurementTheme;
  const styles = tools.annotation.config.style.getDefaultToolStyles();
  tools.annotation.config.style.setDefaultToolStyles({ ...styles, global: { ...styles.global,
    color: theme.normal.color, colorHighlighted: theme.hover.color, colorSelected: theme.selected.color,
    lineWidth: String(theme.normal.width), lineWidthHighlighted: String(theme.hover.width), lineWidthSelected: String(theme.selected.width),
    textBoxColor: theme.normal.color, textBoxColorHighlighted: theme.hover.color, textBoxColorSelected: theme.selected.color,
    textBoxBackground: '#071018df', shadow: true,
  } });
}
