import { getDashboardData } from "@/lib/data";
import { CardList } from "@/components/CardList";

const SETS = [
  { code: "SOS", name: "Strixhaven" },
  { code: "SOC", name: "Strixhaven Cmdr" },
  { code: "SOA", name: "Mystical Archive" },
  { code: "ECL", name: "Eclipsed" },
  { code: "ECC", name: "Eclipsed Cmdr" },
  { code: "SPG", name: "Special Guests" },
  { code: "TMT", name: "TMNT" },
  { code: "TMC", name: "TMNT Cmdr" },
  { code: "PZA", name: "TMNT Masterpiece" },
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ set?: string }>;
}) {
  const { set } = await searchParams;
  const currentSet = SETS.find((s) => s.code === set)?.code || SETS[0].code;
  const { cards, lastUpdated } = await getDashboardData(currentSet);

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <CardList
          initialCards={cards}
          lastUpdated={lastUpdated}
          currentSet={currentSet}
          sets={SETS}
        />
      </div>
    </main>
  );
}
