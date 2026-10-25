import { useRef, type ReactNode } from "react";
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
        const flush = () => {
          if (!run) return;
          if (runTime === null) {
            parts.push(run);
          } else {
            const age = Math.max(0, Math.round(renderedAt - runTime));
            parts.push(
              <span key={parts.length} className={styles.fresh} style={{ animationDelay: `-${age}ms` }}>{run}</span>,
            );
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
