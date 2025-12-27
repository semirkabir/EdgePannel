import React from 'react';
import { TrendingUp, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { MarketType } from '@/types/exchange';

interface MarketTypeToggleProps {
  value: MarketType;
  onChange: (value: MarketType) => void;
}

export function MarketTypeToggle({ value, onChange }: MarketTypeToggleProps) {
  const isFinancial = value === 'financial';

  return (
    <div className="flex items-center p-0.5 bg-black/40 border border-white/10 rounded-xl relative overflow-hidden h-8">
      {/* Sliding Background */}
      <div
        className={cn(
          "absolute inset-y-0.5 transition-all duration-300 ease-out rounded-lg shadow-lg border",
          isFinancial
            ? "left-[50%] right-0.5 bg-emerald-600 border-emerald-400/50"
            : "left-0.5 right-[50%] bg-blue-600 border-blue-400/50"
        )}
      />

      {/* Prediction Side */}
      <button
        onClick={() => onChange('prediction')}
        className={cn(
          "relative z-10 flex-1 h-full px-3 flex items-center justify-center gap-1.5 text-[10px] font-bold transition-colors duration-200",
          !isFinancial ? "text-white" : "text-gray-400 hover:text-white"
        )}
      >
        <TrendingUp className={cn("w-3.5 h-3.5", !isFinancial ? "text-white" : "text-gray-500")} />
        <span>PREDICTIONS</span>
      </button>

      {/* Financial Side */}
      <button
        onClick={() => onChange('financial')}
        className={cn(
          "relative z-10 flex-1 h-full px-3 flex items-center justify-center gap-1.5 text-[10px] font-bold transition-colors duration-200",
          isFinancial ? "text-white" : "text-gray-400 hover:text-white"
        )}
      >
        <Building2 className={cn("w-3.5 h-3.5", isFinancial ? "text-white" : "text-gray-500")} />
        <span>FINANCIALS</span>
      </button>
    </div>
  );
}
