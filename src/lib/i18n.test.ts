import { describe, it, expect } from "vitest";
import { STRINGS, t, finishBadge, finishLabel, chartSuffix } from "@/lib/i18n";

describe("t", () => {
  it("returns English value for key 'buy'", () => {
    expect(t("buy", "en")).toBe("Buy");
  });

  it("returns Japanese value for key 'buy'", () => {
    expect(t("buy", "ja")).toBe("買取");
  });

  it("interpolates {q} placeholder in English", () => {
    expect(t("noResults", "en", { q: "Sol Ring" })).toBe(
      'No cards found matching "Sol Ring"',
    );
  });

  it("interpolates {q} placeholder in Japanese", () => {
    expect(t("noResults", "ja", { q: "太陽" })).toBe(
      "「太陽」に一致するカードはありません",
    );
  });

  it("every STRINGS key has both 'en' and 'ja' properties", () => {
    for (const key of Object.keys(STRINGS) as Array<keyof typeof STRINGS>) {
      const entry = STRINGS[key] as Record<string, string>;
      expect(entry).toHaveProperty("en");
      expect(entry).toHaveProperty("ja");
      expect(typeof entry.en).toBe("string");
      expect(typeof entry.ja).toBe("string");
    }
  });
});

describe("finishBadge", () => {
  it("surgefoil in English", () => {
    expect(finishBadge("surgefoil", "en")).toBe("Surge");
  });

  it("surgefoil in Japanese", () => {
    expect(finishBadge("surgefoil", "ja")).toBe("サージ");
  });

  it("unknown finish is returned verbatim", () => {
    expect(finishBadge("unknown-finish", "en")).toBe("unknown-finish");
  });
});

describe("finishLabel", () => {
  it("etchedfoil in English", () => {
    expect(finishLabel("etchedfoil", "en")).toBe("Etched Foil");
  });

  it("etchedfoil in Japanese", () => {
    expect(finishLabel("etchedfoil", "ja")).toBe("エッチング・フォイル");
  });

  it("unknown finish is returned verbatim", () => {
    expect(finishLabel("unknown", "en")).toBe("unknown");
  });
});

describe("chartSuffix", () => {
  it("buy in English", () => {
    expect(chartSuffix("buy", "en")).toBe("(Buy)");
  });

  it("buy in Japanese", () => {
    expect(chartSuffix("buy", "ja")).toBe("(販売)");
  });

  it("sell in English", () => {
    expect(chartSuffix("sell", "en")).toBe("(Sell)");
  });

  it("sell in Japanese", () => {
    expect(chartSuffix("sell", "ja")).toBe("(買取)");
  });
});
