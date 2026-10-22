import { MarkdownText } from "./MarkdownText";
import styles from "./StreamingText.module.css";

interface Props {
  text: string;
  isStreaming: boolean;
}

export function StreamingText({ text, isStreaming }: Props) {
  if (!isStreaming) return <MarkdownText>{text}</MarkdownText>;
  return (
    <p className={styles.text}>
      {text}
      <span className={styles.cursor} aria-hidden="true">▌</span>
    </p>
  );
}
