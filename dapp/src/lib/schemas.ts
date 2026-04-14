import { z } from "zod";

export const createNamespaceSchema = z.object({
	name: z.string().min(1, "Name is required").max(64, "Name too long"),
});

export const setSecretSchema = z.object({
	key: z.string().min(1, "Key is required").max(128, "Key too long"),
	value: z.string().min(1, "Value is required"),
});

export const grantAccessSchema = z.object({
	address: z
		.string()
		.refine(
			(v) => /^0x[a-fA-F0-9]{40}$/.test(v) || /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/.test(v),
			"Enter a valid address (0x...) or ENS name (name.eth)",
		),
	permanent: z.boolean(),
	expiresAt: z.string().optional(),
});
