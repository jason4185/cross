import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/markets", search: { q: "" } });
  },
  head: () => ({
    meta: [
      { title: "CROSS — One-hour cross-asset markets" },
      {
        name: "description",
        content:
          "Compare equal-weighted INDICES and FX basket performance over exact one-hour windows.",
      },
      { property: "og:title", content: "CROSS — One-hour cross-asset markets" },
      {
        property: "og:description",
        content: "Permissionless pooled prediction markets for INDICES versus FX.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
