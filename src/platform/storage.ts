export function readStorage(key: string): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(key);
  } catch (error) {
    console.warn("[storage] No se pudo leer", key, error);
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn("[storage] No se pudo guardar", key, error);
  }
}
