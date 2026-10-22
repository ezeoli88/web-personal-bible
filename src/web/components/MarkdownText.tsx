import clsx from "clsx";
import { parseMarkdown } from "../../core/lib/markdown";
import styles from "./MarkdownText.module.css";

interface Props {
  children: string;
}

export function MarkdownText({ children }: Props) {
  const segments = parseMarkdown(children);
  if (segments.length === 0) return <p className={styles.text}>{children}</p>;
  return (
    <div className={styles.text}>
      {segments.map((segment, index) => {
        if (segment.text === "\n") return <br key={index} />;
        const className = clsx(
          segment.bold && styles.bold,
          segment.italic && styles.italic,
          segment.heading > 0 && styles.heading,
          segment.heading === 1 && styles.h1,
          segment.heading === 2 && styles.h2,
          segment.heading === 3 && styles.h3,
          segment.heading >= 4 && styles.h4,
        );
        return <span key={index} className={className}>{segment.text}</span>;
      })}
    </div>
  );
}
