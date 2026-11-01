type HapticKind = "tap" | "success";

declare global {
  interface Window {
    /** Injected by the Android app's WebView (JavaScript channel). */
    OnlyBudgetHaptics?: { postMessage: (message: string) => void };
  }
}

/** A short vibration under the finger: native in the Android app, the Vibration API in a phone browser. */
export function haptic(kind: HapticKind = "tap") {
  if (typeof window === "undefined") return;
  if (window.OnlyBudgetHaptics) {
    window.OnlyBudgetHaptics.postMessage(kind);
    return;
  }
  navigator.vibrate?.(kind === "success" ? [12, 40, 18] : 8);
}
