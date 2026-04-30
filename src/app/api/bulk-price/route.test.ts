import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

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

function post(body: unknown, headers: Record<string, string> = {}) {
  const json = JSON.stringify(body);
  return POST(
    new Request("http://test/api/bulk-price", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(json.length),
        ...headers,
      },
      body: json,
    }),
  );
}

const mockVariant = {
  id: "v1",
  cardId: "c1",
  setCode: "SOS",
  collectorNumber: "42",
  finish: "nonfoil",
  language: "EN",
  scryfallId: null,
  card: { id: "c1", name: "Lightning Bolt", nameJa: null },
};

beforeEach(() => {
  vi.mocked(prisma.cardVariant.findMany).mockResolvedValue([]);
  vi.mocked(prisma.$queryRaw).mockResolvedValue([]);
});

describe("POST /api/bulk-price", () => {
  it("413 oversize", async () => {
    const res = await post(
      { lines: [] },
      { "content-length": String(256 * 1024 + 1) },
    );
    expect(res.status).toBe(413);
  });

  it("400 invalid JSON", async () => {
    const res = await POST(
      new Request("http://test", { method: "POST", body: "not json" }),
    );
    expect(res.status).toBe(400);
  });

  it("400 non-array lines", async () => {
    const res = await post({ lines: "foo" });
    expect(res.status).toBe(400);
  });

  it("413 too many lines", async () => {
    const res = await post({
      lines: Array(1001).fill({ name: "X", foil: false, qty: 1, raw: "" }),
    });
    expect(res.status).toBe(413);
  });

  it("200 empty lines", async () => {
    const res = await post({ lines: [] });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ rows: [] });
  });

  it("400 invalid line shape", async () => {
    const res = await post({ lines: [{ name: 123 }] });
    expect(res.status).toBe(400);
  });

  it("happy path - name match", async () => {
    vi.mocked(prisma.cardVariant.findMany).mockResolvedValue([
      mockVariant as never,
    ]);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

    const res = await post({
      lines: [{ name: "Lightning Bolt", foil: false, qty: 1, raw: "" }],
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows[0].cardName).toBe("Lightning Bolt");
    expect(body.rows[0].notFound).toBe(false);
    expect(body.rows[0].qty).toBe(1);
  });

  it("notFound", async () => {
    vi.mocked(prisma.cardVariant.findMany).mockResolvedValue([]);

    const res = await post({
      lines: [{ name: "Unknown Card", foil: false, qty: 2, raw: "" }],
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows[0].notFound).toBe(true);
    expect(body.rows[0].qty).toBe(2);
    expect(body.rows[0].cardName).toBe("Unknown Card");
  });

  it("fallbackNote no_foil_tracked", async () => {
    const nonfoilVariant = { ...mockVariant, finish: "nonfoil" };
    vi.mocked(prisma.cardVariant.findMany).mockResolvedValue([
      nonfoilVariant as never,
    ]);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

    const res = await post({
      lines: [
        {
          name: "X",
          setCode: "SOS",
          collectorNumber: "42",
          foil: true,
          qty: 1,
          raw: "",
        },
      ],
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows[0].fallbackNote).toBe("no_foil_tracked");
  });

  it("sideboard merge", async () => {
    vi.mocked(prisma.cardVariant.findMany).mockResolvedValue([
      mockVariant as never,
    ]);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

    const res = await post({
      lines: [
        { name: "Lightning Bolt", foil: false, qty: 2, raw: "" },
        { name: "Lightning Bolt", foil: false, qty: 3, raw: "" },
      ],
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].qty).toBe(5);
  });

  it("notFound merge", async () => {
    vi.mocked(prisma.cardVariant.findMany).mockResolvedValue([]);

    const res = await post({
      lines: [
        { name: "Ghost Card", foil: false, qty: 1, raw: "" },
        { name: "Ghost Card", foil: false, qty: 4, raw: "" },
      ],
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].qty).toBe(5);
  });

  it("sort - notFound pinned last", async () => {
    vi.mocked(prisma.cardVariant.findMany).mockResolvedValue([
      mockVariant as never,
    ]);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

    const res = await post({
      lines: [
        { name: "Unknown Card", foil: false, qty: 1, raw: "" },
        { name: "Lightning Bolt", foil: false, qty: 1, raw: "" },
      ],
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows[0].notFound).toBe(false);
    expect(body.rows[body.rows.length - 1].notFound).toBe(true);
  });
});
