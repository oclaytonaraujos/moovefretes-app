import React, { useState, memo } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { COLORS } from '../utils/constants';

interface CachedAvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  borderRadius?: number;
  style?: any;
}

/**
 * Avatar component with fast loading via Supabase image transforms.
 * Renders a thumbnail (60px) to avoid loading full-resolution images.
 * Falls back to an initial letter if the image fails or is unavailable.
 */
function CachedAvatarBase({ uri, name, size = 48, borderRadius = 12, style }: CachedAvatarProps) {
  const [error, setError] = useState(false);
  const initial = (name || 'E').charAt(0).toUpperCase();

  // Build optimized thumbnail URL from Supabase Storage
  const thumbUri = React.useMemo(() => {
    if (!uri) return undefined;
    // Already a full URL (Supabase storage)
    if (uri.startsWith('http')) {
      // Use Supabase image transform for smaller size
      if (uri.includes('supabase.co/storage')) {
        const sep = uri.includes('?') ? '&' : '?';
        return `${uri}${sep}width=${size * 2}&height=${size * 2}&resize=cover&quality=60`;
      }
      return uri;
    }
    // Path only — build the full URL
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (supabaseUrl) {
      return `${supabaseUrl}/storage/v1/object/public/avatars/${uri}?width=${size * 2}&height=${size * 2}&resize=cover&quality=60`;
    }
    return undefined;
  }, [uri, size]);

  const containerStyle = [
    styles.container,
    { width: size, height: size, borderRadius },
    style,
  ];

  if (!thumbUri || error) {
    return (
      <View style={containerStyle}>
        <Text style={[styles.initial, { fontSize: size * 0.44 }]}>{initial}</Text>
      </View>
    );
  }

  return (
    <View style={[containerStyle, { overflow: 'hidden' }]}>
      <Image
        source={{
          uri: thumbUri,
          cache: 'force-cache',
          headers: { 'Cache-Control': 'max-age=86400' },
        }}
        style={{ width: size, height: size }}
        onError={() => setError(true)}
        resizeMode="cover"
        fadeDuration={150}
      />
    </View>
  );
}

export const CachedAvatar = memo(CachedAvatarBase);

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: '#fff',
    fontWeight: '800',
  },
});
