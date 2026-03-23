import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract } from "wagmi";
import { DocumentsTab } from "@/pages/DataRoom/DocumentsTab";
import { DATAROOM_ADDRESS } from "@/lib/contracts";
import DataRoomABI from "@/assets/abis/DataRoom.json";

function App() {
	const { isConnected } = useAccount();

	const { data: admin } = useReadContract({
		address: DATAROOM_ADDRESS,
		abi: DataRoomABI,
		functionName: "admin",
	}) as { data: string | undefined };

	return (
		<div className="min-h-screen bg-background">
			<header className="border-b border-border bg-card px-6 py-3 flex items-center justify-between">
				<h1 className="text-base font-semibold orbitron tracking-wider">Obolos DataRoom</h1>
				<ConnectButton showBalance={false} />
			</header>

			<main className="max-w-5xl mx-auto px-6 py-8">
				{!isConnected ? (
					<div className="flex flex-col items-center justify-center py-24 text-center">
						<h2 className="text-xl font-semibold mb-2">Connect your wallet</h2>
						<p className="text-sm text-muted-foreground mb-6">
							Connect a wallet to interact with the DataRoom.
						</p>
						<ConnectButton />
					</div>
				) : !admin ? (
					<div className="text-center py-16 text-muted-foreground text-sm">Loading contract data...</div>
				) : (
					<DocumentsTab dataRoomAddress={DATAROOM_ADDRESS} adminAddress={admin} />
				)}
			</main>
		</div>
	);
}

export default App;
