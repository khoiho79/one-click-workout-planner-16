import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StatusBar, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from './Icons';
import {
  buildFallbackPlan,
  buildPrompt,
  callOpenAI,
  formatDurationLabel,
  parseWorkoutPlan,
} from '../lib/planner';
import {
  calculateBMI,
  createId,
  formatDateTime,
  getHistoryPlannerContext,
  getStreakDays,
  minutesToLabel,
  summarizeHistoryForPrompt,
} from '../lib/utils';

function EmptyState({ icon, title, subtitle, styles }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <MaterialIcons name={icon} size={28} color="#2563EB" />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );
}

function MetricPill({ label, value, styles }) {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function DropdownField({ label, value, options, onChange, containerStyle, styles }) {
  const [modalVisible, setModalVisible] = useState(false);
  const { Modal } = require('react-native');

  return (
    <View style={[styles.optionBlock, containerStyle]}>
      <Text style={styles.optionTitle}>{label}</Text>
      <Pressable style={styles.dropdownButton} onPress={() => setModalVisible(true)}>
        <Text style={styles.dropdownButtonText} numberOfLines={1}>{value}</Text>
      </Pressable>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose {label.toLowerCase()}</Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <MaterialIcons name="close" size={22} color="#0F172A" />
              </Pressable>
            </View>
            {options.map((option) => {
              const selected = value === option.label || value === option.value;
              return (
                <Pressable
                  key={String(option.value)}
                  style={styles.modelRow}
                  onPress={() => {
                    onChange(option.value);
                    setModalVisible(false);
                  }}
                >
                  <Text style={styles.modelText}>{option.label}</Text>
                  {selected ? <MaterialIcons name="check-circle" size={20} color="#2563EB" /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function PlannerScreen({ navigation, useAppData, styles }) {
  const { profile, history, settings, setHistory } = useAppData();
  const [duration, setDuration] = useState(30);
  const [environment, setEnvironment] = useState('Home');
  const [intensity, setIntensity] = useState('Moderate');
  const [equipment, setEquipment] = useState('Bodyweight');
  const [focus, setFocus] = useState('Full Body');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const environmentOptions = ['Home', 'Gym', 'Outdoor'];
  const intensityOptions = ['Low', 'Moderate', 'High'];
  const equipmentOptions = ['Bodyweight', 'Dumbbells', 'Bands', 'Full Gym'];
  const focusOptions = ['Full Body', 'Upper Body', 'Lower Body', 'Core', 'Cardio'];

  const focusValue = [focus];
  const focusLabel = focus;

  const bmi = useMemo(() => calculateBMI(profile.weightLbs, profile.heightFt, profile.heightIn), [profile]);
  const streak = useMemo(() => getStreakDays(history), [history]);

  const canGenerate = profile.age && profile.gender && profile.weightLbs && profile.heightFt && profile.goal;

  const onGeneratePlan = async () => {
    if (!canGenerate) {
      Alert.alert('Complete your profile', 'Add your age, gender, weight, height, and goal first so the planner can personalize the workout.');
      return;
    }

    setError('');
    setIsGenerating(true);

    const historySummary = summarizeHistoryForPrompt(history);
    const plannerHistoryContext = getHistoryPlannerContext(history);
    const prompt = buildPrompt({
      profile,
      duration,
      environment,
      intensity,
      equipment,
      focus: focusValue,
      historySummary,
    });

    try {
      let rawText = '';

      if (settings.useOpenAI && settings.openAIApiKey) {
        rawText = await callOpenAI({
          apiKey: settings.openAIApiKey,
          model: settings.openAIModel,
          prompt,
        });
      } else {
        rawText = buildFallbackPlan({
          profile,
          duration,
          environment,
          intensity,
          equipment,
          focus: focusValue,
          historySummary: plannerHistoryContext,
        });
      }

      const parsed = parseWorkoutPlan(rawText, {
        title: focusLabel + ' ' + formatDurationLabel(duration),
        duration,
        environment,
        intensity,
        equipment,
      });

      const newItem = {
        id: createId(),
        createdAt: new Date().toISOString(),
        source: settings.useOpenAI && settings.openAIApiKey ? 'AI' : 'Smart Local Planner',
        duration,
        environment,
        intensity,
        equipment,
        focus: focusLabel,
        prompt,
        plan: parsed,
      };

      const nextHistory = [newItem, ...history].slice(0, 50);
      await setHistory(nextHistory);
      navigation.navigate('PlanDetails', { item: newItem, fromPlanner: true });
    } catch (e) {
      setError(e.message || 'Failed to generate workout plan.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={["#0F172A", "#1D4ED8", "#38BDF8"]} style={styles.heroGradient}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroCard}>
            <Text style={styles.eyebrow}>One tap workout planning</Text>
            <Text style={styles.heroTitle}>Plan your workout</Text>

            <View style={styles.metricsRow}>
              <MetricPill label="Goal" value={profile.goal || 'Set profile'} styles={styles} />
              <MetricPill label="BMI" value={bmi || '--'} styles={styles} />
              <MetricPill label="Streak" value={streak + ' days'} styles={styles} />
            </View>
          </View>

          <View style={styles.panel}>
            <View style={styles.optionsRow}>
              <DropdownField
                label="Time"
                value={minutesToLabel(duration)}
                options={[15, 20, 30, 45, 60].map((item) => ({ label: minutesToLabel(item), value: item }))}
                onChange={setDuration}
                containerStyle={styles.optionInlineBlock}
                styles={styles}
              />

              <DropdownField
                label="Place"
                value={environment}
                options={environmentOptions.map((item) => ({ label: item, value: item }))}
                onChange={setEnvironment}
                containerStyle={styles.optionInlineBlock}
                styles={styles}
              />

              <DropdownField
                label="Intensity"
                value={intensity}
                options={intensityOptions.map((item) => ({ label: item, value: item }))}
                onChange={setIntensity}
                containerStyle={styles.optionInlineBlock}
                styles={styles}
              />
            </View>

            <View style={styles.optionsRow}>
              <DropdownField
                label="Equipment"
                value={equipment}
                options={equipmentOptions.map((item) => ({ label: item, value: item }))}
                onChange={setEquipment}
                containerStyle={styles.optionInlineBlockWide}
                styles={styles}
              />

              <DropdownField
                label="Focus"
                value={focus}
                options={focusOptions.map((item) => ({ label: item, value: item }))}
                onChange={setFocus}
                containerStyle={styles.optionInlineBlockWide}
                styles={styles}
              />
            </View>

            {!canGenerate ? (
              <View style={styles.warningBox}>
                <MaterialIcons name="info" size={18} color="#92400E" />
                <Text style={styles.warningText}>Complete your profile to unlock personalized planning.</Text>
              </View>
            ) : null}

            {error ? (
              <View style={styles.errorBox}>
                <MaterialIcons name="error-outline" size={18} color="#B91C1C" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [styles.generateButton, pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] }]}
              onPress={onGeneratePlan}
              disabled={isGenerating}
            >
              <LinearGradient colors={["#2563EB", "#1D4ED8"]} style={styles.generateGradient}>
                {isGenerating ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <MaterialIcons name="auto-awesome" size={28} color="#FFFFFF" />
                )}
                <Text style={styles.generateTitle}>{isGenerating ? 'Generating your plan...' : 'Plan My Workout'}</Text>
                <Text style={styles.generateSubtitle}>Personalized for {minutesToLabel(duration).toLowerCase()}</Text>
              </LinearGradient>
            </Pressable>
          </View>

          <View style={styles.secondaryPanel}>
            <View style={styles.secondaryHeader}>
              <Text style={styles.secondaryTitle}>Recent workouts</Text>
              <Text style={styles.secondaryCount}>{history.length}</Text>
            </View>
            {history.length === 0 ? (
              <EmptyState
                icon="history"
                title="No workouts yet"
                subtitle="Your generated plans will appear here so the planner can adapt over time."
                styles={styles}
              />
            ) : (
              history.slice(0, 3).map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.historyPreviewItem}
                  onPress={() => navigation.navigate('PlanDetails', { item })}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyPreviewTitle}>{item.plan?.title || item.focus}</Text>
                    <Text style={styles.historyPreviewMeta}>
                      {formatDateTime(item.createdAt)} • {minutesToLabel(item.duration)} • {item.environment}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={22} color="#94A3B8" />
                </Pressable>
              ))
            )}
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
