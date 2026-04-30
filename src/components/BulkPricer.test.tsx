import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

vi.mock("@/lib/LanguageContext", () => ({
  useLanguage: () => ({ lang: "en" }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/bulk",
  useSearchParams: () => new URLSearchParams(),
}));

// next/link renders a plain <a> in test environment
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { BulkPricer } from "./BulkPricer";

function makeResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const foundRow = {
  key: "v1",
  qty: 1,
  cardName: "Lightning Bolt",
  cardNameJa: null,
  variant: {
    id: "v1",
    setCode: "SOS",
    collectorNumber: "42",
    finish: "nonfoil",
    language: "EN",
    scryfallId: null,
    prices: [],
  },
  alternates: [],
  fallbackNote: null,
  notFound: false,
};

const notFoundRow = {
  key: "nf",
  qty: 1,
  cardName: "Unknown Card",
  cardNameJa: null,
  variant: null,
  alternates: [],
  fallbackNote: null,
  notFound: true,
};

const fallbackRow = {
  key: "fb",
  qty: 1,
  cardName: "Foil Only Card",
  cardNameJa: null,
  variant: {
    id: "fb-v",
    setCode: "SOS",
    collectorNumber: "99",
    finish: "nonfoil",
    language: "EN",
    scryfallId: null,
    prices: [],
  },
  alternates: [],
  fallbackNote: "no_foil_tracked",
  notFound: false,
};

describe("BulkPricer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a textarea and a submit button", () => {
    render(<BulkPricer />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    // Submit button is disabled until text is entered; it still exists in the DOM
    expect(
      screen.getByRole("button", { name: /price list/i }),
    ).toBeInTheDocument();
  });

  it("submits the deck list and displays results", async () => {
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockResolvedValue(
      makeResponse({ rows: [foundRow] }),
    );

    render(<BulkPricer />);

    await user.type(screen.getByRole("textbox"), "1 Lightning Bolt");
    fireEvent.click(screen.getByRole("button", { name: /price list/i }));

    await waitFor(() =>
      expect(screen.getByText("Lightning Bolt")).toBeInTheDocument(),
    );
  });

  it("shows not-found indicator for unrecognised cards", async () => {
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockResolvedValue(
      makeResponse({ rows: [notFoundRow] }),
    );

    render(<BulkPricer />);

    await user.type(screen.getByRole("textbox"), "1 Unknown Card");
    fireEvent.click(screen.getByRole("button", { name: /price list/i }));

    await waitFor(() =>
      expect(screen.getAllByText(/not found/i).length).toBeGreaterThan(0),
    );
  });

  it("shows the no-foil-tracked fallback warning", async () => {
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockResolvedValue(
      makeResponse({ rows: [fallbackRow] }),
    );

    render(<BulkPricer />);

    await user.type(screen.getByRole("textbox"), "1 Foil Only Card");
    fireEvent.click(screen.getByRole("button", { name: /price list/i }));

    await waitFor(() =>
      expect(screen.getByText(/no foil tracked/i)).toBeInTheDocument(),
    );
  });
});
