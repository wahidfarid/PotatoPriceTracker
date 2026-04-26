export interface ParsedLine {
  qty: number;
  name: string;
  setCode?: string;
  collectorNumber?: string;
  foil: boolean;
  language?: string; // "EN" | "JP" — undefined means no preference
  raw: string;
}

export interface ShopPrice {
  shopName: string;
  priceYen: number;
  buyPriceYen: number | null;
  stock: number;
  sourceUrl: string | null;
  sellSourceUrl: string | null;
}

export interface VariantInfo {
  id: string;
  setCode: string;
  collectorNumber: string;
  finish: string;
  language: string;
  scryfallId: string | null;
  prices: ShopPrice[];
}

export interface ResolvedRow {
  key: string;
  qty: number;
  cardName: string;
  cardNameJa: string | null;
  variant: VariantInfo | null;
  alternates: VariantInfo[];
  fallbackNote: "no_foil_tracked" | "no_nonfoil_tracked" | null;
  notFound: boolean;
}

const SKIP_HEADERS = /^(deck|sideboard|commander|companion|maybeboard)\s*$/i;
const COMMENT = /^(\/\/|#)/;
// Groups: 1=qty, 2=name, 3=setCode, 4=CN, 5=foilToken
const LINE_RE =
  /^(?:(\d+)\s*x?\s+)?(.+?)(?:\s+\(([A-Z0-9]{2,5})\)\s+([A-Za-z0-9★]+))?(\s+\*[Ff]\*)?\s*$/;

export function parseDeckList(text: string): {
  parsed: ParsedLine[];
  unparsed: string[];
} {
  const parsed: ParsedLine[] = [];
  const unparsed: string[] = [];

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (COMMENT.test(line)) continue;
    if (SKIP_HEADERS.test(line)) continue;

    const m = LINE_RE.exec(line);
    if (!m) {
      unparsed.push(raw);
      continue;
    }

    const [, qtyStr, rawName, setCode, cn, foilToken] = m;
    const name = rawName.trim().replace(/\s*\/\/\s*/g, " // ");
    if (!name) {
      unparsed.push(raw);
      continue;
    }

    parsed.push({
      qty: qtyStr ? parseInt(qtyStr, 10) : 1,
      name,
      setCode: setCode?.toUpperCase(),
      collectorNumber: cn,
      foil: !!foilToken,
      raw,
    });
  }

  return { parsed, unparsed };
}

// ── Moxfield CSV import ────────────────────────────────────────────────────────

function parseCsvRow(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

// Converts a ParsedLine back to Arena-format text (used to populate textarea after CSV import)
export function parsedLineToText(p: ParsedLine): string {
  let s = `${p.qty} ${p.name}`;
  if (p.setCode && p.collectorNumber)
    s += ` (${p.setCode}) ${p.collectorNumber}`;
  if (p.foil) s += " *F*";
  return s;
}

const SET_CODE_RE = /^[A-Z0-9]{2,5}$/;

export function parseMoxfieldCsv(csvText: string): {
  parsed: ParsedLine[];
  unparsed: string[];
} {
  const lines = csvText.split(/\r?\n/);
  if (lines.length === 0) return { parsed: [], unparsed: [] };

  const headers = parseCsvRow(lines[0]).map((h) => h.toLowerCase());
  const col = (name: string) => headers.indexOf(name);

  const idxCount = col("count");
  const idxName = col("name");
  const idxEdition = col("edition");
  const idxFoil = col("foil");
  const idxCN = col("collector number");
  const idxLang = col("language");

  if (idxName === -1) return { parsed: [], unparsed: lines.slice(1) };

  const parsed: ParsedLine[] = [];
  const unparsed: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;

    const fields = parseCsvRow(raw);
    const name = idxName >= 0 ? (fields[idxName] ?? "") : "";
    if (!name) {
      unparsed.push(raw);
      continue;
    }

    const qtyRaw = idxCount >= 0 ? fields[idxCount] : "";
    const qty = parseInt(qtyRaw, 10);
    if (isNaN(qty) || qty < 1) {
      unparsed.push(raw);
      continue;
    }

    const edition =
      idxEdition >= 0 ? (fields[idxEdition] ?? "").toUpperCase() : "";
    const cn = idxCN >= 0 ? (fields[idxCN] ?? "").trim() : "";
    const foilRaw = idxFoil >= 0 ? (fields[idxFoil] ?? "").toLowerCase() : "";
    const foil =
      foilRaw === "foil" || foilRaw === "etched" || foilRaw === "true";
    const langRaw =
      idxLang >= 0 ? (fields[idxLang] ?? "").trim().toLowerCase() : "";
    const language =
      langRaw === "japanese" || langRaw === "jp" || langRaw === "ja"
        ? "JP"
        : langRaw === "english" || langRaw === "en"
          ? "EN"
          : undefined;

    // Only use Edition as set code if it looks like one (2-5 uppercase alphanumeric chars)
    const setCode = SET_CODE_RE.test(edition) ? edition : undefined;
    const collectorNumber = setCode && cn ? cn : undefined;

    parsed.push({
      qty,
      name: name.replace(/\s*\/\/\s*/g, " // "),
      setCode,
      collectorNumber,
      foil,
      language,
      raw,
    });
  }

  return { parsed, unparsed };
}
