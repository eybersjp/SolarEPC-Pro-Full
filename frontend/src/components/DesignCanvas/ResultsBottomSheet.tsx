import { useState, useEffect } from "react";
import { useEnergyEstimateQuery, useFinancialAnalysisQuery, useSiteDesignQuery } from "@/hooks/useSiteDesigns";
import { useDesignCanvasStore } from "@/stores/useDesignCanvasStore";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import {
    LayoutGrid,
    Zap,
    Sun,
    TrendingUp,
    ChevronUp,
    Loader2,
    AlertCircle,
    ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "@/components/ui/tooltip";

interface ResultsBottomSheetProps {
    designId: string;
}

export function ResultsBottomSheet({ designId }: ResultsBottomSheetProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const rightPanelOpen = useDesignCanvasStore((state) => state.rightPanelOpen);
    const [isSmallScreen, setIsSmallScreen] = useState(false);

    // Fetch Data
    const { data: design, isLoading: isDesignLoading } = useSiteDesignQuery(designId);
    const { data: energyData, isLoading: isEnergyLoading } = useEnergyEstimateQuery(designId);
    const { data: financialData, isLoading: isFinancialLoading } = useFinancialAnalysisQuery(designId);

    // Responsive Resize Handler
    useEffect(() => {
        const checkScreenSize = () => {
            setIsSmallScreen(window.innerWidth < 768);
        };

        // Initial check
        checkScreenSize();

        window.addEventListener('resize', checkScreenSize);
        return () => window.removeEventListener('resize', checkScreenSize);
    }, []);

    // Conditional Rendering
    if (!designId) return null;
    if (design && design.total_modules === 0) return null;

    // Derived Formats
    const formattedSystemSize = design ? `${design.system_size_kwp.toFixed(2)} kWp` : "0.00 kWp";
    const formattedEnergy = energyData ? `${(energyData.annual_energy_kwh / 1000).toFixed(2)} MWh` : "—";
    const formattedPayback = financialData ? `${financialData.simple_payback_years.toFixed(1)} years` : "—";

    const isEnergyCalculating = energyData?.status === 'calculating';
    const isEnergyFailed = energyData?.status === 'failed';

    const rightPanelOffset = rightPanelOpen ? "mr-[320px]" : "mr-0";

    // Reusable Metric Component
    const MetricItem = ({
        icon: Icon,
        colorClass,
        bgClass,
        label,
        value,
        isLoading,
        specialState
    }: any) => (
        <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-full", bgClass, colorClass)}>
                <Icon className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</span>
                {isLoading ? (
                    <Skeleton className="h-6 w-16" />
                ) : specialState ? (
                    specialState
                ) : (
                    <span className="text-lg font-bold text-slate-900">{value}</span>
                )}
            </div>
        </div>
    );

    const EnergySpecialState = isEnergyCalculating ? (
        <div className="flex items-center gap-2 text-amber-600 font-semibold">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Calculating...</span>
        </div>
    ) : isEnergyFailed ? (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 text-red-500 font-semibold cursor-help">
                        <AlertCircle className="h-4 w-4" />
                        <span>Failed</span>
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{energyData?.error_message || "Estimation failed"}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    ) : null;

    // Summary Bar Content
    const summaryContent = (
        <div className={cn(
            "grid gap-4 items-center",
            isSmallScreen ? "grid-cols-2" : "grid-cols-4"
        )}>
            <MetricItem
                icon={LayoutGrid}
                bgClass="bg-blue-100"
                colorClass="text-blue-600"
                label="Total Modules"
                value={design?.total_modules?.toLocaleString() ?? 0}
                isLoading={isDesignLoading}
            />
            <MetricItem
                icon={Zap}
                bgClass="bg-indigo-100"
                colorClass="text-indigo-600"
                label="System Size"
                value={formattedSystemSize}
                isLoading={isDesignLoading}
            />
            <MetricItem
                icon={Sun}
                bgClass="bg-amber-100"
                colorClass="text-amber-600"
                label="Annual Energy"
                value={formattedEnergy}
                isLoading={isEnergyLoading}
                specialState={EnergySpecialState}
            />
            <MetricItem
                icon={TrendingUp}
                bgClass="bg-emerald-100"
                colorClass="text-emerald-600"
                label="Payback Period"
                value={formattedPayback}
                isLoading={isFinancialLoading}
            />
        </div>
    );

    return (
        <>
            {/* Expanded Sheet */}
            <Sheet open={isExpanded} onOpenChange={setIsExpanded} modal={false}>
                <SheetContent
                    side="bottom"
                    className={cn(
                        "p-0 transition-all duration-300 ease-in-out h-[60vh] max-h-[60vh] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]",
                        rightPanelOpen ? "mr-[0px] md:mr-[320px]" : "mr-0", // Responsive margin
                        "pointer-events-auto" // Ensure interaction
                    )}
                    onOpenAutoFocus={(e) => e.preventDefault()} // Prevent focus stealing
                >
                    <div className="flex flex-col h-full bg-white/95 backdrop-blur-md">
                        {/* Header / Summary Section in Expanded View */}
                        <div className="px-6 py-4 border-b bg-white/50 space-y-4">
                            <div className="flex items-center justify-between">
                                <SheetTitle>Design Results</SheetTitle>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsExpanded(false)}
                                    className="text-slate-500 hover:text-slate-900"
                                >
                                    Minimize
                                    <ChevronDown className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                            <div className="pb-2">
                                {summaryContent}
                            </div>
                        </div>

                        {/* Scrollable Details */}
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                            <SheetDescription className="text-center py-10">
                                Detailed charts and financial breakdown will appear here.
                            </SheetDescription>

                            <div className="flex flex-col items-center justify-center text-slate-400 min-h-[200px] border-2 border-dashed border-slate-200 rounded-lg">
                                <p>Detailed results visualization coming soon...</p>
                            </div>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            {/* Collapsed Summary Bar (Always Visible) */}
            {!isExpanded && (
                <div
                    className={cn(
                        "fixed bottom-0 left-0 right-0 z-30 transition-all duration-300 ease-in-out",
                        rightPanelOpen ? "mr-[0px] md:mr-[320px]" : "mr-0"
                    )}
                >
                    <div className="bg-white/95 backdrop-blur-md border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] px-6 py-4">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex-1 w-full">
                                {summaryContent}
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsExpanded(true)}
                                className="whitespace-nowrap w-full md:w-auto mt-4 md:mt-0 font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                            >
                                View Details
                                <ChevronUp className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
