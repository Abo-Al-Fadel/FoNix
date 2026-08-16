import { Link } from "react-router-dom";

import PageHeader from "../components/ui/PageHeader.jsx";

const GROUPS = [
  {
    heading: "Buying",
    items: [
      {
        q: "Do I pay the full price online?",
        a: "No. You authorise a 10% demonstration reservation. Real marques that sell direct (Tesla's order flow, Porsche's allocation programmes) take a deposit and invoice the rest when the car is confirmed. FoNix copies that shape. No money actually moves.",
      },
      {
        q: "Which card should I use?",
        a: "4242 4242 4242 4242 authorises. 4000 0000 0000 0002 is declined, the way a Stripe test card would be. The number is never stored — only the brand, last four digits, and a fake payment reference.",
      },
      {
        q: "Can I cancel?",
        a: "Yes, from your account, while the allocation is still pending. The build slot returns to the range. After FoNix confirms it, only the hangar can unwind it.",
      },
      {
        q: "Why is quantity one?",
        a: "An allocation is a build slot, not warehouse stock. Hypercar programmes do not sell crates of cars. The hangar can raise the cap on a model if they ever need to.",
      },
    ],
  },
  {
    heading: "The hangar",
    items: [
      {
        q: "Who can change a car's price?",
        a: "Admin and owner only. Hangar staff update specification, photography and remaining slots. List price and build cost are a commercial decision, not a shop-floor one.",
      },
      {
        q: "Who confirms an allocation?",
        a: "Admin or owner. Staff can read every order and leave a hangar note. They cannot advance or cancel status — that is the same split a sales manager vs a sales assistant would have.",
      },
      {
        q: "Where is the car collected?",
        a: "Building 4, Filton Airfield, Bristol — or delivered, if you chose that at checkout. Neither actually happens. This is a demonstration.",
      },
    ],
  },
  {
    heading: "This project",
    items: [
      {
        q: "Is FoNix a real manufacturer?",
        a: "No. It is a portfolio project that looks like a marque site: a Django API, a React store, and a control panel with four roles. See About.",
      },
      {
        q: "Are my card details safe?",
        a: "The form never sends the number to a bank, and the API refuses to persist it. Use the demonstration pans above. Do not type a real card.",
      },
    ],
  },
];

export default function Faq() {
  return (
    <div className="pb-24 md:pb-32">
      <PageHeader
        eyebrow="Questions"
        title="How this store actually works."
        lede="Short answers for the reservation, the hangar, and the fact that none of this is a real car company."
      />

      <div className="fx-container">
        <div className="max-w-3xl space-y-14">
          {GROUPS.map((group) => (
            <section key={group.heading}>
              <h2 className="font-heading text-xl font-bold text-white">
                {group.heading}
              </h2>
              <dl className="mt-6 divide-y divide-hairline border-y border-hairline">
                {group.items.map((item) => (
                  <div key={item.q} className="py-5">
                    <dt className="font-heading text-base font-semibold text-white">
                      {item.q}
                    </dt>
                    <dd className="mt-2 font-body text-sm leading-relaxed text-muted">
                      {item.a}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}

          <p className="font-body text-sm text-faint">
            Still stuck?{" "}
            <Link to="/contact" className="text-muted underline-offset-4 hover:underline">
              Write to the hangar
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
