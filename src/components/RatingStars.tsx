import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';

interface RatingStarsProps {
  rating: number;
  reviewCount?: number;
  size?: number;
  showCount?: boolean;
}

export function RatingStars({ rating, reviewCount, size = 14, showCount = true }: RatingStarsProps) {
  const stars = [1, 2, 3, 4, 5];
  const color = rating >= 4.5 ? COLORS.gold : rating >= 3.5 ? COLORS.orange : COLORS.textLight;

  return (
    <View style={styles.container}>
      <View style={styles.stars}>
        {stars.map(s => {
          const filled = s <= Math.floor(rating);
          const half = !filled && s <= rating + 0.5;
          return (
            <Ionicons
              key={s}
              name={filled ? 'star' : half ? 'star-half' : 'star-outline'}
              size={size}
              color={color}
            />
          );
        })}
      </View>
      <Text style={[styles.ratingText, { fontSize: size, color }]}>
        {rating.toFixed(1)}
      </Text>
      {showCount && reviewCount !== undefined && (
        <Text style={[styles.countText, { fontSize: size - 2 }]}>
          ({reviewCount})
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  stars: {
    flexDirection: 'row',
    gap: 1,
  },
  ratingText: {
    fontWeight: '700',
    marginLeft: 2,
  },
  countText: {
    color: COLORS.textSecondary,
  },
});
