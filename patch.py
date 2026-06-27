import sys

with open("content.js", "r", encoding="utf-8") as f:
    code = f.read()

# 1. Update updatePinnedPanelUI
code = code.replace("""
    if (progress.deleted > 0 && elapsed > 0) {
      const rate = Math.round(progress.deleted / (elapsed / 6e4));
      $speed.textContent = rate.toLocaleString();
    }
    $dot.className = `gpdt-status-dot ${getStatusClass(progress.status)}`;
    $statusText.textContent = getStatusText(progress.status);
  };
""", """
    if (progress.deleted > 0 && elapsed > 0) {
      const rate = Math.round(progress.deleted / (elapsed / 6e4));
      $speed.textContent = rate.toLocaleString();
    } else if (elapsed > 0) {
      $speed.textContent = "Calc...";
    }
    $dot.className = `gpdt-status-dot ${getStatusClass(progress.status)}`;
    $statusText.textContent = getStatusText(progress.status);
    
    // Toggle start/stop buttons if they exist
    if (panel._startBtn && panel._stopBtn) {
        if (progress.status === "idle" || progress.status === "done" || progress.status === "error") {
            panel._startBtn.style.display = "block";
            panel._stopBtn.style.display = "none";
            panel._maxCountInput.disabled = false;
        } else {
            panel._startBtn.style.display = "none";
            panel._stopBtn.style.display = "block";
            panel._maxCountInput.disabled = true;
        }
    }
  };
""")

# 2. Update chrome.runtime calls
code = code.replace("""
  const broadcastProgress = (progress) => {
      lastProgress = { ...progress, maxCount: engine?.config?.maxCount || lastProgress.maxCount };
      try {
          chrome.runtime.sendMessage({ type: 'progress', payload: lastProgress }).catch(() => {});
      } catch (e) {
          // Extension context might be invalidated if updated, or popup closed.
      }
      updatePinnedPanelUI(lastProgress);
  };

  const broadcastLog = (msg) => {
      console.log(LOG, msg);
      try {
          chrome.runtime.sendMessage({ type: 'log', payload: msg }).catch(() => {});
      } catch (e) {}
  };
""", """
  const broadcastProgress = (progress) => {
      lastProgress = { ...progress, maxCount: engine?.config?.maxCount || lastProgress.maxCount };
      try {
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
              chrome.runtime.sendMessage({ type: 'progress', payload: lastProgress }).catch(() => {});
          }
      } catch (e) {}
      updatePinnedPanelUI(lastProgress);
  };

  const broadcastLog = (msg) => {
      console.log(LOG, msg);
      try {
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
              chrome.runtime.sendMessage({ type: 'log', payload: msg }).catch(() => {});
          }
      } catch (e) {}
  };
""")

# 3. Update listener and add init function
code = code.replace("""
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
""", """
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
""")

code = code.replace("""
      } else if (request.action === 'pinPanel') {
          createPinnedPanel();
          updatePinnedPanelUI(lastProgress);
      }
  });

})();
""", """
      } else if (request.action === 'pinPanel') {
          createPinnedPanel();
          updatePinnedPanelUI(lastProgress);
      }
      });
  }

  // Expose init for standalone python script
  window.initStandaloneBulkDeleter = () => {
      createPinnedPanel();
      updatePinnedPanelUI(lastProgress);
  };
})();
""")

# 4. Add UI controls to createPinnedPanel
code = code.replace("""
    content.append(statusBar, stats);
    body.append(header, content);
    panel.append(miniIcon, body);

    document.body.appendChild(panel);
""", """
    const settings = createEl("div", "gpdt-settings");
    settings.style.display = "flex";
    settings.style.justifyContent = "space-between";
    settings.style.alignItems = "center";
    settings.style.fontSize = "12px";
    settings.style.marginBottom = "8px";
    const settingsLabel = createEl("label", "", "Batch size:");
    const maxCountInput = createEl("input", "");
    maxCountInput.type = "number";
    maxCountInput.value = "500";
    maxCountInput.min = "1";
    maxCountInput.style.width = "60px";
    maxCountInput.style.background = "rgba(255,255,255,0.1)";
    maxCountInput.style.color = "#fff";
    maxCountInput.style.border = "1px solid rgba(255,255,255,0.2)";
    maxCountInput.style.borderRadius = "4px";
    maxCountInput.style.padding = "2px 4px";
    settings.append(settingsLabel, maxCountInput);

    const controls = createEl("div", "gpdt-controls");
    controls.style.display = "flex";
    controls.style.gap = "8px";
    controls.style.marginTop = "8px";
    
    const startBtn = createEl("button", "gpdt-btn gpdt-btn-start", "▶ Start");
    startBtn.style.flex = "1";
    startBtn.style.padding = "6px";
    startBtn.style.background = "linear-gradient(135deg, #4f8cff, #6c5ce7)";
    startBtn.style.color = "#fff";
    startBtn.style.border = "none";
    startBtn.style.borderRadius = "6px";
    startBtn.style.cursor = "pointer";

    const stopBtn = createEl("button", "gpdt-btn gpdt-btn-stop", "⏹ Stop");
    stopBtn.style.flex = "1";
    stopBtn.style.padding = "6px";
    stopBtn.style.background = "#ef4444";
    stopBtn.style.color = "#fff";
    stopBtn.style.border = "none";
    stopBtn.style.borderRadius = "6px";
    stopBtn.style.cursor = "pointer";
    stopBtn.style.display = "none";

    controls.append(startBtn, stopBtn);

    content.append(settings, statusBar, stats, controls);
    body.append(header, content);
    panel.append(miniIcon, body);

    document.body.appendChild(panel);
""")

code = code.replace("""
    closeBtn.addEventListener("click", () => {
      panel.remove();
      panel = null;
    });

    return panel;
  };
""", """
    closeBtn.addEventListener("click", () => {
      panel.remove();
      panel = null;
    });

    startBtn.addEventListener("click", () => {
      if (engine && !engine.isStopped) engine.stop();
      const maxCount = parseInt(maxCountInput.value, 10) || 500;
      lastProgress.maxCount = maxCount;
      engine = new DeleteEngine({ maxCount }, broadcastProgress);
      
      engine.on('error', (err) => { broadcastLog(`Error: ${err.message}`); });
      engine.on('done', () => { broadcastLog(`Done.`); });
      
      engine.run().catch(err => broadcastLog(`Fatal error: ${err.message}`));
      startBtn.style.display = "none";
      maxCountInput.disabled = true;
      stopBtn.style.display = "block";
    });

    stopBtn.addEventListener("click", () => {
      if (engine) engine.stop();
      startBtn.style.display = "block";
      maxCountInput.disabled = false;
      stopBtn.style.display = "none";
    });

    // expose controls to global so updateUI can toggle them
    panel._startBtn = startBtn;
    panel._stopBtn = stopBtn;
    panel._maxCountInput = maxCountInput;

    return panel;
  };
""")

with open("content.js", "w", encoding="utf-8") as f:
    f.write(code)

print("Patch applied.")
