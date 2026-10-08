import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import GlowForm from "./GlowForm";
import "./index.css";

const Page = ["/glow2", "/glow2.html"].includes(window.location.pathname)
  ? GlowForm
  : App;

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Page />
  </React.StrictMode>,
);
