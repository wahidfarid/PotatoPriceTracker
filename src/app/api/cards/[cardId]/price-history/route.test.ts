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

function get(cardId: string) {
  return GET(new Request(`http://test/api/cards/${cardId}/price-history`), {
    params: Promise.resolve({ cardId }),
  });
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
  priceYen: number,
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

beforeEach(() => {
  vi.mocked(prisma.cardVariant.findMany).mockResolvedValue([]);
  vi.mocked(prisma.price.findMany).mockResolvedValue([]);
});

describe("GET /api/cards/[cardId]/price-history", () => {
  it("400 empty cardId", async () => {
    const res = await get("");
    expect(res.status).toBe(400);
  });

  it("400 cardId > 64 chars", async () => {
    const res = await get("x".repeat(65));
    expect(res.status).toBe(400);
  });

  it("empty variants → {}", async () => {
    vi.mocked(prisma.cardVariant.findMany).mockResolvedValue([]);
    const res = await get("card1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({});
  });

  it("daily dedup – keeps newest within day", async () => {
    vi.mocked(prisma.cardVariant.findMany).mockResolvedValue([
      { id: "v1" } as never,
    ]);

    // Use UTC noon ± 1 h so the day key is the same in any timezone (UTC-11 to UTC+11)
    const earlierPrice = makePrice(
      "v1",
      "Hareruya",
      new Date("2024-01-15T11:00:00Z"),
      500,
      300,
    );
    const laterPrice = makePrice(
      "v1",
      "Hareruya",
      new Date("2024-01-15T13:00:00Z"),
      600,
      400,
    );

    vi.mocked(prisma.price.findMany).mockResolvedValue([
      earlierPrice,
      laterPrice,
    ] as never);

    const res = await get("card1");
    expect(res.status).toBe(200);
    const body = await res.json();

    const entries: Array<{
      timestamp: string;
      priceYen: number;
      buyPriceYen: number | null;
      shopName: string;
    }> = body["v1"];
    expect(entries).toHaveLength(1);
    expect(entries[0].priceYen).toBe(600);
    expect(entries[0].buyPriceYen).toBe(400);
  });

  it("multiple variants", async () => {
    vi.mocked(prisma.cardVariant.findMany).mockResolvedValue([
      { id: "v1" } as never,
      { id: "v2" } as never,
    ]);

    const v1Price = makePrice(
      "v1",
      "Hareruya",
      new Date("2024-01-10T12:00:00Z"),
      300,
      150,
    );
    const v2Price = makePrice(
      "v2",
      "CardRush",
      new Date("2024-01-11T12:00:00Z"),
      450,
      200,
    );

    vi.mocked(prisma.price.findMany).mockResolvedValue([
      v1Price,
      v2Price,
    ] as never);

    const res = await get("card1");
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(Object.keys(body)).toContain("v1");
    expect(Object.keys(body)).toContain("v2");
    expect(body["v1"]).toHaveLength(1);
    expect(body["v2"]).toHaveLength(1);
  });
});
