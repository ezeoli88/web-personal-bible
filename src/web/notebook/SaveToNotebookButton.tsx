import type { BiblePassage } from "../../core/types/ai";
import { notify } from "../../platform/notify";
import { addNotebookEntry, useNotebook, type NotebookKind } from "./notebook";

interface Props {
  passage: BiblePassage;
  kind: NotebookKind;
  title: string;
  content: string;
  className?: string;
}

/** Keeps an AI answer in the study notebook (Guardados → Cuaderno). */
export function SaveToNotebookButton({ passage, kind, title, content, className }: Props) {
  const notebook = useNotebook();
  const saved = notebook.some((entry) => entry.content === content && entry.reference === passage.reference);

  return (
    <button
      type="button"
      className={className}
      disabled={saved || !content.trim()}
      onClick={() => {
        addNotebookEntry({ kind, title, content, passage });
        notify("Guardado en el cuaderno", "Lo encontrás en Guardados → Cuaderno.");
      }}
    >
      {saved ? "En el cuaderno ✓" : "Guardar en el cuaderno"}
    </button>
  );
}
