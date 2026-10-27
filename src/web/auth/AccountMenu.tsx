import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import clsx from "clsx";
import { promptInstall, useCanInstall } from "../pwa/installPrompt";
import { DownloadIcon, LoginIcon, LogoutIcon, ShieldIcon, UserIcon } from "../ui/icons";
import styles from "./AccountMenu.module.css";

interface Props {
  status: "loading" | "anonymous" | "authenticated";
  email: string | null;
  role: "admin" | "user" | null | undefined;
  returnTo: string;
}

function roleLabel(role: Props["role"]): string {
  if (role === "admin") return "Administrador";
  if (role === "user") return "IA habilitada";
  return "Sin acceso a la IA";
}

/** The phone top bar's avatar: account, admin and install actions in one menu. */
export function AccountMenu({ status, email, role, returnTo }: Props) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canInstall = useCanInstall();
  const authenticated = status === "authenticated";
  const initial = authenticated ? email?.trim().charAt(0).toUpperCase() ?? "" : "";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        data-testid="account-menu"
        aria-label="Cuenta"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={status === "loading"}
        onClick={() => setOpen(true)}
      >
        {initial ? <span className={styles.avatar}>{initial}</span> : <span className={styles.avatarEmpty}><UserIcon size={18} /></span>}
      </button>
      <dialog
        ref={dialogRef}
        className={styles.menu}
        aria-label="Cuenta"
        onClose={close}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className={styles.inner}>
          {authenticated ? (
            <div className={styles.identity}>
              <span className={clsx(styles.avatar, styles.avatarLarge)} aria-hidden="true">{initial}</span>
              <span className={styles.identityText}>
                <span className={styles.email}>{email}</span>
                <span className={styles.role}>{roleLabel(role)}</span>
              </span>
            </div>
          ) : (
            <p className={styles.anonymous}>Ingresá para usar la IA.</p>
          )}
          <div className={styles.divider} />
          {authenticated && role === "admin" ? (
            <Link className={styles.item} to="/admin" onClick={close}>
              <ShieldIcon size={20} />
              Administrar accesos
            </Link>
          ) : null}
          {canInstall ? (
            <button
              type="button"
              className={styles.item}
              onClick={() => {
                close();
                void promptInstall();
              }}
            >
              <DownloadIcon size={20} />
              Instalar la app
            </button>
          ) : null}
          {authenticated ? (
            <form method="post" action="/auth/logout">
              <button type="submit" className={clsx(styles.item, styles.danger)}>
                <LogoutIcon size={20} />
                Salir
              </button>
            </form>
          ) : (
            <a className={styles.item} href={`/auth/login?returnTo=${encodeURIComponent(returnTo)}`}>
              <LoginIcon size={20} />
              Ingresar
            </a>
          )}
        </div>
      </dialog>
    </>
  );
}
