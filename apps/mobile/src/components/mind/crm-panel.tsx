import { api } from "@beegreat/backend/convex/_generated/api";
import type { Doc, Id } from "@beegreat/backend/convex/_generated/dataModel";
import type { UIComponent } from "@beegreat/tool-presentation";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/goals/screen-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import { MindSections } from "./mind-sections";

type Contact = Doc<"crmContacts">;
const empty = {
  name: "",
  context: "",
  email: "",
  phone: "",
  note: "",
  followUpOn: "",
  lastContactedOn: "",
};

export function CrmPanel() {
  const theme = useTheme();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"all" | "followups" | "archived">("all");
  const [adding, setAdding] = useState(false);
  const page = usePaginatedQuery(
    api.crm.list,
    { view, search },
    { initialNumItems: 30 },
  );
  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <ScreenHeader title="Mind" />
        <MindSections selected="crm" />
        <TextInput
          accessibilityLabel="Search contacts"
          placeholder="Search contacts"
          placeholderTextColor={theme.textSecondary}
          value={search}
          onChangeText={setSearch}
          style={[
            styles.input,
            {
              color: theme.text,
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
          ]}
        />
        <Action label="Add contact" onPress={() => setAdding(true)} />
        <View style={styles.actions}>
          {(["all", "followups", "archived"] as const).map((value) => (
            <Action
              key={value}
              selected={view === value}
              label={
                value === "all"
                  ? "Contacts"
                  : value === "followups"
                    ? "Follow-ups"
                    : "Archived"
              }
              onPress={() => setView(value)}
            />
          ))}
        </View>
        {page.status === "LoadingFirstPage" ? (
          <ActivityIndicator accessibilityLabel="Loading contacts" />
        ) : page.results.length === 0 ? (
          <ThemedText>
            {search
              ? "No matching contacts."
              : view === "followups"
                ? "No follow-ups scheduled."
                : view === "archived"
                  ? "No archived contacts."
                  : "No contacts yet."}
          </ThemedText>
        ) : null}
        {page.results.map((contact) => (
          <ContactRow key={contact._id} contact={contact} />
        ))}
        {page.status === "CanLoadMore" ? (
          <Action label="Load more" onPress={() => page.loadMore(30)} />
        ) : page.status === "LoadingMore" ? (
          <ActivityIndicator />
        ) : null}
      </ScrollView>
      {adding ? (
        <ContactEditor
          onClose={() => setAdding(false)}
          onSaved={() => {
            setView("all");
            setSearch("");
          }}
        />
      ) : null}
    </ThemedView>
  );
}

function Action({
  label,
  onPress,
  disabled = false,
  selected,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{
        disabled,
        ...(selected !== undefined ? { selected } : {}),
      }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: selected
            ? theme.backgroundSelected
            : theme.backgroundElement,
          opacity: disabled || pressed ? 0.6 : 1,
        },
      ]}
    >
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

function ContactRow({ contact }: { contact: Contact }) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${contact.name}`}
        onPress={() => setEditing(true)}
        style={({ pressed }) => [
          styles.row,
          { borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <ThemedText type="smallBold">{contact.name}</ThemedText>
          {contact.context ? (
            <ThemedText type="small">{contact.context}</ThemedText>
          ) : null}
          {contact.note ? (
            <ThemedText type="small" numberOfLines={2}>
              {contact.note}
            </ThemedText>
          ) : null}
          {contact.followUpOn ? (
            <ThemedText type="small">
              Follow up {formatDate(contact.followUpOn)}
            </ThemedText>
          ) : null}
          {contact.lastContactedOn ? (
            <ThemedText type="small">
              Last contacted {formatDate(contact.lastContactedOn)}
            </ThemedText>
          ) : null}
          {contact.archived ? (
            <ThemedText type="small">Archived</ThemedText>
          ) : null}
        </View>
        <ThemedText>›</ThemedText>
      </Pressable>
      {editing ? (
        <ContactEditor contact={contact} onClose={() => setEditing(false)} />
      ) : null}
    </>
  );
}

export function CrmChatCard({
  contacts,
}: Extract<UIComponent, { type: "crm" }>) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      {contacts.length ? (
        contacts.map((contact) => (
          <LiveContact key={contact.id} id={contact.id} />
        ))
      ) : (
        <ThemedText>No contacts found.</ThemedText>
      )}
    </View>
  );
}

function LiveContact({ id }: { id: string }) {
  const contact = useQuery(api.crm.get, { contactId: id as Id<"crmContacts"> });
  if (contact === undefined)
    return <ActivityIndicator accessibilityLabel="Loading contact" />;
  return contact ? (
    <ContactRow contact={contact} />
  ) : (
    <ThemedText>Contact unavailable.</ThemedText>
  );
}

function ContactEditor({
  contact,
  onClose,
  onSaved,
}: {
  contact?: Contact;
  onSaved?: () => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [values, setValues] = useState(
    contact
      ? {
          name: contact.name,
          context: contact.context,
          email: contact.email,
          phone: contact.phone,
          note: contact.note,
          followUpOn: contact.followUpOn ?? "",
          lastContactedOn: contact.lastContactedOn ?? "",
        }
      : empty,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const save = useMutation(api.crm.save);
  const archive = useMutation(api.crm.archive);
  async function run(action: () => Promise<unknown>) {
    setPending(true);
    setError("");
    try {
      await action();
      onSaved?.();
      onClose();
    } catch {
      setError(
        "Could not save. Check the fields and use YYYY-MM-DD for dates.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (!pending) onClose();
      }}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            <ThemedText type="smallBold">
              {contact ? "Edit contact" : "Add contact"}
            </ThemedText>
            {(Object.keys(empty) as Array<keyof typeof empty>).map((field) => (
              <View key={field} style={{ gap: 6 }}>
                <ThemedText type="small">{labels[field]}</ThemedText>
                <TextInput
                  accessibilityLabel={labels[field]}
                  editable={!pending}
                  value={values[field]}
                  onChangeText={(value) =>
                    setValues((current) => ({ ...current, [field]: value }))
                  }
                  placeholder={field.endsWith("On") ? "YYYY-MM-DD" : undefined}
                  placeholderTextColor={theme.textSecondary}
                  multiline={field === "note"}
                  maxLength={
                    field === "note" ? 4000 : field === "name" ? 160 : 240
                  }
                  autoCapitalize={
                    field === "email" || field.endsWith("On")
                      ? "none"
                      : "sentences"
                  }
                  keyboardType={
                    field === "email"
                      ? "email-address"
                      : field === "phone"
                        ? "phone-pad"
                        : "default"
                  }
                  style={[
                    styles.input,
                    {
                      color: theme.text,
                      backgroundColor: theme.card,
                      borderColor: theme.border,
                    },
                    field === "note" && {
                      minHeight: 100,
                      textAlignVertical: "top",
                    },
                  ]}
                />
              </View>
            ))}
            {error ? (
              <ThemedText accessibilityRole="alert">{error}</ThemedText>
            ) : null}
            <View style={styles.actions}>
              <Action label="Cancel" disabled={pending} onPress={onClose} />
              <Action
                label={pending ? "Saving…" : "Save"}
                disabled={pending || !values.name.trim()}
                onPress={() =>
                  void run(() =>
                    save({
                      ...values,
                      contactId: contact?._id,
                      followUpOn: values.followUpOn || null,
                      lastContactedOn: values.lastContactedOn || null,
                    }),
                  )
                }
              />
              {contact ? (
                <Action
                  label={
                    contact.archived ? "Restore contact" : "Archive contact"
                  }
                  disabled={pending}
                  onPress={() =>
                    void run(() =>
                      archive({
                        contactId: contact._id,
                        archived: !contact.archived,
                      }),
                    )
                  }
                />
              ) : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const labels = {
  name: "Name",
  context: "How you know them",
  email: "Email",
  phone: "Phone",
  note: "Notes",
  followUpOn: "Follow-up date",
  lastContactedOn: "Last contacted",
};
function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
    maxWidth: 800,
    width: "100%",
    alignSelf: "center",
    paddingBottom: 40,
  },
  input: {
    minHeight: 48,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: "continuous",
    fontSize: 16,
  },
  action: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  row: {
    minHeight: 64,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  card: {
    borderRadius: 16,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
});
