import { createFileRoute } from "@tanstack/react-router";
import { GameCanvas } from "../components/pinball/GameCanvas";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Mansion Pinball — Hommage aux flippers de 1992" },
      { name: "description", content: "Un flipper gothique original : manoir hanté, marais, cimetière et afficheur ambre." },
      { property: "og:title", content: "Mansion Pinball — Flipper gothique" },
      { property: "og:description", content: "Jouez sur un plateau de manoir hanté inspiré des bornes des années 1990." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GameCanvas,
});
