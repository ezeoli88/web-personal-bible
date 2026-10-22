export async function copyText(text: string): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    throw new Error("El portapapeles no está disponible.");
  }
  await navigator.clipboard.writeText(text);
}
