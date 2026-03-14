'use client';

import { useState, useEffect } from 'react';
import { PriceChart } from './PriceChart';

interface Variant {
    id: string;
    collectorNumber: string;
    language: string;
    isFoil: boolean;
    finish: string;
    image?: string | null;
}

interface PriceHistoryModalProps {
    cardName: string;
    cardId: string;
    variants: Variant[];
    isOpen: boolean;
    onClose: () => void;
}

export function PriceHistoryModal({ cardName, cardId, variants, isOpen, onClose }: PriceHistoryModalProps) {
    const [priceHistories, setPriceHistories] = useState<Record<string, any[]>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen || !cardId) return;

        const fetchPriceHistories = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`/api/cards/${cardId}/price-history`);
                if (!response.ok) {
                    throw new Error('Failed to fetch price history');
                }
                const data = await response.json();
                setPriceHistories(data);
            } catch (err) {
                console.error('Error fetching price histories:', err);
                setError('Failed to load price history. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchPriceHistories();
    }, [isOpen, cardId]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900">{cardName} - Price History</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 text-2xl"
                    >
                        ×
                    </button>
                </div>
                <div className="p-4 space-y-8">
                    {loading ? (
                        <div className="h-[300px] flex items-center justify-center text-gray-900">
                            Loading price history...
                        </div>
                    ) : error ? (
                        <div className="h-[300px] flex flex-col items-center justify-center">
                            <p className="text-red-500 mb-4">{error}</p>
                            <button
                                onClick={() => {
                                    setError(null);
                                    setPriceHistories({});
                                    // Trigger a refetch by toggling a dependency
                                    const fetchPriceHistories = async () => {
                                        setLoading(true);
                                        setError(null);
                                        try {
                                            const response = await fetch(`/api/cards/${cardId}/price-history`);
                                            if (!response.ok) {
                                                throw new Error('Failed to fetch price history');
                                            }
                                            const data = await response.json();
                                            setPriceHistories(data);
                                        } catch (err) {
                                            console.error('Error fetching price histories:', err);
                                            setError('Failed to load price history. Please try again.');
                                        } finally {
                                            setLoading(false);
                                        }
                                    };
                                    fetchPriceHistories();
                                }}
                                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                            >
                                Retry
                            </button>
                        </div>
                    ) : (
                        variants.map(variant => {
                            const history = priceHistories[variant.id] || [];

                            return (
                                <div key={variant.id} className="border-b pb-6 last:border-b-0">
                                    <h3 className="text-lg font-semibold mb-4 text-gray-900">
                                        #{variant.collectorNumber} - {variant.language} {variant.finish === 'nonfoil' ? 'Normal' : variant.finish === 'foil' ? 'Foil' : variant.finish === 'surgefoil' ? 'Surge Foil' : variant.finish === 'etchedfoil' ? 'Etched Foil' : variant.finish === 'fracturefoil' ? 'Fracture Foil' : variant.finish === 'doublerainbowfoil' ? 'Double Rainbow Foil' : variant.finish}
                                    </h3>
                                    {history.length === 0 ? (
                                        <div className="h-[300px] flex items-center justify-center text-gray-600">
                                            No price history available
                                        </div>
                                    ) : (
                                        <div className="flex gap-4 items-start">
                                            {variant.image && (
                                                <div className="flex-shrink-0">
                                                    <img
                                                        src={variant.image}
                                                        alt={`${variant.collectorNumber} - ${variant.language}`}
                                                        className="w-48 rounded-lg shadow-md"
                                                    />
                                                </div>
                                            )}
                                            <div className="flex-1">
                                                <PriceChart
                                                    data={history.map(p => ({
                                                        timestamp: p.timestamp,
                                                        priceYen: p.priceYen,
                                                        buyPriceYen: p.buyPriceYen,
                                                        shopName: p.shopName
                                                    }))}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
