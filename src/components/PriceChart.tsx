
'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface PricePoint {
    timestamp: string | Date;
    priceYen: number;
    shopName: string;
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

    // Group by rough timestamp (e.g. hour)
    const grouped = new Map<string, any>();

    data.forEach(d => {
        const timeKey = format(new Date(d.timestamp), 'yyyy-MM-dd HH:mm');
        if (!grouped.has(timeKey)) {
            grouped.set(timeKey, { time: timeKey, timestamp: new Date(d.timestamp).getTime() });
        }
        const entry = grouped.get(timeKey);
        entry[d.shopName] = d.priceYen;
    });

    const chartData = Array.from(grouped.values()).sort((a, b) => a.timestamp - b.timestamp);

    const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300'];

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
                    <Tooltip />
                    <Legend />
                    {shops.map((shop, index) => (
                        <Line
                            key={shop}
                            type="monotone"
                            dataKey={shop}
                            stroke={colors[index % colors.length]}
                            strokeWidth={2}
                            connectNulls
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
