'use client';

import React, { useEffect, useRef } from 'react';

interface StarfieldProps {
  starCount?: number;
}

export function Starfield({ starCount = 200 }: StarfieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Create stationary stars
    const stars: Array<{
      x: number;
      y: number;
      size: number;
      brightness: number;
    }> = [];

    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 1.5 + 0.5,
        brightness: Math.random() * 100 + 150, // Vary brightness for depth
      });
    }

    // Draw stars once (stationary)
    const drawStars = () => {
      ctx.fillStyle = 'rgb(3, 7, 18)'; // Match bg-gray-950
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      stars.forEach((star) => {
        ctx.fillStyle = `rgba(${star.brightness}, ${star.brightness}, ${star.brightness}, 1)`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    drawStars();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [starCount]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
}




