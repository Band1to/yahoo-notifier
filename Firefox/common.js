'use strict';

var {ToggleButton} = require('sdk/ui/button/toggle');
var tabs = require('sdk/tabs');
var panels = require('sdk/panel');
var self = require('sdk/self');
var unload = require('sdk/system/unload');
var sp = require('sdk/simple-prefs');
var timers = require('sdk/timers');
var array = require('sdk/util/array');
var utils = require('sdk/window/utils');
var {Cc, Ci} = require('chrome');
var {getActiveView} = require('sdk/view/core');
var Worker = require('sdk/content/worker').Worker;  // jshint ignore:line

var panel, button, browser, workers = [];

function update (title) {
  console.error(title);
  let tmp = /\((\d+)\)/.exec(title);
  if (tmp && tmp.length) {
    button.badge = tmp[1];
    button.label = title;
  }
  else {
    button.badge = '';
    button.label = 'Yahoo Mail Notifier';
  }
}
// inject script into the panel -> browser element
(function () {
  let nsIObserverService = Cc['@mozilla.org/observer-service;1'].getService(Ci.nsIObserverService);
  let httpRequestObserver = {
    observe: function(subject) {
      let window = subject.defaultView;
      if (window && window.top === browser.contentWindow) {
        let worker = new Worker({
          window,
          contentScriptFile: self.data.url('./inject/inject.js'),
        });
        worker.on('pageshow', () => array.add(workers, worker));
        worker.on('pagehide', () => array.remove(workers, worker));
        worker.on('detach', () => array.remove(workers, worker));
        worker.port.on('title', update);
      }
    }
  };
  nsIObserverService.addObserver(httpRequestObserver, 'document-element-inserted', false);
  unload.when(() => nsIObserverService.removeObserver(httpRequestObserver, 'document-element-inserted'));
})();

button = new ToggleButton({
  id: self.name,
  label: 'Yahoo Mail Notifier',
  icon: {
    '16': './icons/16.png',
    '32': './icons/32.png',
    '64': './icons/64.png'
  },
  onChange: state => state.checked && panel.show({
    position: button
  })
});

panel = panels.Panel({
  contentURL: self.data.url('./panel/index.html'),
  contentScriptFile: self.data.url('./panel/index.js'),
  width: 40,
  height: sp.prefs.height,
  contextMenu: true,
  onHide: () => button.state('window', {checked: false})
});
panel.port.on('open', (url) => {
  panel.hide();
  tabs.open(url);
});
panel.port.on('refresh', () => {
  browser.loadURI('https://mail.yahoo.com');
});
panel.port.on('settings', () => {
  panel.hide();
  utils.getMostRecentBrowserWindow().BrowserOpenAddonsMgr('addons://detail/' + self.id);
});
panel.port.on('pin', bol => getActiveView(panel).setAttribute('noautohide', bol));

browser = (function (panelView) {
  // display tooltips
  panelView.setAttribute('tooltip', 'aHTMLTooltip');
  // mail.yahoo.com cannot be loaded in an iframe; we use a safe browser element (type=content)
  //
  let b = panelView.ownerDocument.createElement('browser');
  b.setAttribute('type', 'content');
  b.setAttribute('style', `width: ${sp.prefs.width}px;`);
  panelView.appendChild(b);
  b.setAttribute('src', 'https://mail.yahoo.com');
  return b;
})(getActiveView(panel));

sp.on('width', () => timers.setTimeout(() => {
  sp.prefs.width = Math.max(300, sp.prefs.width);
  browser.setAttribute('style', `width: ${sp.prefs.width}px;`);
}, 2000));
sp.on('height', () => timers.setTimeout(() => {
  sp.prefs.height = Math.max(300, sp.prefs.height);
  panel.height = sp.prefs.height;
}, 2000));

/* http Request Observer */
(function () {
  let observerService = Cc['@mozilla.org/observer-service;1'].getService(Ci.nsIObserverService);
  let parentID = utils.getOuterId(browser.contentWindow);
  let modify = {
    observe: function(subject, topic) {
      if (topic === 'http-on-modify-request') {
        let channel = subject.QueryInterface(Ci.nsIHttpChannel);
        let loadInfo = channel.loadInfo;
        if (!loadInfo) {
          return;
        }
        let fromPanel = loadInfo.outerWindowID === parentID || loadInfo.parentOuterWindowID === parentID;
        if (fromPanel) {
          channel.setRequestHeader(
            'User-Agent',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 8_0_2 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Version/8.0 Mobile/12A405 Safari/600.1.4',
            false
          );
        }
      }
    }
  };
  observerService.addObserver(modify, 'http-on-modify-request', false);
  unload.when(() => observerService.removeObserver(modify, 'http-on-modify-request'));
})();

// FAQs page
exports.main = function (options) {
  if (options.loadReason === 'install' || options.loadReason === 'startup') {
    let version = sp.prefs.version;
    if (self.version !== version) {
      if (sp.prefs.welcome) {
        timers.setTimeout(function () {
          tabs.open(
            'http://add0n.com/fastest-yahoo.html?v=' + self.version +
            (version ? '&p=' + version + '&type=upgrade' : '&type=install')
          );
        }, 3000);
      }
      sp.prefs.version = self.version;
    }
  }
};
