import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SparklineChart } from "./SparklineChart";

describe("SparklineChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders placeholder when data is empty", () => {
    render(<SparklineChart variantId="v1" data={[]} onClick={vi.fn()} />);
    expect(document.querySelector("svg")).toBeNull();
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("renders placeholder when all prices are zero", () => {
    render(
      <SparklineChart variantId="v1" data={[{ price: 0 }]} onClick={vi.fn()} />,
    );
    expect(document.querySelector("svg")).toBeNull();
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("renders svg with circle for a single data point", () => {
    render(
      <SparklineChart
        variantId="v1"
        data={[{ price: 500 }]}
        onClick={vi.fn()}
      />,
    );
    expect(document.querySelector("svg")).toBeInTheDocument();
    expect(document.querySelector("circle")).toBeInTheDocument();
    expect(document.querySelector("polyline")).toBeNull();
  });

  it("renders svg with polyline for multiple data points", () => {
    render(
      <SparklineChart
        variantId="v1"
        data={[{ price: 300 }, { price: 500 }]}
        onClick={vi.fn()}
      />,
    );
    expect(document.querySelector("svg")).toBeInTheDocument();
    expect(document.querySelector("polyline")).toBeInTheDocument();
    expect(document.querySelector("circle")).toBeNull();
  });

  it("uses green stroke for an up-trend", () => {
    render(
      <SparklineChart
        variantId="v1"
        data={[{ price: 300 }, { price: 500 }]}
        onClick={vi.fn()}
      />,
    );
    const polyline = document.querySelector("polyline")!;
    expect(polyline.getAttribute("stroke")).toBe("#10b981");
  });

  it("uses green stroke when last price equals first price", () => {
    render(
      <SparklineChart
        variantId="v1"
        data={[{ price: 400 }, { price: 400 }]}
        onClick={vi.fn()}
      />,
    );
    const polyline = document.querySelector("polyline")!;
    expect(polyline.getAttribute("stroke")).toBe("#10b981");
  });

  it("uses red stroke for a down-trend", () => {
    render(
      <SparklineChart
        variantId="v1"
        data={[{ price: 500 }, { price: 300 }]}
        onClick={vi.fn()}
      />,
    );
    const polyline = document.querySelector("polyline")!;
    expect(polyline.getAttribute("stroke")).toBe("#ef4444");
  });

  it("calls onClick when the wrapper div is clicked", () => {
    const fn = vi.fn();
    render(
      <SparklineChart
        variantId="v1"
        data={[{ price: 500 }, { price: 600 }]}
        onClick={fn}
      />,
    );
    fireEvent.click(screen.getByTitle("Click to view full price history"));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
