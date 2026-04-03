export function createId() {
  return String(Date.now()) + '_' + Math.random().toString(36).slice(2, 10);
}

export function poundsToKg(weightLbs) {
  const weight = parseFloat(weightLbs);
  if (!weight) return '';
  return (weight * 0.45359237).toFixed(1);
}

export function feetInchesToCm(heightFt, heightIn) {
  const feet = parseFloat(heightFt);
  const inches = parseFloat(heightIn || 0);
  if (!feet && !inches) return '';
  return (((feet || 0) * 12 + (inches || 0)) * 2.54).toFixed(1);
}

export function calculateBMI(weightLbs, heightFt, heightIn) {
  const weightKg = parseFloat(poundsToKg(weightLbs));
  const heightCm = parseFloat(feetInchesToCm(heightFt, heightIn));
  if (!weightKg || !heightCm) return '';
  const meters = heightCm / 100;
  const bmi = weightKg / (meters * meters);
  return bmi.toFixed(1);
}

export function minutesToLabel(minutes) {
  return minutes + ' min';
}

export function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function summarizeHistoryForPrompt(history) {
  if (!history || history.length === 0) {
    return 'No prior workout history.';
  }
  return history
    .slice(0, 6)
    .map((item) => `${item.focus || item.plan?.title || 'Workout'} for ${item.duration} minutes in ${item.environment} at ${item.intensity} intensity on ${new Date(item.createdAt).toDateString()}`)
    .join('; ');
}

export function getHistoryPlannerContext(history) {
  if (!history || history.length === 0) {
    return [];
  }

  return history.slice(0, 8).map((item) => ({
    id: item.id,
    createdAt: item.createdAt,
    duration: item.duration,
    environment: item.environment,
    intensity: item.intensity,
    equipment: item.equipment,
    focus: item.focus,
    source: item.source,
    plan: {
      title: item.plan?.title,
      main: Array.isArray(item.plan?.main)
        ? item.plan.main.map((exercise) => ({
            name: exercise.name,
            detail: exercise.detail,
          }))
        : [],
    },
  }));
}

export function getStreakDays(history) {
  if (!history || history.length === 0) return 0;
  const uniqueDays = [...new Set(history.map((item) => new Date(item.createdAt).toDateString()))]
    .map((day) => new Date(day).getTime())
    .sort((a, b) => b - a);

  let streak = 0;
  const today = new Date();
  let compare = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  for (let i = 0; i < uniqueDays.length; i++) {
    if (uniqueDays[i] === compare) {
      streak += 1;
      compare -= 24 * 60 * 60 * 1000;
    } else if (i === 0 && uniqueDays[i] === compare - 24 * 60 * 60 * 1000) {
      streak += 1;
      compare -= 2 * 24 * 60 * 60 * 1000;
    } else {
      break;
    }
  }

  return streak;
}
