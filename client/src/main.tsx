import { createRoot } from "react-dom/client";
import App from "./App";
import AppContainer from "./AppContainer";
import "./index.css";

// Use container auth in production or when AUTH_TYPE is local
const useLocalAuth = import.meta.env.PROD || import.meta.env.VITE_AUTH_TYPE === 'local';

createRoot(document.getElementById("root")!).render(
  useLocalAuth ? <AppContainer /> : <App />
);
