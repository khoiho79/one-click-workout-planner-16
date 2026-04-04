import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { MaterialIcons } from './components/Icons';
import PlannerScreen from './components/PlannerScreen';
import ProfileForm from './components/ProfileForm';
import PlanControls from './components/PlanControls';
import WorkoutPlanView from './components/WorkoutPlanView';
import HistorySection from './components/HistorySection';
import {
  DEFAULT_SETTINGS,
  GENDER_OPTIONS,
  GOAL_OPTIONS,
  HISTORY_KEY,
  OPENAI_MODELS,
  PROFILE_KEY,
  SETTINGS_KEY,
} from './lib/constants';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function App() {
  const [booting, setBooting] = useState(true);
  const [profile, setProfile] = useState({
    name: '',
    age: '',
    gender: GENDER_OPTIONS[0],
    weightLbs: '',
    heightFt: '',
    heightIn: '',
    goal: GOAL_OPTIONS[0],
    limitations: '',
    experience: 'Beginner',
  });
  const [history, setHistory] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    loadAppData();
  }, []);

  const loadAppData = async () => {
    try {
      const [profileRaw, historyRaw, settingsRaw] = await Promise.all([
        AsyncStorage.getItem(PROFILE_KEY),
        AsyncStorage.getItem(HISTORY_KEY),
        AsyncStorage.getItem(SETTINGS_KEY),
      ]);

      if (profileRaw) {
        const parsedProfile = JSON.parse(profileRaw);
        const migratedProfile = {
          name: parsedProfile.name || '',
          age: parsedProfile.age || '',
          gender: parsedProfile.gender || GENDER_OPTIONS[0],
          weightLbs: parsedProfile.weightLbs || (parsedProfile.weightKg ? String(Math.round(parseFloat(parsedProfile.weightKg) * 2.20462)) : ''),
          heightFt: parsedProfile.heightFt || (parsedProfile.heightCm ? String(Math.floor(parseFloat(parsedProfile.heightCm) / 30.48)) : ''),
          heightIn: parsedProfile.heightIn || (parsedProfile.heightCm ? String(Math.round((parseFloat(parsedProfile.heightCm) / 2.54) % 12)) : ''),
          goal: parsedProfile.goal || GOAL_OPTIONS[0],
          limitations: parsedProfile.limitations || '',
          experience: parsedProfile.experience || 'Beginner',
        };
        setProfile(migratedProfile);
      }
      if (historyRaw) {
        setHistory(JSON.parse(historyRaw));
      }
      if (settingsRaw) {
        const parsedSettings = JSON.parse(settingsRaw);
        const migratedSettings = {
          ...DEFAULT_SETTINGS,
          ...parsedSettings,
          useOpenAI: parsedSettings.useOpenAI ?? parsedSettings.useOpenRouter ?? DEFAULT_SETTINGS.useOpenAI,
          openAIApiKey: parsedSettings.openAIApiKey ?? parsedSettings.openRouterApiKey ?? DEFAULT_SETTINGS.openAIApiKey,
          openAIModel: parsedSettings.openAIModel ?? parsedSettings.openRouterModel?.replace('openai/', '') ?? DEFAULT_SETTINGS.openAIModel,
        };
        setSettings(migratedSettings);
      }
    } catch (error) {
      Alert.alert('Load error', 'We could not load your saved workout data.');
    } finally {
      setBooting(false);
    }
  };

  const persistProfile = async (nextProfile) => {
    setProfile(nextProfile);
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
  };

  const persistHistory = async (nextHistory) => {
    setHistory(nextHistory);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
  };

  const persistSettings = async (nextSettings) => {
    setSettings(nextSettings);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
  };

  const contextValue = {
    profile,
    setProfile: persistProfile,
    history,
    setHistory: persistHistory,
    settings,
    setSettings: persistSettings,
  };

  if (booting) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.bootContainer} edges={["top", "left", "right", "bottom"]}>
          <ExpoStatusBar style="light" />
          <StatusBar barStyle="light-content" />
          <LinearGradient colors={["#0B1220", "#111827", "#1E293B"]} style={StyleSheet.absoluteFill} />
          <View style={styles.bootCard}>
            <Text style={styles.bootTitle}>One Click Workout Planner</Text>
            <Text style={styles.bootSubtitle}>Loading your profile, history, and planning settings...</Text>
            <ActivityIndicator size="large" color="#60A5FA" style={{ marginTop: 18 }} />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AppContextProvider value={contextValue}>
        <NavigationContainer theme={navTheme}>
          <ExpoStatusBar style="light" />
          <MainTabs />
        </NavigationContainer>
      </AppContextProvider>
    </SafeAreaProvider>
  );
}

const AppContext = React.createContext(null);

function AppContextProvider({ value, children }) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppData() {
  const ctx = React.useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppData must be used within AppContextProvider');
  }
  return ctx;
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#64748B',
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ color, size }) => {
          const iconMap = {
            PlanTab: 'fitness-center',
            HistoryTab: 'history',
            ProfileTab: 'person',
            SettingsTab: 'settings',
          };
          return <MaterialIcons name={iconMap[route.name] || 'circle'} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="PlanTab" component={PlanStack} options={{ title: 'Plan' }} />
      <Tab.Screen name="HistoryTab" component={HistoryStack} options={{ title: 'History' }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ title: 'Profile' }} />
      <Tab.Screen name="SettingsTab" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Tab.Navigator>
  );
}

function PlanStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Planner" options={{ headerShown: false }}>
        {(props) => <PlannerScreen {...props} useAppData={useAppData} styles={styles} />}
      </Stack.Screen>
      <Stack.Screen
        name="PlanDetails"
        options={{
          title: 'Workout Plan',
          headerStyle: { backgroundColor: '#F8FAFC' },
          headerShadowVisible: false,
          headerTintColor: '#0F172A',
          headerTitleStyle: { fontSize: 18, fontWeight: '700' },
          headerHeight: 48,
        }}
      >
        {(props) => <PlanDetailsScreen {...props} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function HistoryStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="HistoryHome" options={{ headerShown: false }}>
        {(props) => <HistoryScreen {...props} />}
      </Stack.Screen>
      <Stack.Screen
        name="HistoryDetails"
        options={{
          title: 'Saved Workout',
          headerStyle: { backgroundColor: '#F8FAFC' },
          headerShadowVisible: false,
          headerTintColor: '#0F172A',
          headerHeight: 48,
        }}
      >
        {(props) => <PlanDetailsScreen {...props} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function getWorkoutItemId(exercise, index) {
  if (exercise?.id) {
    return String(exercise.id);
  }
  if (exercise?.name || exercise?.detail) {
    return String(`${exercise?.name || 'exercise'}-${exercise?.detail || ''}-${index}`);
  }
  return String(index);
}

function PlanDetailsScreen({ route, navigation }) {
  const { history, setHistory } = useAppData();
  return (
    <WorkoutPlanView
      route={route}
      navigation={navigation}
      history={history}
      setHistory={setHistory}
      getWorkoutItemId={getWorkoutItemId}
      styles={styles}
    />
  );
}

function HistoryScreen({ navigation }) {
  const { history, setHistory } = useAppData();
  return <HistorySection navigation={navigation} history={history} setHistory={setHistory} styles={styles} />;
}

function ProfileScreen() {
  const { profile, setProfile, history } = useAppData();
  return (
    <ProfileForm
      profile={profile}
      setProfile={setProfile}
      history={history}
      styles={styles}
      genderOptions={GENDER_OPTIONS}
      goalOptions={GOAL_OPTIONS}
    />
  );
}

function SettingsScreen() {
  const { settings, setSettings } = useAppData();
  return (
    <PlanControls
      settings={settings}
      setSettings={setSettings}
      styles={styles}
      models={OPENAI_MODELS}
    />
  );
}

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#F8FAFC',
  },
};

const styles = StyleSheet.create({
  bootContainer: {
    flex: 1,
    backgroundColor: '#0B1220',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  bootCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  bootTitle: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '800',
  },
  bootSubtitle: {
    color: '#CBD5E1',
    fontSize: 15,
    marginTop: 8,
    lineHeight: 22,
  },
  screen: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  heroGradient: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  heroCard: {
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  eyebrow: {
    color: '#BFDBFE',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
    marginTop: 2,
  },
  heroSubtitle: {
    color: '#DBEAFE',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  metricPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    padding: 10,
  },
  metricLabel: {
    color: '#BFDBFE',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  panel: {
    marginTop: 6,
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
  },
  sectionTitle: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '800',
  },
  sectionHint: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 6,
    marginBottom: 6,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  optionBlock: {
    marginTop: 16,
  },
  optionInlineBlock: {
    flex: 1,
    minWidth: 0,
  },
  optionInlineBlockWide: {
    flex: 1,
    minWidth: 0,
  },
  optionTitle: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  compactChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  chipText: {
    color: '#1E3A8A',
    fontSize: 14,
    fontWeight: '700',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  dropdownButton: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingLeft: 14,
    paddingRight: 14,
    paddingVertical: 14,
    justifyContent: 'center',
  },
  dropdownButtonText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '600',
  },
  warningBox: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 14,
    padding: 12,
  },
  warningText: {
    flex: 1,
    color: '#92400E',
    fontSize: 13,
    fontWeight: '600',
  },
  errorBox: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 14,
    padding: 12,
  },
  errorText: {
    flex: 1,
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '600',
  },
  generateButton: {
    marginTop: 22,
    borderRadius: 24,
    overflow: 'hidden',
  },
  generateGradient: {
    paddingVertical: 18,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
    marginTop: 8,
  },
  generateSubtitle: {
    color: '#DBEAFE',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  secondaryPanel: {
    marginTop: 14,
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    padding: 14,
  },
  secondaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  secondaryTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryCount: {
    color: '#2563EB',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    fontWeight: '800',
    fontSize: 12,
  },
  historyPreviewItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyPreviewTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
  },
  historyPreviewMeta: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
  lightScreen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  detailsContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  detailsHero: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 12,
  },
  detailsEyebrow: {
    color: '#93C5FD',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  detailsTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    marginTop: 4,
  },
  detailsSubtitle: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  detailsBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  detailBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  detailBadgeText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    marginTop: 12,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionCardTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
  progressPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 4,
  },
  progressPillText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '700',
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#2563EB',
    marginTop: 7,
  },
  bulletText: {
    flex: 1,
    color: '#334155',
    fontSize: 15,
    lineHeight: 22,
  },
  numberedRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  checkableRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  checkableRowChecked: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  numberBubble: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberBubbleText: {
    color: '#1D4ED8',
    fontWeight: '800',
  },
  numberedTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  numberedDetail: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 4,
  },
  completedText: {
    color: '#64748B',
    textDecorationLine: 'line-through',
  },
  completedDetail: {
    color: '#94A3B8',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  fallbackText: {
    color: '#64748B',
    fontSize: 14,
  },
  detailsFooterNote: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 14,
  },
  detailsFooterText: {
    flex: 1,
    color: '#1E3A8A',
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryAction: {
    marginTop: 18,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  secondaryActionText: {
    color: '#2563EB',
    fontSize: 15,
    fontWeight: '800',
  },
  historyContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pageHeaderCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  pageTitle: {
    color: '#0F172A',
    fontSize: 28,
    fontWeight: '800',
  },
  pageTitleCompact: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '800',
  },
  pageSubtitle: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    maxWidth: 280,
  },
  pageSubtitleCompact: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    maxWidth: 280,
  },
  clearButton: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  clearButtonText: {
    color: '#B91C1C',
    fontWeight: '800',
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 999,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 16,
  },
  emptySubtitle: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
  },
  historyCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historySourceBadge: {
    backgroundColor: '#DBEAFE',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  historySourceText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '800',
  },
  historyDate: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  historyCardTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 12,
  },
  historyCardSummary: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },
  historyMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  smallMeta: {
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallMetaText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  formContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  profileSummaryCard: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
  },
  profileSummaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileSummaryName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  profileSummaryGoal: {
    color: '#93C5FD',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  profileSummaryCircle: {
    width: 74,
    height: 74,
    borderRadius: 999,
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileSummaryCircleValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  profileSummaryCircleLabel: {
    color: '#DBEAFE',
    fontSize: 11,
    fontWeight: '700',
  },
  profileStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  metricPillLight: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
  },
  metricLabelLight: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricValueLight: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 6,
  },
  inputCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
  },
  inputLabel: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    color: '#0F172A',
    fontSize: 15,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  doubleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  tripleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  chipsOnLight: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
  },
  primaryAction: {
    backgroundColor: '#2563EB',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
  settingsDescription: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },
  helperText: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 10,
    lineHeight: 18,
  },
  selectorButton: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorValue: {
    color: '#0F172A',
    fontSize: 15,
  },
  infoCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  infoTitle: {
    color: '#1E3A8A',
    fontSize: 15,
    fontWeight: '800',
  },
  infoText: {
    color: '#1D4ED8',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
  },
  modelRow: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modelText: {
    color: '#0F172A',
    fontSize: 15,
    flex: 1,
    paddingRight: 12,
  },
  tabBar: {
    position: 'absolute',
    height: 68,
    paddingBottom: 8,
    paddingTop: 8,
    borderTopWidth: 0,
    elevation: 0,
    backgroundColor: '#FFFFFF',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
});

export default App;
