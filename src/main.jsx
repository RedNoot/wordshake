import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { Join } from "./Join.jsx";

// Students land on /join (or /join/CODE from the QR code); everything else is the teacher's screen.
const join = window.location.pathname.match(/^\/join(?:\/([A-Za-z0-9]{0,8}))?\/?$/i);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {join ? <Join initialCode={join[1] || ""} /> : <App />}
  </React.StrictMode>
);
