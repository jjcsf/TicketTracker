import { createRoot } from "react-dom/client";
import AppContainer from "./AppContainer";
import "./index.css";

console.log('[main-container] Starting Season Ticket Manager with local authentication');

try {
  createRoot(document.getElementById("root")!).render(<AppContainer />);
} catch (error) {
  console.error('[main-container] Failed to render app:', error);
}