import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { Join } from "./Join.jsx";
import { Preview } from "./Preview.jsx";
import { Privacy } from "./Privacy.jsx";
import { ErrorBoundary, watchErrors } from "./ErrorBoundary.jsx";

// Students land on /join (or /join/CODE from the QR code); everything else is the teacher's screen.
const join = window.location.pathname.match(/^\/join(?:\/([A-Za-z0-9]{0,8}))?\/?$/i);
// /preview is the shop's proofing gallery (see Preview.jsx).
const preview = /^\/preview\/?$/i.test(window.location.pathname);
const privacy = /^\/privacy\/?$/i.test(window.location.pathname);

watchErrors();
// Our own "waking up" page while the server starts (public/sw.js). Not in development: Vite serves the pages there.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      {join ? <Join initialCode={join[1] || ""} /> : preview ? <Preview /> : privacy ? <Privacy /> : <App />}
    </ErrorBoundary>
  </React.StrictMode>
);
