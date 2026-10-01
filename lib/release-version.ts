/** An older archive service can report the already-running web release as an update. */
export function isNewerRelease(candidate: string | undefined, current: string) {
  if (!candidate || !/^\d+\.\d+\.\d+$/.test(candidate) || !/^\d+\.\d+\.\d+$/.test(current)) return false;
  const latest = candidate.split('.').map(Number), installed = current.split('.').map(Number);
  for (let index = 0; index < 3; index++) {
    if (latest[index] !== installed[index]) return latest[index] > installed[index];
  }
  return false;
}
