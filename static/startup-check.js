// Runs before Dante, in the oldest JavaScript every Mac can read, so it works even where Dante
// cannot start (such as an old Safari engine on macOS 10.15). It keeps the errors that happen,
// and if Dante has not started after a few seconds, or an error stops it, it shows them as a
// report the writer can copy and send, instead of an empty window. Dante's settings offer the
// same report later (window.danteReport).
(function () {
  "use strict";
  var errors = [];
  var started = false;
  var shown = false;
  var version = "";
  var webkit = "";
  var italian = /^it/i.test(navigator.language || "");

  function text(it, en) {
    return italian ? it : en;
  }

  function record(message, where, stack) {
    if (errors.length >= 20) errors.shift();
    errors.push({ time: new Date().toISOString(), message: String(message), where: where || "", stack: stack ? String(stack).slice(0, 2000) : "" });
  }

  window.addEventListener("error", function (event) {
    var where = event.filename ? event.filename.replace(/^.*\/_app\//, "_app/") + ":" + event.lineno + ":" + event.colno : "";
    record(event.message || (event.target && event.target.src ? "Not loaded: " + event.target.src : "Error"), where, event.error && event.error.stack);
    if (!started) setTimeout(show, 500);
  }, true);

  window.addEventListener("unhandledrejection", function (event) {
    var reason = event.reason;
    record("Unhandled: " + (reason && reason.message ? reason.message : reason), "", reason && reason.stack);
    if (!started) setTimeout(show, 500);
  });

  /** What the page's engine can do, which tells its Safari version on the Mac. */
  function features() {
    function has(test) {
      try {
        return test() ? "yes" : "no";
      } catch (e) {
        return "no";
      }
    }
    var css = window.CSS && CSS.supports ? CSS.supports.bind(CSS) : function () { return false; };
    function parses(code) {
      return function () {
        new Function(code);
        return true;
      };
    }
    return [
      "optional chaining (Safari 13.1): " + has(parses("var a = {}; return a?.b;")),
      "class fields (Safari 14): " + has(parses("return class { a = 1 };")),
      "static class fields (Safari 14.1): " + has(parses("return class { static a = 1 };")),
      "WeakRef (Safari 14.1): " + has(function () { return window.WeakRef; }),
      "Array.at (Safari 15.4): " + has(function () { return [].at; }),
      "structuredClone (Safari 15.4): " + has(function () { return window.structuredClone; }),
      "regex lookbehind (Safari 16.4): " + has(function () { return new RegExp("(?<=a)b").test("ab"); }),
      "DecompressionStream (Safari 16.4): " + has(function () { return window.DecompressionStream; }),
      "color-mix (Safari 16.2): " + has(function () { return css("color", "color-mix(in srgb, red 50%, blue)"); }),
      "container queries (Safari 16): " + has(function () { return css("container-type", "inline-size"); }),
      ":has() (Safari 15.4): " + has(function () { return css("selector(:has(a))"); }),
      "dialog (Safari 15.4): " + has(function () { return window.HTMLDialogElement; }),
    ];
  }

  function report() {
    var lines = [
      "Dante – " + text("rapporto di avvio", "start-up report"),
      text("Data", "Date") + ": " + new Date().toISOString(),
      text("Versione di Dante", "Dante version") + ": " + (version || "?"),
      "WebKit: " + (webkit || "?"),
      text("Avviato", "Started") + ": " + (started ? "yes" : "no"),
      "User agent: " + navigator.userAgent,
      text("Lingua", "Language") + ": " + navigator.language,
      text("Schermo", "Screen") + ": " + screen.width + "×" + screen.height + " @" + (window.devicePixelRatio || 1),
      "",
      text("Funzioni del motore", "Engine features") + ":",
    ].concat(features().map(function (f) { return "  " + f; }), ["", text("Errori", "Errors") + ": " + (errors.length ? "" : text("nessuno", "none"))]);
    errors.forEach(function (e, i) {
      lines.push("  " + (i + 1) + ". [" + e.time + "] " + e.message + (e.where ? " (" + e.where + ")" : ""));
      if (e.stack) lines.push("     " + e.stack.split("\n").slice(0, 8).join("\n     "));
    });
    lines.push("", text("macOS e Safari (da scrivere a mano)", "macOS and Safari (write them by hand)") + ":", "  macOS: ", "  Safari: ");
    return lines.join("\n");
  }

  function copy(area, button) {
    area.select();
    function done() {
      button.textContent = text("Copiato", "Copied");
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(area.value).then(done, function () {
        if (document.execCommand("copy")) done();
      });
    } else if (document.execCommand("copy")) done();
  }

  function show() {
    if (started || shown || !document.body) return;
    shown = true;
    var box = document.createElement("div");
    box.setAttribute("style", "position:fixed;inset:0;top:0;left:0;right:0;bottom:0;z-index:2147483647;overflow:auto;background:#fff;color:#222;font:14px/1.5 -apple-system,Helvetica,Arial,sans-serif;padding:32px");
    var title = document.createElement("h1");
    title.setAttribute("style", "font:400 26px Georgia,serif;margin:0 0 12px");
    title.textContent = text("Dante non è riuscito ad avviarsi", "Dante could not start");
    var help = document.createElement("p");
    help.setAttribute("style", "max-width:640px;margin:0 0 16px");
    help.textContent = text(
      "Copia il rapporto qui sotto e mandalo a chi ti ha dato Dante: serve a capire cosa manca su questo computer. Aggiungi in fondo la versione di macOS (menu Mela › Informazioni su questo Mac) e quella di Safari (Safari › Informazioni su Safari).",
      "Copy the report below and send it to whoever gave you Dante: it shows what this computer is missing. Add at the end the macOS version (Apple menu › About This Mac) and the Safari version (Safari › About Safari)."
    );
    var area = document.createElement("textarea");
    area.readOnly = true;
    area.value = report();
    area.setAttribute("style", "display:block;width:100%;max-width:820px;height:50vh;font:12px/1.4 Menlo,monospace;padding:8px;border:1px solid #bbb;border-radius:4px;box-sizing:border-box");
    var button = document.createElement("button");
    button.textContent = text("Copia il rapporto", "Copy the report");
    button.setAttribute("style", "margin-top:12px;font-size:14px;padding:6px 14px");
    button.onclick = function () {
      area.value = report();
      copy(area, button);
    };
    box.appendChild(title);
    box.appendChild(help);
    box.appendChild(area);
    box.appendChild(button);
    document.body.appendChild(box);
  }

  // The version comes from the app, when its bridge is there.
  try {
    var internals = window.__TAURI_INTERNALS__;
    if (internals && internals.invoke) {
      internals.invoke("plugin:app|version").then(function (v) { version = String(v); }, function () {});
      internals.invoke("webkit_info").then(function (v) { webkit = String(v); }, function () {});
    }
  } catch (e) {
    // No version in the report.
  }

  /** Dante calls it once its first screen is on: from then on no report appears by itself. */
  window.danteStarted = function () {
    started = true;
  };
  window.danteReport = report;
  setTimeout(show, 15000);
})();
