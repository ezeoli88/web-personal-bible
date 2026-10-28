import styles from "./LoginPrompt.module.css";

interface Props {
  onLogin: () => void;
  message?: string;
}

export function LoginPrompt({ onLogin, message = "Iniciá sesión para usar la IA" }: Props) {
  return (
    <div className={styles.container} data-testid="login-prompt">
      <p className={styles.message}>{message}</p>
      <button type="button" className={styles.button} onClick={onLogin}>
        Ingresar con tu correo
      </button>
    </div>
  );
}
