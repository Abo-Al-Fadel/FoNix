import { Route, Routes } from "react-router-dom";

import Layout from "./components/layout/Layout.jsx";
import RequireAuth from "./components/routing/RequireAuth.jsx";
import ScrollToTop from "./components/routing/ScrollToTop.jsx";
import About from "./pages/About.jsx";
import Account from "./pages/Account.jsx";
import Cart from "./pages/Cart.jsx";
import Checkout from "./pages/Checkout.jsx";
import Contact from "./pages/Contact.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import NotFound from "./pages/NotFound.jsx";
import ProductDetail from "./pages/ProductDetail.jsx";
import Register from "./pages/Register.jsx";
import Store from "./pages/Store.jsx";

/**
 * Route table.
 *
 * Everything nests inside <Layout/>, which owns the navbar, footer and the
 * single <main> landmark. /account and /checkout nest one level deeper inside
 * <RequireAuth/> so the gate is declared once for both rather than repeated
 * inside each page.
 */
export default function App() {
  return (
    <>
      <ScrollToTop />

      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />

          <Route path="store" element={<Store />} />
          <Route path="store/:slug" element={<ProductDetail />} />
          <Route path="cart" element={<Cart />} />

          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />

          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />

          {/* Authenticated area. */}
          <Route element={<RequireAuth />}>
            <Route path="checkout" element={<Checkout />} />
            <Route path="account" element={<Account />} />
          </Route>

          {/* Catch-all. Without it, a typo'd URL renders a blank page with no
              explanation -- worse than a 404, because nothing tells the user
              anything is wrong. */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}
