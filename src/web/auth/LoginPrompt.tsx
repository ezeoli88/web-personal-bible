import styles from "./LoginPrompt.module.css";

interface Props {
  onLogin: () => void;
}

export function LoginPrompt({ onLogin }: Props) {
  return (
    <div className={styles.container} data-testid="login-prompt">
      <p className={styles.message}>Iniciá sesión para usar la IA</p>
      <button type="button" className={styles.button} onClick={onLogin}>
        Ingresar con tu correo
      </button>
    </div>
  );
}
