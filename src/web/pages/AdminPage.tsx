import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import styles from "./AdminPage.module.css";

interface AllowedEmail {
  email: string;
  enabled: boolean;
  addedBy: string;
  addedAt: string;
  updatedBy: string | null;
  updatedAt: string | null;
}

interface AdminList {
  adminEmail: string;
  emails: AllowedEmail[];
  sync: { ok: boolean; at: string } | null;
}

interface MutationResult {
  saved: boolean;
  synced: boolean;
  error?: string;
  unchanged?: boolean;
}

type Filter = "all" | "enabled" | "disabled";

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "No se pudo completar la operación.");
  return payload;
}

async function fetchEmails(): Promise<AdminList> {
  return readJson(await fetch("/api/admin/allowed-emails"));
}

const SYNC_ERROR = "Guardado, pero no se pudo actualizar Cloudflare Access";

export function AdminPage() {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ["admin", "emails"], queryFn: fetchEmails });
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [syncError, setSyncError] = useState<string | null>(null);

  function applyResult(result: MutationResult) {
    setSyncError(result.synced ? null : result.error || SYNC_ERROR);
    void queryClient.invalidateQueries({ queryKey: ["admin", "emails"] });
  }

  const add = useMutation({
    mutationFn: async (email: string) => readJson<MutationResult>(await fetch("/api/admin/allowed-emails", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    })),
    onSuccess: (result) => {
      setDraft("");
      applyResult(result);
    },
  });

  const toggle = useMutation({
    mutationFn: async (input: { email: string; enabled: boolean }) => readJson<MutationResult>(
      await fetch(`/api/admin/allowed-emails/${encodeURIComponent(input.email)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: input.enabled }),
      }),
    ),
    onSuccess: applyResult,
  });

  const sync = useMutation({
    mutationFn: async () => readJson<MutationResult>(await fetch("/api/admin/sync", { method: "POST" })),
    onSuccess: applyResult,
  });

  const emails = list.data?.emails ?? [];
  const normalizedDraft = draft.trim().toLowerCase();
  const existing = emails.find((email) => email.email === normalizedDraft);
  const visible = useMemo(() => emails.filter((email) => {
    if (filter === "enabled") return email.enabled;
    if (filter === "disabled") return !email.enabled;
    return true;
  }), [emails, filter]);

  function onToggle(email: AllowedEmail) {
    if (email.enabled && !window.confirm("¿Deshabilitar este correo? Deja de poder usar la IA, pero sigue en la lista.")) {
      return;
    }
    toggle.mutate({ email: email.email, enabled: !email.enabled });
  }

  const showSyncError = syncError !== null || list.data?.sync?.ok === false;

  return (
    <section className={styles.page} data-testid="admin-page">
      <h2 className={styles.title}>Accesos a la IA</h2>
      <p className={styles.lead}>Los correos deshabilitados siguen en la lista. En esta versión no se borran.</p>

      <form
        className={styles.form}
        data-testid="admin-add-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!normalizedDraft) return;
          if (existing && !existing.enabled) {
            toggle.mutate({ email: existing.email, enabled: true });
            setDraft("");
            return;
          }
          add.mutate(normalizedDraft);
        }}
      >
        <label className={styles.label}>
          Agregar correo
          <input
            className={styles.input}
            type="email"
            required
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="nombre@correo.com"
          />
        </label>
        {existing && !existing.enabled ? (
          <p className={styles.note}>Ese correo ya está en la lista, deshabilitado.</p>
        ) : null}
        {existing?.enabled ? <p className={styles.note}>Ese correo ya está habilitado.</p> : null}
        <button className={styles.primary} type="submit" disabled={add.isPending || toggle.isPending}>
          {existing && !existing.enabled ? "Rehabilitar" : "Agregar"}
        </button>
        {add.error ? <p className={styles.error} role="alert">{add.error.message}</p> : null}
      </form>

      <div className={styles.filters} role="tablist" aria-label="Filtrar correos">
        {([
          ["all", "Todos"],
          ["enabled", "Habilitados"],
          ["disabled", "Deshabilitados"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            className={filter === value ? styles.filterActive : styles.filter}
            data-testid={`admin-filter-${value}`}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {list.isPending ? <p>Cargando accesos...</p> : null}
      {list.error ? <p className={styles.error} role="alert">{list.error.message}</p> : null}

      <ul className={styles.list}>
        {list.data ? (
          <li className={styles.row} data-testid="admin-row-admin">
            <div>
              <p className={styles.email}>{list.data.adminEmail}</p>
              <p className={styles.meta}>Administrador</p>
            </div>
          </li>
        ) : null}
        {visible.map((email) => (
          <li
            key={email.email}
            className={email.enabled ? styles.row : styles.rowDisabled}
            data-testid={`admin-row-${email.email}`}
          >
            <div>
              <p className={styles.email}>{email.email}</p>
              <p className={styles.meta}>Agregado por {email.addedBy} · {email.addedAt}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={email.enabled}
              className={styles.switch}
              data-testid={`admin-switch-${email.email}`}
              onClick={() => onToggle(email)}
            >
              {email.enabled ? "Habilitado" : "Deshabilitado"}
            </button>
          </li>
        ))}
      </ul>

      <div className={styles.sync} data-testid="admin-sync">
        <p className={showSyncError ? styles.error : styles.meta}>
          {showSyncError
            ? SYNC_ERROR
            : list.data?.sync?.ok
              ? `Access sincronizado · ${list.data.sync.at}`
              : "Todavía no se sincronizó con Access"}
        </p>
        <button
          type="button"
          className={styles.secondary}
          data-testid="admin-retry"
          onClick={() => sync.mutate()}
          disabled={sync.isPending}
        >
          Reintentar
        </button>
      </div>
    </section>
  );
}
