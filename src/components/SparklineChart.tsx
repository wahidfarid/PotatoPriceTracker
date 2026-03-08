'use client';

interface SparklineDataPoint {
    price: number;
    timestamp?: string;
}

interface SparklineChartProps {
    variantId: string;
    data?: SparklineDataPoint[];
    onClick: () => void;
    height?: number;
    width?: number;
}

export function SparklineChart({ variantId, data = [], onClick, height = 30, width = 80 }: SparklineChartProps) {
    // Filter out zero/invalid prices defensively
    const validData = data.filter(d => d.price > 0);

    if (validData.length === 0) {
        return (
            <div
                className="inline-block cursor-pointer hover:opacity-70 transition-opacity border border-gray-200 rounded"
                onClick={onClick}
                style={{ width: `${width}px`, height: `${height}px`, minWidth: `${width}px`, minHeight: `${height}px` }}
                title="No price history - click to view"
            >
                <div className="w-full h-full bg-gray-50 flex items-center justify-center text-gray-300 text-xs">
                    -
                </div>
            </div>
        );
    }

    // Calculate min/max for Y-axis scaling
    const prices = validData.map(d => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1; // Avoid division by zero

    // Generate SVG polyline points with 2px padding
    const padding = 2;
    const chartWidth = width - (padding * 2);
    const chartHeight = height - (padding * 2);

    const points = validData
        .map((point, index) => {
            const x = validData.length === 1 ? padding + chartWidth / 2 : padding + (index / (validData.length - 1)) * chartWidth;
            const y = padding + (1 - (point.price - minPrice) / priceRange) * chartHeight;
            return `${x},${y}`;
        })
        .join(' ');

    // Determine color based on trend (green for uptrend, red for downtrend)
    const strokeColor = validData[validData.length - 1].price >= validData[0].price ? "#10b981" : "#ef4444";

    return (
        <div
            className="inline-block cursor-pointer hover:opacity-70 transition-opacity border border-gray-200 rounded bg-white"
            onClick={onClick}
            style={{ width: `${width}px`, height: `${height}px`, minWidth: `${width}px`, minHeight: `${height}px`, flexShrink: 0 }}
            title="Click to view full price history"
        >
            <svg width={width} height={height}>
                <polyline
                    points={points}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="1.5"
                />
            </svg>
        </div>
    );
}
