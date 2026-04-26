"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/LanguageContext";
import { t, finishBadge, type Lang } from "@/lib/i18n";
import {
  parseDeckList,
  parseMoxfieldCsv,
  parsedLineToText,
} from "@/lib/bulk-parser";
import type { ParsedLine, ResolvedRow, VariantInfo } from "@/lib/bulk-parser";

const formatPrice = (val: number | undefined | null) =>
  val ? `¥${val.toLocaleString()}` : "-";

function maxKaitori(variant: VariantInfo): number {
  let max = 0;
  for (const p of variant.prices) {
    if (p.buyPriceYen && p.buyPriceYen > max) max = p.buyPriceYen;
  }
  return max;
}

function getShopPrice(variant: VariantInfo, shopName: string) {
  return variant.prices.find((p) => p.shopName === shopName) ?? null;
}

// ── Finish chip ────────────────────────────────────────────────────────────────

function FinishChip({ finish, lang }: { finish: string; lang: Lang }) {
  const label = finishBadge(finish, lang);
  if (finish === "surgefoil")
    return (
      <span className="bg-purple-100 text-purple-900 text-[9px] px-1.5 py-0.5 rounded-full font-bold border border-purple-200">
        {label}
      </span>
    );
  if (finish === "etchedfoil")
    return (
      <span className="bg-teal-100 text-teal-900 text-[9px] px-1.5 py-0.5 rounded-full font-bold border border-teal-200">
        {label}
      </span>
    );
  if (finish === "fracturefoil")
    return (
      <span className="bg-rose-100 text-rose-900 text-[9px] px-1.5 py-0.5 rounded-full font-bold border border-rose-200">
        {label}
      </span>
    );
  if (finish === "doublerainbowfoil")
    return (
      <span className="bg-gradient-to-r from-pink-100 to-purple-100 text-purple-900 text-[9px] px-1.5 py-0.5 rounded-full font-bold border border-purple-200">
        {label}
      </span>
    );
  if (finish === "foil")
    return (
      <span className="bg-amber-100 text-amber-900 text-[9px] px-1.5 py-0.5 rounded-full font-bold border border-amber-200">
        {label}
      </span>
    );
  return (
    <span className="text-gray-400 text-[9px] font-medium border border-gray-100 px-1.5 py-0.5 rounded-full">
      {label}
    </span>
  );
}

// ── Variant chip with optional picker popover ──────────────────────────────────

interface VariantChipProps {
  variant: VariantInfo;
  alternates: VariantInfo[];
  tokenLocked: boolean;
  lang: Lang;
  onPick: (v: VariantInfo) => void;
}

function VariantChip({
  variant,
  alternates,
  tokenLocked,
  lang,
  onPick,
}: VariantChipProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canPick = !tokenLocked && alternates.length > 0;

  const chipContent = (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-gray-600">
      <span className="font-bold text-gray-800">{variant.setCode}</span>
      <span className="text-gray-400">#{variant.collectorNumber}</span>
      <FinishChip finish={variant.finish} lang={lang} />
      <span className="text-gray-500">{variant.language}</span>
    </span>
  );

  if (!canPick) return <div>{chipContent}</div>;

  return (
    <div className="relative inline-block" ref={wrapperRef}>
      <button
        className="flex items-center gap-1 hover:bg-blue-50 rounded px-1 -mx-1 transition-colors"
        onClick={() => setOpen((o) => !o)}
        title={t("pickPrinting", lang)}
      >
        {chipContent}
        <svg
          className="h-3 w-3 text-blue-400 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[200px] overflow-hidden">
            <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {t("pickPrinting", lang)}
            </div>
            {[variant, ...alternates].map((v) => {
              const hr = getShopPrice(v, "Hareruya");
              const isActive = v.id === variant.id;
              return (
                <button
                  key={v.id}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-3 transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "hover:bg-gray-50 text-gray-700"
                  }`}
                  onClick={() => {
                    if (!isActive) onPick(v);
                    setOpen(false);
                  }}
                >
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono">
                    <span className="font-bold">{v.setCode}</span>
                    <span className="text-gray-400">#{v.collectorNumber}</span>
                    <FinishChip finish={v.finish} lang={lang} />
                    <span>{v.language}</span>
                  </span>
                  <span className="text-xs font-mono text-gray-500 whitespace-nowrap">
                    {formatPrice(hr?.priceYen)}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function BulkPricer() {
  const { lang } = useLanguage();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ResolvedRow[] | null>(null);
  const [unparsed, setUnparsed] = useState<string[]>([]);
  // rowKey → alternate variantId chosen by user
  const [picks, setPicks] = useState<Map<string, string>>(new Map());
  // Parsed lines from a CSV import — preserved so language info survives submission
  const [csvLines, setCsvLines] = useState<ParsedLine[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCsvImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const csv = ev.target?.result as string;
        const { parsed, unparsed: bad } = parseMoxfieldCsv(csv);
        setCsvLines(parsed);
        setText(parsed.map(parsedLineToText).join("\n"));
        setUnparsed(bad);
        setRows(null);
        setPicks(new Map());
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [],
  );

  const handlePick = useCallback((rowKey: string, v: VariantInfo) => {
    setPicks((prev) => {
      const next = new Map(prev);
      next.set(rowKey, v.id);
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    // Use preserved CSV lines (which carry language) if they haven't been edited away
    const { parsed, unparsed: bad } = csvLines
      ? { parsed: csvLines, unparsed: [] }
      : parseDeckList(text);
    if (!csvLines) setUnparsed(bad);
    if (parsed.length === 0) return;

    setLoading(true);
    setPicks(new Map());
    try {
      const res = await fetch("/api/bulk-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: parsed }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert((err as any)?.error ?? "Request failed");
        return;
      }
      const data = await res.json();
      setRows(data.rows);
    } finally {
      setLoading(false);
    }
  }, [text]);

  // Resolve display variant for each row (applying user picks)
  const displayRows = useMemo(() => {
    if (!rows) return null;
    return rows.map((row) => {
      const pickedId = picks.get(row.key);
      if (!pickedId || !row.variant) return row;
      const alt = row.alternates.find((a) => a.id === pickedId);
      if (!alt) return row;
      // Swap variant and put old variant back in alternates
      return {
        ...row,
        variant: alt,
        alternates: [
          row.variant,
          ...row.alternates.filter((a) => a.id !== pickedId),
        ],
      };
    });
  }, [rows, picks]);

  // Totals
  const totals = useMemo(() => {
    if (!displayRows) return null;
    let hrBuy = 0,
      hrSell = 0,
      crBuy = 0,
      crSell = 0,
      kaitori = 0;
    for (const row of displayRows) {
      if (!row.variant || row.notFound) continue;
      const hr = getShopPrice(row.variant, "Hareruya");
      const cr = getShopPrice(row.variant, "CardRush");
      hrBuy += (hr?.priceYen ?? 0) * row.qty;
      hrSell += (hr?.buyPriceYen ?? 0) * row.qty;
      crBuy += (cr?.priceYen ?? 0) * row.qty;
      crSell += (cr?.buyPriceYen ?? 0) * row.qty;
      kaitori += maxKaitori(row.variant) * row.qty;
    }
    return { hrBuy, hrSell, crBuy, crSell, kaitori };
  }, [displayRows]);

  const hasResults = displayRows !== null;

  return (
    <>
      {/* Fixed header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-3 md:px-4">
          <div className="flex items-center gap-3 py-3 md:py-4">
            <Link
              href="/"
              className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
              title="Back to dashboard"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Link>
            <h1 className="text-lg md:text-xl font-bold text-gray-800">
              {t("bulkTitle", lang)}
            </h1>
          </div>
        </div>
      </div>

      <div className="pt-16 md:pt-20">
        {/* Input area */}
        <div className="bg-white rounded-lg shadow-md border border-gray-100 p-4 md:p-6 mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500">
              {lang === "ja" ? "テキストを貼り付け" : "Paste text"}
            </span>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                />
              </svg>
              {lang === "ja"
                ? "Moxfield CSV を読み込む"
                : "Import Moxfield .csv"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCsvImport}
            />
          </div>
          <textarea
            className="w-full h-48 p-3 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y bg-gray-50 text-gray-900 placeholder-gray-400"
            placeholder={t("bulkPlaceholder", lang)}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setCsvLines(null);
            }}
            spellCheck={false}
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handleSubmit}
              disabled={loading || !text.trim()}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8z"
                    />
                  </svg>
                  {lang === "ja" ? "検索中…" : "Pricing…"}
                </span>
              ) : (
                t("priceList", lang)
              )}
            </button>
            {hasResults && (
              <span className="text-sm text-gray-400">
                {displayRows!.filter((r) => !r.notFound).length}{" "}
                {lang === "ja" ? "枚" : "cards priced"}
                {displayRows!.some((r) => r.notFound) && (
                  <span className="text-orange-400 ml-2">
                    · {displayRows!.filter((r) => r.notFound).length}{" "}
                    {lang === "ja" ? "件未検出" : "not found"}
                  </span>
                )}
              </span>
            )}
          </div>

          {unparsed.length > 0 && (
            <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="text-xs font-semibold text-orange-700 mb-1">
                {t("unparsedLines", lang)} ({unparsed.length})
              </div>
              <ul className="text-xs font-mono text-orange-600 space-y-0.5">
                {unparsed.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Results table */}
        {displayRows && displayRows.length > 0 && (
          <div className="bg-white rounded-lg shadow-md border border-gray-100 p-4 md:p-6 mt-4">
            <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
              <table className="w-full text-xs md:text-sm text-left border-collapse min-w-[640px]">
                <thead>
                  <tr className="bg-gray-100 text-gray-700 border-b-2 border-gray-200">
                    <th className="py-2 px-2 md:px-3 w-10 font-bold text-right">
                      {lang === "ja" ? "枚" : "Qty"}
                    </th>
                    <th className="py-2 px-2 md:px-3 font-bold">
                      {lang === "ja" ? "カード名" : "Card"}
                    </th>
                    <th className="py-2 px-2 md:px-3 font-bold">
                      {lang === "ja" ? "版" : "Printing"}
                    </th>
                    <th
                      className="py-2 px-2 md:px-3 text-center border-l-2 border-gray-200 bg-gray-50"
                      colSpan={2}
                    >
                      {lang === "ja" ? "晴れる屋" : "Hareruya"}
                    </th>
                    <th
                      className="py-2 px-2 md:px-3 text-center border-l-2 border-gray-200 bg-blue-50"
                      colSpan={2}
                    >
                      {lang === "ja" ? "カードラッシュ" : "CardRush"}
                    </th>
                    <th className="py-2 px-2 md:px-3 text-right border-l-2 border-gray-300 bg-yellow-50 font-bold">
                      {t("lineKaitori", lang)}
                    </th>
                  </tr>
                  <tr className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wider border-b border-gray-100">
                    <th className="py-1 px-2 md:px-3" />
                    <th className="py-1 px-2 md:px-3" />
                    <th className="py-1 px-2 md:px-3" />
                    <th className="py-1 px-2 md:px-3 text-right border-l-2 border-gray-200">
                      {t("sell", lang)}
                    </th>
                    <th className="py-1 px-2 md:px-3 text-right">
                      {t("buy", lang)}
                    </th>
                    <th className="py-1 px-2 md:px-3 text-right border-l-2 border-gray-200 bg-blue-50">
                      {t("sell", lang)}
                    </th>
                    <th className="py-1 px-2 md:px-3 text-right bg-blue-50">
                      {t("buy", lang)}
                    </th>
                    <th className="py-1 px-2 md:px-3 text-right border-l-2 border-gray-300 bg-yellow-50">
                      ×qty
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayRows.map((row) => {
                    if (row.notFound) {
                      return (
                        <tr key={row.key} className="opacity-50">
                          <td className="py-2 px-2 md:px-3 text-right font-mono text-gray-500">
                            {row.qty}
                          </td>
                          <td
                            className="py-2 px-2 md:px-3 font-medium text-gray-400 italic"
                            colSpan={7}
                          >
                            {row.cardName}{" "}
                            <span className="text-xs text-orange-400 not-italic">
                              — {t("notFound", lang)}
                            </span>
                          </td>
                        </tr>
                      );
                    }

                    const v = row.variant!;
                    const hr = getShopPrice(v, "Hareruya");
                    const cr = getShopPrice(v, "CardRush");
                    const lineKaitori = maxKaitori(v) * row.qty;

                    return (
                      <tr
                        key={row.key}
                        className="hover:bg-blue-50/30 transition-colors"
                      >
                        <td className="py-2 px-2 md:px-3 text-right font-mono text-gray-500 align-middle">
                          {row.qty}
                        </td>
                        <td className="py-2 px-2 md:px-3 align-middle">
                          <div className="font-medium text-gray-900">
                            {lang === "ja"
                              ? (row.cardNameJa ?? row.cardName)
                              : row.cardName}
                          </div>
                          {row.cardNameJa && lang !== "ja" && (
                            <div className="text-[10px] text-gray-400">
                              {row.cardNameJa}
                            </div>
                          )}
                          {row.fallbackNote && (
                            <div className="text-[10px] text-orange-500 mt-0.5">
                              {t(
                                row.fallbackNote === "no_foil_tracked"
                                  ? "noFoilTracked"
                                  : "noNonfoilTracked",
                                lang,
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-2 md:px-3 align-middle">
                          <VariantChip
                            variant={v}
                            alternates={row.alternates}
                            tokenLocked={false}
                            lang={lang}
                            onPick={(picked) => handlePick(row.key, picked)}
                          />
                        </td>

                        {/* Hareruya */}
                        <td className="py-2 px-2 md:px-3 text-right font-mono border-l-2 border-gray-200 bg-gray-50/50 align-middle">
                          {hr ? (
                            <a
                              href={hr.sourceUrl ?? "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`hover:underline font-bold ${hr.stock === 0 ? "text-red-500" : "text-blue-600 hover:text-blue-800"}`}
                            >
                              {formatPrice(hr.priceYen)}
                            </a>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="py-2 px-2 md:px-3 text-right font-mono text-gray-600 align-middle">
                          {hr?.sellSourceUrl ? (
                            <a
                              href={hr.sellSourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline font-bold text-gray-600 hover:text-gray-800"
                            >
                              {formatPrice(hr.buyPriceYen)}
                            </a>
                          ) : (
                            formatPrice(hr?.buyPriceYen)
                          )}
                        </td>

                        {/* CardRush */}
                        <td className="py-2 px-2 md:px-3 text-right font-mono border-l-2 border-gray-200 bg-blue-50/50 align-middle">
                          {cr ? (
                            <a
                              href={cr.sourceUrl ?? "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`hover:underline font-bold ${cr.stock === 0 ? "text-red-500" : "text-blue-600 hover:text-blue-800"}`}
                            >
                              {formatPrice(cr.priceYen)}
                            </a>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="py-2 px-2 md:px-3 text-right font-mono text-gray-600 align-middle bg-blue-50/50">
                          {formatPrice(cr?.buyPriceYen)}
                        </td>

                        {/* Line kaitori */}
                        <td className="py-2 px-2 md:px-3 text-right font-mono font-bold border-l-2 border-gray-300 bg-yellow-50/50 align-middle text-gray-800">
                          {lineKaitori > 0
                            ? `¥${lineKaitori.toLocaleString()}`
                            : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Totals */}
                {totals && (
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 bg-gray-100 font-bold text-gray-800">
                      <td className="py-2 px-2 md:px-3" colSpan={3}>
                        {t("total", lang)}
                      </td>
                      <td className="py-2 px-2 md:px-3 text-right font-mono border-l-2 border-gray-200">
                        {totals.hrBuy > 0
                          ? `¥${totals.hrBuy.toLocaleString()}`
                          : "-"}
                      </td>
                      <td className="py-2 px-2 md:px-3 text-right font-mono">
                        {totals.hrSell > 0
                          ? `¥${totals.hrSell.toLocaleString()}`
                          : "-"}
                      </td>
                      <td className="py-2 px-2 md:px-3 text-right font-mono border-l-2 border-gray-200">
                        {totals.crBuy > 0
                          ? `¥${totals.crBuy.toLocaleString()}`
                          : "-"}
                      </td>
                      <td className="py-2 px-2 md:px-3 text-right font-mono">
                        {totals.crSell > 0
                          ? `¥${totals.crSell.toLocaleString()}`
                          : "-"}
                      </td>
                      <td className="py-2 px-2 md:px-3 text-right font-mono border-l-2 border-gray-300 bg-yellow-100">
                        {totals.kaitori > 0
                          ? `¥${totals.kaitori.toLocaleString()}`
                          : "-"}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
