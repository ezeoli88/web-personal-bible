// Ported from biblia-ntv-app/src/components/MarkdownText.tsx

export interface ParsedSegment {
  text: string;
  bold: boolean;
  italic: boolean;
  heading: number;
}

/**
 * Parsea texto con formato Markdown básico.
 * Soporta: **bold**, *italic*, ***bold+italic***, # a ###### headings.
 */
export function parseMarkdown(text: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  const lines = text.split("\n");

  lines.forEach((line, lineIndex) => {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const headingLevel = headingMatch[1].length;
      const headingText = headingMatch[2];
      for (const segment of parseInlineFormatting(headingText)) {
        segments.push({ ...segment, heading: headingLevel });
      }
    } else {
      segments.push(...parseInlineFormatting(line));
    }

    if (lineIndex < lines.length - 1) {
      segments.push({ text: "\n", bold: false, italic: false, heading: 0 });
    }
  });

  return segments;
}

export function parseInlineFormatting(text: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
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
      });
    }

    if (match[2]) {
      segments.push({ text: match[2], bold: true, italic: true, heading: 0 });
    } else if (match[3]) {
      segments.push({ text: match[3], bold: true, italic: false, heading: 0 });
    } else if (match[4]) {
      segments.push({ text: match[4], bold: false, italic: true, heading: 0 });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      bold: false,
      italic: false,
      heading: 0,
    });
  }

  return segments;
}
