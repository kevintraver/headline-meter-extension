document.addEventListener('DOMContentLoaded', function () {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs && tabs.length > 0) {
      const currentUrl = tabs[0].url
      document.getElementById('urlDisplay').textContent = currentUrl
    } else {
      document.getElementById('urlDisplay').textContent =
        'Could not retrieve URL.'
    }
  })
})
