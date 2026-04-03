import { LOCAL_EXERCISE_LIBRARY } from './constants';

function safeNumber(value, fallback) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeFocus(focus) {
  if (Array.isArray(focus) && focus.length > 0) {
    return focus[0];
  }
  return focus || 'Full Body';
}

function getHistoryItems(historySummary) {
  return Array.isArray(historySummary) ? historySummary : [];
}

function hasLimitations(profile) {
  return Boolean((profile.limitations || '').trim());
}

function getGoalStyle(goal) {
  switch (goal) {
    case 'Lose Weight':
      return 'circuit';
    case 'Build Muscle':
      return 'hypertrophy';
    case 'Increase Strength':
      return 'strength';
    case 'Boost Endurance':
      return 'endurance';
    case 'Stay Consistent':
      return 'steady';
    case 'Improve Fitness':
    default:
      return 'balanced';
  }
}

function getRecentExerciseNames(history) {
  const names = [];
  history.slice(0, 6).forEach((item) => {
    const main = item?.plan?.main || [];
    main.forEach((entry) => {
      if (entry?.name) {
        names.push(String(entry.name).toLowerCase());
      }
    });
  });
  return names;
}

function scoreExercise(exercise, context) {
  const {
    environment,
    equipment,
    intensity,
    focus,
    goal,
    lowImpact,
    recentExerciseNames,
    recentFocuses,
  } = context;

  let score = 0;

  if ((exercise.focuses || []).includes(focus)) score += 5;
  if (focus === 'Full Body' && (exercise.focuses || []).includes('Full Body')) score += 2;
  if ((exercise.environments || []).includes(environment)) score += 4;
  if ((exercise.equipment || []).includes(equipment)) score += 5;
  if ((exercise.intensity || []).includes(intensity)) score += 3;
  if ((exercise.goals || []).includes(goal)) score += 3;

  if (equipment === 'Bodyweight' && (exercise.equipment || []).includes('Bodyweight')) score += 2;
  if (equipment === 'Full Gym' && (exercise.equipment || []).includes('Full Gym')) score += 2;
  if (environment === 'Outdoor' && (exercise.environments || []).includes('Outdoor')) score += 2;

  if (lowImpact) {
    if ((exercise.impacts || []).includes('low')) score += 3;
    if ((exercise.impacts || []).includes('high')) score -= 5;
  } else if (intensity === 'High' && (exercise.impacts || []).includes('high')) {
    score += 2;
  }

  const lowerName = exercise.name.toLowerCase();
  const repeatCount = recentExerciseNames.filter((item) => item === lowerName).length;
  score -= repeatCount * 4;

  const recentSameFocusCount = recentFocuses.filter((item) => item === focus).length;
  if (recentSameFocusCount >= 2 && !(exercise.focuses || []).includes(focus)) {
    score -= 2;
  }

  return score;
}

function buildWarmup({ duration, environment, focus, lowImpact, intensity }) {
  const items = [];

  if (environment === 'Outdoor') {
    items.push(duration >= 30 ? '3 minutes brisk walking to gradually raise heart rate' : '2 minutes brisk walking to gradually raise heart rate');
  } else {
    items.push(duration >= 30 ? '2 minutes easy marching, step taps, or light cycling in place' : '90 seconds easy marching or step taps');
  }

  if (focus === 'Upper Body') {
    items.push('Arm circles, shoulder rolls, and band or towel pull-aparts for 60 seconds');
    items.push('World’s greatest stretch and thoracic rotations for 60 seconds');
  } else if (focus === 'Lower Body') {
    items.push('Hip circles, bodyweight good mornings, and ankle mobility for 60 seconds');
    items.push('Dynamic lunges and leg swings for 60 seconds');
  } else if (focus === 'Core') {
    items.push('Cat-cow, bird dog reaches, and dead bug patterning for 90 seconds');
    items.push('Hip openers and trunk rotations for 60 seconds');
  } else if (focus === 'Cardio') {
    items.push(lowImpact ? 'Step jacks and marching knee lifts for 90 seconds' : 'Jump rope simulation or jumping jacks for 90 seconds');
    items.push('Dynamic hamstring sweeps and quad pulls for 60 seconds');
  } else {
    items.push('Arm circles, hip circles, and shoulder rolls for 60 seconds');
    items.push('Dynamic leg swings and squat-to-stand mobility for 60 seconds');
  }

  if (intensity === 'High') {
    items.push(lowImpact ? '1 short ramp-up round of fast marching and quick step taps' : '1 short ramp-up round of high knees and quick bodyweight squats');
  }

  return items;
}

function buildCooldown({ focus, environment }) {
  const items = ['Slow breathing for 60 seconds'];

  if (focus === 'Upper Body') {
    items.push('Chest, shoulder, and upper-back stretches for 2-3 minutes');
  } else if (focus === 'Lower Body') {
    items.push('Hamstring, quad, calf, and hip flexor stretches for 2-3 minutes');
  } else if (focus === 'Core') {
    items.push('Child’s pose, trunk rotations, and hip stretches for 2-3 minutes');
  } else if (focus === 'Cardio') {
    items.push(environment === 'Outdoor' ? 'Easy walk to bring heart rate down for 2 minutes' : 'Easy pace movement for 2 minutes before stretching');
    items.push('Calf, quad, and chest stretches for 2 minutes');
  } else {
    items.push('Hamstring, quad, chest, and shoulder stretches for 3-4 minutes');
  }

  items.push('Hydrate and note how the session felt so the next plan can adapt.');
  return items;
}

function getExerciseDetail(exercise, context, index) {
  const { duration, intensity, goalStyle, beginner, lowImpact } = context;
  const isConditioning = exercise.category === 'conditioning';
  const isCore = exercise.category === 'core';

  if (goalStyle === 'strength') {
    if (isConditioning) {
      return intensity === 'High' ? '4 rounds of 30 seconds hard, 30 seconds easy' : '3 rounds of 30-40 seconds with steady effort';
    }
    if (beginner) {
      return isCore ? '3 sets of 8-10 controlled reps or 20-25 seconds' : '3 sets of 8-10 reps with 60-75 seconds rest';
    }
    return isCore ? '3-4 sets of 10-12 controlled reps or 30-40 seconds' : '4 sets of 5-8 reps with 75-90 seconds rest';
  }

  if (goalStyle === 'hypertrophy') {
    if (isConditioning) {
      return '3 rounds of 30-40 seconds at a challenging pace between strength sets';
    }
    return beginner ? '3 sets of 10-12 reps with controlled tempo' : '3-4 sets of 8-12 reps with slow lowering';
  }

  if (goalStyle === 'endurance') {
    if (isConditioning) {
      return duration >= 45 ? '4-5 rounds of 45 seconds work, 20 seconds recovery' : '3-4 rounds of 40 seconds work, 20 seconds recovery';
    }
    return isCore ? '3 rounds of 30-40 seconds continuous control' : '2-3 sets of 12-15 reps with short rest';
  }

  if (goalStyle === 'circuit') {
    if (isConditioning) {
      return intensity === 'High' ? '40 seconds on, 20 seconds off for 3-4 rounds' : '35 seconds on, 25 seconds off for 3 rounds';
    }
    return beginner ? '35 seconds of work, then 25 seconds rest for 2-3 rounds' : '40 seconds of work, then 20 seconds rest for 3 rounds';
  }

  if (goalStyle === 'steady') {
    if (isConditioning) {
      return lowImpact ? '3 rounds of 30-40 seconds at a smooth low-impact pace' : '3 rounds of 35-40 seconds at a comfortable pace';
    }
    return '2-3 sets of 10-12 reps with smooth controlled form';
  }

  if (isConditioning) {
    return intensity === 'High' ? '4 rounds of 35 seconds work, 20 seconds rest' : '3 rounds of 30-40 seconds with steady effort';
  }

  if (duration <= 20) {
    return index % 2 === 0 ? '2-3 sets of 10-12 reps' : '2-3 rounds of 25-30 seconds';
  }

  return isCore ? '3 sets of 10 reps per side or 30 seconds' : '3 sets of 10-15 reps';
}

function shuffleByContext(items, seedParts) {
  const seed = seedParts.join('|');
  return [...items].sort((a, b) => {
    const aValue = (a.name + seed).split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const bValue = (b.name + seed).split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    return aValue - bValue;
  });
}

function pickExercises(context) {
  const {
    duration,
    focus,
    environment,
    equipment,
    intensity,
    profile,
    history,
  } = context;

  const age = safeNumber(profile.age, 30);
  const lowImpact = age > 55 || hasLimitations(profile) || intensity === 'Low';
  const recentExerciseNames = getRecentExerciseNames(history);
  const recentFocuses = history.slice(0, 4).map((item) => item.focus || '');

  let eligible = LOCAL_EXERCISE_LIBRARY.filter((exercise) => {
    const equipmentMatch = (exercise.equipment || []).includes(equipment) || (equipment === 'Full Gym' && (exercise.equipment || []).includes('Dumbbells'));
    const environmentMatch = (exercise.environments || []).includes(environment) || (environment === 'Gym' && (exercise.environments || []).includes('Home'));
    const intensityMatch = (exercise.intensity || []).includes(intensity) || (intensity === 'Moderate' && (exercise.intensity || []).includes('Low'));
    const focusMatch = (exercise.focuses || []).includes(focus) || (focus === 'Full Body' && ['Upper Body', 'Lower Body', 'Core'].some((item) => (exercise.focuses || []).includes(item)));
    if (!equipmentMatch || !environmentMatch || !intensityMatch || !focusMatch) {
      return false;
    }
    if (lowImpact && (exercise.impacts || []).includes('high')) {
      return false;
    }
    return true;
  });

  if (eligible.length < 4) {
    eligible = LOCAL_EXERCISE_LIBRARY.filter((exercise) => {
      const equipmentMatch = (exercise.equipment || []).includes(equipment) || (exercise.equipment || []).includes('Bodyweight');
      const focusMatch = (exercise.focuses || []).includes(focus) || (focus === 'Full Body' && (exercise.focuses || []).includes('Full Body'));
      return equipmentMatch && focusMatch;
    });
  }

  const scored = eligible
    .map((exercise) => ({
      exercise,
      score: scoreExercise(exercise, {
        environment,
        equipment,
        intensity,
        focus,
        goal: profile.goal,
        lowImpact,
        recentExerciseNames,
        recentFocuses,
      }),
    }))
    .sort((a, b) => b.score - a.score);

  const targetCount = duration <= 20 ? 4 : duration <= 30 ? 5 : duration <= 45 ? 6 : 7;
  const chosen = [];
  const usedCategories = {};
  const ordered = shuffleByContext(scored, [duration, environment, equipment, intensity, focus, profile.goal, history.length]);

  for (let i = 0; i < ordered.length; i++) {
    const item = ordered[i].exercise;
    const category = item.category || 'other';
    const alreadyUsed = chosen.some((entry) => entry.name === item.name);
    if (alreadyUsed) continue;

    if (focus === 'Cardio') {
      if (category === 'conditioning' || chosen.length < 2) {
        chosen.push(item);
      }
    } else if (focus === 'Core') {
      if (category === 'core' || category === 'conditioning' || chosen.length < 2) {
        chosen.push(item);
      }
    } else {
      const categoryCount = usedCategories[category] || 0;
      if (categoryCount < 3) {
        chosen.push(item);
        usedCategories[category] = categoryCount + 1;
      }
    }

    if (chosen.length >= targetCount) break;
  }

  if (chosen.length < targetCount) {
    scored.forEach((item) => {
      if (chosen.length >= targetCount) return;
      if (!chosen.some((entry) => entry.name === item.exercise.name)) {
        chosen.push(item.exercise);
      }
    });
  }

  return chosen.slice(0, targetCount);
}

export function formatDurationLabel(duration) {
  return `${duration}-minute`;
}

export function buildPrompt({ profile, duration, environment, intensity, equipment, focus, historySummary }) {
  const heightLabel = profile.heightFt ? `${profile.heightFt} ft${profile.heightIn ? ` ${profile.heightIn} in` : ''}` : 'not provided';
  return `Create a safe personalized workout plan in plain text for a mobile fitness app. Use US units where relevant. User profile: name ${profile.name || 'User'}, age ${profile.age}, gender ${profile.gender || 'not provided'}, weight ${profile.weightLbs} lbs, height ${heightLabel}, goal ${profile.goal}, experience ${profile.experience}, limitations ${profile.limitations || 'none'}. Today's request: ${duration} minutes, environment ${environment}, intensity ${intensity}, equipment ${equipment}, focus ${Array.isArray(focus) ? focus.join(', ') : focus}. Workout history summary: ${historySummary}. Return with these section labels exactly: TITLE:, SUMMARY:, WARMUP:, MAIN:, COOLDOWN:, TIPS:. In MAIN, provide numbered exercises with sets/reps or timing. Keep it concise, practical, and safe. Avoid medical claims.`;
}

export async function callOpenAI({ apiKey, model, prompt }) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert fitness coach creating safe, concise mobile-friendly workout plans.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || 'OpenAI request failed.');
  }

  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('No workout plan returned from AI.');
  }

  return text;
}

export function buildFallbackPlan({ profile, duration, environment, intensity, equipment, focus, historySummary }) {
  const age = safeNumber(profile.age, 30);
  const beginner = (profile.experience || '').toLowerCase() === 'beginner';
  const lowImpact = age > 55 || hasLimitations(profile) || intensity === 'Low';
  const focusLabel = Array.isArray(focus) && focus.length > 0 ? focus.join(' + ') : focus;
  const primaryFocus = normalizeFocus(focus);
  const history = getHistoryItems(historySummary);
  const goalStyle = getGoalStyle(profile.goal);

  const warmup = buildWarmup({ duration, environment, focus: primaryFocus, lowImpact, intensity });
  const selectedExercises = pickExercises({
    duration,
    focus: primaryFocus,
    environment,
    equipment,
    intensity,
    profile,
    history,
  });

  const exercises = selectedExercises.map((exercise, index) => [
    exercise.name,
    getExerciseDetail(exercise, { duration, intensity, goalStyle, beginner, lowImpact }, index),
  ]);

  if (duration >= 45) {
    if (primaryFocus === 'Cardio') {
      exercises.push([
        'Extended finisher',
        intensity === 'High' ? '6 minutes alternating hard efforts and recovery pace' : '5-6 minutes of steady cardio at controlled effort',
      ]);
    } else if (goalStyle === 'strength' || goalStyle === 'hypertrophy') {
      exercises.push([
        'Accessory finisher',
        '2 rounds of 8-12 quality reps on your two weakest movement patterns with full control',
      ]);
    } else {
      exercises.push([
        'Conditioning finisher',
        lowImpact ? '4 minutes of step jacks, marching, and squat reaches' : '4-5 minutes of squats, mountain climbers, and shadow boxing',
      ]);
    }
  }

  const cooldown = buildCooldown({ focus: primaryFocus, environment });

  const tips = [
    `Keep effort ${intensity.toLowerCase()} and maintain good form throughout.`,
    equipment === 'Bodyweight' ? 'Use tempo, pauses, or extra rounds to make bodyweight work more challenging.' : `Use ${equipment.toLowerCase()} with a load that matches the target effort for today.`,
    lowImpact ? 'Stay with low-impact variations if your joints or limitations need it.' : 'Rest 30-75 seconds between sets depending on the movement and intensity.',
  ];

  if (history.length > 0) {
    tips.push('This local plan rotates away from your most recent exercises to reduce repeats over time.');
  }

  const summaryParts = [
    `A ${intensity.toLowerCase()} ${String(focusLabel).toLowerCase()} workout for ${environment.toLowerCase()} training`,
    `aligned with your goal of ${String(profile.goal || 'general fitness').toLowerCase()}`,
  ];

  if (equipment) {
    summaryParts.push(`using ${equipment.toLowerCase()}`);
  }

  return `TITLE: ${focusLabel} ${duration}-Minute Workout\nSUMMARY: ${summaryParts.join(', ')}.\nWARMUP:\n- ${warmup.join('\n- ')}\nMAIN:\n${exercises.map((item, idx) => `${idx + 1}. ${item[0]} - ${item[1]}`).join('\n')}\nCOOLDOWN:\n- ${cooldown.join('\n- ')}\nTIPS:\n- ${tips.join('\n- ')}`;
}

export function parseWorkoutPlan(text, fallbackMeta) {
  const getSection = (label, nextLabels) => {
    const regex = new RegExp(`${label}:([\\s\\S]*?)(?:${nextLabels.map((l) => l + ':').join('|')}|$)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  };

  const title = (text.match(/TITLE:(.*)/i) || [])[1]?.trim() || fallbackMeta.title || 'Workout Plan';
  const summary = (text.match(/SUMMARY:(.*)/i) || [])[1]?.trim() || `A ${fallbackMeta.intensity.toLowerCase()} workout for ${fallbackMeta.duration} minutes.`;
  const warmupRaw = getSection('WARMUP', ['MAIN', 'COOLDOWN', 'TIPS']);
  const mainRaw = getSection('MAIN', ['COOLDOWN', 'TIPS']);
  const cooldownRaw = getSection('COOLDOWN', ['TIPS']);
  const tipsRaw = getSection('TIPS', []);

  const toBullets = (value) =>
    value
      .split('\n')
      .map((line) => line.replace(/^[-•]\s*/, '').trim())
      .filter(Boolean);

  const main = mainRaw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^\d+[.)]\s*/, ''))
    .map((line) => {
      const [name, ...rest] = line.split(' - ');
      return {
        name: name.trim(),
        detail: rest.join(' - ').trim() || 'Perform with control and proper form.',
      };
    });

  return {
    title,
    summary,
    warmup: toBullets(warmupRaw),
    main,
    cooldown: toBullets(cooldownRaw),
    tips: toBullets(tipsRaw),
    raw: text,
  };
}
