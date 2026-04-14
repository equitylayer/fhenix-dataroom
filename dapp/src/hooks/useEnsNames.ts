import { resolveEnsName } from "@obolos/secretsvault-sdk";
import type { HexAddress } from "@obolos/secretsvault-sdk";
import { useEffect, useState } from "react";

export function useEnsNames(addresses: HexAddress[]) {
	const [names, setNames] = useState<Record<string, string | null>>({});

	useEffect(() => {
		let cancelled = false;
		const resolve = async () => {
			const results: Record<string, string | null> = {};
			await Promise.all(
				addresses.map(async (addr) => {
					results[addr] = await resolveEnsName(addr);
				}),
			);
			if (!cancelled) setNames(results);
		};
		if (addresses.length > 0) resolve();
		return () => {
			cancelled = true;
		};
	}, [addresses.join(",")]);

	return names;
}
