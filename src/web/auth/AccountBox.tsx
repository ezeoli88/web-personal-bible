import { Link } from "@tanstack/react-router";
import styles from "./AccountBox.module.css";

interface Props {
  status: "loading" | "anonymous" | "authenticated";
  email: string | null;
  role: "admin" | "user" | null | undefined;
  returnTo: string;
}

export function AccountBox({ status, email, role, returnTo }: Props) {
  if (status === "loading") {
    return <div className={styles.box} data-testid="account-box">…</div>;
  }

  if (status === "anonymous") {
    const href = `/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
    return (
      <div className={styles.box} data-testid="account-box">
        <a className={styles.link} href={href}>Ingresar</a>
      </div>
    );
  }

  return (
    <div className={styles.box} data-testid="account-box">
      <p className={styles.email}>{email}</p>
      {role === "admin" ? (
        <Link className={styles.link} to="/admin">Administrar accesos</Link>
      ) : null}
      <form method="post" action="/auth/logout">
        <button className={styles.button} type="submit">Salir</button>
      </form>
    </div>
  );
}
