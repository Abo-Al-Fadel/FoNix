import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";

import Footer from "./Footer.jsx";

describe("Footer", () => {
  it("does not collect newsletter emails", () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    );

    expect(screen.queryByLabelText(/email address/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sign up/i })).not.toBeInTheDocument();
  });

  it("points GitHub at the real repository", () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /github/i })).toHaveAttribute(
      "href",
      "https://github.com/Abo-Al-Fadel/FoNix",
    );
  });
});
