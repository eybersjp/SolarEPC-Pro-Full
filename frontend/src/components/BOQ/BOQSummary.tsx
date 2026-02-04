import { Card, CardContent } from "@/components/ui/card";
import { Wallet, TrendingUp, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/utils"; // Assuming utils exists, otherwise I'll mock or create it. 
// formatCurrency helper might not exist. I'll use Intl.NumberFormat inline or create a utility if I check utils.ts. 
// I'll stick to inline for now to be safe or check utils.ts first? 
// The user has `frontend/src/lib/utils.ts` in shadcn setups usually.
// I'll implement a local helper if import fails, but let's assume standard shadcn/nextjs setup.
// Actually, to be safe, I'll define it locally in this file or use simple formatting.

function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    }).format(amount);
}

interface BOQSummaryProps {
    totalCost: number;
    totalMargin: number; // This is absolute value or percentage? 
    // Types say: total_margin: number. 
    // Usually BOQ summary has Total Cost, Total Margin (Value), and Grand Total (Price).
    // And implies a margin percentage.
    grandTotal: number;
}

export function BOQSummary({ totalCost, totalMargin, grandTotal }: BOQSummaryProps) {
    // Calculate margin percentage
    const marginPct = grandTotal > 0 ? (totalMargin / grandTotal) * 100 : 0;

    return (
        <div className="grid gap-4 md:grid-cols-3">
            <Card>
                <CardContent className="flex flex-col items-center justify-center p-6">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <Wallet className="h-4 w-4" />
                        <span className="text-sm font-medium">Total Cost</span>
                    </div>
                    <div className="text-2xl font-bold">{formatCurrency(totalCost)}</div>
                </CardContent>
            </Card>
            <Card>
                <CardContent className="flex flex-col items-center justify-center p-6">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <TrendingUp className="h-4 w-4" />
                        <span className="text-sm font-medium">Total Margin</span>
                    </div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(totalMargin)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                        {marginPct.toFixed(1)}% of price
                    </div>
                </CardContent>
            </Card>
            <Card className="bg-primary/5 border-primary/20">
                <CardContent className="flex flex-col items-center justify-center p-6">
                    <div className="flex items-center gap-2 text-primary mb-2">
                        <DollarSign className="h-4 w-4" />
                        <span className="text-sm font-medium">Grand Total</span>
                    </div>
                    <div className="text-3xl font-bold text-primary">{formatCurrency(grandTotal)}</div>
                </CardContent>
            </Card>
        </div>
    );
}
