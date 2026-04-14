import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";

const rkTheme = lightTheme({
	accentColor: "#6C5CE7",
	accentColorForeground: "white",
	borderRadius: "medium",
});
rkTheme.shadows.connectButton = "none";
import "./styles/index.css";
import App from "./App";
import { config } from "./wagmi";
import { ToastProvider } from "./components/ui/toast";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<BrowserRouter>
			<WagmiProvider config={config}>
				<QueryClientProvider client={queryClient}>
					<RainbowKitProvider theme={rkTheme}>
						<ToastProvider>
							<App />
						</ToastProvider>
					</RainbowKitProvider>
				</QueryClientProvider>
			</WagmiProvider>
		</BrowserRouter>
	</StrictMode>,
);
