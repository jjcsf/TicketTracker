console.log('[main] Starting main.tsx execution');

// Global error handler
window.addEventListener('error', (e) => {
  console.error('[main] Global error caught:', {
    message: e.message,
    filename: e.filename,
    lineno: e.lineno,
    colno: e.colno,
    error: e.error,
    stack: e.error?.stack
  });
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('[main] Unhandled promise rejection:', e.reason);
});

try {
  console.log('[main] Importing React dependencies...');
  const { createRoot } = await import("react-dom/client");
  console.log('[main] React createRoot imported successfully');
  
  console.log('[main] Importing App components...');
  const App = (await import("./App")).default;
  const AppContainer = (await import("./AppContainer")).default;
  console.log('[main] App components imported successfully');
  
  console.log('[main] Importing CSS...');
  await import("./index.css");
  console.log('[main] CSS imported successfully');

  // Use container auth only when explicitly set to local
  const useLocalAuth = import.meta.env.VITE_AUTH_TYPE === 'local';

  console.log('[main] Environment check:');
  console.log('[main] VITE_AUTH_TYPE:', import.meta.env.VITE_AUTH_TYPE);
  console.log('[main] Using local auth:', useLocalAuth);
  console.log('[main] All import.meta.env:', import.meta.env);

  console.log('[main] Looking for root element...');
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error('Root element not found');
  }
  console.log('[main] Root element found:', rootElement);

  console.log('[main] Creating React root...');
  const root = createRoot(rootElement);
  console.log('[main] React root created successfully');

  console.log('[main] Rendering app with auth type:', useLocalAuth ? 'AppContainer' : 'App');
  root.render(useLocalAuth ? <AppContainer /> : <App />);
  console.log('[main] App rendered successfully');

} catch (error) {
  console.error('[main] Critical error during app initialization:', error);
  console.error('[main] Error stack:', error.stack);
  
  // Show error on page
  const rootElement = document.getElementById("root");
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 20px; background: #fee; border: 2px solid #f00; margin: 20px; font-family: monospace;">
        <h1 style="color: #d00;">Application Failed to Start</h1>
        <p><strong>Error:</strong> ${error.message}</p>
        <p><strong>Check browser console for detailed logs</strong></p>
        <pre style="background: #f0f0f0; padding: 10px; overflow: auto; white-space: pre-wrap;">${error.stack || 'No stack trace available'}</pre>
      </div>
    `;
  }
}
