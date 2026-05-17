import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

try {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <App />
  );
} catch(e) {
  document.getElementById("root").innerHTML = 
    "<div style='padding:20px;color:red;font-family:monospace'>" + 
    "<h2>Error:</h2><pre>" + e.message + "</pre></div>";
}
