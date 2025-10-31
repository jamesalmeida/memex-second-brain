import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';

export interface Badge {
  label: string;
  icon?: string;
  backgroundColor?: string;
  textColor?: string;
  show: boolean;
}

interface MetadataBadgesProps {
  badges: Badge[];
  style?: ViewStyle;
}

const MetadataBadges: React.FC<MetadataBadgesProps> = ({ badges, style }) => {
  const visibleBadges = badges.filter(badge => badge.show);

  if (visibleBadges.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      {visibleBadges.map((badge, index) => (
        <View
          key={index}
          style={[
            styles.badge,
            badge.backgroundColor && { backgroundColor: badge.backgroundColor },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              badge.textColor && { color: badge.textColor },
            ]}
          >
            {badge.icon && `${badge.icon} `}{badge.label}
          </Text>
        </View>
      ))}
    </View>
  );
};

export default MetadataBadges;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#FFF3CD',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#856404',
  },
});
