'use client';

import React, { useEffect, useRef } from 'react';

interface StarfieldProps {
  starCount?: number;
  speedFactor?: number; // Controls animation speed
  backgroundColor?: string;
}

interface Star {
  x: number;
  y: number;
  size: number;
  color: string;
  brightness: number;
  twinkleSpeed: number;
  twinklePhase: number;
}

interface ShootingStar {
  x: number;
  y: number;
  length: number;
  speed: number;
  angle: number;
  life: number;
  maxLife: number;
}

export function Starfield({ 
  starCount = 400, 
  speedFactor = 0.05,
  backgroundColor = 'rgb(3, 7, 18)' 
}: StarfieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let stars: Star[] = [];
    let shootingStars: ShootingStar[] = [];
    let width = 0;
    let height = 0;

    // Star colors (white, blue-ish, yellow-ish, red-ish)
    const starColors = [
      '255, 255, 255', // White
      '200, 220, 255', // Blue-white
      '255, 240, 200', // Yellow-white
    ];

    const initStars = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;

      stars = [];
      for (let i = 0; i < starCount; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const size = Math.random() * 1.5 + 0.1;
        const color = starColors[Math.floor(Math.random() * starColors.length)];
        // Higher base brightness for visibility
        const brightness = Math.random(); 
        const twinkleSpeed = Math.random() * 0.02 + 0.005;
        const twinklePhase = Math.random() * Math.PI * 2;

        stars.push({
          x,
          y,
          size,
          color,
          brightness,
          twinkleSpeed,
          twinklePhase
        });
      }
    };

    const createShootingStar = () => {
      // Only create shooting star occasionally
      if (Math.random() < 0.995) return;
      if (shootingStars.length > 1) return; // Limit concurrent shooting stars

      const startX = Math.random() * width;
      const startY = Math.random() * height * 0.5; // Start in top half
      
      shootingStars.push({
        x: startX,
        y: startY,
        length: Math.random() * 80 + 10,
        speed: Math.random() * 10 + 5,
        angle: Math.PI / 4 + (Math.random() * 0.2 - 0.1), // Mostly diagonal down-right
        life: 0,
        maxLife: Math.random() * 50 + 50
      });
    };

    const draw = () => {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);
      
      // Optional: Add a subtle radial gradient for "deep space" feel
      // Center of the screen can be slightly lighter/bluer
      const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width);
      gradient.addColorStop(0, 'rgba(10, 20, 40, 0.3)'); // Very subtle blue tint in center
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Draw Stars
      stars.forEach(star => {
        // Update twinkle
        star.twinklePhase += star.twinkleSpeed * speedFactor * 20;
        const twinkleVal = Math.sin(star.twinklePhase);
        // Map sine wave (-1 to 1) to opacity range (e.g., 0.3 to 1.0)
        const opacity = 0.5 + (twinkleVal + 1) * 0.25; 

        ctx.fillStyle = `rgba(${star.color}, ${opacity})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();

        // Optional: Add glow to larger stars
        if (star.size > 1.2 && opacity > 0.8) {
           ctx.shadowBlur = 4;
           ctx.shadowColor = `rgba(${star.color}, 0.5)`;
           ctx.fill();
           ctx.shadowBlur = 0;
        }
      });

      // Update and Draw Shooting Stars
      createShootingStar();
      
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i];
        
        s.x += Math.cos(s.angle) * s.speed;
        s.y += Math.sin(s.angle) * s.speed;
        s.life++;

        // Fade in and out
        let opacity = 1;
        if (s.life < 10) opacity = s.life / 10;
        else if (s.life > s.maxLife - 10) opacity = (s.maxLife - s.life) / 10;

        if (s.life >= s.maxLife || s.x > width || s.y > height) {
          shootingStars.splice(i, 1);
          continue;
        }

        const tailX = s.x - Math.cos(s.angle) * s.length;
        const tailY = s.y - Math.sin(s.angle) * s.length;

        const grad = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
        grad.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
        grad.addColorStop(1, `rgba(255, 255, 255, 0)`);

        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    const handleResize = () => {
      initStars();
    };

    window.addEventListener('resize', handleResize);
    initStars();
    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [starCount, speedFactor, backgroundColor]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
}
