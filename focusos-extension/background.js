let isBlocking = false;

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type === "FOCUS_MODE_START") {
    const { allowedSites, sessionEndsAt, appOrigin } = message;
    startBlocking(allowedSites || [], sessionEndsAt, appOrigin);
    sendResponse({ ok: true, blocking: true });
  } else if (message.type === "FOCUS_MODE_END") {
    stopBlocking();
    sendResponse({ ok: true, blocking: false });
  } else if (message.type === "PING") {
    sendResponse({ installed: true, blocking: isBlocking });
  }
  return true;
});

async function startBlocking(allowedSites, sessionEndsAt, appOrigin) {
  await chrome.storage.local.set({
    focusMode: { active: true, allowedSites, sessionEndsAt, appOrigin: appOrigin || "" }
  });

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const existingIds = existing.map((rule) => rule.id);
  if (existingIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existingIds });
  }

  const rules = [
    {
      id: 1,
      priority: 1,
      action: {
        type: "redirect",
        redirect: { url: chrome.runtime.getURL("blocked.html") }
      },
      condition: {
        resourceTypes: ["main_frame"]
      }
    }
  ];

  const allAllowed = [
    ...allowedSites,
    "localhost",
    "lovable.app",
    "vercel.app",
    "netlify.app",
    "supabase.co"
  ];

  allAllowed.forEach((domain, index) => {
    rules.push({
      id: 100 + index,
      priority: 10,
      action: { type: "allow" },
      condition: {
        urlFilter: `||${domain}`,
        resourceTypes: ["main_frame"]
      }
    });
  });

  rules.push({
    id: 99,
    priority: 10,
    action: { type: "allow" },
    condition: {
      urlFilter: "chrome://",
      resourceTypes: ["main_frame"]
    }
  });

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [],
    addRules: rules
  });

  isBlocking = true;

  if (sessionEndsAt) {
    const endMs = new Date(sessionEndsAt).getTime();
    const delayMinutes = Math.max(1, (endMs - Date.now()) / 60000);
    chrome.alarms.create("focusModeEnd", { delayInMinutes: delayMinutes });
  }

  console.log("[FocusOS] Blocking enabled. Allowed:", allAllowed.length, "domains");
}

async function stopBlocking() {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const existingIds = existing.map((rule) => rule.id);
  if (existingIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existingIds });
  }

  await chrome.storage.local.remove("focusMode");
  chrome.alarms.clear("focusModeEnd");
  isBlocking = false;

  console.log("[FocusOS] Blocking disabled.");
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "focusModeEnd") {
    stopBlocking();
  }
});

chrome.runtime.onStartup.addListener(async () => {
  const data = await chrome.storage.local.get("focusMode");
  if (data.focusMode?.active) {
    const endsAt = new Date(data.focusMode.sessionEndsAt).getTime();
    if (Date.now() > endsAt) {
      stopBlocking();
    } else {
      startBlocking(data.focusMode.allowedSites, data.focusMode.sessionEndsAt, data.focusMode.appOrigin);
    }
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get("focusMode");
  if (data.focusMode?.active) {
    const endsAt = new Date(data.focusMode.sessionEndsAt).getTime();
    if (Date.now() > endsAt) {
      stopBlocking();
    }
  }
});
