"use client";

import React from "react";

interface DataAgentLogoProps {
  size?: number;
}

export default function DataAgentLogo({ size = 30 }: DataAgentLogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <linearGradient id="spark-grad" x1="20" y1="4" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      {/* Rounded square background */}
      <rect width="40" height="40" rx="10" fill="url(#logo-grad)" />
      {/* Database cylinder — three ellipses + body */}
      <ellipse cx="20" cy="26" rx="10" ry="3.5" fill="rgba(255,255,255,0.25)" />
      <rect x="10" y="22" width="20" height="8" fill="rgba(255,255,255,0.2)" />
      <ellipse cx="20" cy="22" rx="10" ry="3.5" fill="rgba(255,255,255,0.35)" />
      <rect x="10" y="18" width="20" height="8" fill="rgba(255,255,255,0.15)" />
      <ellipse cx="20" cy="18" rx="10" ry="3.5" fill="rgba(255,255,255,0.3)" />
      {/* AI spark bolt */}
      <path d="M22 6 L18 15 L22 14 L18 22" stroke="url(#spark-grad)" strokeWidth="2.2"
        strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Small sparkle dots */}
      <circle cx="26" cy="9" r="1" fill="#fbbf24" opacity="0.8" />
      <circle cx="14" cy="12" r="0.8" fill="#fbbf24" opacity="0.6" />
    </svg>
  );
}
