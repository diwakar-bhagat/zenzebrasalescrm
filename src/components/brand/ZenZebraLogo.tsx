"use client";

import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/utils";

interface ZenZebraLogoProps {
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
  variant?: "dark" | "light";
}

const sizes = {
  sm: { logo: 24, wordmark: "text-lg", tagline: "text-[9px]" },
  md: { logo: 32, wordmark: "text-xl", tagline: "text-[10px]" },
  lg: { logo: 48, wordmark: "text-3xl", tagline: "text-xs" },
};

export function ZenZebraLogo({ size = "md", showTagline = false, variant = "dark" }: ZenZebraLogoProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const currentSize = sizes[size];
  const textColor = variant === "light" ? "text-white" : "text-foreground";
  const taglineColor = variant === "light" ? "text-white/50" : "text-muted-foreground";

  return (
    <div className="flex items-center gap-2.5">
      {imageFailed ? (
        <div
          className="flex shrink-0 items-center justify-center rounded-md bg-primary font-semibold text-primary-foreground"
          style={{ width: currentSize.logo, height: currentSize.logo }}
          aria-hidden="true"
        >
          Z
        </div>
      ) : (
        <Image
          src="/logo.png"
          alt="ZenZebra"
          width={currentSize.logo}
          height={currentSize.logo}
          className="shrink-0 object-contain"
          priority
          onError={() => setImageFailed(true)}
        />
      )}
      <div className="flex flex-col leading-none">
        <span className={cn(currentSize.wordmark, textColor)}>
          <span className="font-normal">Zen</span>
          <span className="font-bold">Zebra</span>
        </span>
        {showTagline && (
          <span className={cn("mt-0.5 uppercase tracking-[0.15em]", currentSize.tagline, taglineColor)}>
            Your curiosity meets here
          </span>
        )}
      </div>
    </div>
  );
}
