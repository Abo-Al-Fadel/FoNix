import { Route, Routes } from "react-router-dom";

import Layout from "./components/layout/Layout.jsx";
import RequireAuth from "./components/routing/RequireAuth.jsx";
import RequireRole from "./components/routing/RequireRole.jsx";
import ScrollToTop from "./components/routing/ScrollToTop.jsx";
import About from "./pages/About.jsx";
import Account from "./pages/Account.jsx";
import Cart from "./pages/Cart.jsx";
import Checkout from "./pages/Checkout.jsx";
import Contact from "./pages/Contact.jsx";
import CarForm from "./pages/dashboard/CarForm.jsx";
import DashboardCars from "./pages/dashboard/DashboardCars.jsx";
import DashboardHome from "./pages/dashboard/DashboardHome.jsx";
import DashboardLayout from "./pages/dashboard/DashboardLayout.jsx";
import DashboardOrders from "./pages/dashboard/DashboardOrders.jsx";
import DashboardUsers from "./pages/dashboard/DashboardUsers.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import Home from "./pages/Home.jsx";
import Cookies from "./pages/legal/Cookies.jsx";
import Privacy from "./pages/legal/Privacy.jsx";
import Terms from "./pages/legal/Terms.jsx";
import Login from "./pages/Login.jsx";
import NotFound from "./pages/NotFound.jsx";
import ProductDetail from "./pages/ProductDetail.jsx";
import Register from "./pages/Register.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
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
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password" element={<ResetPassword />} />

          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="terms" element={<Terms />} />
          <Route path="cookies" element={<Cookies />} />

          {/* Authenticated area. */}
          <Route element={<RequireAuth />}>
            <Route path="checkout" element={<Checkout />} />
            <Route path="account" element={<Account />} />
          </Route>

          {/* Control panel. Staff and above may enter; users stay admin-only.
              Orders are visible to staff (read-only); status changes are
              gated in the page and by the API. */}
          <Route element={<RequireRole min="staff" />}>
            <Route path="dashboard" element={<DashboardLayout />}>
              <Route index element={<DashboardHome />} />
              <Route path="cars" element={<DashboardCars />} />
              <Route path="cars/new" element={<CarForm />} />
              <Route path="cars/:slug/edit" element={<CarForm />} />
              <Route path="orders" element={<DashboardOrders />} />
              <Route element={<RequireRole min="admin" />}>
                <Route path="users" element={<DashboardUsers />} />
              </Route>
            </Route>
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
