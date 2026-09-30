export type Point3 = [number, number, number];

export type ImageGeometry = {
  studyId: string;
  frameId: string;
  origin: Point3;
  columnDirection: Point3;
  rowDirection: Point3;
  columnSpacing: number;
  rowSpacing: number;
  columns: number;
  rows: number;
};

const dot = (a: Point3, b: Point3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const subtract = (a: Point3, b: Point3): Point3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Point3, b: Point3): Point3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function normalOf(geometry: ImageGeometry): Point3 {
  const normal = cross(geometry.columnDirection, geometry.rowDirection);
  const length = Math.hypot(...normal);
  return length > 0 ? normal.map(value => value / length) as Point3 : [0, 0, 0];
}

export function planeLabel(geometry: ImageGeometry | null): string {
  if (!geometry) return '—';
  const axes = normalOf(geometry).map(Math.abs);
  const dominant = axes.indexOf(Math.max(...axes));
  return ['SAG', 'COR', 'AX'][dominant];
}

export function sameCoordinateSpace(a: ImageGeometry, b: ImageGeometry) {
  return !!a.studyId && a.studyId === b.studyId && (!a.frameId || !b.frameId ? !a.frameId && !b.frameId : a.frameId === b.frameId);
}

export function worldAt(geometry: ImageGeometry, x: number, y: number): Point3 {
  return geometry.origin.map((value, index) => value + x * geometry.columnSpacing * geometry.columnDirection[index] + y * geometry.rowSpacing * geometry.rowDirection[index]) as Point3;
}

function clipAxis(start: number, end: number, min: number, max: number, range: [number, number]): boolean {
  const delta = end - start;
  if (Math.abs(delta) < 1e-8) return start >= min && start <= max;
  const first = (min - start) / delta, second = (max - start) / delta;
  range[0] = Math.max(range[0], Math.min(first, second));
  range[1] = Math.min(range[1], Math.max(first, second));
  return range[0] <= range[1];
}

/** Intersection of a source image plane with the finite footprint of a target image. */
export function localizerSegment(target: ImageGeometry, source: ImageGeometry): [Point3, Point3] | null {
  if (!sameCoordinateSpace(target, source)) return null;
  const targetNormal = normalOf(target), sourceNormal = normalOf(source);
  if (Math.hypot(...targetNormal) < .9 || Math.hypot(...sourceNormal) < .9 || Math.abs(dot(targetNormal, sourceNormal)) > .995) return null;
  const a = dot(sourceNormal, target.columnDirection) * target.columnSpacing;
  const b = dot(sourceNormal, target.rowDirection) * target.rowSpacing;
  const c = dot(sourceNormal, subtract(target.origin, source.origin));
  const xMin = -.5, xMax = target.columns - .5, yMin = -.5, yMax = target.rows - .5;
  const points: [number, number][] = [];
  if (Math.abs(b) > 1e-8) for (const x of [xMin, xMax]) {
    const y = -(a * x + c) / b;
    if (y >= yMin - 1e-5 && y <= yMax + 1e-5) points.push([x, y]);
  }
  if (Math.abs(a) > 1e-8) for (const y of [yMin, yMax]) {
    const x = -(b * y + c) / a;
    if (x >= xMin - 1e-5 && x <= xMax + 1e-5) points.push([x, y]);
  }
  if (points.length < 2) return null;
  // Corner intersections can appear twice; choose the two furthest points.
  let first = points[0], second = points[1], distance = 0;
  for (const p of points) for (const q of points) {
    const candidate = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
    if (candidate > distance) { first = p; second = q; distance = candidate; }
  }
  if (distance < 1e-8) return null;
  const worldStart = worldAt(target, first[0], first[1]);
  const worldEnd = worldAt(target, second[0], second[1]);
  const sourcePixel = (world: Point3): [number, number] => {
    const displacement = subtract(world, source.origin);
    return [dot(displacement, source.columnDirection) / source.columnSpacing, dot(displacement, source.rowDirection) / source.rowSpacing];
  };
  const start = sourcePixel(worldStart), end = sourcePixel(worldEnd), range: [number, number] = [0, 1];
  if (!clipAxis(start[0], end[0], -.5, source.columns - .5, range) ||
      !clipAxis(start[1], end[1], -.5, source.rows - .5, range)) return null;
  const interpolate = (t: number): Point3 => worldStart.map((value, index) => value + t * (worldEnd[index] - value)) as Point3;
  return [interpolate(range[0]), interpolate(range[1])];
}

export function closestSlice(imageIds: string[], world: Point3, geometryFor: (imageId: string) => ImageGeometry | null): number | null {
  let nearest: number | null = null, distance = Infinity;
  imageIds.forEach((imageId, index) => {
    const geometry = geometryFor(imageId);
    if (!geometry) return;
    const candidate = Math.abs(dot(normalOf(geometry), subtract(world, geometry.origin)));
    if (candidate < distance) { distance = candidate; nearest = index; }
  });
  return nearest;
}
