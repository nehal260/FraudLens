/* FraudLens boot - wire up the page once every script has loaded */
(function () {
  const R = window.FL_RESULTS;

  // demo banner
  const bar = FL.$("#demoBar");
  let dismissed = false;
  try { dismissed = sessionStorage.getItem("fl-demo-dismissed") === "1"; } catch (e) {}
  if (R.demo && !dismissed) bar.classList.remove("hide");
  FL.$("#demoClose").addEventListener("click", () => {
    bar.classList.add("hide");
    try { sessionStorage.setItem("fl-demo-dismissed", "1"); } catch (e) {}
  });

  FL.bindThreshold();
  FL.$$("input[type=range]").forEach(FL.fillRange);
  FL.tabs.start();
})();
