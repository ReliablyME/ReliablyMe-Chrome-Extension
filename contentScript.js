(function() {
  try {
    const token = localStorage.getItem('veriry_otp');
    const userid = localStorage.getItem('_id');
    const mobile = localStorage.getItem('mobile');
    if (token && userid && mobile) {
      chrome.runtime.sendMessage({
        type: 'authTokens',
        token,
        userid,
        mobile
      });
    }
  } catch (err) {
    console.error('ReliablyME extension could not read tokens:', err);
  }
})();