import { useRef, useState, type ReactNode } from "react";
import { parseMarkdownWithOffsets } from "../../core/lib/markdown";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { MarkdownText, segmentClassName } from "./MarkdownText";
import markdownStyles from "./MarkdownText.module.css";
import styles from "./StreamingText.module.css";

interface Props {
  text: string;
  isStreaming: boolean;
}

const FADE_MS = 420;

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

// El retraso queda fijo al montar: cambiar animation-delay con la animación en curso adelanta su progreso.
function Fresh({ age, children }: { age: number; children: string }) {
  const [delay] = useState(age);
  return <span className={styles.fresh} style={{ animationDelay: `-${delay}ms` }}>{children}</span>;
}

export function StreamingText({ text, isStreaming }: Props) {
  const arrivals = useRef<{ text: string; times: number[] }>({ text: "", times: [] });
  const reducedMotion = usePrefersReducedMotion();

  const renderedAt = now();
  const tracked = arrivals.current;
  if (text !== tracked.text) {
    if (!text.startsWith(tracked.text)) tracked.times = [];
    for (let index = tracked.times.length; index < text.length; index += 1) tracked.times.push(renderedAt);
    tracked.text = text;
  }

  if (!isStreaming) return <MarkdownText>{text}</MarkdownText>;

  const lastLineStart = text.lastIndexOf("\n") + 1;
  const pendingHeading = /^#{1,6}\s*$/.test(text.slice(lastLineStart));
  const fade = !reducedMotion;

  return (
    <div className={markdownStyles.text}>
      {parseMarkdownWithOffsets(text).map((segment, index) => {
        if (segment.text === "\n") return <br key={index} />;
        const parts: ReactNode[] = [];
        let run = "";
        let runTime: number | null = null;
        let runStart = 0;
        const flush = () => {
          if (!run) return;
          if (runTime === null) {
            parts.push(run);
          } else {
            // La clave es el índice en el texto fuente: cada fragmento conserva su elemento y su animación.
            const age = Math.max(0, Math.round(renderedAt - runTime));
            parts.push(<Fresh key={runStart} age={age}>{run}</Fresh>);
          }
          run = "";
        };
        for (let offset = 0; offset < segment.text.length; offset += 1) {
          const sourceIndex = segment.start + offset;
          const char = segment.text[offset];
          if (sourceIndex >= lastLineStart) {
            if (pendingHeading) continue;
            if (!segment.bold && !segment.italic && char === "*") continue;
          }
          const arrived = tracked.times[sourceIndex];
          const time = fade && arrived !== undefined && renderedAt - arrived < FADE_MS ? arrived : null;
          if (time !== runTime) {
            flush();
            runTime = time;
            runStart = sourceIndex;
          }
          run += char;
        }
        flush();
        if (parts.length === 0) return null;
        return <span key={index} className={segmentClassName(segment)}>{parts}</span>;
      })}
      <span className={styles.caret} aria-hidden="true" data-testid="streaming-caret" />
    </div>
  );
}
