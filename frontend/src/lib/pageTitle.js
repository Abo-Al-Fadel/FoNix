const EXACT = {
  "/": "FoNix | Official Site",
  "/store": "The range | FoNix",
  "/about": "About FoNix",
  "/contact": "Contact | FoNix",
  "/cart": "Your cart | FoNix",
  "/login": "Sign in | FoNix",
  "/register": "Create account | FoNix",
  "/forgot-password": "Reset password | FoNix",
  "/reset-password": "Choose a new password | FoNix",
  "/privacy": "Privacy | FoNix",
  "/terms": "Terms | FoNix",
  "/cookies": "Cookies | FoNix",
  "/checkout": "Checkout | FoNix",
  "/account": "Your orders | FoNix",
  "/ownership": "Ownership | FoNix",
  "/faq": "Questions | FoNix",
  "/dashboard": "Control panel | FoNix",
};

export function titleForPath(pathname) {
  if (EXACT[pathname]) return EXACT[pathname];
  if (pathname.startsWith("/dashboard")) return "Control panel | FoNix";
  if (pathname.startsWith("/store/")) return "The range | FoNix";
  return "FoNix | Official Site";
}
