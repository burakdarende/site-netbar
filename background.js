// background.js (MV3) — NS parent fallback + myIP fallback

const tabMeta = new Map(); // tabId -> { server }

function getDomain(urlStr) {
  try {
    return new URL(urlStr).hostname;
  } catch {
    return null;
  }
}

function reverseIPv4ToArpa(ip) {
  const parts = String(ip).split(".");
  if (parts.length !== 4) return null;
  return `${parts.reverse().join(".")}.in-addr.arpa`;
}

async function dohQueryCloudflare(name, type) {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(
    name
  )}&type=${encodeURIComponent(type)}`;

  const res = await fetch(url, { headers: { accept: "application/dns-json" } });
  if (!res.ok) throw new Error(`DoH failed: ${res.status}`);
  return res.json();
}

function parseAnswers(json) {
  const ans = Array.isArray(json?.Answer) ? json.Answer : [];
  return ans.map((a) => a?.data).filter(Boolean);
}

async function resolveA(host) {
  const j = await dohQueryCloudflare(host, "A");
  const data = parseAnswers(j);
  return data.find((x) => /^\d{1,3}(\.\d{1,3}){3}$/.test(x)) || null;
}

async function resolveNS(host) {
  const j = await dohQueryCloudflare(host, "NS");
  const data = parseAnswers(j).map((x) => x.replace(/\.$/, ""));
  return [...new Set(data)];
}

// NS yoksa parent domainlere çıkarak dene: www.a.b.com -> a.b.com -> b.com
async function resolveNSWithFallback(hostname) {
  let h = String(hostname || "").trim();
  if (!h) return { ns: [], nsDomain: null };

  // en fazla 6 deneme: subdomain katmanlarını soyalım
  for (let i = 0; i < 6; i++) {
    const ns = await resolveNS(h);
    if (ns && ns.length) return { ns, nsDomain: h };

    const parts = h.split(".");
    if (parts.length <= 2) break; // daha fazla soyma anlamsız
    h = parts.slice(1).join(".");
  }

  return { ns: [], nsDomain: null };
}

async function resolvePTR(ip) {
  const arpa = reverseIPv4ToArpa(ip);
  if (!arpa) return null;
  const j = await dohQueryCloudflare(arpa, "PTR");
  const data = parseAnswers(j);
  return data[0] ? data[0].replace(/\.$/, "") : null;
}

// my ip (client)
// my ip (client)
let myIpCache = {
  data: null,
  timestamp: 0
};

async function myIP() {
  const now = Date.now();
  // 15 saniye cache (15 * 1000 ms) - anlık çoklu sekme açılışında rate limit yememek için
  if (myIpCache.data && (now - myIpCache.timestamp < 15000)) {
    return myIpCache.data;
  }

  let result = { ip: null, country: null };

  // 1) ipapi
  try {
    const r = await fetch("https://ipapi.co/json/");
    if (r.ok) {
      const j = await r.json();
      if (j?.ip) {
        result = { ip: j.ip, country: j.country_name || j.country || null };
      }
    }
  } catch { }

  // 2) ipify fallback (eğer ipapi başarısızsa)
  if (!result.ip) {
    try {
      const r = await fetch("https://api.ipify.org?format=json");
      if (r.ok) {
        const j = await r.json();
        if (j?.ip) {
          result = { ip: j.ip, country: null };
        }
      }
    } catch { }
  }

  // Cache'e kaydet (başarısız olsa bile kısa süreliğine cache'lenebilir ama şimdilik sadece başarılıysa veya null ise de kaydedelim ki sürekli denemesin)
  myIpCache = {
    data: result,
    timestamp: now
  };

  return result;
}

// main_frame Server header yakala
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.type !== "main_frame") return;

    let server = null;
    for (const h of details.responseHeaders || []) {
      if ((h.name || "").toLowerCase() === "server") {
        server = h.value || null;
        break;
      }
    }
    tabMeta.set(details.tabId, { server });
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

chrome.tabs.onRemoved.addListener((tabId) => tabMeta.delete(tabId));

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (!msg || msg.type !== "NETBAR_GET") {
        sendResponse({ ok: false, error: "Unknown message" });
        return;
      }

      const url = msg.url || sender?.tab?.url || "";
      const hostname = getDomain(url);
      if (!hostname) {
        sendResponse({ ok: false, error: "No domain" });
        return;
      }

      const tabId = sender?.tab?.id;
      const server = tabId != null ? tabMeta.get(tabId)?.server || "-" : "-";

      const ip = await resolveA(hostname);

      // NS: hostname değil apex’e doğru fallback
      const nsResult = await resolveNSWithFallback(hostname);

      let ptr = null;
      if (ip) {
        const ptrRes = await Promise.allSettled([resolvePTR(ip)]);
        ptr = ptrRes[0].status === "fulfilled" ? ptrRes[0].value : null;
      }

      const me = await myIP();

      sendResponse({
        ok: true,
        domain: hostname,
        ip,
        ns: nsResult.ns,
        nsDomain: nsResult.nsDomain, // hangi domain’den NS bulundu
        ptr,
        server,
        myip: me.ip,
        mycountry: me.country
      });
    } catch (e) {
      sendResponse({ ok: false, error: String(e?.message || e) });
    }
  })();

  return true;
});
