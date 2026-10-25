// Ported from biblia-ntv-app/src/components/MarkdownText.tsx

export interface ParsedSegment {
  text: string;
  bold: boolean;
  italic: boolean;
  heading: number;
}

export interface OffsetSegment extends ParsedSegment {
  /** Índice en el texto fuente del primer carácter visible del segmento. */
  start: number;
}

/**
 * Parsea texto con formato Markdown básico.
 * Soporta: **bold**, *italic*, ***bold+italic***, # a ###### headings.
 */
export function parseMarkdown(text: string): ParsedSegment[] {
  return parseMarkdownWithOffsets(text).map(({ start: _start, ...segment }) => segment);
}

/** Igual que parseMarkdown, pero cada segmento indica dónde empieza en el texto fuente. */
export function parseMarkdownWithOffsets(text: string): OffsetSegment[] {
  const segments: OffsetSegment[] = [];
  const lines = text.split("\n");
  let lineStart = 0;

  lines.forEach((line, lineIndex) => {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const headingLevel = headingMatch[1].length;
      const headingText = headingMatch[2];
      const offset = lineStart + line.length - headingText.length;
      for (const segment of parseInlineWithOffsets(headingText, offset)) {
        segments.push({ ...segment, heading: headingLevel });
      }
    } else {
      segments.push(...parseInlineWithOffsets(line, lineStart));
    }

    if (lineIndex < lines.length - 1) {
      segments.push({ text: "\n", bold: false, italic: false, heading: 0, start: lineStart + line.length });
    }
    lineStart += line.length + 1;
  });

  return segments;
}

export function parseInlineFormatting(text: string): ParsedSegment[] {
  return parseInlineWithOffsets(text, 0).map(({ start: _start, ...segment }) => segment);
}

function parseInlineWithOffsets(text: string, offset: number): OffsetSegment[] {
  const segments: OffsetSegment[] = [];
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, match.index),
        bold: false,
        italic: false,
        heading: 0,
        start: offset + lastIndex,
      });
    }

    if (match[2]) {
      segments.push({ text: match[2], bold: true, italic: true, heading: 0, start: offset + match.index + 3 });
    } else if (match[3]) {
      segments.push({ text: match[3], bold: true, italic: false, heading: 0, start: offset + match.index + 2 });
    } else if (match[4]) {
      segments.push({ text: match[4], bold: false, italic: true, heading: 0, start: offset + match.index + 1 });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      bold: false,
      italic: false,
      heading: 0,
      start: offset + lastIndex,
    });
  }

  return segments;
}
