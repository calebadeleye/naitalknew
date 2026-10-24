import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Animated, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Tone = "success" | "error" | "info";
const ToastContext = createContext<(text: string, tone?: Tone) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<{ text: string; tone: Tone } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const show = useCallback(
    (text: string, tone: Tone = "success") => {
      setMessage({ text, tone });
      if (timer.current) clearTimeout(timer.current);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timer.current = setTimeout(() => Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setMessage(null)), tone === "error" ? 4500 : 2800);
    },
    [opacity],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message ? (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 84, opacity, backgroundColor: message.tone === "error" ? "#b91c1c" : message.tone === "info" ? "#0f1a2b" : "#15803d", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10, elevation: 6 }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>{message.text}</Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
