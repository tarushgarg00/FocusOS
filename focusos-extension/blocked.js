(async function() {
  const data = await chrome.storage.local.get('focusMode');
  const state = data.focusMode;

  if (!state || !state.active || !state.sessionEndsAt) {
    document.getElementById('timer').textContent = '00:00';
    return;
  }

  const endTime = new Date(state.sessionEndsAt).getTime();

  function updateTimer() {
    const remaining = Math.max(0, endTime - Date.now());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    document.getElementById('timer').textContent =
      String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');

    if (remaining <= 0) {
      document.getElementById('timer').textContent = '00:00';
      document.querySelector('.message').textContent = 'Session complete! You can close this tab.';
      clearInterval(interval);
    }
  }

  updateTimer();
  const interval = setInterval(updateTimer, 1000);

  document.getElementById('backLink').addEventListener('click', function(event) {
    event.preventDefault();
    window.location.href = state.appOrigin || 'https://focusos.app';
  });
})();
