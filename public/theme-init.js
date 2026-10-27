(function () {
  var root = document.documentElement;
  var preference = "light";
  try {
    var stored = localStorage.getItem("theme-mode");
    if (stored === "dark" || stored === "light" || stored === "system") preference = stored;
  } catch (error) {
    preference = "light";
  }
  var mode = preference;
  if (preference === "system") {
    mode = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  root.setAttribute("data-theme", mode);
  // "only" opts out of the browser's forced dark mode (see ThemeProvider).
  var colorScheme = document.querySelector('meta[name="color-scheme"]');
  if (colorScheme) colorScheme.setAttribute("content", "only " + mode);
  // Keep in sync with light/dark background in src/core/theme/index.ts.
  var themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute("content", mode === "dark" ? "#121417" : "#ffffff");
  // Reading text size: keep in sync with FONT_SCALES in ThemeProvider and
  // typography.body (18px / 28px) in src/core/theme/index.ts.
  try {
    var scale = Number(localStorage.getItem("font-scale"));
    if ([0.875, 1.125, 1.25, 1.5].indexOf(scale) !== -1) {
      root.style.setProperty("--font-body-size", 18 * scale + "px");
      root.style.setProperty("--font-body-line-height", 28 * scale + "px");
    }
  } catch (error) {
    // Without storage the default size applies.
  }
})();
