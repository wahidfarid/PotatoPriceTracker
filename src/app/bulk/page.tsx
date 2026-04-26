import { LanguageProvider } from "@/lib/LanguageContext";
import { BulkPricer } from "@/components/BulkPricer";

export default function BulkPage() {
  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <LanguageProvider>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <BulkPricer />
        </div>
      </LanguageProvider>
    </main>
  );
}
