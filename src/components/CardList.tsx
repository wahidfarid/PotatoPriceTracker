"use client";

import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PriceHistoryModal } from "./PriceHistoryModal";
import { SparklineChart } from "./SparklineChart";
import { useLanguage } from "@/lib/LanguageContext";
import { t, finishBadge, SET_NAMES_JA, type Lang } from "@/lib/i18n";

const HISTORY_KEY = "pt-search-history";
const MAX_HISTORY = 10;
const HISTORY_SHOWN = 4;
const SUGGESTION_LIMIT = 8;

function readHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function pushHistory(entry: string, prev: string[]): string[] {
  const deduped = [
    entry,
    ...prev.filter((h) => h.toLowerCase() !== entry.toLowerCase()),
  ];
  const trimmed = deduped.slice(0, MAX_HISTORY);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch {}
  return trimmed;
}

interface SetInfo {
  code: string;
  name: string;
}

const formatPrice = (val: number | undefined | null) =>
  val ? `¥${val.toLocaleString()}` : "-";

interface CardRowProps {
  card: any;
  setName: string;
  lang: Lang;
  onOpenModal: (cardId: string) => void;
}

const CardRow = memo(function CardRow({
  card,
  setName,
  lang,
  onOpenModal,
}: CardRowProps) {
  const displayName = lang === "ja" ? (card.nameJa ?? card.name) : card.name;

  return (
    <>
      <div className="flex justify-between items-baseline mb-3 md:mb-4 border-b pb-2">
        <h2 className="text-lg md:text-xl font-bold text-gray-900 truncate">
          {displayName}
        </h2>
        <span className="text-xs md:text-sm text-gray-400 font-medium">
          {setName}
        </span>
      </div>

      <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
        <table className="w-full text-xs md:text-sm text-left border-collapse min-w-[500px] md:min-w-0">
          <thead>
            <tr className="bg-gray-100 text-gray-700 border-b-2 border-gray-200">
              <th className="py-2 px-2 md:px-3 w-8 md:w-12 font-bold">#</th>
              <th className="py-2 px-2 md:px-3 w-32 md:w-48 font-bold">
                {t("image", lang)}
              </th>
              <th className="py-2 px-2 md:px-3 w-16 md:w-20 font-bold">
                {t("ver", lang)}
              </th>
              <th className="py-2 px-2 md:px-3 w-8 md:w-12 font-bold">
                {t("ln", lang)}
              </th>
              <th
                className="py-2 px-2 md:px-3 text-center border-l-2 border-gray-200 bg-gray-50"
                colSpan={2}
              >
                {t("trend30", lang)}
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
            </tr>
            <tr className="bg-gray-50 text-gray-500 text-[10px] md:text-[11px] uppercase tracking-wider border-b border-gray-100">
              <th className="py-1 px-2 md:px-3"></th>
              <th className="py-1 px-2 md:px-3"></th>
              <th className="py-1 px-2 md:px-3"></th>
              <th className="py-1 px-2 md:px-3"></th>
              <th className="py-1 px-2 md:px-3 text-center border-l-2 border-gray-200">
                {t("buy", lang)}
              </th>
              <th className="py-1 px-2 md:px-3 text-center">
                {t("sell", lang)}
              </th>
              <th className="py-1 px-2 md:px-3 text-right border-l-2 border-gray-200">
                {t("buy", lang)}
              </th>
              <th className="py-1 px-2 md:px-3 text-right">
                {t("sell", lang)}
              </th>
              <th className="py-1 px-2 md:px-3 text-right border-l-2 border-gray-200 bg-blue-50">
                {t("buy", lang)}
              </th>
              <th className="py-1 px-2 md:px-3 text-right bg-blue-50">
                {t("sell", lang)}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {card.variants.map((variant: any, index: number, arr: any[]) => {
              const hareruyaPrice = variant.prices.find(
                (p: any) => p.shop.name === "Hareruya",
              );
              const cardrushPrice = variant.prices.find(
                (p: any) => p.shop.name === "CardRush",
              );

              const hareruyaSell = hareruyaPrice?.priceYen;
              const hareruyaBuy = hareruyaPrice?.buyPriceYen;
              const cardrushSell = cardrushPrice?.priceYen;
              const cardrushBuy = cardrushPrice?.buyPriceYen;

              const isFirstOfCollectorNumber =
                index === 0 ||
                arr[index - 1].collectorNumber !== variant.collectorNumber;

              let rowSpan = 1;
              if (isFirstOfCollectorNumber) {
                for (let i = index + 1; i < arr.length; i++) {
                  if (arr[i].collectorNumber === variant.collectorNumber) {
                    rowSpan++;
                  } else {
                    break;
                  }
                }
              }

              return (
                <tr
                  key={variant.id}
                  className="hover:bg-blue-50/30 transition-colors"
                >
                  <td className="py-2 px-2 md:px-3 text-gray-400 font-mono font-medium align-middle">
                    {variant.collectorNumber}
                  </td>

                  {isFirstOfCollectorNumber && (
                    <td
                      className="py-2 px-2 md:px-3 align-middle border-r border-gray-100 bg-white cursor-pointer"
                      rowSpan={rowSpan}
                      onClick={() => onOpenModal(card.id)}
                    >
                      {variant.scryfallId ? (
                        <div className="flex justify-center p-1">
                          <img
                            src={`https://cards.scryfall.io/normal/front/${variant.scryfallId.charAt(0)}/${variant.scryfallId.charAt(1)}/${variant.scryfallId}.jpg`}
                            alt="art"
                            className="w-24 md:w-44 h-auto rounded-md shadow-md hover:opacity-80 transition-opacity"
                          />
                        </div>
                      ) : (
                        <div className="w-24 md:w-44 h-36 md:h-64 bg-gray-50 rounded-md border border-dashed border-gray-200 flex items-center justify-center text-gray-300">
                          {t("noImage", lang)}
                        </div>
                      )}
                    </td>
                  )}

                  <td className="py-2 px-2 md:px-3 align-middle whitespace-nowrap">
                    {variant.finish === "surgefoil" ? (
                      <span className="bg-purple-100 text-purple-900 text-[9px] md:text-[11px] px-1.5 md:px-2 py-0.5 rounded-full font-bold border border-purple-200 shadow-sm">
                        {finishBadge("surgefoil", lang)}
                      </span>
                    ) : variant.finish === "etchedfoil" ? (
                      <span className="bg-teal-100 text-teal-900 text-[9px] md:text-[11px] px-1.5 md:px-2 py-0.5 rounded-full font-bold border border-teal-200 shadow-sm">
                        {finishBadge("etchedfoil", lang)}
                      </span>
                    ) : variant.finish === "fracturefoil" ? (
                      <span className="bg-rose-100 text-rose-900 text-[9px] md:text-[11px] px-1.5 md:px-2 py-0.5 rounded-full font-bold border border-rose-200 shadow-sm">
                        {finishBadge("fracturefoil", lang)}
                      </span>
                    ) : variant.finish === "doublerainbowfoil" ? (
                      <span className="bg-gradient-to-r from-pink-100 to-purple-100 text-purple-900 text-[9px] md:text-[11px] px-1.5 md:px-2 py-0.5 rounded-full font-bold border border-purple-200 shadow-sm">
                        {finishBadge("doublerainbowfoil", lang)}
                      </span>
                    ) : variant.finish === "foil" ? (
                      <span className="bg-amber-100 text-amber-900 text-[9px] md:text-[11px] px-1.5 md:px-2 py-0.5 rounded-full font-bold border border-amber-200 shadow-sm">
                        {finishBadge("foil", lang)}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-[9px] md:text-[11px] font-medium border border-gray-100 px-1.5 md:px-2 py-0.5 rounded-full">
                        {finishBadge("nonfoil", lang)}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-2 md:px-3 font-bold text-gray-800 align-middle text-center">
                    {variant.language}
                  </td>

                  <td className="py-2 px-2 md:px-3 border-l-2 border-gray-200 bg-gray-50/50 align-middle text-center">
                    <SparklineChart
                      variantId={variant.id}
                      data={variant.sparklineBuyData || []}
                      onClick={() => onOpenModal(card.id)}
                    />
                  </td>
                  <td className="py-2 px-2 md:px-3 bg-gray-50/50 align-middle text-center">
                    <SparklineChart
                      variantId={variant.id}
                      data={variant.sparklineSellData || []}
                      onClick={() => onOpenModal(card.id)}
                    />
                  </td>

                  <td className="py-2 px-2 md:px-3 text-right font-mono border-l-2 border-gray-200 bg-gray-50/50 align-middle">
                    {hareruyaPrice ? (
                      <a
                        href={hareruyaPrice.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`hover:underline font-bold ${hareruyaPrice.stock === 0 ? "text-red-500" : "text-blue-600 hover:text-blue-800"}`}
                      >
                        {formatPrice(hareruyaSell)}
                      </a>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>

                  <td className="py-2 px-2 md:px-3 text-right font-mono text-gray-600 align-middle">
                    {hareruyaPrice?.sellSourceUrl ? (
                      <a
                        href={hareruyaPrice.sellSourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline font-bold text-gray-600 hover:text-gray-800"
                      >
                        {formatPrice(hareruyaBuy)}
                      </a>
                    ) : (
                      formatPrice(hareruyaBuy)
                    )}
                  </td>

                  <td className="py-2 px-2 md:px-3 text-right font-mono border-l-2 border-gray-200 bg-blue-50/50 align-middle">
                    {cardrushPrice ? (
                      <a
                        href={cardrushPrice.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`hover:underline font-bold ${
                          cardrushPrice.stock === 0
                            ? "text-red-500"
                            : "text-blue-600 hover:text-blue-800"
                        }`}
                      >
                        {formatPrice(cardrushSell)}
                      </a>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>

                  <td className="py-2 px-2 md:px-3 text-right font-mono text-gray-600 align-middle">
                    {cardrushBuy ? (
                      <a
                        href={`https://cardrush.media/mtg/buying_prices?${new URLSearchParams(
                          [
                            ["displayMode", "リスト"],
                            ["limit", "100"],
                            ["name", card.name],
                            ["rarity", ""],
                            ["model_number", ""],
                            ["amount", ""],
                            ["page", "1"],
                            ["sort[key]", "name"],
                            ["sort[order]", "desc"],
                            ["associations[]", "ocha_product"],
                            ["to_json_option[methods]", "name_with_condition"],
                            [
                              "to_json_option[except][]",
                              "original_image_source",
                            ],
                            ["to_json_option[except][]", "created_at"],
                            [
                              "to_json_option[include][ocha_product][only][]",
                              "id",
                            ],
                            [
                              "to_json_option[include][ocha_product][methods][]",
                              "image_source",
                            ],
                            ["display_category[]", "高額系"],
                            ["display_category[]", "foil系"],
                            ["display_category[]", "スタンダード"],
                            ["display_category[]", "スタンダード最新弾"],
                            ["display_category[]", "パイオニア以下"],
                            ["display_category[]", "モダン以下最新弾"],
                            ["is_hot[]", "true"],
                            ["is_hot[]", "false"],
                          ],
                        ).toString()}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline font-bold text-gray-600 hover:text-gray-800"
                      >
                        {formatPrice(cardrushBuy)}
                      </a>
                    ) : (
                      formatPrice(cardrushBuy)
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
});

interface CardListProps {
  initialCards: any[];
  lastUpdated: string | null;
  currentSet: string;
  sets: SetInfo[];
  initialSearch?: string;
}

export function CardList({
  initialCards,
  lastUpdated,
  currentSet,
  sets,
  initialSearch,
}: CardListProps) {
  const router = useRouter();
  const { lang, setLang } = useLanguage();
  const [search, setSearch] = useState(initialSearch ?? "");
  const deferredSearch = useDeferredValue(search);
  const [openModalCardId, setOpenModalCardId] = useState<string | null>(null);

  const [navigating, setNavigating] = useState<string | null>(null);

  useEffect(() => {
    setNavigating(null);
  }, [currentSet]);

  // Search dropdown state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHistory(readHistory());
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const setCodes = new Set(sets.map((s) => s.code.toUpperCase()));
  const parts = deferredSearch.trim().split(/\s+/);
  const firstUpper = (parts[0] ?? "").toUpperCase();
  const hasSetPrefix =
    setCodes.has(firstUpper) &&
    (parts.length > 1 || deferredSearch.endsWith(" "));
  const numberQuery = hasSetPrefix ? parts.slice(1).join(" ") : "";

  const filteredCards =
    hasSetPrefix && firstUpper === currentSet
      ? initialCards.filter(
          (card) =>
            numberQuery === "" ||
            card.variants.some((v: any) =>
              v.collectorNumber.startsWith(numberQuery),
            ),
        )
      : initialCards.filter((card) => {
          const q = deferredSearch.toLowerCase();
          return (
            card.name.toLowerCase().includes(q) ||
            (card.nameJa && card.nameJa.toLowerCase().includes(q))
          );
        });

  const matchedIds = new Set(filteredCards.map((c: any) => c.id));

  // Autocomplete suggestions from client-side card list
  const suggestions = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return [];
    return initialCards
      .filter(
        (card) =>
          card.name.toLowerCase().includes(q) ||
          (card.nameJa && card.nameJa.toLowerCase().includes(q)),
      )
      .slice(0, SUGGESTION_LIMIT)
      .map((card) => ({
        label: lang === "ja" ? (card.nameJa ?? card.name) : card.name,
        value: lang === "ja" ? (card.nameJa ?? card.name) : card.name,
      }));
  }, [search, initialCards, lang]);

  const dropdownItems = search
    ? suggestions
    : history.slice(0, HISTORY_SHOWN).map((h) => ({ label: h, value: h }));

  const commitHistory = useCallback((term: string) => {
    if (term.trim().length >= 2) {
      setHistory((prev) => pushHistory(term.trim(), prev));
    }
  }, []);

  const selectItem = useCallback(
    (value: string) => {
      setSearch(value);
      commitHistory(value);
      setDropdownOpen(false);
      setActiveIndex(-1);
    },
    [commitHistory],
  );

  useEffect(() => {
    if (hasSetPrefix && firstUpper !== currentSet) {
      const url = numberQuery
        ? `/?set=${firstUpper}&q=${encodeURIComponent(numberQuery)}`
        : `/?set=${firstUpper}`;
      router.replace(url);
    }
  }, [hasSetPrefix, firstUpper, numberQuery, currentSet, router]);

  const handleOpenModal = useCallback(
    (id: string) => setOpenModalCardId(id),
    [],
  );

  const currentSetName = useMemo(() => {
    const base = sets.find((s) => s.code === currentSet);
    if (!base) return currentSet;
    return lang === "ja" ? (SET_NAMES_JA[currentSet] ?? base.name) : base.name;
  }, [sets, currentSet, lang]);

  return (
    <>
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-3 md:px-4">
          <div className="flex items-center gap-2 md:gap-4 py-3 md:py-4">
            <h1 className="text-lg md:text-xl font-bold text-gray-800 whitespace-nowrap hidden sm:block">
              {t("title", lang)}
            </h1>

            {/* Search with dropdown */}
            <div className="relative flex-1" ref={wrapperRef}>
              <input
                type="text"
                placeholder={t("searchPlaceholder", lang)}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setActiveIndex(-1);
                }}
                onFocus={() => setDropdownOpen(true)}
                onBlur={() => {
                  setTimeout(() => {
                    setDropdownOpen(false);
                    commitHistory(search);
                  }, 150);
                }}
                onKeyDown={(e) => {
                  if (!dropdownOpen) return;
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveIndex((i) =>
                      Math.min(i + 1, dropdownItems.length - 1),
                    );
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveIndex((i) => Math.max(i - 1, -1));
                  } else if (e.key === "Enter") {
                    if (activeIndex >= 0 && dropdownItems[activeIndex]) {
                      e.preventDefault();
                      selectItem(dropdownItems[activeIndex].value);
                    } else {
                      commitHistory(search);
                      setDropdownOpen(false);
                    }
                  } else if (e.key === "Escape") {
                    setDropdownOpen(false);
                    setActiveIndex(-1);
                  }
                }}
                className="w-full p-2 pl-9 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm transition-all shadow-inner bg-gray-50 text-gray-900"
              />
              <svg
                className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>

              {/* Dropdown */}
              {dropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden">
                  {dropdownItems.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-gray-400">
                      {search
                        ? t("noResults", lang, { q: search })
                        : t("noHistory", lang)}
                    </div>
                  ) : (
                    <>
                      {!search && (
                        <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                          {t("recentSearches", lang)}
                        </div>
                      )}
                      {dropdownItems.map((item, i) => (
                        <div
                          key={item.value + i}
                          className={`px-3 py-2 text-sm cursor-pointer flex items-center gap-2 ${
                            i === activeIndex
                              ? "bg-blue-50 text-blue-700"
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectItem(item.value);
                          }}
                        >
                          {!search && (
                            <svg
                              className="h-3 w-3 text-gray-400 flex-shrink-0"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          )}
                          <span className="truncate">{item.label}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="text-xs text-gray-500 hidden md:block">
              {matchedIds.size} {t("cardsMatching", lang)}
            </div>
            {lastUpdated && (
              <div className="text-xs text-gray-400 hidden md:block whitespace-nowrap">
                {t("lastUpdated", lang)}{" "}
                {new Date(lastUpdated).toLocaleDateString(
                  lang === "ja" ? "ja-JP" : "en-US",
                  {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  },
                )}
              </div>
            )}

            {/* Bulk link */}
            <Link
              href="/bulk"
              className="px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex-shrink-0"
            >
              {t("bulk", lang)}
            </Link>

            {/* Language switcher */}
            <div className="flex rounded-full overflow-hidden border border-gray-200 text-xs font-medium flex-shrink-0">
              <button
                onClick={() => setLang("en")}
                className={`px-2.5 py-1 transition-colors ${
                  lang === "en"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLang("ja")}
                className={`px-2.5 py-1 transition-colors ${
                  lang === "ja"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                日本語
              </button>
            </div>
          </div>

          {/* Set tabs */}
          <div className="flex gap-1 pb-2 overflow-x-auto">
            {sets.map((s) => {
              const isActive = s.code === currentSet;
              const isLoading = navigating === s.code;
              return (
                <button
                  key={s.code}
                  onClick={() => {
                    if (isActive || isLoading) return;
                    setNavigating(s.code);
                    router.push(`/?set=${s.code}`);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : isLoading
                        ? "bg-blue-400 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {isLoading && (
                    <svg
                      className="animate-spin h-3 w-3 flex-shrink-0"
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
                  )}
                  {lang === "ja" ? (SET_NAMES_JA[s.code] ?? s.name) : s.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div
        className={`pt-24 md:pt-28 grid gap-4 md:gap-8 transition-opacity duration-200 ${navigating ? "opacity-40 pointer-events-none" : ""}`}
      >
        {initialCards.map((card) => (
          <div
            key={card.id}
            className={`bg-white p-4 md:p-6 rounded-lg shadow-md border border-gray-100${matchedIds.has(card.id) ? "" : " hidden"}`}
          >
            <CardRow
              card={card}
              setName={currentSetName}
              lang={lang}
              onOpenModal={handleOpenModal}
            />
          </div>
        ))}

        {matchedIds.size === 0 && (
          <div className="text-center py-20 bg-white rounded-lg shadow-inner border-2 border-dashed border-gray-200">
            <div className="text-gray-400 text-lg font-medium">
              {t("noResults", lang, { q: search })}
            </div>
            <button
              onClick={() => setSearch("")}
              className="mt-4 text-blue-500 hover:underline"
            >
              {t("clearSearch", lang)}
            </button>
          </div>
        )}
      </div>

      {openModalCardId && (
        <PriceHistoryModal
          cardName={(() => {
            const card = initialCards.find(
              (c: any) => c.id === openModalCardId,
            );
            if (!card) return "";
            return lang === "ja" ? (card.nameJa ?? card.name) : card.name;
          })()}
          cardId={openModalCardId}
          variants={
            initialCards.find((c: any) => c.id === openModalCardId)?.variants ||
            []
          }
          isOpen={true}
          onClose={() => setOpenModalCardId(null)}
        />
      )}
    </>
  );
}
