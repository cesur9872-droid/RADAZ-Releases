export type WorldPoint = [number, number, number];

export type ArchMeasurement = { foot: WorldPoint; height: number; angle: number; baseFraction: number };

/** Two base endpoints followed by an apex, measured in the image's world plane. */
export function measureArch([start, end, apex]: WorldPoint[]): ArchMeasurement | null {
  if (!start || !end || !apex) return null;
  const base: WorldPoint = [end[0] - start[0], end[1] - start[1], end[2] - start[2]];
  const left: WorldPoint = [start[0] - apex[0], start[1] - apex[1], start[2] - apex[2]];
  const right: WorldPoint = [end[0] - apex[0], end[1] - apex[1], end[2] - apex[2]];
  const dot = (a: WorldPoint, b: WorldPoint) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const baseSquared = dot(base, base);
  const leftLength = Math.sqrt(dot(left, left)), rightLength = Math.sqrt(dot(right, right));
  if (baseSquared < 1e-6 || leftLength < 1e-3 || rightLength < 1e-3) return null;
  const toApex: WorldPoint = [apex[0] - start[0], apex[1] - start[1], apex[2] - start[2]];
  const position = dot(toApex, base) / baseSquared;
  const foot: WorldPoint = [start[0] + position * base[0], start[1] + position * base[1], start[2] + position * base[2]];
  const height = Math.hypot(apex[0] - foot[0], apex[1] - foot[1], apex[2] - foot[2]);
  const cosine = Math.max(-1, Math.min(1, dot(left, right) / (leftLength * rightLength)));
  return { foot, height, angle: Math.acos(cosine) * 180 / Math.PI, baseFraction: position };
}
