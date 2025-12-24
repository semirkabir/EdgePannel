import React from 'react';
import { TrendingUp, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { MarketType } from '@/types/exchange';

interface MarketTypeToggleProps {
  value: MarketType;
  onChange: (value: MarketType) => void;
}

export function MarketTypeToggle({ value, onChange }: MarketTypeToggleProps) {
  return (
    <div className="flex items-center gap-1">
      {/* Prediction Markets */}
      <button
        onClick={() => onChange('prediction')}
        className={cn(
          "h-7 px-2 flex items-center gap-1 rounded-xl text-[10px] font-bold transition-all border",
          value === 'prediction'
            ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
            : "bg-white/5 border-white/10 text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20"
        )}
      >
        <TrendingUp className="w-3.5 h-3.5" />
        <span>Predictions</span>
      </button>

      {/* Financial Markets */}
      <button
        onClick={() => onChange('financial')}
        className={cn(
          "h-7 px-2 flex items-center gap-1 rounded-xl text-[10px] font-bold transition-all border",
          value === 'financial'
            ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
            : "bg-white/5 border-white/10 text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20"
        )}
      >
        <Building2 className="w-3.5 h-3.5" />
        <span>Financials</span>
      </button>
    </div>
  );
}
