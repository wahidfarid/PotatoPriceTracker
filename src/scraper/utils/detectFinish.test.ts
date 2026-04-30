import { describe, it, expect } from "vitest";
import { detectFinish, getFinishLabel } from "@/scraper/utils/detectFinish";

describe("detectFinish", () => {
  it("returns nonfoil for empty string", () => {
    expect(detectFinish("")).toEqual({ isFoil: false, finish: "nonfoil" });
  });

  it("returns nonfoil when foilFlg is 0 and no token", () => {
    expect(detectFinish("Sol Ring", 0)).toEqual({
      isFoil: false,
      finish: "nonfoil",
    });
  });

  it("detects surgefoil from 【サージ・Foil】", () => {
    expect(detectFinish("カード名【サージ・Foil】")).toEqual({
      isFoil: true,
      finish: "surgefoil",
    });
  });

  it("detects surgefoil from 【Surge・Foil】", () => {
    expect(detectFinish("Card 【Surge・Foil】")).toEqual({
      isFoil: true,
      finish: "surgefoil",
    });
  });

  it("detects surgefoil from サージ・Foil (bare)", () => {
    expect(detectFinish("カード名 サージ・Foil")).toEqual({
      isFoil: true,
      finish: "surgefoil",
    });
  });

  it("detects etchedfoil from 【エッチング・Foil】", () => {
    expect(detectFinish("カード名【エッチング・Foil】")).toEqual({
      isFoil: true,
      finish: "etchedfoil",
    });
  });

  it("detects etchedfoil from エッチング・Foil (bare)", () => {
    expect(detectFinish("カード名 エッチング・Foil")).toEqual({
      isFoil: true,
      finish: "etchedfoil",
    });
  });

  it("detects fracturefoil from (フラクチャーFOIL)", () => {
    expect(detectFinish("カード名(フラクチャーFOIL)")).toEqual({
      isFoil: true,
      finish: "fracturefoil",
    });
  });

  it("detects fracturefoil from Fracture FOIL", () => {
    expect(detectFinish("Card Fracture FOIL")).toEqual({
      isFoil: true,
      finish: "fracturefoil",
    });
  });

  it("detects fracturefoil from (Fracture)", () => {
    expect(detectFinish("Card (Fracture)")).toEqual({
      isFoil: true,
      finish: "fracturefoil",
    });
  });

  it("detects doublerainbowfoil from (ダブルレインボウFOIL)", () => {
    expect(detectFinish("カード名(ダブルレインボウFOIL)")).toEqual({
      isFoil: true,
      finish: "doublerainbowfoil",
    });
  });

  it("detects surgefoil from (サージFOIL)", () => {
    expect(detectFinish("カード名(サージFOIL)")).toEqual({
      isFoil: true,
      finish: "surgefoil",
    });
  });

  it("detects foil from 【Foil】", () => {
    expect(detectFinish("Card 【Foil】")).toEqual({
      isFoil: true,
      finish: "foil",
    });
  });

  it("detects foil from (FOIL)", () => {
    expect(detectFinish("Card (FOIL)")).toEqual({
      isFoil: true,
      finish: "foil",
    });
  });

  it("detects foil from bare Foil token", () => {
    expect(detectFinish("Card Foil")).toEqual({ isFoil: true, finish: "foil" });
  });

  it("surge pattern wins over plain Foil when both appear", () => {
    expect(detectFinish("Card 【サージ・Foil】 Foil")).toEqual({
      isFoil: true,
      finish: "surgefoil",
    });
  });

  it("foilFlg === 1 with no token in title returns foil", () => {
    expect(detectFinish("Sol Ring", 1)).toEqual({
      isFoil: true,
      finish: "foil",
    });
  });

  it("foilFlg === 1 is overridden by a title token", () => {
    expect(detectFinish("Card 【サージ・Foil】", 1)).toEqual({
      isFoil: true,
      finish: "surgefoil",
    });
  });
});

describe("getFinishLabel", () => {
  it.each([
    ["nonfoil", "Norm"],
    ["foil", "Foil"],
    ["surgefoil", "Surge"],
    ["etchedfoil", "Etched"],
    ["fracturefoil", "Fracture"],
    ["doublerainbowfoil", "DblRnbw"],
  ])("'%s' → '%s'", (finish, label) => {
    expect(getFinishLabel(finish)).toBe(label);
  });

  it("unknown finish is returned verbatim", () => {
    expect(getFinishLabel("wizardfoil")).toBe("wizardfoil");
  });
});
