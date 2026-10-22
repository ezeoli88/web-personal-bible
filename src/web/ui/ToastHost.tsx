import { useEffect, useState } from "react";
import { subscribeToasts, type ToastMessage } from "../../platform/notify";
import styles from "./ToastHost.module.css";

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => subscribeToasts((toast) => {
    setToasts((current) => [...current, toast]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== toast.id));
    }, 4000);
  }), []);

  if (toasts.length === 0) return null;
  return (
    <div className={styles.host} aria-live="polite">
      {toasts.map((toast) => (
        <p key={toast.id} className={styles.toast} role="status">{toast.message}</p>
      ))}
    </div>
  );
}
