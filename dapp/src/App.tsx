import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { DocumentsTab } from "@/pages/DataRoom/DocumentsTab";
import { DATAROOM_ADDRESS } from "@/lib/contracts";

function App() {
	const { isConnected } = useAccount();

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
				) : (
					<DocumentsTab dataRoomAddress={DATAROOM_ADDRESS} />
				)}
			</main>
		</div>
	);
}

export default App;
