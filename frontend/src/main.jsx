import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { CartProvider } from "./context/CartContext.jsx";
import "./index.css";

/**
 * Provider order matters: CartProvider sits inside AuthProvider because
 * clearing the cart after a successful checkout needs to know who is logged in,
 * while auth never needs to know about the cart.
 *
 * StrictMode double-invokes effects in development. That is deliberately left
 * on -- the hero sequence sets up GSAP ScrollTriggers and a scroll lock, and
 * StrictMode is what surfaces a missing cleanup function immediately rather
 * than as a mysterious bug after a few route changes.
 */
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
