let syncEnabled = true;

function isSyncEnabled() {
  return syncEnabled;
}

function toggleSync() {
  syncEnabled = !syncEnabled;
  return syncEnabled;
}

function buildScrollSyncScript() {
  return `
    (function() {
      let ticking = false;
      window.addEventListener('scroll', function() {
        if (!ticking) {
          requestAnimationFrame(function() {
            window.electronAPI.syncScroll({
              scrollX: window.scrollX,
              scrollY: window.scrollY
            });
            ticking = false;
          });
          ticking = true;
        }
      });
    })();
  `;
}

function buildScrollToScript(scrollX, scrollY) {
  return `window.scrollTo(${scrollX}, ${scrollY})`;
}

function extractPathFromUrl(url) {
  try {
    return new URL(url).pathname;
  } catch (_e) {
    return '/';
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isSyncEnabled,
    toggleSync,
    buildScrollSyncScript,
    buildScrollToScript,
    extractPathFromUrl,
  };
}
