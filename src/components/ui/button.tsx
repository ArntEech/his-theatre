import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-base font-semibold cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-gold/90 active:bg-gold-deep",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border-2 border-gold-deep bg-transparent text-foreground hover:bg-accent active:bg-gold-deep/20",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent active:bg-gold-deep/20",
        ghost: "hover:bg-accent hover:text-accent-foreground active:bg-gold-deep/20",
        link: "text-gold-text underline underline-offset-4 decoration-gold-deep hover:decoration-2",
        stage: "bg-stage text-stage-foreground hover:bg-stage/90 active:bg-stage/80",
      },
      size: {
        default: "min-h-12 px-5 py-2",
        sm: "min-h-11 px-4 text-sm",
        lg: "min-h-14 px-6 text-lg",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
