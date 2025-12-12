const KEY_ENABLED = "netbarEnabled";
const KEY_OPACITY = "netbarOpacity";
const KEY_DISABLED_SITES = "netbarDisabledSites";

async function getState() {
  const r = await chrome.storage.sync.get({
    [KEY_ENABLED]: true,
    [KEY_OPACITY]: 100,
    [KEY_DISABLED_SITES]: []
  });
  return {
    enabled: !!r[KEY_ENABLED],
    opacity: parseInt(r[KEY_OPACITY]) || 100,
    disabledSites: Array.isArray(r[KEY_DISABLED_SITES]) ? r[KEY_DISABLED_SITES] : []
  };
}

async function saveState(state) {
  const update = {};
  if (state.enabled !== undefined) update[KEY_ENABLED] = state.enabled;
  if (state.opacity !== undefined) update[KEY_OPACITY] = state.opacity;
  if (state.disabledSites !== undefined) update[KEY_DISABLED_SITES] = state.disabledSites;
  await chrome.storage.sync.set(update);
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendStateToTab(state) {
  const tab = await getActiveTab();
  if (tab?.id) {
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: "NETBAR_UPDATE_STATE",
        ...state
      });
    } catch { }
  }
}

(async () => {
  const toggle = document.getElementById("toggle");
  const siteToggle = document.getElementById("siteToggle");
  const opacity = document.getElementById("opacity");
  const opacityVal = document.getElementById("opacityVal");
  const currentDomainEl = document.getElementById("currentDomain");
  const refresh = document.getElementById("refresh");

  // Get current domain
  const tab = await getActiveTab();
  let hostname = "";
  try {
    if (tab?.url) hostname = new URL(tab.url).hostname;
  } catch { }
  currentDomainEl.textContent = hostname || "Unknown";

  // Load initial state
  const state = await getState();

  toggle.checked = state.enabled;
  opacity.value = state.opacity;
  opacityVal.textContent = `${state.opacity}%`;

  const isSiteDisabled = state.disabledSites.includes(hostname);
  siteToggle.checked = !isSiteDisabled; // Checked means ENABLED
  if (!hostname) siteToggle.disabled = true;

  // Event Listeners
  toggle.addEventListener("change", async () => {
    const v = toggle.checked;
    await saveState({ enabled: v });
    await sendStateToTab({ enabled: v });
  });

  siteToggle.addEventListener("change", async () => {
    if (!hostname) return;
    const isEnabled = siteToggle.checked;
    let newDisabledSites = [...state.disabledSites];

    if (isEnabled) {
      // Remove from disabled list
      newDisabledSites = newDisabledSites.filter(h => h !== hostname);
    } else {
      // Add to disabled list
      if (!newDisabledSites.includes(hostname)) {
        newDisabledSites.push(hostname);
      }
    }

    state.disabledSites = newDisabledSites; // Update local state ref
    await saveState({ disabledSites: newDisabledSites });
    await sendStateToTab({ disabledSites: newDisabledSites });
  });

  opacity.addEventListener("input", async () => {
    const v = parseInt(opacity.value);
    opacityVal.textContent = `${v}%`;
    // Real-time update to tab without saving to storage every ms (optional optimization, but simple is fine)
    await sendStateToTab({ opacity: v });
  });

  opacity.addEventListener("change", async () => {
    const v = parseInt(opacity.value);
    await saveState({ opacity: v });
  });

  refresh.addEventListener("click", async () => {
    // Just re-send state to force refresh
    const s = await getState();
    await sendStateToTab(s);
    window.close();
  });
})();
