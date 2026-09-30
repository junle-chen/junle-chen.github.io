(function () {
  "use strict";

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function textMatches(card, query) {
    if (!query) {
      return true;
    }
    var haystack = [
      card.dataset.title,
      card.dataset.tags,
      card.dataset.excerpt,
      card.dataset.summary,
      card.dataset.topic
    ].join(" ");
    return haystack.indexOf(query) !== -1;
  }

  function bindNoteSearch() {
    var input = document.getElementById("noteSearch");
    var cards = Array.prototype.slice.call(document.querySelectorAll("[data-note-card]"));
    var empty = document.getElementById("noteEmptyState");
    if (!input || !cards.length) {
      return;
    }

    function apply() {
      var query = input.value.trim().toLowerCase();
      var visible = 0;
      cards.forEach(function (card) {
        var match = textMatches(card, query);
        card.hidden = !match;
        if (match) {
          visible += 1;
        }
      });
      if (empty) {
        empty.hidden = visible !== 0;
      }
    }

    input.addEventListener("input", apply);
    apply();
  }

  function bindPaperFilters() {
    var input = document.getElementById("paperSearch");
    var topic = document.getElementById("paperTopicFilter");
    var cards = Array.prototype.slice.call(document.querySelectorAll("[data-paper-card]"));
    var empty = document.getElementById("paperEmptyState");
    if (!cards.length) {
      if (empty) {
        empty.hidden = false;
      }
      return;
    }

    function apply() {
      var query = input ? input.value.trim().toLowerCase() : "";
      var selected = topic ? topic.value.trim().toLowerCase() : "all";
      var visible = 0;

      cards.forEach(function (card) {
        var topicText = [card.dataset.topic, card.dataset.tags].join(" ");
        var topicMatch = selected === "all" || topicText.indexOf(selected) !== -1;
        var match = topicMatch && textMatches(card, query);
        card.hidden = !match;
        if (match) {
          visible += 1;
        }
      });

      if (empty) {
        empty.hidden = visible !== 0;
      }
    }

    if (input) {
      input.addEventListener("input", apply);
    }
    if (topic) {
      topic.addEventListener("change", apply);
    }
    apply();
  }

  function bindDesktopTerminal() {
    var desktop = document.querySelector(".single-app-desktop");
    var windows = Array.prototype.slice.call(document.querySelectorAll("[data-app-window]"));
    var launchers = Array.prototype.slice.call(document.querySelectorAll("[data-open-app]"));
    var activeMenu = document.getElementById("activeAppMenu");
    var noteSearch = document.getElementById("noteSearch");
    var clock = document.getElementById("macClock");
    var terminalHistory = document.getElementById("terminalHistory");
    var terminalForm = document.getElementById("terminalForm");
    var terminalInput = document.getElementById("terminalInput");
    var labels = {
      finder: "Finder",
      about: "About Me",
      papers: "Paper Radar",
      notes: "Notes",
      memos: "Memos",
      terminal: "Terminal"
    };
    var aliases = {
      finder: "finder",
      home: "finder",
      about: "about",
      "about-me": "about",
      me: "about",
      papers: "papers",
      paper: "papers",
      radar: "papers",
      notes: "notes",
      note: "notes",
      memos: "memos",
      memo: "memos",
      terminal: "terminal",
      shell: "terminal"
    };
    var localActions = {
      zotero: {
        label: "Zotero Connector",
        url: "http://127.0.0.1:23119/connector/ping",
        message: "Opened Zotero Connector ping in a new tab. Zotero Desktop must be running locally."
      },
      obsidian: {
        label: "Obsidian",
        url: "obsidian://open",
        message: "Requested Obsidian through its local URL scheme."
      },
      codex: {
        label: "Codex",
        message: "Codex hooks are local: scripts/update_papers.py, scripts/import_zotero_csl.py, docs/research-workflow.md."
      }
    };

    if (!desktop || !windows.length) {
      return;
    }

    function updateClock() {
      if (!clock) {
        return;
      }
      var formatter = new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit"
      });
      clock.textContent = formatter.format(new Date());
    }

    function appName(value) {
      var key = (value || "").trim().toLowerCase();
      return aliases[key] || "";
    }

    function openApp(name, options) {
      var app = appName(name);
      if (!app) {
        return false;
      }

      windows.forEach(function (win) {
        win.classList.toggle("is-active", win.dataset.appWindow === app);
      });
      launchers.forEach(function (button) {
        var active = appName(button.dataset.openApp) === app;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
      if (activeMenu) {
        activeMenu.textContent = labels[app] || app;
      }
      desktop.dataset.activeApp = app;

      if (!options || options.hash !== false) {
        history.replaceState(null, "", "#" + app);
      }
      if (app === "terminal" && terminalInput) {
        window.setTimeout(function () {
          terminalInput.focus();
        }, 80);
      }
      return true;
    }

    function terminalLine(text, className) {
      if (!terminalHistory) {
        return;
      }
      var line = document.createElement("p");
      if (className) {
        line.className = className;
      }
      line.textContent = text;
      terminalHistory.appendChild(line);
      terminalHistory.scrollTop = terminalHistory.scrollHeight;
    }

    function terminalPrompt(command) {
      if (!terminalHistory) {
        return;
      }
      var line = document.createElement("p");
      var prompt = document.createElement("span");
      prompt.className = "terminal-prompt";
      prompt.textContent = "junle@research ~ % ";
      line.appendChild(prompt);
      line.appendChild(document.createTextNode(command));
      terminalHistory.appendChild(line);
    }

    function visibleNoteCount() {
      return Array.prototype.slice.call(document.querySelectorAll("[data-note-card]")).filter(function (card) {
        return !card.hidden;
      }).length;
    }

    function runCommand(rawCommand) {
      var command = (rawCommand || "").trim();
      var normalized = command.toLowerCase().replace(/\s+/g, " ");
      if (!command) {
        return;
      }
      terminalPrompt(command);

      if (normalized === "clear") {
        terminalHistory.innerHTML = "";
        return;
      }
      if (normalized === "help") {
        terminalLine("Commands: help, status, open [finder|about|papers|notes|memos|terminal|zotero|obsidian|codex], search notes <term>, date, clear.", "terminal-output");
        return;
      }
      if (normalized === "status") {
        terminalLine(
          "notes=" + desktop.dataset.noteCount + " papers=" + desktop.dataset.paperCount + " memos=" + desktop.dataset.memoCount + " active=" + (desktop.dataset.activeApp || "finder"),
          "terminal-output"
        );
        return;
      }
      if (normalized === "date") {
        terminalLine(new Date().toString(), "terminal-output");
        return;
      }

      var openMatch = normalized.match(/^open\s+(.+)$/);
      if (openMatch) {
        var target = openMatch[1].trim();
        var action = localActions[target];
        if (action) {
          if (action.url) {
            window.open(action.url, "_blank", "noopener");
          }
          terminalLine(action.message, "terminal-output");
          return;
        }
        var opened = openApp(target);
        terminalLine(opened ? "Opened " + (labels[appName(target)] || target) + "." : "Unknown app: " + target, opened ? "terminal-output" : "terminal-error");
        return;
      }

      var searchMatch = normalized.match(/^search(?:\s+notes)?\s+(.+)$/);
      if (searchMatch) {
        var term = searchMatch[1].trim();
        openApp("notes");
        if (noteSearch) {
          noteSearch.value = term;
          noteSearch.dispatchEvent(new Event("input", { bubbles: true }));
        }
        terminalLine("Searched notes for \"" + term + "\". Matches: " + visibleNoteCount() + ".", "terminal-output");
        return;
      }

      if (appName(normalized)) {
        openApp(normalized);
        terminalLine("Opened " + (labels[appName(normalized)] || normalized) + ".", "terminal-output");
        return;
      }
      if (localActions[normalized]) {
        if (localActions[normalized].url) {
          window.open(localActions[normalized].url, "_blank", "noopener");
        }
        terminalLine(localActions[normalized].message, "terminal-output");
        return;
      }

      terminalLine("Command not found: " + command + ". Type help.", "terminal-error");
    }

    launchers.forEach(function (button) {
      button.addEventListener("click", function () {
        openApp(button.dataset.openApp);
      });
    });

    function submitTerminalCommand(event) {
      if (event) {
        event.preventDefault();
      }
      if (terminalInput) {
        var command = terminalInput.value;
        terminalInput.value = "";
        runCommand(command);
      }
    }

    if (terminalForm && terminalInput) {
      terminalForm.addEventListener("submit", submitTerminalCommand);
      terminalInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          submitTerminalCommand(event);
        }
      });
    }

    window.JunleOS = {
      openApp: openApp,
      runCommand: runCommand
    };

    var initialHash = window.location.hash ? window.location.hash.slice(1) : "finder";
    openApp(appName(initialHash) ? initialHash : "finder", { hash: false });
    updateClock();
    if (clock) {
      window.setInterval(updateClock, 30000);
    }
  }

  function initParticles() {
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var canvas = document.getElementById("research-particles");
    if (!canvas || reduceMotion) {
      return;
    }

    var ctx = canvas.getContext("2d");
    var points = [];
    var width = 0;
    var height = 0;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var raf = 0;
    var palette = [
      "rgba(37, 99, 235, 0.42)",
      "rgba(15, 159, 149, 0.38)",
      "rgba(225, 29, 72, 0.30)",
      "rgba(196, 125, 14, 0.34)"
    ];

    function resize() {
      width = document.documentElement.clientWidth || window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var count = Math.max(34, Math.min(88, Math.floor((width * height) / 24000)));
      points = Array.from({ length: count }, function (_, index) {
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.18,
          vy: (Math.random() - 0.5) * 0.18,
          size: 1.1 + Math.random() * 1.9,
          color: palette[index % palette.length]
        };
      });
    }

    function step() {
      ctx.clearRect(0, 0, width, height);

      points.forEach(function (point, i) {
        point.x += point.vx;
        point.y += point.vy;
        if (point.x < -20) point.x = width + 20;
        if (point.x > width + 20) point.x = -20;
        if (point.y < -20) point.y = height + 20;
        if (point.y > height + 20) point.y = -20;

        for (var j = i + 1; j < points.length; j += 1) {
          var other = points[j];
          var dx = point.x - other.x;
          var dy = point.y - other.y;
          var distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 135) {
            ctx.strokeStyle = "rgba(15, 23, 42," + (0.09 * (1 - distance / 135)).toFixed(3) + ")";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(point.x, point.y);
            ctx.lineTo(other.x, other.y);
            ctx.stroke();
          }
        }

        ctx.fillStyle = point.color;
        ctx.beginPath();
        ctx.arc(point.x, point.y, point.size, 0, Math.PI * 2);
        ctx.fill();
      });

      raf = window.requestAnimationFrame(step);
    }

    window.addEventListener("resize", resize, { passive: true });
    resize();
    step();

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        window.cancelAnimationFrame(raf);
      } else {
        step();
      }
    });
  }

  ready(function () {
    bindNoteSearch();
    bindPaperFilters();
    bindDesktopTerminal();
    initParticles();
  });
}());
