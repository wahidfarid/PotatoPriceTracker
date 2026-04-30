import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("@/lib/LanguageContext", () => ({
  useLanguage: () => ({ lang: "en" }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("./PriceChart", () => ({
  PriceChart: ({ data }: { data: unknown[] }) => (
    <div data-testid="price-chart" data-count={data.length} />
  ),
}));

import { PriceHistoryModal } from "./PriceHistoryModal";

const variants = [
  {
    id: "v1",
    collectorNumber: "42",
    language: "EN",
    finish: "nonfoil",
    image: null,
  },
];

const priceHistory = {
  v1: [
    {
      timestamp: "2024-01-15T00:00:00Z",
      priceYen: 500,
      buyPriceYen: 300,
      shopName: "Hareruya",
    },
  ],
};

function makeResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("PriceHistoryModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when isOpen is false", () => {
    render(
      <PriceHistoryModal
        cardName="Foo"
        cardId="c1"
        variants={variants}
        isOpen={false}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows loading indicator while fetch is in-flight", async () => {
    vi.spyOn(global, "fetch").mockReturnValue(new Promise(() => {}));
    render(
      <PriceHistoryModal
        cardName="Foo"
        cardId="c1"
        variants={variants}
        isOpen={true}
        onClose={vi.fn()}
      />,
    );
    expect(
      await screen.findByText(/loading price history/i),
    ).toBeInTheDocument();
  });

  it("renders price chart after a successful fetch", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(makeResponse(priceHistory));
    render(
      <PriceHistoryModal
        cardName="Foo"
        cardId="c1"
        variants={variants}
        isOpen={true}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("price-chart")).toBeInTheDocument(),
    );
  });

  it("shows retry button on fetch failure and retries on click", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockRejectedValue(new Error("network error"));

    render(
      <PriceHistoryModal
        cardName="Foo"
        cardId="c1"
        variants={variants}
        isOpen={true}
        onClose={vi.fn()}
      />,
    );

    const retryBtn = await screen.findByRole("button", { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
  });

  it("calls onClose when Escape is pressed", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(makeResponse(priceHistory));
    const onClose = vi.fn();
    render(
      <PriceHistoryModal
        cardName="Foo"
        cardId="c1"
        variants={variants}
        isOpen={true}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the backdrop is clicked", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(makeResponse(priceHistory));
    const onClose = vi.fn();
    render(
      <PriceHistoryModal
        cardName="Foo"
        cardId="c1"
        variants={variants}
        isOpen={true}
        onClose={onClose}
      />,
    );
    const backdrop = document.querySelector('[role="presentation"]')!;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when the inner dialog panel is clicked", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(makeResponse(priceHistory));
    const onClose = vi.fn();
    render(
      <PriceHistoryModal
        cardName="Foo"
        cardId="c1"
        variants={variants}
        isOpen={true}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows no price history message when variant history is empty", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(makeResponse({ v1: [] }));
    render(
      <PriceHistoryModal
        cardName="Foo"
        cardId="c1"
        variants={variants}
        isOpen={true}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText(/no price history/i)).toBeInTheDocument(),
    );
  });
});
