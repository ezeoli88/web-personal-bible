(function () {
  try {
    var mode = localStorage.getItem("theme-mode");
    if (mode !== "dark" && mode !== "light") mode = "light";
    document.documentElement.setAttribute("data-theme", mode);
  } catch (error) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
