import { cn } from "@/lib/cn";
import { forwardRef } from "react";
import { INPUT_CLASSES } from "./Input";

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(INPUT_CLASSES, className)} {...props} />
);
Textarea.displayName = "Textarea";
