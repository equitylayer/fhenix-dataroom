import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export type ModalProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title?: string;
	description?: string;
	children: React.ReactNode;
	className?: string;
};

export function Modal({ open, onOpenChange, title, description, children, className }: ModalProps) {
	const [mounted, setMounted] = React.useState(false);

	React.useEffect(() => {
		setMounted(true);
	}, []);

	React.useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onOpenChange(false);
			}
		};

		if (open) {
			document.addEventListener("keydown", handleKeyDown);
		}

		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [open, onOpenChange]);

	if (!mounted || !open) {
		return null;
	}

	const modalContent = (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			<div className="absolute inset-0 bg-black/40" onClick={() => onOpenChange(false)} />
			<div
				className={cn(
					"relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl border border-border bg-background shadow-xl",
					className,
					"bg-white",
				)}
				role="dialog"
				aria-modal="true"
			>
				{(title || description) && (
					<div className="flex-shrink-0 rounded-t-xl border-b border-border px-6 py-4 bg-white">
						<div className="flex items-start justify-between">
							<div>
								{title ? <h2 className="text-lg font-semibold text-foreground">{title}</h2> : null}
								{description ? (
									<p className="mt-1 text-sm text-muted-foreground">{description}</p>
								) : null}
							</div>
							<button
								type="button"
								onClick={() => onOpenChange(false)}
								className="text-muted-foreground hover:text-foreground"
								style={{
									background: "none",
									border: "none",
									cursor: "pointer",
									fontSize: "1.25rem",
									lineHeight: "1",
									padding: "0",
									marginLeft: "1rem",
								}}
								aria-label="Close"
							>
								x
							</button>
						</div>
					</div>
				)}

				<div className="modal-content overflow-y-auto p-6 flex-1">{children}</div>
			</div>
		</div>
	);

	return createPortal(modalContent, document.body);
}
