import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";

vi.mock("@/lib/LanguageContext", () => ({
  useLanguage: () => ({ lang: "en" }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Recharts uses ResizeObserver and SVG layout APIs unavailable in jsdom.
// Mock the entire module so tests focus on the component's behaviour rather
// than recharts internals.
vi.mock("recharts", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    LineChart: Passthrough,
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
    ResponsiveContainer: Passthrough,
  };
});

import { PriceChart } from "./PriceChart";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <div style={{ width: 800, height: 400 }}>{children}</div>
);

describe("PriceChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without error when data is empty", () => {
    expect(() => render(<PriceChart data={[]} />, { wrapper })).not.toThrow();
  });

  it("renders without error with multiple data points from one shop", () => {
    const data = [
      {
        timestamp: "2024-01-13T00:00:00Z",
        priceYen: 400,
        shopName: "Hareruya",
        buyPriceYen: 200,
      },
      {
        timestamp: "2024-01-14T00:00:00Z",
        priceYen: 500,
        shopName: "Hareruya",
        buyPriceYen: 250,
      },
      {
        timestamp: "2024-01-15T00:00:00Z",
        priceYen: 450,
        shopName: "Hareruya",
        buyPriceYen: 220,
      },
    ];
    expect(() => render(<PriceChart data={data} />, { wrapper })).not.toThrow();
  });

  it("renders without error with data from multiple shops", () => {
    const data = [
      {
        timestamp: "2024-01-15T00:00:00Z",
        priceYen: 500,
        shopName: "Hareruya",
        buyPriceYen: 300,
      },
      {
        timestamp: "2024-01-15T00:00:00Z",
        priceYen: 480,
        shopName: "CardRush",
        buyPriceYen: 280,
      },
    ];
    expect(() => render(<PriceChart data={data} />, { wrapper })).not.toThrow();
  });
});
