# MooveFretes - App do Motorista

App React Native (Expo) exclusivo para motoristas.

## Pré-requisitos

- Node.js 18+
- npm ou yarn
- Expo CLI: `npm install -g expo-cli`
- Expo Go no celular (para testar) OU Android Studio/Xcode

## Instalação

```bash
cd app
npm install
```

## Executar

```bash
# Iniciar servidor de desenvolvimento
npm start

# Android
npm run android

# iOS
npm run ios
```

## Estrutura

```
src/
├── contexts/       AuthContext (autenticação + estado do motorista)
├── lib/            supabase.ts (cliente Supabase)
├── navigation/     Navegação entre telas
├── screens/
│   ├── auth/       LoginScreen
│   ├── HomeScreen          Painel principal
│   ├── FreightsScreen      Fretes disponíveis e meus fretes
│   ├── FreightDetailScreen Detalhes e ações do frete
│   ├── RoutesScreen        Rotas preferidas
│   ├── ChatListScreen      Lista de conversas
│   ├── ChatScreen          Chat individual
│   └── ProfileScreen       Perfil e configurações
├── components/
│   ├── AvailabilityToggle  Toggle disponível/ocupado/offline
│   ├── FreightCard         Card de frete
│   ├── StatusBadge         Badge de status
│   └── RatingStars         Estrelas de avaliação
├── types/          Tipos TypeScript
└── utils/
    ├── constants.ts  Cores, opções de veículos/carroc.
    └── helpers.ts    Funções utilitárias
```

## Funcionalidades

- Login com e-mail/senha (Supabase Auth)
- Painel com status de disponibilidade (disponível/ocupado/offline)
- Browse de fretes disponíveis com aceite direto
- Acompanhamento de fretes em andamento (iniciar/concluir viagem)
- Gerenciamento de rotas preferidas
- Chat em tempo real com embarcadores e transportadoras
- Perfil completo com dados do veículo e documentação
- Atualização de localização
```
