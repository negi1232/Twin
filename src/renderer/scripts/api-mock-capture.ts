/**
 * API Mock Capture UI logic for the main renderer process.
 * The button opens a separate API Mock Capture window.
 */
function initApiMockCapture(): void {
  const apiCaptureBtn = document.getElementById('api-capture-btn') as HTMLButtonElement;
  const statusApiMock = document.getElementById('status-api-mock') as HTMLElement;

  // --- Button: open window ---
  apiCaptureBtn.addEventListener('click', () => {
    window.electronAPI.apiMockOpenWindow();
  });

  // --- Listen for capture state changes to update status bar ---
  window.electronAPI.onApiMockCaptureUpdate((data: ApiMockCaptureUpdateData) => {
    if (data.count > 0) {
      statusApiMock.textContent = `API: ${data.count} reqs`;
      statusApiMock.style.color = '#3fb950';
    } else {
      statusApiMock.textContent = 'API: OFF';
      statusApiMock.style.color = '';
    }
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initApiMockCapture };
}
