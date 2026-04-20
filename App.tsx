import 'react-native-url-polyfill/auto';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Sentry from '@sentry/react-native';
import { AuthProvider } from './src/contexts/AuthContext';
import { AppNavigator } from './src/navigation';
import { useNotificationListeners } from './src/services/notifications';
import { navigate } from './src/navigation/navigationRef';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: __DEV__ ? 0 : 0.2,
  environment: __DEV__ ? 'development' : 'production',
  enabled: !__DEV__,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 2, retryDelay: 1_000 },
  },
});

function AppWithNotifications() {
  useNotificationListeners(
    () => {
      // foreground notification — expo-notifications already shows the alert
    },
    (response) => {
      const data = response.notification.request.content.data as any;
      if (data?.type === 'message' && data?.relatedId) {
        navigate('Chat', { conversationId: data.relatedId });
      } else if (data?.type === 'freight' && data?.relatedId) {
        navigate('FreightDetail', { id: data.relatedId });
      } else {
        navigate('Notifications');
      }
    },
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="auto" />
            <AppNavigator />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function App() {
  return <AppWithNotifications />;
}

export default Sentry.wrap(App);
