import { createRoot } from "react-dom/client";
import App from "./App";
import AppContainer from "./AppContainer";
import "./index.css";

// Use container auth only when explicitly set to local
const useLocalAuth = import.meta.env.VITE_AUTH_TYPE === 'local';

console.log('[main] VITE_AUTH_TYPE:', import.meta.env.VITE_AUTH_TYPE);
console.log('[main] Using local auth:', useLocalAuth);

try {
  createRoot(document.getElementById("root")!).render(
    useLocalAuth ? <AppContainer /> : <App />
  );
} catch (error) {
  console.error('[main] Failed to render app:', error);
}
