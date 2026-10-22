(function () {
  var mode = "light";
  try {
    var stored = localStorage.getItem("theme-mode");
    if (stored === "dark" || stored === "light") mode = stored;
  } catch (error) {
    mode = "light";
  }
  document.documentElement.setAttribute("data-theme", mode);
  // Keep in sync with light/dark background in src/core/theme/index.ts.
  var themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute("content", mode === "dark" ? "#121417" : "#ffffff");
})();
