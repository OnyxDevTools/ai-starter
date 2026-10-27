// filename: components/ui/input.tsx
import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-input bg-background placeholder:text-muted-foreground/70 focus-visible:border-primary/70 focus-visible:ring-primary/15 aria-invalid:border-destructive aria-invalid:ring-destructive/15 disabled:bg-muted disabled:text-muted-foreground flex h-9 w-full min-w-0 rounded-md border px-3 py-2 text-sm transition-[border-color,box-shadow] outline-none file:mr-3 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:ring-2",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
