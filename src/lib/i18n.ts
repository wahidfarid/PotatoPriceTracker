export type Lang = "en" | "ja";

export const STRINGS = {
  title: { en: "🥔 Price Tracker", ja: "🥔 価格トラッカー" },
  searchPlaceholder: {
    en: "Search by English name, Japanese name, or set code + number (e.g. SOS 42)",
    ja: "英語名・日本語名・セット番号で検索 (例: SOS 42)",
  },
  cardsMatching: { en: "cards matching", ja: "枚一致" },
  lastUpdated: { en: "Last updated:", ja: "最終更新:" },
  image: { en: "Image", ja: "画像" },
  ver: { en: "Ver", ja: "版" },
  ln: { en: "Ln", ja: "言語" },
  trend30: { en: "Last 30 days trend", ja: "30日間トレンド" },
  buy: { en: "Buy", ja: "買取" },
  sell: { en: "Sell", ja: "販売" },
  noImage: { en: "No Image", ja: "画像なし" },
  noResults: {
    en: 'No cards found matching "{q}"',
    ja: "「{q}」に一致するカードはありません",
  },
  clearSearch: { en: "Clear search", ja: "検索をクリア" },
  recentSearches: { en: "Recent searches", ja: "検索履歴" },
  noHistory: { en: "No history yet", ja: "履歴なし" },
  priceHistory: { en: "Price History", ja: "価格履歴" },
  loadingHistory: {
    en: "Loading price history...",
    ja: "価格履歴を読み込み中...",
  },
  historyError: {
    en: "Failed to load price history. Please try again.",
    ja: "価格履歴の読み込みに失敗しました。もう一度お試しください。",
  },
  retry: { en: "Retry", ja: "再試行" },
  close: { en: "Close", ja: "閉じる" },
  noPriceHistory: {
    en: "No price history available",
    ja: "価格履歴はありません",
  },
  bulk: { en: "Bulk", ja: "一括" },
  bulkTitle: { en: "Bulk Price Lookup", ja: "一括価格検索" },
  bulkPlaceholder: {
    en: "Paste a deck list here (MTG Arena format)…\n\n4 Lightning Bolt\n4x Sol Ring\n1 Elvish Mystic (SOS) 161\n1 Force of Will (ECL) 42 *F*",
    ja: "デッキリストをここに貼り付けてください（MTGアリーナ形式）…\n\n4 稲妻\n4x 太陽の指輪\n1 Elvish Mystic (SOS) 161\n1 Force of Will (ECL) 42 *F*",
  },
  priceList: { en: "Price List", ja: "価格一覧" },
  unparsedLines: { en: "Unrecognized lines", ja: "認識できない行" },
  notFound: { en: "Not found", ja: "見つからない" },
  total: { en: "Total", ja: "合計" },
  pickPrinting: { en: "Pick printing", ja: "版を選択" },
  noFoilTracked: {
    en: "no foil tracked, using non-foil",
    ja: "フォイル未収録、通常版を使用",
  },
  noNonfoilTracked: {
    en: "no non-foil tracked, using foil",
    ja: "通常版未収録、フォイル版を使用",
  },
  lineKaitori: { en: "Kaitori", ja: "買取" },
  pasteText: { en: "Paste text", ja: "テキストを貼り付け" },
  importCsv: { en: "Import Moxfield .csv", ja: "Moxfield CSV を読み込む" },
  pricing: { en: "Pricing…", ja: "検索中…" },
  cardsPriced: { en: "cards priced", ja: "枚" },
  notFoundCount: { en: "not found", ja: "件未検出" },
  colQty: { en: "Qty", ja: "枚" },
  colCard: { en: "Card", ja: "カード名" },
  colPrinting: { en: "Printing", ja: "版" },
  shopHareruya: { en: "Hareruya", ja: "晴れる屋" },
  shopCardrush: { en: "CardRush", ja: "カードラッシュ" },
  sparklineEmpty: {
    en: "No price history — click to view",
    ja: "価格履歴なし — クリックで表示",
  },
  sparklineClick: {
    en: "Click to view full price history",
    ja: "クリックで価格履歴を表示",
  },
} as const;

export const SET_NAMES_JA: Record<string, string> = {
  SOS: "ストリクスヘイヴンの秘密",
  SOC: "ストリクスヘイヴン統率者",
  SOA: "神秘的アーカイブ",
  ECL: "ローウィン・エクリプス",
  ECC: "ローウィン・エクリプス統率者",
  SPG: "スペシャルゲスト",
  TMT: "TMNT",
  TMC: "TMNT統率者",
  PZA: "TMNTマスターピース",
};

export function t(
  key: keyof typeof STRINGS,
  lang: Lang,
  vars: Record<string, string> = {},
): string {
  const raw =
    (STRINGS[key] as Record<string, string>)[lang] ??
    (STRINGS[key] as Record<string, string>).en;
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replace(`{${k}}`, v),
    raw,
  );
}

// Short badge labels used in card row
export function finishBadge(finish: string, lang: Lang): string {
  const map: Record<string, { en: string; ja: string }> = {
    surgefoil: { en: "Surge", ja: "サージ" },
    etchedfoil: { en: "Etched", ja: "エッチング" },
    fracturefoil: { en: "Fracture", ja: "骨折" },
    doublerainbowfoil: { en: "DblRnbw", ja: "DblRnbw" },
    foil: { en: "Foil", ja: "Foil" },
    nonfoil: { en: "Norm", ja: "通常" },
  };
  return map[finish]?.[lang] ?? finish;
}

// Long labels used in modal variant headings
export function finishLabel(finish: string, lang: Lang): string {
  const map: Record<string, { en: string; ja: string }> = {
    nonfoil: { en: "Normal", ja: "通常" },
    foil: { en: "Foil", ja: "Foil" },
    surgefoil: { en: "Surge Foil", ja: "サージ・フォイル" },
    etchedfoil: { en: "Etched Foil", ja: "エッチング・フォイル" },
    fracturefoil: { en: "Fracture Foil", ja: "骨折フォイル" },
    doublerainbowfoil: {
      en: "Double Rainbow Foil",
      ja: "ダブルレインボウ・フォイル",
    },
  };
  return map[finish]?.[lang] ?? finish;
}

// (Buy) / (Sell) suffixes for chart legend keys
export function chartSuffix(type: "buy" | "sell", lang: Lang): string {
  return type === "buy"
    ? lang === "ja"
      ? "(販売)"
      : "(Buy)"
    : lang === "ja"
      ? "(買取)"
      : "(Sell)";
}
