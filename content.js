// content.js — popup enable/disable + sticky top/bottom + opacity + site toggle

const KEY_ENABLED = "netbarEnabled";
const KEY_OPACITY = "netbarOpacity";
const KEY_DISABLED_SITES = "netbarDisabledSites";
const KEY_POSITION = "netbarPosition"; // "top" or "bottom"
const BAR_ID = "__site_netbar__";

const C = {
  label: "#9ca3af",
  myip: "#22d3ee",     // cyan
  domain: "#60a5fa",   // blue
  ip: "#fb923c",       // orange
  ptr: "#c084fc",      // purple
  ns: "#86efac",       // light green
  server: "#f87171",   // red
  sep: "#6b7280"       // gray
};

const s = (t, c, b = false) =>
  `<span style="color:${c};${b ? "font-weight:600" : ""}">${t}</span>`;
const sep = () => ` ${s("|", C.sep)} `;

let state = {
  enabled: true,
  opacity: 100,
  position: "top", // "top" | "bottom"
  disabledSites: [] // array of hostnames
};

async function loadState() {
  const r = await chrome.storage.sync.get({
    [KEY_ENABLED]: true,
    [KEY_OPACITY]: 100,
    [KEY_POSITION]: "top",
    [KEY_DISABLED_SITES]: []
  });

  state.enabled = !!r[KEY_ENABLED];
  state.opacity = parseInt(r[KEY_OPACITY]) || 100;
  state.position = r[KEY_POSITION] === "bottom" ? "bottom" : "top";
  state.disabledSites = Array.isArray(r[KEY_DISABLED_SITES]) ? r[KEY_DISABLED_SITES] : [];
}

function isSiteDisabled() {
  const host = location.hostname;
  return state.disabledSites.includes(host);
}

function shouldShow() {
  return state.enabled && !isSiteDisabled();
}

function ensureBar() {
  let bar = document.getElementById(BAR_ID);
  if (!shouldShow()) {
    if (bar) bar.remove();
    return null;
  }

  if (!bar) {
    bar = document.createElement("div");
    bar.id = BAR_ID;

    // Base styles
    bar.style.position = "fixed";
    bar.style.left = "0";
    bar.style.right = "0";
    bar.style.zIndex = "2147483647";
    bar.style.background = "rgba(10,10,10,0.92)"; // Base opacity, will be overridden
    bar.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    bar.style.fontSize = "12px";
    bar.style.lineHeight = "1.4";
    bar.style.padding = "8px 10px";
    bar.style.borderBottom = "1px solid rgba(255,255,255,.15)";
    bar.style.borderTop = "none";
    bar.style.backdropFilter = "blur(6px)";
    bar.style.whiteSpace = "nowrap";
    bar.style.overflow = "hidden";
    bar.style.textOverflow = "ellipsis";
    bar.style.transition = "opacity 0.2s, top 0.2s, bottom 0.2s";

    // Content container
    const content = document.createElement("span");
    content.id = `${BAR_ID}_c`;
    content.innerHTML = s("NetBar loading…", C.label);

    // Controls container (Right side)
    const controls = document.createElement("div");
    controls.style.float = "right";
    controls.style.display = "flex";
    controls.style.gap = "8px";
    controls.style.alignItems = "center";

    // Up Button
    const btnUp = document.createElement("span");
    btnUp.textContent = "UP";
    btnUp.style.cursor = "pointer";
    btnUp.style.color = "#fff";
    btnUp.style.fontSize = "10px";
    btnUp.style.fontWeight = "bold";
    btnUp.style.background = "rgba(255,255,255,0.2)";
    btnUp.style.padding = "2px 6px";
    btnUp.style.borderRadius = "4px";
    btnUp.title = "Move to Top";
    btnUp.onclick = () => setPosition("top");

    // Down Button
    const btnDown = document.createElement("span");
    btnDown.textContent = "DOWN";
    btnDown.style.cursor = "pointer";
    btnDown.style.color = "#fff";
    btnDown.style.fontSize = "10px";
    btnDown.style.fontWeight = "bold";
    btnDown.style.background = "rgba(255,255,255,0.2)";
    btnDown.style.padding = "2px 6px";
    btnDown.style.borderRadius = "4px";
    btnDown.title = "Move to Bottom";
    btnDown.onclick = () => setPosition("bottom");

    // Close Button
    const close = document.createElement("span");
    close.textContent = "✕";
    close.style.cursor = "pointer";
    close.style.color = "#fff";
    close.title = "Hide NetBar (disable globally)";
    close.onclick = () => disableNow();

    controls.appendChild(btnUp);
    controls.appendChild(btnDown);
    controls.appendChild(close);

    bar.appendChild(controls);
    bar.appendChild(content);
    document.documentElement.appendChild(bar);
  }

  // Apply dynamic styles
  updateBarStyles(bar);

  return bar;
}

function updateBarStyles(bar) {
  if (!bar) return;

  // Opacity
  bar.style.opacity = state.opacity / 100;

  // Position
  if (state.position === "bottom") {
    bar.style.top = "auto";
    bar.style.bottom = "0";
    bar.style.borderBottom = "none";
    bar.style.borderTop = "1px solid rgba(255,255,255,.15)";
  } else {
    bar.style.top = "0";
    bar.style.bottom = "auto";
    bar.style.borderBottom = "1px solid rgba(255,255,255,.15)";
    bar.style.borderTop = "none";
  }
}

async function setPosition(pos) {
  state.position = pos;
  await chrome.storage.sync.set({ [KEY_POSITION]: pos });
  const bar = document.getElementById(BAR_ID);
  if (bar) updateBarStyles(bar);
}

function setHTML(h) {
  const el = document.getElementById(`${BAR_ID}_c`);
  if (el) el.innerHTML = h;
}

function destroyBar() {
  const bar = document.getElementById(BAR_ID);
  if (bar) bar.remove();
}

async function enableNow() {
  state.enabled = true;
  await chrome.storage.sync.set({ [KEY_ENABLED]: true });
  refresh();
}

async function disableNow() {
  state.enabled = false;
  destroyBar();
  await chrome.storage.sync.set({ [KEY_ENABLED]: false });
}

function refresh() {
  if (!shouldShow()) {
    destroyBar();
    return;
  }

  const bar = ensureBar();
  if (!bar) return;

  chrome.runtime.sendMessage({ type: "NETBAR_GET", url: location.href }, (r) => {
    if (chrome.runtime.lastError) {
      setHTML(s(`NetBar error: ${chrome.runtime.lastError.message}`, C.server));
      return;
    }
    if (!shouldShow()) return;

    if (!r?.ok) {
      setHTML(s(`NetBar error: ${r?.error || "no response"}`, C.server));
      return;
    }

    const nsStr =
      Array.isArray(r.ns) && r.ns.length ? r.ns.join(", ") : "-";
    const nsLabel = r.nsDomain ? `NS(${r.nsDomain}):` : "NS:";

    const html =
      s("Your IP:", C.label) +
      " " +
      s(
        `${r.myip || "-"}${r.mycountry ? " (" + r.mycountry + ")" : ""}`,
        C.myip,
        true
      ) +
      sep() +
      s("Domain:", C.label) +
      " " +
      s(r.domain || "-", C.domain, true) +
      sep() +
      s("IP:", C.label) +
      " " +
      s(r.ip || "-", C.ip, true) +
      sep() +
      s("Host:", C.label) +
      " " +
      s(r.ptr || "-", C.ptr) +
      sep() +
      s(nsLabel, C.label) +
      " " +
      s(nsStr, C.ns) +
      sep() +
      s("Server:", C.label) +
      " " +
      s(r.server || "-", C.server);

    setHTML(html);
  });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg) return;

  if (msg.type === "NETBAR_UPDATE_STATE") {
    // Merge new state
    if (msg.enabled !== undefined) state.enabled = msg.enabled;
    if (msg.opacity !== undefined) state.opacity = msg.opacity;
    if (msg.disabledSites !== undefined) state.disabledSites = msg.disabledSites;

    refresh();
    const bar = document.getElementById(BAR_ID);
    if (bar) updateBarStyles(bar);
  }
});

// Init
(async () => {
  await loadState();
  refresh();
})();

// SPA URL change detection
let last = location.href;
setInterval(() => {
  if (!shouldShow()) return;
  if (location.href !== last) {
    last = location.href;
    refresh();
  }
}, 800);

// Sync storage changes (e.g. from other tabs/devices)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;

  let changed = false;
  if (changes[KEY_ENABLED]) {
    state.enabled = !!changes[KEY_ENABLED].newValue;
    changed = true;
  }
  if (changes[KEY_OPACITY]) {
    state.opacity = parseInt(changes[KEY_OPACITY].newValue) || 100;
    changed = true;
  }
  if (changes[KEY_DISABLED_SITES]) {
    state.disabledSites = changes[KEY_DISABLED_SITES].newValue || [];
    changed = true;
  }
  if (changes[KEY_POSITION]) {
    state.position = changes[KEY_POSITION].newValue || "top";
    changed = true;
  }

  if (changed) {
    refresh();
    const bar = document.getElementById(BAR_ID);
    if (bar) updateBarStyles(bar);
  }
});

