import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import AppSupabase from "./AppSupabase";
import { isSupabaseConfigured } from "./lib/supabaseClient";

createRoot(document.getElementById("root")!).render(
  <StrictMode>{isSupabaseConfigured ? <AppSupabase /> : <App />}</StrictMode>
);
