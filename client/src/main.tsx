import { createRoot } from "react-dom/client";
import App from "./App";
import AppContainer from "./AppContainer";
import "./index.css";

// Use container auth only when explicitly set to local
const useLocalAuth = import.meta.env.VITE_AUTH_TYPE === 'local';

createRoot(document.getElementById("root")!).render(
  useLocalAuth ? <AppContainer /> : <App />
);
