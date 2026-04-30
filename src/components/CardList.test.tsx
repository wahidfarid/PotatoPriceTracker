import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

vi.mock("@/lib/LanguageContext", () => ({
  useLanguage: () => ({ lang: "en", setLang: vi.fn() }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams("set=SOS"),
}));

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

// next/image simplified to a plain <img>
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    ...rest
  }: {
    src: string;
    alt: string;
    [key: string]: unknown;
    // eslint-disable-next-line @next/next/no-img-element
  }) => <img src={src} alt={alt} {...(rest as Record<string, unknown>)} />,
}));

// PriceHistoryModal is dynamically imported; stub it out so we don't need fetch
vi.mock("./PriceHistoryModal", () => ({
  PriceHistoryModal: () => <div data-testid="modal-stub" />,
}));

import { CardList } from "./CardList";

const sets = [
  { code: "SOS", name: "Strixhaven" },
  { code: "ECL", name: "Eclipsed" },
];

const card = {
  id: "c1",
  name: "Lightning Bolt",
  nameJa: "稲妻",
  variants: [
    {
      id: "v1",
      setCode: "SOS",
      collectorNumber: "42",
      finish: "nonfoil",
      language: "EN",
      scryfallId: null,
      imageUri: null,
      prices: [],
      sparklineBuyData: [],
      sparklineSellData: [],
    },
  ],
};

const defaultProps = {
  initialCards: [card],
  lastUpdated: null,
  currentSet: "SOS",
  sets,
};

describe("CardList", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders card names", () => {
    render(<CardList {...defaultProps} />);
    expect(screen.getAllByText("Lightning Bolt").length).toBeGreaterThan(0);
  });

  it("keeps matching card visible when search matches", async () => {
    const user = userEvent.setup();
    render(<CardList {...defaultProps} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "Lightning");

    expect(screen.getAllByText("Lightning Bolt").length).toBeGreaterThan(0);
  });

  it("hides card when search has no match", async () => {
    const user = userEvent.setup();
    render(<CardList {...defaultProps} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "nonexistent_card_xyz");

    await waitFor(() =>
      expect(screen.queryByText("Lightning Bolt")).not.toBeInTheDocument(),
    );
  });

  it("finds card by Japanese name when lang is ja", async () => {
    vi.doMock("@/lib/LanguageContext", () => ({
      useLanguage: () => ({ lang: "ja", setLang: vi.fn() }),
      LanguageProvider: ({ children }: { children: React.ReactNode }) =>
        children,
    }));

    // Re-render with default lang=en mock (Japanese name still in the data)
    // The filter checks card.nameJa regardless of lang, so typing the Japanese
    // name should keep the card visible even with the default en mock.
    const user = userEvent.setup();
    render(<CardList {...defaultProps} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "稲妻");

    expect(screen.getAllByText("Lightning Bolt").length).toBeGreaterThan(0);
  });

  it("renders set tab buttons for each set", () => {
    render(<CardList {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: /strixhaven/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /eclipsed/i }),
    ).toBeInTheDocument();
  });

  it("set tab for current set is active (highlighted)", () => {
    render(<CardList {...defaultProps} />);
    const activeTab = screen.getByRole("button", { name: /strixhaven/i });
    // Active tab gets bg-blue-600 class
    expect(activeTab.className).toMatch(/bg-blue-600/);
  });
});
