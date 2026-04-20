import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';

interface CitySuggestion {
  city: string;
  stateCode: string;
}

interface Props {
  placeholder?: string;
  value: string;
  onSelect: (city: string, stateCode: string) => void;
}

const CITY_CACHE_TTL_MS = 30 * 60 * 1000; // 30 min
let cityCache: { data: any[]; fetchedAt: number } | null = null;

function getCachedCities(): any[] | null {
  if (!cityCache) return null;
  if (Date.now() - cityCache.fetchedAt > CITY_CACHE_TTL_MS) {
    cityCache = null;
    return null;
  }
  return cityCache.data;
}

export function CityAutocompleteInput({ placeholder = 'Digite o nome da cidade', value, onSelect }: Props) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value === '') {
      setQuery('');
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [value]);

  const fetchAndFilter = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);
    try {
      let cities = getCachedCities();
      if (!cities) {
        const res = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios');
        cities = await res.json();
        cityCache = { data: cities!, fetchedAt: Date.now() };
      }

      const normalized = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const filtered: CitySuggestion[] = (cities || [])
        .filter((c: any) => {
          const name = c.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          return name.includes(normalized);
        })
        .slice(0, 30)
        .map((c: any) => ({
          city: c.nome,
          stateCode: c.microrregiao.mesorregiao.UF.sigla,
        }))
        .sort((a: CitySuggestion, b: CitySuggestion) => a.city.localeCompare(b.city, 'pt-BR'));

      setSuggestions(filtered);
      setShowSuggestions(true);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChange(text: string) {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length >= 2) {
      debounceRef.current = setTimeout(() => fetchAndFilter(text), 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }

  function handleSelect(item: CitySuggestion) {
    setQuery(`${item.city} - ${item.stateCode}`);
    setSuggestions([]);
    setShowSuggestions(false);
    onSelect(item.city, item.stateCode);
  }

  function handleClear() {
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    onSelect('', '');
  }

  return (
    <View>
      <View style={styles.inputBox}>
        <Ionicons name="location-outline" size={16} color={COLORS.textSecondary} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textLight}
          value={query}
          onChangeText={handleChange}
          autoCorrect={false}
          autoCapitalize="words"
        />
        {loading ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : query.length > 0 ? (
          <TouchableOpacity onPress={handleClear}>
            <Ionicons name="close-circle" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.dropdown}>
          {suggestions.map((item, idx) => (
            <TouchableOpacity
              key={`${item.city}-${item.stateCode}-${idx}`}
              style={[styles.suggestionItem, idx < suggestions.length - 1 && styles.itemBorder]}
              onPress={() => handleSelect(item)}
            >
              <Ionicons name="location-outline" size={14} color={COLORS.primary} />
              <Text style={styles.cityName}>{item.city}</Text>
              <Text style={styles.stateCode}>{item.stateCode}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {showSuggestions && query.length >= 2 && suggestions.length === 0 && !loading && (
        <View style={styles.noResults}>
          <Text style={styles.noResultsText}>Nenhuma cidade encontrada</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  input: { flex: 1, fontSize: 14, color: COLORS.text },
  dropdown: {
    marginTop: 4,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cityName: { flex: 1, fontSize: 14, color: COLORS.text, fontWeight: '500' },
  stateCode: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
    backgroundColor: COLORS.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  noResults: {
    marginTop: 4,
    padding: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  noResultsText: { fontSize: 13, color: COLORS.textSecondary },
});
