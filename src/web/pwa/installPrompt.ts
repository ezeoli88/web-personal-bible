import { useSyncExternalStore } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const listeners = new Set<() => void>();
let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;

function emit() {
  for (const listener of listeners) listener();
}

function isPromptEvent(event: Event): event is BeforeInstallPromptEvent {
  const candidate = event as Partial<BeforeInstallPromptEvent>;
  return typeof candidate.prompt === "function" && typeof candidate.userChoice?.then === "function";
}

function onBeforeInstallPrompt(event: Event) {
  if (!isPromptEvent(event)) return;
  if (event.cancelable) event.preventDefault();
  deferred = event;
  installed = false;
  emit();
}

function onAppInstalled() {
  deferred = null;
  installed = true;
  emit();
}

const globalGuard = globalThis as typeof globalThis & { __bibliaInstallPromptBound?: boolean };
if (typeof window !== "undefined" && !globalGuard.__bibliaInstallPromptBound) {
  globalGuard.__bibliaInstallPromptBound = true;
  window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  window.addEventListener("appinstalled", onAppInstalled);
}

export function isRunningStandalone(): boolean {
  try {
    const nav = navigator as Navigator & { standalone?: boolean };
    if (nav.standalone === true) return true;
    if (typeof matchMedia !== "function") return false;
    return matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: fullscreen)").matches;
  } catch {
    return false;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function canInstallNow() {
  return deferred !== null && !installed && !isRunningStandalone();
}

export function useCanInstall(): boolean {
  return useSyncExternalStore(subscribe, canInstallNow, () => false);
}

export async function promptInstall(): Promise<void> {
  const event = deferred;
  if (!event) return;
  try {
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "accepted") installed = true;
  } finally {
    deferred = null;
    emit();
  }
}

export function resetInstallPromptForTests(): void {
  deferred = null;
  installed = false;
  emit();
}
