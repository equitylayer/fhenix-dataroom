import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { Shield, Lock, Users, FileText } from "lucide-react";
import { DocumentsTab } from "@/pages/DataRoom/DocumentsTab";
import { DATAROOM_ADDRESS } from "@/lib/contracts";

function FeatureCard({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
	return (
		<div className="group relative rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 transition-all duration-300 hover:border-[#0AD9DC]/30 hover:bg-white/8 hover:-translate-y-0.5">
			<div className="mb-3 inline-flex items-center justify-center rounded-lg bg-[#0AD9DC]/10 p-2.5 text-[#0AD9DC] transition-colors group-hover:bg-[#0AD9DC]/15">
				<Icon className="h-5 w-5" />
			</div>
			<h3 className="text-sm font-semibold mb-1 text-white">{title}</h3>
			<p className="text-xs text-white/50 leading-relaxed">{description}</p>
		</div>
	);
}

function HeroConnectButton() {
	return (
		<ConnectButton.Custom>
			{({ openConnectModal }) => (
				<button
					onClick={openConnectModal}
					className="group relative inline-flex items-center gap-2 rounded-lg bg-[#0AD9DC] px-8 py-3 text-sm font-semibold text-gray-900 orbitron tracking-wider uppercase transition-all duration-300 hover:bg-[#0AF0F3] hover:shadow-lg hover:shadow-[#0AD9DC]/25 hover:-translate-y-0.5 active:translate-y-0 border-none"
				>
					Connect Wallet
				</button>
			)}
		</ConnectButton.Custom>
	);
}

function LandingPage() {
	return (
		<div className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden bg-[#1a1a2e]">
			{/* Background decorations */}
			<div className="pointer-events-none absolute inset-0">
				<div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
				<div className="absolute bottom-1/3 right-1/4 h-96 w-96 rounded-full bg-[#0AD9DC]/5 blur-3xl" />
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full border border-white/[0.03]" />
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[800px] w-[800px] rounded-full border border-white/[0.02]" />
			</div>

			{/* Hero content */}
			<div className="relative z-10 text-center max-w-2xl mx-auto px-6">
				{/* Logo */}
				<div className="mb-8 inline-flex items-center justify-center">
					<div className="relative">
						<div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
						<img src="/favicon.svg?v=2" alt="Obolos" className="relative h-20 w-20 drop-shadow-lg" />
					</div>
				</div>

				<h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4 bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
					Obolos DataRoom
				</h2>

				<p className="text-base text-white/50 mb-3 max-w-md mx-auto leading-relaxed">
					Fully homomorphic encryption for secure document storage and confidential data sharing.
				</p>

				<div className="flex items-center justify-center gap-2 mb-10">
					<span className="text-xs text-white/30 tracking-wide uppercase orbitron">Powered by</span>
					<img src="/fhenix-logo.svg" alt="Fhenix" className="h-4 w-4" />
					<span className="text-xs text-white/30 tracking-wide uppercase orbitron">Fhenix</span>
				</div>

				<div className="mb-16">
					<HeroConnectButton />
				</div>
			</div>

			{/* Feature cards */}
			<div className="relative z-10 w-full max-w-3xl mx-auto px-6 pb-16">
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<FeatureCard
						icon={Shield}
						title="FHE Encrypted"
						description="Documents encrypted with fully homomorphic encryption, on-chain."
					/>
					<FeatureCard
						icon={Lock}
						title="Access Control"
						description="Granular per-folder permissions with on-chain key management."
					/>
					<FeatureCard
						icon={Users}
						title="Secure Sharing"
						description="Share encrypted data rooms with specific wallet addresses."
					/>
					<FeatureCard
						icon={FileText}
						title="Organized"
						description="Rooms and folders to keep your confidential documents structured."
					/>
				</div>
			</div>
		</div>
	);
}

function App() {
	const { isConnected } = useAccount();

	if (!isConnected) {
		return <LandingPage />;
	}

	return (
		<div className="min-h-screen bg-[#f0f0f5]">
			<header className="border-b border-border bg-white/80 backdrop-blur-sm px-6 py-3 flex items-center justify-between sticky top-0 z-50">
				<img src="/favicon.svg?v=2" alt="Obolos" className="h-7 w-7" />
				<ConnectButton accountStatus="address" showBalance={false} chainStatus="name" />
			</header>

			<main className="max-w-5xl mx-auto px-6 py-8">
				<DocumentsTab dataRoomAddress={DATAROOM_ADDRESS} />
			</main>
		</div>
	);
}

export default App;
