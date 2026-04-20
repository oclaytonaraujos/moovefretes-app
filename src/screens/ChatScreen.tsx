import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
  Vibration, Alert, Modal, Image,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { COLORS } from '../utils/constants';
import { CachedAvatar } from '../components/CachedAvatar';
import { UserProfileModal } from '../components/UserProfileModal';
import type { Message } from '../types';

export function ChatScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const {
    userId: otherUserId, userName, conversationId: initialConvId, userAvatar,
    source, sourceId, originCity, originState, destinationCity, destinationState,
    initialMessage,
  } = route.params || {};
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(initialConvId || null);
  const [text, setText] = useState<string>(initialMessage || '');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showAttachOptions, setShowAttachOptions] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{ uri: string; name: string; mimeType: string } | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const firstUnreadIndexRef = useRef<number>(-1);
  const initialScrollDoneRef = useRef<boolean>(false);

  // Guard against concurrent calls that could create duplicate conversations
  const isCreatingConversationRef = useRef(false);

  const getOrCreateConversation = useCallback(async (): Promise<string | null> => {
    if (!user || !otherUserId) return null;
    if (conversationId) return conversationId;
    if (isCreatingConversationRef.current) return null;

    isCreatingConversationRef.current = true;
    try {
      const participantsFilter =
        `and(participant1_id.eq.${user.id},participant2_id.eq.${otherUserId}),and(participant1_id.eq.${otherUserId},participant2_id.eq.${user.id})`;

      const { data: existingChats } = await supabase
        .from('conversations')
        .select('id, is_pinned')
        .or(participantsFilter)
        .order('created_at', { ascending: false })
        .limit(1);

      if (existingChats && existingChats.length > 0) {
        const conv = existingChats[0];
        setConversationId(conv.id);
        setIsPinned(conv.is_pinned || false);

        if (source === 'freight' || source === 'route') {
          await supabase.from('conversations').update({
            // TODO: Remove source:'direct' bypass once the Postgres trigger
            // "column 'origin' does not exist" bug is fixed in the DB migration.
            source: 'direct',
            source_id: sourceId || null,
            freight_id: source === 'freight' ? sourceId : null,
            origin_city: originCity || null,
            origin_state: originState || null,
            destination_city: destinationCity || null,
            destination_state: destinationState || null,
            metadata: { original_source: source },
          }).eq('id', conv.id);
        }

        return conv.id;
      }

      // TODO: Replace source:'direct' with the real source value once the Postgres
      // trigger bug ("column 'origin' does not exist") is fixed server-side.
      const { data: created, error } = await supabase
        .from('conversations')
        .insert({
          participant1_id: user.id,
          participant2_id: otherUserId,
          source: 'direct',
          source_id: sourceId || null,
          freight_id: source === 'freight' ? sourceId : null,
          origin_city: originCity || null,
          origin_state: originState || null,
          destination_city: destinationCity || null,
          destination_state: destinationState || null,
          metadata: { original_source: source || 'direct' },
        })
        .select('id')
        .single();

      if (error) {
        console.error('[ChatScreen] Failed to create conversation:', error);
        return null;
      }

      if (created) {
        setConversationId(created.id);
        return created.id;
      }

      return null;
    } finally {
      isCreatingConversationRef.current = false;
    }
  }, [user, otherUserId, conversationId, source, sourceId, originCity, originState, destinationCity, destinationState]);

  async function handlePinConversation() {
    if (!conversationId) return;
    setShowOptionsModal(false);
    const newVal = !isPinned;
    setIsPinned(newVal);
    const { error } = await supabase.from('conversations').update({ is_pinned: newVal }).eq('id', conversationId);
    if (error) {
      setIsPinned(!newVal);
    }
  }

  async function handleDeleteConversation() {
    if (!conversationId) return;
    setShowOptionsModal(false);
    setTimeout(() => {
      Alert.alert(
        'Apagar Conversa',
        'Tem certeza que deseja apagar esta conversa permanentemente?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { 
            text: 'Apagar', 
            style: 'destructive',
            onPress: async () => {
              await supabase.from('messages').delete().eq('conversation_id', conversationId);
              const { error } = await supabase.from('conversations').delete().eq('id', conversationId);
              if (error) {
                Alert.alert('Erro', 'Não foi possível apagar a conversa.');
              } else {
                navigation.goBack();
              }
            }
          }
        ]
      );
    }, 100);
  }

  const load = useCallback(async () => {
    if (!user || !otherUserId) return;
    const convId = await getOrCreateConversation();
    if (!convId) { setLoading(false); return; }

    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    const msgs = data || [];

    // Determine the index of the first unread message (from the other user)
    // BEFORE marking them as read, so we can scroll to it on open.
    const firstUnread = msgs.findIndex(m => m.sender_id !== user.id && !m.is_read);
    firstUnreadIndexRef.current = firstUnread;
    initialScrollDoneRef.current = false;

    setMessages(msgs);
    setLoading(false);

    const { data: updateData, error: updateError } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', convId)
      .neq('sender_id', user.id)
      .eq('is_read', false)
      .select('id');
      
    if (updateError) {
      console.warn('Failed to update messages read status:', updateError);
    } else {
      console.log('Messages marked as read:', updateData?.length || 0);
    }
  }, [user, otherUserId, getOrCreateConversation]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!conversationId || !user) return;
    
    // Append a unique random string to the channel name.
    // This prevents the "cannot add postgres_changes callbacks... after subscribe()" error 
    // that occurs if multiple instances of ChatScreen for the same conversation 
    // are mounted in the navigation stack simultaneously.
    const uniqueChannelName = `chat-conv-${conversationId}-${Math.random().toString(36).substring(7)}`;
    
    const channel = supabase
      .channel(uniqueChannelName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const msg = payload.new as Message;
        if (msg.sender_id !== user.id) {
          setMessages(prev => [...prev, msg]);
          supabase.from('messages').update({ is_read: true }).eq('id', msg.id);
        }
      })
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, user]);

  useEffect(() => {
    if (messages.length === 0) return;

    if (!initialScrollDoneRef.current) {
      // Initial load: scroll to first unread or to the end
      initialScrollDoneRef.current = true;
      const unreadIndex = firstUnreadIndexRef.current;

      // Build the grouped list index: each separator adds 1 extra item.
      // We need to map the raw message index to the grouped list index.
      let groupedUnreadIndex = -1;
      if (unreadIndex >= 0) {
        // Count separators that appear before the unread message in the grouped list
        let sepCount = 0;
        let lastDay = '';
        for (let i = 0; i <= unreadIndex; i++) {
          const day = new Date(messages[i].created_at).toDateString();
          if (day !== lastDay) { sepCount++; lastDay = day; }
        }
        // grouped index = raw message index + number of separators before it
        groupedUnreadIndex = unreadIndex + sepCount;
      }

      setTimeout(() => {
        if (groupedUnreadIndex >= 0) {
          // Scroll so the first unread message is aligned to the top
          flatListRef.current?.scrollToIndex({
            index: groupedUnreadIndex,
            animated: false,
            viewPosition: 0, // 0 = top of viewport
          });
        } else {
          // No unread messages: last message at the bottom
          flatListRef.current?.scrollToEnd({ animated: false });
        }
      }, 150);
    } else {
      // Subsequent updates (new messages arriving via realtime) → scroll to end
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  async function handleSend() {
    if (!text.trim() || !user || !otherUserId) return;
    Vibration.vibrate(50);
    const content = text.trim();
    setSending(true);

    let convId = conversationId;
    if (!convId) convId = await getOrCreateConversation();
    if (!convId) { setSending(false); return; }

    setText('');
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: convId, sender_id: user.id, content, is_read: false })
      .select()
      .single();

    await supabase.from('conversations').update({ last_message_at: now }).eq('id', convId);

    setSending(false);
    if (!error && data) {
      setMessages(prev => [...prev, data]);
    }
  }

  const processAttachment = async (uri: string, name: string, mimeType: string) => {
    setSending(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const buffer = decode(base64);

      const ext = (name.split('.').pop() || 'tmp').toLowerCase();
      const filePath = `${Date.now()}_${user?.id?.slice(0, 8)}.${ext}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(filePath, buffer, {
          contentType: mimeType || 'application/octet-stream',
          upsert: true,
        });

      if (uploadError) {
        Alert.alert('Erro no Upload', `Detalhes: ${uploadError.message}`);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from('chat-attachments').getPublicUrl(filePath);
      const fileUrl = publicUrlData.publicUrl;

      // Determina o tipo de mensagem igual ao web
      const isImage = mimeType.startsWith('image/');
      const messageType = isImage ? 'image' : 'file';

      // Monta o attachment no mesmo formato que o web salva
      const attachment = {
        type: isImage ? 'image' : 'document',
        url: fileUrl,          // URL pública direta
        path: filePath,        // path no storage (compat com web)
        filename: name,
        name,                  // legado
        size: undefined as number | undefined,
      };

      let convId = conversationId;
      if (!convId) convId = await getOrCreateConversation();
      if (!convId) return;

      const now = new Date().toISOString();
      const { data: msgData, error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: convId,
          sender_id: user?.id,
          content: name,          // legenda ou nome do arquivo (igual ao web)
          message_type: messageType,
          attachments: [attachment],
          is_read: false,
        })
        .select()
        .single();

      if (msgError) {
        Alert.alert('Erro', `N\u00e3o foi poss\u00edvel salvar a mensagem: ${msgError.message}`);
      } else {
        await supabase.from('conversations').update({ last_message_at: now }).eq('id', convId);
        setMessages(prev => [...prev, msgData]);
        setPendingAttachment(null);
      }
    } catch(e: any) {
      console.error(e);
      Alert.alert('Erro', e?.message || 'Ocorreu um erro ao anexar item.');
    } finally {
      setSending(false);
    }
  };

  const handleAttachDocument = () => {
    if (sending) return;
    setShowAttachOptions(false);
    setTimeout(async () => {
      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: '*/*',
          copyToCacheDirectory: true,
        });
        if (result.canceled || !result.assets || result.assets.length === 0) return;
        const asset = result.assets[0];
        setPendingAttachment({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType || 'unknown' });
      } catch(e: any) {
        Alert.alert('Erro no Documento', e?.message || 'Falha ao abrir seletor');
      }
    }, 400);
  };

  const handleAttachGallery = () => {
    if (sending) return;
    setShowAttachOptions(false);
    setTimeout(async () => {
      try {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permissão negada', 'Precisamos de acesso à galeria para enviar fotos.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images', 'videos'],
          quality: 0.8,
        });
        if (result.canceled || !result.assets || result.assets.length === 0) return;
        const asset = result.assets[0];
        const name = asset.fileName || asset.uri.split('/').pop() || 'imagem.jpg';
        let mimeType = asset.mimeType || 'image/jpeg';
        if (!asset.mimeType) {
           if (name.toLowerCase().endsWith('.png')) mimeType = 'image/png';
           else if (name.toLowerCase().endsWith('.gif')) mimeType = 'image/gif';
        }
        setPendingAttachment({ uri: asset.uri, name, mimeType });
      } catch(e: any) {
        console.error(e);
        Alert.alert('Erro na Galeria', e?.message || 'Falha ao abrir galeria');
      }
    }, 400);
  };

  const handleAttachCamera = () => {
    if (sending) return;
    setShowAttachOptions(false);
    setTimeout(async () => {
      try {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permissão negada', 'Precisamos de acesso à câmera para tirar fotos.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          quality: 0.8,
        });
        if (result.canceled || !result.assets || result.assets.length === 0) return;
        const asset = result.assets[0];
        const name = asset.fileName || asset.uri.split('/').pop() || 'foto.jpg';
        let mimeType = asset.mimeType || 'image/jpeg';
        if (!asset.mimeType) {
           if (name.toLowerCase().endsWith('.png')) mimeType = 'image/png';
        }
        setPendingAttachment({ uri: asset.uri, name, mimeType });
      } catch(e: any) {
        console.error(e);
        Alert.alert('Erro na Câmera', e?.message || 'Falha ao abrir câmera');
      }
    }, 400);
  };

  function formatTime(dateString: string) {
    const d = new Date(dateString);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDay(dateString: string) {
    const d = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Hoje';
    if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
  }

  const groupedMessages: (Message | { type: 'separator'; label: string; key: string })[] = [];
  let lastDay = '';
  messages.forEach(msg => {
    const day = new Date(msg.created_at).toDateString();
    if (day !== lastDay) {
      groupedMessages.push({ type: 'separator', label: formatDay(msg.created_at), key: `sep-${day}` });
      lastDay = day;
    }
    groupedMessages.push(msg);
  });

  return (
    <View style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={[styles.flex, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Main', { screen: 'ChatTab', params: { screen: 'ChatList' } })} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerInfo} onPress={() => setShowProfileModal(true)} activeOpacity={0.8}>
          <CachedAvatar
            uri={userAvatar}
            name={userName}
            size={40}
            borderRadius={20}
          />
          <View style={styles.headerInfoText}>
            {(source === 'freight' || source === 'route') && originCity && destinationCity && (
              <View style={styles.headerRouteRow}>
                <Ionicons
                  name={source === 'freight' ? 'document-text-outline' : 'map-outline'}
                  size={10}
                  color={COLORS.primary}
                />
                <Text style={styles.headerRouteText} numberOfLines={1} ellipsizeMode="tail">
                  {originCity}/{originState}
                </Text>
                <Ionicons name="arrow-forward" size={10} color={COLORS.textSecondary} />
                <Text style={styles.headerRouteText} numberOfLines={1} ellipsizeMode="tail">
                  {destinationCity}/{destinationState}
                </Text>
              </View>
            )}
            <Text style={styles.headerName}>{userName || 'Conversa'}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerOptionsBtn} onPress={() => setShowOptionsModal(true)}>
          <Ionicons name="ellipsis-vertical" size={22} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ flex: 1 }} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={groupedMessages}
          keyExtractor={(item, i) => ('key' in item ? item.key : item.id) || String(i)}
          contentContainerStyle={styles.messages}
          onScrollToIndexFailed={() => {
            // Fallback: if item layout is unknown, just scroll to end
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 200);
          }}
          renderItem={({ item }) => {
            if ('type' in item) {
              return (
                <View style={styles.daySeparator}>
                  <View style={styles.dayLine} />
                  <Text style={styles.dayLabel}>{item.label}</Text>
                  <View style={styles.dayLine} />
                </View>
              );
            }
            const isMine = item.sender_id === user?.id;
            
            // Suporte ao novo formato (message_type + attachments) igual ao web
            // E fallback para o formato legado [FILE]
            const msgType = (item as any).message_type;
            const attachments = (item as any).attachments as Array<{ type: string; url?: string; path?: string; filename?: string; name?: string }> | undefined;
            const hasAttachment = (msgType === 'image' || msgType === 'file') && attachments && attachments.length > 0;
            
            // Fallback legado [FILE]
            const isLegacyFile = !hasAttachment && item.content.startsWith('[FILE]');
            let legacyFileUrl = '';
            let legacyFileName = '';
            let legacyFileType = '';
            if (isLegacyFile) {
              const parts = item.content.replace('[FILE]', '').split('|');
              legacyFileUrl = parts[0]?.trim();
              legacyFileName = parts[1]?.trim() || 'Arquivo Anexado';
              legacyFileType = parts[2]?.trim() || 'unknown';
            }

            // Dados do attachment (novo formato tem prioridade)
            const att = hasAttachment ? attachments![0] : null;
            const attUrl = att?.url || legacyFileUrl;
            const attName = att?.filename || att?.name || legacyFileName;
            const attIsImage = hasAttachment ? msgType === 'image' : legacyFileType.startsWith('image/');
            const isFile = hasAttachment || isLegacyFile;

            return (
              <View style={[styles.msgWrap, isMine ? styles.msgWrapRight : styles.msgWrapLeft]}>
                <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther, attIsImage && isFile && { paddingHorizontal: 4, paddingVertical: 4 }]}>
                  {isFile ? (
                    <TouchableOpacity activeOpacity={0.8} onPress={() => Linking.openURL(attUrl)}>
                      {attIsImage ? (
                         <Image source={{ uri: attUrl }} style={styles.chatImage} resizeMode="cover" />
                      ) : (
                         <View style={styles.fileRow}>
                            <Ionicons name="document-text" size={32} color={isMine ? '#fff' : COLORS.primary} />
                            <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine, { textDecorationLine: 'underline', maxWidth: 200 }]} numberOfLines={2}>
                              {attName}
                            </Text>
                         </View>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>
                      {item.content}
                    </Text>
                  )}
                  <View style={[styles.bubbleFooter, attIsImage && isFile && { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, marginTop: 0 }]}>
                    <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine, attIsImage && isFile && { color: '#fff' }]}>
                      {formatTime(item.created_at)}
                    </Text>
                    {isMine && (
                      <Ionicons
                        name={item.is_read ? 'checkmark-done' : 'checkmark'}
                        size={12}
                        color={item.is_read ? (attIsImage && isFile ? '#4ade80' : '#fff') : 'rgba(255,255,255,0.6)'}
                      />
                    )}
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Ionicons name="chatbubble-outline" size={40} color={COLORS.textLight} />
              <Text style={styles.emptyChatText}>Nenhuma mensagem ainda.{'\n'}Inicie a conversa!</Text>
            </View>
          }
        />
      )}

      <UserProfileModal
        visible={showProfileModal}
        userId={otherUserId || ''}
        onClose={() => setShowProfileModal(false)}
      />

      <Modal visible={showOptionsModal} transparent animationType="fade" onRequestClose={() => setShowOptionsModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowOptionsModal(false)}>
          <View style={styles.actionSheet}>
            <View style={styles.actionSheetHeader}>
              <Text style={styles.actionSheetTitle} numberOfLines={1}>{userName}</Text>
            </View>

            <TouchableOpacity 
              style={styles.actionOption} 
              onPress={() => {
                setShowOptionsModal(false);
                setTimeout(() => setShowProfileModal(true), 100);
              }}
            >
              <Ionicons name="person-outline" size={22} color={COLORS.text} />
              <Text style={styles.actionOptionText}>Ver perfil</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionOption} 
              onPress={handlePinConversation}
            >
              <Ionicons name={isPinned ? "pin" : "pin-outline"} size={22} color={COLORS.text} />
              <Text style={styles.actionOptionText}>
                {isPinned ? 'Desfixar conversa' : 'Fixar conversa'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionOption} 
              onPress={handleDeleteConversation}
            >
              <Ionicons name="trash-outline" size={22} color={COLORS.danger} />
              <Text style={[styles.actionOptionText, { color: COLORS.danger }]}>Apagar conversa</Text>
            </TouchableOpacity>

            <View style={[styles.actionSheetFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <TouchableOpacity style={styles.actionCancelBtn} onPress={() => setShowOptionsModal(false)}>
                <Text style={styles.actionCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>


      {pendingAttachment && (
        <View style={styles.previewBar}>
          {pendingAttachment.mimeType.startsWith('image/') ? (
            <Image source={{ uri: pendingAttachment.uri }} style={styles.previewImage} resizeMode="cover" />
          ) : (
            <View style={styles.previewDoc}>
              <Ionicons name="document-text" size={28} color={COLORS.primary} />
              <Text style={styles.previewDocName} numberOfLines={2}>{pendingAttachment.name}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.previewCancel} onPress={() => setPendingAttachment(null)}>
            <Ionicons name="close-circle" size={22} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputBar}>
        <TouchableOpacity style={styles.attachBtn} onPress={() => setShowAttachOptions(true)} disabled={sending}>
          <Ionicons name="attach" size={26} color={COLORS.textLight} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder={pendingAttachment ? 'Adicione uma legenda...' : 'Escreva uma mensagem...'}
          placeholderTextColor={COLORS.textLight}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={500}
          returnKeyType="default"
        />
        <TouchableOpacity
          style={[styles.sendBtn, ((!text.trim() && !pendingAttachment) || sending) && styles.sendBtnDisabled]}
          onPress={() => {
            if (pendingAttachment) {
              processAttachment(pendingAttachment.uri, pendingAttachment.name, pendingAttachment.mimeType);
            } else {
              handleSend();
            }
          }}
          disabled={(!text.trim() && !pendingAttachment) || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>

    {showAttachOptions && (
      <View style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999 }]}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAttachOptions(false)}>
          <View style={styles.actionSheet}>
            <View style={styles.actionSheetHeader}>
              <Text style={styles.actionSheetTitle}>Adicionar Anexo</Text>
            </View>

            <TouchableOpacity style={styles.actionOption} onPress={handleAttachCamera}>
              <Ionicons name="camera-outline" size={24} color={COLORS.primary} />
              <Text style={styles.actionOptionText}>Câmera</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionOption} onPress={handleAttachGallery}>
              <Ionicons name="image-outline" size={24} color={COLORS.primary} />
              <Text style={styles.actionOptionText}>Galeria de Fotos</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionOption} onPress={handleAttachDocument}>
              <Ionicons name="document-text-outline" size={24} color={COLORS.primary} />
              <Text style={styles.actionOptionText}>Documento</Text>
            </TouchableOpacity>

            <View style={[styles.actionSheetFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <TouchableOpacity style={styles.actionCancelBtn} onPress={() => setShowAttachOptions(false)}>
                <Text style={styles.actionCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerInfoText: { gap: 1, flex: 1 },
  headerRouteRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 1 },
  headerRouteText: { fontSize: 10, color: COLORS.primary, fontWeight: '600', flexShrink: 1 },
  headerName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  headerSub: { fontSize: 12, color: COLORS.textSecondary },
  messages: { padding: 12, paddingBottom: 8, gap: 4 },
  daySeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    gap: 12,
  },
  dayLine: { flex: 1, height: 1, backgroundColor: COLORS.borderLight },
  dayLabel: { 
    fontSize: 11, 
    color: COLORS.textLight, 
    fontWeight: '700', 
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  msgWrap: { flexDirection: 'row', marginVertical: 4 },
  msgWrapRight: { justifyContent: 'flex-end' },
  msgWrapLeft: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  bubbleMine: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bubbleText: { fontSize: 15, color: COLORS.text, lineHeight: 21 },
  bubbleTextMine: { color: '#fff' },
  bubbleFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2 },
  bubbleTime: { fontSize: 10, color: COLORS.textSecondary },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.7)' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  input: {
    flex: 1,
    minHeight: 38,
    maxHeight: 100,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5, backgroundColor: COLORS.border },
  emptyChat: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyChatText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  headerOptionsBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16,
  },
  actionSheetHeader: {
    padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight, alignItems: 'center',
  },
  actionSheetTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  actionOption: {
    flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  actionOptionText: { fontSize: 16, color: COLORS.text, fontWeight: '500' },
  actionSheetFooter: { padding: 16 },
  actionCancelBtn: {
    backgroundColor: COLORS.background, padding: 14, borderRadius: 8, alignItems: 'center',
  },
  actionCancelText: { fontSize: 16, fontWeight: '600', color: COLORS.textSecondary },
  chatImage: {
    width: 220,
    height: 280,
    borderRadius: 12,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 6,
  },
  attachBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  previewImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: COLORS.borderLight,
  },
  previewDoc: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 10,
  },
  previewDocName: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
  },
  previewCancel: {
    padding: 4,
  },
});
