import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { CrossProvider } from "@/components/cross/app-context";
import { Header } from "@/components/cross/header";
import { CrossMark } from "@/components/cross/primitives";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import "@genlayer/transaction-kit-react/styles.css";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <CrossMark className="mx-auto size-12" />
        <p className="mt-6 font-mono text-xs text-primary">404 · OFF AXIS</p>
        <h1 className="mt-2 text-3xl font-semibold">Market not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This CROSS route does not resolve to a market or supported page.
        </p>
        <Button asChild className="mt-6">
          <Link to="/markets" search={{ q: "" }}>
            Back to Markets
          </Link>
        </Button>
      </div>
    </div>
  );
}
function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => reportLovableError(error, { boundary: "cross_root" }), [error]);
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 text-center">
      <div>
        <h1 className="text-xl font-semibold">CROSS could not load this view.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The contract data could not be loaded. Try the request again.
        </p>
        <Button
          className="mt-5"
          onClick={() => {
            void router.invalidate();
            reset();
          }}
        >
          Try again
        </Button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#0b0e10" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.ico" },
    ],
  }),
  shellComponent: ({ children }: { children: ReactNode }) => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  ),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});
function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <CrossProvider>
        <Header />
        <Outlet />
        <Toaster position="bottom-right" richColors />
      </CrossProvider>
    </QueryClientProvider>
  );
}
