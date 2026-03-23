import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Check, Copy } from "lucide-react";
import { cn, formatAddress } from "@/lib/utils";

type CopyableAddressProps = {
	value?: string | null;
	label?: string | null;
	fallback?: string;
	className?: string;
	hideCopyButton?: boolean;
	style?: CSSProperties;
	truncate?: boolean;
};

export function CopyableAddress({
	value,
	label,
	fallback = "\u2014",
	className,
	hideCopyButton = false,
	style,
	truncate = true,
}: CopyableAddressProps) {
	const [copied, setCopied] = useState<boolean>(false);
	const [isHovering, setIsHovering] = useState<boolean>(false);
	const resetTimeout = useRef<number | undefined>(undefined);

	const MAX_LABEL_LEN = 13;
	const truncatedLabel = label ? (label.length > MAX_LABEL_LEN ? `${label.slice(0, MAX_LABEL_LEN)}\u2026` : label) : null;
	const displayValue = truncatedLabel || (truncate ? formatAddress(value) : value);
	const canCopy = Boolean(value && !hideCopyButton);

	const handleCopy = useCallback(async () => {
		if (!value) return;

		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			window.clearTimeout(resetTimeout.current);
			resetTimeout.current = window.setTimeout(() => setCopied(false), 1500);
		} catch (error) {
			console.error("Failed to copy address:", error);
		}
	}, [value]);

	useEffect(
		() => () => {
			window.clearTimeout(resetTimeout.current);
		},
		[],
	);

	if (!value) {
		return (
			<span className={cn("orbitron text-[0.85rem] tracking-wide", className)} style={style}>
				{fallback}
			</span>
		);
	}

	return (
		<span
			className={cn("inline-flex items-center gap-1.5 orbitron text-[0.85rem] tracking-wide", className)}
			style={style}
		>
			<span
				title={label ? `${label} \u00b7 ${value}` : value}
				className={cn("whitespace-nowrap", !truncate && "overflow-hidden text-ellipsis max-w-full")}
			>
				{displayValue ?? fallback}
			</span>
			{canCopy && (
				<button
					type="button"
					onClick={handleCopy}
					aria-label="Copy address"
					className={cn(
						"inline-flex items-center justify-center p-0.5 rounded cursor-pointer transition-colors duration-150",
						copied && "text-primary",
						!copied && isHovering && "text-foreground",
						!copied && !isHovering && "text-muted-foreground",
					)}
					style={{ all: "unset", cursor: "pointer" }}
					onMouseEnter={() => setIsHovering(true)}
					onMouseLeave={() => setIsHovering(false)}
				>
					{copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={2} />}
				</button>
			)}
		</span>
	);
}
