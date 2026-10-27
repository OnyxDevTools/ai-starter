"use client";
// filename: components/ai-elements/message.tsx
// Adapted from Vercel AI Elements (Apache-2.0); see docs/ai-elements.md.
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { code } from "@streamdown/code";
import type { UIMessage } from "ai";
import type { ComponentProps, HTMLAttributes } from "react";
import { memo, useEffect, useRef } from "react";
import { Streamdown } from "streamdown";
export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage["role"];
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full max-w-[95%] flex-col gap-2",
      from === "user" ? "is-user ml-auto justify-end" : "is-assistant",
      className,
    )}
    {...props}
  />
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({
  children,
  className,
  ...props
}: MessageContentProps) => (
  <div
    className={cn(
      "is-user:dark flex w-fit max-w-full min-w-0 flex-col gap-2 overflow-hidden text-sm",
      "group-[.is-user]:bg-secondary group-[.is-user]:text-foreground group-[.is-user]:ml-auto group-[.is-user]:rounded-lg group-[.is-user]:px-4 group-[.is-user]:py-3",
      "group-[.is-assistant]:text-foreground",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

export type MessageActionsProps = ComponentProps<"div">;

export const MessageActions = ({
  className,
  children,
  ...props
}: MessageActionsProps) => (
  <div className={cn("flex items-center gap-1", className)} {...props}>
    {children}
  </div>
);

export type MessageActionProps = ComponentProps<typeof Button> & {
  tooltip?: string;
  label?: string;
};

export const MessageAction = ({
  tooltip,
  children,
  label,
  variant = "ghost",
  size = "icon",
  ...props
}: MessageActionProps) => {
  const button = (
    <Button size={size} type="button" variant={variant} {...props}>
      {children}
      <span className="sr-only">{label || tooltip}</span>
    </Button>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
};

export const MessageResponse = memo(function MessageResponse({
  className,
  ...props
}: ComponentProps<typeof Streamdown>) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const makeFocusable = () =>
      element
        .querySelectorAll<HTMLElement>('[data-streamdown="code-block-body"]')
        .forEach((node) => {
          node.tabIndex = 0;
          node.setAttribute("role", "region");
          node.setAttribute("aria-label", "Code block");
        });
    makeFocusable();
    const observer = new MutationObserver(makeFocusable);
    observer.observe(element, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={root} className="min-w-0">
      <Streamdown
        {...props}
        className={cn(
          "[&_a]:text-primary min-w-0 space-y-4 [&_a]:underline",
          className,
        )}
        plugins={{ code }}
        skipHtml
        components={{
          a: ({ href, children }) => (
            <a
              href={href && /^https?:\/\//.test(href) ? href : undefined}
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          img: () => <span>[External image omitted]</span>,
        }}
      />
    </div>
  );
});
