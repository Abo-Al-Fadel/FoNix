import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import RequireRole from "./RequireRole.jsx";

// Mock the auth context so each test can pose as a given role without a real
// provider, tokens or network.
const mockAuth = vi.fn();
vi.mock("../../context/AuthContext.jsx", () => ({
  useAuth: () => mockAuth(),
}));

function renderAt(min, auth) {
  mockAuth.mockReturnValue(auth);
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route element={<RequireRole min={min} />}>
          <Route path="dashboard" element={<div>PANEL</div>} />
        </Route>
        <Route path="/" element={<div>HOME</div>} />
        <Route path="login" element={<div>LOGIN</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const authed = (role) => ({
  isAuthenticated: true,
  isRestoring: false,
  user: { role },
});

describe("RequireRole", () => {
  it("shows a loading state while the session is restoring", () => {
    renderAt("staff", { isRestoring: true, isAuthenticated: false, user: null });
    expect(screen.queryByText("PANEL")).not.toBeInTheDocument();
  });

  it("redirects an anonymous visitor to login", () => {
    renderAt("staff", { isRestoring: false, isAuthenticated: false, user: null });
    expect(screen.getByText("LOGIN")).toBeInTheDocument();
  });

  it("lets a staff member into a staff-gated route", () => {
    renderAt("staff", authed("staff"));
    expect(screen.getByText("PANEL")).toBeInTheDocument();
  });

  it("sends an under-ranked customer home", () => {
    renderAt("staff", authed("customer"));
    expect(screen.getByText("HOME")).toBeInTheDocument();
    expect(screen.queryByText("PANEL")).not.toBeInTheDocument();
  });

  it("keeps a staff member out of an admin-gated route", () => {
    renderAt("admin", authed("staff"));
    expect(screen.getByText("HOME")).toBeInTheDocument();
  });

  it("lets an owner into an admin-gated route", () => {
    renderAt("admin", authed("owner"));
    expect(screen.getByText("PANEL")).toBeInTheDocument();
  });
});
