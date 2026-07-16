import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const SUPABASE_URL  = 'https://plujjxgzaljsxurcqfap.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsdWpqeGd6YWxqc3h1cmNxZmFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwNjM2MDEsImV4cCI6MjA5OTYzOTYwMX0.V6XtfKT2Ms10hHl0PFZEkl0AmRCRVYq9-izkJ-LVJLo';

// Web storage — uses localStorage (works in browser/Netlify)
const webStorage = {
  getItem:    key => Promise.resolve(typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null),
  setItem:    (key, value) => Promise.resolve(typeof localStorage !== 'undefined' ? localStorage.setItem(key, value) : null),
  removeItem: key => Promise.resolve(typeof localStorage !== 'undefined' ? localStorage.removeItem(key) : null),
};

// Native storage — uses AsyncStorage (works on iOS/Android without expo-secure-store issues)
import AsyncStorage from '@react-native-async-storage/async-storage';
const nativeStorage = {
  getItem:    key => AsyncStorage.getItem(key),
  setItem:    (key, value) => AsyncStorage.setItem(key, value),
  removeItem: key => AsyncStorage.removeItem(key),
};

const storage = Platform.OS === 'web' ? webStorage : nativeStorage;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storage,
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
