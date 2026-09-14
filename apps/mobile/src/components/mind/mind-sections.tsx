import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";

export function MindSections({ selected }: { selected: "bookmarks" | "crm" }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {(["bookmarks", "crm"] as const).map((value) => (
        <Pressable
          key={value}
          accessibilityRole="tab"
          accessibilityState={{ selected: selected === value }}
          onPress={() =>
            router.replace(value === "crm" ? "/mind/crm" : "/mind")
          }
          style={{
            minHeight: 44,
            paddingHorizontal: 16,
            justifyContent: "center",
            borderRadius: 22,
            backgroundColor:
              selected === value
                ? theme.backgroundSelected
                : theme.backgroundElement,
          }}
        >
          <ThemedText type="smallBold">
            {value === "crm" ? "CRM" : "Bookmarks"}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}
