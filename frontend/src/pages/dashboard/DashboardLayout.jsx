import { NavLink, Outlet } from "react-router-dom";

import PageHeader from "../../components/ui/PageHeader.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

// Each link declares the minimum tier that may see it. The sidebar filters on
// this, and the pages themselves re-check server-side calls, so a hidden link
// is never the only thing standing between a user and an action.
const NAV = [
  { to: "/dashboard", label: "Overview", min: "staff", end: true },
  { to: "/dashboard/cars", label: "Cars", min: "staff" },
  { to: "/dashboard/orders", label: "Orders", min: "admin" },
  { to: "/dashboard/users", label: "Users", min: "admin" },
];

export default function DashboardLayout() {
  const { user, isStaff, isAdmin, isOwner } = useAuth();

  const allowed = (min) =>
    (min === "staff" && isStaff) ||
    (min === "admin" && isAdmin) ||
    (min === "owner" && isOwner);

  const roleLabel = { staff: "Staff", admin: "Admin", owner: "Owner" }[user?.role];

  return (
    <div className="pb-24 md:pb-32">
      <PageHeader
        eyebrow="Control panel"
        title="Dashboard"
        lede={`Signed in as ${user?.first_name || user?.username} · ${roleLabel}. What you can change here is set by your role.`}
      />

      <div className="fx-container">
        <div className="grid gap-8 lg:grid-cols-[180px_1fr] lg:gap-12">
          {/* Sidebar */}
          <nav aria-label="Dashboard sections" className="lg:sticky lg:top-28 lg:self-start">
            <ul className="flex list-none gap-2 overflow-x-auto lg:flex-col lg:gap-1">
              {NAV.filter((item) => allowed(item.min)).map((item) => (
                <li key={item.to} className="shrink-0">
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `block whitespace-nowrap rounded-input px-4 py-2.5 font-body text-sm transition-colors ${
                        isActive
                          ? "bg-ember/15 text-ember"
                          : "text-muted hover:bg-graphite/60 hover:text-white"
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          {/* Section content */}
          <div className="min-w-0">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
