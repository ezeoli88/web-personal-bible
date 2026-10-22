import {
  borderRadius,
  darkTheme,
  lightTheme,
  spacing,
  typography,
  type Theme,
  type ThemeMode,
} from "./index";

function px(value: number): string {
  return `${value}px`;
}

function themeBlock(mode: ThemeMode, theme: Theme): string {
  const lines = [`:root[data-theme="${mode}"] {`];
  for (const [name, value] of Object.entries(theme.colors)) {
    lines.push(`  --color-${name}: ${value};`);
  }
  for (const [name, value] of Object.entries(spacing)) {
    lines.push(`  --space-${name}: ${px(value)};`);
  }
  for (const [name, value] of Object.entries(borderRadius)) {
    lines.push(`  --radius-${name}: ${px(value)};`);
  }
  for (const [name, value] of Object.entries(typography)) {
    const token = name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    for (const [prop, propValue] of Object.entries(value)) {
      const cssProp = prop === "fontSize" ? "size" : prop === "fontWeight" ? "weight" : prop === "lineHeight" ? "line-height" : prop;
      const cssValue = prop === "fontSize" || prop === "lineHeight" ? px(propValue as number) : String(propValue);
      lines.push(`  --font-${token}-${cssProp}: ${cssValue};`);
    }
  }
  lines.push("}");
  return lines.join("\n");
}

export function renderThemeCss(): string {
  return `${themeBlock("light", lightTheme)}\n\n${themeBlock("dark", darkTheme)}\n`;
}
