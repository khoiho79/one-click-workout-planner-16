import React from 'react';
import { Text } from 'react-native';

const glyphMap = {
  'fitness-center': '🏋️',
  history: '🕘',
  person: '👤',
  settings: '⚙️',
  circle: '●',
  'auto-awesome': '✨',
  'chevron-right': '›',
  info: 'ℹ️',
  'error-outline': '⚠️',
  'local-fire-department': '🔥',
  'self-improvement': '🧘',
  'tips-and-updates': '💡',
  favorite: '♥',
  'event-note': '📝',
  shield: '🛡️',
  'expand-more': '▾',
  close: '✕',
  'check-circle': '✔️',
  'radio-button-unchecked': '○',
  check: '✓',
};

export function MaterialIcons({ name, size = 18, color = '#000', style }) {
  return (
    <Text style={[{ fontSize: size, color, includeFontPadding: false, textAlignVertical: 'center' }, style]}>
      {glyphMap[name] || '•'}
    </Text>
  );
}
