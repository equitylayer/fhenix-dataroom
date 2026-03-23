import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

const toastVariants = cva(
	"group pointer-events-auto relative flex w-full items-center space-x-2 overflow-hidden rounded-none border border-black p-3 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-bottom-full",
	{
		variants: {
			variant: {
				default: "bg-white text-black",
				loading: "bg-white text-black",
				success: "bg-green-500 text-black",
				warning: "bg-yellow-400 text-black",
				error: "bg-red-500 text-white",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

type ToastContextValue = {
	push: (toast: Omit<ToastProps, "id">) => void;
	dismiss: (id?: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

type ToastState = Array<ToastProps & { id: string }>;

export type ToastProps = VariantProps<typeof toastVariants> & {
	id?: string;
	title?: string;
	description?: string;
	duration?: number;
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
	const [toasts, setToasts] = React.useState<ToastState>([]);
	const timeoutsRef = React.useRef<Map<string, NodeJS.Timeout>>(new Map());

	const remove = React.useCallback((id: string) => {
		setToasts((items) => items.filter((item) => item.id !== id));
		const timeout = timeoutsRef.current.get(id);
		if (timeout) {
			clearTimeout(timeout);
			timeoutsRef.current.delete(id);
		}
	}, []);

	const dismiss = React.useCallback(
		(id?: string) => {
			if (id) {
				remove(id);
			} else {
				timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
				timeoutsRef.current.clear();
				setToasts([]);
			}
		},
		[remove],
	);

	const push = React.useCallback<ToastContextValue["push"]>(
		({ duration = 5000, ...toast }) => {
			timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
			timeoutsRef.current.clear();

			const id = crypto.randomUUID();
			const timeout = setTimeout(() => remove(id), duration);
			timeoutsRef.current.set(id, timeout);

			setToasts([{ ...toast, id }]);
		},
		[remove],
	);

	React.useEffect(() => {
		return () => {
			timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
			timeoutsRef.current.clear();
		};
	}, []);

	return (
		<ToastContext.Provider value={{ push, dismiss }}>
			{children}
			<div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
				{toasts.map(({ id, title, description, variant }) => (
					<div key={id} className={`${toastVariants({ variant })} !p-4`}>
						{variant === "loading" && (
							<div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden bg-gray-200">
								<div
									className="h-full w-1/3 bg-black animate-[snake_1.5s_ease-in-out_infinite]"
									style={{
										animation: "snake 1.5s ease-in-out infinite",
									}}
								/>
								<style>{`
									@keyframes snake {
										0% {
											transform: translateX(-100%);
										}
										100% {
											transform: translateX(400%);
										}
									}
								`}</style>
							</div>
						)}

						<div className="flex-shrink-0">
							{variant === "loading" && (
								<div className="relative h-4 w-4 border border-gray-300">
									<svg className="absolute inset-0" width="16" height="16" viewBox="0 0 16 16">
										<path
											d="M 0,0 L 16,0 L 16,16 L 0,16 Z"
											fill="none"
											stroke="black"
											strokeWidth="2"
											strokeDasharray="4 8"
											strokeLinecap="square"
										>
											<animate
												attributeName="stroke-dashoffset"
												from="0"
												to="48"
												dur="1.5s"
												repeatCount="indefinite"
											/>
										</path>
									</svg>
								</div>
							)}
							{variant === "success" && (
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="3"
									strokeLinecap="square"
									strokeLinejoin="miter"
								>
									<polyline points="20 6 9 17 4 12" />
								</svg>
							)}
							{variant === "warning" && (
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="3"
									strokeLinecap="square"
									strokeLinejoin="miter"
								>
									<circle cx="12" cy="12" r="10" />
									<line x1="12" y1="8" x2="12" y2="12" />
									<line x1="12" y1="16" x2="12.01" y2="16" />
								</svg>
							)}
							{variant === "error" && (
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="3"
									strokeLinecap="square"
									strokeLinejoin="miter"
								>
									<line x1="18" y1="6" x2="6" y2="18" />
									<line x1="6" y1="6" x2="18" y2="18" />
								</svg>
							)}
						</div>
						<div className="grid gap-0.5 flex-1 orbitron">
							{title ? <div className="text-xs font-semibold">{title}</div> : null}
							{description ? <div className="text-xs">{description}</div> : null}
						</div>
					</div>
				))}
			</div>
		</ToastContext.Provider>
	);
}

export function useToast() {
	const context = React.useContext(ToastContext);
	if (!context) {
		throw new Error("useToast must be used within a ToastProvider");
	}
	return context;
}
