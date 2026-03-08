
'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface PricePoint {
    timestamp: string | Date;
    priceYen: number;
    shopName: string;
    buyPriceYen?: number | null;
}

interface PriceChartProps {
    data: PricePoint[];
}

export function PriceChart({ data }: PriceChartProps) {
    // Tranform data for Recharts: group by timestamp (approx) or just plot separate lines?
    // Easier to plot separate lines if we format the data: 
    // [{ time: '...', Hareruya: 12000, CardRush: 11000 }, ...]

    // Normalize timestamps to day/hour?
    // For simplicity, let's just let Recharts handle category axis if points align, or use 'number' scale for time.
    // We'll process data into a format suitable for multiline.

    const processedData: any[] = [];
    const shops = Array.from(new Set(data.map(d => d.shopName)));
    const hasBuyPrices = data.some(d => d.buyPriceYen != null);

    // Group by day (since we're already aggregating by day in the API)
    const grouped = new Map<string, any>();

    data.forEach(d => {
        const timeKey = format(new Date(d.timestamp), 'yyyy-MM-dd');
        if (!grouped.has(timeKey)) {
            grouped.set(timeKey, { time: timeKey, timestamp: new Date(d.timestamp).getTime() });
        }
        const entry = grouped.get(timeKey);
        // For buy price (customer buys from shop), use priceYen
        entry[`${d.shopName} (Buy)`] = d.priceYen;
        // For sell price (customer sells to shop), add if available
        if (d.buyPriceYen != null) {
            entry[`${d.shopName} (Sell)`] = d.buyPriceYen;
        }
    });

    const chartData = Array.from(grouped.values()).sort((a, b) => a.timestamp - b.timestamp);

    // Determine which lines to show
    const linesToShow: string[] = [];
    shops.forEach(shop => {
        linesToShow.push(`${shop} (Buy)`);
        if (hasBuyPrices) {
            linesToShow.push(`${shop} (Sell)`);
        }
    });

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

    return (
        <div className="w-full h-[300px] md:h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                        dataKey="time"
                        angle={-45}
                        textAnchor="end"
                        height={70}
                        fontSize={12}
                    />
                    <YAxis domain={['auto', 'auto']} />
                    <Tooltip 
                        formatter={(value: number | undefined) => value != null ? `¥${value.toLocaleString()}` : ''}
                    />
                    <Legend />
                    {linesToShow.map((lineKey, index) => (
                        <Line
                            key={lineKey}
                            type="monotone"
                            dataKey={lineKey}
                            stroke={colors[index % colors.length]}
                            strokeWidth={2}
                            connectNulls
                            dot={false}
                            activeDot={false}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
