import { useId, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { slugifyBookName } from "../../core/lib/bookSlugs";
import { parseReference } from "../../core/lib/referenceParser";
import { formatVerseParam } from "../layout/bookRoute";
import styles from "./GoToReference.module.css";

interface Props {
  /** Called when a valid reference navigates (e.g. to close the sheet that holds the field). */
  onNavigate?: () => void;
}

export function GoToReference({ onNavigate }: Props = {}) {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const errorId = useId();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseReference(value);
    if (!parsed) {
      setError(true);
      return;
    }
    setError(false);
    setValue("");
    onNavigate?.();
    const book = slugifyBookName(parsed.book.name);
    if (parsed.chapter === undefined) {
      void navigate({ to: "/$book", params: { book } });
      return;
    }
    const verses = parsed.verses ? formatVerseParam(parsed.verses) : undefined;
    void navigate({
      to: "/$book/$chapter",
      params: { book, chapter: String(parsed.chapter) },
      search: { v: verses },
      resetScroll: verses === undefined,
    });
  }

  return (
    <form className={styles.form} role="search" onSubmit={onSubmit} data-testid="go-to-reference">
      <input
        className={styles.input}
        type="text"
        inputMode="search"
        enterKeyHint="go"
        autoComplete="off"
        spellCheck={false}
        placeholder="Ir a… (ej.: Jn 3:16)"
        aria-label="Ir a una referencia"
        aria-invalid={error || undefined}
        aria-describedby={error ? errorId : undefined}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setError(false);
        }}
      />
      <button type="submit" className={styles.button} disabled={!value.trim()}>Ir</button>
      {error ? (
        <p id={errorId} className={styles.error} role="alert">
          No reconozco esa referencia. Probá con «Juan 3:16» o «1 Co 13».
        </p>
      ) : null}
    </form>
  );
}
