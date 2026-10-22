import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.vtaerp.commerce",
  appName: "VTA POS",
  webDir: "public",
  server: {
    url: "https://vtaerp.com",
    errorPath: "offline.html",
    cleartext: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#2563EB",
      showSpinner: false
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#2563EB"
    }
  }
};

export default config;
