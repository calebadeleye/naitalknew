import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Redirect, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../components/ui";
import { PLANS_URL } from "../lib/config";
import { useSession } from "../state/session";

export default function Welcome() {
  const router = useRouter();
  const { accounts } = useSession();
  if (accounts.length > 0) return <Redirect href="/" />;

  return (
    <LinearGradient colors={["#0b3d24", "#0e4d2d", "#082a19"]} style={{ flex: 1 }}>
      {/* Soft shapes, as in the mockup */}
      <View style={{ position: "absolute", top: -80, right: -120, width: 320, height: 320, borderRadius: 160, backgroundColor: "rgba(34,160,79,0.18)" }} />
      <View style={{ position: "absolute", bottom: -140, left: -90, width: 360, height: 360, borderRadius: 180, backgroundColor: "rgba(34,160,79,0.14)" }} />
      <SafeAreaView style={{ flex: 1, paddingHorizontal: 28, justifyContent: "center" }}>
        <View style={{ alignItems: "center", gap: 14, marginBottom: 56 }}>
          <Image source={require("../../assets/icon.png")} style={{ width: 96, height: 96, borderRadius: 24 }} accessibilityIgnoresInvertColors />
          <Text style={{ fontFamily: "Pacifico_400Regular", fontSize: 46, color: "#fff", lineHeight: 70 }}>Green Mail</Text>
          <Text style={{ color: "#fff", fontSize: 22, fontWeight: "600", textAlign: "center", lineHeight: 29 }}>Your professional{"\n"}email, simplified.</Text>
          <Text style={{ color: "rgba(255,255,255,0.78)", fontSize: 15.5, textAlign: "center", lineHeight: 22 }}>Secure, fast and reliable email{"\n"}for your business.</Text>
        </View>
        <View style={{ gap: 14 }}>
          <Button title="Sign In" onPress={() => router.push("/sign-in")} />
          <Button title="Create Account" variant="outlineLight" onPress={() => void WebBrowser.openBrowserAsync(PLANS_URL)} />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
