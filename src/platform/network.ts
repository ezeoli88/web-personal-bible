export async function isOnline(): Promise<boolean> {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}
