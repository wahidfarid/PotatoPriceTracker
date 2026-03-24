
'use client';

import { useState } from 'react';
import { PriceHistoryModal } from './PriceHistoryModal';
import { SparklineChart } from './SparklineChart';

interface CardListProps {
    initialCards: any[];
    lastUpdated: string | null;
}

export function CardList({ initialCards, lastUpdated }: CardListProps) {
    const [search, setSearch] = useState('');
    const [openModalCardId, setOpenModalCardId] = useState<string | null>(null);

    const filteredCards = initialCards.filter(card =>
        card.name.toLowerCase().includes(search.toLowerCase())
    );

    const formatPrice = (val: number | undefined | null) => val ? `¥${val.toLocaleString()}` : '-';

    return (
        <>
            {/* Fixed Search Bar */}
            <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b shadow-sm p-3 md:p-4">
                <div className="max-w-7xl mx-auto flex items-center gap-2 md:gap-4">
                    <h1 className="text-lg md:text-xl font-bold text-gray-800 whitespace-nowrap hidden sm:block">🥔 Price Tracker</h1>
                    <div className="relative flex-1">
                        <input
                            type="text"
                            placeholder="Search cards..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full p-2 pl-9 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm transition-all shadow-inner bg-gray-50 text-gray-900"
                        />
                        <svg
                            className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <div className="text-xs text-gray-500 hidden md:block">
                        {filteredCards.length} cards matching
                    </div>
                    {lastUpdated && (
                        <div className="text-xs text-gray-400 hidden md:block whitespace-nowrap">
                            Last updated: {new Date(lastUpdated).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </div>
                    )}
                </div>
            </div>

            <div className="pt-16 md:pt-20 grid gap-4 md:gap-8">
                {filteredCards.map((card) => (
                    <div key={card.id} className="bg-white p-4 md:p-6 rounded-lg shadow-md border border-gray-100">
                        <div className="flex justify-between items-baseline mb-3 md:mb-4 border-b pb-2">
                            <h2 className="text-lg md:text-xl font-bold text-gray-900 truncate">{card.name}</h2>
                            <span className="text-xs md:text-sm text-gray-400 font-medium">Lorwyn Eclipsed</span>
                        </div>

                        <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
                            <table className="w-full text-xs md:text-sm text-left border-collapse min-w-[500px] md:min-w-0">
                                <thead>
                                    <tr className="bg-gray-100 text-gray-700 border-b-2 border-gray-200">
                                        <th className="py-2 px-2 md:px-3 w-8 md:w-12 font-bold">#</th>
                                        <th className="py-2 px-2 md:px-3 w-32 md:w-48 font-bold">Image</th>
                                        <th className="py-2 px-2 md:px-3 w-16 md:w-20 font-bold">Ver</th>
                                        <th className="py-2 px-2 md:px-3 w-8 md:w-12 font-bold">Ln</th>
                                        <th className="py-2 px-2 md:px-3 text-center border-l-2 border-gray-200 bg-gray-50" colSpan={2}>Last 30 days trend</th>
                                        <th className="py-2 px-2 md:px-3 text-center border-l-2 border-gray-200 bg-gray-50" colSpan={2}>Hareruya</th>
                                        <th className="py-2 px-2 md:px-3 text-center border-l-2 border-gray-200 bg-blue-50" colSpan={2}>CardRush</th>
                                    </tr>
                                    <tr className="bg-gray-50 text-gray-500 text-[10px] md:text-[11px] uppercase tracking-wider border-b border-gray-100">
                                        <th className="py-1 px-2 md:px-3"></th>
                                        <th className="py-1 px-2 md:px-3"></th>
                                        <th className="py-1 px-2 md:px-3"></th>
                                        <th className="py-1 px-2 md:px-3"></th>
                                        {/* Trend */}
                                        <th className="py-1 px-2 md:px-3 text-center border-l-2 border-gray-200">Buy</th>
                                        <th className="py-1 px-2 md:px-3 text-center">Sell</th>
                                        {/* Hareruya */}
                                        <th className="py-1 px-2 md:px-3 text-right border-l-2 border-gray-200">Buy</th>
                                        <th className="py-1 px-2 md:px-3 text-right">Sell</th>
                                        {/* CardRush */}
                                        <th className="py-1 px-2 md:px-3 text-right border-l-2 border-gray-200 bg-blue-50">Buy</th>
                                        <th className="py-1 px-2 md:px-3 text-right bg-blue-50">Sell</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {card.variants.map((variant: any, index: number, arr: any[]) => {
                                        const hareruyaPrice = variant.prices.find((p: any) => p.shop.name === 'Hareruya');
                                        const cardrushPrice = variant.prices.find((p: any) => p.shop.name === 'CardRush');

                                        const hareruyaSell = hareruyaPrice?.priceYen;
                                        const hareruyaBuy = hareruyaPrice?.buyPriceYen;
                                        const cardrushSell = cardrushPrice?.priceYen;
                                        const cardrushBuy = cardrushPrice?.buyPriceYen;

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
                                                <td className="py-2 px-2 md:px-3 text-gray-400 font-mono font-medium align-middle">{variant.collectorNumber}</td>

                                                {isFirstOfCollectorNumber && (
                                                    <td
                                                        className="py-2 px-2 md:px-3 align-middle border-r border-gray-100 bg-white cursor-pointer"
                                                        rowSpan={rowSpan}
                                                        onClick={() => setOpenModalCardId(card.id)}
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
                                                                No Image
                                                            </div>
                                                        )}
                                                    </td>
                                                )}

                                                <td className="py-2 px-2 md:px-3 align-middle whitespace-nowrap">
                                                    {variant.finish === 'surgefoil' ? (
                                                        <span className="bg-purple-100 text-purple-900 text-[9px] md:text-[11px] px-1.5 md:px-2 py-0.5 rounded-full font-bold border border-purple-200 shadow-sm">Surge</span>
                                                    ) : variant.finish === 'etchedfoil' ? (
                                                        <span className="bg-teal-100 text-teal-900 text-[9px] md:text-[11px] px-1.5 md:px-2 py-0.5 rounded-full font-bold border border-teal-200 shadow-sm">Etched</span>
                                                    ) : variant.finish === 'fracturefoil' ? (
                                                        <span className="bg-rose-100 text-rose-900 text-[9px] md:text-[11px] px-1.5 md:px-2 py-0.5 rounded-full font-bold border border-rose-200 shadow-sm">Fracture</span>
                                                    ) : variant.finish === 'doublerainbowfoil' ? (
                                                        <span className="bg-gradient-to-r from-pink-100 to-purple-100 text-purple-900 text-[9px] md:text-[11px] px-1.5 md:px-2 py-0.5 rounded-full font-bold border border-purple-200 shadow-sm">DblRnbw</span>
                                                    ) : variant.finish === 'foil' ? (
                                                        <span className="bg-amber-100 text-amber-900 text-[9px] md:text-[11px] px-1.5 md:px-2 py-0.5 rounded-full font-bold border border-amber-200 shadow-sm">Foil</span>
                                                    ) : (
                                                        <span className="text-gray-400 text-[9px] md:text-[11px] font-medium border border-gray-100 px-1.5 md:px-2 py-0.5 rounded-full">Norm</span>
                                                    )}
                                                </td>
                                                <td className="py-2 px-2 md:px-3 font-bold text-gray-800 align-middle text-center">{variant.language}</td>

                                                {/* Trend — Buy sparkline */}
                                                <td className="py-2 px-2 md:px-3 border-l-2 border-gray-200 bg-gray-50/50 align-middle text-center">
                                                    <SparklineChart
                                                        variantId={variant.id}
                                                        data={variant.sparklineBuyData || []}
                                                        onClick={() => setOpenModalCardId(card.id)}
                                                    />
                                                </td>
                                                {/* Trend — Sell sparkline */}
                                                <td className="py-2 px-2 md:px-3 bg-gray-50/50 align-middle text-center">
                                                    <SparklineChart
                                                        variantId={variant.id}
                                                        data={variant.sparklineSellData || []}
                                                        onClick={() => setOpenModalCardId(card.id)}
                                                    />
                                                </td>

                                                {/* Hareruya Buy Price (Sell from shop to customer) */}
                                                <td className="py-2 px-2 md:px-3 text-right font-mono border-l-2 border-gray-200 bg-gray-50/50 align-middle">
                                                    {hareruyaPrice ? (
                                                        <a
                                                            href={hareruyaPrice.sourceUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className={`hover:underline font-bold ${hareruyaPrice.stock === 0 ? 'text-red-500' : 'text-blue-600 hover:text-blue-800'}`}
                                                        >
                                                            {formatPrice(hareruyaSell)}
                                                        </a>
                                                    ) : <span className="text-gray-300">-</span>}
                                                </td>

                                                {/* Hareruya Sell Price (Buy from customer, kaitori) */}
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

                                                {/* CardRush Buy Price (Sell from shop to customer) */}
                                                <td className="py-2 px-2 md:px-3 text-right font-mono border-l-2 border-gray-200 bg-blue-50/50 align-middle">
                                                    {cardrushPrice ? (
                                                        <a
                                                            href={cardrushPrice.sourceUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className={`hover:underline font-bold ${
                                                                cardrushPrice.stock === 0
                                                                    ? 'text-red-500'
                                                                    : 'text-blue-600 hover:text-blue-800'
                                                            }`}
                                                        >
                                                            {formatPrice(cardrushSell)}
                                                        </a>
                                                    ) : (
                                                        <span className="text-gray-300">-</span>
                                                    )}
                                                </td>

                                                {/* CardRush Sell Price (Buy from customer, kaitori) */}
                                                <td className="py-2 px-2 md:px-3 text-right font-mono text-gray-600 align-middle">
                                                    {cardrushBuy ? (
                                                        <a
                                                            href={`https://cardrush.media/mtg/buying_prices?${new URLSearchParams([['displayMode','リスト'],['limit','100'],['name',card.name],['rarity',''],['model_number',''],['amount',''],['page','1'],['sort[key]','name'],['sort[order]','desc'],['associations[]','ocha_product'],['to_json_option[methods]','name_with_condition'],['to_json_option[except][]','original_image_source'],['to_json_option[except][]','created_at'],['to_json_option[include][ocha_product][only][]','id'],['to_json_option[include][ocha_product][methods][]','image_source'],['display_category[]','高額系'],['display_category[]','foil系'],['display_category[]','スタンダード'],['display_category[]','スタンダード最新弾'],['display_category[]','パイオニア以下'],['display_category[]','モダン以下最新弾'],['is_hot[]','true'],['is_hot[]','false']]).toString()}`}
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
                    </div>
                ))}

                {filteredCards.length === 0 && (
                    <div className="text-center py-20 bg-white rounded-lg shadow-inner border-2 border-dashed border-gray-200">
                        <div className="text-gray-400 text-lg font-medium">No cards found matching "{search}"</div>
                        <button onClick={() => setSearch('')} className="mt-4 text-blue-500 hover:underline">Clear search</button>
                    </div>
                )}
            </div>

            {openModalCardId && (
                <PriceHistoryModal
                    cardName={filteredCards.find(c => c.id === openModalCardId)?.name || ''}
                    cardId={openModalCardId}
                    variants={filteredCards.find(c => c.id === openModalCardId)?.variants || []}
                    isOpen={true}
                    onClose={() => setOpenModalCardId(null)}
                />
            )}
        </>
    );
}
