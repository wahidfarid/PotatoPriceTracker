import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data")>();
  return {
    ...actual,
    prisma: {
      cardVariant: { findMany: vi.fn() },
      price: { findMany: vi.fn() },
      card: { findMany: vi.fn() },
      $queryRaw: vi.fn(),
    },
  };
});

import { prisma } from "@/lib/data";

function get(variantId: string, search = "") {
  return GET(
    new Request(`http://test/api/variants/${variantId}/price-history${search}`),
    { params: Promise.resolve({ variantId }) },
  );
}

type PriceMock = {
  id: string;
  variantId: string;
  shopId: string;
  priceYen: number;
  buyPriceYen: number | null;
  stock: number;
  sourceUrl: string | null;
  sellSourceUrl: string | null;
  timestamp: Date;
  shop: { id: string; name: string };
};

function makePrice(
  variantId: string,
  shopName: string,
  timestamp: Date,
  priceYen = 500,
  buyPriceYen: number | null = null,
): PriceMock {
  return {
    id: `${variantId}-${shopName}-${timestamp.getTime()}`,
    variantId,
    shopId: shopName,
    priceYen,
    buyPriceYen,
    stock: 1,
    sourceUrl: null,
    sellSourceUrl: null,
    timestamp,
    shop: { id: shopName, name: shopName },
  };
}

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400_000);

beforeEach(() => {
  vi.mocked(prisma.price.findMany).mockResolvedValue([]);
});

describe("GET /api/variants/[variantId]/price-history", () => {
  it("400 empty variantId", async () => {
    const res = await get("");
    expect(res.status).toBe(400);
  });

  it("400 variantId > 64 chars", async () => {
    const res = await get("x".repeat(65));
    expect(res.status).toBe(400);
  });

  it("empty prices → []", async () => {
    vi.mocked(prisma.price.findMany).mockResolvedValue([]);
    const res = await get("v1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("daily dedup – keeps newest within day", async () => {
    // Use UTC 11:00 and 13:00 so the calendar day is identical in any timezone
    const base = new Date();
    base.setUTCHours(11, 0, 0, 0);
    const noonBase = new Date(base.getTime() - 5 * 86400_000);
    const earlier = makePrice("v1", "Hareruya", noonBase, 500);
    const later = makePrice(
      "v1",
      "Hareruya",
      new Date(noonBase.getTime() + 2 * 3600_000),
      700,
    );

    vi.mocked(prisma.price.findMany).mockResolvedValue([
      earlier,
      later,
    ] as never);

    const res = await get("v1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].priceYen).toBe(700);
  });

  it("sparkline=true – filters last 30 days", async () => {
    // 15 prices within 30 days, 5 prices older than 30 days
    const recent = Array.from({ length: 15 }, (_, i) =>
      makePrice("v1", "Hareruya", daysAgo(i + 1), 500),
    );
    const old = Array.from({ length: 5 }, (_, i) =>
      makePrice("v1", "CardRush", daysAgo(35 + i), 400),
    );
    const all = [...old, ...recent];

    vi.mocked(prisma.price.findMany).mockResolvedValue(all as never);

    const res = await get("v1", "?sparkline=true");
    expect(res.status).toBe(200);
    const body: Array<{ timestamp: string }> = await res.json();

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400_000);
    expect(body.length).toBeLessThanOrEqual(30);
    for (const entry of body) {
      expect(new Date(entry.timestamp).getTime()).toBeGreaterThanOrEqual(
        thirtyDaysAgo.getTime(),
      );
    }
  });

  it("sparkline=true – caps at 30 points", async () => {
    // 35 entries all within 30 days, each on a distinct day+shop combination
    const prices = Array.from({ length: 35 }, (_, i) =>
      makePrice("v1", `Shop${i}`, daysAgo(i % 29), 500),
    );

    vi.mocked(prisma.price.findMany).mockResolvedValue(prices as never);

    const res = await get("v1", "?sparkline=true");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(30);
  });

  it("without sparkline – returns all daily-deduped entries", async () => {
    // 45 entries spread over 45 distinct days for the same shop → 45 unique day+shop keys
    const prices = Array.from({ length: 45 }, (_, i) =>
      makePrice("v1", "Hareruya", daysAgo(i + 1), 500),
    );

    vi.mocked(prisma.price.findMany).mockResolvedValue(prices as never);

    const res = await get("v1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(45);
  });
});
