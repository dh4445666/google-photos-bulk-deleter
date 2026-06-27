const $dot = document.getElementById('status-dot');
const $statusText = document.getElementById('status-text');
const $errorMsg = document.getElementById('error-msg');
const $startBtn = document.getElementById('start-btn');
const $pauseBtn = document.getElementById('pause-btn');
const $resumeBtn = document.getElementById('resume-btn');
const $stopBtn = document.getElementById('stop-btn');
const $pinBtn = document.getElementById('pin-btn');
const $maxCount = document.getElementById('max-count');

const $deleted = document.getElementById('stat-deleted');
const $speed = document.getElementById('stat-speed');
const $elapsed = document.getElementById('stat-elapsed');
const $eta = document.getElementById('stat-eta');
const $progressFill = document.getElementById('progress-fill');
const $progressLabel = document.getElementById('progress-label');
const $logsContainer = document.getElementById('logs-container');

let currentTabId = null;
let maxCountValue = 500;

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

const formatElapsed = (ms) => {
  const totalSeconds = Math.floor(ms / 1e3);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
};

const formatEta = (ms) => {
  if (ms <= 0) return "0s";
  const totalSeconds = Math.ceil(ms / 1e3);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

const getStatusClass = (status) => {
  switch (status) {
    case "idle": return "";
    case "paused": return "paused";
    case "done": return "done";
    case "error": return "error";
    default: return "running";
  }
};

const getStatusText = (status) => {
  switch (status) {
    case "idle": return "Ready";
    case "selecting": return "Selecting photos…";
    case "deleting": return "Deleting batch…";
    case "scrolling": return "Loading more…";
    case "paused": return "Paused";
    case "done": return "Complete!";
    case "error": return "Error";
    default: return status;
  }
};

const setUIState = (state) => {
  $startBtn.classList.toggle("gpdt-hidden", state !== "idle");
  $pauseBtn.classList.toggle("gpdt-hidden", state !== "running");
  $resumeBtn.classList.toggle("gpdt-hidden", state !== "paused");
  $stopBtn.classList.toggle("gpdt-hidden", state === "idle");
  $maxCount.disabled = (state !== "idle");
};

const addLog = (msg) => {
  const div = document.createElement('div');
  const d = new Date();
  const time = d.getHours().toString().padStart(2, '0') + ':' + 
               d.getMinutes().toString().padStart(2, '0') + ':' + 
               d.getSeconds().toString().padStart(2, '0');
  div.textContent = `[${time}] ${msg}`;
  $logsContainer.appendChild(div);
  $logsContainer.scrollTop = $logsContainer.scrollHeight;
};

const updateUI = (progress) => {
  $deleted.textContent = progress.deleted.toLocaleString();
  const elapsed = progress.startedAt ? Date.now() - progress.startedAt : 0;
  $elapsed.textContent = formatElapsed(elapsed);
  
  if (progress.deleted > 0 && elapsed > 0) {
    const rate = Math.round(progress.deleted / (elapsed / 6e4));
    $speed.textContent = rate.toLocaleString();
    
    if (progress.maxCount > 0) {
      const remaining = progress.maxCount - progress.deleted;
      const etaMs = remaining > 0 ? (remaining / rate) * 6e4 : 0;
      $eta.textContent = formatEta(etaMs);
    }
  } else if (elapsed > 0) {
    $eta.textContent = "Calc...";
    $speed.textContent = "—";
  }

  const percent = progress.maxCount > 0 
      ? Math.min(100, Math.round((progress.deleted / progress.maxCount) * 100))
      : 0;
  $progressFill.style.width = `${percent}%`;
  $progressLabel.textContent = `${percent}%`;

  $dot.className = `gpdt-status-dot ${getStatusClass(progress.status)}`;
  $statusText.textContent = getStatusText(progress.status);
  
  if (progress.status === "error") {
      $errorMsg.style.display = 'block';
      $errorMsg.textContent = progress.error;
  } else {
      $errorMsg.style.display = 'none';
  }

  if (progress.status === "done" || progress.status === "error" || progress.status === "idle") {
    setUIState("idle");
  } else if (progress.status === "paused") {
    setUIState("paused");
  } else {
    setUIState("running");
  }
};

async function sendMessageToTab(action, payload = {}) {
    if (!currentTabId) return;
    try {
        await chrome.tabs.sendMessage(currentTabId, { action, ...payload });
    } catch (err) {
        console.error("Failed to send message:", err);
        if (action === 'start') {
            $errorMsg.style.display = 'block';
            $errorMsg.textContent = "Failed to communicate with the page. Try refreshing Google Photos.";
            setUIState('idle');
        }
    }
}

async function init() {
  const tab = await getCurrentTab();
  if (!tab) return;
  currentTabId = tab.id;
  const url = tab.url || '';

  if (url.startsWith('https://photos.google.com')) {
    $dot.className = 'status-dot ok';
    $statusText.innerHTML = `Ready to clean up photos!`;
    $startBtn.disabled = false;
    
    // Inject content script just in case it wasn't injected by manifest
    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
    }).catch(() => {});
    
    // Request current state from content script
    try {
        const response = await chrome.tabs.sendMessage(currentTabId, { action: 'getState' });
        if (response && response.progress) {
            updateUI(response.progress);
            if (response.progress.maxCount) {
                $maxCount.value = response.progress.maxCount;
            }
        }
    } catch (e) {
        // Expected if script is fresh
    }
  } else {
    $dot.className = 'status-dot warn';
    $statusText.innerHTML = `Not on Google Photos.`;
    $startBtn.disabled = true;
    $errorMsg.style.display = 'block';
    $errorMsg.innerHTML = `Navigate to <strong>photos.google.com</strong> first, then click this extension icon again.`;
  }
}

// Event Listeners
chrome.runtime.onMessage.addListener((message, sender) => {
    if (sender.tab && sender.tab.id === currentTabId) {
        if (message.type === 'progress') {
            updateUI(message.payload);
        } else if (message.type === 'log') {
            addLog(message.payload);
        }
    }
});

$startBtn.addEventListener('click', () => {
    setUIState('running');
    maxCountValue = parseInt($maxCount.value, 10) || 500;
    
    $speed.textContent = "—";
    $deleted.textContent = "0";
    $elapsed.textContent = "0s";
    $eta.textContent = "—";
    $progressFill.style.width = "0%";
    $progressLabel.textContent = "0%";
    $errorMsg.style.display = 'none';
    $logsContainer.innerHTML = '';
    addLog(`Starting deletion (Target: ${maxCountValue})`);
    
    sendMessageToTab('start', { maxCount: maxCountValue });
});

$pauseBtn.addEventListener('click', () => {
    addLog("Pausing...");
    sendMessageToTab('pause');
});

$resumeBtn.addEventListener('click', () => {
    addLog("Resuming...");
    sendMessageToTab('resume');
});

$stopBtn.addEventListener('click', () => {
    addLog("Stopping...");
    sendMessageToTab('stop');
});

$pinBtn.addEventListener('click', () => {
    sendMessageToTab('pinPanel');
    window.close(); // Close popup
});

init();
