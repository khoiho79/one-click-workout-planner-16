import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from './Icons';
import { minutesToLabel } from '../lib/utils';

function DetailBadge({ label, styles }) {
  return (
    <View style={styles.detailBadge}>
      <Text style={styles.detailBadgeText}>{label}</Text>
    </View>
  );
}

function SectionCard({ title, icon, children, styles }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionCardHeader}>
        <MaterialIcons name={icon} size={18} color="#2563EB" />
        <Text style={styles.sectionCardTitle}>{title}</Text>
      </View>
      <View style={{ gap: 10 }}>{children}</View>
    </View>
  );
}

function renderBullets(items, styles) {
  if (!items || items.length === 0) {
    return <Text style={styles.fallbackText}>No items available.</Text>;
  }
  return items.map((item, index) => (
    <View key={index} style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <Text style={styles.bulletText}>{item}</Text>
    </View>
  ));
}

function renderNumbered(items, checkedItems, onToggleItem, getWorkoutItemId, styles) {
  if (!items || items.length === 0) {
    return <Text style={styles.fallbackText}>No exercises available.</Text>;
  }
  return items.map((item, index) => {
    const itemId = getWorkoutItemId(item, index);
    const isChecked = checkedItems.includes(itemId);

    return (
      <Pressable
        key={itemId}
        style={[styles.numberedRow, styles.checkableRow, isChecked && styles.checkableRowChecked]}
        onPress={onToggleItem ? () => onToggleItem(item, index) : undefined}
        disabled={!onToggleItem}
      >
        <View style={styles.numberBubble}>
          <Text style={styles.numberBubbleText}>{index + 1}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.numberedTitle, isChecked && styles.completedText]}>{item.name || 'Exercise'}</Text>
          <Text style={[styles.numberedDetail, isChecked && styles.completedDetail]}>{item.detail || ''}</Text>
        </View>
        <View pointerEvents="none" style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
          {isChecked ? <MaterialIcons name="check" size={16} color="#FFFFFF" /> : null}
        </View>
      </Pressable>
    );
  });
}

export default function WorkoutPlanView({ route, navigation, history, setHistory, getWorkoutItemId, styles }) {
  const routeItem = route.params.item;
  const historyItem = useMemo(() => history.find((entry) => entry.id === routeItem.id), [history, routeItem.id]);
  const item = historyItem || routeItem;
  const plan = item.plan || {};
  const mainItems = Array.isArray(plan.main) ? plan.main : [];
  const workoutItemIds = useMemo(() => mainItems.map((exercise, index) => getWorkoutItemId(exercise, index)), [mainItems, getWorkoutItemId]);
  const [checkedItems, setCheckedItems] = useState(() => (item.checkedMainItemIds || []).filter((id) => workoutItemIds.includes(id)));

  useEffect(() => {
    setCheckedItems((item.checkedMainItemIds || []).filter((id) => workoutItemIds.includes(id)));
  }, [item.checkedMainItemIds, workoutItemIds]);

  const completedCount = checkedItems.length;
  const totalCount = mainItems.length;

  const toggleMainItem = async (exercise, index) => {
    const exerciseId = getWorkoutItemId(exercise, index);
    let nextCheckedItems = [];

    setCheckedItems((currentCheckedItems) => {
      nextCheckedItems = currentCheckedItems.includes(exerciseId)
        ? currentCheckedItems.filter((id) => id !== exerciseId)
        : [...currentCheckedItems, exerciseId];
      return nextCheckedItems;
    });

    const nextHistory = history.map((historyEntry) =>
      historyEntry.id === item.id
        ? {
            ...historyEntry,
            checkedMainItemIds: nextCheckedItems,
          }
        : historyEntry
    );

    try {
      await setHistory(nextHistory);
    } catch (e) {
      setCheckedItems((currentCheckedItems) =>
        currentCheckedItems.includes(exerciseId)
          ? currentCheckedItems.filter((id) => id !== exerciseId)
          : [...currentCheckedItems, exerciseId]
      );
      Alert.alert('Save failed', 'Could not update workout progress on this device.');
    }
  };

  return (
    <SafeAreaView style={styles.lightScreen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.detailsContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.detailsHero}>
          <Text style={styles.detailsEyebrow}>{item.source}</Text>
          <Text style={styles.detailsTitle}>{plan.title || item.focus || 'Workout Plan'}</Text>
          <Text style={styles.detailsSubtitle}>{plan.summary || 'A balanced training plan tailored to your inputs.'}</Text>

          <View style={styles.detailsBadges}>
            <DetailBadge label={minutesToLabel(item.duration)} styles={styles} />
            <DetailBadge label={item.environment} styles={styles} />
            <DetailBadge label={item.intensity} styles={styles} />
            <DetailBadge label={item.equipment} styles={styles} />
          </View>
        </View>

        <SectionCard title="Warm-up" icon="local-fire-department" styles={styles}>
          {renderBullets(plan.warmup, styles)}
        </SectionCard>

        <SectionCard title="Main workout" icon="fitness-center" styles={styles}>
          {totalCount > 0 ? (
            <View style={styles.progressPill}>
              <MaterialIcons name="check-circle" size={15} color="#2563EB" />
              <Text style={styles.progressPillText}>{completedCount} of {totalCount} completed</Text>
            </View>
          ) : null}
          {renderNumbered(plan.main || [], checkedItems, toggleMainItem, getWorkoutItemId, styles)}
        </SectionCard>

        <SectionCard title="Cool-down" icon="self-improvement" styles={styles}>
          {renderBullets(plan.cooldown, styles)}
        </SectionCard>

        <SectionCard title="Coach notes" icon="tips-and-updates" styles={styles}>
          {renderBullets(plan.tips, styles)}
        </SectionCard>

        <View style={styles.detailsFooterNote}>
          <MaterialIcons name="favorite" size={16} color="#2563EB" />
          <Text style={styles.detailsFooterText}>Listen to your body and scale intensity if anything feels painful or unsafe.</Text>
        </View>

        <Pressable style={styles.secondaryAction} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryActionText}>Back</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
