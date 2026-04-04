import React, { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from './Icons';
import { formatDateTime, minutesToLabel } from '../lib/utils';

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

function SmallMeta({ text, styles }) {
  return (
    <View style={styles.smallMeta}>
      <Text style={styles.smallMetaText}>{text}</Text>
    </View>
  );
}

export default function HistorySection({ navigation, history, setHistory, styles }) {
  const [refreshing, setRefreshing] = useState(false);

  const clearAll = () => {
    Alert.alert('Clear history', 'Remove all saved workout plans from this device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await setHistory([]);
        },
      },
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  return (
    <SafeAreaView style={styles.lightScreen} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.historyContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />}
      >
        <View style={styles.pageHeaderCompact}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitleCompact}>Workout History</Text>
            <Text style={styles.pageSubtitleCompact}>Review previous plans and keep your training consistent.</Text>
          </View>
          {history.length > 0 ? (
            <Pressable style={styles.clearButton} onPress={clearAll}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>

        {history.length === 0 ? (
          <EmptyState
            icon="event-note"
            title="Nothing saved yet"
            subtitle="Generate your first workout from the Plan tab and it will appear here."
            styles={styles}
          />
        ) : (
          history.map((item) => (
            <Pressable key={item.id} style={styles.historyCard} onPress={() => navigation.navigate('HistoryDetails', { item })}>
              <View style={styles.historyCardTop}>
                <View style={styles.historySourceBadge}>
                  <Text style={styles.historySourceText}>{item.source}</Text>
                </View>
                <Text style={styles.historyDate}>{formatDateTime(item.createdAt)}</Text>
              </View>
              <Text style={styles.historyCardTitle}>{item.plan?.title || item.focus}</Text>
              <Text style={styles.historyCardSummary} numberOfLines={2}>
                {item.plan?.summary || 'Personalized workout plan'}
              </Text>
              <View style={styles.historyMetaRow}>
                <SmallMeta text={minutesToLabel(item.duration)} styles={styles} />
                <SmallMeta text={item.environment} styles={styles} />
                <SmallMeta text={item.intensity} styles={styles} />
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
