const API_BASE = 'https://controllermain.reliably.me';
let auth = {};

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('pollNotifications', { periodInMinutes: 1 });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'authTokens') {
    auth = { mobile: message.mobile, token: message.token, userid: message.userid };
    chrome.storage.local.set({ auth });
    sendResponse({ status: 'stored' });
  }

  // ✅ Support logs from popup.js
  if (message.type === 'LOG') {
    console.log('[POPUP LOG]:', message.payload);
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pollNotifications') {
    pollNotifications();
  }
});

async function pollNotifications() {
  const store = await chrome.storage.local.get(['auth', 'lastSeenIds']);
  const cred = store.auth || auth;
  if (!cred || !cred.mobile || !cred.token) return;

  try {
    const resp = await fetch(`${API_BASE}/api/v2.0/getMessagesApp?receiver=${cred.mobile}`);
    if (!resp.ok) return;
    const data = await resp.json();
    const messages = (data.results && data.results.data) || [];
    const seen = store.lastSeenIds || [];
    const newMsgs = messages.filter(m => m.status === 'unread' && !seen.includes(m._id));
    if (newMsgs.length) {
      const ids = seen.concat(newMsgs.map(m => m._id));
      chrome.storage.local.set({ lastSeenIds: ids });
      newMsgs.forEach(showNotification);
    }
  } catch (e) {
    console.error('ReliablyME polling error', e);
  }
}

function showNotification(msg) {
  chrome.notifications.create(msg._id, {
    type: 'basic',
    iconUrl: 'icon48.png',
    title: 'ReliablyME',
    message: msg.message || 'You have a new notification',
  });
}
