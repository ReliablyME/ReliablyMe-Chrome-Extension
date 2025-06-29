document.addEventListener('DOMContentLoaded', async () => {
  const API_BASE = 'https://controllermain.reliably.me';

  const status = document.getElementById('status');
  const step1 = document.getElementById('step1');
  const step2 = document.getElementById('step2');
  const messagesSection = document.getElementById('messagesSection');

  const mobileInput = document.getElementById('mobileInput');
  const otpInput = document.getElementById('otpInput');
  const sendOtpBtn = document.getElementById('sendOtpBtn');
  const verifyOtpBtn = document.getElementById('verifyOtpBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const messagesContainer = document.getElementById('messages');

  let tempMobile = '';
  let tempSecret = '';

  function showStep(step) {
    step1.style.display = step === 1 ? 'block' : 'none';
    step2.style.display = step === 2 ? 'block' : 'none';
    messagesSection.style.display = 'none';
  }

  sendOtpBtn.addEventListener('click', async () => {
    const raw = mobileInput.value.trim();
    const mobile = raw.startsWith('+') ? raw : `+1${raw}`;

    if (!/^\+1\d{10}$/.test(mobile)) {
      alert("Please enter a valid Canadian mobile number.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/v2.0/getOTP`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: mobile })
      });

      const data = await res.json();
      chrome.runtime.sendMessage({ type: 'LOG', payload: { event: 'getOTP response', data } });

      if (data.success && (data.secret || data.data?.secret)) {
        tempMobile = mobile;
        tempSecret = data.secret || data.data?.secret || '';
        status.textContent = 'OTP sent. Check your phone.';
        showStep(2);
      } else {
        alert("Failed to send OTP. " + (data.message || ""));
      }
    } catch (err) {
      chrome.runtime.sendMessage({ type: 'LOG', payload: { event: 'getOTP error', error: err.toString() } });
      alert("Network error sending OTP.");
    }
  });

  verifyOtpBtn.addEventListener('click', async () => {
    const otp = otpInput.value.trim();
    if (!otp || !tempMobile || !tempSecret) {
      alert("Missing OTP, mobile number, or secret.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/v2.0/verifyOTP`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: tempMobile,
          otp,
          secret: tempSecret
        })
      });

      const data = await res.json();
      console.log("VERIFY OTP RAW RESPONSE:", data);
      chrome.runtime.sendMessage({ type: 'LOG', payload: { event: 'verifyOTP response', data } });

      if ((data.success || data.status === 'success')) {
        const token = data.token;
        const _id = data._id || data.userid || '';

        if (!token) {
          alert("Server did not return a token.");
          return;
        }

        // handle no _id properrly
        await chrome.storage.local.set({ auth: { token, mobile: tempMobile, userid: _id } });
        localStorage.setItem('verify_otp', token);
        localStorage.setItem('_id', _id);
        localStorage.setItem('mobile', tempMobile);

        status.textContent = `Logged in as ${tempMobile}`;
        showMessages();
      } else {
        console.error("OTP verification failed:", data);
        alert("Invalid OTP. " + (data.message || "No token returned."));
      }
    } catch (e) {
      chrome.runtime.sendMessage({ type: 'LOG', payload: { event: 'verifyOTP error', error: e.toString() } });
      alert("Login failed.");
    }
  });

  async function showMessages() {
    const store = await chrome.storage.local.get(['auth']);
    const { auth } = store;
    if (!auth || !auth.token || !auth.mobile) {
      status.textContent = 'Not logged in';
      showStep(1);
      return;
    }

    messagesSection.style.display = 'block';
    step1.style.display = 'none';
    step2.style.display = 'none';
    status.textContent = `Logged in as ${auth.mobile}`;
    loadMessages(auth.mobile);
  }

  async function loadMessages(mobile) {
    messagesContainer.innerHTML = '';
    try {
      const res = await fetch(`${API_BASE}/api/v2.0/getMessagesApp?receiver=${mobile}`);
      const json = await res.json();
      const messages = json.results?.data?.filter(m => m.status === 'unread') || [];

      if (!messages.length) {
        messagesContainer.textContent = 'No new messages.';
        return;
      }

      messages.slice(0, 5).forEach(msg => {
        const div = document.createElement('div');
        div.className = 'message';
        div.innerHTML = `
          <div>${msg.message}</div>
          <div class="timestamp">${new Date(msg.createdAt).toLocaleString()}</div>
        `;
        messagesContainer.appendChild(div);
      });
    } catch (e) {
      chrome.runtime.sendMessage({ type: 'LOG', payload: { event: 'loadMessages error', error: e.toString() } });
      messagesContainer.textContent = 'Error loading messages.';
    }
  }

  refreshBtn.addEventListener('click', async () => {
    const store = await chrome.storage.local.get(['auth']);
    if (store.auth?.mobile) loadMessages(store.auth.mobile);
  });

  const store = await chrome.storage.local.get(['auth']);
  if (store.auth?.mobile && store.auth?.token) {
    showMessages();
  } else {
    showStep(1);
  }
});
