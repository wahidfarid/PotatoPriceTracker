/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    card: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

// next/cache is mocked globally via tests/setup.node.ts, but that file is not
// imported here. We replicate the mock inline so this file works in isolation.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

import { _getDashboardData } from "@/lib/data";
import { prisma } from "@/lib/prisma";

const mockFindMany = vi.mocked(prisma.card.findMany);
const mockQueryRaw = vi.mocked(prisma.$queryRaw);

beforeEach(() => {
  vi.clearAllMocks();
});

// Minimal card/variant factory
function makeCard(id: string, variantId: string) {
  return {
    id,
    name: `Card ${id}`,
    nameJa: null,
    variants: [
      {
        id: variantId,
        cardId: id,
        setCode: "SOS",
        collectorNumber: "1",
        finish: "nonfoil",
        language: "EN",
        scryfallId: null,
      },
    ],
  };
}

describe("_getDashboardData", () => {
  describe("empty result", () => {
    it("returns empty cards and null lastUpdated without calling $queryRaw", async () => {
      mockFindMany.mockResolvedValueOnce([] as never);

      const result = await _getDashboardData("SOS");

      expect(result.cards).toEqual([]);
      expect(result.lastUpdated).toBeNull();
      expect(mockQueryRaw).not.toHaveBeenCalled();
    });
  });

  describe("single variant, single price", () => {
    it("attaches the price to the variant and sets lastUpdated", async () => {
      const card = makeCard("c1", "v1");
      mockFindMany.mockResolvedValueOnce([card] as never);

      const allPrices = [
        {
          variantId: "v1",
          shopName: "Hareruya",
          priceYen: 500,
          buyPriceYen: 300,
          stock: 5,
          sourceUrl: null,
          sellSourceUrl: null,
          timestamp: "2024-01-15T00:00:00.000Z",
        },
      ];
      const sparklinePrices: unknown[] = [];
      const maxTs = [{ maxTs: "2024-01-15T00:00:00.000Z" }];

      mockQueryRaw
        .mockResolvedValueOnce(allPrices as never)
        .mockResolvedValueOnce(sparklinePrices as never)
        .mockResolvedValueOnce(maxTs as never);

      const result = await _getDashboardData("SOS");

      expect(result.cards).toHaveLength(1);
      const variant = result.cards[0].variants[0] as any;
      expect(variant.prices).toHaveLength(1);
      expect(variant.prices[0]).toMatchObject({
        priceYen: 500,
        buyPriceYen: 300,
        stock: 5,
        sourceUrl: null,
        sellSourceUrl: null,
        shop: { name: "Hareruya" },
      });
      expect(result.lastUpdated).not.toBeNull();
      expect(new Date(result.lastUpdated!).toISOString()).toBe(
        result.lastUpdated,
      );
    });
  });

  describe("price dedup — same (variantId, shopName)", () => {
    it("keeps only the newer price when two rows share variantId and shopName", async () => {
      const card = makeCard("c1", "v1");
      mockFindMany.mockResolvedValueOnce([card] as never);

      const older = {
        variantId: "v1",
        shopName: "Hareruya",
        priceYen: 400,
        buyPriceYen: 200,
        stock: 2,
        sourceUrl: null,
        sellSourceUrl: null,
        timestamp: "2024-01-10T00:00:00.000Z",
      };
      const newer = {
        variantId: "v1",
        shopName: "Hareruya",
        priceYen: 600,
        buyPriceYen: 350,
        stock: 8,
        sourceUrl: null,
        sellSourceUrl: null,
        timestamp: "2024-01-15T00:00:00.000Z",
      };

      mockQueryRaw
        .mockResolvedValueOnce([older, newer] as never)
        .mockResolvedValueOnce([] as never)
        .mockResolvedValueOnce([
          { maxTs: "2024-01-15T00:00:00.000Z" },
        ] as never);

      const result = await _getDashboardData("SOS");

      const variant = result.cards[0].variants[0] as any;
      expect(variant.prices).toHaveLength(1);
      expect(variant.prices[0].priceYen).toBe(600);
    });
  });

  describe("bigint timestamp in maxTs", () => {
    it("converts BigInt maxTs to a non-null ISO string", async () => {
      const card = makeCard("c1", "v1");
      mockFindMany.mockResolvedValueOnce([card] as never);

      const tsMs = BigInt(new Date("2024-06-01T00:00:00.000Z").getTime());

      mockQueryRaw
        .mockResolvedValueOnce([] as never)
        .mockResolvedValueOnce([] as never)
        .mockResolvedValueOnce([{ maxTs: tsMs }] as never);

      const result = await _getDashboardData("SOS");

      expect(result.lastUpdated).not.toBeNull();
      expect(() => new Date(result.lastUpdated!)).not.toThrow();
      expect(new Date(result.lastUpdated!).toISOString()).toBe(
        result.lastUpdated,
      );
    });
  });

  describe("sparkline cap at 30 days", () => {
    it("sparklineBuyData has at most 30 entries when 35 daily prices are provided", async () => {
      const card = makeCard("c1", "v1");
      mockFindMany.mockResolvedValueOnce([card] as never);

      // Build 35 distinct daily entries for variant v1
      const sparklinePrices = Array.from({ length: 35 }, (_, i) => {
        const date = new Date("2024-01-01T00:00:00.000Z");
        date.setDate(date.getDate() + i);
        return {
          variantId: "v1",
          timestamp: date.toISOString(),
          priceYen: 500 + i,
          buyPriceYen: 300 + i,
          shopName: "Hareruya",
        };
      });

      mockQueryRaw
        .mockResolvedValueOnce([] as never)
        .mockResolvedValueOnce(sparklinePrices as never)
        .mockResolvedValueOnce([{ maxTs: null }] as never);

      const result = await _getDashboardData("SOS");

      const variant = result.cards[0].variants[0] as any;
      expect(variant.sparklineBuyData.length).toBeLessThanOrEqual(30);
    });
  });

  describe("sparkline error recovery", () => {
    it("falls back to empty sparkline arrays when a price entry has an invalid timestamp", async () => {
      const card = makeCard("c1", "v1");
      mockFindMany.mockResolvedValueOnce([card] as never);

      const badEntry = {
        variantId: "v1",
        timestamp: "not-a-date",
        priceYen: 500,
        buyPriceYen: 300,
        shopName: "Hareruya",
      };

      mockQueryRaw
        .mockResolvedValueOnce([] as never)
        .mockResolvedValueOnce([badEntry] as never)
        .mockResolvedValueOnce([{ maxTs: null }] as never);

      const result = await _getDashboardData("SOS");

      // "not-a-date" produces an Invalid Date; format() from date-fns throws,
      // which is caught by the inner try/catch and the entry is skipped.
      // The variant therefore ends up with empty sparkline arrays.
      const variant = result.cards[0].variants[0] as any;
      expect(variant.sparklineBuyData).toEqual([]);
      expect(variant.sparklineSellData).toEqual([]);
    });
  });
});
