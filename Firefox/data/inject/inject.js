/* globals unsafeWindow, self */
'use strict';

document.addEventListener('DOMContentLoaded', function () {
  self.port.emit('title', document.title);
  // watch for title changes; needs to access unsafeWindow to bypass Proxy
  unsafeWindow.document.watch('title', (id, o, n) => {
    self.port.emit('title', n);
    return n;
  });
});
