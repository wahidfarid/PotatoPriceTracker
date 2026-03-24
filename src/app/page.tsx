import { getDashboardData } from '@/lib/data';
import { CardList } from '@/components/CardList';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { cards, lastUpdated } = await getDashboardData();

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <CardList initialCards={cards} lastUpdated={lastUpdated} />
      </div>
    </main>
  );
}
