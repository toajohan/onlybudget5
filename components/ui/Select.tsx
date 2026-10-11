import { cn } from "@/lib/cn";
import { forwardRef } from "react";
import { INPUT_CLASSES } from "./Input";

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(INPUT_CLASSES, className)} {...props}>
      {children}
    </select>
  )
);
Select.displayName = "Select";
