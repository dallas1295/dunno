"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { useState } from "react";
import superjson from "superjson";
import { createTRPCNextAppRouter } from "@trpc/next/app-router";
import type { ReadonlyHeaders } from "next/headers"; // New import for ReadonlyHeaders

import type { AppRouter } from "@/server/root";

export const trpc = createTRPCReact<AppRouter>();

export function TRPCReactProvider(props: {
  children: React.ReactNode;
  headers: ReadonlyHeaders; // Changed type to ReadonlyHeaders
}) {
  const [queryClient] = useState(() => new QueryClient());

  const trpcClient = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
          transformer: superjson,
          headers() {
            // Convert ReadonlyHeaders to a plain object
            return {
              ...Object.fromEntries(props.headers.entries()),
              "x-trpc-source": "react",
            };
          },
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <trpc.Provider client={trpcClient[0]} queryClient={queryClient}>
        {props.children}
      </trpc.Provider>
    </QueryClientProvider>
  );
}
