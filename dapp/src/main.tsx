import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import "./styles/index.css";
import App from "./App";
import { config } from "./wagmi";
import { ToastProvider } from "./components/ui/toast";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<WagmiProvider config={config}>
			<QueryClientProvider client={queryClient}>
				<RainbowKitProvider>
					<ToastProvider>
						<App />
					</ToastProvider>
				</RainbowKitProvider>
			</QueryClientProvider>
		</WagmiProvider>
	</StrictMode>,
);
