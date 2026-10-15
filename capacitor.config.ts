import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.chronostorm1885",
  appName: "Chrono Storm 1885",
  webDir: "dist/client",
  server: {
    url: "https://id-preview--de1039e0-c306-49c5-b0e5-6a6d090d9639.lovable.app?forceHideBadge=true",
    cleartext: true,
  },
  android: { backgroundColor: "#07060c" },
};

export default config;
