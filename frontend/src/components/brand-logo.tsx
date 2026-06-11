import Image from "next/image";

import { cn } from "@/lib/utils";

type BrandLogoProps = {
  mark?: "wordmark" | "icon";
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ mark = "wordmark", className, priority = false }: BrandLogoProps) {
  if (mark === "icon") {
    return (
      <Image
        src="/brand/projectflow-icon-final.svg"
        alt="ProjectFlow"
        width={128}
        height={128}
        priority={priority}
        unoptimized
        className={cn("block h-8 w-8 object-contain", className)}
      />
    );
  }

  return (
    <Image
      src="/brand/projectflow-logo-final.svg"
      alt="ProjectFlow"
      width={360}
      height={160}
      priority={priority}
      unoptimized
      className={cn("block h-10 w-36 object-contain", className)}
    />
  );
}
