"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { theme } from "@/lib/theme";

// Create Convex client lazily to handle missing env var gracefully
function getConvexClient(): ConvexReactClient {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  if (!convexUrl) {
    console.error("NEXT_PUBLIC_CONVEX_URL is not set");
    // Return a dummy client that will error when actually used
    return new ConvexReactClient("http://localhost:0");
  }

  return new ConvexReactClient(convexUrl);
}

const convex = getConvexClient();

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ConvexProvider client={convex}>
      <AppRouterCacheProvider>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </AppRouterCacheProvider>
    </ConvexProvider>
  );
}
