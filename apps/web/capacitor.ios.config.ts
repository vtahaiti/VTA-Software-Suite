import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.vtaerp.pos",
  appName: "VTA POS",
  webDir: "ios-bundle",
  server: { cleartext: false },
  ios: { contentInset: "automatic", preferredContentMode: "mobile" },
  plugins: {
    SplashScreen: { launchShowDuration: 1000, backgroundColor: "#16a34a" },
    StatusBar: { style: "LIGHT", backgroundColor: "#16a34a" }
  }
};
export default config;
