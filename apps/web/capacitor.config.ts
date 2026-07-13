import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.vtaerp.commerce",
  appName: "VTA Commerce",
  webDir: "public",
  server: {
    url: "https://vtaerp.com",
    errorPath: "offline.html",
    cleartext: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#16a34a",
      showSpinner: false
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#16a34a"
    }
  }
};

export default config;
