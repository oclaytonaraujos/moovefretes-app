import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(userId: string): Promise<void> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId: 'c7959cbc-4095-4955-a1ee-4a27a9a70bbe',
  });
  if (!token) return;

  await supabase
    .from('drivers')
    .update({ push_token: token, push_token_updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Geral',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#253663',
    });
    await Notifications.setNotificationChannelAsync('fretes', {
      name: 'Novos Fretes',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#253663',
    });
    await Notifications.setNotificationChannelAsync('mensagens', {
      name: 'Mensagens',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#253663',
    });
  }
}

export function useNotificationListeners(
  onNotification: (n: Notifications.Notification) => void,
  onResponse: (r: Notifications.NotificationResponse) => void,
) {
  const onNotifRef = useRef(onNotification);
  const onResponseRef = useRef(onResponse);

  useEffect(() => { onNotifRef.current = onNotification; });
  useEffect(() => { onResponseRef.current = onResponse; });

  useEffect(() => {
    const notifSub = Notifications.addNotificationReceivedListener(n => onNotifRef.current(n));
    const responseSub = Notifications.addNotificationResponseReceivedListener(r => onResponseRef.current(r));
    return () => {
      notifSub.remove();
      responseSub.remove();
    };
  }, []);
}
