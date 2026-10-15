import { createFileRoute } from "@tanstack/react-router";
import { GameCanvas } from "../components/pinball/GameCanvas";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Chrono Storm 1885 — Flipper 3D steampunk" },
      { name: "description", content: "Flipper 3D isométrique steampunk gothique : bobine Tesla, portail temporel et éclairs." },
      { property: "og:title", content: "Chrono Storm 1885 — Flipper 3D steampunk" },
      { property: "og:description", content: "Stabilisez la faille temporelle de 1885 dans ce flipper 3D aux éclairs Tesla." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GameCanvas,
});
