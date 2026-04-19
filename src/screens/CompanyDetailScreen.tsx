import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Linking, Alert, Vibration,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { COLORS } from '../utils/constants';
import { mapSupabaseFreight, fetchPublisherProfiles, formatPhone, getTimeAgo } from '../utils/helpers';
import { CachedAvatar } from '../components/CachedAvatar';
import { FreightCard } from '../components/FreightCard';
import { TYPE_LABELS, TYPE_COLORS } from './CompaniesScreen';
import type { Company, CompanyRating, Freight } from '../types';

const FAVORITES_KEY = 'favorites_companies';
type Tab = 'overview' | 'freights' | 'ratings' | 'about';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Visão Geral' },
  { key: 'freights', label: 'Fretes' },
  { key: 'ratings', label: 'Avaliações' },
  { key: 'about', label: 'Sobre' },
];

export function CompanyDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const company: Company = route.params?.company;

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [freights, setFreights] = useState<Freight[]>([]);
  const [ratings, setRatings] = useState<CompanyRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(FAVORITES_KEY).then(stored => {
      if (stored) setIsFavorite((JSON.parse(stored) as string[]).includes(company.id));
    }).catch(() => {});
  }, [company.id]);

  const toggleFavorite = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(FAVORITES_KEY);
      const favs: string[] = stored ? JSON.parse(stored) : [];
      const next = favs.includes(company.id) ? favs.filter(id => id !== company.id) : [...favs, company.id];
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      setIsFavorite(!isFavorite);
    } catch {}
  }, [company.id, isFavorite]);

  const loadDetails = useCallback(async () => {
    try {
      const [freightsRes, ratingsRes] = await Promise.all([
        supabase.from('freights').select('*').eq('publisher_id', company.user_id).eq('status', 'active').order('created_at', { ascending: false }).limit(20),
        supabase.from('ratings').select('*').eq('target_id', company.user_id).order('created_at', { ascending: false }).limit(50),
      ]);

      if (freightsRes.data?.length) {
        const profiles = await fetchPublisherProfiles(supabase, freightsRes.data);
        setFreights(freightsRes.data.map(row => mapSupabaseFreight(row, profiles.get(row.publisher_id))));
      }

      setRatings((ratingsRes.data || []).map((r: any): CompanyRating => ({
        id: r.id,
        evaluator_id: r.evaluator_id,
        evaluator_name: r.evaluator_name || undefined,
        evaluator_type: r.evaluator_type || undefined,
        overall_rating: r.overall_rating || 0,
        punctuality_rating: r.punctuality_rating || undefined,
        communication_rating: r.communication_rating || undefined,
        professionalism_rating: r.professionalism_rating || undefined,
        comment: r.comment || undefined,
        created_at: r.created_at,
      })));
    } finally {
      setLoading(false);
    }
  }, [company.user_id]);

  useEffect(() => { loadDetails(); }, [loadDetails]);

  const avgRating = ratings.length > 0
    ? ratings.reduce((s, r) => s + r.overall_rating, 0) / ratings.length
    : company.rating || 0;

  const typeColor = TYPE_COLORS[company.company_type] || COLORS.primary;
  const typeLabel = TYPE_LABELS[company.company_type] || company.company_type;

  function handleWhatsApp() {
    if (!company.phone) { Alert.alert('Telefone não disponível'); return; }
    Vibration.vibrate(40);
    Linking.openURL(`https://wa.me/55${company.phone.replace(/\D/g, '')}`);
  }

  function handleCall() {
    if (!company.phone) { Alert.alert('Telefone não disponível'); return; }
    Vibration.vibrate(40);
    Linking.openURL(`tel:${company.phone}`);
  }

  function handleChat() {
    Vibration.vibrate(40);
    navigation.navigate('Chat', { userId: company.user_id, userName: company.name, userAvatar: company.logo });
  }

  return (
    <View style={styles.flex}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{company.name}</Text>
          <View style={[styles.typePill, { backgroundColor: typeColor + '35' }]}>
            <Text style={styles.typePillText}>{typeLabel}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={toggleFavorite}>
          <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={22} color={isFavorite ? '#f87171' : '#fff'} />
        </TouchableOpacity>
      </View>



      {/* Tabs */}
      <View style={styles.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ flex: 1 }} />
      ) : (
        <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {activeTab === 'overview' && (
            <OverviewTab company={company} avgRating={avgRating} ratingCount={ratings.length} />
          )}
          {activeTab === 'freights' && (
            <FreightsTab
              freights={freights}
              onFreightPress={f => navigation.navigate('FreightDetail', { freight: f })}
            />
          )}
          {activeTab === 'ratings' && (
            <RatingsTab ratings={ratings} avgRating={avgRating} />
          )}
          {activeTab === 'about' && (
            <AboutTab company={company} ratingCount={ratings.length} />
          )}
        </ScrollView>
      )}

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.chatBtn} onPress={handleChat}>
          <Ionicons name="chatbubble-outline" size={15} color={COLORS.primary} />
          <Text style={styles.chatBtnText}>Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.chatBtn} onPress={handleCall}>
          <Ionicons name="call-outline" size={15} color={COLORS.primary} />
          <Text style={styles.chatBtnText}>Ligar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.whatsappBtn} onPress={handleWhatsApp}>
          <Ionicons name="logo-whatsapp" size={15} color="#fff" />
          <Text style={styles.whatsappBtnText}>Enviar Mensagem</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}



// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ company, avgRating, ratingCount }: { company: Company; avgRating: number; ratingCount: number }) {
  return (
    <>
      <View style={ovStyles.card}>
        <View style={ovStyles.avatarRow}>
          <CachedAvatar uri={company.logo} name={company.name} size={60} borderRadius={12} />
          <View style={ovStyles.info}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={ovStyles.name}>{company.name}</Text>
              {company.verified && <Ionicons name="checkmark-circle" size={15} color={COLORS.info} />}
            </View>
            {(company.city || company.state) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="location-outline" size={12} color={COLORS.textSecondary} />
                <Text style={ovStyles.sub}>{[company.city, company.state].filter(Boolean).join(', ')}</Text>
              </View>
            )}
            {avgRating > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Stars rating={avgRating} size={12} />
                <Text style={ovStyles.ratingTxt}>{avgRating.toFixed(1)} ({ratingCount})</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={ovStyles.statsRow}>
        <StatCard icon="document-text" color={COLORS.available} value={String(company.active_freights || 0)} label="Ativos" />
        <StatCard icon="checkmark-circle" color={COLORS.primary} value={String(company.completed_freights || 0)} label="Concluídos" />
        <StatCard icon="star" color={COLORS.gold} value={avgRating > 0 ? avgRating.toFixed(1) : '-'} label="Avaliação" />
      </View>

      <View style={ovStyles.infoCard}>
        <Text style={ovStyles.infoTitle}>Informações de Contato</Text>
        {company.phone && <InfoRow icon="call-outline" label="Telefone" value={formatPhone(company.phone)} />}
        {company.email && <InfoRow icon="mail-outline" label="E-mail" value={company.email} />}
        {company.cnpj && <InfoRow icon="card-outline" label="CNPJ" value={company.cnpj} />}
        {company.website && <InfoRow icon="globe-outline" label="Site" value={company.website} />}
        {!company.phone && !company.email && !company.cnpj && (
          <Text style={ovStyles.noInfo}>Sem informações de contato disponíveis</Text>
        )}
      </View>
    </>
  );
}

function StatCard({ icon, color, value, label }: { icon: string; color: string; value: string; label: string }) {
  return (
    <View style={ovStyles.statCard}>
      <View style={[ovStyles.statIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={ovStyles.statValue}>{value}</Text>
      <Text style={ovStyles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={ovStyles.infoRow}>
      <Ionicons name={icon as any} size={15} color={COLORS.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={ovStyles.infoLabel}>{label}</Text>
        <Text style={ovStyles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Freights Tab ─────────────────────────────────────────────────────────────

function FreightsTab({ freights, onFreightPress }: { freights: Freight[]; onFreightPress: (f: Freight) => void }) {
  if (freights.length === 0) {
    return (
      <View style={emptyStyles.wrap}>
        <Ionicons name="document-text-outline" size={48} color={COLORS.textLight} />
        <Text style={emptyStyles.title}>Nenhum frete ativo</Text>
        <Text style={emptyStyles.desc}>Esta empresa não possui fretes disponíveis no momento.</Text>
      </View>
    );
  }
  return (
    <View style={{ gap: 12 }}>
      {freights.map(f => (
        <FreightCard key={f.id} freight={f} onPress={() => onFreightPress(f)} showActions={false} />
      ))}
    </View>
  );
}

// ─── Ratings Tab ──────────────────────────────────────────────────────────────

function RatingsTab({ ratings, avgRating }: { ratings: CompanyRating[]; avgRating: number }) {
  if (ratings.length === 0) {
    return (
      <View style={emptyStyles.wrap}>
        <Ionicons name="star-outline" size={48} color={COLORS.textLight} />
        <Text style={emptyStyles.title}>Nenhuma avaliação</Text>
        <Text style={emptyStyles.desc}>Esta empresa ainda não recebeu avaliações.</Text>
      </View>
    );
  }

  const dist = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: ratings.filter(r => Math.round(r.overall_rating) === star).length,
  }));

  return (
    <View style={{ gap: 12 }}>
      <View style={ratStyles.summary}>
        <View style={ratStyles.summaryLeft}>
          <Text style={ratStyles.avgNum}>{avgRating.toFixed(1)}</Text>
          <Stars rating={avgRating} size={14} />
          <Text style={ratStyles.totalCount}>{ratings.length} avaliações</Text>
        </View>
        <View style={ratStyles.summaryRight}>
          {dist.map(({ star, count }) => (
            <View key={star} style={ratStyles.distRow}>
              <Text style={ratStyles.distStar}>{star}</Text>
              <View style={ratStyles.distBar}>
                <View style={[ratStyles.distFill, { width: `${ratings.length > 0 ? (count / ratings.length) * 100 : 0}%` as any }]} />
              </View>
              <Text style={ratStyles.distCount}>{count}</Text>
            </View>
          ))}
        </View>
      </View>

      {ratings.map(r => (
        <View key={r.id} style={ratStyles.card}>
          <View style={ratStyles.cardHeader}>
            <CachedAvatar name={r.evaluator_name || '?'} size={36} borderRadius={18} />
            <View style={{ flex: 1 }}>
              <Text style={ratStyles.evaluatorName}>{r.evaluator_name || 'Usuário'}</Text>
              {r.evaluator_type && <Text style={ratStyles.evaluatorType}>{r.evaluator_type}</Text>}
            </View>
            <Stars rating={r.overall_rating} size={12} />
          </View>
          {r.comment && <Text style={ratStyles.comment}>{r.comment}</Text>}
          {(r.punctuality_rating || r.communication_rating || r.professionalism_rating) && (
            <View style={ratStyles.subRow}>
              {r.punctuality_rating && <SubRating label="Pontualidade" value={r.punctuality_rating} />}
              {r.communication_rating && <SubRating label="Comunicação" value={r.communication_rating} />}
              {r.professionalism_rating && <SubRating label="Profissionalismo" value={r.professionalism_rating} />}
            </View>
          )}
          <Text style={ratStyles.date}>{getTimeAgo(r.created_at)}</Text>
        </View>
      ))}
    </View>
  );
}

function SubRating({ label, value }: { label: string; value: number }) {
  return (
    <View style={ratStyles.subRating}>
      <Text style={ratStyles.subLabel}>{label}</Text>
      <Stars rating={value} size={10} />
    </View>
  );
}

// ─── About Tab ────────────────────────────────────────────────────────────────

function AboutTab({ company, ratingCount }: { company: Company; ratingCount: number }) {
  return (
    <View style={{ gap: 12 }}>
      {company.description && (
        <View style={aboutStyles.card}>
          <Text style={aboutStyles.title}>Descrição</Text>
          <Text style={aboutStyles.desc}>{company.description}</Text>
        </View>
      )}
      <View style={aboutStyles.card}>
        <Text style={aboutStyles.title}>Dados da Empresa</Text>
        <AboutRow label="Tipo" value={TYPE_LABELS[company.company_type] || company.company_type} />
        <AboutRow label="Membro desde" value={new Date(company.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })} />
        <AboutRow label="Verificada" value={company.verified ? 'Sim ✓' : 'Não'} />
        <AboutRow label="Fretes ativos" value={String(company.active_freights || 0)} />
        <AboutRow label="Fretes concluídos" value={String(company.completed_freights || 0)} />
        <AboutRow label="Total de avaliações" value={String(ratingCount)} last />
      </View>
    </View>
  );
}

function AboutRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[aboutStyles.row, last && { borderBottomWidth: 0 }]}>
      <Text style={aboutStyles.label}>{label}</Text>
      <Text style={aboutStyles.value}>{value}</Text>
    </View>
  );
}

// ─── Stars helper ─────────────────────────────────────────────────────────────

function Stars({ rating, size }: { rating: number; size: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <Ionicons key={s} name={s <= Math.round(rating) ? 'star' : 'star-outline'} size={size} color={COLORS.gold} />
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14, paddingBottom: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, gap: 3 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  typePill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  typePillText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  contactBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    paddingVertical: 12, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    justifyContent: 'space-around',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  tabItem: {
    flex: 1, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: COLORS.primary },
  tabLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  tabLabelActive: { color: COLORS.primary },
  content: { padding: 16, gap: 12, paddingBottom: 100 },

  // Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row', gap: 8,
    backgroundColor: COLORS.surface, paddingHorizontal: 16, paddingVertical: 6,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  chatBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    flex: 1, height: 38, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  chatBtnText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  whatsappBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    flex: 1.5, height: 38, borderRadius: 10,
    backgroundColor: '#25D366',
  },
  whatsappBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});

const ovStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: COLORS.border,
  },
  avatarRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  info: { flex: 1, gap: 5 },
  name: { fontSize: 16, fontWeight: '700', color: COLORS.text, flex: 1 },
  sub: { fontSize: 12, color: COLORS.textSecondary },
  ratingTxt: { fontSize: 12, color: COLORS.text, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: 12,
    padding: 12, alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: COLORS.border,
  },
  statIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  statLabel: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '500', textAlign: 'center' },
  infoCard: {
    backgroundColor: COLORS.surface, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: COLORS.border, gap: 12,
  },
  infoTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  infoRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  infoLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500' },
  infoValue: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  noInfo: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', paddingVertical: 8 },
});

const ratStyles = StyleSheet.create({
  summary: {
    backgroundColor: COLORS.surface, borderRadius: 14,
    padding: 14, flexDirection: 'row', gap: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  summaryLeft: { alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: 64 },
  avgNum: { fontSize: 36, fontWeight: '800', color: COLORS.text },
  totalCount: { fontSize: 11, color: COLORS.textSecondary },
  summaryRight: { flex: 1, gap: 5, justifyContent: 'center' },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  distStar: { fontSize: 11, color: COLORS.textSecondary, width: 10, textAlign: 'right' },
  distBar: { flex: 1, height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  distFill: { height: 6, backgroundColor: COLORS.gold, borderRadius: 3 },
  distCount: { fontSize: 11, color: COLORS.textSecondary, width: 20, textAlign: 'right' },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: COLORS.border, gap: 8,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  evaluatorName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  evaluatorType: { fontSize: 11, color: COLORS.textSecondary },
  comment: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  subRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  subRating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  subLabel: { fontSize: 11, color: COLORS.textSecondary },
  date: { fontSize: 11, color: COLORS.textLight },
});

const aboutStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: COLORS.border, gap: 2,
  },
  title: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  desc: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  label: { fontSize: 13, color: COLORS.textSecondary },
  value: { fontSize: 13, color: COLORS.text, fontWeight: '600' },
});

const emptyStyles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 40, gap: 10 },
  title: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  desc: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18, paddingHorizontal: 20 },
});
