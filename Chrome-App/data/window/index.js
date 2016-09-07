'use strict';

var webview = document.querySelector('webview');
webview.addEventListener('permissionrequest', function(e) {
  if (e.permission === 'media') {
    e.request.allow();
  }
});

webview.setAttribute('src', 'https://web.whatsapp.com/');

document.addEventListener('click', function (e) {
  let cmd = e.target.dataset.cmd;
  if (cmd === 'refresh') {
    webview.setAttribute('src', 'about:blank');
    webview.setAttribute('src', 'https://web.whatsapp.com/');
  }
  else {
    chrome.runtime.sendMessage({
      method: cmd,
      data: e.target.dataset.value
    });
  }
});
