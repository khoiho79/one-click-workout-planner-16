import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { calculateBMI } from '../lib/utils';

function OptionChips({ title, options, value, onChange, containerStyle, styles }) {
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

function MetricPillLight({ label, value, styles }) {
  return (
    <View style={styles.metricPillLight}>
      <Text style={styles.metricLabelLight}>{label}</Text>
      <Text style={styles.metricValueLight}>{value}</Text>
    </View>
  );
}

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

export default function ProfileForm({ profile, setProfile, history, styles, genderOptions, goalOptions }) {
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
    <SafeAreaView style={styles.lightScreen} edges={["top"]}>
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
            <MetricPillLight label="BMI" value={bmi || '--'} styles={styles} />
            <MetricPillLight label="Experience" value={draft.experience || '--'} styles={styles} />
          </View>
        </View>

        <InputCard label="Name" styles={styles}>
          <StyledInput value={draft.name} onChangeText={(value) => setDraft({ ...draft, name: value })} placeholder="Your name" styles={styles} />
        </InputCard>

        <View style={styles.doubleRow}>
          <InputCard label="Age" style={{ flex: 1 }} styles={styles}>
            <StyledInput
              value={String(draft.age || '')}
              onChangeText={(value) => setDraft({ ...draft, age: value.replace(/[^0-9]/g, '') })}
              keyboardType="number-pad"
              placeholder="32"
              styles={styles}
            />
          </InputCard>
          <InputCard label="Weight (lbs)" style={{ flex: 1 }} styles={styles}>
            <StyledInput
              value={String(draft.weightLbs || '')}
              onChangeText={(value) => setDraft({ ...draft, weightLbs: value.replace(/[^0-9.]/g, '') })}
              keyboardType="decimal-pad"
              placeholder="172"
              styles={styles}
            />
          </InputCard>
        </View>

        <View style={styles.tripleRow}>
          <InputCard label="Height (ft)" style={{ flex: 1 }} styles={styles}>
            <StyledInput
              value={String(draft.heightFt || '')}
              onChangeText={(value) => setDraft({ ...draft, heightFt: value.replace(/[^0-9]/g, '') })}
              keyboardType="number-pad"
              placeholder="5"
              styles={styles}
            />
          </InputCard>
          <InputCard label="Height (in)" style={{ flex: 1 }} styles={styles}>
            <StyledInput
              value={String(draft.heightIn || '')}
              onChangeText={(value) => setDraft({ ...draft, heightIn: value.replace(/[^0-9]/g, '') })}
              keyboardType="number-pad"
              placeholder="9"
              styles={styles}
            />
          </InputCard>
        </View>

        <OptionChips
          title="Gender"
          options={genderOptions.map((item) => ({ label: item, value: item }))}
          value={draft.gender}
          onChange={(value) => setDraft({ ...draft, gender: value })}
          containerStyle={styles.chipsOnLight}
          styles={styles}
        />

        <OptionChips
          title="Primary goal"
          options={goalOptions.map((item) => ({ label: item, value: item }))}
          value={draft.goal}
          onChange={(value) => setDraft({ ...draft, goal: value })}
          containerStyle={styles.chipsOnLight}
          styles={styles}
        />

        <OptionChips
          title="Experience"
          options={['Beginner', 'Intermediate', 'Advanced'].map((item) => ({ label: item, value: item }))}
          value={draft.experience}
          onChange={(value) => setDraft({ ...draft, experience: value })}
          containerStyle={styles.chipsOnLight}
          styles={styles}
        />

        <InputCard label="Limitations or injuries" styles={styles}>
          <StyledInput
            value={draft.limitations}
            onChangeText={(value) => setDraft({ ...draft, limitations: value })}
            placeholder="Example: sensitive knees, lower back tightness"
            multiline
            numberOfLines={4}
            inputStyle={{ minHeight: 96, textAlignVertical: 'top' }}
            styles={styles}
          />
        </InputCard>

        <Pressable style={styles.primaryAction} onPress={save} disabled={saving}>
          <Text style={styles.primaryActionText}>{saving ? 'Saving...' : 'Save Profile'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
