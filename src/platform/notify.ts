export interface ToastMessage {
  id: string;
  title?: string;
  message: string;
}

type Listener = (toast: ToastMessage) => void;
const listeners = new Set<Listener>();

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notify(title: string, message?: string): void {
  const toast: ToastMessage = {
    id: crypto.randomUUID(),
    title,
    message: message ?? title,
  };
  for (const listener of listeners) listener(toast);
}
