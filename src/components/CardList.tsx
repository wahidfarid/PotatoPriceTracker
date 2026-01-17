
'use client';

import { useState } from 'react';

interface CardListProps {
    initialCards: any[];
}

export function CardList({ initialCards }: CardListProps) {
    const [search, setSearch] = useState('');

    const filteredCards = initialCards.filter(card =>
        card.name.toLowerCase().includes(search.toLowerCase())
    );

    const formatPrice = (val: number | undefined | null) => val ? `¥${val.toLocaleString()}` : '-';

    return (
        <>
            {/* Fixed Search Bar */}
            <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b shadow-sm p-4">
                <div className="max-w-7xl mx-auto flex items-center gap-4">
                    <h1 className="text-xl font-bold text-gray-800 whitespace-nowrap hidden md:block">🥔 Price Tracker</h1>
                    <div className="relative flex-1">
                        <input
                            type="text"
                            placeholder="Search cards by name (English)..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full p-2 pl-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm transition-all shadow-inner bg-gray-50 text-gray-900"
                        />
                        <svg
                            className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <div className="text-sm text-gray-500 hidden sm:block">
                        {filteredCards.length} cards matching
                    </div>
                </div>
            </div>

            <div className="pt-20 grid gap-8">
                {filteredCards.map((card) => (
                    <div key={card.id} className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
                        <div className="flex justify-between items-baseline mb-4 border-b pb-2">
                            <h2 className="text-xl font-bold text-gray-900 truncate">{card.name}</h2>
                            <span className="text-sm text-gray-400 font-medium">Lorwyn Eclipsed</span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-100 text-gray-700 border-b-2 border-gray-200">
                                        <th className="py-2 px-3 w-12 font-bold">#</th>
                                        <th className="py-2 px-3 w-48 font-bold">Image</th>
                                        <th className="py-2 px-3 w-20 font-bold">Ver</th>
                                        <th className="py-2 px-3 w-12 font-bold">Lang</th>
                                        <th className="py-2 px-3 text-center border-l-2 border-gray-200 bg-gray-50" colSpan={2}>Hareruya</th>
                                    </tr>
                                    <tr className="bg-gray-50 text-gray-500 text-[11px] uppercase tracking-wider border-b border-gray-100">
                                        <th className="py-1 px-3"></th>
                                        <th className="py-1 px-3"></th>
                                        <th className="py-1 px-3"></th>
                                        <th className="py-1 px-3"></th>
                                        <th className="py-1 px-3 text-right border-l-2 border-gray-200">Buying</th>
                                        <th className="py-1 px-3 text-right">Selling</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {card.variants.map((variant: any, index: number, arr: any[]) => {
                                        const hareruyaPrice = variant.prices.find((p: any) => p.shop.name === 'Hareruya');
                                        const sellPrice = hareruyaPrice?.priceYen;
                                        const buyPrice = hareruyaPrice?.buyPriceYen;

                                        const isFirstOfCollectorNumber = index === 0 || arr[index - 1].collectorNumber !== variant.collectorNumber;

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
                                            <tr key={variant.id} className="hover:bg-blue-50/30 transition-colors">
                                                <td className="py-2 px-3 text-gray-400 font-mono font-medium align-middle">{variant.collectorNumber}</td>

                                                {isFirstOfCollectorNumber && (
                                                    <td className="py-2 px-3 align-middle border-r border-gray-100 bg-white" rowSpan={rowSpan}>
                                                        {variant.scryfallId ? (
                                                            <div className="flex justify-center p-1">
                                                                <img
                                                                    src={`https://cards.scryfall.io/normal/front/${variant.scryfallId.charAt(0)}/${variant.scryfallId.charAt(1)}/${variant.scryfallId}.jpg`}
                                                                    alt="art"
                                                                    className="w-44 h-auto rounded-md shadow-md"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="w-44 h-64 bg-gray-50 rounded-md border border-dashed border-gray-200 flex items-center justify-center text-gray-300">
                                                                No Image
                                                            </div>
                                                        )}
                                                    </td>
                                                )}

                                                <td className="py-2 px-3 align-middle whitespace-nowrap">
                                                    {variant.isFoil ? (
                                                        <span className="bg-amber-100 text-amber-900 text-[11px] px-2 py-0.5 rounded-full font-bold border border-amber-200 shadow-sm">Foil</span>
                                                    ) : (
                                                        <span className="text-gray-400 text-[11px] font-medium border border-gray-100 px-2 py-0.5 rounded-full">Normal</span>
                                                    )}
                                                </td>
                                                <td className="py-2 px-3 font-bold text-gray-800 align-middle text-center">{variant.language}</td>

                                                <td className="py-2 px-3 text-right font-mono border-l-2 border-gray-200 bg-gray-50/50 align-middle">
                                                    {hareruyaPrice ? (
                                                        <a
                                                            href={hareruyaPrice.sourceUrl}
                                                            target="_blank"
                                                            className={`hover:underline block py-1 font-bold ${hareruyaPrice.stock === 0 ? 'text-red-500' : 'text-blue-600 hover:text-blue-800'}`}
                                                        >
                                                            {formatPrice(sellPrice)}
                                                        </a>
                                                    ) : <span className="text-gray-300">-</span>}
                                                </td>
                                                <td className="py-2 px-3 text-right font-mono text-gray-600 align-middle">
                                                    {formatPrice(buyPrice)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}

                {filteredCards.length === 0 && (
                    <div className="text-center py-20 bg-white rounded-lg shadow-inner border-2 border-dashed border-gray-200">
                        <div className="text-gray-400 text-lg font-medium">No cards found matching "{search}"</div>
                        <button onClick={() => setSearch('')} className="mt-4 text-blue-500 hover:underline">Clear search</button>
                    </div>
                )}
            </div>
        </>
    );
}
