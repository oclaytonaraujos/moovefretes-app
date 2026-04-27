import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../contexts/AuthContext';
import { COLORS } from '../utils/constants';
import { navigationRef } from './navigationRef';

import { LoginScreen } from '../screens/auth/LoginScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { FreightsScreen } from '../screens/FreightsScreen';
import { FreightDetailScreen } from '../screens/FreightDetailScreen';
import { CreateFreightScreen } from '../screens/CreateFreightScreen';
import { DriversScreen } from '../screens/DriversScreen';
import { DriverDetailScreen } from '../screens/DriverDetailScreen';
import { ChatListScreen } from '../screens/ChatListScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function FreightsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FreightsList" component={FreightsScreen} />
      <Stack.Screen name="FreightDetail" component={FreightDetailScreen} />
      <Stack.Screen name="CreateFreight" component={CreateFreightScreen} />
    </Stack.Navigator>
  );
}

function DriversStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DriversList" component={DriversScreen} />
      <Stack.Screen name="DriverDetail" component={DriverDetailScreen} />
    </Stack.Navigator>
  );
}

function ChatStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ChatList" component={ChatListScreen} />
    </Stack.Navigator>
  );
}

const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  HomeTab:      { active: 'home',           inactive: 'home-outline' },
  FreightsTab:  { active: 'document-text',  inactive: 'document-text-outline' },
  DriversTab:   { active: 'people',         inactive: 'people-outline' },
  ChatTab:      { active: 'chatbubbles',    inactive: 'chatbubbles-outline' },
  ProfileTab:   { active: 'person',         inactive: 'person-outline' },
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: 4,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 0,
        },
        tabBarIcon: ({ focused, color }) => {
          const icon = TAB_ICONS[route.name];
          return (
            <Ionicons
              name={(focused ? icon?.active : icon?.inactive) as any}
              size={22}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen name="HomeTab"      component={HomeScreen}     options={{ title: 'Início' }} />
      <Tab.Screen name="FreightsTab"  component={FreightsStack}  options={{ title: 'Fretes' }} />
      <Tab.Screen name="DriversTab"   component={DriversStack}   options={{ title: 'Motoristas' }} />
      <Tab.Screen name="ChatTab"      component={ChatStack}      options={{ title: 'Chat' }} />
      <Tab.Screen name="ProfileTab"   component={ProfileScreen}  options={{ title: 'Perfil' }} />
    </Tab.Navigator>
  );
}

const linking = {
  prefixes: ['moovefretes://'],
  config: {
    screens: {
      Main: {
        screens: {
          FreightsTab: { screens: { FreightsList: 'fretes' } },
          ChatTab:     { screens: { ChatList: 'mensagens' } },
        },
      },
      Chat:          'chat/:conversationId',
      Notifications: 'notificacoes',
    },
  },
};

export function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking} ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Main"            component={MainTabs} />
            <Stack.Screen name="FreightDetail"   component={FreightDetailScreen} />
            <Stack.Screen name="CreateFreight"   component={CreateFreightScreen} />
            <Stack.Screen name="DriverDetail"    component={DriverDetailScreen} />
            <Stack.Screen name="Chat"            component={ChatScreen} />
            <Stack.Screen name="Notifications"   component={NotificationsScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
