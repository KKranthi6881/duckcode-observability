import './index.css';
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error('Failed to find the root element');
const root = createRoot(rootElement);

// Remove StrictMode to prevent double rendering in development
root.render(<React.StrictMode><App /></React.StrictMode>);