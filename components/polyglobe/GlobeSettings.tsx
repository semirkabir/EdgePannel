'use client';

import React, { useState } from 'react';
import { X, RotateCw, Gauge, MousePointer2, Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface GlobeSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  rotationSpeed: number;
  onRotationSpeedChange: (speed: number) => void;
  pauseOnHover: boolean;
  onPauseOnHoverChange: (pause: boolean) => void;
  autoRotate: boolean;
  onAutoRotateChange: (rotate: boolean) => void;
}

export function GlobeSettings({
  isOpen,
  onClose,
  rotationSpeed,
  onRotationSpeedChange,
  pauseOnHover,
  onPauseOnHoverChange,
  autoRotate,
  onAutoRotateChange,
}: GlobeSettingsProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      />
      <div 
        className="relative w-full max-w-md bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800/50">
          <div className="flex items-center gap-2">
            <RotateCw className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-white">Globe Rotation Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Auto Rotate Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                {autoRotate ? (
                  <Play className="w-5 h-5 text-blue-400" />
                ) : (
                  <Pause className="w-5 h-5 text-gray-400" />
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-white">Auto Rotate</label>
                <p className="text-xs text-gray-400">Enable automatic globe rotation</p>
              </div>
            </div>
            <button
              onClick={() => onAutoRotateChange(!autoRotate)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                autoRotate ? "bg-blue-500" : "bg-gray-700"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  autoRotate ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>

          {/* Rotation Speed */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Gauge className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium text-white block mb-1">
                  Rotation Speed
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0.01"
                    max="0.5"
                    step="0.01"
                    value={rotationSpeed}
                    onChange={(e) => onRotationSpeedChange(parseFloat(e.target.value))}
                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    disabled={!autoRotate}
                  />
                  <span className="text-sm text-gray-300 w-12 text-right">
                    {(rotationSpeed * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Slow</span>
                  <span>Fast</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pause on Hover */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <MousePointer2 className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <label className="text-sm font-medium text-white">Pause on Hover</label>
                <p className="text-xs text-gray-400">Pause rotation when hovering over globe</p>
              </div>
            </div>
            <button
              onClick={() => onPauseOnHoverChange(!pauseOnHover)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                pauseOnHover ? "bg-blue-500" : "bg-gray-700"
              )}
              disabled={!autoRotate}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  pauseOnHover ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>

          {/* Info */}
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-xs text-blue-300">
              <strong>Tip:</strong> Rotation automatically pauses when you drag or interact with the globe, and resumes after 2 seconds of inactivity.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
