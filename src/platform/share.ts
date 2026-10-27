import { copyText } from "./clipboard";

export interface SharePayload {
  title: string;
  text: string;
  url: string;
}

export type ShareResult = "shared" | "copied" | "cancelled";

/** Opens the system share sheet when there is one; otherwise copies the text and the link. */
export async function shareOrCopy(payload: SharePayload): Promise<ShareResult> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share(payload);
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      // Any other refusal (e.g. NotAllowedError) falls back to the clipboard.
    }
  }
  await copyText(`${payload.text}\n${payload.url}`);
  return "copied";
}
