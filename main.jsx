import React from "react";
import ReactDOM from "react-dom/client";

window.onerror = function(msg, src, line) {
  document.getElementById("root").innerHTML = 
    "<div style='padding:20px;color:red;font-family:sans-serif'>" +
    "<b>Error:</b> " + msg + "<br/>Line: " + line + "</div>";
};

window.onunhandledrejection = function(e) {
  document.getElementById("root").innerHTML = 
    "<div style='padding:20px;color:red;font-family:sans-serif'>" +
    "<b>Promise Error:</b> " + e.reason + "</div>";
};

import("./App.jsx").then(({ default: App }) => {
  ReactDOM.createRoot(document.getElementById("root")).render(<App />);
}).catch(e => {
  document.getElementById("root").innerHTML = 
    "<div style='padding:20px;color:red;font-family:sans-serif'>" +
    "<b>Import Error:</b> " + e.message + "</div>";
});
