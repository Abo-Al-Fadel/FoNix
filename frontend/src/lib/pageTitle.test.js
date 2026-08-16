import { titleForPath } from "./pageTitle.js";

describe("titleForPath", () => {
  it("names the homepage", () => {
    expect(titleForPath("/")).toBe("FoNix | Official Site");
  });

  it("names a product route before the car payload arrives", () => {
    expect(titleForPath("/store/ignis")).toBe("The range | FoNix");
  });

  it("keeps the control panel under one title", () => {
    expect(titleForPath("/dashboard/cars/ignis/edit")).toBe("Control panel | FoNix");
  });

  it("names legal pages", () => {
    expect(titleForPath("/privacy")).toBe("Privacy | FoNix");
  });
});
