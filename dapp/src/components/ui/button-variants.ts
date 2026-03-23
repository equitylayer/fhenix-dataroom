import { cva, type VariantProps } from "class-variance-authority";

export const buttonVariants = cva(
	"orbitron inline-flex items-center justify-center gap-2 whitespace-nowrap !text-xs uppercase tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60 cursor-pointer",
	{
		variants: {
			variant: {
				default:
					"!rounded-md border !border-[#5c6380] !bg-[#1a1f2e] !text-white !shadow-none hover:!bg-[#232938] hover:!border-[#7a82a0] hover:-translate-y-px active:translate-y-0",
				secondary:
					"!rounded-md border border-transparent bg-secondary text-secondary-foreground !shadow-none hover:-translate-y-px hover:bg-secondary/90",
				destructive:
					"!rounded-md border border-destructive bg-destructive text-destructive-foreground !shadow-none hover:-translate-y-px hover:brightness-90",
				outline:
					"!rounded-md border border-border bg-background text-foreground !shadow-none hover:bg-accent hover:text-accent-foreground",
				ghost: "!rounded-md border border-transparent text-foreground !shadow-none hover:bg-accent/60 hover:text-accent-foreground",
				dangerGhost:
					"!rounded-md border !border-destructive !bg-transparent !text-destructive !shadow-none hover:bg-destructive/10",
				dangerOutline:
					"!rounded-md border border-destructive bg-transparent text-destructive !shadow-none hover:bg-destructive/10",
				link: "border-none text-primary underline-offset-4 hover:underline",
				textLink:
					"!border-none !bg-transparent !text-foreground !shadow-none !normal-case hover:!underline hover:!underline-offset-2 hover:!transform-none hover:!bg-transparent",
				dangerLink:
					"!border-none !bg-transparent !text-destructive !normal-case hover:!underline hover:!bg-transparent",
				destructiveLink:
					"!border-none !bg-transparent !p-0 !text-destructive !text-xs !font-normal !tracking-normal !underline !normal-case !shadow-none hover:!opacity-70",
			},
			size: {
				default: "h-auto !py-[8px] !px-[16px]",
				sm: "h-auto !py-[6px] !px-[12px]",
				xs: "h-auto !p-0",
				lg: "h-auto !py-[10px] !px-[20px]",
				icon: "h-auto !p-[8px]",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
