// filename: components/ui/textarea.tsx
import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input bg-background placeholder:text-muted-foreground/70 focus-visible:border-primary/70 focus-visible:ring-primary/15 aria-invalid:border-destructive aria-invalid:ring-destructive/15 disabled:bg-muted disabled:text-muted-foreground flex min-h-20 w-full rounded-md border px-3 py-2 text-sm transition-[border-color,box-shadow] outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:ring-2",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
