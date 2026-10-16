import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { Join } from "./Join.jsx";
import { ErrorBoundary, watchErrors } from "./ErrorBoundary.jsx";

// Students land on /join (or /join/CODE from the QR code); everything else is the teacher's screen.
const join = window.location.pathname.match(/^\/join(?:\/([A-Za-z0-9]{0,8}))?\/?$/i);

watchErrors();
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      {join ? <Join initialCode={join[1] || ""} /> : <App />}
    </ErrorBoundary>
  </React.StrictMode>
);
