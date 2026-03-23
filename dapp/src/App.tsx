import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract } from "wagmi";
import { isAddress } from "viem";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DocumentsTab } from "@/pages/DataRoom/DocumentsTab";
import type { HexAddress } from "@/lib/contracts";
import DataRoomABI from "@/assets/abis/DataRoom.json";

function App() {
	const { isConnected } = useAccount();
	const [addressInput, setAddressInput] = useState("");
	const [activeAddress, setActiveAddress] = useState<HexAddress | null>(null);

	const { data: admin } = useReadContract(
		activeAddress
			? {
					address: activeAddress,
					abi: DataRoomABI.abi,
					functionName: "admin",
				}
			: undefined,
	) as { data: string | undefined };

	const handleEnter = () => {
		const trimmed = addressInput.trim();
		if (isAddress(trimmed)) {
			setActiveAddress(trimmed as HexAddress);
		}
	};

	return (
		<div className="min-h-screen bg-background">
			<header className="border-b border-border px-6 py-3 flex items-center justify-between">
				<h1 className="text-base font-semibold orbitron tracking-wider">Fhenix DataRoom</h1>
				<ConnectButton showBalance={false} />
			</header>

			<main className="max-w-5xl mx-auto px-6 py-8">
				{!isConnected ? (
					<div className="flex flex-col items-center justify-center py-24 text-center">
						<h2 className="text-xl font-semibold mb-2">Connect your wallet</h2>
						<p className="text-sm text-muted-foreground mb-6">
							Connect a wallet to interact with a DataRoom contract.
						</p>
						<ConnectButton />
					</div>
				) : !activeAddress ? (
					<div className="flex flex-col items-center justify-center py-24 text-center">
						<h2 className="text-xl font-semibold mb-2">Enter DataRoom Address</h2>
						<p className="text-sm text-muted-foreground mb-6">
							Paste the deployed DataRoom contract address to get started.
						</p>
						<div className="flex gap-2 w-full max-w-md">
							<Input
								type="text"
								value={addressInput}
								onChange={(e) => setAddressInput(e.target.value)}
								placeholder="0x..."
								className="flex-1 font-mono text-sm"
								onKeyDown={(e) => e.key === "Enter" && handleEnter()}
							/>
							<Button onClick={handleEnter} disabled={!isAddress(addressInput.trim())}>
								Open
							</Button>
						</div>
					</div>
				) : (
					<div>
						<div className="mb-6 flex items-center justify-between">
							<button
								type="button"
								onClick={() => setActiveAddress(null)}
								className="text-xs text-muted-foreground hover:text-foreground transition-colors bg-transparent border-none p-0 shadow-none"
							>
								&larr; Change address
							</button>
							<span className="text-xs font-mono text-muted-foreground">{activeAddress}</span>
						</div>
						{admin ? (
							<DocumentsTab dataRoomAddress={activeAddress} adminAddress={admin} />
						) : (
							<div className="text-center py-16 text-muted-foreground text-sm">
								Loading contract data...
							</div>
						)}
					</div>
				)}
			</main>
		</div>
	);
}

export default App;
