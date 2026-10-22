import { useRouter } from "expo-router";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDrawer } from "../../components/Drawer";
import { Card, Divider, Header, IconButton, Row, SectionTitle } from "../../components/ui";
import { useSession } from "../../state/session";
import { useTheme } from "../../state/theme";

export default function More() {
  const { colors } = useTheme();
  const router = useRouter();
  const drawer = useDrawer();
  const { outbox, account } = useSession();
  const mine = outbox.filter((i) => i.account === account?.email);
  const failed = mine.filter((i) => i.status === "failed").length;

  const rows: Array<[Parameters<typeof Row>[0]["icon"], string, string | null, string]> = [
    ["cloud-upload-outline", "Outbox", mine.length ? `${mine.length} waiting${failed ? `, ${failed} failed` : ""}` : "Nothing waiting", "/outbox"],
    ["time-outline", "Scheduled emails", "Emails set to send later", "/scheduled"],
    ["document-outline", "Notes", null, "/notes"],
    ["copy-outline", "Templates", null, "/templates"],
    ["megaphone-outline", "Campaigns", null, "/campaigns"],
    ["funnel-outline", "Filters", "Sort incoming mail", "/rules?kind=filter"],
    ["git-network-outline", "Automation", "Forwarding and auto-replies", "/rules?kind=automation"],
  ];

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="More" left={<IconButton name="menu" label="Open menu" onPress={drawer.open} size={26} />} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 4 }}>
        <SectionTitle>Tools</SectionTitle>
        <Card>
          {rows.map(([icon, title, subtitle, href], i) => (
            <View key={title}>
              {i ? <Divider /> : null}
              <Row icon={icon} iconColor={colors.green} title={title} subtitle={subtitle} onPress={() => router.push(href as never)} />
            </View>
          ))}
        </Card>
        <SectionTitle>Account</SectionTitle>
        <Card>
          <Row icon="settings-outline" iconColor={colors.green} title="Settings" subtitle={account?.email} onPress={() => router.push("/settings")} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
