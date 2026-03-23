type ModalActionsProps = {
	onCancel: () => void;
	cancelText?: string;
	submitText: string;
	loadingText: string;
	isLoading: boolean;
	isDisabled?: boolean;
	onSubmit?: () => void;
	justifyContent?: "space-between" | "flex-end" | "flex-start";
	gap?: string;
	marginTop?: string;
	containerStyle?: React.CSSProperties;
	cancelButtonStyle?: React.CSSProperties;
	submitButtonStyle?: React.CSSProperties;
};

export function ModalActions({
	onCancel,
	cancelText = "Cancel",
	submitText,
	loadingText,
	isLoading,
	isDisabled = false,
	onSubmit,
	justifyContent = "space-between",
	gap = "0.75rem",
	marginTop = "0.5rem",
	containerStyle,
	cancelButtonStyle,
	submitButtonStyle,
}: ModalActionsProps) {
	const disabled = isLoading || isDisabled;

	return (
		<div className="modal-actions" style={{ justifyContent, gap, marginTop, ...containerStyle }}>
			<button
				type="button"
				onClick={onCancel}
				disabled={isLoading}
				style={{
					background: "none",
					border: "none",
					cursor: "pointer",
					color: "var(--muted-foreground)",
					fontSize: "0.875rem",
					padding: "0",
					opacity: isLoading ? 0.5 : 1,
					...cancelButtonStyle,
				}}
			>
				{cancelText}
			</button>
			<button
				type={onSubmit ? "button" : "submit"}
				onClick={onSubmit}
				className="btn-connect"
				disabled={disabled}
				style={{
					opacity: disabled ? 0.7 : 1,
					...submitButtonStyle,
				}}
			>
				{isLoading ? loadingText : submitText}
			</button>
		</div>
	);
}
