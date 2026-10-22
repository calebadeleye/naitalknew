import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useSession } from "../../state/session";
import { useTheme } from "../../state/theme";

export default function TabsLayout() {
  const { colors } = useTheme();
  const { accounts, outbox } = useSession();
  if (accounts.length === 0) return <Redirect href="/welcome" />;

  const failed = outbox.filter((i) => i.status === "failed").length;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11.5, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Mail", tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "mail" : "mail-outline"} size={24} color={color as string} /> }} />
      <Tabs.Screen name="calendar" options={{ title: "Calendar", tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "calendar" : "calendar-outline"} size={23} color={color as string} /> }} />
      <Tabs.Screen name="tasks" options={{ title: "Tasks", tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "checkbox" : "checkbox-outline"} size={23} color={color as string} /> }} />
      <Tabs.Screen
        name="more"
        options={{ title: "More", tabBarBadge: failed || undefined, tabBarIcon: ({ color }) => <Ionicons name="ellipsis-horizontal" size={24} color={color as string} /> }}
      />
    </Tabs>
  );
}
