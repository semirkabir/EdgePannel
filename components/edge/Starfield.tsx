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

interface Satellite {
  x: number;
  y: number;
  speedX: number;
  speedY: number;
  blinkPhase: number;
  blinkSpeed: number;
  brightness: number;
}

interface Pulsar {
  x: number;
  y: number;
  maxSize: number;
  life: number;
  maxLife: number;
  color: string;
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
    let satellites: Satellite[] = [];
    let pulsars: Pulsar[] = [];
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

      // Initialize satellites (4-6 satellites)
      satellites = [];
      const satelliteCount = Math.floor(Math.random() * 3) + 4;
      for (let i = 0; i < satelliteCount; i++) {
        satellites.push({
          x: Math.random() * width,
          y: Math.random() * height,
          speedX: (Math.random() - 0.5) * 0.5,
          speedY: (Math.random() - 0.5) * 0.5,
          blinkPhase: Math.random() * Math.PI * 2,
          blinkSpeed: Math.random() * 0.05 + 0.02,
          brightness: Math.random() * 0.5 + 0.5,
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

    const createPulsar = () => {
      // Very occasional bright pulses
      if (Math.random() < 0.998) return;
      if (pulsars.length > 2) return;

      const pulsarColors = [
        'rgba(255, 255, 255, 1)',
        'rgba(100, 200, 255, 1)',
        'rgba(255, 200, 100, 1)',
      ];

      pulsars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        maxSize: Math.random() * 40 + 20,
        life: 0,
        maxLife: Math.random() * 60 + 40,
        color: pulsarColors[Math.floor(Math.random() * pulsarColors.length)],
      });
    };

    const draw = () => {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);

      // Radial gradient removed to prevent "circle" effect around globe


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

      // Draw and Update Satellites
      satellites.forEach(satellite => {
        satellite.x += satellite.speedX;
        satellite.y += satellite.speedY;
        satellite.blinkPhase += satellite.blinkSpeed;

        // Wrap around screen
        if (satellite.x < 0) satellite.x = width;
        if (satellite.x > width) satellite.x = 0;
        if (satellite.y < 0) satellite.y = height;
        if (satellite.y > height) satellite.y = 0;

        // Blinking effect
        const blinkOpacity = Math.abs(Math.sin(satellite.blinkPhase)) * satellite.brightness;

        if (blinkOpacity > 0.3) {
          ctx.fillStyle = `rgba(255, 100, 100, ${blinkOpacity})`;
          ctx.beginPath();
          ctx.arc(satellite.x, satellite.y, 2, 0, Math.PI * 2);
          ctx.fill();

          // Add glow when bright
          if (blinkOpacity > 0.7) {
            ctx.shadowBlur = 6;
            ctx.shadowColor = 'rgba(255, 100, 100, 0.8)';
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }
      });

      // Draw and Update Pulsars
      createPulsar();
      for (let i = pulsars.length - 1; i >= 0; i--) {
        const pulsar = pulsars[i];
        pulsar.life++;

        if (pulsar.life >= pulsar.maxLife) {
          pulsars.splice(i, 1);
          continue;
        }

        // Fade in fast, fade out slow
        let opacity = 1;
        const halfLife = pulsar.maxLife * 0.2;
        if (pulsar.life < halfLife) {
          opacity = pulsar.life / halfLife;
        } else {
          opacity = 1 - ((pulsar.life - halfLife) / (pulsar.maxLife - halfLife));
        }

        const currentSize = (pulsar.life / pulsar.maxLife) * pulsar.maxSize;

        // Draw expanding ring
        const pulsarGradient = ctx.createRadialGradient(
          pulsar.x, pulsar.y, 0,
          pulsar.x, pulsar.y, currentSize
        );
        pulsarGradient.addColorStop(0, pulsar.color.replace('1)', `${opacity})`));
        pulsarGradient.addColorStop(0.6, pulsar.color.replace('1)', `${opacity * 0.5})`));
        pulsarGradient.addColorStop(1, pulsar.color.replace('1)', '0)'));

        ctx.fillStyle = pulsarGradient;
        ctx.beginPath();
        ctx.arc(pulsar.x, pulsar.y, currentSize, 0, Math.PI * 2);
        ctx.fill();
      }

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
