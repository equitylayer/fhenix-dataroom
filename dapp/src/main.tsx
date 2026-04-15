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

/** Bail out of retries when the user explicitly rejected a wallet signature.
 *  Otherwise react-query hammers them with repeat prompts. */
function isUserRejection(err: unknown): boolean {
	const msg = err instanceof Error ? err.message : String(err);
	return (
		msg.includes("user rejected") ||
		msg.includes("ACTION_REJECTED") ||
		msg.includes("User denied") ||
		msg.includes("User rejected")
	);
}

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: (failureCount, error) => !isUserRejection(error) && failureCount < 3,
		},
		mutations: {
			retry: false,
		},
	},
});

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
