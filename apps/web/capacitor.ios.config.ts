import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.vtaerp.pos",
  appName: "VTA POS",
  webDir: "ios-bundle",
  server: { cleartext: false },
  ios: { contentInset: "never", preferredContentMode: "mobile" },
  plugins: {
    CapacitorHttp: { enabled: true },
    SplashScreen: { launchShowDuration: 1000, backgroundColor: "#0877f9" },
    StatusBar: { style: "DARK", backgroundColor: "#0877f9" }
  }
};
export default config;
