import { useState } from "react";
import { PERMANENT, resolveAddress } from "@obolos/secretsvault-sdk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { grantAccessSchema } from "@/lib/schemas";

interface Props {
	onGrant: (address: string, expiresAt: bigint) => Promise<void>;
	isPending: boolean;
}

export function GrantAccessForm({ onGrant, isPending }: Props) {
	const [address, setAddress] = useState<string>("");
	const [permanent, setPermanent] = useState<boolean>(true);
	const [expiresAt, setExpiresAt] = useState<string>("");
	const [validationError, setValidationError] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const result = grantAccessSchema.safeParse({ address, permanent, expiresAt });
		if (!result.success) {
			setValidationError(result.error.issues[0].message);
			return;
		}
		if (!permanent && !expiresAt) {
			setValidationError("Expiry date is required");
			return;
		}

		setValidationError(null);

		let resolved: string;
		try {
			resolved = await resolveAddress(address);
		} catch {
			setValidationError(`Could not resolve "${address}"`);
			return;
		}

		const expiry = permanent ? PERMANENT : BigInt(Math.floor(new Date(expiresAt).getTime() / 1000));

		await onGrant(resolved, expiry);
		setAddress("");
		setExpiresAt("");
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-3">
			<div className="flex gap-2">
				<Input
					type="text"
					value={address}
					onChange={(e) => setAddress(e.target.value)}
					placeholder="0x... or name.eth"
					className="flex-1"
					style={{ fontFamily: "monospace" }}
				/>
				<Button type="submit" size="sm" disabled={isPending}>
					{isPending ? "..." : "Grant"}
				</Button>
			</div>

			<div className="flex items-center gap-3 text-xs text-muted-foreground">
				<label className="flex items-center gap-2 cursor-pointer">
					<input
						type="checkbox"
						checked={permanent}
						onChange={(e) => setPermanent(e.target.checked)}
						className="accent-primary"
					/>
					Permanent
				</label>

				{!permanent && (
					<Input
						type="datetime-local"
						value={expiresAt}
						onChange={(e) => setExpiresAt(e.target.value)}
						className="flex-1"
					/>
				)}
			</div>

			{validationError && <p className="text-destructive text-xs">{validationError}</p>}
		</form>
	);
}
