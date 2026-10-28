import { useSyncExternalStore } from "react";
import { notify } from "../../platform/notify";
import { readStorage } from "../../platform/storage";

/**
 * The reader's own data (marks, study notebook and last reading place) lives
 * on the server, under their account. This module keeps the signed-in reader's
 * copy in memory so the UI reads it synchronously, and sends every change to
 * `/api/user-data`. Signed out there is nothing to show or save.
 */

/** Keys where these used to be kept on the device; imported once, then removed. */
export const LEGACY_KEYS = {
  annotations: "verse-annotations",
  notebook: "study-notebook",
  lastReading: "last-reading",
} as const;

export interface ServerUserData {
  annotations: unknown[];
  notebook: unknown[];
  lastReading: unknown;
}

export type UserDataStatus = "signed-out" | "loading" | "ready" | "error";

export interface UserDataState {
  status: UserDataStatus;
  email: string | null;
  data: ServerUserData;
}

const EMPTY: ServerUserData = { annotations: [], notebook: [], lastReading: null };

let state: UserDataState = { status: "signed-out", email: null, data: EMPTY };
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function setState(next: UserDataState) {
  state = next;
  emit();
}

export function getUserDataState(): UserDataState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useUserDataState(): UserDataState {
  return useSyncExternalStore(subscribe, getUserDataState, getUserDataState);
}

/** Replaces one part of the in-memory copy; the stores call it before sending the change. */
export function updateUserData(update: (data: ServerUserData) => ServerUserData) {
  if (state.status !== "ready") return;
  setState({ ...state, data: update(state.data) });
}

function readLegacy(): Partial<ServerUserData> | null {
  const parse = (key: string): unknown => {
    const raw = readStorage(key);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return undefined;
    }
  };
  const annotations = parse(LEGACY_KEYS.annotations);
  const notebook = parse(LEGACY_KEYS.notebook);
  const lastReading = parse(LEGACY_KEYS.lastReading);
  if (annotations === undefined && notebook === undefined && lastReading === undefined) return null;
  return {
    annotations: Array.isArray(annotations) ? annotations : [],
    notebook: Array.isArray(notebook) ? notebook : [],
    lastReading: lastReading ?? null,
  };
}

function clearLegacy() {
  try {
    for (const key of Object.values(LEGACY_KEYS)) localStorage.removeItem(key);
  } catch {
    // Storage blocked: the import already merged without duplicates, so a retry is harmless.
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    let message = "Probá de nuevo en un momento.";
    try {
      const payload = await response.json() as { error?: string };
      if (payload.error) message = payload.error;
    } catch {
      // keep the generic message
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

let loadId = 0;

/** Loads the reader's data, first uploading what an older version left on the device. */
export async function loadUserData(email: string): Promise<void> {
  const id = ++loadId;
  setState({ status: "loading", email, data: EMPTY });
  try {
    const legacy = readLegacy();
    const data = legacy
      ? await request<ServerUserData>("POST", "/api/user-data/import", legacy)
      : await request<ServerUserData>("GET", "/api/user-data");
    if (legacy) clearLegacy();
    if (id === loadId) setState({ status: "ready", email, data });
  } catch {
    if (id === loadId) setState({ status: "error", email, data: EMPTY });
  }
}

export function clearUserData() {
  loadId += 1;
  setState({ status: "signed-out", email: null, data: EMPTY });
}

/**
 * Sends a change already applied in memory. If the server rejects it, the
 * reader is told and the copy is reloaded so the screen matches what was saved.
 */
export async function sendChange(method: "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<void> {
  const email = state.email;
  try {
    await request(method, path, body);
  } catch (error) {
    notify("No se pudo guardar", error instanceof Error ? error.message : "Probá de nuevo en un momento.");
    if (email && state.email === email) await loadUserData(email);
  }
}
