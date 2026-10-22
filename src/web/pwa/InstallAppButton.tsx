import { promptInstall, useCanInstall } from "./installPrompt";
import styles from "./InstallAppButton.module.css";

export function InstallAppButton() {
  const canInstall = useCanInstall();
  if (!canInstall) return null;
  return (
    <button type="button" className={styles.button} data-testid="install-app" onClick={() => void promptInstall()}>
      Instalar app
    </button>
  );
}
