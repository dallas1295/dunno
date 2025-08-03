"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { loggerLink, httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { useState } from "react";
import superjson from "superjson";
import type { AppRouter } from "@/server/root";

let clientQueryClientSingleton: QueryClient | undefined = undefined;
const getQueryClient = () => {
  if (typeof window === "undefined") {
    return new QueryClient();
  }
  return (clientQueryClientSingleton ??= new QueryClient());
};

export const trpc = createTRPCReact<AppRouter>();

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === "development" ||
            (op.direction === "down" && op.result instanceof Error),
        }),
        httpBatchLink({
          url: getBaseUrl() + "/api/trpc",
          transformer: superjson, // 👈 CORRECT PLACE!
          fetch(url, options) {
            return fetch(url, {
              ...options,
              credentials: "include",
            });
          },
          headers() {
            const headers = new Headers();
            headers.set("x-trpc-source", "next_app");
            return headers;
          },
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        {props.children}
      </trpc.Provider>
    </QueryClientProvider>
  );
}

function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 8080}`;
}
