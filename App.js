import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { MaterialIcons } from './components/Icons';
import {
  DEFAULT_SETTINGS,
  GENDER_OPTIONS,
  GOAL_OPTIONS,
  HISTORY_KEY,
  OPENAI_MODELS,
  PROFILE_KEY,
  SETTINGS_KEY,
} from './lib/constants';
import {
  buildFallbackPlan,
  buildPrompt,
  callOpenAI,
  formatDurationLabel,
  parseWorkoutPlan,
} from './lib/planner';
import {
  calculateBMI,
  createId,
  feetInchesToCm,
  formatDateTime,
  getHistoryPlannerContext,
  getStreakDays,
  minutesToLabel,
  poundsToKg,
  summarizeHistoryForPrompt,
} from './lib/utils';

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
        <SafeAreaView style={styles.bootContainer}>
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

function useAppData() {
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
      <Stack.Screen name="Planner" component={PlannerScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="PlanDetails"
        component={PlanDetailsScreen}
        options={{
          title: 'Workout Plan',
          headerStyle: { backgroundColor: '#F8FAFC' },
          headerShadowVisible: false,
          headerTintColor: '#0F172A',
        }}
      />
    </Stack.Navigator>
  );
}

function HistoryStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="HistoryHome" component={HistoryScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="HistoryDetails"
        component={PlanDetailsScreen}
        options={{
          title: 'Saved Workout',
          headerStyle: { backgroundColor: '#F8FAFC' },
          headerShadowVisible: false,
          headerTintColor: '#0F172A',
        }}
      />
    </Stack.Navigator>
  );
}

function PlannerScreen({ navigation }) {
  const insets = useSafeAreaInsets();
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
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={["#0F172A", "#1D4ED8", "#38BDF8"]} style={styles.heroGradient}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(insets.top, 10) }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroCard}>
            <Text style={styles.eyebrow}>One tap workout planning</Text>
            <Text style={styles.heroTitle}>Plan your workout</Text>

            <View style={styles.metricsRow}>
              <MetricPill label="Goal" value={profile.goal || 'Set profile'} />
              <MetricPill label="BMI" value={bmi || '--'} />
              <MetricPill label="Streak" value={streak + ' days'} />
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
              />

              <DropdownField
                label="Place"
                value={environment}
                options={environmentOptions.map((item) => ({ label: item, value: item }))}
                onChange={setEnvironment}
                containerStyle={styles.optionInlineBlock}
              />

              <DropdownField
                label="Intensity"
                value={intensity}
                options={intensityOptions.map((item) => ({ label: item, value: item }))}
                onChange={setIntensity}
                containerStyle={styles.optionInlineBlock}
              />
            </View>

            <View style={styles.optionsRow}>
              <DropdownField
                label="Equipment"
                value={equipment}
                options={equipmentOptions.map((item) => ({ label: item, value: item }))}
                onChange={setEquipment}
                containerStyle={styles.optionInlineBlockWide}
              />

              <DropdownField
                label="Focus"
                value={focus}
                options={focusOptions.map((item) => ({ label: item, value: item }))}
                onChange={setFocus}
                containerStyle={styles.optionInlineBlockWide}
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
                <Text style={styles.generateSubtitle}>Simple, fast, and personalized for {minutesToLabel(duration).toLowerCase()}</Text>
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

function PlanDetailsScreen({ route, navigation }) {
  const { item } = route.params;
  const plan = item.plan || {};

  return (
    <SafeAreaView style={styles.lightScreen}>
      <ScrollView contentContainerStyle={styles.detailsContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.detailsHero}>
          <Text style={styles.detailsEyebrow}>{item.source}</Text>
          <Text style={styles.detailsTitle}>{plan.title || item.focus || 'Workout Plan'}</Text>
          <Text style={styles.detailsSubtitle}>{plan.summary || 'A balanced training plan tailored to your inputs.'}</Text>

          <View style={styles.detailsBadges}>
            <DetailBadge label={minutesToLabel(item.duration)} />
            <DetailBadge label={item.environment} />
            <DetailBadge label={item.intensity} />
            <DetailBadge label={item.equipment} />
          </View>
        </View>

        <SectionCard title="Warm-up" icon="local-fire-department">
          {renderBullets(plan.warmup)}
        </SectionCard>

        <SectionCard title="Main workout" icon="fitness-center">
          {renderNumbered(plan.main || [])}
        </SectionCard>

        <SectionCard title="Cool-down" icon="self-improvement">
          {renderBullets(plan.cooldown)}
        </SectionCard>

        <SectionCard title="Coach notes" icon="tips-and-updates">
          {renderBullets(plan.tips)}
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

function HistoryScreen({ navigation }) {
  const { history, setHistory } = useAppData();
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
    <SafeAreaView style={styles.lightScreen}>
      <ScrollView
        contentContainerStyle={styles.historyContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />}
      >
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Workout History</Text>
            <Text style={styles.pageSubtitle}>Review previous plans and keep your training consistent.</Text>
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
                <SmallMeta text={minutesToLabel(item.duration)} />
                <SmallMeta text={item.environment} />
                <SmallMeta text={item.intensity} />
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ProfileScreen() {
  const { profile, setProfile, history } = useAppData();
  const [draft, setDraft] = useState(profile);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(profile);
  }, [profile]);

  const bmi = calculateBMI(draft.weightLbs, draft.heightFt, draft.heightIn);

  const save = async () => {
    if (!draft.age || !draft.gender || !draft.weightLbs || !draft.heightFt || !draft.goal) {
      Alert.alert('Missing details', 'Please fill in age, gender, weight, height, and goal.');
      return;
    }
    setSaving(true);
    try {
      await setProfile(draft);
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (e) {
      Alert.alert('Save failed', 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.lightScreen}>
      <ScrollView contentContainerStyle={styles.formContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Your Profile</Text>
            <Text style={styles.pageSubtitle}>The better your profile, the better the workout recommendations.</Text>
          </View>
        </View>

        <View style={styles.profileSummaryCard}>
          <View style={styles.profileSummaryTop}>
            <View>
              <Text style={styles.profileSummaryName}>{draft.name || 'Athlete'}</Text>
              <Text style={styles.profileSummaryGoal}>{draft.goal || 'Set a goal'}</Text>
            </View>
            <View style={styles.profileSummaryCircle}>
              <Text style={styles.profileSummaryCircleValue}>{history.length}</Text>
              <Text style={styles.profileSummaryCircleLabel}>Plans</Text>
            </View>
          </View>
          <View style={styles.profileStatsRow}>
            <MetricPillLight label="BMI" value={bmi || '--'} />
            <MetricPillLight label="Experience" value={draft.experience || '--'} />
          </View>
        </View>

        <InputCard label="Name">
          <StyledInput value={draft.name} onChangeText={(value) => setDraft({ ...draft, name: value })} placeholder="Your name" />
        </InputCard>

        <View style={styles.doubleRow}>
          <InputCard label="Age" style={{ flex: 1 }}>
            <StyledInput
              value={String(draft.age || '')}
              onChangeText={(value) => setDraft({ ...draft, age: value.replace(/[^0-9]/g, '') })}
              keyboardType="number-pad"
              placeholder="32"
            />
          </InputCard>
          <InputCard label="Weight (lbs)" style={{ flex: 1 }}>
            <StyledInput
              value={String(draft.weightLbs || '')}
              onChangeText={(value) => setDraft({ ...draft, weightLbs: value.replace(/[^0-9.]/g, '') })}
              keyboardType="decimal-pad"
              placeholder="172"
            />
          </InputCard>
        </View>

        <View style={styles.tripleRow}>
          <InputCard label="Height (ft)" style={{ flex: 1 }}>
            <StyledInput
              value={String(draft.heightFt || '')}
              onChangeText={(value) => setDraft({ ...draft, heightFt: value.replace(/[^0-9]/g, '') })}
              keyboardType="number-pad"
              placeholder="5"
            />
          </InputCard>
          <InputCard label="Height (in)" style={{ flex: 1 }}>
            <StyledInput
              value={String(draft.heightIn || '')}
              onChangeText={(value) => setDraft({ ...draft, heightIn: value.replace(/[^0-9]/g, '') })}
              keyboardType="number-pad"
              placeholder="9"
            />
          </InputCard>
        </View>

        <OptionChips
          title="Gender"
          options={GENDER_OPTIONS.map((item) => ({ label: item, value: item }))}
          value={draft.gender}
          onChange={(value) => setDraft({ ...draft, gender: value })}
          containerStyle={styles.chipsOnLight}
        />

        <OptionChips
          title="Primary goal"
          options={GOAL_OPTIONS.map((item) => ({ label: item, value: item }))}
          value={draft.goal}
          onChange={(value) => setDraft({ ...draft, goal: value })}
          containerStyle={styles.chipsOnLight}
        />

        <OptionChips
          title="Experience"
          options={['Beginner', 'Intermediate', 'Advanced'].map((item) => ({ label: item, value: item }))}
          value={draft.experience}
          onChange={(value) => setDraft({ ...draft, experience: value })}
          containerStyle={styles.chipsOnLight}
        />

        <InputCard label="Limitations or injuries">
          <StyledInput
            value={draft.limitations}
            onChangeText={(value) => setDraft({ ...draft, limitations: value })}
            placeholder="Example: sensitive knees, lower back tightness"
            multiline
            numberOfLines={4}
            inputStyle={{ minHeight: 96, textAlignVertical: 'top' }}
          />
        </InputCard>

        <Pressable style={styles.primaryAction} onPress={save} disabled={saving}>
          <Text style={styles.primaryActionText}>{saving ? 'Saving...' : 'Save Profile'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsScreen() {
  const { settings, setSettings } = useAppData();
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
    <SafeAreaView style={styles.lightScreen}>
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

        <InputCard label="OpenAI API Key">
          <StyledInput
            value={draft.openAIApiKey}
            onChangeText={(value) => setDraft({ ...draft, openAIApiKey: value.trim() })}
            placeholder="sk-..."
            secureTextEntry
          />
          <Text style={styles.helperText}>Your key stays on this device via AsyncStorage. No hidden secrets are bundled in the app.</Text>
        </InputCard>

        <InputCard label="Model">
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
              {OPENAI_MODELS.map((model) => (
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

function OptionChips({ title, options, value, onChange, containerStyle }) {
  return (
    <View style={[styles.optionBlock, containerStyle]}>
      <Text style={styles.optionTitle}>{title}</Text>
      <View style={styles.chipsWrap}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={String(option.value)}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => onChange(option.value)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function DropdownField({ label, value, options, onChange, containerStyle }) {
  const [modalVisible, setModalVisible] = useState(false);

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

function EmptyState({ icon, title, subtitle }) {
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

function MetricPill({ label, value }) {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function MetricPillLight({ label, value }) {
  return (
    <View style={styles.metricPillLight}>
      <Text style={styles.metricLabelLight}>{label}</Text>
      <Text style={styles.metricValueLight}>{value}</Text>
    </View>
  );
}

function InputCard({ label, children, style }) {
  return (
    <View style={[styles.inputCard, style]}>
      <Text style={styles.inputLabel}>{label}</Text>
      {children}
    </View>
  );
}

function StyledInput({ inputStyle, ...props }) {
  return <TextInput placeholderTextColor="#94A3B8" style={[styles.input, inputStyle]} {...props} />;
}

function DetailBadge({ label }) {
  return (
    <View style={styles.detailBadge}>
      <Text style={styles.detailBadgeText}>{label}</Text>
    </View>
  );
}

function SectionCard({ title, icon, children }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionCardHeader}>
        <MaterialIcons name={icon} size={20} color="#2563EB" />
        <Text style={styles.sectionCardTitle}>{title}</Text>
      </View>
      <View style={{ gap: 10 }}>{children}</View>
    </View>
  );
}

function SmallMeta({ text }) {
  return (
    <View style={styles.smallMeta}>
      <Text style={styles.smallMetaText}>{text}</Text>
    </View>
  );
}

function renderBullets(items) {
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

function renderNumbered(items) {
  if (!items || items.length === 0) {
    return <Text style={styles.fallbackText}>No exercises available.</Text>;
  }
  return items.map((item, index) => (
    <View key={index} style={styles.numberedRow}>
      <View style={styles.numberBubble}>
        <Text style={styles.numberBubbleText}>{index + 1}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.numberedTitle}>{item.name || 'Exercise'}</Text>
        <Text style={styles.numberedDetail}>{item.detail || ''}</Text>
      </View>
    </View>
  ));
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
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  eyebrow: {
    color: '#BFDBFE',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    marginTop: 10,
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
    marginTop: 18,
  },
  metricPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    padding: 12,
  },
  metricLabel: {
    color: '#BFDBFE',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
  panel: {
    marginTop: 8,
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
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 8,
  },
  generateSubtitle: {
    color: '#DBEAFE',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  secondaryPanel: {
    marginTop: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    padding: 16,
  },
  secondaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
  },
  secondaryCount: {
    color: '#2563EB',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontWeight: '800',
  },
  historyPreviewItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginTop: 10,
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
    borderRadius: 24,
    padding: 20,
  },
  detailsEyebrow: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  detailsTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 8,
  },
  detailsSubtitle: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  detailsBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  detailBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  detailBadgeText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    marginTop: 14,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionCardTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
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
  pageTitle: {
    color: '#0F172A',
    fontSize: 28,
    fontWeight: '800',
  },
  pageSubtitle: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
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
