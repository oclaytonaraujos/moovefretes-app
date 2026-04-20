import type { Freight, Profile } from './index';

export type RootStackParamList = {
  Main: undefined;
  Login: undefined;
  FreightDetail: { freight: Freight };
  CompanyDetail: { companyId: string };
  Chat: {
    conversationId?: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    source?: 'direct' | 'freight' | 'route';
    sourceId?: string;
    originCity?: string;
    originState?: string;
    destinationCity?: string;
    destinationState?: string;
    initialMessage?: string;
  };
  Notifications: undefined;
  ProfileTab: undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  FreightsTab: undefined;
  CompaniesTab: undefined;
  RoutesTab: undefined;
  ChatTab: undefined;
};

export type FreightsStackParamList = {
  FreightsList: undefined;
  FreightDetail: { freight: Freight };
};

export type CompaniesStackParamList = {
  CompaniesList: undefined;
  CompanyDetail: { companyId: string };
};

export type ChatStackParamList = {
  ChatList: undefined;
  Chat: RootStackParamList['Chat'];
};
