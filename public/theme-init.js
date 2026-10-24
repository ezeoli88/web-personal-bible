(function () {
  var mode = "light";
  try {
    var stored = localStorage.getItem("theme-mode");
    if (stored === "dark" || stored === "light") mode = stored;
  } catch (error) {
    mode = "light";
  }
  document.documentElement.setAttribute("data-theme", mode);
  // "only" opts out of the browser's forced dark mode (see ThemeProvider).
  var colorScheme = document.querySelector('meta[name="color-scheme"]');
  if (colorScheme) colorScheme.setAttribute("content", "only " + mode);
  // Keep in sync with light/dark background in src/core/theme/index.ts.
  var themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute("content", mode === "dark" ? "#121417" : "#ffffff");
})();
