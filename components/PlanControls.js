import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from './Icons';

function InputCard({ label, children, style, styles }) {
  return (
    <View style={[styles.inputCard, style]}>
      <Text style={styles.inputLabel}>{label}</Text>
      {children}
    </View>
  );
}

function StyledInput({ inputStyle, styles, ...props }) {
  return <TextInput placeholderTextColor="#94A3B8" style={[styles.input, inputStyle]} {...props} />;
}

export default function PlanControls({ settings, setSettings, styles, models }) {
  const [draft, setDraft] = useState(settings);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const save = async () => {
    await setSettings(draft);
    Alert.alert('Saved', 'Your planner settings were updated.');
  };

  return (
    <SafeAreaView style={styles.lightScreen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.formContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Settings</Text>
            <Text style={styles.pageSubtitle}>Use a local smart planner or connect your own OpenAI API key.</Text>
          </View>
        </View>

        <View style={styles.settingsCard}>
          <View style={styles.settingsRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.settingsTitle}>Use OpenAI</Text>
              <Text style={styles.settingsDescription}>
                Enable live LLM-generated workout plans using your own API key.
              </Text>
            </View>
            <Switch
              value={draft.useOpenAI}
              onValueChange={(value) => setDraft({ ...draft, useOpenAI: value })}
              trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
              thumbColor={draft.useOpenAI ? '#2563EB' : '#F8FAFC'}
            />
          </View>
        </View>

        <InputCard label="OpenAI API Key" styles={styles}>
          <StyledInput
            value={draft.openAIApiKey}
            onChangeText={(value) => setDraft({ ...draft, openAIApiKey: value.trim() })}
            placeholder="sk-..."
            secureTextEntry
            styles={styles}
          />
          <Text style={styles.helperText}>Your key stays on this device via AsyncStorage. No hidden secrets are bundled in the app.</Text>
        </InputCard>

        <InputCard label="Model" styles={styles}>
          <Pressable style={styles.selectorButton} onPress={() => setModalVisible(true)}>
            <Text style={styles.selectorValue}>{draft.openAIModel}</Text>
            <MaterialIcons name="expand-more" size={20} color="#475569" />
          </Pressable>
        </InputCard>

        <View style={styles.infoCard}>
          <MaterialIcons name="shield" size={22} color="#2563EB" />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>Privacy & reliability</Text>
            <Text style={styles.infoText}>
              If AI is turned off or the key is missing, the app still creates a quality workout using its built-in local planner.
            </Text>
          </View>
        </View>

        <Pressable style={styles.primaryAction} onPress={save}>
          <Text style={styles.primaryActionText}>Save Settings</Text>
        </Pressable>

        <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Choose model</Text>
                <Pressable onPress={() => setModalVisible(false)}>
                  <MaterialIcons name="close" size={22} color="#0F172A" />
                </Pressable>
              </View>
              {models.map((model) => (
                <Pressable
                  key={model}
                  style={styles.modelRow}
                  onPress={() => {
                    setDraft({ ...draft, openAIModel: model });
                    setModalVisible(false);
                  }}
                >
                  <Text style={styles.modelText}>{model}</Text>
                  {draft.openAIModel === model ? <MaterialIcons name="check-circle" size={20} color="#2563EB" /> : null}
                </Pressable>
              ))}
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}
