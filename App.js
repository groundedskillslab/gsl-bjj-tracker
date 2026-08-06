/**
 * GROUNDED SKILLS LAB — BJJ TRACKER
 * React Native / Expo App — Supabase Edition
 * Train. Measure. Improve. Repeat.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, Modal, Alert, Platform, Dimensions,
  KeyboardAvoidingView, FlatList, Switch, StatusBar, Image, ActivityIndicator,
} from 'react-native';
import Svg, { Rect, Path, Circle, G, Text as SvgText } from 'react-native-svg';
import * as Font from 'expo-font';
import { supabase } from './supabase';

// URL polyfill — native only (browser already has the URL API built in)
if (Platform.OS !== 'web') {
  require('react-native-url-polyfill/auto');
}

const { width: SCREEN_W } = Dimensions.get('window');

// Cross-platform top inset
const { height: SCREEN_H } = Dimensions.get('screen');
const TOP_INSET = Platform.OS === 'android'
  ? (StatusBar.currentHeight || 24)
  : Platform.OS === 'web' ? 0
  : SCREEN_H >= 812 ? 44 : 20;
const SIDE_INSET = 0;

// ─── Theme Palettes ────────────────────────────────────────────────────────────
const DARK = {
  bg:        '#0D0D0B',
  surface:   '#141412',
  card:      '#1C1C18',
  border:    '#2C2C26',
  borderMid: '#3C3C34',
  charcoal:  '#1C1C1E',
  stone:     '#9A9A8E',
  sand:      '#DCCC86',
  offWhite:  '#F5F3EF',
  sage:      '#5A9E50',  // brighter green for legibility
  gold:      '#C8A24D',
  goldLight: '#E2C87A',
  goldSoft:  'rgba(200,162,77,0.15)',
  goldDim:   'rgba(200,162,77,0.08)',
  green:     '#5A9E50',
  red:       '#C04040',  // brighter red
  amber:     '#C8A24D',
  amberSoft: 'rgba(200,162,77,0.15)',
  teal:      '#3A9E8E',  // brighter teal
  blue:      '#5A82A0',
  opp:       '#8B7A9A',
  oppSoft:   'rgba(139,122,154,0.15)',
  oppDim:    '#3A3244',
  text:      '#F0EDE6',  // warm white — main text
  textDim:   '#C0BDB5',  // secondary text — clearly readable
  muted:     '#7A7870',  // muted labels — not too dark
  faint:     '#222220',
};

const LIGHT = {
  bg:        '#F5F3EF',
  surface:   '#FFFFFF',
  card:      '#F0EDE8',
  border:    '#DEDAD4',
  borderMid: '#C8C4BC',
  charcoal:  '#1C1C1E',
  stone:     '#5A5A56',
  sand:      '#B89A4A',
  offWhite:  '#1C1C1E',
  sage:      '#2E7E24',  // stronger green
  gold:      '#9A7030',
  goldLight: '#C8A24D',
  goldSoft:  'rgba(154,112,48,0.12)',
  goldDim:   'rgba(154,112,48,0.07)',
  green:     '#2E7E24',
  red:       '#B03030',  // stronger red
  amber:     '#8A6A20',
  amberSoft: 'rgba(138,106,32,0.12)',
  teal:      '#1A6A60',  // stronger teal
  blue:      '#2A4A6A',
  opp:       '#5A4A70',
  oppSoft:   'rgba(90,74,112,0.12)',
  oppDim:    '#E8E4F0',
  text:      '#1A1A1C',  // near-black for max contrast
  textDim:   '#3A3A3E',
  muted:     '#6A6A70',
  faint:     '#E8E4DC',
};

// ThemeContext — provides current palette to all components
const ThemeContext = React.createContext(DARK);
const useTheme = () => React.useContext(ThemeContext);

// Global mutable C reference — updated when theme switches
// Components that use C directly (outside render) reference this
let C = { ...DARK };

const PIE_DARK  = ['#C8A24D','#7A8F72','#5A7A72','#4A6280','#9B4040','#B89A4A','#DCCC86','#8E8E82','#6B5E7A'];
const PIE_LIGHT = ['#9A7030','#4A6E40','#2A5A52','#2A4A6A','#8B2A2A','#8A6A20','#B89A4A','#6A6660','#5A4A70'];
let PIE = [...PIE_DARK];

// ─── IBJJF Scoring ─────────────────────────────────────────────────────────────
const SCORE_EVENTS = {
  sweep:       { pts:2, label:'Sweep',        color:C.gold,  icon:'↺', category:'sweep',      desc:'2 pts · ask starting position + technique' },
  takedown:    { pts:2, label:'Takedown',      color:C.blue,  icon:'↓', category:'takedown',   desc:'2 pts · ask technique + end position' },
  guardPass:   { pts:3, label:'Guard Pass',    color:C.teal,  icon:'→', category:'guardPass',  desc:'3 pts · ask guard passed + pass technique' },
  mount:       { pts:4, label:'Mount',         color:C.red,   icon:'▲', category:'position',   desc:'4 pts · records position entry' },
  backControl: { pts:4, label:'Back Control',  color:C.opp,   icon:'◀', category:'position',   desc:'4 pts · records position entry' },
  kneeOnBelly: { pts:2, label:'Knee on Belly', color:C.amber, icon:'◆', category:'position',   desc:'2 pts · records position entry' },
  guardPull:   { pts:0, label:'Guard Pull',    color:C.sage,  icon:'⬇', category:'guardPull',  desc:'0 pts · ask end position' },
  advantage:   { pts:0, label:'Advantage',     color:C.sand,  icon:'+', category:'advantage',  desc:'0 pts · sweep or sub attempt' },
};
const POS_PTS_MAP = { mount:'mount', 'back control':'backControl', 'knee on belly':'kneeOnBelly' };
const getPosPtsKey = n => POS_PTS_MAP[n.toLowerCase().trim()] || null;

// Guard types for guard pass tracking
const DEF_GUARD_TYPES = ['Closed Guard','Half Guard','Open Guard','Butterfly Guard','De La Riva','Spider Guard','Lasso Guard','X-Guard','Reverse De La Riva','Worm Guard','Lapel Guard'];
// Advantage types per IBJJF
const ADV_TYPES = ['Sweep Attempt','Submission Attempt','Near Guard Pass','Near Takedown'];

// ─── Constants ─────────────────────────────────────────────────────────────────
const DEF_SUBS        = ["Rear Naked Choke","Triangle","Armbar","Guillotine","Kimura","Heel Hook","Ezekiel","D'Arce","Anaconda","Bow & Arrow"];
const DEF_SWEEPS      = ["Scissor Sweep","Flower Sweep","Hip Bump","Butterfly Sweep","X-Guard","Long Step","Hook Sweep","Tripod Sweep","Sickle Sweep","Technical Stand-up"];
const DEF_POS         = ["Guard","Half Guard","Side Control","Mount","Back Control","Turtle","Knee on Belly","North-South","Closed Guard","Open Guard"];
const DEF_GUARD_PULLS = ["Collar Drag","Arm Drag","Jump Closed Guard","Pull Butterfly","Pull Half Guard","Pull X-Guard","Pull Spider Guard","Pull De La Riva","Sit-to-Guard","Lapel Pull"];
const DEF_TAKEDOWNS   = ["Double Leg","Single Leg","Ankle Pick","Duck Under","Uchi Mata","Hip Throw","Foot Sweep","Knee Tap","Blast Double","Headlock Throw"];
const DEF_TRANSITIONS = [...DEF_GUARD_PULLS, ...DEF_TAKEDOWNS];
const DEF_GUARD_PASSES= ["High Guard Pass","Low Guard Pass","Torreando","X-Pass","Over-Under","Leg Drag","Stack Pass","Smash Pass"];
const WEIGHT_CLASSES  = ["Rooster","Light Feather","Feather","Light","Middle","Medium Heavy","Heavy","Super Heavy","Ultra Heavy","Open Class"];
const GI_OPTIONS      = ["Gi","No-Gi"];
const RESULT_CFG      = { win:{label:'Win',color:C.sage,icon:'W'}, loss:{label:'Loss',color:C.red,icon:'L'}, draw:{label:'Draw',color:C.amber,icon:'D'} };
const METHOD_CFG      = { submission:{label:'Submission',icon:'●'}, points:{label:'Points',icon:'■'}, decision:{label:'Decision',icon:'◆'}, advantage:{label:'Advantage',icon:'+'}, dq:{label:'DQ',icon:'✗'}, walkover:{label:'Walkover',icon:'→'} };
const BELT_COLORS = {
  // Juvenile belts (under 16)
  'grey-white':  { bg:'#B0B0B0', text:'#1C1C1E', label:'Grey-White',  juvenile:true },
  'grey':        { bg:'#787878', text:'#FFFFFF',  label:'Grey',        juvenile:true },
  'grey-black':  { bg:'#3A3A3A', text:'#FFFFFF',  label:'Grey-Black',  juvenile:true },
  'yellow-white':{ bg:'#E8C840', text:'#1C1C1E',  label:'Yellow-White',juvenile:true },
  'yellow':      { bg:'#D4A800', text:'#1C1C1E',  label:'Yellow',      juvenile:true },
  'yellow-black':{ bg:'#8A6E00', text:'#FFFFFF',  label:'Yellow-Black',juvenile:true },
  'orange-white':{ bg:'#E8924A', text:'#1C1C1E',  label:'Orange-White',juvenile:true },
  'orange':      { bg:'#D45A00', text:'#FFFFFF',  label:'Orange',      juvenile:true },
  'orange-black':{ bg:'#8A3A00', text:'#FFFFFF',  label:'Orange-Black',juvenile:true },
  'green-white': { bg:'#6AAA6A', text:'#1C1C1E',  label:'Green-White', juvenile:true },
  'green':       { bg:'#2A7A2A', text:'#FFFFFF',  label:'Green',       juvenile:true },
  'green-black': { bg:'#1A4A1A', text:'#FFFFFF',  label:'Green-Black', juvenile:true },
  // Adult belts
  'white':       { bg:'#E8E4DC', text:'#1C1C1E',  label:'White'  },
  'blue':        { bg:'#2A4A7A', text:'#FFFFFF',  label:'Blue'   },
  'purple':      { bg:'#5A3A7A', text:'#FFFFFF',  label:'Purple' },
  'brown':       { bg:'#5A3018', text:'#FFFFFF',  label:'Brown'  },
  'black':       { bg:'#1C1C1E', text:'#C8A24D',  label:'Black'  },
  'coral':       { bg:'#C85A3A', text:'#FFFFFF',  label:'Coral'  },
  'red-black':   { bg:'#8A1A1A', text:'#FFFFFF',  label:'Red-Black' },
  'red-white':   { bg:'#C82A2A', text:'#FFFFFF',  label:'Red-White' },
  'red':         { bg:'#8A0000', text:'#FFFFFF',  label:'Red'    },
};

const BELT_ORDER = [
  'grey-white','grey','grey-black',
  'yellow-white','yellow','yellow-black',
  'orange-white','orange','orange-black',
  'green-white','green','green-black',
  'white','blue','purple','brown','black',
  'coral','red-black','red-white','red',
];

const JUVENILE_BELTS = BELT_ORDER.filter(b => BELT_COLORS[b]?.juvenile);
const ADULT_BELTS    = BELT_ORDER.filter(b => !BELT_COLORS[b]?.juvenile);
const TABS = [
  { key:'Track',    label:'Track',    icon:'🥋' },
  { key:'Journal',  label:'Journal',  icon:'📖' },
  { key:'Academy',  label:'Academy',  icon:'🏫' },
  { key:'Charts',   label:'Charts',   icon:'📊' },
  { key:'Rolls',    label:'Rolls',    icon:'⚔️' },
  { key:'Comps',    label:'Comps',    icon:'🏆' },
  { key:'Profiles', label:'Profile',  icon:'👤' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
const uid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = Math.random() * 16 | 0;
  return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
});
const fmtSecs     = s => { if(!s) return '0s'; const m=Math.floor(s/60),sc=s%60; return m>0?`${m}m${sc>0?` ${sc}s`:''}` :`${sc}s`; };
const fmtDateTime = ts => new Date(ts).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
const fmtTime     = ts => new Date(ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
const fmtCompDate = d  => { if(!d)return''; const[y,m,day]=d.split('-'); return new Date(+y,+m-1,+day).toLocaleDateString([],{month:'long',day:'numeric',year:'numeric'}); };
const abbrevName  = (full='') => { const p=full.trim().split(/\s+/).filter(Boolean); if(!p.length)return'??'; if(p.length===1)return p[0].slice(0,4).toUpperCase(); return(p[0].slice(0,2)+p[p.length-1].slice(0,2)).toUpperCase(); };

const emptyRoll = (partner='',isComp=false) => ({
  id:uid(), partner, startedAt:Date.now(), endedAt:null, isComp, notes:'',
  subCounts:{}, sweepCounts:{}, posDurations:{}, posCounts:{}, transCounts:{}, guardPassCounts:{},
  opp_subCounts:{}, opp_sweepCounts:{}, opp_posDurations:{}, opp_posCounts:{}, opp_transCounts:{}, opp_guardPassCounts:{},
  eventLog:[], paused:false, pausedAt:null, totalPausedMs:0,
});

const emptyProfileData = () => ({
  submissions: DEF_SUBS, sweeps: DEF_SWEEPS, positions: DEF_POS,
  transitions: DEF_TRANSITIONS, guardPulls: DEF_GUARD_PULLS, takedowns: DEF_TAKEDOWNS,
  rolls:[], activeRoll:null, competitions:[], trainingDays:[],
});

// ─── Supabase data helpers ──────────────────────────────────────────────────────
// All persistence now goes through Supabase. These helpers keep the app logic clean.

const db = {
  // ── Athlete ──────────────────────────────────────────────────────────────────
  async getAthlete(userId) {
    const { data } = await supabase.from('athletes').select('*').eq('user_id', userId).single();
    return data;
  },
  async upsertAthlete(athlete) {
    if (athlete.id) {
      const { id, user_id, created_at, updated_at, ...fields } = athlete;
      const { data, error } = await supabase
        .from('athletes')
        .update(fields)
        .eq('id', id)
        .eq('user_id', user_id)  // RLS needs user_id match
        .select()
        .single();
      if (error) {
        console.error('upsertAthlete update error:', error.message, error.code);
        throw error;
      }
      return data;
    } else {
      const { updated_at, ...insertFields } = athlete;
      const { data, error } = await supabase
        .from('athletes')
        .insert(insertFields)
        .select()
        .single();
      if (error) {
        console.error('upsertAthlete insert error:', error.message, error.code);
        throw error;
      }
      return data;
    }
  },

  // ── Technique lists ───────────────────────────────────────────────────────────
  async getTechniques(athleteId) {
    const { data } = await supabase.from('technique_lists').select('*').eq('athlete_id', athleteId).single();
    return data;
  },
  async upsertTechniques(athleteId, lists) {
    await supabase.from('technique_lists').upsert(
      { athlete_id: athleteId, ...lists, updated_at: new Date().toISOString() },
      { onConflict: 'athlete_id' }
    );
  },

  // ── Rolls ─────────────────────────────────────────────────────────────────────
  async getRolls(athleteId) {
    const { data } = await supabase.from('rolls').select('*').eq('athlete_id', athleteId).order('started_at', { ascending: false });
    return data || [];
  },
  async upsertRoll(roll) {
    const dbRoll = toDbRoll(roll);
    if (!dbRoll.athlete_id || !dbRoll.id) {
      console.error('upsertRoll: missing athlete_id or id');
      return;
    }
    // Try insert first
    const { error: insertError } = await supabase.from('rolls').insert(dbRoll);
    if (insertError) {
      // If duplicate, update instead
      if (insertError.code === '23505') {
        const { error: updateError } = await supabase.from('rolls').update(dbRoll).eq('id', dbRoll.id);
        if (updateError) console.error('roll update error:', updateError.message);
      } else {
        console.error('roll insert error:', insertError.message);
      }
    }
  },
  async deleteRoll(id) {
    await supabase.from('rolls').delete().eq('id', id);
  },

  // ── Training days ─────────────────────────────────────────────────────────────
  async getTrainingDays(athleteId) {
    const { data } = await supabase.from('training_days').select('date').eq('athlete_id', athleteId);
    return (data || []).map(r => r.date);
  },
  async logTrainingDay(athleteId, date) {
    await supabase.from('training_days').upsert(
      { athlete_id: athleteId, date },
      { onConflict: 'athlete_id,date' }
    );
  },
  async removeTrainingDay(athleteId, date) {
    await supabase.from('training_days').delete().eq('athlete_id', athleteId).eq('date', date);
  },

  // ── Academy Leaderboard ───────────────────────────────────────────────────────
  async getAcademyLeaderboard(academyId) {
    // Fetch athletes, their training days, rolls, and competitions for the academy
    const [{ data: aths }, { data: days }, { data: rolls }, { data: comps }] = await Promise.all([
      supabase.from('athletes').select('id, name, belt, stripes, user_id').eq('academy_id', academyId),
      supabase.from('training_days').select('athlete_id, date'),
      supabase.from('rolls').select('athlete_id, started_at, roll_result, event_log'),
      supabase.from('competitions').select('athlete_id, rounds:competition_rounds(result)'),
    ]);
    return { athletes: aths||[], days: days||[], rolls: rolls||[], comps: comps||[] };
  },
  async getUserSettings(userId) {
    const { data } = await supabase.from('user_settings')
      .select('tutorial_done, skipped_logs, consent_agreed, consent_version')
      .eq('user_id', userId).maybeSingle();
    return data || { tutorial_done: false, skipped_logs: [], consent_agreed: false, consent_version: '' };
  },
  async recordConsent(userId) {
    const { error } = await supabase.from('user_settings')
      .upsert({
        user_id: userId,
        consent_agreed: true,
        consent_version: '1.0',
        consent_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    if (error) console.error('recordConsent error:', error.message);
  },
  async setTutorialDone(userId) {
    const { error } = await supabase.from('user_settings')
      .upsert({ user_id: userId, tutorial_done: true, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' });
    if (error) console.error('setTutorialDone error:', error.message);
  },
  async skipClassLog(userId, logId, currentSkipped=[]) {
    const updated = [...new Set([...currentSkipped, logId])];
    const { error } = await supabase.from('user_settings')
      .upsert({ user_id: userId, skipped_logs: updated, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' });
    if (error) console.error('skipClassLog error:', error.message);
    return updated;
  },
  async getClassLogs(academyId) {
    const { data } = await supabase.from('class_logs').select('*')
      .eq('academy_id', academyId).order('date', { ascending: false }).limit(20);
    return data || [];
  },
  async createClassLog(log) {
    const { data, error } = await supabase.from('class_logs').insert({
      id: uid(), coach_id: log.coachId, academy_id: log.academyId,
      date: log.date, session_type: log.sessionType,
      techniques: log.techniques, notes: log.notes,
    }).select().single();
    if (error) throw error;
    return data;
  },
  async updateClassLog(id, updates) {
    const { error } = await supabase.from('class_logs').update({
      date: updates.date, session_type: updates.sessionType,
      techniques: updates.techniques, notes: updates.notes,
    }).eq('id', id);
    if (error) throw error;
  },
  async getJournalEntries(athleteId) {
    const { data } = await supabase.from('journal_entries').select('*')
      .eq('athlete_id', athleteId).order('date', { ascending: false });
    return data || [];
  },
  async upsertJournalEntry(entry) {
    if (entry.isEdit) {
      // Editing an existing entry
      const { error } = await supabase.from('journal_entries').update({
        date: entry.date, session_type: entry.sessionType,
        techniques: entry.techniques, notes: entry.notes,
        updated_at: new Date().toISOString(),
      }).eq('id', entry.id);
      if (error) console.error('journal update error:', error.message);
    } else {
      // New entry — always insert
      const { error } = await supabase.from('journal_entries').insert({
        id: entry.id, athlete_id: entry.athleteId,
        date: entry.date, session_type: entry.sessionType,
        techniques: entry.techniques, notes: entry.notes,
        class_log_id: entry.classLogId || null,
      });
      if (error) console.error('journal insert error:', error.message);
    }
  },
  async deleteJournalEntry(id) {
    await supabase.from('journal_entries').delete().eq('id', id);
  },
  async getCompetitions(athleteId) {
    const { data } = await supabase
      .from('competitions').select('*, competition_rounds(*)')
      .eq('athlete_id', athleteId).order('created_at', { ascending: false });
    return (data || []).map(fromDbComp);
  },
  async upsertCompetition(comp, athleteId) {
    const { rounds, ...compData } = comp;
    await supabase.from('competitions').upsert({ ...compData, athlete_id: athleteId });
  },
  async upsertRound(round, competitionId, athleteId) {
    await supabase.from('competition_rounds').upsert(toDbRound(round, competitionId, athleteId));
  },
  async deleteCompetition(id) {
    await supabase.from('competitions').delete().eq('id', id);
  },
};

// ── Shape converters: app ↔ database ─────────────────────────────────────────
function toDbRoll(r) {
  return {
    id: r.id, athlete_id: r.athleteId,
    partner: r.partner, started_at: r.startedAt, ended_at: r.endedAt,
    end_type: r.endType, submission_name: r.submissionName,
    submission_winner: r.submissionWinner, roll_result: r.rollResult,
    duration: r.duration, is_active: r.isActive || false,
    event_log: r.eventLog || [],
    sub_counts: r.subCounts || {}, sweep_counts: r.sweepCounts || {},
    pos_durations: r.posDurations || {}, trans_counts: r.transCounts || {},
    guard_pass_counts: r.guardPassCounts || {},
    opp_sub_counts: r.opp_subCounts || {}, opp_sweep_counts: r.opp_sweepCounts || {},
    opp_pos_durations: r.opp_posDurations || {}, opp_trans_counts: r.opp_transCounts || {},
    opp_guard_pass_counts: r.opp_guardPassCounts || {},
    paused: r.paused || false, paused_at: r.pausedAt, total_paused_ms: r.totalPausedMs || 0,
  };
}
function fromDbRoll(r) {
  return {
    id: r.id, athleteId: r.athlete_id,
    partner: r.partner, startedAt: r.started_at, endedAt: r.ended_at,
    endType: r.end_type, submissionName: r.submission_name,
    submissionWinner: r.submission_winner, rollResult: r.roll_result,
    duration: r.duration, isActive: r.is_active,
    eventLog: r.event_log || [],
    subCounts: r.sub_counts || {}, sweepCounts: r.sweep_counts || {},
    posDurations: r.pos_durations || {}, transCounts: r.trans_counts || {},
    guardPassCounts: r.guard_pass_counts || {},
    opp_subCounts: r.opp_sub_counts || {}, opp_sweepCounts: r.opp_sweep_counts || {},
    opp_posDurations: r.opp_pos_durations || {}, opp_transCounts: r.opp_trans_counts || {},
    opp_guardPassCounts: r.opp_guard_pass_counts || {},
    paused: r.paused, pausedAt: r.paused_at, totalPausedMs: r.total_paused_ms || 0,
  };
}
function toDbRound(r, competitionId, athleteId) {
  return {
    id: r.id, competition_id: competitionId, athlete_id: athleteId,
    opponent: r.opponent, opp_abbr: r.oppAbbr, opp_belt: r.oppBelt, opp_stripes: r.oppStripes,
    result: r.result, method: r.method, end_type: r.endType,
    submission_name: r.submissionName, submission_winner: r.submissionWinner,
    match_time: r.matchTime, started_at: r.startedAt, ended_at: r.endedAt,
    is_active: r.isActive || false, event_log: r.eventLog || [],
    sub_counts: r.subCounts || {}, sweep_counts: r.sweepCounts || {},
    pos_durations: r.posDurations || {}, trans_counts: r.transCounts || {},
    guard_pass_counts: r.guardPassCounts || {},
    opp_sub_counts: r.opp_subCounts || {}, opp_sweep_counts: r.opp_sweepCounts || {},
    opp_pos_durations: r.opp_posDurations || {}, opp_trans_counts: r.opp_transCounts || {},
    opp_guard_pass_counts: r.opp_guardPassCounts || {},
    paused: r.paused || false, paused_at: r.pausedAt, total_paused_ms: r.totalPausedMs || 0,
  };
}
function fromDbRound(r) {
  return {
    id: r.id, opponent: r.opponent, oppAbbr: r.opp_abbr, oppBelt: r.opp_belt, oppStripes: r.opp_stripes,
    result: r.result, method: r.method, endType: r.end_type,
    submissionName: r.submission_name, submissionWinner: r.submission_winner,
    matchTime: r.match_time, startedAt: r.started_at, endedAt: r.ended_at,
    isActive: r.is_active, eventLog: r.event_log || [],
    subCounts: r.sub_counts || {}, sweepCounts: r.sweep_counts || {},
    posDurations: r.pos_durations || {}, transCounts: r.trans_counts || {},
    guardPassCounts: r.guard_pass_counts || {},
    opp_subCounts: r.opp_sub_counts || {}, opp_sweepCounts: r.opp_sweep_counts || {},
    opp_posDurations: r.opp_pos_durations || {}, opp_transCounts: r.opp_trans_counts || {},
    opp_guardPassCounts: r.opp_guard_pass_counts || {},
    paused: r.paused, pausedAt: r.paused_at, totalPausedMs: r.total_paused_ms || 0,
  };
}
function fromDbComp(c) {
  return {
    id: c.id, name: c.name, date: c.date, location: c.location,
    gi: c.gi, notes: c.notes,
    bracketSize: c.bracket_size || '',
    medal: c.medal || 'none',
    rounds: (c.competition_rounds || []).map(fromDbRound),
  };
}

// ─── Typography helpers ─────────────────────────────────────────────────────────
// Inter for all UI / body text
// DM Serif Display for headings, large numbers, scores — more legible at size
const F = {
  body:    'Inter_400Regular',
  medium:  'Inter_500Medium',
  semi:    'Inter_600SemiBold',
  bold:    'Inter_700Bold',
  display: 'DMSerifDisplay_400Regular',
  // Aliases so existing fontFamily references still resolve
  light:   'Inter_400Regular',
  regular: 'Inter_400Regular',
  extra:   'Inter_700Bold',
  black:   'DMSerifDisplay_400Regular',
};

// ─── Reusable style helpers ─────────────────────────────────────────────────────
const s = StyleSheet.create({
  row:    { flexDirection:'row', alignItems:'center' },
  col:    { flexDirection:'column' },
  center: { alignItems:'center', justifyContent:'center' },
  flex1:  { flex:1 },
  fill:   { position:'absolute', top:0, left:0, right:0, bottom:0 },
  card:   { backgroundColor:C.card, borderWidth:1, borderColor:C.border },
  input:  { backgroundColor:'transparent', borderBottomWidth:1, borderBottomColor:C.borderMid, color:C.text, fontSize:15, paddingVertical:10, paddingHorizontal:0, fontFamily:F.body },
  label:  { fontSize:10, letterSpacing:1.5, textTransform:'uppercase', color:C.muted, fontFamily:F.semi, marginBottom:6 },
  btn:    { minHeight:48, alignItems:'center', justifyContent:'center', paddingHorizontal:16 },
  btnGold:{ backgroundColor:C.gold, minHeight:48, alignItems:'center', justifyContent:'center', paddingHorizontal:20 },
  btnSage:{ backgroundColor:C.sage, minHeight:48, alignItems:'center', justifyContent:'center', paddingHorizontal:20 },
  btnRed: { backgroundColor:C.red,  minHeight:48, alignItems:'center', justifyContent:'center', paddingHorizontal:20 },
  btnGhost:{ borderWidth:1, borderColor:C.border, minHeight:44, alignItems:'center', justifyContent:'center', paddingHorizontal:16 },
  btnText:{ fontSize:10, letterSpacing:2, textTransform:'uppercase', fontFamily:F.semi },
  tag:    { borderWidth:1, paddingHorizontal:6, paddingVertical:2 },
});

// ─── Primitive UI components ────────────────────────────────────────────────────
// Txt  — Inter body text, readable at any size
// Cap  — Inter semi uppercase label, tighter tracking
// Num  — DM Serif Display for numbers, scores, stats
const Txt  = ({ style, ...p }) => <Text style={[{ fontFamily:F.body, fontSize:15, color:C.text, lineHeight:22 }, style]} {...p}/>;
const Cap  = ({ style, ...p }) => <Text style={[{ fontFamily:F.semi, fontSize:11, letterSpacing:1, textTransform:'uppercase', color:C.muted }, style]} {...p}/>;
const Num  = ({ style, ...p }) => <Text style={[{ fontFamily:F.display, color:C.text }, style]} {...p}/>;
const Rule = () => <View style={{ height:1, backgroundColor:C.border, marginVertical:14 }}/>;

// ─── Theme Toggle Button ────────────────────────────────────────────────────────
function ThemeToggle({ isDark, onToggle }) {
  return (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.75}
      style={{ flexDirection:'row', alignItems:'center', gap:6,
        borderWidth:1, borderColor:C.border,
        backgroundColor:C.faint,
        paddingHorizontal:10, paddingVertical:6, borderRadius:2 }}>
      <Txt style={{ fontSize:14, lineHeight:18 }}>{isDark ? '☀️' : '🌙'}</Txt>
      <Txt style={{ fontSize:8, fontFamily:F.semi, letterSpacing:1.5,
        textTransform:'uppercase', color:C.muted }}>
        {isDark ? 'Light' : 'Dark'}
      </Txt>
    </TouchableOpacity>
  );
}

function Btn({ label, onPress, color=C.gold, textColor='#0F0F0D', style, disabled, outline }) {
  return (
    <TouchableOpacity
      onPress={onPress} disabled={disabled} activeOpacity={0.75}
      style={[{ minHeight:48, alignItems:'center', justifyContent:'center', paddingHorizontal:20,
        backgroundColor: outline ? 'transparent' : (disabled ? C.faint : color),
        borderWidth: outline ? 1 : 0, borderColor: outline ? C.border : 'transparent',
        opacity: disabled ? 0.45 : 1 }, style]}>
      <Txt style={{ fontSize:9, letterSpacing:2.5, textTransform:'uppercase', fontFamily:F.bold, color: outline ? C.muted : textColor }}>{label}</Txt>
    </TouchableOpacity>
  );
}

function FieldInput({ label, value, onChangeText, placeholder, multiline, keyboardType, style }) {
  return (
    <View style={{ marginBottom:16 }}>
      {label && <Cap style={{ marginBottom:6 }}>{label}</Cap>}
      <TextInput
        value={value} onChangeText={onChangeText} placeholder={placeholder}
        placeholderTextColor={C.muted} multiline={multiline}
        keyboardType={keyboardType || 'default'}
        style={[s.input, multiline && { height:80, textAlignVertical:'top', paddingTop:8 }, style]}/>
    </View>
  );
}

// ─── Confirm Dialog ────────────────────────────────────────────────────────────
function ConfirmDialog({ visible, message, onConfirm, onCancel, confirmLabel='Confirm', confirmColor=C.red }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex:1, backgroundColor:'rgba(10,10,8,0.93)', alignItems:'center', justifyContent:'center', padding:24 }}>
        <View style={{ backgroundColor:C.surface, borderWidth:1, borderColor:C.borderMid, maxWidth:320, width:'100%', padding:24 }}>
          <Txt style={{ fontSize:14, lineHeight:22, marginBottom:20, color:C.text }}>{message}</Txt>
          <View style={s.row}>
            <TouchableOpacity onPress={onCancel} activeOpacity={0.75} style={[s.btnGhost, { flex:1, marginRight:8 }]}>
              <Txt style={{ fontSize:9, letterSpacing:2, textTransform:'uppercase', fontFamily:F.semi, color:C.muted }}>Cancel</Txt>
            </TouchableOpacity>
            <TouchableOpacity onPress={onConfirm} activeOpacity={0.75} style={[{ flex:1, minHeight:44, alignItems:'center', justifyContent:'center', backgroundColor:confirmColor }]}>
              <Txt style={{ fontSize:9, letterSpacing:2, textTransform:'uppercase', fontFamily:F.bold, color:C.offWhite }}>{confirmLabel}</Txt>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function useConfirm() {
  const [dialog, setDialog] = useState(null);
  const confirm = useCallback((message, confirmLabel='Confirm', confirmColor=C.red) =>
    new Promise(resolve => setDialog({ message, confirmLabel, confirmColor, resolve })), []);
  const Dialog = dialog ? (
    <ConfirmDialog
      visible={true} message={dialog.message}
      confirmLabel={dialog.confirmLabel} confirmColor={dialog.confirmColor}
      onConfirm={() => { dialog.resolve(true); setDialog(null); }}
      onCancel={() => { dialog.resolve(false); setDialog(null); }}/>
  ) : null;
  return [confirm, Dialog];
}

// ─── GSL Logo — uses the actual brand PNG asset ────────────────────────────────
const GSL_LOGO = require('./assets/icon.png');

function GSLLogo({ size=32 }) {
  return (
    <Image
      source={GSL_LOGO}
      style={{ width:size, height:size, borderRadius: size * 0.13 }}
      resizeMode="contain"
    />
  );
}

function GSLLogoHero({ size=80 }) {
  return <GSLLogo size={size}/>;
}


// ─── Belt Badge ─────────────────────────────────────────────────────────────────
function BeltBadge({ belt='white', stripes=0, size='sm' }) {
  const bc = BELT_COLORS[belt] || BELT_COLORS.white;
  const h  = size === 'lg' ? 28 : 18;
  return (
    <View style={{ flexDirection:'row', alignItems:'center' }}>
      <View style={{ height:h, backgroundColor:bc.bg, borderWidth:1, borderColor:C.border, flexDirection:'row', alignItems:'center', paddingHorizontal: size==='lg'?10:6, minWidth:size==='lg'?80:56 }}>
        <Txt style={{ fontSize:size==='lg'?9:7, fontFamily:F.bold, letterSpacing:2, textTransform:'uppercase', color:bc.text }}>{bc.label}</Txt>
        {stripes > 0 && (
          <View style={{ flexDirection:'row', gap:2, marginLeft:3 }}>
            {Array.from({ length:stripes }).map((_,i) => (
              <View key={i} style={{ width:size==='lg'?6:4, height:size==='lg'?16:11, backgroundColor: belt==='black'?C.gold:'#F5F3EF', borderWidth: belt==='black'?0:1, borderColor:'rgba(0,0,0,0.15)' }}/>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Profile Avatar ─────────────────────────────────────────────────────────────
function ProfileAvatar({ name='?', size=36, belt='white' }) {
  const bc = BELT_COLORS[belt] || BELT_COLORS.white;
  const initials = name.trim().split(/\s+/).map(w=>w[0]||'').join('').slice(0,2).toUpperCase() || '?';
  return (
    <View style={{ width:size, height:size, backgroundColor:bc.bg, borderWidth:2, borderColor:bc.bg==='#E8E4DC'?C.border:bc.bg, alignItems:'center', justifyContent:'center' }}>
      <Txt style={{ fontSize:size*0.38, fontFamily:F.display, color:bc.text }}>{initials}</Txt>
    </View>
  );
}

// ─── Donut Chart ────────────────────────────────────────────────────────────────
function Donut({ data, isTime=false, size=180 }) {
  const cx=size/2, cy=size/2, r=size*.36, ir=size*.22;
  const total = data.reduce((s,d) => s+d.value, 0);
  const fmt   = isTime ? fmtSecs : v => String(v);
  if (!total) return (
    <View style={{ alignItems:'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={r} fill={C.faint}/>
        <Circle cx={cx} cy={cy} r={ir} fill={C.card}/>
      </Svg>
      <Cap style={{ marginTop:6 }}>No data</Cap>
    </View>
  );
  let angle = -Math.PI/2;
  const slices = data.filter(d=>d.value>0).map((d,i) => {
    const pct=d.value/total, a0=angle, a1=angle+pct*2*Math.PI; angle=a1;
    const [x1,y1,x2,y2] = [cx+r*Math.cos(a0),cy+r*Math.sin(a0),cx+r*Math.cos(a1),cy+r*Math.sin(a1)];
    const [ix1,iy1,ix2,iy2] = [cx+ir*Math.cos(a0),cy+ir*Math.sin(a0),cx+ir*Math.cos(a1),cy+ir*Math.sin(a1)];
    const large = pct>.5?1:0;
    return { d:`M${ix1} ${iy1}L${x1} ${y1}A${r} ${r} 0 ${large} 1 ${x2} ${y2}L${ix2} ${iy2}A${ir} ${ir} 0 ${large} 0 ${ix1} ${iy1}Z`, color:PIE[i%PIE.length], label:d.label, value:d.value };
  });
  return (
    <View style={{ alignItems:'center' }}>
      <Svg width={size} height={size}>
        {slices.map((sl,i) => <Path key={i} d={sl.d} fill={sl.color} stroke={C.card} strokeWidth="2"/>)}
        <Circle cx={cx} cy={cy} r={ir} fill={C.card}/>
      </Svg>
      <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6, justifyContent:'center', marginTop:8, maxWidth:size+40 }}>
        {slices.map((sl,i) => (
          <View key={i} style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
            <View style={{ width:7, height:7, backgroundColor:sl.color }}/>
            <Txt style={{ fontSize:10, color:C.textDim }}>{sl.label} </Txt>
            <Txt style={{ fontSize:10, color:sl.color, fontFamily:F.semi }}>{fmt(sl.value)}</Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Score Comparison ───────────────────────────────────────────────────────────
function ScoreComparison({ roll, compact=false }) {
  const myEv  = (roll.eventLog||[]).filter(e=>e.side==='me'&&e.scored);
  const opEv  = (roll.eventLog||[]).filter(e=>e.side==='opp'&&e.scored);
  const myPts = myEv.filter(e=>e.pts>0).reduce((a,e)=>a+(e.pts||0), 0);
  const opPts = opEv.filter(e=>e.pts>0).reduce((a,e)=>a+(e.pts||0), 0);
  const myAdv = myEv.filter(e=>e.scoreKey==='advantage').length;
  const opAdv = opEv.filter(e=>e.scoreKey==='advantage').length;
  const myGP  = myEv.filter(e=>e.scoreKey==='guardPull').length;
  const opGP  = opEv.filter(e=>e.scoreKey==='guardPull').length;

  // Only show point-scoring events in the main rows
  const ptRows = Object.entries(SCORE_EVENTS)
    .filter(([,ev]) => ev.pts > 0)
    .map(([key,ev]) => ({
      key, label:ev.label, color:ev.color,
      myPts: myEv.filter(e=>e.scoreKey===key).reduce((a,e)=>a+(e.pts||0),0),
      opPts: opEv.filter(e=>e.scoreKey===key).reduce((a,e)=>a+(e.pts||0),0),
      myN: myEv.filter(e=>e.scoreKey===key).length,
      opN: opEv.filter(e=>e.scoreKey===key).length,
    }));

  if (compact) return (
    <View style={s.row}>
      <View style={{ backgroundColor:C.goldDim, borderWidth:1, borderColor:`${C.gold}33`, paddingHorizontal:10, paddingVertical:6, alignItems:'center', minWidth:52 }}>
        <Txt style={{ fontSize:22, fontFamily:F.display, color:C.gold, lineHeight:26 }}>{myPts}</Txt>
        <Cap style={{ fontSize:7, color:C.muted }}>You</Cap>
        {myAdv>0&&<Txt style={{fontSize:8,color:C.sand,fontFamily:F.semi}}>+{myAdv} adv</Txt>}
      </View>
      <Txt style={{ fontSize:11, color:C.border, fontFamily:F.semi, marginHorizontal:10 }}>—</Txt>
      <View style={{ backgroundColor:C.oppSoft, borderWidth:1, borderColor:`${C.opp}33`, paddingHorizontal:10, paddingVertical:6, alignItems:'center', minWidth:52 }}>
        <Txt style={{ fontSize:22, fontFamily:F.display, color:C.stone, lineHeight:26 }}>{opPts}</Txt>
        <Cap style={{ fontSize:7, color:C.muted }}>Opp</Cap>
        {opAdv>0&&<Txt style={{fontSize:8,color:C.sand,fontFamily:F.semi}}>+{opAdv} adv</Txt>}
      </View>
    </View>
  );
  return (
    <View style={{ borderWidth:1, borderColor:C.border }}>
      {/* Main score header */}
      <View style={{ flexDirection:'row' }}>
        <View style={{ flex:1, backgroundColor:C.faint, padding:16, borderRightWidth:1, borderRightColor:C.border }}>
          <Cap style={{ marginBottom:4 }}>You</Cap>
          <Txt style={{ fontSize:40, fontFamily:F.display, color:C.gold, lineHeight:44 }}>{myPts}</Txt>
          {myAdv>0 && <Txt style={{fontSize:10,color:C.sand,fontFamily:F.semi,marginTop:2}}>{myAdv} advantage{myAdv!==1?'s':''}</Txt>}
          {myGP>0  && <Txt style={{fontSize:10,color:C.sage,fontFamily:F.semi,marginTop:1}}>{myGP} guard pull{myGP!==1?'s':''}</Txt>}
        </View>
        <View style={{ flex:1, backgroundColor:C.faint, padding:16, alignItems:'flex-end' }}>
          <Cap style={{ marginBottom:4 }}>Opponent</Cap>
          <Txt style={{ fontSize:40, fontFamily:F.display, color:C.stone, lineHeight:44 }}>{opPts}</Txt>
          {opAdv>0 && <Txt style={{fontSize:10,color:C.sand,fontFamily:F.semi,marginTop:2,textAlign:'right'}}>{opAdv} advantage{opAdv!==1?'s':''}</Txt>}
          {opGP>0  && <Txt style={{fontSize:10,color:C.sage,fontFamily:F.semi,marginTop:1,textAlign:'right'}}>{opGP} guard pull{opGP!==1?'s':''}</Txt>}
        </View>
      </View>
      {/* Point-scoring rows */}
      {ptRows.map((row,i) => (
        <View key={row.key} style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:10, borderTopWidth:1, borderTopColor:C.border }}>
          <Txt style={{ width:36, fontSize:16, fontFamily:F.display, color:row.myPts>0?C.gold:C.faint }}>{row.myPts||'—'}</Txt>
          <View style={{ flex:1 }}>
            <Cap style={{ textAlign:'center', marginBottom:4 }}>{row.label}</Cap>
            <View style={{ flexDirection:'row', height:3, backgroundColor:C.faint }}>
              <View style={{ flex:row.myPts||0, backgroundColor:C.gold, minWidth:row.myPts>0?4:0 }}/>
              <View style={{ flex:row.opPts||0, backgroundColor:C.opp, minWidth:row.opPts>0?4:0 }}/>
            </View>
            <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:3 }}>
              <Cap style={{ fontSize:8 }}>{row.myN}×</Cap>
              <Cap style={{ fontSize:8 }}>{row.opN}×</Cap>
            </View>
          </View>
          <Txt style={{ width:36, fontSize:16, fontFamily:F.display, color:row.opPts>0?C.opp:C.faint, textAlign:'right' }}>{row.opPts||'—'}</Txt>
        </View>
      ))}
      {/* Advantages row — shown if any */}
      {(myAdv>0||opAdv>0) && (
        <View style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:10, borderTopWidth:1, borderTopColor:C.border, backgroundColor:`${C.sand}08` }}>
          <Txt style={{ width:36, fontSize:16, fontFamily:F.display, color:myAdv>0?C.sand:C.faint }}>{myAdv||'—'}</Txt>
          <View style={{ flex:1 }}>
            <Cap style={{ textAlign:'center', marginBottom:4, color:C.sand }}>Advantages</Cap>
            <View style={{ flexDirection:'row', height:3, backgroundColor:C.faint }}>
              <View style={{ flex:myAdv||0, backgroundColor:C.sand, minWidth:myAdv>0?4:0 }}/>
              <View style={{ flex:opAdv||0, backgroundColor:C.opp, minWidth:opAdv>0?4:0 }}/>
            </View>
          </View>
          <Txt style={{ width:36, fontSize:16, fontFamily:F.display, color:opAdv>0?C.opp:C.faint, textAlign:'right' }}>{opAdv||'—'}</Txt>
        </View>
      )}
    </View>
  );
}

// ─── Event Log ──────────────────────────────────────────────────────────────────
function EventLogPanel({ log=[], onDeleteEvent }) {
  if (!log.length) return <Cap style={{ textAlign:'center', marginVertical:32 }}>No events recorded</Cap>;
  const TC = { submission:C.red, sweep:C.gold, position:C.sage, transition:C.blue, guardPass:C.teal, takedown:C.blue, end:C.stone };

  return (
    <View>
      {[...log].reverse().map((ev,i) => {
        const isEnd = ev.type === 'end';

        // ── Final event — special card ──────────────────────────────────────
        if (isEnd) {
          const isSub  = ev.item === 'submission';
          const accent = isSub ? C.red : C.stone;
          return (
            <View key={ev.id||i} style={{ marginVertical:8, borderWidth:1, borderColor:`${accent}55`, backgroundColor:`${accent}0D` }}>
              <View style={{ flexDirection:'row', alignItems:'center', padding:12, gap:12 }}>
                <View style={{ width:32, height:32, backgroundColor:accent, alignItems:'center', justifyContent:'center' }}>
                  <Txt style={{ fontSize:16 }}>{isSub ? '🔒' : '⏱'}</Txt>
                </View>
                <View style={{ flex:1 }}>
                  <Cap style={{ color:accent, marginBottom:3 }}>{isSub ? 'Ended by submission' : 'Ended — time expired'}</Cap>
                  {isSub && ev.submissionName ? (
                    <Txt style={{ fontSize:14, fontFamily:F.bold, color:C.text }}>{ev.submissionName}</Txt>
                  ) : null}
                  {isSub && ev.submissionWinner ? (
                    <View style={{ marginTop:5, flexDirection:'row' }}>
                      <View style={{ borderWidth:1, borderColor:`${ev.submissionWinner==='me'?C.sage:C.red}55`, paddingHorizontal:7, paddingVertical:3 }}>
                        <Txt style={{ fontSize:9, fontFamily:F.semi, letterSpacing:1.5, textTransform:'uppercase', color:ev.submissionWinner==='me'?C.sage:C.red }}>
                          {ev.submissionWinner==='me' ? '✓ You tapped them out' : '✗ You tapped out'}
                        </Txt>
                      </View>
                    </View>
                  ) : null}
                  {!isSub && ev.duration ? (
                    <Txt style={{ fontSize:12, color:C.textDim, marginTop:3 }}>Duration: {ev.duration}</Txt>
                  ) : null}
                  <Txt style={{ fontSize:9, color:C.muted, marginTop:5 }}>{fmtTime(ev.ts)}</Txt>
                </View>
              </View>
            </View>
          );
        }

        // ── Regular event ──────────────────────────────────────────────────
        const sc = ev.side==='me' ? C.gold : C.stone;
        const tc = TC[ev.type] || C.muted;
        // Build contextual sub-line
        const contextParts = [];
        if (ev.fromPosition) contextParts.push(`from ${ev.fromPosition}`);
        if (ev.toPosition)   contextParts.push(`→ ${ev.toPosition}`);
        if (ev.guardPassed)  contextParts.push(`passed ${ev.guardPassed}`);
        if (ev.advType)      contextParts.push(ev.advType);
        const contextStr = contextParts.join(' · ');

        return (
          <View key={ev.id||i} style={{ flexDirection:'row', alignItems:'flex-start', paddingVertical:10, borderBottomWidth:1, borderBottomColor:C.border }}>
            <View style={{ width:4, height:4, backgroundColor:sc, marginTop:7, marginRight:12 }}/>
            <View style={{ flex:1 }}>
              <View style={{ flexDirection:'row', alignItems:'center', flexWrap:'wrap' }}>
                <Txt style={{ fontSize:13, fontFamily:F.medium }}>{ev.label||ev.item}</Txt>
                {ev.scored && ev.pts > 0 && (
                  <View style={{ marginLeft:8, borderWidth:1, borderColor:`${sc}44`, paddingHorizontal:5, paddingVertical:1 }}>
                    <Txt style={{ fontSize:8, color:sc, fontFamily:F.semi, letterSpacing:1.5 }}>+{ev.pts} PTS</Txt>
                  </View>
                )}
                {ev.scored && ev.pts === 0 && (
                  <View style={{ marginLeft:8, borderWidth:1, borderColor:`${C.sand}44`, paddingHorizontal:5, paddingVertical:1 }}>
                    <Txt style={{ fontSize:8, color:C.sand, fontFamily:F.semi, letterSpacing:1.5 }}>ADV</Txt>
                  </View>
                )}
              </View>
              {contextStr ? <Txt style={{ fontSize:10, color:C.teal, marginTop:3, fontFamily:F.medium }}>{contextStr}</Txt> : null}
              <View style={{ flexDirection:'row', marginTop:4 }}>
                <View style={{ borderWidth:1, borderColor:`${tc}33`, paddingHorizontal:4, paddingVertical:1, marginRight:8 }}>
                  <Txt style={{ fontSize:8, color:tc, letterSpacing:1.5, textTransform:'uppercase', fontFamily:F.semi }}>{ev.type}</Txt>
                </View>
                <Txt style={{ fontSize:10, color:C.muted }}>{ev.side==='me'?'You':'Opp'} · {fmtTime(ev.ts)}</Txt>
              </View>
            </View>
            {onDeleteEvent && (
              <TouchableOpacity onPress={()=>onDeleteEvent(ev.id)} style={{ padding:8 }} activeOpacity={0.7}>
                <Txt style={{ color:C.muted, fontSize:16 }}>✕</Txt>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── OptionList — stable component outside QuickScoreSheet to prevent keyboard dismissal ─
// MUST be defined outside QuickScoreSheet — if defined inside, every keystroke causes
// React to unmount/remount it (new function reference = new component) killing the keyboard.
function OptionList({ items, onPick, pts, accent, showPts=true,
                      showCustom, customVal, onCustomChange, onCustomSubmit,
                      onOpenCustom, onCloseCustom, inputRef, scrollRef,
                      allTechniques=[] }) {
  const suggestions = customVal.trim().length > 0
    ? allTechniques.filter(t =>
        fuzzyMatch(t, customVal) &&
        !items.includes(t)
      ).slice(0, 5)
    : [];

  return (
    <View style={{ flex:1 }}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always">
        {items.map(item => (
          <TouchableOpacity key={item} onPress={()=>onPick(item)} activeOpacity={0.75}
            style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center',
              padding:12, marginBottom:4, borderWidth:1, borderColor:C.border }}>
            <Txt style={{ fontSize:13, color:C.textDim, flex:1 }}>{item}</Txt>
            {showPts && pts !== undefined && (
              <View style={{ borderWidth:1, borderColor:`${accent}44`, paddingHorizontal:7, paddingVertical:2, marginLeft:8 }}>
                <Txt style={{ fontSize:9, color:accent, fontFamily:F.semi, letterSpacing:1.5 }}>
                  {pts>0?`+${pts} PTS`:'0 PTS'}
                </Txt>
              </View>
            )}
          </TouchableOpacity>
        ))}
        <View style={{ height:8 }}/>
      </ScrollView>

      {/* Pinned custom input — outside ScrollView so keyboard doesn't bury it */}
      {!showCustom ? (
        <TouchableOpacity onPress={onOpenCustom} activeOpacity={0.75}
          style={{ flexDirection:'row', alignItems:'center', padding:14, marginTop:8,
            borderWidth:1, borderStyle:'dashed', borderColor:C.borderMid }}>
          <Txt style={{ fontSize:16, color:C.muted, marginRight:10 }}>+</Txt>
          <Cap>Custom technique…</Cap>
        </TouchableOpacity>
      ) : (
        <View style={{ borderTopWidth:1, borderTopColor:C.borderMid, paddingTop:12, marginTop:4 }}>
          <Cap style={{ marginBottom:8, color:accent }}>Type your technique</Cap>

          {/* Predictive suggestions */}
          {suggestions.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="always" style={{ marginBottom:10 }}>
              <View style={{ flexDirection:'row', gap:6 }}>
                {suggestions.map(s => (
                  <TouchableOpacity key={s}
                    onPress={()=>{ onCustomChange(''); onCloseCustom(); onPick(s); }}
                    activeOpacity={0.75}
                    style={{ borderWidth:1, borderColor:`${accent}55`, backgroundColor:`${accent}12`,
                      paddingHorizontal:10, paddingVertical:7, flexDirection:'row', alignItems:'center', gap:4 }}>
                    <Txt style={{ fontSize:9, color:accent }}>↑</Txt>
                    <Txt style={{ fontSize:11, color:accent, fontFamily:F.medium }}>{s}</Txt>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          {/* Text input — stable reference, keyboard stays open */}
          <View style={{ flexDirection:'row', alignItems:'center', borderWidth:2, borderColor:accent }}>
            <TextInput
              ref={inputRef}
              value={customVal}
              onChangeText={onCustomChange}
              placeholder="e.g. Calf Slicer, Twister…"
              placeholderTextColor={C.muted}
              returnKeyType="done"
              blurOnSubmit={false}
              onSubmitEditing={onCustomSubmit}
              style={{ flex:1, color:C.text, fontSize:14, fontFamily:F.body,
                paddingVertical:14, paddingHorizontal:14 }}
            />
            <TouchableOpacity
              onPress={onCustomSubmit}
              disabled={!customVal.trim()} activeOpacity={0.75}
              style={{ backgroundColor:customVal.trim()?accent:C.faint,
                paddingHorizontal:16, paddingVertical:14 }}>
              <Txt style={{ fontSize:9, fontFamily:F.display,
                color:customVal.trim()?'#0F0F0D':C.muted, letterSpacing:1.5, textTransform:'uppercase' }}>Add</Txt>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={onCloseCustom}
            style={{ paddingVertical:10, alignItems:'center' }} activeOpacity={0.7}>
            <Cap style={{ color:C.muted }}>Cancel</Cap>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Quick Score Sheet (Modal bottom sheet) ─────────────────────────────────────
function QuickScoreSheet({ visible, isOpp, onClose, onRecord, allTechniques=[] }) {
  const [step,       setStep]       = useState('pick');
  const [scoreKey,   setScoreKey]   = useState(null);
  const [sel1,       setSel1]       = useState(null);
  const [customVal,  setCustomVal]  = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const scrollRef  = useRef(null);
  const inputRef   = useRef(null);
  const ac = isOpp ? C.stone : C.gold;

  const reset = () => { setStep('pick'); setScoreKey(null); setSel1(null); setCustomVal(''); setShowCustom(false); };
  const close = () => { onClose(); reset(); };

  const openCustom = () => {
    setShowCustom(true);
    setCustomVal('');
    setTimeout(() => {
      inputRef.current?.focus();
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 80);
  };

  const finish = (key, context={}) => { onRecord(key, context); close(); };

  const pickEvent = key => {
    const ev = SCORE_EVENTS[key];
    setScoreKey(key);
    setSel1(null); setCustomVal(''); setShowCustom(false);
    switch(ev.category) {
      case 'sweep':     setStep('sweep_startPos'); break;
      case 'takedown':  setStep('td_technique');   break;
      case 'guardPass': setStep('gp_guardType');   break;
      case 'guardPull': setStep('pull_endPos');     break;
      case 'advantage': setStep('adv_type');        break;
      default:          finish(key, {}); break;
    }
  };



  const stepHeaders = {
    pick:           'Record Score',
    sweep_startPos: 'Sweep · Starting Position',
    sweep_tech:     'Sweep · Technique',
    td_technique:   'Takedown · Technique',
    td_endPos:      'Takedown · End Position',
    gp_guardType:   'Guard Pass · Guard Passed',
    gp_technique:   'Guard Pass · Pass Technique',
    pull_endPos:    'Guard Pull · End Position',
    adv_type:       'Advantage · For What?',
  };

  const canGoBack = step !== 'pick';
  const handleBack = () => {
    switch(step) {
      case 'sweep_tech':   setStep('sweep_startPos'); setSel1(null); break;
      case 'td_endPos':    setStep('td_technique');   setSel1(null); break;
      case 'gp_technique': setStep('gp_guardType');   setSel1(null); break;
      default:             reset(); break;
    }
    setShowCustom(false); setCustomVal('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={{ flex:1, justifyContent:'flex-end', backgroundColor:'rgba(10,10,8,0.8)' }}>
        {/* Background tap closes sheet — but NOT when custom input is active */}
        {!showCustom
          ? <TouchableOpacity style={{ flex:1 }} activeOpacity={1} onPress={close}/>
          : <View style={{ flex:1 }}/>
        }
        <KeyboardAvoidingView
          behavior={Platform.OS==='ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}>
          <View style={{
            backgroundColor: C.surface,
            borderTopWidth: 1, borderTopColor: C.borderMid,
            paddingTop: 20, paddingHorizontal: 16,
            paddingBottom: Platform.OS==='ios' ? 36 : 16,
            maxHeight: '90%',
          }}>
            {/* Header */}
            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <View style={{ flexDirection:'row', alignItems:'center' }}>
                {canGoBack && (
                  <TouchableOpacity onPress={handleBack} style={{ marginRight:12, padding:4 }} activeOpacity={0.7}>
                    <Txt style={{ fontSize:20, color:C.muted }}>←</Txt>
                  </TouchableOpacity>
                )}
                <View>
                  <Cap style={{ marginBottom:2 }}>{isOpp?'Opponent':'You'}</Cap>
                  <Txt style={{ fontSize:14, fontFamily:F.semi, color:ac }}>{stepHeaders[step]||'Record Score'}</Txt>
                </View>
              </View>
              <TouchableOpacity onPress={close}
                style={{ width:32, height:32, borderWidth:1, borderColor:C.border, alignItems:'center', justifyContent:'center' }}
                activeOpacity={0.7}>
                <Txt style={{ color:C.muted, fontSize:14 }}>✕</Txt>
              </TouchableOpacity>
            </View>

            {/* Pick event */}
            {step==='pick' && (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always">
                {Object.entries(SCORE_EVENTS).map(([key,ev]) => (
                  <TouchableOpacity key={key} onPress={()=>pickEvent(key)} activeOpacity={0.75}
                    style={{ flexDirection:'row', alignItems:'center', padding:14, marginBottom:4, borderWidth:1, borderColor:C.border }}>
                    <Txt style={{ fontSize:18, width:26, textAlign:'center', marginRight:14 }}>{ev.icon}</Txt>
                    <View style={{ flex:1 }}>
                      <Txt style={{ fontSize:13, fontFamily:F.semi }}>{ev.label}</Txt>
                      <Cap style={{ marginTop:2, fontSize:8 }}>{ev.desc}</Cap>
                    </View>
                    <View style={{ borderWidth:1, borderColor:`${ev.color}44`, paddingHorizontal:8, paddingVertical:3 }}>
                      <Txt style={{ fontSize:9, color:ev.color, fontFamily:F.semi, letterSpacing:2 }}>{ev.pts>0?`+${ev.pts} PTS`:'ADV'}</Txt>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}


            {/* All OptionList steps share these keyboard/custom props */}
            {(step==='sweep_startPos'||step==='sweep_tech'||step==='td_technique'||step==='td_endPos'||step==='gp_guardType'||step==='gp_technique'||step==='pull_endPos'||step==='adv_type') && (() => {
              const sharedProps = {
                showCustom, customVal,
                onCustomChange: v => setCustomVal(v),
                onOpenCustom: openCustom,
                onCloseCustom: () => { setShowCustom(false); setCustomVal(''); },
                inputRef, scrollRef, allTechniques,
                accent: ac,
              };
              if (step==='sweep_startPos') return <OptionList {...sharedProps} items={DEF_POS} showPts={false}
                onCustomSubmit={()=>{ if(customVal.trim()){ const p=customVal.trim(); setCustomVal(''); setShowCustom(false); setSel1(p); setStep('sweep_tech'); }}}
                onPick={pos=>{ setSel1(pos); setStep('sweep_tech'); setShowCustom(false); setCustomVal(''); }}/>;
              if (step==='sweep_tech') return <OptionList {...sharedProps} items={DEF_SWEEPS} pts={2}
                onCustomSubmit={()=>{ if(customVal.trim()) finish('sweep',{technique:customVal.trim(),fromPosition:sel1}); }}
                onPick={tech=>finish('sweep',{technique:tech,fromPosition:sel1})}/>;
              if (step==='td_technique') return <OptionList {...sharedProps} items={DEF_TAKEDOWNS} showPts={false}
                onCustomSubmit={()=>{ if(customVal.trim()){ const t=customVal.trim(); setCustomVal(''); setShowCustom(false); setSel1(t); setStep('td_endPos'); }}}
                onPick={tech=>{ setSel1(tech); setStep('td_endPos'); setShowCustom(false); setCustomVal(''); }}/>;
              if (step==='td_endPos') return <OptionList {...sharedProps} items={DEF_POS} pts={2}
                onCustomSubmit={()=>{ if(customVal.trim()) finish('takedown',{technique:sel1,toPosition:customVal.trim()}); }}
                onPick={pos=>finish('takedown',{technique:sel1,toPosition:pos})}/>;
              if (step==='gp_guardType') return <OptionList {...sharedProps} items={DEF_GUARD_TYPES} showPts={false}
                onCustomSubmit={()=>{ if(customVal.trim()){ const g=customVal.trim(); setCustomVal(''); setShowCustom(false); setSel1(g); setStep('gp_technique'); }}}
                onPick={guard=>{ setSel1(guard); setStep('gp_technique'); setShowCustom(false); setCustomVal(''); }}/>;
              if (step==='gp_technique') return <OptionList {...sharedProps} items={DEF_GUARD_PASSES} pts={3}
                onCustomSubmit={()=>{ if(customVal.trim()) finish('guardPass',{guardPassed:sel1,technique:customVal.trim()}); }}
                onPick={tech=>finish('guardPass',{guardPassed:sel1,technique:tech})}/>;
              if (step==='pull_endPos') return <OptionList {...sharedProps} items={DEF_POS} pts={0}
                onCustomSubmit={()=>{ if(customVal.trim()) finish('guardPull',{toPosition:customVal.trim()}); }}
                onPick={pos=>finish('guardPull',{toPosition:pos})}/>;
              if (step==='adv_type') return <OptionList {...sharedProps} items={ADV_TYPES} pts={0}
                onCustomSubmit={()=>{ if(customVal.trim()) finish('advantage',{advType:customVal.trim()}); }}
                onPick={type=>finish('advantage',{advType:type})}/>;
            })()}

          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}



// ─── Counter Card ────────────────────────────────────────────────────────────────
function CounterCard({ item, count, onAdd, onRemove, disabled, ac=C.gold }) {
  return (
    <View style={{ flexDirection:'row', alignItems:'stretch', borderWidth:1, borderColor:C.border, opacity:disabled?0.35:1, minWidth:80 }}>
      <TouchableOpacity onPress={()=>!disabled&&onRemove(item)} activeOpacity={0.7} style={{ paddingHorizontal:12, paddingVertical:10, borderRightWidth:1, borderRightColor:C.border, alignItems:'center', justifyContent:'center' }}>
        <Txt style={{ fontSize:18, color:C.muted }}>−</Txt>
      </TouchableOpacity>
      <View style={{ flex:1, paddingVertical:6, paddingHorizontal:8, alignItems:'center' }}>
        <Txt style={{ fontSize:10, color:C.muted, textAlign:'center' }} numberOfLines={1}>{item}</Txt>
        <Txt style={{ fontSize:26, fontFamily:F.display, color:count>0?ac:C.border, lineHeight:32 }}>{count}</Txt>
      </View>
      <TouchableOpacity onPress={()=>!disabled&&onAdd(item)} activeOpacity={0.7} style={{ paddingHorizontal:14, paddingVertical:10, backgroundColor:disabled?C.faint:ac, alignItems:'center', justifyContent:'center' }}>
        <Txt style={{ fontSize:20, fontFamily:F.semi, color:disabled?C.muted:'#0F0F0D' }}>+</Txt>
      </TouchableOpacity>
    </View>
  );
}

// ─── Opp Toggle ─────────────────────────────────────────────────────────────────
function OppToggle({ isOpp, onChange }) {
  return (
    <View style={{ flexDirection:'row', borderWidth:1, borderColor:C.border, marginBottom:14 }}>
      <TouchableOpacity onPress={()=>onChange(false)} activeOpacity={0.75} style={{ flex:1, paddingVertical:10, alignItems:'center', backgroundColor:!isOpp?C.gold:'transparent' }}>
        <Txt style={{ fontSize:9, fontFamily:F.semi, letterSpacing:2, textTransform:'uppercase', color:!isOpp?'#0F0F0D':C.muted }}>You</Txt>
      </TouchableOpacity>
      <View style={{ width:1, backgroundColor:C.border }}/>
      <TouchableOpacity onPress={()=>onChange(true)} activeOpacity={0.75} style={{ flex:1, paddingVertical:10, alignItems:'center', backgroundColor:isOpp?C.opp:'transparent' }}>
        <Txt style={{ fontSize:9, fontFamily:F.semi, letterSpacing:2, textTransform:'uppercase', color:isOpp?C.offWhite:C.muted }}>Opponent</Txt>
      </TouchableOpacity>
    </View>
  );
}

// ─── Pause Button ────────────────────────────────────────────────────────────────
function PauseButton({ isPaused, onToggle, small=false }) {
  return (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.75}
      style={{ borderWidth:1, borderColor:isPaused?C.amber:C.border, backgroundColor:isPaused?C.amberSoft:'transparent',
        paddingHorizontal:small?12:18, paddingVertical:small?6:8, flexDirection:'row', alignItems:'center' }}>
      <Txt style={{ fontSize:9, fontFamily:F.semi, letterSpacing:2, textTransform:'uppercase', color:isPaused?C.amber:C.muted }}>{isPaused?'▶ Resume':'⏸ Pause'}</Txt>
    </TouchableOpacity>
  );
}

// ─── Position Timer Panel ────────────────────────────────────────────────────────
function PositionTimerPanel({ positions, durations, posCounts, onRecord, onAddPos, isPaused, isOpp }) {
  const [active, setActive]       = useState(null);
  const [liveElapsed, setLiveEl]  = useState(0);
  const [custom, setCustom]       = useState('');
  const [customSec, setCustomSec] = useState('');
  const startRef = useRef(null);
  const ivRef    = useRef(null);
  const ac       = isOpp ? C.opp : C.gold;

  useEffect(() => {
    if (isPaused && active) {
      clearInterval(ivRef.current);
      const sp = Math.round((Date.now()-startRef.current)/1000);
      if(sp>0) onRecord(active,sp,false);
      setActive(null); setLiveEl(0);
    }
  }, [isPaused]);
  useEffect(() => () => clearInterval(ivRef.current), []);

  const start = pos => {
    if (isPaused) return;
    if (active) { clearInterval(ivRef.current); onRecord(active, Math.round((Date.now()-startRef.current)/1000), false); }
    if (active===pos) { setActive(null); setLiveEl(0); return; }
    onRecord(pos,0,true); setActive(pos); setLiveEl(0); startRef.current=Date.now();
    ivRef.current = setInterval(() => setLiveEl(Math.round((Date.now()-startRef.current)/1000)), 500);
  };

  const sorted = [...positions].sort((a,b)=>(durations[b]||0)-(durations[a]||0));

  return (
    <View style={{ opacity:isPaused?0.4:1 }}>
      <Cap style={{ marginBottom:12 }}>Tap to start · tap again to stop</Cap>
      <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:16 }}>
        {sorted.map(pos => {
          const isOn = active===pos;
          const pk   = getPosPtsKey(pos);
          const pv   = pk ? SCORE_EVENTS[pk]?.pts||0 : 0;
          const pc   = pk ? SCORE_EVENTS[pk]?.color||null : null;
          const entries = posCounts[pos]||0;
          return (
            <TouchableOpacity key={pos} onPress={()=>start(pos)} activeOpacity={0.75}
              style={{ backgroundColor:isOn?ac:'transparent', borderWidth:1, borderColor:isOn?ac:(pc||C.border), padding:12 }}>
              <Txt style={{ fontSize:10, fontFamily:F.semi, letterSpacing:1.5, textTransform:'uppercase', color:isOn?'#0F0F0D':C.text }}>
                {isOn?'◼ ':'▶ '}{pos}
                {pv>0&&!isOn&&<Txt style={{ fontSize:8, color:pc, fontFamily:F.semi }}> +{pv}PTS</Txt>}
              </Txt>
              <Txt style={{ fontSize:9, color:isOn?'#0F0F0D':C.muted, marginTop:3 }}>
                {isOn ? `◉ ${fmtSecs(liveElapsed)}` : `${fmtSecs(durations[pos]||0)}${entries>0?` · ${entries}×`:''}`}
              </Txt>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={{ flexDirection:'row', gap:8 }}>
        <TextInput value={custom} onChangeText={setCustom} placeholder="New position…" placeholderTextColor={C.muted} style={[s.input, { flex:1 }]}/>
        <TextInput value={customSec} onChangeText={setCustomSec} placeholder="Sec" keyboardType="numeric" style={[s.input, { width:60 }]}/>
        <TouchableOpacity onPress={()=>{ if(custom.trim()){ onAddPos(custom.trim(),parseInt(customSec)||0); setCustom(''); setCustomSec(''); }}} activeOpacity={0.75} style={[s.btnGhost, { paddingHorizontal:14 }]}>
          <Txt style={[s.btnText, { color:C.muted }]}>Add</Txt>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Roll Tracking Panel ─────────────────────────────────────────────────────────
function RollTrackingPanel({ roll, onMutate, submissions, sweeps, positions, transitions, guardPulls, takedowns, setSubmissions, setSweeps, setPositions, setTransitions, setGuardPulls, setTakedowns }) {
  const SUBTABS = ['Score','Submissions','Sweeps','Guard Pass','Transitions','Positions','Event Log'];
  const [subTab, setSubTab]         = useState('Score');
  const [trackingOpp, setTracking]  = useState(false);
  const [scoreSheet, setScoreSheet] = useState(null); // 'me'|'opp'|null
  const [customSubInput, setCSI]    = useState('');
  const [customSwpInput, setCSW]    = useState('');

  const isPaused = !!roll.paused;
  const side     = trackingOpp ? 'opp' : 'me';
  const pf       = field => trackingOpp ? `opp_${field}` : field;
  const ac       = trackingOpp ? C.opp : C.gold;

  const logEvent = (type,item,label,scoreKey=null) => {
    const se = scoreKey ? SCORE_EVENTS[scoreKey] : null;
    const ev = { id:uid(), ts:Date.now(), side, type, item, label:label||(se?.label)||item, scoreKey, scored:!!scoreKey, pts:se?.pts||0 };
    onMutate(r => ({ ...r, eventLog:[...(r.eventLog||[]),ev] }));
  };

  const addCount = (field,item) => onMutate(r => ({ ...r, [pf(field)]:{...r[pf(field)],[item]:(r[pf(field)][item]||0)+1} }));
  const remCount = (field,item) => onMutate(r => ({ ...r, [pf(field)]:{...r[pf(field)],[item]:Math.max(0,(r[pf(field)][item]||0)-1)} }));

  const addSub  = item => { if(isPaused)return; addCount('subCounts',item); logEvent('submission',item,item); };
  const addSwp  = item => { if(isPaused)return; addCount('sweepCounts',item); logEvent('sweep',item,item,'sweep'); };
  const addGP   = item => { if(isPaused)return; addCount('guardPassCounts',item); logEvent('guardPass',item,item,'guardPass'); };
  const addTrans= item => { if(isPaused)return; const isTd=takedowns.includes(item); addCount('transCounts',item); logEvent('transition',item,item,isTd?'takedown':null); };
  const recPos  = (pos,secs,countEntry=false) => {
    onMutate(r => {
      const dk=pf('posDurations'), ck=pf('posCounts');
      const nd=secs>0?{...r[dk],[pos]:(r[dk][pos]||0)+secs}:r[dk];
      const nc=countEntry?{...r[ck],[pos]:(r[ck][pos]||0)+1}:r[ck];
      if(countEntry){ const sk=getPosPtsKey(pos); logEvent('position',pos,pos,sk||null); }
      return { ...r, [dk]:nd, [ck]:nc };
    });
  };
  const addNewPos=(pos,secs)=>{ if(!positions.includes(pos)) setPositions(ps=>[...ps,pos]); if(secs>0) recPos(pos,secs,true); };
  const addCustomSub=(n)=>{ if(!submissions.includes(n)) setSubmissions(ss=>[...ss,n]); addSub(n); };
  const addCustomSwp=(n)=>{ if(!sweeps.includes(n)) setSweeps(sw=>[...sw,n]); addSwp(n); };
  const addCustomTrans=(n,type)=>{
    if(!transitions.includes(n)) setTransitions(t=>[...t,n]);
    if(type==='Guard Pull'&&!guardPulls.includes(n)) setGuardPulls(g=>[...g,n]);
    if(type==='Takedown'&&!takedowns.includes(n)) setTakedowns(td=>[...td,n]);
    addTrans(n);
  };

  const quickScore = (isOpp, scoreKey, context={}) => {
    const se = SCORE_EVENTS[scoreKey]; if(!se) return;
    const s   = isOpp?'opp':'me';
    const pfx = isOpp?'opp_':'';

    // Build a rich human-readable label from context
    const buildLabel = () => {
      switch(scoreKey) {
        case 'sweep':
          return `Sweep${context.technique?`: ${context.technique}`:''}${context.fromPosition?` (from ${context.fromPosition})`:''}`;
        case 'takedown':
          return `Takedown${context.technique?`: ${context.technique}`:''}${context.toPosition?` → ${context.toPosition}`:''}`;
        case 'guardPass':
          return `Guard Pass${context.guardPassed?`: passed ${context.guardPassed}`:''}${context.technique?` via ${context.technique}`:''}`;
        case 'guardPull':
          return `Guard Pull${context.toPosition?` → ${context.toPosition}`:''}`;
        case 'advantage':
          return `Advantage${context.advType?`: ${context.advType}`:''}`;
        default:
          return se.label;
      }
    };

    const ev = {
      id:uid(), ts:Date.now(), side:s,
      type: se.category,
      item: context.technique || context.advType || context.toPosition || se.label,
      label: buildLabel(),
      scoreKey,
      scored: se.pts > 0,
      pts: se.pts,
      // Contextual fields
      fromPosition:  context.fromPosition  || null,
      toPosition:    context.toPosition    || null,
      technique:     context.technique     || null,
      guardPassed:   context.guardPassed   || null,
      advType:       context.advType       || null,
    };

    onMutate(r => {
      let u = { ...r, eventLog:[...(r.eventLog||[]),ev] };

      if (scoreKey==='sweep' && context.technique) {
        u[`${pfx}sweepCounts`] = { ...u[`${pfx}sweepCounts`], [context.technique]:(u[`${pfx}sweepCounts`][context.technique]||0)+1 };
        if (!sweeps.includes(context.technique)) setSweeps(sw=>[...sw,context.technique]);
        // Auto-record starting position entry
        if (context.fromPosition) {
          u[`${pfx}posCounts`] = { ...u[`${pfx}posCounts`], [context.fromPosition]:(u[`${pfx}posCounts`][context.fromPosition]||0)+1 };
        }
      }
      else if (scoreKey==='takedown' && context.technique) {
        u[`${pfx}transCounts`] = { ...u[`${pfx}transCounts`], [context.technique]:(u[`${pfx}transCounts`][context.technique]||0)+1 };
        if (!transitions.includes(context.technique)) setTransitions(t=>[...t,context.technique]);
        if (!takedowns.includes(context.technique))   setTakedowns(td=>[...td,context.technique]);
        // Auto-record end position
        if (context.toPosition) {
          u[`${pfx}posCounts`] = { ...u[`${pfx}posCounts`], [context.toPosition]:(u[`${pfx}posCounts`][context.toPosition]||0)+1 };
        }
      }
      else if (scoreKey==='guardPass') {
        const passKey = context.technique || context.guardPassed || 'Guard Pass';
        u[`${pfx}guardPassCounts`] = { ...u[`${pfx}guardPassCounts`], [passKey]:(u[`${pfx}guardPassCounts`][passKey]||0)+1 };
      }
      else if (scoreKey==='guardPull') {
        // Guard pull → record end position
        if (context.toPosition) {
          u[`${pfx}posCounts`] = { ...u[`${pfx}posCounts`], [context.toPosition]:(u[`${pfx}posCounts`][context.toPosition]||0)+1 };
        }
      }
      else if (scoreKey==='mount')       { u[`${pfx}posCounts`] = { ...u[`${pfx}posCounts`], 'Mount':(u[`${pfx}posCounts`]['Mount']||0)+1 }; }
      else if (scoreKey==='backControl') { u[`${pfx}posCounts`] = { ...u[`${pfx}posCounts`], 'Back Control':(u[`${pfx}posCounts`]['Back Control']||0)+1 }; }
      else if (scoreKey==='kneeOnBelly') { u[`${pfx}posCounts`] = { ...u[`${pfx}posCounts`], 'Knee on Belly':(u[`${pfx}posCounts`]['Knee on Belly']||0)+1 }; }

      return u;
    });
  };

  const deleteEvent = evId => onMutate(r => ({ ...r, eventLog:(r.eventLog||[]).filter(e=>e.id!==evId) }));

  const myPts  = (roll.eventLog||[]).filter(e=>e.side==='me'&&e.scored).reduce((a,e)=>a+(e.pts||0),0);
  const oppPts = (roll.eventLog||[]).filter(e=>e.side==='opp'&&e.scored).reduce((a,e)=>a+(e.pts||0),0);
  const ac_sub = trackingOpp?roll.opp_subCounts||{}:roll.subCounts||{};
  const aw     = trackingOpp?roll.opp_sweepCounts||{}:roll.sweepCounts||{};
  const ap     = trackingOpp?roll.opp_posDurations||{}:roll.posDurations||{};
  const ak     = trackingOpp?roll.opp_posCounts||{}:roll.posCounts||{};
  const at     = trackingOpp?roll.opp_transCounts||{}:roll.transCounts||{};
  const agp    = trackingOpp?roll.opp_guardPassCounts||{}:roll.guardPassCounts||{};
  const tdSet  = new Set(takedowns);
  const disabled = isPaused;

  return (
    <View>
      {/* Score bar */}
      <View style={{ flexDirection:'row', gap:4, marginBottom:14 }}>
        <TouchableOpacity onPress={()=>setScoreSheet('me')} activeOpacity={0.75}
          style={{ flex:1, backgroundColor:C.goldDim, borderWidth:1, borderColor:`${C.gold}33`, paddingVertical:12, alignItems:'center', opacity:isPaused?0.4:1 }}>
          <Cap style={{ color:C.gold, marginBottom:2 }}>You</Cap>
          <Txt style={{ fontSize:28, fontFamily:F.display, color:C.gold, lineHeight:32 }}>{myPts}</Txt>
          <Cap style={{ color:C.gold, fontSize:7 }}>Score</Cap>
        </TouchableOpacity>
        <View style={{ alignItems:'center', justifyContent:'center', paddingHorizontal:8 }}>
          <Txt style={{ fontSize:9, color:C.border, letterSpacing:2 }}>{isPaused?'PAUSED':'VS'}</Txt>
        </View>
        <TouchableOpacity onPress={()=>setScoreSheet('opp')} activeOpacity={0.75}
          style={{ flex:1, backgroundColor:C.oppSoft, borderWidth:1, borderColor:`${C.opp}33`, paddingVertical:12, alignItems:'center', opacity:isPaused?0.4:1 }}>
          <Cap style={{ color:C.stone, marginBottom:2 }}>Opponent</Cap>
          <Txt style={{ fontSize:28, fontFamily:F.display, color:C.stone, lineHeight:32 }}>{oppPts}</Txt>
          <Cap style={{ color:C.stone, fontSize:7 }}>Score</Cap>
        </TouchableOpacity>
      </View>

      <ScoreComparison roll={roll}/>
      <View style={{ height:18 }}/>

      {/* Sub-tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ borderBottomWidth:1, borderBottomColor:C.border, marginBottom:16 }}>
        {SUBTABS.map(t => (
          <TouchableOpacity key={t} onPress={()=>setSubTab(t)} activeOpacity={0.75}
            style={{ paddingHorizontal:14, paddingBottom:10, borderBottomWidth:2, borderBottomColor:subTab===t?C.gold:'transparent', marginRight:2 }}>
            <Txt style={{ fontSize:9, fontFamily:subTab===t?F.semi:F.body, color:subTab===t?C.gold:C.muted, letterSpacing:1.5, textTransform:'uppercase' }}>{t}</Txt>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {subTab!=='Score'&&subTab!=='Event Log' && <OppToggle isOpp={trackingOpp} onChange={setTracking}/>}

      {subTab==='Score' && <Cap style={{ textAlign:'center', marginVertical:16 }}>Tap the score buttons above to log points</Cap>}

      {subTab==='Submissions' && (
        <View>
          <Cap style={{ color:disabled?C.amber:ac, marginBottom:12 }}>{disabled?'Paused':'Tap + to record'}</Cap>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:12 }}>
            <View style={{ flexDirection:'row', gap:8 }}>
              {[...submissions].sort((a,b)=>(ac_sub[b]||0)-(ac_sub[a]||0)).map(item =>
                <CounterCard key={item} item={item} count={ac_sub[item]||0} onAdd={addSub} onRemove={i=>remCount('subCounts',i)} disabled={disabled} ac={ac}/>
              )}
            </View>
          </ScrollView>
          <View style={{ flexDirection:'row', gap:8 }}>
            <TextInput value={customSubInput} onChangeText={setCSI} placeholder="Add custom submission…" placeholderTextColor={C.muted} returnKeyType="done" onSubmitEditing={()=>{ if(customSubInput.trim()&&!disabled){ addCustomSub(customSubInput.trim()); setCSI(''); }}} style={[s.input,{flex:1}]}/>
            <TouchableOpacity onPress={()=>{ if(customSubInput.trim()&&!disabled){ addCustomSub(customSubInput.trim()); setCSI(''); }}} activeOpacity={0.75} style={[s.btnGhost,{paddingHorizontal:14}]}>
              <Txt style={[s.btnText,{color:C.muted}]}>Add</Txt>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {subTab==='Sweeps' && (
        <View>
          <Cap style={{ color:disabled?C.amber:ac, marginBottom:12 }}>{disabled?'Paused':'Each sweep = +2 pts'}</Cap>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:12 }}>
            <View style={{ flexDirection:'row', gap:8 }}>
              {[...sweeps].sort((a,b)=>(aw[b]||0)-(aw[a]||0)).map(item =>
                <CounterCard key={item} item={item} count={aw[item]||0} onAdd={addSwp} onRemove={i=>remCount('sweepCounts',i)} disabled={disabled} ac={ac}/>
              )}
            </View>
          </ScrollView>
          <View style={{ flexDirection:'row', gap:8 }}>
            <TextInput value={customSwpInput} onChangeText={setCSW} placeholder="Add custom sweep…" placeholderTextColor={C.muted} returnKeyType="done" onSubmitEditing={()=>{ if(customSwpInput.trim()&&!disabled){ addCustomSwp(customSwpInput.trim()); setCSW(''); }}} style={[s.input,{flex:1}]}/>
            <TouchableOpacity onPress={()=>{ if(customSwpInput.trim()&&!disabled){ addCustomSwp(customSwpInput.trim()); setCSW(''); }}} activeOpacity={0.75} style={[s.btnGhost,{paddingHorizontal:14}]}>
              <Txt style={[s.btnText,{color:C.muted}]}>Add</Txt>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {subTab==='Guard Pass' && (
        <View>
          <Cap style={{ color:C.teal, marginBottom:12 }}>{disabled?'Paused':'Guard pass = +3 pts'}</Cap>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection:'row', gap:8 }}>
              {DEF_GUARD_PASSES.map(item =>
                <CounterCard key={item} item={item} count={agp[item]||0} onAdd={addGP} onRemove={i=>remCount('guardPassCounts',i)} disabled={disabled} ac={trackingOpp?C.opp:C.teal}/>
              )}
            </View>
          </ScrollView>
        </View>
      )}

      {subTab==='Transitions' && (
        <View>
          <Cap style={{ color:C.blue, marginBottom:12 }}>{disabled?'Paused':'Takedowns = +2 pts'}</Cap>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:12 }}>
            <View style={{ flexDirection:'row', gap:8 }}>
              {[...transitions].sort((a,b)=>(at[b]||0)-(at[a]||0)).map(item => {
                const isTd = tdSet.has(item);
                return (
                  <View key={item} style={{ alignItems:'center', gap:3 }}>
                    <CounterCard item={item} count={at[item]||0} onAdd={addTrans} onRemove={i=>remCount('transCounts',i)} disabled={disabled} ac={isTd?C.blue:C.teal}/>
                    <Cap style={{ fontSize:7, color:isTd?C.blue:C.teal }}>{isTd?'TD':'PULL'}</Cap>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      )}

      {subTab==='Positions' && (
        <PositionTimerPanel positions={positions} durations={ap} posCounts={ak} onRecord={recPos} onAddPos={addNewPos} isPaused={isPaused} isOpp={trackingOpp}/>
      )}

      {subTab==='Event Log' && <EventLogPanel log={roll.eventLog||[]} onDeleteEvent={deleteEvent}/>}

      <QuickScoreSheet visible={scoreSheet!==null} isOpp={scoreSheet==='opp'} onClose={()=>setScoreSheet(null)}
        allTechniques={[...submissions, ...sweeps, ...positions, ...transitions, ...guardPulls, ...takedowns]}
        onRecord={(key,context)=>{ quickScore(scoreSheet==='opp',key,context||{}); setScoreSheet(null); }}/>
    </View>
  );
}

// ─── Roll Modal ─────────────────────────────────────────────────────────────────
function StartRollModal({ visible, onStart, onCancel }) {
  const [partner, setPartner] = useState('');
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios'?'padding':'height'}>
        <View style={{ flex:1, backgroundColor:'rgba(10,10,8,0.9)', alignItems:'center', justifyContent:'center', padding:24 }}>
          <View style={{ backgroundColor:C.surface, borderWidth:1, borderColor:C.borderMid, width:'100%', maxWidth:380, padding:24 }}>
            <Cap style={{ marginBottom:4 }}>Grounded Skills Lab</Cap>
            <Txt style={{ fontSize:16, fontFamily:F.bold, marginBottom:20 }}>Start New Roll</Txt>
            <FieldInput label="Partner Name (Optional)" value={partner} onChangeText={setPartner} placeholder="Training partner…"/>
            <View style={{ flexDirection:'row', gap:8, marginTop:8 }}>
              <Btn label="Start Roll" onPress={()=>{ onStart(partner.trim()); setPartner(''); }} style={{ flex:1 }}/>
              <Btn label="Cancel" onPress={()=>{ onCancel(); setPartner(''); }} outline style={{ flex:0, paddingHorizontal:20 }}/>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── End Roll Modal ─────────────────────────────────────────────────────────────
function EndRollModal({ visible, submissions, onEnd, onCancel }) {
  const [endType, setEndType]     = useState(null);
  const [winner, setWinner]       = useState('me');
  const [subName, setSubName]     = useState('');
  const [customSub, setCustomSub] = useState('');
  const [showCustom, setShowC]    = useState(false);
  const [duration, setDuration]   = useState('');
  const [notes, setNotes]         = useState('');
  const resolvedSub = showCustom ? customSub.trim() : subName;
  const canSave = endType==='time' || (endType==='submission' && resolvedSub);
  const reset = () => { setEndType(null); setWinner('me'); setSubName(''); setCustomSub(''); setShowC(false); setDuration(''); setNotes(''); };

  const ETBtn = ({ type, icon, label, desc }) => (
    <TouchableOpacity onPress={()=>{ setEndType(type); setSubName(''); setShowC(false); setCustomSub(''); }} activeOpacity={0.75}
      style={{ flex:1, borderWidth:2, borderColor:endType===type?C.gold:C.border, backgroundColor:endType===type?C.goldDim:'transparent', padding:14 }}>
      <Txt style={{ fontSize:20, marginBottom:6 }}>{icon}</Txt>
      <Txt style={{ fontSize:10, fontFamily:F.bold, letterSpacing:1.5, textTransform:'uppercase', color:endType===type?C.gold:C.textDim, marginBottom:4 }}>{label}</Txt>
      <Txt style={{ fontSize:9, color:C.muted, lineHeight:14 }}>{desc}</Txt>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={()=>{ onCancel(); reset(); }}>
      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios'?'padding':'height'}>
        <ScrollView contentContainerStyle={{ flexGrow:1, backgroundColor:'rgba(10,10,8,0.9)', alignItems:'center', justifyContent:'center', padding:24 }}>
          <View style={{ backgroundColor:C.surface, borderWidth:1, borderColor:C.borderMid, width:'100%', maxWidth:400, padding:24 }}>
            <Cap style={{ marginBottom:4 }}>Grounded Skills Lab</Cap>
            <Txt style={{ fontSize:16, fontFamily:F.bold, marginBottom:20 }}>How did it end?</Txt>
            <View style={{ flexDirection:'row', gap:8, marginBottom:20 }}>
              <ETBtn type="time" icon="⏱" label="Time Expired" desc="Match ended on the clock"/>
              <ETBtn type="submission" icon="🔒" label="Submission" desc="Someone tapped out"/>
            </View>
            {endType==='time' && <FieldInput label="Duration (optional)" value={duration} onChangeText={setDuration} placeholder="e.g. 6:00"/>}
            {endType==='submission' && (
              <>
                {/* Submission result — overrides points regardless */}
                <View style={{ borderWidth:1, borderColor:`${C.gold}44`, backgroundColor:C.goldDim, padding:10, marginBottom:14 }}>
                  <Txt style={{ fontSize:9, color:C.gold, fontFamily:F.semi, letterSpacing:1.5, textTransform:'uppercase', marginBottom:2 }}>⚡ Submission overrides points</Txt>
                  <Txt style={{ fontSize:11, color:C.textDim }}>Whoever gets the submission wins — regardless of score.</Txt>
                </View>
                <Cap style={{ marginBottom:8 }}>Who got the submission?</Cap>
                <View style={{ flexDirection:'row', gap:8, marginBottom:16 }}>
                  {[['me','I submitted them','WIN'],['opp','I was submitted','LOSS']].map(([val,lbl,outcome]) => (
                    <TouchableOpacity key={val} onPress={()=>setWinner(val)} activeOpacity={0.75}
                      style={{ flex:1, paddingVertical:12, borderWidth:2, borderColor:winner===val?(val==='me'?C.sage:C.red):C.border, alignItems:'center', backgroundColor:winner===val?(val==='me'?`${C.sage}18`:`${C.red}18`):'transparent' }}>
                      <Txt style={{ fontSize:11, fontFamily:F.display, color:winner===val?(val==='me'?C.sage:C.red):C.muted, marginBottom:3 }}>{outcome}</Txt>
                      <Txt style={{ fontSize:9, fontFamily:F.semi, letterSpacing:1, textTransform:'uppercase', color:winner===val?(val==='me'?C.sage:C.red):C.muted }}>{lbl}</Txt>
                    </TouchableOpacity>
                  ))}
                </View>
                <Cap style={{ marginBottom:8 }}>Submission Technique</Cap>
                <ScrollView style={{ maxHeight:160, borderWidth:1, borderColor:C.border, marginBottom:12 }} nestedScrollEnabled>
                  {(submissions||DEF_SUBS).map(sub => (
                    <TouchableOpacity key={sub} onPress={()=>{ setSubName(sub); setShowC(false); }} activeOpacity={0.75}
                      style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:12, borderBottomWidth:1, borderBottomColor:C.border, backgroundColor:subName===sub?C.faint:'transparent' }}>
                      <Txt style={{ fontSize:13, color:C.textDim }}>{sub}</Txt>
                      {subName===sub && <Txt style={{ color:C.gold }}>✓</Txt>}
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity onPress={()=>{ setShowC(true); setSubName(''); }} activeOpacity={0.75}
                    style={{ flexDirection:'row', alignItems:'center', padding:12, borderWidth:1, borderStyle:'dashed', borderColor:C.borderMid, margin:4 }}>
                    <Txt style={{ color:C.muted, marginRight:8, fontSize:18 }}>+</Txt>
                    <Cap>Custom technique…</Cap>
                  </TouchableOpacity>
                </ScrollView>
                {showCustom && (
                  <View>
                    {/* Predictive suggestions */}
                    {customSub.trim().length > 0 && submissions.filter(s =>
                      fuzzyMatch(s, customSub)
                    ).length > 0 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}
                        keyboardShouldPersistTaps="always" style={{ marginBottom:8 }}>
                        <View style={{ flexDirection:'row', gap:6 }}>
                          {submissions.filter(s =>
                            fuzzyMatch(s, customSub)
                          ).slice(0,5).map(s => (
                            <TouchableOpacity key={s} onPress={()=>{ setSubName(s); setCustomSub(''); setShowC(false); }}
                              activeOpacity={0.75}
                              style={{ borderWidth:1, borderColor:`${C.red}55`, backgroundColor:`${C.red}12`,
                                paddingHorizontal:10, paddingVertical:7, flexDirection:'row', alignItems:'center', gap:4 }}>
                              <Txt style={{ fontSize:9, color:C.red }}>↑</Txt>
                              <Txt style={{ fontSize:11, color:C.red, fontFamily:F.medium }}>{s}</Txt>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                    )}
                    <FieldInput value={customSub} onChangeText={setCustomSub} placeholder="e.g. Twister, Calf Slicer…"/>
                  </View>
                )}
                <FieldInput label="Duration (optional)" value={duration} onChangeText={setDuration} placeholder="e.g. 4:47"/>
              </>
            )}
            {endType && <FieldInput label="Notes" value={notes} onChangeText={setNotes} placeholder="What worked? What to improve?" multiline/>}
            <View style={{ flexDirection:'row', gap:8, marginTop:8 }}>
              <TouchableOpacity onPress={()=>{ if(!canSave)return; onEnd({ endType, submissionName:endType==='submission'?resolvedSub:'', submissionWinner:endType==='submission'?winner:null, duration:duration.trim(), notes:notes.trim() }); reset(); }} activeOpacity={0.75}
                style={{ flex:1, minHeight:48, alignItems:'center', justifyContent:'center', backgroundColor:canSave?C.sage:C.faint, opacity:canSave?1:0.5 }}>
                <Txt style={{ fontSize:9, fontFamily:F.bold, letterSpacing:2.5, textTransform:'uppercase', color:canSave?C.offWhite:C.muted }}>Save Roll</Txt>
              </TouchableOpacity>
              <Btn label="Cancel" onPress={()=>{ onCancel(); reset(); }} outline style={{ paddingHorizontal:20 }}/>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Roll Card ──────────────────────────────────────────────────────────────────
function RollCard({ roll, index, onView, onDelete, confirm }) {
  const myPts  = (roll.eventLog||[]).filter(e=>e.side==='me'&&e.scored).reduce((a,e)=>a+(e.pts||0),0);
  const oppPts = (roll.eventLog||[]).filter(e=>e.side==='opp'&&e.scored).reduce((a,e)=>a+(e.pts||0),0);
  const totalPos = Object.values(roll.posDurations||{}).reduce((a,b)=>a+b,0);
  const res = roll.rollResult ? (roll.rollResult==='win'?'W':roll.rollResult==='loss'?'L':'D') : (myPts>oppPts?'W':myPts<oppPts?'L':'T');
  const rc  = res==='W'?C.sage:res==='L'?C.red:C.amber;
  const isSub = roll.endType==='submission';
  const dateStr = roll.startedAt ? new Date(roll.startedAt).toLocaleDateString([],{weekday:'short',month:'short',day:'numeric',year:'numeric'}) : '';
  const timeStr = roll.startedAt ? new Date(roll.startedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '';
  return (
    <View style={{ flexDirection:'row', borderWidth:1, borderColor:C.border, marginBottom:10, borderRadius:8, overflow:'hidden' }}>
      <View style={{ width:4, backgroundColor:rc }}/>
      <TouchableOpacity onPress={()=>onView(roll)} activeOpacity={0.75} style={{ flex:1, padding:14 }}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' }}>
          <View style={{ flex:1 }}>
            <Txt style={{ fontSize:15, fontFamily:F.semi }}>
              Roll {String(index).padStart(2,'0')}{roll.partner?<Txt style={{ color:C.textDim, fontFamily:F.body }}> · {roll.partner}</Txt>:''}
            </Txt>
            <View style={{ flexDirection:'row', alignItems:'center', gap:6, marginTop:4 }}>
              <Txt style={{ fontSize:12, color:C.gold, fontFamily:F.medium }}>{dateStr}</Txt>
              {timeStr ? <Txt style={{ fontSize:11, color:C.muted }}>@ {timeStr}</Txt> : null}
            </View>
          </View>
          <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginLeft:10 }}>
            <View style={{ alignItems:'center' }}>
              <Text style={{ fontSize:28, fontFamily:F.display, color:C.gold, lineHeight:32 }}>{myPts}</Text>
              <Cap style={{ fontSize:8 }}>You</Cap>
            </View>
            <Txt style={{ color:C.border, fontSize:16, lineHeight:32 }}>–</Txt>
            <View style={{ alignItems:'center' }}>
              <Text style={{ fontSize:28, fontFamily:F.display, color:C.stone, lineHeight:32 }}>{oppPts}</Text>
              <Cap style={{ fontSize:8 }}>Opp</Cap>
            </View>
          </View>
        </View>
        <View style={{ flexDirection:'row', marginTop:10, alignItems:'center' }}>
          {totalPos>0 && <Txt style={{ fontSize:12, color:C.textDim, marginRight:14 }}>{fmtSecs(totalPos)} <Cap style={{ fontSize:8 }}>mat</Cap></Txt>}
          {isSub && <View style={{ borderWidth:1, borderColor:`${C.red}55`, paddingHorizontal:7, paddingVertical:3, marginRight:6, borderRadius:4 }}>
            <Txt style={{ fontSize:10, fontFamily:F.semi, color:C.red }}>🔒 {roll.submissionName||'SUB'}</Txt>
          </View>}
          <View style={{ marginLeft:'auto', borderWidth:1, borderColor:`${rc}55`, paddingHorizontal:10, paddingVertical:4, borderRadius:4 }}>
            <Txt style={{ fontSize:10, fontFamily:F.semi, color:rc }}>{res==='W'?'WIN':res==='L'?'LOSS':'DRAW'}</Txt>
          </View>
        </View>
      </TouchableOpacity>
      <TouchableOpacity onPress={async()=>{ const ok = await confirm('Delete this roll?'); if(ok) onDelete(roll.id); }} activeOpacity={0.75}
        style={{ borderLeftWidth:1, borderLeftColor:C.border, paddingHorizontal:14, alignItems:'center', justifyContent:'center' }}>
        <Txt style={{ color:C.muted, fontSize:20 }}>✕</Txt>
      </TouchableOpacity>
    </View>
  );
}

// ─── Competition components (abbreviated for clarity, full logic intact) ─────────
function CompetitionsList({ comps, onSelect, onNew }) {
  if (!comps.length) return (
    <View style={{ alignItems:'center', paddingVertical:60 }}>
      <GSLLogo size={56}/>
      <View style={{ width:30, height:1, backgroundColor:C.gold, marginTop:16, marginBottom:16 }}/>
      <Cap style={{ marginBottom:20 }}>No competitions recorded</Cap>
      <Btn label="Record Competition" onPress={onNew} style={{ paddingHorizontal:28 }}/>
    </View>
  );
  return (
    <View>
      <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <Cap>{comps.length} competition{comps.length!==1?'s':''}</Cap>
        <TouchableOpacity onPress={onNew} activeOpacity={0.75} style={{ borderWidth:1, borderColor:C.gold, paddingHorizontal:14, paddingVertical:7 }}>
          <Txt style={{ fontSize:9, fontFamily:F.semi, color:C.gold, letterSpacing:2, textTransform:'uppercase' }}>+ New</Txt>
        </TouchableOpacity>
      </View>
      {comps.map(comp => {
        const wins=comp.rounds.filter(r=>r.result==='win').length;
        const losses=comp.rounds.filter(r=>r.result==='loss').length;
        const draws=comp.rounds.filter(r=>r.result==='draw').length;
        const ov=wins>losses?'W':losses>wins?'L':comp.rounds.length>0?'D':null;
        const oc=wins>losses?C.sage:losses>wins?C.red:C.amber;
        const medalEmoji = comp.medal==='gold'?'🥇':comp.medal==='silver'?'🥈':comp.medal==='bronze'?'🥉':null;
        return (
          <TouchableOpacity key={comp.id} onPress={()=>onSelect(comp.id)} activeOpacity={0.75}
            style={{ borderWidth:1, borderColor:medalEmoji?`${C.gold}55`:C.border, marginBottom:8,
              backgroundColor:medalEmoji?C.goldDim:'transparent' }}>
            <View style={{ flexDirection:'row', alignItems:'flex-start', padding:14 }}>
              <View style={{ flex:1 }}>
                <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:2 }}>
                  {medalEmoji && <Txt style={{ fontSize:20 }}>{medalEmoji}</Txt>}
                  <Txt style={{ fontSize:14, fontFamily:F.bold, flex:1 }}>{comp.name}</Txt>
                </View>
                {/* Date + location */}
                {(comp.date||comp.location) && (
                  <Txt style={{ fontSize:10, color:C.gold, fontFamily:F.medium, marginBottom:2 }}>
                    {comp.date}{comp.location?` · ${comp.location}`:''}
                  </Txt>
                )}
                <Txt style={{ fontSize:9, color:C.muted, textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>
                  {comp.gi}{comp.weightClass?` · ${comp.weightClass}`:''}
                  {comp.bracketSize?` · ${comp.bracketSize} competitors`:''}
                </Txt>
                <View style={{ flexDirection:'row', gap:14 }}>
                  {[['W',wins,C.sage],['L',losses,C.red],['D',draws,C.amber],['Rounds',comp.rounds.length,C.muted]].map(([lbl,val,clr])=>(
                    <View key={lbl} style={{ alignItems:'center' }}>
                      <Txt style={{ fontSize:16, fontFamily:F.display, color:val>0?clr:C.border }}>{val}</Txt>
                      <Cap style={{ fontSize:7 }}>{lbl}</Cap>
                    </View>
                  ))}
                </View>
              </View>
              {ov && <View style={{ borderWidth:1, borderColor:`${oc}44`, paddingHorizontal:12, paddingVertical:6, alignItems:'center', marginLeft:12 }}>
                <Txt style={{ fontSize:18, fontFamily:F.display, color:oc }}>{ov}</Txt>
                <Cap style={{ fontSize:7 }}>Overall</Cap>
              </View>}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Profile Screen ──────────────────────────────────────────────────────────────
function ProfileScreen({ profiles, activeProfileId, onSelect, onNew, onEdit, onDelete, confirm }) {
  const [editingProfile, setEditingProfile] = useState(null);
  const [showNew, setShowNew]               = useState(false);

  return (
    <View style={{ flex:1, backgroundColor:C.bg, paddingTop: TOP_INSET }}>
      <View style={{ backgroundColor:C.surface, borderBottomWidth:1, borderBottomColor:C.border, padding:20 }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:14 }}>
          <GSLLogo size={44}/>
          <View>
            <Txt style={{ fontSize:11, fontFamily:F.display, letterSpacing:3, textTransform:'uppercase', color:C.text, lineHeight:15 }}>Grounded Skills Lab</Txt>
            <View style={{ flexDirection:'row', alignItems:'center', gap:6, marginTop:4 }}>
              <View style={{ width:16, height:1, backgroundColor:C.gold }}/>
              <Cap style={{ fontSize:7, color:C.gold, letterSpacing:2 }}>Select Profile</Cap>
            </View>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:20 }}>
        <Txt style={{ fontSize:9, color:C.muted, letterSpacing:3, textTransform:'uppercase', marginBottom:4 }}>Who's training today?</Txt>
        <Txt style={{ fontSize:22, fontFamily:F.display, marginBottom:24 }}>Choose your profile.</Txt>

        {profiles.map(p => {
          const isActive = p.id === activeProfileId;
          return (
            <TouchableOpacity key={p.id} onPress={()=>onSelect(p.id)} activeOpacity={0.75}
              style={{ flexDirection:'row', alignItems:'center', padding:14, marginBottom:8, borderWidth:2, borderColor:isActive?C.gold:C.border, backgroundColor:isActive?C.goldDim:C.card }}>
              <ProfileAvatar name={p.name} size={44} belt={p.belt||'white'}/>
              <View style={{ flex:1, marginLeft:14 }}>
                <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:5 }}>
                  <Txt style={{ fontSize:14, fontFamily:F.bold, color:isActive?C.gold:C.text }}>{p.name}</Txt>
                  {isActive && <View style={{ borderWidth:1, borderColor:`${C.gold}44`, paddingHorizontal:5, paddingVertical:1 }}><Txt style={{ fontSize:7, color:C.gold, letterSpacing:2, textTransform:'uppercase', fontFamily:F.semi }}>Active</Txt></View>}
                </View>
                <BeltBadge belt={p.belt||'white'} stripes={p.stripes||0} size="sm"/>
                {p.gym && <Txt style={{ fontSize:9, color:C.muted, marginTop:4 }}>{p.gym}</Txt>}
              </View>
              <View style={{ flexDirection:'row', gap:6 }}>
                <TouchableOpacity onPress={e=>{ e.stopPropagation?.(); setEditingProfile(p); }} activeOpacity={0.75}
                  style={{ borderWidth:1, borderColor:C.border, paddingHorizontal:10, paddingVertical:6 }}>
                  <Txt style={{ fontSize:8, color:C.muted, letterSpacing:1.5, textTransform:'uppercase', fontFamily:F.semi }}>Edit</Txt>
                </TouchableOpacity>
                <TouchableOpacity onPress={async()=>{ const ok=await confirm(`Delete "${p.name}" and ALL their data?`); if(ok) onDelete(p.id); }} activeOpacity={0.75}
                  style={{ borderWidth:1, borderColor:C.border, paddingHorizontal:10, paddingVertical:6 }}>
                  <Txt style={{ fontSize:14, color:C.muted }}>✕</Txt>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity onPress={()=>setShowNew(true)} activeOpacity={0.75}
          style={{ flexDirection:'row', alignItems:'center', justifyContent:'center', padding:16, borderWidth:1, borderStyle:'dashed', borderColor:C.borderMid, marginBottom:32 }}>
          <Txt style={{ fontSize:18, color:C.muted, marginRight:10 }}>+</Txt>
          <Cap style={{ letterSpacing:2.5 }}>New Profile</Cap>
        </TouchableOpacity>
        <View style={{ alignItems:'center', gap:10 }}>
          <GSLLogo size={32}/>
          <Cap style={{ textAlign:'center', color:C.border, marginTop:4 }}>Train. Measure. Improve. Repeat.</Cap>
        </View>
      </ScrollView>

      {(showNew||editingProfile) && (
        <ProfileEditModal
          initial={editingProfile||undefined}
          onSave={p=>{ if(editingProfile) onEdit(p); else onNew(p); setEditingProfile(null); setShowNew(false); }}
          onCancel={()=>{ setEditingProfile(null); setShowNew(false); }}/>
      )}
    </View>
  );
}

function ProfileEditModal({ initial, onSave, onCancel }) {
  const [name,    setName]    = useState(initial?.name||'');
  const [belt,    setBelt]    = useState(initial?.belt||'white');
  const [stripes, setStripes] = useState(initial?.stripes||0);
  const [gym,     setGym]     = useState(initial?.gym||'');
  const save = () => {
    if (!name.trim()) return;
    onSave({
      ...(initial||{}),           // preserve id, user_id, academy_id, created_at etc.
      name:    name.trim(),
      belt,
      stripes,
      gym:     gym.trim(),
    });
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios'?'padding':'height'}>
        <ScrollView contentContainerStyle={{ flexGrow:1, backgroundColor:'rgba(10,10,8,0.97)', alignItems:'center', justifyContent:'center', padding:24 }}>
          <View style={{ backgroundColor:C.surface, borderWidth:1, borderColor:C.borderMid, width:'100%', maxWidth:400, padding:24 }}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
              <View>
                <Cap style={{ marginBottom:4 }}>Grounded Skills Lab</Cap>
                <Txt style={{ fontSize:16, fontFamily:F.bold }}>{initial?'Edit Profile':'New Profile'}</Txt>
              </View>
              <TouchableOpacity onPress={onCancel} activeOpacity={0.75} style={{ width:32, height:32, borderWidth:1, borderColor:C.border, alignItems:'center', justifyContent:'center' }}>
                <Txt style={{ color:C.muted }}>✕</Txt>
              </TouchableOpacity>
            </View>

            {/* Live preview */}
            <View style={{ flexDirection:'row', alignItems:'center', gap:14, padding:14, borderWidth:1, borderColor:C.border, backgroundColor:C.faint, marginBottom:20 }}>
              <ProfileAvatar name={name||'?'} size={44} belt={belt}/>
              <View>
                <Txt style={{ fontSize:14, fontFamily:F.bold, marginBottom:5 }}>{name||'Athlete Name'}</Txt>
                <BeltBadge belt={belt} stripes={stripes} size="sm"/>
                {gym ? <Txt style={{ fontSize:9, color:C.muted, marginTop:4 }}>{gym}</Txt> : null}
              </View>
            </View>

            <FieldInput label="Full Name *" value={name} onChangeText={setName} placeholder="First Last"/>
            <View style={{ marginBottom:14 }}>
              <Cap style={{ marginBottom:8 }}>Belt</Cap>
              <Cap style={{ marginBottom:6, color:C.muted, fontSize:8 }}>Juvenile (under 16)</Cap>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:8 }}>
                <View style={{ flexDirection:'row', gap:6 }}>
                  {JUVENILE_BELTS.map(b => { const bc=BELT_COLORS[b]; return (
                    <TouchableOpacity key={b} onPress={()=>setBelt(b)} activeOpacity={0.75}
                      style={{ paddingVertical:7, paddingHorizontal:10, borderWidth:2,
                        borderColor:belt===b?C.gold:C.border,
                        backgroundColor:belt===b?bc.bg:C.faint }}>
                      <Txt style={{ fontSize:8, fontFamily:F.bold, letterSpacing:1,
                        textTransform:'uppercase', color:belt===b?bc.text:C.muted }}>{bc.label}</Txt>
                    </TouchableOpacity>
                  ); })}
                </View>
              </ScrollView>
              <Cap style={{ marginBottom:6, color:C.muted, fontSize:8 }}>Adult</Cap>
              <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6 }}>
                {ADULT_BELTS.map(b => { const bc=BELT_COLORS[b]; return (
                  <TouchableOpacity key={b} onPress={()=>setBelt(b)} activeOpacity={0.75}
                    style={{ paddingVertical:8, paddingHorizontal:12, borderWidth:2,
                      borderColor:belt===b?C.gold:C.border,
                      backgroundColor:belt===b?bc.bg:C.faint }}>
                    <Txt style={{ fontSize:8, fontFamily:F.bold, letterSpacing:1.5,
                      textTransform:'uppercase', color:belt===b?bc.text:C.muted }}>{bc.label}</Txt>
                  </TouchableOpacity>
                ); })}
              </View>
            </View>
            <View style={{ marginBottom:14 }}>
              <Cap style={{ marginBottom:8 }}>Stripes ({stripes})</Cap>
              <View style={{ flexDirection:'row', gap:6 }}>
                {[0,1,2,3,4].map(n => (
                  <TouchableOpacity key={n} onPress={()=>setStripes(n)} activeOpacity={0.75} style={{ flex:1, minHeight:40, borderWidth:1, borderColor:stripes===n?C.gold:C.border, backgroundColor:stripes===n?C.goldDim:'transparent', alignItems:'center', justifyContent:'center' }}>
                    <Txt style={{ fontSize:13, fontFamily:F.semi, color:stripes===n?C.gold:C.muted }}>{n}</Txt>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <FieldInput label="Gym / Academy" value={gym} onChangeText={setGym} placeholder="Academy name…"/>
            <View style={{ flexDirection:'row', gap:8, marginTop:8 }}>
              <Btn label={initial?'Save Changes':'Create Profile'} onPress={save} style={{ flex:1 }}/>
              <Btn label="Cancel" onPress={onCancel} outline style={{ paddingHorizontal:20 }}/>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Competition Modal ───────────────────────────────────────────────────────────
function CompModal({ visible, initial, onSave, onCancel }) {
  const [name,         setName]         = useState(initial?.name||'');
  const [location,     setLocation]     = useState(initial?.location||'');
  const [date,         setDate]         = useState(initial?.date||'');
  const [gi,           setGi]           = useState(initial?.gi||'Gi');
  const [weight,       setWeight]       = useState(initial?.weightClass||'Middle');
  const [bracketSize,  setBracketSize]  = useState(initial?.bracketSize||'');
  const [medal,        setMedal]        = useState(initial?.medal||'none'); // 'none'|'gold'|'silver'|'bronze'

  useEffect(() => {
    if (visible) {
      setName(initial?.name||''); setLocation(initial?.location||'');
      setDate(initial?.date||''); setGi(initial?.gi||'Gi');
      setWeight(initial?.weightClass||'Middle');
      setBracketSize(initial?.bracketSize||'');
      setMedal(initial?.medal||'none');
    }
  }, [visible]);

  const save = () => {
    if (!name.trim()) return;
    onSave({
      ...(initial||{}), id:initial?.id||uid(),
      name:name.trim(), location:location.trim(),
      date, gi, weightClass:weight,
      bracketSize: bracketSize ? parseInt(bracketSize)||'' : '',
      medal,
      rounds:initial?.rounds||[], createdAt:initial?.createdAt||Date.now()
    });
  };

  const MEDALS = [
    { key:'none',   label:'No Medal', icon:'—',  color:C.muted },
    { key:'gold',   label:'Gold',     icon:'🥇', color:'#FFD700' },
    { key:'silver', label:'Silver',   icon:'🥈', color:'#C0C0C0' },
    { key:'bronze', label:'Bronze',   icon:'🥉', color:'#CD7F32' },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios'?'padding':'height'}>
        <ScrollView contentContainerStyle={{ flexGrow:1, backgroundColor:'rgba(10,10,8,0.9)', alignItems:'center', justifyContent:'center', padding:24 }}>
          <View style={{ backgroundColor:C.surface, borderWidth:1, borderColor:C.borderMid, width:'100%', maxWidth:400, padding:24 }}>
            <Cap style={{ marginBottom:4 }}>Grounded Skills Lab</Cap>
            <Txt style={{ fontSize:16, fontFamily:F.bold, marginBottom:20 }}>{initial?'Edit Competition':'New Competition'}</Txt>

            <FieldInput label="Competition Name *" value={name} onChangeText={setName} placeholder="e.g. IBJJF Pan Championship"/>
            <FieldInput label="Location" value={location} onChangeText={setLocation} placeholder="City, State"/>
            <FieldInput label="Date" value={date} onChangeText={setDate} placeholder="e.g. March 15, 2025"/>

            {/* Gi/No-Gi */}
            <View style={{ marginBottom:16 }}>
              <Cap style={{ marginBottom:8 }}>Format</Cap>
              <View style={{ flexDirection:'row', gap:6 }}>
                {GI_OPTIONS.map(g=>(
                  <TouchableOpacity key={g} onPress={()=>setGi(g)} activeOpacity={0.75}
                    style={{ flex:1, borderWidth:1, borderColor:gi===g?C.gold:C.border,
                      backgroundColor:gi===g?C.goldDim:'transparent', paddingVertical:10, alignItems:'center' }}>
                    <Txt style={{ fontSize:11, fontFamily:F.semi, color:gi===g?C.gold:C.muted }}>{g}</Txt>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Weight class */}
            <View style={{ marginBottom:16 }}>
              <Cap style={{ marginBottom:8 }}>Weight Class</Cap>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection:'row', gap:6 }}>
                  {WEIGHT_CLASSES.map(w=>(
                    <TouchableOpacity key={w} onPress={()=>setWeight(w)} activeOpacity={0.75}
                      style={{ borderWidth:1, borderColor:weight===w?C.gold:C.border,
                        backgroundColor:weight===w?C.goldDim:'transparent', paddingVertical:7, paddingHorizontal:10 }}>
                      <Txt style={{ fontSize:10, fontFamily:F.semi, color:weight===w?C.gold:C.muted }}>{w}</Txt>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Bracket size */}
            <View style={{ marginBottom:16 }}>
              <Cap style={{ marginBottom:8 }}>Bracket Size (# of competitors)</Cap>
              <TextInput
                value={String(bracketSize)}
                onChangeText={setBracketSize}
                placeholder="e.g. 8" placeholderTextColor={C.muted}
                keyboardType="number-pad" returnKeyType="done"
                style={{ borderWidth:1, borderColor:C.borderMid, color:C.text, fontSize:14,
                  fontFamily:F.body, padding:12 }}/>
            </View>

            {/* Medal */}
            <View style={{ marginBottom:24 }}>
              <Cap style={{ marginBottom:8 }}>Medal</Cap>
              <View style={{ flexDirection:'row', gap:6 }}>
                {MEDALS.map(m=>(
                  <TouchableOpacity key={m.key} onPress={()=>setMedal(m.key)} activeOpacity={0.75}
                    style={{ flex:1, borderWidth:2, borderColor:medal===m.key?m.color:C.border,
                      backgroundColor:medal===m.key?`${m.color}18`:'transparent',
                      paddingVertical:10, alignItems:'center' }}>
                    <Txt style={{ fontSize:16, marginBottom:2 }}>{m.icon}</Txt>
                    <Txt style={{ fontSize:8, fontFamily:F.semi,
                      color:medal===m.key?m.color:C.muted }}>{m.label}</Txt>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ flexDirection:'row', gap:8 }}>
              <Btn label={initial?'Save Changes':'Create'} onPress={save} style={{ flex:1 }}/>
              <Btn label="Cancel" onPress={onCancel} outline style={{ paddingHorizontal:20 }}/>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Insights Engine ─────────────────────────────────────────────────────────
// Pure function — takes finished rolls and returns array of insight objects.
// Called once in ChartsScreen and shared between Insights tab and Submissions tab.
function generateInsights(rolls, takedowns, sweeps, transitions, positions, competitions, journal) {
  if (!rolls || rolls.length < 2) return [];
  const insights = [];
  const tdSet = new Set(takedowns || []);

  const subWinRate = rollSet => {
    if (!rollSet.length) return null;
    const wins = rollSet.filter(r => r.endType==='submission' && r.submissionWinner==='me').length;
    return { rate: Math.round((wins/rollSet.length)*100), wins, total: rollSet.length };
  };
  const winRate = rollSet => {
    if (!rollSet.length) return null;
    const wins = rollSet.filter(r => {
      if (r.rollResult) return r.rollResult === 'win';
      const my = (r.eventLog||[]).filter(e=>e.side==='me'&&e.scored).reduce((a,e)=>a+(e.pts||0),0);
      const op = (r.eventLog||[]).filter(e=>e.side==='opp'&&e.scored).reduce((a,e)=>a+(e.pts||0),0);
      return my > op;
    }).length;
    return { rate: Math.round((wins/rollSet.length)*100), wins, total: rollSet.length };
  };

  // 1. Takedown vs guard pull opening
  const openedWithTD = rolls.filter(r => {
    const first = (r.eventLog||[]).find(e => e.side==='me' && (e.type==='takedown'||e.scoreKey==='takedown'));
    const firstTrans = (r.eventLog||[]).find(e => e.side==='me' && e.type==='transition');
    return (first) || (firstTrans && tdSet.has(firstTrans.item));
  });
  const openedWithGP = rolls.filter(r => {
    const hasGP = (r.eventLog||[]).some(e => e.side==='me' && (e.type==='guardPull'||e.scoreKey==='guardPull'));
    const hasFirstTrans = (r.eventLog||[]).find(e => e.side==='me' && e.type==='transition');
    return hasGP || (hasFirstTrans && !tdSet.has(hasFirstTrans.item));
  });
  if (openedWithTD.length >= 2 && openedWithGP.length >= 2) {
    const tdSR = subWinRate(openedWithTD);
    const gpSR = subWinRate(openedWithGP);
    if (tdSR && gpSR) {
      const diff = tdSR.rate - gpSR.rate;
      if (Math.abs(diff) >= 10) {
        const better = diff > 0 ? 'takedown' : 'guard pull';
        const betterRate = diff > 0 ? tdSR.rate : gpSR.rate;
        const worseRate  = diff > 0 ? gpSR.rate : tdSR.rate;
        insights.push({
          icon:'🥋', color: diff>0?C.sage:C.amber, category:'opening',
          title: `${diff>0?'Takedown':'Guard Pull'} opening works better`,
          text: `Your submission rate is ${Math.abs(diff)}% higher when you open with a ${better} (${betterRate}%) vs ${diff>0?'guard pull':'takedown'} (${worseRate}%).`,
          detail: `${diff>0?openedWithTD.length:openedWithGP.length} rolls with ${better} opening analyzed.`
        });
      }
    }
  }

  // 2. Technique × Position correlations
  const techByPos = {};
  rolls.forEach(r => {
    const log = r.eventLog||[];
    const isSubWin = r.endType==='submission' && r.submissionWinner==='me';
    const myPositions = [...new Set(log.filter(e=>e.side==='me'&&e.type==='position').map(e=>e.item))];
    const mySubAttempts = log.filter(e=>e.side==='me'&&e.type==='submission');
    if (!mySubAttempts.length) return;
    myPositions.forEach(pos => {
      mySubAttempts.forEach(sub => {
        const key = `${sub.item}|||${pos}`;
        if (!techByPos[key]) techByPos[key] = { tech:sub.item, pos, attempts:0, successes:0 };
        techByPos[key].attempts++;
        if (isSubWin) techByPos[key].successes++;
      });
    });
  });
  const techOverall = {};
  rolls.forEach(r => {
    const isSubWin = r.endType==='submission' && r.submissionWinner==='me';
    (r.eventLog||[]).filter(e=>e.side==='me'&&e.type==='submission').forEach(sub => {
      if (!techOverall[sub.item]) techOverall[sub.item] = { attempts:0, successes:0 };
      techOverall[sub.item].attempts++;
      if (isSubWin) techOverall[sub.item].successes++;
    });
  });
  Object.values(techByPos).forEach(({ tech, pos, attempts, successes }) => {
    if (attempts < 2) return;
    const posRate = Math.round((successes/attempts)*100);
    const overall = techOverall[tech];
    const overallRate = overall?.attempts > 0 ? Math.round((overall.successes/overall.attempts)*100) : 0;
    const diff = posRate - overallRate;
    if (diff >= 20) {
      insights.push({
        icon:'📍', color:C.sage, category:'technique',
        title: `${tech} from ${pos}`,
        text: `Your ${tech} success rate is ${posRate}% when attempted from ${pos} — ${diff}% higher than your overall ${tech} rate (${overallRate}%).`,
        detail: `${successes} finish${successes!==1?'es':''} from ${attempts} attempt${attempts!==1?'s':''} in ${pos}.`
      });
    }
  });

  // 3. First mover advantage
  const scoredFirst = rolls.filter(r => {
    const first = (r.eventLog||[]).find(e=>e.scored);
    return first && first.side==='me';
  });
  const oppScoredFirst = rolls.filter(r => {
    const first = (r.eventLog||[]).find(e=>e.scored);
    return first && first.side==='opp';
  });
  if (scoredFirst.length >= 2 && oppScoredFirst.length >= 2) {
    const myWR  = winRate(scoredFirst);
    const oppWR = winRate(oppScoredFirst);
    if (myWR && oppWR) {
      const diff = myWR.rate - oppWR.rate;
      if (diff >= 15) {
        insights.push({
          icon:'⚡', color:C.gold, category:'scoring',
          title: 'First mover advantage',
          text: `When you score first, you win ${myWR.rate}% of the time. When your opponent scores first, you win only ${oppWR.rate}%.`,
          detail: `${diff}% win rate difference — scoring first matters.`
        });
      }
    }
  }

  // 4. Most effective sweep
  const sweepWins = {};
  rolls.forEach(r => {
    const log = r.eventLog||[];
    const isWin = r.rollResult==='win' || (()=>{
      const my=log.filter(e=>e.side==='me'&&e.scored).reduce((a,e)=>a+(e.pts||0),0);
      const op=log.filter(e=>e.side==='opp'&&e.scored).reduce((a,e)=>a+(e.pts||0),0);
      return my>op;
    })();
    log.filter(e=>e.side==='me'&&e.type==='sweep'&&e.item).forEach(e=>{
      if (!sweepWins[e.item]) sweepWins[e.item]={uses:0,wins:0};
      sweepWins[e.item].uses++;
      if (isWin) sweepWins[e.item].wins++;
    });
  });
  const sweepEntries = Object.entries(sweepWins).filter(([,v])=>v.uses>=2);
  if (sweepEntries.length >= 1) {
    const best = sweepEntries.sort((a,b)=>(b[1].wins/b[1].uses)-(a[1].wins/a[1].uses))[0];
    const rate = Math.round((best[1].wins/best[1].uses)*100);
    if (rate >= 50) {
      insights.push({
        icon:'↺', color:C.teal, category:'sweep',
        title: `Best sweep: ${best[0]}`,
        text: `Your most effective sweep is the ${best[0]} — you win ${rate}% of rolls where you land it.`,
        detail: `${best[1].wins} wins in ${best[1].uses} uses.`
      });
    }
  }

  // 5. Submission defence rate
  const withOppSubs = rolls.filter(r => (r.eventLog||[]).some(e=>e.side==='opp'&&e.type==='submission'));
  if (withOppSubs.length >= 2) {
    const escaped = withOppSubs.filter(r => !(r.endType==='submission' && r.submissionWinner==='opp'));
    const rate = Math.round((escaped.length/withOppSubs.length)*100);
    insights.push({
      icon:'🛡', color:C.blue, category:'defence',
      title: `Submission defence: ${rate}%`,
      text: `You escape or survive submission attempts ${rate}% of the time when your opponent tries to submit you.`,
      detail: `Survived ${escaped.length} of ${withOppSubs.length} rolls where opponent attempted a submission.`
    });
  }

  // 6. Pressure performance — sub rate leading vs trailing
  const leadingAtHalf = rolls.filter(r => {
    const log = r.eventLog||[]; const mid = Math.floor(log.length/2);
    const my=log.slice(0,mid).filter(e=>e.side==='me'&&e.scored).reduce((a,e)=>a+(e.pts||0),0);
    const op=log.slice(0,mid).filter(e=>e.side==='opp'&&e.scored).reduce((a,e)=>a+(e.pts||0),0);
    return my > op;
  });
  const trailingAtHalf = rolls.filter(r => {
    const log = r.eventLog||[]; const mid = Math.floor(log.length/2);
    const my=log.slice(0,mid).filter(e=>e.side==='me'&&e.scored).reduce((a,e)=>a+(e.pts||0),0);
    const op=log.slice(0,mid).filter(e=>e.side==='opp'&&e.scored).reduce((a,e)=>a+(e.pts||0),0);
    return my < op;
  });
  if (leadingAtHalf.length >= 2 && trailingAtHalf.length >= 2) {
    const leadSR  = subWinRate(leadingAtHalf);
    const trailSR = subWinRate(trailingAtHalf);
    if (leadSR && trailSR) {
      const diff = trailSR.rate - leadSR.rate;
      if (Math.abs(diff) >= 15) {
        insights.push({
          icon: diff>0?'💪':'⚠️', color: diff>0?C.sage:C.amber, category:'pressure',
          title: diff>0 ? 'Better under pressure' : 'Stronger when leading',
          text: diff > 0
            ? `You finish ${Math.abs(diff)}% more submissions when trailing on points — your submission game gets sharper under pressure.`
            : `Your submission rate is ${Math.abs(diff)}% higher when you're already leading on points.`,
          detail: `${leadingAtHalf.length} rolls leading · ${trailingAtHalf.length} rolls trailing at midpoint.`
        });
      }
    }
  }

  // 7. Win rate with vs without guard passes
  const withGP  = rolls.filter(r => (r.eventLog||[]).some(e=>e.side==='me'&&e.scoreKey==='guardPass'));
  const withoutGP = rolls.filter(r => !(r.eventLog||[]).some(e=>e.side==='me'&&e.scoreKey==='guardPass'));
  if (withGP.length >= 2 && withoutGP.length >= 2) {
    const gpWR  = winRate(withGP);
    const nogpWR = winRate(withoutGP);
    if (gpWR && nogpWR) {
      const diff = gpWR.rate - nogpWR.rate;
      if (diff >= 20) {
        insights.push({
          icon:'→', color:C.teal, category:'guardPass',
          title: 'Guard passing drives wins',
          text: `You win ${gpWR.rate}% of rolls where you pass the guard vs ${nogpWR.rate}% when you don't — a ${diff}% difference.`,
          detail: `${withGP.length} rolls with a guard pass · ${withoutGP.length} without.`
        });
      }
    }
  }

  // ── Competition insights ─────────────────────────────────────────────────────
  const comps = competitions || [];
  const allRounds = comps.flatMap(c => (c.rounds||[]).filter(r => r.endedAt));

  if (allRounds.length >= 2) {
    const compWins   = allRounds.filter(r => r.result==='win').length;
    const compLosses = allRounds.filter(r => r.result==='loss').length;
    const compDraws  = allRounds.filter(r => r.result==='draw').length;
    const compWinRate= Math.round((compWins / allRounds.length)*100);

    // 9. Overall competition record
    insights.push({
      icon:'🏆', color:C.gold, category:'competition',
      title: `Competition record: ${compWins}W-${compLosses}L-${compDraws}D`,
      text: `You win ${compWinRate}% of competition rounds across ${comps.length} competition${comps.length!==1?'s':''}.`,
      detail: `${allRounds.length} total round${allRounds.length!==1?'s':''} recorded.`
    });

    // 10. Comp vs training win rate comparison
    if (rolls.length >= 2) {
      const trainWins = rolls.filter(r => {
        if (r.rollResult) return r.rollResult==='win';
        const my=(r.eventLog||[]).filter(e=>e.side==='me'&&e.scored).reduce((a,e)=>a+(e.pts||0),0);
        const op=(r.eventLog||[]).filter(e=>e.side==='opp'&&e.scored).reduce((a,e)=>a+(e.pts||0),0);
        return my>op;
      }).length;
      const trainWinRate = Math.round((trainWins/rolls.length)*100);
      const diff = compWinRate - trainWinRate;
      if (Math.abs(diff) >= 10) {
        insights.push({
          icon: diff > 0 ? '📈' : '📉',
          color: diff > 0 ? C.sage : C.amber,
          category: 'competition',
          title: diff > 0 ? 'You perform better in competition' : 'Training wins more than competition',
          text: `Your competition win rate (${compWinRate}%) is ${Math.abs(diff)}% ${diff>0?'higher':'lower'} than your training win rate (${trainWinRate}%).`,
          detail: `${rolls.length} training rolls · ${allRounds.length} competition rounds.`
        });
      }
    }

    // 11. Submission rate in competition vs training
    const compSubWins = allRounds.filter(r => r.result==='win' && r.method==='submission').length;
    const compSubRate = Math.round((compSubWins / Math.max(allRounds.length,1))*100);
    const trainSubWins = rolls.filter(r => r.endType==='submission' && r.submissionWinner==='me').length;
    const trainSubRate = rolls.length > 0 ? Math.round((trainSubWins/rolls.length)*100) : 0;
    if (compSubRate > 0 || trainSubRate > 0) {
      const diff = compSubRate - trainSubRate;
      insights.push({
        icon:'🔒', color:C.red, category:'competition',
        title: diff >= 0 ? `Stronger finisher in competition` : `More subs in training`,
        text: `You finish by submission in ${compSubRate}% of competition rounds and ${trainSubRate}% of training rolls.`,
        detail: `${compSubWins} competition sub win${compSubWins!==1?'s':''} · ${trainSubWins} training sub win${trainSubWins!==1?'s':''}.`
      });
    }

    // 12. Best belt level vs opponent
    const beltOrder = ['white','blue','purple','brown','black'];
    const byBelt = {};
    allRounds.forEach(r => {
      const belt = r.oppBelt || 'unknown';
      if (!byBelt[belt]) byBelt[belt] = { wins:0, total:0 };
      byBelt[belt].total++;
      if (r.result==='win') byBelt[belt].wins++;
    });
    const beltEntries = Object.entries(byBelt).filter(([,v])=>v.total>=2);
    if (beltEntries.length >= 2) {
      const best = beltEntries.sort((a,b)=>(b[1].wins/b[1].total)-(a[1].wins/a[1].total))[0];
      const bestRate = Math.round((best[1].wins/best[1].total)*100);
      const worst = beltEntries.sort((a,b)=>(a[1].wins/a[1].total)-(b[1].wins/b[1].total))[0];
      const worstRate = Math.round((worst[1].wins/worst[1].total)*100);
      if (best[0] !== worst[0]) {
        insights.push({
          icon:'🥋', color:C.teal, category:'competition',
          title: `Best matchup: ${best[0].charAt(0).toUpperCase()+best[0].slice(1)} belts`,
          text: `You win ${bestRate}% vs ${best[0]} belts and ${worstRate}% vs ${worst[0]} belts in competition.`,
          detail: `${best[1].total} round${best[1].total!==1?'s':''} vs ${best[0]} · ${worst[1].total} vs ${worst[0]}.`
        });
      }
    }

    // 13. Points scored vs conceded in competition
    const compMyPtsTotal = allRounds.reduce((a,r)=>{
      return a + (r.eventLog||[]).filter(e=>e.side==='me'&&e.scored&&e.pts>0).reduce((s,e)=>s+(e.pts||0),0);
    }, 0);
    const compOpPtsTotal = allRounds.reduce((a,r)=>{
      return a + (r.eventLog||[]).filter(e=>e.side==='opp'&&e.scored&&e.pts>0).reduce((s,e)=>s+(e.pts||0),0);
    }, 0);
    if (compMyPtsTotal > 0 || compOpPtsTotal > 0) {
      const avgFor     = (compMyPtsTotal/Math.max(allRounds.length,1)).toFixed(1);
      const avgAgainst = (compOpPtsTotal/Math.max(allRounds.length,1)).toFixed(1);
      insights.push({
        icon:'📊', color:C.blue, category:'competition',
        title: `Avg comp score: ${avgFor} for · ${avgAgainst} against`,
        text: `In competition you average ${avgFor} points scored and ${avgAgainst} points conceded per round.`,
        detail: `Total: ${compMyPtsTotal} pts scored · ${compOpPtsTotal} pts conceded across ${allRounds.length} round${allRounds.length!==1?'s':''}.`
      });
    }

    // 14. Competition performance by gi/no-gi
    const giRounds  = allRounds.filter(r => { const comp=comps.find(c=>c.rounds.some(rr=>rr.id===r.id)); return comp?.gi==='Gi'; });
    const nogiRounds= allRounds.filter(r => { const comp=comps.find(c=>c.rounds.some(rr=>rr.id===r.id)); return comp?.gi==='No-Gi'; });
    if (giRounds.length >= 2 && nogiRounds.length >= 2) {
      const giWR   = Math.round((giRounds.filter(r=>r.result==='win').length/giRounds.length)*100);
      const nogiWR = Math.round((nogiRounds.filter(r=>r.result==='win').length/nogiRounds.length)*100);
      const diff   = giWR - nogiWR;
      if (Math.abs(diff) >= 10) {
        insights.push({
          icon: diff>0?'🥋':'⚡',
          color: diff>0?C.sage:C.teal,
          category:'competition',
          title: diff>0?'Stronger in Gi':'Stronger in No-Gi',
          text: `You win ${giWR}% of Gi rounds and ${nogiWR}% of No-Gi rounds in competition.`,
          detail: `${giRounds.length} Gi round${giRounds.length!==1?'s':''} · ${nogiRounds.length} No-Gi round${nogiRounds.length!==1?'s':''}.`
        });
      }
    }
  }

  // ── Journal insights ─────────────────────────────────────────────────────────
  const entries = journal || [];
  if (entries.length >= 2) {
    const allTechs = entries.flatMap(e => e.techniques || []);

    // Finish rate by technique
    const techStats = {};
    allTechs.forEach(t => {
      if (!t.name) return;
      if (!techStats[t.name]) techStats[t.name] = { learned:0, attempted:0, finished:0 };
      if (t.outcome === 'learned')  techStats[t.name].learned++;
      if (t.outcome === 'attempted') techStats[t.name].attempted++;
      if (t.outcome === 'finished')  techStats[t.name].finished++;
    });

    // High finish rate techniques
    const highFinish = Object.entries(techStats)
      .filter(([,v]) => v.attempted + v.finished >= 3 && v.finished / (v.attempted + v.finished) >= 0.5)
      .sort((a,b) => (b[1].finished/(b[1].attempted+b[1].finished)) - (a[1].finished/(a[1].attempted+a[1].finished)));
    if (highFinish.length) {
      const [name, stat] = highFinish[0];
      const rate = Math.round((stat.finished / (stat.attempted + stat.finished)) * 100);
      insights.push({
        icon:'🎯', color:C.sage, category:'journal',
        title:`${name} is converting`,
        text:`You finish ${name} ${rate}% of the time in live rolls — your highest-converting logged technique.`,
        detail:`${stat.finished} finishes from ${stat.attempted + stat.finished} attempts across journal entries.`
      });
    }

    // Techniques drilled but never attempted live
    const learnedNotAttempted = Object.entries(techStats)
      .filter(([,v]) => v.learned >= 2 && v.attempted === 0 && v.finished === 0);
    if (learnedNotAttempted.length) {
      const names = learnedNotAttempted.slice(0,3).map(([n])=>n).join(', ');
      insights.push({
        icon:'📚', color:C.amber, category:'journal',
        title:'Class → roll gap',
        text:`You've drilled ${names} multiple times in class but haven't attempted ${learnedNotAttempted.length===1?'it':'them'} in live rolls yet.`,
        detail:`${learnedNotAttempted.length} technique${learnedNotAttempted.length!==1?'s':''} waiting to be tested live.`
      });
    }

    // Overall finish rate
    const totalAttempted = allTechs.filter(t => t.outcome === 'attempted' || t.outcome === 'finished').length;
    const totalFinished  = allTechs.filter(t => t.outcome === 'finished').length;
    if (totalAttempted >= 5) {
      const rate = Math.round((totalFinished / totalAttempted) * 100);
      insights.push({
        icon:'📊', color:C.teal, category:'journal',
        title:`Overall finish rate: ${rate}%`,
        text:`Across all journal entries you finish ${rate}% of techniques you attempt in live rolls.`,
        detail:`${totalFinished} finishes from ${totalAttempted} attempts logged.`
      });
    }

    // Most practiced technique
    const mostPracticed = Object.entries(techStats)
      .sort((a,b) => (b[1].learned+b[1].attempted+b[1].finished) - (a[1].learned+a[1].attempted+a[1].finished))[0];
    if (mostPracticed) {
      const [name, stat] = mostPracticed;
      const total = stat.learned + stat.attempted + stat.finished;
      if (total >= 3) {
        insights.push({
          icon:'🔁', color:C.blue, category:'journal',
          title:`Most practiced: ${name}`,
          text:`${name} is your most-logged technique with ${total} appearances across journal sessions.`,
          detail:`${stat.learned} drilled · ${stat.attempted} attempted · ${stat.finished} finished.`
        });
      }
    }
  }

  return insights;
}

// ─── YouTube Search Modal ────────────────────────────────────────────────────
function YouTubeSearchModal({ visible, onClose, onSelect, initialQuery='' }) {
  const [query,   setQuery]   = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (visible && initialQuery) {
      setQuery(initialQuery);
      search(initialQuery);
    }
    if (!visible) { setResults([]); setError(''); }
  }, [visible, initialQuery]);

  const search = async (q = query) => {
    if (!q.trim()) return;
    setLoading(true); setError('');
    try {
      // Call our Netlify proxy function — API key stays server-side
      const res = await fetch(`/.netlify/functions/youtube-search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.error) { setError(data.error.message || data.error); setLoading(false); return; }
      setResults(data.items || []);
    } catch(e) { setError('Search failed. Check your connection.'); }
    setLoading(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios'?'padding':'height'}>
        <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.92)', justifyContent:'flex-end' }}>
          <View style={{ backgroundColor:C.surface, borderTopLeftRadius:16, borderTopRightRadius:16,
            borderTopWidth:1, borderColor:C.borderMid, maxHeight:'85%' }}>

            {/* Header */}
            <View style={{ flexDirection:'row', alignItems:'center', padding:16,
              borderBottomWidth:1, borderBottomColor:C.border }}>
              <Txt style={{ fontSize:18, marginRight:8 }}>▶️</Txt>
              <Txt style={{ fontSize:15, fontFamily:F.bold, flex:1, color:C.text }}>Search YouTube</Txt>
              <TouchableOpacity onPress={onClose} activeOpacity={0.75}>
                <Txt style={{ color:C.muted, fontSize:20 }}>✕</Txt>
              </TouchableOpacity>
            </View>

            {/* Search bar */}
            <View style={{ flexDirection:'row', alignItems:'center', gap:8,
              padding:12, borderBottomWidth:1, borderBottomColor:C.border }}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={()=>search()}
                placeholder="Search for a technique video…"
                placeholderTextColor={C.muted}
                returnKeyType="search"
                style={{ flex:1, borderWidth:1, borderColor:C.borderMid, color:C.text,
                  fontSize:13, fontFamily:F.body, padding:10, backgroundColor:C.card,
                  borderRadius:6 }}/>
              <TouchableOpacity onPress={()=>search()} disabled={loading} activeOpacity={0.8}
                style={{ backgroundColor:C.red, paddingHorizontal:14, paddingVertical:10,
                  borderRadius:6, opacity: loading ? 0.6 : 1 }}>
                <Txt style={{ fontSize:9, fontFamily:F.semi, color:'#fff', letterSpacing:1,
                  textTransform:'uppercase' }}>Search</Txt>
              </TouchableOpacity>
            </View>

            {/* Results */}
            <ScrollView keyboardShouldPersistTaps="always" style={{ flex:1 }}>
              {loading && (
                <View style={{ padding:32, alignItems:'center' }}>
                  <ActivityIndicator color={C.red} size="large"/>
                  <Cap style={{ marginTop:12 }}>Searching YouTube…</Cap>
                </View>
              )}
              {error ? (
                <View style={{ padding:16, margin:12, borderWidth:1,
                  borderColor:`${C.red}44`, backgroundColor:`${C.red}10`, borderRadius:8 }}>
                  <Txt style={{ fontSize:12, color:C.red, lineHeight:18 }}>{error}</Txt>
                </View>
              ) : null}
              {!loading && results.map(item => {
                const vid = item.id?.videoId;
                const snip = item.snippet;
                const thumb = snip?.thumbnails?.medium?.url || snip?.thumbnails?.default?.url;
                const ytUrl = `https://www.youtube.com/watch?v=${vid}`;
                return (
                  <TouchableOpacity key={vid} onPress={()=>{ onSelect(ytUrl); onClose(); }}
                    activeOpacity={0.75}
                    style={{ flexDirection:'row', alignItems:'center', gap:12, padding:12,
                      borderBottomWidth:1, borderBottomColor:C.faint }}>
                    {/* Thumbnail */}
                    <View style={{ width:100, height:60, borderRadius:6, overflow:'hidden',
                      backgroundColor:C.faint, position:'relative' }}>
                      {thumb && <Image source={{ uri: thumb }} style={{ width:100, height:60 }} resizeMode="cover"/>}
                      <View style={{ position:'absolute', inset:0, top:0, left:0, right:0, bottom:0,
                        alignItems:'center', justifyContent:'center' }}>
                        <View style={{ width:26, height:26, borderRadius:13,
                          backgroundColor:'rgba(255,0,0,0.85)', alignItems:'center', justifyContent:'center' }}>
                          <Txt style={{ color:'#fff', fontSize:10, marginLeft:2 }}>▶</Txt>
                        </View>
                      </View>
                    </View>
                    {/* Info */}
                    <View style={{ flex:1 }}>
                      <Txt style={{ fontSize:12, fontFamily:F.semi, color:C.text, lineHeight:17 }}
                        numberOfLines={2}>{snip?.title}</Txt>
                      <Cap style={{ fontSize:8, marginTop:3, color:C.muted }}
                        numberOfLines={1}>{snip?.channelTitle}</Cap>
                    </View>
                    {/* Attach */}
                    <View style={{ backgroundColor:C.teal, paddingHorizontal:8, paddingVertical:6,
                      borderRadius:4 }}>
                      <Txt style={{ fontSize:9, fontFamily:F.semi, color:'#fff', letterSpacing:1,
                        textTransform:'uppercase' }}>Attach</Txt>
                    </View>
                  </TouchableOpacity>
                );
              })}
              {!loading && !error && results.length === 0 && query.trim() && (
                <View style={{ padding:32, alignItems:'center' }}>
                  <Cap style={{ textAlign:'center' }}>No results. Try a different search term.</Cap>
                </View>
              )}
              {!loading && !error && results.length === 0 && !query.trim() && (
                <View style={{ padding:32, alignItems:'center' }}>
                  <Txt style={{ fontSize:22, marginBottom:12 }}>🔍</Txt>
                  <Cap style={{ textAlign:'center' }}>Search for a BJJ technique to find reference videos</Cap>
                </View>
              )}
              <View style={{ height:20 }}/>
            </ScrollView>

            {/* Paste URL fallback */}
            <View style={{ padding:12, borderTopWidth:1, borderTopColor:C.border,
              backgroundColor:C.faint }}>
              <Cap style={{ textAlign:'center', color:C.muted, fontSize:9 }}>
                Or paste a YouTube URL directly in the technique field
              </Cap>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const getYouTubeId = url => {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
};

function TechVideoRef({ url }) {
  const [expanded, setExpanded] = useState(false);
  if (!url?.trim()) return null;
  const ytId = getYouTubeId(url);

  const openUrl = () => {
    if (typeof window !== 'undefined') window.open(url, '_blank');
  };

  if (ytId) {
    const thumb = `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`;
    const embedUrl = `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1`;

    if (expanded && Platform.OS === 'web') {
      // Inline embed via iframe on web
      return (
        <View style={{ marginTop:8, borderRadius:8, overflow:'hidden',
          borderWidth:1, borderColor:`${C.red}33` }}>
          <iframe
            src={embedUrl}
            width="100%"
            height="200"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="YouTube video"
            style={{ display:'block', border:'none' }}
          />
          <TouchableOpacity onPress={()=>setExpanded(false)} activeOpacity={0.75}
            style={{ backgroundColor:'rgba(0,0,0,0.7)', padding:6, alignItems:'center' }}>
            <Cap style={{ color:'#ccc', fontSize:8 }}>▲ Close video</Cap>
          </TouchableOpacity>
        </View>
      );
    }

    // Thumbnail with play button — tap to expand
    return (
      <TouchableOpacity onPress={()=>{ if(Platform.OS==='web') setExpanded(true); else openUrl(); }}
        activeOpacity={0.8}
        style={{ marginTop:8, borderRadius:8, overflow:'hidden',
          borderWidth:1, borderColor:`${C.red}33` }}>
        <Image source={{ uri: thumb }}
          style={{ width:'100%', height:120 }}
          resizeMode="cover"/>
        <View style={{ position:'absolute', top:0, left:0, right:0, height:120,
          alignItems:'center', justifyContent:'center' }}>
          <View style={{ width:44, height:44, borderRadius:22,
            backgroundColor:'rgba(255,0,0,0.88)', alignItems:'center', justifyContent:'center' }}>
            <Txt style={{ color:'#fff', fontSize:18, marginLeft:3 }}>▶</Txt>
          </View>
        </View>
        <View style={{ backgroundColor:'rgba(0,0,0,0.7)', padding:6, flexDirection:'row',
          alignItems:'center', gap:6 }}>
          <Txt style={{ fontSize:10, color:'#fff' }}>▶</Txt>
          <Cap style={{ color:'#ccc', fontSize:8, flex:1 }}>Tap to watch inline</Cap>
          <TouchableOpacity onPress={e=>{ e.stopPropagation?.(); openUrl(); }} activeOpacity={0.75}>
            <Cap style={{ color:'#aaa', fontSize:8 }}>↗ YouTube</Cap>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  // Non-YouTube URL — open in browser
  return (
    <TouchableOpacity onPress={openUrl} activeOpacity={0.75}
      style={{ marginTop:8, flexDirection:'row', alignItems:'center', gap:6,
        borderWidth:1, borderColor:`${C.teal}44`, backgroundColor:`${C.teal}10`,
        padding:8, borderRadius:6 }}>
      <Txt style={{ fontSize:14 }}>🔗</Txt>
      <Txt style={{ fontSize:11, color:C.teal, fontFamily:F.semi, flex:1 }} numberOfLines={1}>
        {url.replace(/^https?:\/\//, '')}
      </Txt>
      <Txt style={{ fontSize:11, color:C.teal }}>→</Txt>
    </TouchableOpacity>
  );
}

// ─── Academy Screen ────────────────────────────────────────────────────────────
const MILESTONE_DEFS = [
  { key:'first_roll',    icon:'⚔️',  label:'First roll',        check:(r)=>r.totalRolls>=1 },
  { key:'streak_7',     icon:'🔥',  label:'7-day streak',      check:(_,streak)=>streak>=7 },
  { key:'streak_14',    icon:'🔥🔥', label:'14-day streak',     check:(_,streak)=>streak>=14 },
  { key:'rolls_10',     icon:'💪',  label:'10 rolls',          check:(r)=>r.totalRolls>=10 },
  { key:'rolls_50',     icon:'⚔️⚔️', label:'50 rolls',          check:(r)=>r.totalRolls>=50 },
  { key:'rolls_100',    icon:'💯',  label:'100 rolls',         check:(r)=>r.totalRolls>=100 },
  { key:'first_sub',    icon:'🔒',  label:'First submission',  check:(r)=>r.subWins>=1 },
  { key:'first_comp',   icon:'🏆',  label:'First competition', check:(r)=>r.compRounds>=1 },
  { key:'first_win',    icon:'🥇',  label:'First comp win',    check:(r)=>r.compWins>=1 },
  { key:'win_rate_50',  icon:'📈',  label:'50% win rate',      check:(r)=>r.totalRolls>=5&&r.winRate>=50 },
];

function computeStreak(dates) {
  if (!dates.length) return 0;
  const sorted = [...new Set(dates)].sort((a,b)=>b.localeCompare(a));
  const today = new Date().toISOString().split('T')[0];
  let streak = 0, cur = today;
  for (const d of sorted) {
    if (d === cur) { streak++; cur = new Date(new Date(cur)-86400000).toISOString().split('T')[0]; }
    else if (d < cur) break;
  }
  return streak;
}

function getInitials(name='') {
  const parts = name.trim().split(' ');
  return parts.length>=2 ? parts[0][0]+parts[parts.length-1][0] : name.slice(0,2).toUpperCase();
}

const BELT_AVATAR_COLORS = {
  white:'rgba(200,200,195,.25)', blue:'rgba(42,74,122,.35)',
  purple:'rgba(90,58,122,.35)', brown:'rgba(90,48,24,.35)',
  black:'rgba(42,42,42,.6)',
};

function AcademyScreen({ athlete, session }) {
  const [leaderData,  setLeaderData]  = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [lbTab,       setLbTab]       = useState('days');    // 'days'|'rolls'|'badges'
  const [period,      setPeriod]      = useState('month');   // 'month'|'3mo'|'all'

  useEffect(() => {
    if (!athlete?.academy_id) { setLoading(false); return; }
    db.getAcademyLeaderboard(athlete.academy_id)
      .then(data => { setLeaderData(data); setLoading(false); })
      .catch(e => { console.error('leaderboard error:', e); setLoading(false); });
  }, [athlete?.academy_id]);

  if (!athlete?.academy_id) return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:32 }}>
      <Txt style={{ fontSize:28, marginBottom:12 }}>🏫</Txt>
      <Cap style={{ textAlign:'center', marginBottom:8 }}>Not assigned to an academy</Cap>
      <Txt style={{ fontSize:12, color:C.muted, textAlign:'center', lineHeight:18 }}>
        Ask your coach to assign you to an academy to see the leaderboard.
      </Txt>
    </View>
  );

  if (loading) return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
      <ActivityIndicator color={C.gold} size="large"/>
      <Cap style={{ marginTop:12 }}>Loading academy data…</Cap>
    </View>
  );

  const { athletes=[], days=[], rolls=[], comps=[] } = leaderData || {};

  // Period cutoff
  const now = new Date();
  const cutoff = period==='month'
    ? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    : period==='3mo'
    ? new Date(now-90*86400000).toISOString().split('T')[0]
    : '2000-01-01';

  // Compute stats per athlete
  const stats = athletes.map(ath => {
    const athDays  = days.filter(d=>d.athlete_id===ath.id && d.date>=cutoff).map(d=>d.date);
    const athRolls = rolls.filter(r=>r.athlete_id===ath.id && (r.started_at||'')>=cutoff);
    const allRolls = rolls.filter(r=>r.athlete_id===ath.id);
    const athComps = comps.filter(c=>c.athlete_id===ath.id);
    const allRounds = athComps.flatMap(c=>c.rounds||[]);
    const streak = computeStreak(days.filter(d=>d.athlete_id===ath.id).map(d=>d.date));
    const wins = athRolls.filter(r=>r.roll_result==='win').length;
    const winRate = athRolls.length ? Math.round((wins/athRolls.length)*100) : 0;
    const subWins = allRolls.filter(r=>{
      const log = r.event_log || [];
      return log.some(e=>e.type==='end'&&e.endType==='submission'&&e.submissionWinner==='me');
    }).length;
    const compWins = allRounds.filter(r=>r.result==='win').length;
    return {
      ...ath,
      trainingDays: athDays.length,
      totalRolls: athRolls.length,
      allTimeRolls: allRolls.length,
      streak, wins, winRate,
      subWins, compWins,
      compRounds: allRounds.length,
    };
  });

  const byDays  = [...stats].sort((a,b)=>b.trainingDays-a.trainingDays||b.streak-a.streak);
  const byRolls = [...stats].sort((a,b)=>b.totalRolls-a.totalRolls||b.winRate-a.winRate);
  const myId = athlete?.id;

  const PodiumCard = ({ s, pos }) => {
    const medals = ['🥇','🥈','🥉'];
    const heights = [72, 52, 38];
    const colors = [
      'rgba(200,162,77,.25)', 'rgba(160,160,155,.15)', 'rgba(150,90,50,.15)'];
    const borders = [
      'rgba(200,162,77,.5)', 'rgba(160,160,155,.4)', 'rgba(150,90,50,.35)'];
    const value = lbTab==='days' ? `${s.trainingDays}d` : `${s.totalRolls}`;
    return (
      <View style={{ flex:1, alignItems:'center', gap:4 }}>
        <Cap style={{ fontSize:8, textAlign:'center' }} numberOfLines={1}>{s.name.split(' ')[0]}</Cap>
        <View style={{ width:'100%', height:heights[pos], borderRadius:4, borderWidth:.5,
          backgroundColor:colors[pos], borderColor:borders[pos],
          alignItems:'center', justifyContent:'center' }}>
          <Txt style={{ fontSize:18 }}>{medals[pos]}</Txt>
        </View>
        <View style={{ borderWidth:.5, borderColor:`${C.gold}44`, backgroundColor:`${C.gold}10`,
          paddingHorizontal:6, paddingVertical:2, borderRadius:3 }}>
          <Cap style={{ fontSize:7, color:C.gold }}>{value}</Cap>
        </View>
      </View>
    );
  };

  const LeaderRow = ({ s, rank, metric, sub }) => {
    const isMe = s.id === myId;
    const list = lbTab==='days' ? byDays : byRolls;
    const max = list[0]?.[metric] || 1;
    const pct = Math.min((s[metric]/max)*100, 100);
    const beltColor = BELT_AVATAR_COLORS[s.belt] || BELT_AVATAR_COLORS.white;
    return (
      <View style={{ backgroundColor:isMe?`${C.gold}08`:'transparent',
        borderRadius:isMe?6:0, padding:isMe?8:0,
        marginBottom:isMe?4:0, borderWidth:isMe?.5:0,
        borderColor:isMe?`${C.gold}33`:'transparent' }}>
        {isMe && <Cap style={{ fontSize:7, color:C.gold, marginBottom:2 }}>You</Cap>}
        <View style={{ flexDirection:'row', alignItems:'center', gap:10, paddingVertical:6,
          borderBottomWidth:isMe?0:.5, borderBottomColor:C.faint }}>
          <Txt style={{ fontSize:12, fontFamily:F.semi, color:rank<=3?C.gold:C.muted,
            width:18, textAlign:'center' }}>{rank}</Txt>
          <View style={{ width:30, height:30, borderRadius:15, backgroundColor:beltColor,
            alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Txt style={{ fontSize:10, fontFamily:F.semi, color:C.text }}>{getInitials(s.name)}</Txt>
          </View>
          <View style={{ flex:1, minWidth:0 }}>
            <Txt style={{ fontSize:12, fontFamily:F.semi, color:C.text }}
              numberOfLines={1}>{s.name}</Txt>
            <Cap style={{ fontSize:8, marginTop:1 }}>{sub}</Cap>
          </View>
          <View style={{ width:56 }}>
            <View style={{ height:4, backgroundColor:C.faint, borderRadius:2 }}>
              <View style={{ height:4, width:`${pct}%`, backgroundColor:C.gold, borderRadius:2 }}/>
            </View>
          </View>
          <Txt style={{ fontSize:11, fontFamily:F.semi, color:C.text, width:28, textAlign:'right' }}>
            {s[metric]}
          </Txt>
        </View>
      </View>
    );
  };

  const top3Days  = byDays.slice(0,3);
  const top3Rolls = byRolls.slice(0,3);

  return (
    <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:16 }}>

      {/* Header */}
      <View style={{ marginBottom:16 }}>
        <Txt style={{ fontSize:20, fontFamily:F.display, color:C.text }}>Grounded Skills Lab</Txt>
        <Cap style={{ marginTop:4 }}>{athletes.length} members</Cap>
      </View>

      {/* View tabs */}
      <View style={{ flexDirection:'row', gap:6, marginBottom:14 }}>
        {[['days','Training days'],['rolls','Rolls logged'],['badges','Milestones']].map(([k,l])=>(
          <TouchableOpacity key={k} onPress={()=>setLbTab(k)} activeOpacity={0.75}
            style={{ flex:1, paddingVertical:8, borderWidth:1, alignItems:'center',
              borderRadius:6, borderColor:lbTab===k?C.gold:C.border,
              backgroundColor:lbTab===k?C.goldDim:'transparent' }}>
            <Txt style={{ fontSize:9, fontFamily:lbTab===k?F.semi:F.body,
              color:lbTab===k?C.gold:C.muted }}>{l}</Txt>
          </TouchableOpacity>
        ))}
      </View>

      {/* Period filter — not shown for badges */}
      {lbTab !== 'badges' && (
        <View style={{ flexDirection:'row', gap:6, marginBottom:14 }}>
          {[['month','This month'],['3mo','3 months'],['all','All time']].map(([k,l])=>(
            <TouchableOpacity key={k} onPress={()=>setPeriod(k)} activeOpacity={0.75}
              style={{ flex:1, paddingVertical:6, borderWidth:.5, alignItems:'center',
                borderRadius:4, borderColor:period===k?`${C.gold}66`:C.border,
                backgroundColor:period===k?`${C.gold}10`:'transparent' }}>
              <Cap style={{ fontSize:8, color:period===k?C.gold:C.muted }}>{l}</Cap>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Training days leaderboard */}
      {lbTab === 'days' && (
        <View>
          {/* Podium */}
          {top3Days.length >= 2 && (
            <View style={{ flexDirection:'row', alignItems:'flex-end', gap:6,
              marginBottom:16, paddingHorizontal:4 }}>
              {[top3Days[1], top3Days[0], top3Days[2]].filter(Boolean).map((s,i)=>(
                <PodiumCard key={s.id} s={s} pos={i===1?0:i===0?1:2}/>
              ))}
            </View>
          )}
          <View style={{ width:3, height:14, backgroundColor:C.gold, marginBottom:10 }}/>
          {byDays.map((s,i)=>(
            <LeaderRow key={s.id} s={s} rank={i+1} metric="trainingDays"
              sub={`${s.streak}d streak${s.streak>=7?' 🔥':''}`}/>
          ))}
        </View>
      )}

      {/* Rolls leaderboard */}
      {lbTab === 'rolls' && (
        <View>
          {top3Rolls.length >= 2 && (
            <View style={{ flexDirection:'row', alignItems:'flex-end', gap:6,
              marginBottom:16, paddingHorizontal:4 }}>
              {[top3Rolls[1], top3Rolls[0], top3Rolls[2]].filter(Boolean).map((s,i)=>(
                <PodiumCard key={s.id} s={s} pos={i===1?0:i===0?1:2}/>
              ))}
            </View>
          )}
          <View style={{ width:3, height:14, backgroundColor:C.gold, marginBottom:10 }}/>
          {byRolls.map((s,i)=>(
            <LeaderRow key={s.id} s={s} rank={i+1} metric="totalRolls"
              sub={`${s.winRate}% win rate`}/>
          ))}
        </View>
      )}

      {/* Milestones / badges */}
      {lbTab === 'badges' && (
        <View>
          {stats.map(s => {
            const streak = s.streak;
            const earned = MILESTONE_DEFS.filter(m=>m.check(s, streak));
            const pending = MILESTONE_DEFS.filter(m=>!m.check(s, streak));
            const isMe = s.id === myId;
            const beltColor = BELT_AVATAR_COLORS[s.belt] || BELT_AVATAR_COLORS.white;
            return (
              <View key={s.id} style={{ marginBottom:16,
                borderWidth:isMe?.5:0, borderColor:`${C.gold}33`,
                borderRadius:isMe?8:0, padding:isMe?10:0 }}>
                {isMe && <Cap style={{ fontSize:7, color:C.gold, marginBottom:4 }}>You</Cap>}
                <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:8 }}>
                  <View style={{ width:28, height:28, borderRadius:14, backgroundColor:beltColor,
                    alignItems:'center', justifyContent:'center' }}>
                    <Txt style={{ fontSize:10, fontFamily:F.semi, color:C.text }}>{getInitials(s.name)}</Txt>
                  </View>
                  <Txt style={{ fontSize:12, fontFamily:F.semi, color:C.text }}>{s.name}</Txt>
                  <Cap style={{ fontSize:8 }}>{earned.length} badges</Cap>
                </View>
                <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6 }}>
                  {earned.map(m=>(
                    <View key={m.key} style={{ borderWidth:.5, borderColor:`${C.gold}55`,
                      backgroundColor:`${C.gold}10`, borderRadius:6, padding:8,
                      alignItems:'center', minWidth:70 }}>
                      <Txt style={{ fontSize:18, marginBottom:3 }}>{m.icon}</Txt>
                      <Cap style={{ fontSize:7, color:C.gold, textAlign:'center' }}>{m.label}</Cap>
                    </View>
                  ))}
                  {pending.slice(0,2).map(m=>(
                    <View key={m.key} style={{ borderWidth:.5, borderColor:C.faint,
                      backgroundColor:C.faint, borderRadius:6, padding:8,
                      alignItems:'center', minWidth:70, opacity:0.4 }}>
                      <Txt style={{ fontSize:18, marginBottom:3 }}>{m.icon}</Txt>
                      <Cap style={{ fontSize:7, textAlign:'center' }}>{m.label}</Cap>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      )}

    </ScrollView>
  );
}

// ─── Beta Consent Modal ───────────────────────────────────────────────────────
const CONSENT_VERSION = '1.0';

function ConsentModal({ onAgree, onDecline }) {
  const [scrolled, setScrolled] = useState(false);
  const [checked,  setChecked]  = useState(false);

  return (
    <Modal visible transparent animationType="fade">
      <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.92)',
        justifyContent:'center', padding:16 }}>
        <View style={{ backgroundColor:C.surface, borderWidth:1, borderColor:C.borderMid,
          borderRadius:12, overflow:'hidden', maxHeight:'90%' }}>

          {/* Header */}
          <View style={{ backgroundColor:C.gold, padding:16 }}>
            <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:4 }}>
              <Txt style={{ fontSize:20 }}>📋</Txt>
              <Txt style={{ fontSize:14, fontFamily:F.bold, color:'#0D0D0B', flex:1 }}>
                Beta Testing Agreement
              </Txt>
            </View>
            <Cap style={{ color:'rgba(13,13,11,0.65)', fontSize:9 }}>
              Grounded Skills Lab · Version {CONSENT_VERSION}
            </Cap>
          </View>

          {/* Scrollable agreement text */}
          <ScrollView
            style={{ maxHeight:340 }}
            contentContainerStyle={{ padding:16 }}
            onScrollEndDrag={()=>setScrolled(true)}
            onMomentumScrollEnd={()=>setScrolled(true)}
            scrollEventThrottle={100}
            onScroll={({nativeEvent})=>{
              const {contentOffset,contentSize,layoutMeasurement}=nativeEvent;
              if(contentOffset.y+layoutMeasurement.height>=contentSize.height-20) setScrolled(true);
            }}>

            <Txt style={{ fontSize:13, fontFamily:F.bold, color:C.text, marginBottom:8 }}>
              1. Purpose
            </Txt>
            <Txt style={{ fontSize:12, color:C.textDim, lineHeight:20, marginBottom:14 }}>
              You are participating in a closed beta test of the GSL BJJ Tracker app ("the App"),
              operated by Grounded Skills Lab. This agreement governs your use of the App during the
              beta testing period.
            </Txt>

            <Txt style={{ fontSize:13, fontFamily:F.bold, color:C.text, marginBottom:8 }}>
              2. Data collection and use
            </Txt>
            <Txt style={{ fontSize:12, color:C.textDim, lineHeight:20, marginBottom:14 }}>
              By using this App you agree that Grounded Skills Lab may collect and store:
              {'\n\n'}• Training logs, roll results, and competition records you enter
              {'\n'}• Journal entries and technique notes you create
              {'\n'}• App usage patterns for the purpose of improving the App
              {'\n\n'}Your data will not be sold to third parties. It may be viewed by your coach and
              academy administrators as part of the coaching relationship you have with Grounded Skills Lab.
            </Txt>

            <Txt style={{ fontSize:13, fontFamily:F.bold, color:C.text, marginBottom:8 }}>
              3. Beta software disclaimer
            </Txt>
            <Txt style={{ fontSize:12, color:C.textDim, lineHeight:20, marginBottom:14 }}>
              This App is beta software. It may contain bugs, errors, or incomplete features. Grounded
              Skills Lab makes no warranty that the App will be error-free, uninterrupted, or that
              data will not be lost. You use it at your own risk during the testing period.
            </Txt>

            <Txt style={{ fontSize:13, fontFamily:F.bold, color:C.text, marginBottom:8 }}>
              4. Feedback
            </Txt>
            <Txt style={{ fontSize:12, color:C.textDim, lineHeight:20, marginBottom:14 }}>
              You agree to provide honest feedback about bugs, usability issues, and feature requests.
              Any feedback you provide may be used to improve the App without compensation.
            </Txt>

            <Txt style={{ fontSize:13, fontFamily:F.bold, color:C.text, marginBottom:8 }}>
              5. Confidentiality
            </Txt>
            <Txt style={{ fontSize:12, color:C.textDim, lineHeight:20, marginBottom:14 }}>
              The App and its features are confidential. You agree not to share screenshots, recordings,
              or descriptions of the App with people outside your academy without permission from
              Grounded Skills Lab.
            </Txt>

            <Txt style={{ fontSize:13, fontFamily:F.bold, color:C.text, marginBottom:8 }}>
              6. Withdrawal
            </Txt>
            <Txt style={{ fontSize:12, color:C.textDim, lineHeight:20, marginBottom:14 }}>
              You may withdraw from the beta test at any time by contacting your coach. Your data will
              be retained for a reasonable period to support your training history unless you request
              its deletion.
            </Txt>

            <Txt style={{ fontSize:12, color:C.textDim, lineHeight:20, marginBottom:8 }}>
              By tapping "I Agree" you confirm you have read and understood this agreement and consent
              to your data being used as described.
            </Txt>

            {!scrolled && (
              <View style={{ alignItems:'center', paddingTop:8 }}>
                <Cap style={{ color:C.muted, fontSize:9 }}>↓ Scroll to read the full agreement</Cap>
              </View>
            )}
          </ScrollView>

          {/* Checkbox + buttons */}
          <View style={{ padding:16, borderTopWidth:1, borderTopColor:C.border }}>
            <TouchableOpacity onPress={()=>setChecked(c=>!c)} activeOpacity={0.75}
              style={{ flexDirection:'row', alignItems:'flex-start', gap:10, marginBottom:16 }}>
              <View style={{ width:20, height:20, borderWidth:2,
                borderColor:checked?C.gold:C.borderMid,
                backgroundColor:checked?C.gold:'transparent',
                alignItems:'center', justifyContent:'center', marginTop:1 }}>
                {checked && <Txt style={{ color:'#0D0D0B', fontSize:12, lineHeight:14 }}>✓</Txt>}
              </View>
              <Txt style={{ fontSize:12, color:C.textDim, flex:1, lineHeight:18 }}>
                I have read and agree to the Beta Testing Participation and Data Consent Agreement.
              </Txt>
            </TouchableOpacity>

            <TouchableOpacity onPress={onAgree}
              disabled={!checked || !scrolled} activeOpacity={0.8}
              style={{ backgroundColor: checked && scrolled ? C.gold : C.faint,
                padding:14, alignItems:'center', marginBottom:8, borderRadius:6 }}>
              <Txt style={{ fontSize:11, fontFamily:F.semi, letterSpacing:1,
                textTransform:'uppercase',
                color: checked && scrolled ? '#0D0D0B' : C.muted }}>
                I Agree — Continue to App
              </Txt>
            </TouchableOpacity>

            <TouchableOpacity onPress={onDecline} activeOpacity={0.75}
              style={{ alignItems:'center', padding:8 }}>
              <Cap style={{ color:C.muted, fontSize:9 }}>Decline and sign out</Cap>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Tutorial Overlay ─────────────────────────────────────────────────────────
const TUTORIAL_STEPS = [
  {
    icon: '🥋',
    title: 'Log your first roll',
    body: 'Tap Track to start recording a sparring session live. Score points, track positions, and end the roll when you\'re done.',
    tip: null,
    tab: 'Track',
  },
  {
    icon: '⚡',
    title: 'Track during the roll',
    body: 'Use the score sheet during live rolls to record sweeps, takedowns, guard passes, and submissions as they happen — for both you and your opponent.',
    tip: 'Every event you log becomes an insight. The more detail you capture, the smarter your analytics get.',
    tab: 'Track',
  },
  {
    icon: '📖',
    title: 'Log every class in the Journal',
    body: 'After training, open the Journal tab and log what you worked on. Every technique gets a tag — Learned, Tried, or Finished.',
    tip: 'Be specific. "Arm drag to back take" is more useful than "back takes". Your insights are only as good as what you log.',
    tab: 'Journal',
  },
  {
    icon: '✅',
    title: 'Always log what you tried and finished',
    body: 'In the custom technique field, add every submission or technique you attempted or completed — even if it wasn\'t drilled in class that day.',
    tip: 'Set the outcome to "Tried" if you went for it but didn\'t finish. Set it to "Finished" if you completed it. This builds your finish rate data over time.',
    tab: 'Journal',
  },
  {
    icon: '📊',
    title: 'Watch your insights grow',
    body: 'Charts tracks your win rate, submission rates, consistency streaks, and technique patterns. The more you log, the more accurate your insights become.',
    tip: null,
    tab: 'Charts',
  },
  {
    icon: '🔔',
    title: 'Import your coach\'s class logs',
    body: 'When your coach posts a class, a teal banner appears. Tap it to open your Journal, import the techniques, then add anything extra you tried or finished.',
    tip: 'Importing a class log automatically marks that day on your consistency calendar — no extra step needed.',
    tab: 'Journal',
  },
];

function TutorialOverlay({ onDone, onSkip }) {
  const [step, setStep] = useState(0);
  const total = TUTORIAL_STEPS.length;
  const s = TUTORIAL_STEPS[step];

  return (
    <View style={{ position:'absolute', inset:0, top:0, left:0, right:0, bottom:0,
      backgroundColor:'rgba(0,0,0,0.82)', zIndex:999, justifyContent:'flex-end' }}>

      {/* Tap-outside to skip */}
      <TouchableOpacity style={{ position:'absolute', inset:0, top:0, left:0, right:0, bottom:0 }}
        activeOpacity={1} onPress={()=>{}} />

      {/* Tutorial card */}
      <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.borderMid,
        margin:14, marginBottom:24, borderRadius:14, overflow:'hidden' }}>

        {/* Header */}
        <View style={{ backgroundColor:C.gold, paddingHorizontal:16, paddingVertical:10,
          flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
          <Txt style={{ fontSize:10, fontFamily:F.semi, color:'#0D0D0B', letterSpacing:1.5,
            textTransform:'uppercase' }}>Getting started</Txt>
          <Cap style={{ color:'#0D0D0B', fontSize:9, opacity:0.65 }}>{step+1} of {total}</Cap>
        </View>

        {/* Body */}
        <View style={{ padding:16 }}>
          <Txt style={{ fontSize:26, marginBottom:10 }}>{s.icon}</Txt>
          <Txt style={{ fontSize:16, fontFamily:F.display, color:C.text, marginBottom:8 }}>{s.title}</Txt>
          <Txt style={{ fontSize:13, color:C.textDim, lineHeight:20 }}>{s.body}</Txt>

          {/* Gold tip box */}
          {s.tip && (
            <View style={{ borderLeftWidth:2, borderLeftColor:C.gold,
              backgroundColor:`${C.gold}12`, padding:10, marginTop:12, borderRadius:2 }}>
              <Txt style={{ fontSize:11, color:C.gold, lineHeight:17 }}>{s.tip}</Txt>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={{ flexDirection:'row', alignItems:'center', gap:8,
          paddingHorizontal:16, paddingVertical:12,
          borderTopWidth:1, borderTopColor:C.border }}>
          <TouchableOpacity onPress={onSkip} activeOpacity={0.75} style={{ flex:1 }}>
            <Cap style={{ color:C.muted }}>Skip tutorial</Cap>
          </TouchableOpacity>

          {/* Step dots */}
          <View style={{ flexDirection:'row', gap:4 }}>
            {TUTORIAL_STEPS.map((_,i) => (
              <View key={i} style={{
                height:5, borderRadius:3,
                width: i===step ? 14 : 5,
                backgroundColor: i===step ? C.gold : C.border,
              }}/>
            ))}
          </View>

          <TouchableOpacity onPress={()=>{ if(step<total-1) setStep(s=>s+1); else onDone(); }}
            activeOpacity={0.8}
            style={{ backgroundColor: step===total-1 ? C.sage : C.gold,
              paddingHorizontal:14, paddingVertical:8, borderRadius:6 }}>
            <Txt style={{ fontSize:9, fontFamily:F.semi, letterSpacing:1,
              textTransform:'uppercase', color:'#0D0D0B' }}>
              {step===total-1 ? 'Done ✓' : 'Next →'}
            </Txt>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Journal Screen ────────────────────────────────────────────────────────────
const SESSION_TYPES = [
  { key:'class',       label:'Class',       icon:'📖' },
  { key:'open_mat',    label:'Open mat',    icon:'🥋' },
  { key:'drilling',    label:'Drilling',    icon:'🔁' },
  { key:'competition', label:'Competition', icon:'🏆' },
];

const OUTCOMES = [
  { key:'learned',   label:'Learned',  color:'#1D9E75', bg:'#E1F5EE' },
  { key:'attempted', label:'Tried',    color:'#BA7517', bg:'#FAEEDA' },
  { key:'finished',  label:'Finished', color:'#993C1D', bg:'#FAECE7' },
];

function JournalScreen({ journal, setJournal, athlete, allTechniques=[], classLogs=[], skippedLogIds=new Set(), onLogDay, onSkipLog }) {
  const today = new Date().toISOString().split('T')[0];

  // New entry form state
  const [sessionType,  setSessionType]  = useState('class');
  const [date,         setDate]         = useState(today);
  const [techniques,   setTechniques]   = useState([{ name:'', outcome:'learned', notes:'', url:'' }]);
  const [sessionNotes, setSessionNotes] = useState('');
  const [saving,       setSaving]       = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [viewMode,     setViewMode]     = useState('entries');
  const [techSearch,   setTechSearch]   = useState('');
  const [ytSearchIdx,  setYtSearchIdx]  = useState(null);
  const [importingLog, setImportingLog] = useState(null); // class_log being imported
  const [importTechs,  setImportTechs]  = useState([]);   // techniques with outcomes
  const [importExtra,  setImportExtra]  = useState([]);   // athlete's own additions
  const [importNotes,  setImportNotes]  = useState('');

  // Already-imported class log IDs
  const importedLogIds = new Set(journal.filter(e=>e.classLogId).map(e=>e.classLogId));

  const pendingLogs = classLogs.filter(cl =>
    !importedLogIds.has(cl.id) && !skippedLogIds.has(cl.id)
  );

  // Derived stats
  const allTechs = journal.flatMap(e => e.techniques || []);
  const techStats = {};
  allTechs.forEach(t => {
    if (!t.name?.trim()) return;
    if (!techStats[t.name]) techStats[t.name] = { learned:0, attempted:0, finished:0 };
    techStats[t.name][t.outcome] = (techStats[t.name][t.outcome]||0) + 1;
  });

  const totalLearned   = allTechs.filter(t=>t.outcome==='learned').length;
  const totalAttempted = allTechs.filter(t=>t.outcome==='attempted'||t.outcome==='finished').length;
  const totalFinished  = allTechs.filter(t=>t.outcome==='finished').length;

  // Top techniques by finish rate
  const topTechs = Object.entries(techStats)
    .filter(([,v]) => v.attempted + v.finished >= 2)
    .sort((a,b) => {
      const ra = a[1].finished / Math.max(a[1].attempted + a[1].finished, 1);
      const rb = b[1].finished / Math.max(b[1].attempted + b[1].finished, 1);
      return rb - ra;
    }).slice(0, 5);

  // Class→roll gap
  const gapTechs = Object.entries(techStats)
    .filter(([,v]) => v.learned >= 2 && !v.attempted && !v.finished)
    .slice(0, 3);

  const addTechRow = () => setTechniques(ts => [...ts, { name:'', outcome:'learned', notes:'', url:'' }]);
  const removeTechRow = i => setTechniques(ts => ts.filter((_,idx)=>idx!==i));
  const updateTech = (i, field, val) => setTechniques(ts => ts.map((t,idx)=>idx===i?{...t,[field]:val}:t));

  const resetForm = () => {
    setTechniques([{ name:'', outcome:'learned', notes:'', url:'' }]);
    setSessionNotes(''); setSessionType('class'); setDate(today);
    setEditingEntry(null);
  };

  const loadForEdit = entry => {
    setEditingEntry(entry);
    setDate(entry.date); setSessionType(entry.sessionType);
    setTechniques(entry.techniques.length ? entry.techniques : [{ name:'', outcome:'learned', notes:'' }]);
    setSessionNotes(entry.notes || '');
  };

  const [saveStatus, setSaveStatus] = useState(''); // '' | 'saving' | 'saved' | 'error'

  const saveEntry = async () => {
    const validTechs = techniques.filter(t => t.name.trim());
    if (!validTechs.length) return;
    if (!athlete?.id) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(''), 3000);
      console.error('journal save: no athlete id');
      return;
    }
    setSaving(true); setSaveStatus('saving');
    const entry = {
      id: editingEntry?.id || uid(),
      athleteId: athlete?.id,
      date, sessionType, notes: sessionNotes,
      techniques: validTechs,
      isEdit: !!editingEntry,
    };
    try {
      await db.upsertJournalEntry(entry);
      setJournal(prev => {
        const without = prev.filter(e => e.id !== entry.id);
        return [entry, ...without].sort((a,b)=>b.date.localeCompare(a.date));
      });
      // Auto-log the session date as a training day
      if (athlete?.id) {
        onLogDay && onLogDay(entry.date);
      }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2000);
      resetForm();
    } catch(e) {
      console.error('journal save failed:', e.message);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(''), 4000);
    }
    setSaving(false);
  };

  const deleteEntry = async id => {
    await db.deleteJournalEntry(id).catch(console.error);
    setJournal(prev => prev.filter(e => e.id !== id));
  };

  const startImport = (classLog) => {
    setImportingLog(classLog);
    setImportTechs((classLog.techniques || []).map(t => ({
      name: t.name, outcome: 'learned', notes: t.notes || '',
    })));
    setImportExtra([]);
    setImportNotes('');
  };

  const saveImport = async () => {
    if (!importingLog) return;
    setSaving(true);
    const allTechsToSave = [
      ...importTechs.filter(t => t.name.trim()),
      ...importExtra.filter(t => t.name.trim()),
    ];
    const entry = {
      id: uid(), athleteId: athlete?.id,
      date: importingLog.date,
      sessionType: importingLog.session_type || 'class',
      techniques: allTechsToSave,
      notes: importNotes,
      classLogId: importingLog.id,
      isEdit: false,
    };
    try {
      await db.upsertJournalEntry(entry);
      setJournal(prev => [entry, ...prev].sort((a,b) => b.date.localeCompare(a.date)));
      // Auto-log the class date as a training day
      if (athlete?.id) {
        onLogDay && onLogDay(importingLog.date);
      }
      setImportingLog(null);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch(e) {
      console.error('import save failed:', e.message);
    }
    setSaving(false);
  };

  const OutcomeBtn = ({ outcome, current, onPress }) => {
    const cfg = OUTCOMES.find(o=>o.key===outcome);
    const active = current === outcome;
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.75}
        style={{ paddingHorizontal:8, paddingVertical:5, borderWidth:1,
          borderColor: active ? cfg.color : C.border,
          backgroundColor: active ? cfg.bg : 'transparent' }}>
        <Txt style={{ fontSize:8, fontFamily:F.semi, letterSpacing:1,
          textTransform:'uppercase', color: active ? cfg.color : C.muted }}>{cfg.label}</Txt>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:16 }} keyboardShouldPersistTaps="always">

      {/* ── Import modal for class log ── */}
      {importingLog && (
        <Modal visible transparent animationType="slide" onRequestClose={()=>setImportingLog(null)}>
          <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios'?'padding':'height'}>
            <ScrollView contentContainerStyle={{ flexGrow:1, backgroundColor:'rgba(10,10,8,0.97)',
              alignItems:'center', justifyContent:'center', padding:20 }}
              keyboardShouldPersistTaps="always">
              <View style={{ backgroundColor:C.surface, borderWidth:1, borderColor:C.teal,
                width:'100%', maxWidth:420, padding:20 }}>
                <View style={{ flexDirection:'row', alignItems:'center', marginBottom:4 }}>
                  <View style={{ width:3, height:16, backgroundColor:C.teal, marginRight:10 }}/>
                  <Txt style={{ fontSize:15, fontFamily:F.bold, flex:1 }}>Import class log</Txt>
                  <TouchableOpacity onPress={()=>setImportingLog(null)} activeOpacity={0.75}>
                    <Txt style={{ color:C.muted, fontSize:20 }}>✕</Txt>
                  </TouchableOpacity>
                </View>
                <Cap style={{ color:C.teal, marginBottom:16 }}>{importingLog.date}</Cap>

                {/* Coach's techniques — adjustable outcomes */}
                <Cap style={{ marginBottom:8 }}>From coach's class — set your outcomes</Cap>
                <View style={{ borderWidth:1, borderColor:`${C.teal}33`, backgroundColor:`${C.teal}08`,
                  padding:2, marginBottom:12 }}>
                  {importTechs.map((tech, i) => (
                    <View key={i} style={{ padding:10, borderBottomWidth:i<importTechs.length-1?1:0,
                      borderBottomColor:C.faint }}>
                      <Txt style={{ fontSize:13, fontFamily:F.semi, marginBottom:2 }}>{tech.name}</Txt>
                      {tech.notes ? <Cap style={{ fontSize:8, marginBottom:4, color:C.muted }}>{tech.notes}</Cap> : null}
                      <TechVideoRef url={tech.url}/>
                      <View style={{ flexDirection:'row', gap:6, marginTop:8 }}>
                        {OUTCOMES.map(o => {
                          const active = tech.outcome === o.key;
                          return (
                            <TouchableOpacity key={o.key} onPress={()=>setImportTechs(ts=>ts.map((t,idx)=>idx===i?{...t,outcome:o.key}:t))}
                              activeOpacity={0.75}
                              style={{ paddingHorizontal:10, paddingVertical:5, borderWidth:1,
                                borderColor: active ? o.color : C.border,
                                backgroundColor: active ? o.bg : 'transparent' }}>
                              <Txt style={{ fontSize:9, fontFamily:F.semi, color: active ? o.color : C.muted }}>{o.label}</Txt>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </View>

                {/* Athlete's own additional techniques */}
                <Cap style={{ marginBottom:8 }}>Add your own techniques (optional)</Cap>
                {importExtra.map((tech, i) => (
                  <View key={i} style={{ marginBottom:8, padding:10, borderWidth:1,
                    borderColor:C.faint, backgroundColor:C.faint }}>
                    <View style={{ flexDirection:'row', gap:6, marginBottom:6 }}>
                      <TextInput value={tech.name}
                        onChangeText={v=>setImportExtra(ts=>ts.map((t,idx)=>idx===i?{...t,name:v}:t))}
                        placeholder="Technique you drilled or finished…"
                        placeholderTextColor={C.muted}
                        style={{ flex:1, borderWidth:1, borderColor:C.borderMid, color:C.text,
                          fontSize:12, fontFamily:F.body, padding:8, backgroundColor:C.card }}/>
                      <TouchableOpacity onPress={()=>setImportExtra(ts=>ts.filter((_,idx)=>idx!==i))} activeOpacity={0.75}>
                        <Txt style={{ color:C.muted, fontSize:18, paddingTop:8 }}>✕</Txt>
                      </TouchableOpacity>
                    </View>
                    <View style={{ flexDirection:'row', gap:6 }}>
                      {OUTCOMES.map(o => {
                        const active = tech.outcome === o.key;
                        return (
                          <TouchableOpacity key={o.key} onPress={()=>setImportExtra(ts=>ts.map((t,idx)=>idx===i?{...t,outcome:o.key}:t))}
                            activeOpacity={0.75}
                            style={{ paddingHorizontal:10, paddingVertical:5, borderWidth:1,
                              borderColor: active ? o.color : C.border,
                              backgroundColor: active ? o.bg : 'transparent' }}>
                            <Txt style={{ fontSize:9, fontFamily:F.semi, color: active ? o.color : C.muted }}>{o.label}</Txt>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
                <TouchableOpacity onPress={()=>setImportExtra(ts=>[...ts,{name:'',outcome:'attempted',notes:''}])}
                  activeOpacity={0.75}
                  style={{ flexDirection:'row', alignItems:'center', gap:8, padding:10,
                    borderWidth:1, borderStyle:'dashed', borderColor:C.borderMid, marginBottom:12 }}>
                  <Txt style={{ fontSize:18, color:C.muted }}>+</Txt>
                  <Cap>Add technique</Cap>
                </TouchableOpacity>

                <Cap style={{ marginBottom:6 }}>Your notes</Cap>
                <TextInput value={importNotes} onChangeText={setImportNotes}
                  placeholder="How did it go? What clicked?" placeholderTextColor={C.muted}
                  multiline numberOfLines={3}
                  style={{ borderWidth:1, borderColor:C.borderMid, color:C.text, fontSize:13,
                    fontFamily:F.body, padding:10, minHeight:60, marginBottom:16, textAlignVertical:'top' }}/>

                <TouchableOpacity onPress={saveImport} disabled={saving} activeOpacity={0.8}
                  style={{ backgroundColor:C.teal, padding:14, alignItems:'center' }}>
                  {saving
                    ? <ActivityIndicator color="#fff"/>
                    : <Txt style={{ fontSize:10, fontFamily:F.semi, letterSpacing:1.5,
                        textTransform:'uppercase', color:'#fff' }}>Save to my journal</Txt>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {/* ── Pending class logs banner ── */}
      {pendingLogs.length > 0 && (
        <View style={{ marginBottom:16 }}>
          <Cap style={{ marginBottom:8, color:C.teal }}>From your coach</Cap>
          {pendingLogs.map(cl => {
            const techNames = (cl.techniques||[]).map(t=>t.name).filter(Boolean).slice(0,3).join(', ');
            const st = SESSION_TYPES.find(s=>s.key===cl.session_type)||SESSION_TYPES[0];
            return (
              <View key={cl.id} style={{ borderWidth:1, borderColor:`${C.teal}44`,
                backgroundColor:`${C.teal}08`, padding:12, marginBottom:8, borderRadius:8 }}>
                <View style={{ flexDirection:'row', alignItems:'flex-start', gap:10 }}>
                  <Txt style={{ fontSize:20 }}>{st.icon}</Txt>
                  <View style={{ flex:1 }}>
                    <Txt style={{ fontSize:13, fontFamily:F.semi, color:C.text, marginBottom:2 }}>
                      {st.label} · {cl.date}
                    </Txt>
                    <Cap style={{ fontSize:9, color:C.teal, marginBottom:8 }}>{techNames}{(cl.techniques||[]).length>3?` +${(cl.techniques||[]).length-3} more`:''}</Cap>
                    <TouchableOpacity onPress={()=>startImport(cl)} activeOpacity={0.75}
                      style={{ alignSelf:'flex-start', borderWidth:1, borderColor:C.teal,
                        backgroundColor:C.teal, paddingHorizontal:12, paddingVertical:6, borderRadius:4 }}>
                      <Txt style={{ fontSize:9, fontFamily:F.semi, color:'#fff', letterSpacing:1,
                        textTransform:'uppercase' }}>Import to journal</Txt>
                    </TouchableOpacity>
                    {onSkipLog && (
                      <TouchableOpacity onPress={()=>onSkipLog(cl.id)} activeOpacity={0.75}
                        style={{ alignSelf:'flex-start', borderWidth:1, borderColor:C.border,
                          paddingHorizontal:10, paddingVertical:6, borderRadius:4, marginTop:6 }}>
                        <Txt style={{ fontSize:9, fontFamily:F.semi, color:C.muted }}>Didn't attend</Txt>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
      <View style={{ flexDirection:'row', gap:8, marginBottom:16 }}>
        {[
          { label:'Techniques learned', value:totalLearned,   color:'#1D9E75' },
          { label:'Attempted live',     value:totalAttempted, color:'#BA7517' },
          { label:'Finished',           value:totalFinished,  color:'#993C1D' },
          { label:'Sessions logged',    value:journal.length, color:C.gold },
        ].map(({label,value,color})=>(
          <View key={label} style={{ flex:1, borderWidth:1, borderColor:C.border,
            backgroundColor:C.card, padding:10, alignItems:'center' }}>
            <Txt style={{ fontSize:18, fontFamily:F.display, color, lineHeight:22 }}>{value}</Txt>
            <Cap style={{ fontSize:6, textAlign:'center', marginTop:3 }}>{label}</Cap>
          </View>
        ))}
      </View>

      {/* Log form */}
      <View style={{ borderWidth:1, borderColor:C.border, backgroundColor:C.card, marginBottom:16 }}>
        <View style={{ flexDirection:'row', alignItems:'center', padding:14,
          borderBottomWidth:1, borderBottomColor:C.border, backgroundColor:C.faint }}>
          <View style={{ width:3, height:14, backgroundColor:C.gold, marginRight:10 }}/>
          <Txt style={{ fontSize:9, fontFamily:F.semi, letterSpacing:2,
            textTransform:'uppercase', color:C.textDim, flex:1 }}>
            {editingEntry ? 'Edit entry' : 'Log techniques'}
          </Txt>
          {editingEntry && (
            <TouchableOpacity onPress={resetForm} activeOpacity={0.75}>
              <Cap style={{ color:C.muted }}>Cancel edit</Cap>
            </TouchableOpacity>
          )}
        </View>
        <View style={{ padding:14 }}>

          {/* Date + session type */}
          <View style={{ flexDirection:'row', gap:8, marginBottom:14 }}>
            <View style={{ flex:1 }}>
              <Cap style={{ marginBottom:6 }}>Date</Cap>
              <TextInput value={date} onChangeText={setDate}
                placeholder="YYYY-MM-DD" placeholderTextColor={C.muted}
                style={{ borderWidth:1, borderColor:C.borderMid, color:C.text, fontSize:13,
                  fontFamily:F.body, padding:10 }}/>
            </View>
          </View>

          <Cap style={{ marginBottom:8 }}>Session type</Cap>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:14 }}>
            <View style={{ flexDirection:'row', gap:6 }}>
              {SESSION_TYPES.map(st=>(
                <TouchableOpacity key={st.key} onPress={()=>setSessionType(st.key)} activeOpacity={0.75}
                  style={{ flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:12, paddingVertical:8,
                    borderWidth:1, borderColor:sessionType===st.key?C.gold:C.border,
                    backgroundColor:sessionType===st.key?C.goldDim:'transparent' }}>
                  <Txt style={{ fontSize:13 }}>{st.icon}</Txt>
                  <Txt style={{ fontSize:11, fontFamily:F.semi,
                    color:sessionType===st.key?C.gold:C.muted }}>{st.label}</Txt>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Legend */}
          <View style={{ flexDirection:'row', gap:12, marginBottom:12 }}>
            {OUTCOMES.map(o=>(
              <View key={o.key} style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
                <View style={{ width:8, height:8, borderRadius:4, backgroundColor:o.color }}/>
                <Cap style={{ fontSize:8 }}>{o.label}</Cap>
              </View>
            ))}
          </View>

          {/* Technique rows */}
          {techniques.map((tech, i) => (
            <View key={i} style={{ marginBottom:10, borderWidth:1, borderColor:C.faint,
              backgroundColor:C.faint, padding:10 }}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:6, marginBottom:8 }}>
                {/* Technique name with predictive suggestions */}
                <View style={{ flex:1 }}>
                  <TextInput
                    value={tech.name}
                    onChangeText={v=>updateTech(i,'name',v)}
                    placeholder="Technique name…"
                    placeholderTextColor={C.muted}
                    returnKeyType="next"
                    style={{ borderWidth:1, borderColor:C.borderMid, color:C.text, fontSize:13,
                      fontFamily:F.body, padding:10, backgroundColor:C.card }}/>
                  {/* Predictive suggestions */}
                  {tech.name.trim().length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}
                      keyboardShouldPersistTaps="always" style={{ marginTop:4 }}>
                      <View style={{ flexDirection:'row', gap:4 }}>
                        {allTechniques.filter(t=>
                          fuzzyMatch(t, tech.name) && t!==tech.name
                        ).slice(0,4).map(s=>(
                          <TouchableOpacity key={s} onPress={()=>updateTech(i,'name',s)}
                            activeOpacity={0.75}
                            style={{ borderWidth:1, borderColor:`${C.gold}55`,
                              backgroundColor:C.goldDim, paddingHorizontal:8, paddingVertical:4 }}>
                            <Txt style={{ fontSize:9, color:C.gold }}>{s}</Txt>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  )}
                </View>
                {/* Delete row */}
                {techniques.length > 1 && (
                  <TouchableOpacity onPress={()=>removeTechRow(i)} activeOpacity={0.75}
                    style={{ padding:4 }}>
                    <Txt style={{ color:C.muted, fontSize:16 }}>✕</Txt>
                  </TouchableOpacity>
                )}
              </View>

              {/* Outcome buttons */}
              <View style={{ flexDirection:'row', gap:6, marginBottom:6 }}>
                {OUTCOMES.map(o=>(
                  <OutcomeBtn key={o.key} outcome={o.key} current={tech.outcome}
                    onPress={()=>updateTech(i,'outcome',o.key)}/>
                ))}
              </View>

              {/* Optional technique note */}
              <TextInput
                value={tech.notes||''}
                onChangeText={v=>updateTech(i,'notes',v)}
                placeholder="Note (optional)…"
                placeholderTextColor={C.muted}
                style={{ borderWidth:1, borderColor:C.border, color:C.text, fontSize:11,
                  fontFamily:F.body, padding:8, backgroundColor:C.card, marginBottom:6 }}/>
              {/* URL + YouTube search */}
              <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                <TextInput
                  value={tech.url||''}
                  onChangeText={v=>updateTech(i,'url',v)}
                  placeholder="Paste URL or search YouTube…"
                  placeholderTextColor={C.muted}
                  autoCapitalize="none" keyboardType="url"
                  style={{ flex:1, borderWidth:1,
                    borderColor:tech.url?`${C.red}44`:C.border,
                    color:tech.url?C.teal:C.text, fontSize:10,
                    fontFamily:F.body, padding:7, backgroundColor:C.card }}/>
                <TouchableOpacity onPress={()=>setYtSearchIdx(i)} activeOpacity={0.75}
                  style={{ backgroundColor:'#cc0000', paddingHorizontal:8, paddingVertical:7,
                    borderRadius:4 }}>
                  <Txt style={{ fontSize:10 }}>▶</Txt>
                </TouchableOpacity>
                </View>
            </View>
          ))}

          {/* YouTube search modal for journal techniques */}
          <YouTubeSearchModal
            visible={ytSearchIdx !== null}
            initialQuery={ytSearchIdx !== null ? techniques[ytSearchIdx]?.name || '' : ''}
            onClose={()=>setYtSearchIdx(null)}
            onSelect={url=>{ if(ytSearchIdx!==null){ updateTech(ytSearchIdx,'url',url); setYtSearchIdx(null); } }}/>

          {/* Add technique row */}
          <TouchableOpacity onPress={addTechRow} activeOpacity={0.75}
            style={{ flexDirection:'row', alignItems:'center', gap:8, padding:10,
              borderWidth:1, borderStyle:'dashed', borderColor:C.borderMid, marginBottom:12 }}>
            <Txt style={{ fontSize:18, color:C.muted }}>+</Txt>
            <Cap>Add technique</Cap>
          </TouchableOpacity>

          {/* Session notes */}
          <Cap style={{ marginBottom:6 }}>Session notes</Cap>
          <TextInput
            value={sessionNotes}
            onChangeText={setSessionNotes}
            placeholder="Coaching cues, things to remember, what clicked today…"
            placeholderTextColor={C.muted}
            multiline numberOfLines={3}
            style={{ borderWidth:1, borderColor:C.borderMid, color:C.text, fontSize:13,
              fontFamily:F.body, padding:12, minHeight:70, marginBottom:14,
              textAlignVertical:'top' }}/>

          <TouchableOpacity onPress={saveEntry} disabled={saving||!techniques.some(t=>t.name.trim())}
            activeOpacity={0.8}
            style={{ backgroundColor:techniques.some(t=>t.name.trim())?
              saveStatus==='error'?C.red:C.gold :C.faint,
              padding:14, alignItems:'center', borderRadius:6 }}>
            {saving
              ? <ActivityIndicator color="#0F0F0D"/>
              : <Txt style={{ fontSize:11, fontFamily:F.semi, letterSpacing:1,
                  textTransform:'uppercase', color:saveStatus==='error'?'#fff':'#0F0F0D' }}>
                  {saveStatus==='saved'?'✓ Saved':saveStatus==='error'?'Failed — check connection':editingEntry?'Save changes':'Save session'}
                </Txt>}
          </TouchableOpacity>
        </View>
      </View>

      {/* Insights panel */}
      {(topTechs.length > 0 || gapTechs.length > 0) && (
        <View style={{ borderWidth:1, borderColor:`${C.gold}55`, backgroundColor:C.goldDim, marginBottom:16 }}>
          <View style={{ flexDirection:'row', alignItems:'center', padding:14,
            borderBottomWidth:1, borderBottomColor:`${C.gold}33` }}>
            <Txt style={{ fontSize:14, marginRight:8 }}>💡</Txt>
            <Txt style={{ fontSize:9, fontFamily:F.semi, letterSpacing:2,
              textTransform:'uppercase', color:C.gold }}>Journal insights</Txt>
          </View>

          {topTechs.length > 0 && (
            <View style={{ padding:14, borderBottomWidth:gapTechs.length>0?1:0, borderBottomColor:`${C.gold}22` }}>
              <Cap style={{ marginBottom:10, color:C.gold }}>Top converting techniques</Cap>
              {topTechs.map(([name, stat]) => {
                const total = stat.attempted + stat.finished;
                const rate = Math.round((stat.finished / total) * 100);
                const rc = rate>=70?C.sage:rate>=40?C.amber:C.red;
                return (
                  <View key={name} style={{ flexDirection:'row', alignItems:'center',
                    paddingVertical:6, borderBottomWidth:1, borderBottomColor:`${C.gold}15` }}>
                    <Txt style={{ flex:1, fontSize:12, color:C.text }}>{name}</Txt>
                    <View style={{ width:60, height:5, backgroundColor:`${C.gold}22`, marginHorizontal:10 }}>
                      <View style={{ height:5, width:`${rate}%`, backgroundColor:rc }}/>
                    </View>
                    <Txt style={{ fontSize:10, fontFamily:F.semi, color:rc, width:36, textAlign:'right' }}>{rate}%</Txt>
                  </View>
                );
              })}
            </View>
          )}

          {gapTechs.length > 0 && (
            <View style={{ padding:14 }}>
              <Cap style={{ marginBottom:8, color:C.amber }}>Drilled but not yet attempted live</Cap>
              {gapTechs.map(([name, stat])=>(
                <View key={name} style={{ flexDirection:'row', alignItems:'center',
                  paddingVertical:5, borderBottomWidth:1, borderBottomColor:`${C.gold}15` }}>
                  <Txt style={{ fontSize:12, color:C.text, flex:1 }}>{name}</Txt>
                  <Cap style={{ fontSize:8, color:C.amber }}>{stat.learned}x drilled</Cap>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* View mode toggle */}
      {journal.length > 0 && (
        <View style={{ flexDirection:'row', gap:6, marginBottom:16 }}>
          {[['entries','📅 By Date'],['techniques','📚 By Technique']].map(([key,label])=>(
            <TouchableOpacity key={key} onPress={()=>setViewMode(key)} activeOpacity={0.75}
              style={{ flex:1, paddingVertical:10, borderWidth:1, alignItems:'center',
                borderColor:viewMode===key?C.gold:C.border,
                backgroundColor:viewMode===key?C.goldDim:'transparent' }}>
              <Txt style={{ fontSize:11, fontFamily:viewMode===key?F.semi:F.body,
                color:viewMode===key?C.gold:C.muted }}>{label}</Txt>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── BY DATE VIEW ── */}
      {journal.length > 0 && viewMode === 'entries' && (
        <View>
          <View style={{ flexDirection:'row', alignItems:'center', marginBottom:10 }}>
            <View style={{ width:3, height:14, backgroundColor:C.teal, marginRight:10 }}/>
            <Txt style={{ fontSize:9, fontFamily:F.semi, letterSpacing:2,
              textTransform:'uppercase', color:C.textDim }}>Past entries</Txt>
          </View>
          {journal.map(entry => {
            const st = SESSION_TYPES.find(s=>s.key===entry.sessionType)||SESSION_TYPES[0];
            return (
              <View key={entry.id} style={{ borderWidth:1, borderColor:C.border,
                backgroundColor:C.card, marginBottom:10 }}>
                <View style={{ flexDirection:'row', alignItems:'center', padding:12,
                  borderBottomWidth:1, borderBottomColor:C.faint, backgroundColor:C.faint }}>
                  <Txt style={{ fontSize:13, marginRight:6 }}>{st.icon}</Txt>
                  <Txt style={{ fontSize:11, fontFamily:F.semi, color:C.text, flex:1 }}>
                    {st.label} · {entry.date}
                  </Txt>
                  <TouchableOpacity onPress={()=>loadForEdit(entry)} activeOpacity={0.75}
                    style={{ padding:6 }}>
                    <Txt style={{ color:C.gold, fontSize:14 }}>✎</Txt>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={()=>deleteEntry(entry.id)} activeOpacity={0.75}
                    style={{ padding:6 }}>
                    <Txt style={{ color:C.muted, fontSize:14 }}>✕</Txt>
                  </TouchableOpacity>
                </View>
                <View style={{ padding:12 }}>
                  <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                    {(entry.techniques||[]).map((t,i)=>{
                      const o = OUTCOMES.find(o=>o.key===t.outcome)||OUTCOMES[0];
                      return (
                        <View key={i} style={{ flexDirection:'row', alignItems:'center', gap:4,
                          paddingHorizontal:8, paddingVertical:4, borderWidth:1,
                          borderColor:o.color+'55', backgroundColor:o.bg }}>
                          <Txt style={{ fontSize:10, color:o.color }}>
                            {o.label==='Learned'?'📖':o.label==='Tried'?'⚡':'✅'}
                          </Txt>
                          <Txt style={{ fontSize:11, color:o.color, fontFamily:F.medium }}>{t.name}</Txt>
                          {t.url ? <Txt style={{ fontSize:10, color:o.color }}>🔗</Txt> : null}
                        </View>
                      );
                    })}
                  </View>
                  {/* Video refs for techniques that have URLs */}
                  {(entry.techniques||[]).filter(t=>t.url).map((t,i)=>(
                    <View key={i} style={{ marginBottom:6 }}>
                      <Cap style={{ fontSize:8, color:C.muted, marginBottom:4 }}>{t.name}</Cap>
                      <TechVideoRef url={t.url}/>
                    </View>
                  ))}
                  {entry.notes ? (
                    <Txt style={{ fontSize:11, color:C.textDim, fontStyle:'italic', lineHeight:16, marginTop:4 }}>
                      "{entry.notes}"
                    </Txt>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* ── BY TECHNIQUE VIEW ── */}
      {journal.length > 0 && viewMode === 'techniques' && (()=>{
        // Build technique index
        const techIndex = {};
        journal.forEach(entry => {
          (entry.techniques||[]).forEach(t => {
            if (!t.name?.trim()) return;
            if (!techIndex[t.name]) techIndex[t.name] = [];
            techIndex[t.name].push({
              date: entry.date,
              sessionType: entry.sessionType,
              outcome: t.outcome,
              techNote: t.notes || '',
              sessionNote: entry.notes || '',
              url: t.url || '',
            });
          });
        });

        const sorted = Object.entries(techIndex)
          .sort((a,b) => b[1][0].date.localeCompare(a[1][0].date));

        return (
          <View>
            <View style={{ flexDirection:'row', alignItems:'center', marginBottom:10 }}>
              <View style={{ width:3, height:14, backgroundColor:C.teal, marginRight:10 }}/>
              <Txt style={{ fontSize:9, fontFamily:F.semi, letterSpacing:2,
                textTransform:'uppercase', color:C.textDim }}>
                {sorted.length} technique{sorted.length!==1?'s':''} logged
              </Txt>
            </View>

            <TextInput
              value={techSearch} onChangeText={setTechSearch}
              placeholder="Search techniques…" placeholderTextColor={C.muted}
              style={{ borderWidth:1, borderColor:C.borderMid, color:C.text, fontSize:13,
                fontFamily:F.body, padding:10, marginBottom:12, backgroundColor:C.faint }}/>

            {sorted
              .filter(([name])=>!techSearch.trim()||fuzzyMatch(name, techSearch))
              .map(([name, appearances]) => {
                const learned   = appearances.filter(a=>a.outcome==='learned').length;
                const attempted = appearances.filter(a=>a.outcome==='attempted').length;
                const finished  = appearances.filter(a=>a.outcome==='finished').length;
                const finishRate = attempted+finished>0 ? Math.round((finished/(attempted+finished))*100) : null;
                const rc = finishRate===null?C.muted:finishRate>=70?C.sage:finishRate>=40?C.amber:C.red;
                const allNotes = appearances
                  .filter(a=>a.techNote||a.sessionNote)
                  .map(a=>({ date:a.date, note:a.techNote||a.sessionNote, sessionType:a.sessionType }));
                // Most recent video URL for this technique
                const videoUrl = appearances.find(a=>a.url)?.url || null;

                return (
                  <View key={name} style={{ borderWidth:1, borderColor:C.border,
                    backgroundColor:C.card, marginBottom:10 }}>
                    {/* Technique header */}
                    <View style={{ padding:14, borderBottomWidth:1, borderBottomColor:C.faint,
                      backgroundColor:C.faint, flexDirection:'row', alignItems:'center' }}>
                      <View style={{ flex:1 }}>
                        <Txt style={{ fontSize:13, fontFamily:F.bold, color:C.text }}>{name}</Txt>
                        <Cap style={{ marginTop:2 }}>
                          {appearances.length} appearance{appearances.length!==1?'s':''} · first logged {appearances[appearances.length-1].date}
                        </Cap>
                      </View>
                      {finishRate !== null && (
                        <View style={{ borderWidth:1, borderColor:`${rc}44`, backgroundColor:`${rc}15`,
                          paddingHorizontal:10, paddingVertical:6, alignItems:'center' }}>
                          <Txt style={{ fontSize:14, fontFamily:F.display, color:rc }}>{finishRate}%</Txt>
                          <Cap style={{ fontSize:6, color:rc }}>finish rate</Cap>
                        </View>
                      )}
                    </View>

                    {/* Outcome summary */}
                    <View style={{ flexDirection:'row', padding:12, gap:8, borderBottomWidth:allNotes.length?1:0,
                      borderBottomColor:C.faint }}>
                      {[
                        {label:'Drilled', value:learned,   color:'#1D9E75', bg:'#E1F5EE', icon:'📖'},
                        {label:'Tried',   value:attempted, color:'#BA7517', bg:'#FAEEDA', icon:'⚡'},
                        {label:'Finished',value:finished,  color:'#993C1D', bg:'#FAECE7', icon:'✅'},
                      ].map(({label,value,color,bg,icon})=>(
                        <View key={label} style={{ flex:1, borderWidth:1, borderColor:`${color}33`,
                          backgroundColor:bg, padding:8, alignItems:'center' }}>
                          <Txt style={{ fontSize:9 }}>{icon}</Txt>
                          <Txt style={{ fontSize:16, fontFamily:F.display, color, lineHeight:22 }}>{value}</Txt>
                          <Cap style={{ fontSize:7, color }}>{label}</Cap>
                        </View>
                      ))}
                    </View>

                    {/* Notes timeline */}
                    {allNotes.length > 0 && (
                      <View style={{ padding:12 }}>
                        <Cap style={{ marginBottom:8, color:C.muted }}>Notes</Cap>
                        {allNotes.map((n,i)=>{
                          const st = SESSION_TYPES.find(s=>s.key===n.sessionType)||SESSION_TYPES[0];
                          return (
                            <View key={i} style={{ flexDirection:'row', gap:10, marginBottom:10,
                              paddingBottom:10, borderBottomWidth:i<allNotes.length-1?1:0,
                              borderBottomColor:C.faint }}>
                              <View style={{ alignItems:'center', paddingTop:2 }}>
                                <Txt style={{ fontSize:13 }}>{st.icon}</Txt>
                                <Cap style={{ fontSize:7, marginTop:2, textAlign:'center' }}>{n.date}</Cap>
                              </View>
                              <Txt style={{ flex:1, fontSize:12, color:C.textDim,
                                fontStyle:'italic', lineHeight:18 }}>"{n.note}"</Txt>
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {/* Video reference */}
                    {videoUrl && (
                      <View style={{ padding:12, borderTopWidth:1, borderTopColor:C.faint }}>
                        <Cap style={{ marginBottom:6, color:C.muted }}>Reference video</Cap>
                        <TechVideoRef url={videoUrl}/>
                      </View>
                    )}
                  </View>
                );
              })}
          </View>
        );
      })()}

      {journal.length === 0 && (
        <View style={{ borderWidth:1, borderColor:C.border, backgroundColor:C.card,
          padding:32, alignItems:'center' }}>
          <Txt style={{ fontSize:28, marginBottom:12 }}>📖</Txt>
          <Cap style={{ textAlign:'center', marginBottom:8 }}>No journal entries yet</Cap>
          <Txt style={{ fontSize:12, color:C.muted, textAlign:'center', lineHeight:18 }}>
            Log the techniques you learn in class, attempt in rolls, and finish — the journal tracks your progress over time.
          </Txt>
        </View>
      )}

    </ScrollView>
  );
}

// ─── Charts Screen ────────────────────────────────────────────────────────────
function ChartsScreen({ rolls, activeRoll, competitions, submissions, sweeps, positions, transitions, takedowns, trainingDays, onLogDay, onRemoveDay, journal }) {
  const [scope,    setScope]    = useState('all');
  const [chartTab, setChartTab] = useState('insights'); // default to insights
  const SCREEN_W_LOCAL = Dimensions.get('window').width - 32;

  // ── Cumulative data ──────────────────────────────────────────────────────────
  const allRolls = [...(activeRoll ? [activeRoll] : []), ...rolls];
  const cumData  = allRolls.reduce((m, r) => {
    ['subCounts','sweepCounts','posDurations','transCounts','guardPassCounts',
     'opp_subCounts','opp_sweepCounts','opp_posDurations','opp_transCounts','opp_guardPassCounts']
      .forEach(k => Object.entries(r[k]||{}).forEach(([kk,v]) => { m[k][kk]=(m[k][kk]||0)+v; }));
    m.eventLog=[...m.eventLog,...(r.eventLog||[])];
    return m;
  }, {subCounts:{},sweepCounts:{},posDurations:{},transCounts:{},guardPassCounts:{},
      opp_subCounts:{},opp_sweepCounts:{},opp_posDurations:{},opp_transCounts:{},opp_guardPassCounts:{},eventLog:[]});

  const rollData   = scope==='all' ? cumData : (rolls.find(r=>r.id===scope)||cumData);
  const tdSet      = new Set(takedowns);
  const myTotalPts = cumData.eventLog.filter(e=>e.side==='me'&&e.scored).reduce((a,e)=>a+(e.pts||0),0);
  const oppTotalPts= cumData.eventLog.filter(e=>e.side==='opp'&&e.scored).reduce((a,e)=>a+(e.pts||0),0);
  const wins       = rolls.filter(r=>{ if(r.rollResult) return r.rollResult==='win'; const my=(r.eventLog||[]).filter(e=>e.side==='me'&&e.scored).reduce((a,e)=>a+(e.pts||0),0); const op=(r.eventLog||[]).filter(e=>e.side==='opp'&&e.scored).reduce((a,e)=>a+(e.pts||0),0); return my>op; }).length;
  const losses     = rolls.filter(r=>{ if(r.rollResult) return r.rollResult==='loss'; const my=(r.eventLog||[]).filter(e=>e.side==='me'&&e.scored).reduce((a,e)=>a+(e.pts||0),0); const op=(r.eventLog||[]).filter(e=>e.side==='opp'&&e.scored).reduce((a,e)=>a+(e.pts||0),0); return my<op; }).length;
  const draws      = rolls.length-wins-losses;
  const recentRolls= [...rolls].reverse().slice(0,10);

  // ── Generate insights once, shared across tabs ───────────────────────────────
  const insights = generateInsights(rolls, takedowns, sweeps, transitions, positions, competitions, journal);

  // ── Training days / consistency ──────────────────────────────────────────────
  const todayStr = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
  const trainedSet = new Set(trainingDays||[]);
  const trainedToday = trainedSet.has(todayStr);

  // Current streak
  const streak = (() => {
    let s=0, d=new Date();
    while(true){
      const ds=d.toISOString().split('T')[0];
      if(!trainedSet.has(ds)){ if(s===0&&ds===todayStr){d.setDate(d.getDate()-1);continue;} break; }
      s++; d.setDate(d.getDate()-1);
    }
    return s;
  })();

  // Days trained this week (Mon–Sun)
  const startOfWeek = (() => { const d=new Date(); d.setDate(d.getDate()-((d.getDay()+6)%7)); return d; })();
  const daysThisWeek = Array.from({length:7},(_,i)=>{ const d=new Date(startOfWeek); d.setDate(d.getDate()+i); return d.toISOString().split('T')[0]; }).filter(ds=>trainedSet.has(ds)).length;

  // Days trained this month
  const now=new Date();
  const daysThisMonth=Array.from({length:now.getDate()},(_,i)=>{
    const d=new Date(now.getFullYear(),now.getMonth(),i+1);
    return d.toISOString().split('T')[0];
  }).filter(ds=>trainedSet.has(ds)).length;

  // Last 12 weeks heat map data (Mon-Sun grids)
  const heatMapWeeks = (() => {
    const weeks=[]; const today=new Date();
    // Go back 11 full weeks + current partial week = 12 weeks total
    const currentMonday=new Date(today); currentMonday.setDate(today.getDate()-((today.getDay()+6)%7));
    for(let w=11;w>=0;w--){
      const weekDays=[];
      for(let d=0;d<7;d++){
        const day=new Date(currentMonday);
        day.setDate(currentMonday.getDate()-w*7+d);
        const ds=day.toISOString().split('T')[0];
        const isFuture=day>today;
        weekDays.push({date:ds,trained:!isFuture&&trainedSet.has(ds),future:isFuture,dayNum:day.getDate(),month:day.getMonth()});
      }
      weeks.push(weekDays);
    }
    return weeks;
  })();

  const CELL=Math.floor((SCREEN_W_LOCAL-48)/12); // cell size for 12-week grid

  // Monthly breakdown (last 6 months)
  const monthlyData = (() => {
    const months=[];
    for(let i=5;i>=0;i--){
      const d=new Date(); d.setMonth(d.getMonth()-i);
      const y=d.getFullYear(),m=d.getMonth();
      const label=d.toLocaleString([],{month:'short'});
      const daysInMonth=new Date(y,m+1,0).getDate();
      const trained=Array.from({length:daysInMonth},(_,j)=>{
        const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(j+1).padStart(2,'0')}`;
        return trainedSet.has(ds)?1:0;
      }).reduce((a,b)=>a+b,0);
      months.push({label,trained,daysInMonth});
    }
    return months;
  })();

  // ── SVG Pie chart ────────────────────────────────────────────────────────────
  const PieChart = ({ data, size=180, label, sublabel }) => {
    const total=data.reduce((s,d)=>s+d.value,0);
    const cx=size/2,cy=size/2,r=size*0.38,ir=size*0.22;
    if(!total) return(
      <View style={{alignItems:'center',marginBottom:16}}>
        <Svg width={size} height={size}>
          <Circle cx={cx} cy={cy} r={r} fill={C.faint}/>
          <Circle cx={cx} cy={cy} r={ir} fill={C.card}/>
        </Svg>
        <Cap style={{marginTop:4}}>No data</Cap>
      </View>
    );
    let angle=-Math.PI/2;
    const slices=data.filter(d=>d.value>0).map((d,i)=>{
      const pct=d.value/total,a0=angle,a1=angle+pct*2*Math.PI; angle=a1;
      const large=pct>.5?1:0;
      const [x1,y1]=[cx+r*Math.cos(a0),cy+r*Math.sin(a0)];
      const [x2,y2]=[cx+r*Math.cos(a1),cy+r*Math.sin(a1)];
      const [ix1,iy1]=[cx+ir*Math.cos(a0),cy+ir*Math.sin(a0)];
      const [ix2,iy2]=[cx+ir*Math.cos(a1),cy+ir*Math.sin(a1)];
      return{path:`M${ix1} ${iy1}L${x1} ${y1}A${r} ${r} 0 ${large} 1 ${x2} ${y2}L${ix2} ${iy2}A${ir} ${ir} 0 ${large} 0 ${ix1} ${iy1}Z`,color:d.color||PIE[i%PIE.length],label:d.label,value:d.value,pct:Math.round(pct*100)};
    });
    return(
      <View style={{alignItems:'center',marginBottom:8}}>
        <Svg width={size} height={size}>
          {slices.map((sl,i)=><Path key={i} d={sl.path} fill={sl.color} stroke={C.card} strokeWidth="2"/>)}
          <Circle cx={cx} cy={cy} r={ir} fill={C.card}/>
          {label&&<SvgText x={cx} y={cy-(sublabel?8:4)} textAnchor="middle" fill={C.gold} fontSize={size*0.1} fontWeight="bold">{label}</SvgText>}
          {sublabel&&<SvgText x={cx} y={cy+10} textAnchor="middle" fill={C.muted} fontSize={size*0.07}>{sublabel}</SvgText>}
        </Svg>
        {/* Legend */}
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,justifyContent:'center',marginTop:4,paddingHorizontal:8}}>
          {slices.map((sl,i)=>(
            <View key={i} style={{flexDirection:'row',alignItems:'center',gap:5}}>
              <View style={{width:8,height:8,backgroundColor:sl.color}}/>
              <Txt style={{fontSize:10,color:C.textDim}}>{sl.label}</Txt>
              <Txt style={{fontSize:10,color:sl.color,fontFamily:F.semi}}>{sl.value} ({sl.pct}%)</Txt>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // ── Section wrapper ───────────────────────────────────────────────────────────
  const Section=({title,accent,children})=>(
    <View style={{borderWidth:1,borderColor:C.border,marginBottom:12}}>
      <View style={{flexDirection:'row',alignItems:'center',padding:14,borderBottomWidth:1,borderBottomColor:C.border,backgroundColor:C.faint}}>
        <View style={{width:3,height:14,backgroundColor:accent,marginRight:10}}/>
        <Txt style={{fontSize:9,fontFamily:F.semi,letterSpacing:2,textTransform:'uppercase',color:C.textDim}}>{title}</Txt>
      </View>
      <View style={{padding:14}}>{children}</View>
    </View>
  );

  // ── Points per roll trend ─────────────────────────────────────────────────────
  const PointsTrend=()=>{
    if(!recentRolls.length) return <Cap style={{textAlign:'center',paddingVertical:16}}>No rolls recorded</Cap>;
    const maxPts=Math.max(...recentRolls.map(r=>{
      const my=(r.eventLog||[]).filter(e=>e.side==='me'&&e.scored).reduce((a,e)=>a+(e.pts||0),0);
      const op=(r.eventLog||[]).filter(e=>e.side==='opp'&&e.scored).reduce((a,e)=>a+(e.pts||0),0);
      return Math.max(my,op);
    }),1);
    return(<View>{recentRolls.map((r,i)=>{
      const my=(r.eventLog||[]).filter(e=>e.side==='me'&&e.scored).reduce((a,e)=>a+(e.pts||0),0);
      const op=(r.eventLog||[]).filter(e=>e.side==='opp'&&e.scored).reduce((a,e)=>a+(e.pts||0),0);
      const win=r.rollResult?r.rollResult==='win':my>op;
      const loss=r.rollResult?r.rollResult==='loss':my<op;
      return(<View key={r.id} style={{marginBottom:10}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:4}}>
          <Txt style={{fontSize:10,color:C.muted,flex:1}} numberOfLines={1}>Roll {rolls.length-i}{r.partner?` · ${r.partner}`:''}</Txt>
          <View style={{flexDirection:'row',gap:8,flexShrink:0}}>
            <Txt style={{fontSize:10,fontFamily:F.semi,color:C.gold}}>{my}<Cap style={{fontSize:7}}> you</Cap></Txt>
            <Txt style={{fontSize:10,fontFamily:F.semi,color:C.stone}}>{op}<Cap style={{fontSize:7}}> opp</Cap></Txt>
            <View style={{borderWidth:1,borderColor:win?`${C.sage}44`:loss?`${C.red}44`:`${C.amber}44`,paddingHorizontal:5,paddingVertical:1}}>
              <Txt style={{fontSize:8,fontFamily:F.semi,color:win?C.sage:loss?C.red:C.amber}}>{win?'W':loss?'L':'D'}</Txt>
            </View>
          </View>
        </View>
        <View style={{height:6,backgroundColor:C.faint,flexDirection:'row'}}>
          <View style={{height:6,width:`${maxPts>0?(my/maxPts)*100:0}%`,backgroundColor:C.gold}}/>
          <View style={{height:6,width:`${maxPts>0?(op/maxPts)*100:0}%`,backgroundColor:C.opp}}/>
        </View>
      </View>);
    })}</View>);
  };

  // ── Submission success rate by position ──────────────────────────────────────
  // For each roll: find positions that were active just before a submission was logged.
  // "Attempt" = any submission event logged during the roll.
  // "Success" = roll ended with endType===submission AND submissionWinner==='me'.
  // We correlate by looking at which positions were entered in the same roll as a sub attempt.
  const subStats = (() => {
    const posMap = {}; // positionName → { attempts, successes, techniques:{techName:{a,s}} }

    const allRollsForSub = [...(activeRoll?[activeRoll]:[]), ...rolls];

    allRollsForSub.forEach(roll => {
      const log = roll.eventLog || [];
      const isSubWin = roll.endType === 'submission' && roll.submissionWinner === 'me';

      // Positions entered during this roll (yours)
      const positionsEntered = [...new Set(
        log.filter(e => e.side === 'me' && e.type === 'position').map(e => e.item)
      )];

      // Submission attempts during this roll (yours)
      const subAttempts = log.filter(e => e.side === 'me' && e.type === 'submission');

      if (subAttempts.length === 0 && !isSubWin) return;

      // For each position entered, attribute the attempts/success
      const posToAttribute = positionsEntered.length > 0 ? positionsEntered : ['Unknown Position'];

      posToAttribute.forEach(pos => {
        if (!posMap[pos]) posMap[pos] = { attempts:0, successes:0, techniques:{} };
        posMap[pos].attempts += subAttempts.length > 0 ? 1 : 0;
        if (isSubWin) posMap[pos].successes += 1;
        subAttempts.forEach(e => {
          const tech = e.item || 'Unknown';
          if (!posMap[pos].techniques[tech]) posMap[pos].techniques[tech] = { attempts:0, successes:0 };
          posMap[pos].techniques[tech].attempts += 1;
          if (isSubWin) posMap[pos].techniques[tech].successes += 1;
        });
      });

      // If roll ended by sub win but no position logged, still record it
      if (isSubWin && positionsEntered.length === 0) {
        const pos = 'Unknown Position';
        if (!posMap[pos]) posMap[pos] = { attempts:0, successes:0, techniques:{} };
        posMap[pos].successes += 1;
        const subName = roll.submissionName || 'Submission';
        if (!posMap[pos].techniques[subName]) posMap[pos].techniques[subName] = { attempts:0, successes:0 };
        posMap[pos].techniques[subName].successes += 1;
      }
    });

    // Convert to sorted array by success count desc
    return Object.entries(posMap)
      .map(([pos, data]) => ({
        pos,
        attempts: data.attempts,
        successes: data.successes,
        rate: data.attempts > 0 ? Math.round((data.successes / data.attempts) * 100) : 0,
        techniques: Object.entries(data.techniques)
          .map(([tech, td]) => ({ tech, ...td, rate: td.attempts > 0 ? Math.round((td.successes/td.attempts)*100) : 0 }))
          .sort((a,b) => b.successes - a.successes),
      }))
      .sort((a,b) => b.successes - a.successes || b.attempts - a.attempts);
  })();

  const totalSubWins  = rolls.filter(r => r.endType==='submission' && r.submissionWinner==='me').length;
  const totalSubLosses= rolls.filter(r => r.endType==='submission' && r.submissionWinner==='opp').length;
  const totalSubRolls = rolls.filter(r => r.endType==='submission').length;

  // ── Tab bar ──────────────────────────────────────────────────────────────────
  const CHART_TABS=[
    {key:'insights',    label:'Insights'},
    {key:'consistency', label:'Consistency'},
    {key:'scoring',     label:'Scoring'},
    {key:'techniques',  label:'Techniques'},
  ];

  return(
    <View style={{flex:1}}>
      {/* Chart tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{flexGrow:0,flexShrink:0,backgroundColor:C.surface,borderBottomWidth:1,borderBottomColor:C.border}}>
        <View style={{flexDirection:'row'}}>
          {CHART_TABS.map(t=>(
            <TouchableOpacity key={t.key} onPress={()=>setChartTab(t.key)} activeOpacity={0.75}
              style={{paddingVertical:12,paddingHorizontal:16,alignItems:'center',borderBottomWidth:2,borderBottomColor:chartTab===t.key?C.gold:'transparent'}}>
              <Txt style={{fontSize:9,fontFamily:chartTab===t.key?F.semi:F.body,letterSpacing:1.5,textTransform:'uppercase',color:chartTab===t.key?C.gold:C.muted}}>{t.label}</Txt>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <ScrollView style={{flex:1}} contentContainerStyle={{padding:16}}>

        {/* ── INSIGHTS TAB ── */}
        {chartTab==='insights'&&(<View>

          {/* Header */}
          <View style={{borderWidth:1,borderColor:`${C.gold}55`,backgroundColor:C.goldDim,marginBottom:16,padding:16}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:10,marginBottom:8}}>
              <Txt style={{fontSize:20}}>💡</Txt>
              <View style={{flex:1}}>
                <Txt style={{fontSize:14,fontFamily:F.bold,color:C.gold}}>Performance Insights</Txt>
                <Cap style={{fontSize:8,color:C.muted,marginTop:2}}>Training + competition patterns</Cap>
              </View>
            </View>
            <Txt style={{fontSize:12,color:C.textDim,lineHeight:18}}>
              {rolls.length === 0 && competitions.flatMap(c=>c.rounds||[]).filter(r=>r.endedAt).length === 0
                ? 'Start recording rolls and competitions to unlock data-driven insights about your game.'
                : insights.length > 0
                  ? `${insights.length} insight${insights.length!==1?'s':''} found across ${rolls.length} roll${rolls.length!==1?'s':''} and ${competitions.flatMap(c=>c.rounds||[]).filter(r=>r.endedAt).length} comp round${competitions.flatMap(c=>c.rounds||[]).filter(r=>r.endedAt).length!==1?'s':''}.`
                  : `Analyzing ${rolls.length} roll${rolls.length!==1?'s':''}${competitions.flatMap(c=>c.rounds||[]).filter(r=>r.endedAt).length>0?` and ${competitions.flatMap(c=>c.rounds||[]).filter(r=>r.endedAt).length} comp rounds`:''} — keep training to unlock pattern insights.`}
            </Txt>
          </View>

          {/* Quick stats — show as soon as ANY data exists */}
          <View style={{flexDirection:'row',gap:8,marginBottom:16,flexWrap:'wrap'}}>
            {[
              {label:'Rolls',       value:rolls.length,                                                               color:C.gold},
              {label:'Win Rate',    value:rolls.length>0?`${Math.round((wins/rolls.length)*100)}%`:'—',              color:C.sage},
              {label:'Sub Wins',    value:rolls.filter(r=>r.endType==='submission'&&r.submissionWinner==='me').length, color:C.red},
              {label:'Comp Rounds', value:competitions.flatMap(c=>c.rounds||[]).filter(r=>r.endedAt).length,          color:C.teal},
              {label:'Streak',      value:`${streak}d`,                                                               color:C.amber},
            ].map(({label,value,color})=>(
              <View key={label} style={{flex:1,minWidth:56,borderWidth:1,borderColor:C.border,backgroundColor:C.card,padding:10,alignItems:'center'}}>
                <Txt style={{fontSize:18,fontFamily:F.display,color,lineHeight:22}}>{value}</Txt>
                <Cap style={{fontSize:6,textAlign:'center',marginTop:3}}>{label}</Cap>
              </View>
            ))}
          </View>

          {/* Active insight cards */}
          {insights.length > 0 && insights.map((ins,i) => (
            <View key={i} style={{borderWidth:1,borderColor:`${ins.color}33`,backgroundColor:C.card,marginBottom:10}}>
              <View style={{flexDirection:'row',alignItems:'center',padding:12,borderBottomWidth:1,borderBottomColor:`${ins.color}22`,backgroundColor:`${ins.color}0A`}}>
                <View style={{width:32,height:32,backgroundColor:`${ins.color}20`,borderWidth:1,borderColor:`${ins.color}44`,alignItems:'center',justifyContent:'center',marginRight:10}}>
                  <Txt style={{fontSize:16}}>{ins.icon}</Txt>
                </View>
                <Txt style={{fontSize:11,fontFamily:F.bold,color:ins.color,flex:1}}>{ins.title}</Txt>
                <View style={{borderWidth:1,borderColor:`${ins.color}44`,paddingHorizontal:6,paddingVertical:2}}>
                  <Cap style={{fontSize:7,color:ins.color}}>{ins.category}</Cap>
                </View>
              </View>
              <View style={{padding:14}}>
                <Txt style={{fontSize:13,color:C.text,lineHeight:20,marginBottom:6}}>{ins.text}</Txt>
                <Txt style={{fontSize:10,color:C.muted,fontFamily:F.medium}}>{ins.detail}</Txt>
              </View>
            </View>
          ))}

          {/* Top Finishing Positions — shows as soon as any sub data exists */}
          {subStats.length > 0 && (
            <View style={{borderWidth:1,borderColor:C.border,backgroundColor:C.card,marginBottom:12}}>
              <View style={{flexDirection:'row',alignItems:'center',padding:14,borderBottomWidth:1,borderBottomColor:C.border,backgroundColor:C.faint}}>
                <View style={{width:3,height:14,backgroundColor:C.red,marginRight:10}}/>
                <Txt style={{fontSize:9,fontFamily:F.semi,letterSpacing:2,textTransform:'uppercase',color:C.textDim}}>Submission Rate by Position</Txt>
              </View>
              <View style={{padding:14}}>
                {[...subStats].sort((a,b)=>b.rate-a.rate||b.successes-a.successes).slice(0,5).map((item,i)=>{
                  const rc = item.rate>=70?C.sage:item.rate>=40?C.amber:item.rate>0?C.red:C.muted;
                  return(
                    <View key={item.pos} style={{flexDirection:'row',alignItems:'center',paddingVertical:8,borderBottomWidth:i<Math.min(subStats.length,5)-1?1:0,borderBottomColor:C.faint}}>
                      <Txt style={{fontSize:10,fontFamily:F.semi,color:C.muted,width:18}}>{i+1}</Txt>
                      <View style={{flex:1}}>
                        <Txt style={{fontSize:12,color:C.text}} numberOfLines={1}>{item.pos}</Txt>
                        <Cap style={{fontSize:7,marginTop:2}}>{item.successes} win{item.successes!==1?'s':''} / {item.attempts} attempt{item.attempts!==1?'s':''}</Cap>
                      </View>
                      <View style={{width:70,height:6,backgroundColor:C.faint,marginHorizontal:10}}>
                        <View style={{height:6,width:`${item.rate}%`,backgroundColor:rc}}/>
                      </View>
                      <View style={{width:42,borderWidth:1,borderColor:`${rc}44`,backgroundColor:`${rc}10`,paddingHorizontal:4,paddingVertical:2,alignItems:'center'}}>
                        <Txt style={{fontSize:10,fontFamily:F.semi,color:rc}}>{item.rate}%</Txt>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* What insights will appear — always shown as a guide */}
          <View style={{borderWidth:1,borderColor:C.border,backgroundColor:C.card,marginBottom:12}}>
            <View style={{flexDirection:'row',alignItems:'center',padding:14,borderBottomWidth:1,borderBottomColor:C.border,backgroundColor:C.faint}}>
              <View style={{width:3,height:14,backgroundColor:C.teal,marginRight:10}}/>
              <Txt style={{fontSize:9,fontFamily:F.semi,letterSpacing:2,textTransform:'uppercase',color:C.textDim}}>
                {insights.length > 0 ? 'More insights unlock as you train' : 'What insights will appear'}
              </Txt>
            </View>
            <View style={{padding:14}}>
              {[
                { icon:'🥋', color:C.sage,  label:'Opening strategy',        desc:'Does starting with a takedown vs guard pull affect your submission rate?', need:'Rolls with takedowns + guard pulls recorded' },
                { icon:'📍', color:C.sage,  label:'Technique × position',    desc:'Which submission works best from which position?',                          need:'Submissions attempted from tracked positions' },
                { icon:'⚡', color:C.gold,  label:'First mover advantage',   desc:'How much does scoring first affect your win rate?',                         need:'Rolls where scoring events are tracked' },
                { icon:'↺', color:C.teal,  label:'Most effective sweep',     desc:'Which sweep correlates most with winning?',                                 need:'Rolls with sweep events tracked' },
                { icon:'🛡', color:C.blue,  label:'Submission defence',       desc:'How often do you escape opponent submission attempts?',                     need:'Rolls where opponent sub attempts are logged' },
                { icon:'💪', color:C.amber, label:'Pressure performance',     desc:'Does your submission rate go up or down when trailing on points?',          need:'Rolls with scoring events tracked' },
                { icon:'→', color:C.teal,  label:'Guard pass impact',        desc:'Does passing guard correlate with winning?',                                need:'Rolls with guard passes recorded' },
                { icon:'🏆', color:C.gold,  label:'Competition record',       desc:'Win rate, method breakdowns, and belt-level matchups from competitions.',    need:'2+ competition rounds completed' },
                { icon:'📈', color:C.sage,  label:'Comp vs training',         desc:'Do you perform better under competition pressure or in training?',          need:'Competition rounds + training rolls' },
                { icon:'🔒', color:C.red,   label:'Submission rate comp/train',desc:'How does your sub finish rate differ between competition and training?',   need:'Competition rounds + training rolls' },
                { icon:'📊', color:C.blue,  label:'Avg comp score',           desc:'Points scored and conceded per competition round on average.',               need:'Competition rounds with scoring tracked' },
                { icon:'⚡', color:C.teal,  label:'Gi vs No-Gi',              desc:'Do you perform better in Gi or No-Gi competition?',                        need:'2+ rounds in both Gi and No-Gi competitions' },
              ].map((item,i,arr) => {
                const isActive = insights.some(ins => ins.icon === item.icon && ins.category !== 'stats');
                return (
                  <View key={i} style={{flexDirection:'row',alignItems:'flex-start',gap:12,paddingVertical:10,borderBottomWidth:i<arr.length-1?1:0,borderBottomColor:C.faint,opacity:isActive?0.5:1}}>
                    <View style={{width:28,height:28,backgroundColor:`${item.color}15`,borderWidth:1,borderColor:`${item.color}33`,alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:2}}>
                      <Txt style={{fontSize:13}}>{item.icon}</Txt>
                    </View>
                    <View style={{flex:1}}>
                      <View style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:3}}>
                        <Txt style={{fontSize:11,fontFamily:F.semi,color:isActive?C.muted:C.textDim}}>{item.label}</Txt>
                        {isActive && <View style={{borderWidth:1,borderColor:`${C.sage}55`,paddingHorizontal:5,paddingVertical:1,backgroundColor:`${C.sage}15`}}><Cap style={{fontSize:6,color:C.sage}}>active</Cap></View>}
                      </View>
                      <Txt style={{fontSize:11,color:C.muted,lineHeight:16,marginBottom:4}}>{item.desc}</Txt>
                      <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
                        <Txt style={{fontSize:9,color:C.border}}>Needs:</Txt>
                        <Txt style={{fontSize:9,color:C.border,fontFamily:F.medium}}>{item.need}</Txt>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

        </View>)}

        {/* ── CONSISTENCY TAB ── */}
        {chartTab==='consistency'&&(<View>

          {/* Log Today button */}
          <View style={{marginBottom:16}}>
            {trainedToday?(
              <View style={{borderWidth:1,borderColor:`${C.sage}55`,backgroundColor:`${C.sage}0D`,padding:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
                <View>
                  <Txt style={{fontSize:13,fontFamily:F.semi,color:C.sage}}>✓ Trained Today</Txt>
                  <Cap style={{marginTop:2,color:C.sage}}>{todayStr}</Cap>
                </View>
                <TouchableOpacity onPress={()=>onRemoveDay(todayStr)} activeOpacity={0.75}
                  style={{borderWidth:1,borderColor:`${C.red}44`,paddingHorizontal:12,paddingVertical:8}}>
                  <Txt style={{fontSize:9,fontFamily:F.semi,color:C.red,letterSpacing:1.5,textTransform:'uppercase'}}>Remove</Txt>
                </TouchableOpacity>
              </View>
            ):(
              <TouchableOpacity onPress={()=>onLogDay(todayStr)} activeOpacity={0.8}
                style={{backgroundColor:C.gold,padding:16,alignItems:'center'}}>
                <Txt style={{fontSize:10,fontFamily:F.display,letterSpacing:3,textTransform:'uppercase',color:'#0D0D0B'}}>+ Log Today's Training</Txt>
              </TouchableOpacity>
            )}
          </View>

          {/* Streak + stats */}
          <View style={{flexDirection:'row',gap:8,marginBottom:12}}>
            {[
              {label:'Current Streak',value:`${streak}`,sub:'days'},
              {label:'This Week',    value:`${daysThisWeek}`,sub:'/ 7 days'},
              {label:'This Month',   value:`${daysThisMonth}`,sub:`/ ${new Date().getDate()} days`},
              {label:'Total Days',   value:`${trainedSet.size}`,sub:'logged'},
            ].map(({label,value,sub})=>(
              <View key={label} style={{flex:1,borderWidth:1,borderColor:C.border,padding:10,alignItems:'center',backgroundColor:C.card}}>
                <Txt style={{fontSize:20,fontFamily:F.display,color:C.gold,lineHeight:24}}>{value}</Txt>
                <Cap style={{fontSize:6,textAlign:'center',marginTop:3}}>{sub}</Cap>
                <Cap style={{fontSize:6,textAlign:'center',color:C.muted,marginTop:1}}>{label}</Cap>
              </View>
            ))}
          </View>

          {/* 12-week heat map */}
          <Section title="12-Week Training Calendar" accent={C.gold}>
            {/* Day labels */}
            <View style={{flexDirection:'row',marginBottom:6}}>
              <View style={{width:30}}/>
              {['M','T','W','T','F','S','S'].map((d,i)=>(
                <View key={i} style={{width:CELL,alignItems:'center'}}>
                  <Cap style={{fontSize:7}}>{d}</Cap>
                </View>
              ))}
            </View>
            {/* Grid */}
            {heatMapWeeks.map((week,wi)=>{
              const monday=week[0];
              const showMonth=wi===0||monday.dayNum<=7;
              return(
                <View key={wi} style={{flexDirection:'row',marginBottom:3,alignItems:'center'}}>
                  <View style={{width:30}}>
                    {(monday.dayNum<=7||wi===0)&&<Cap style={{fontSize:6}}>{new Date(2024,monday.month,1).toLocaleString([],{month:'short'})}</Cap>}
                  </View>
                  {week.map((day,di)=>(
                    <TouchableOpacity key={di} onPress={()=>{ if(!day.future){ if(trainedSet.has(day.date)) onRemoveDay(day.date); else onLogDay(day.date); }}} activeOpacity={0.7}
                      style={{width:CELL,height:CELL,backgroundColor:day.future?'transparent':day.trained?C.gold:C.faint,marginRight:2,borderWidth:day.date===todayStr?1:0,borderColor:C.gold}}>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })}
            <View style={{flexDirection:'row',alignItems:'center',gap:8,marginTop:10}}>
              <View style={{width:10,height:10,backgroundColor:C.faint}}/>
              <Cap>Rest</Cap>
              <View style={{width:10,height:10,backgroundColor:C.gold}}/>
              <Cap>Trained</Cap>
              <View style={{width:10,height:10,backgroundColor:'transparent',borderWidth:1,borderColor:C.gold}}/>
              <Cap>Today</Cap>
            </View>
          </Section>

          {/* Monthly bar chart */}
          <Section title="Monthly Training Days" accent={C.teal}>
            {monthlyData.map((m,i)=>{
              const pct=m.daysInMonth>0?m.trained/m.daysInMonth:0;
              return(
                <View key={i} style={{marginBottom:10}}>
                  <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:4}}>
                    <Txt style={{fontSize:11,color:C.textDim}}>{m.label}</Txt>
                    <Txt style={{fontSize:11,fontFamily:F.semi,color:C.teal}}>{m.trained} <Cap style={{fontSize:8}}>days</Cap></Txt>
                  </View>
                  <View style={{height:8,backgroundColor:C.faint}}>
                    <View style={{height:8,width:`${pct*100}%`,backgroundColor:C.teal}}/>
                  </View>
                </View>
              );
            })}
          </Section>

          {/* Rolls on training days */}
          {rolls.length>0&&(
            <Section title="Sessions Per Training Day" accent={C.blue}>
              {(() => {
                const byDay={};
                rolls.forEach(r=>{ const ds=r.startedAt?new Date(r.startedAt).toISOString().split('T')[0]:null; if(ds){byDay[ds]=(byDay[ds]||0)+1;} });
                const sorted=Object.entries(byDay).sort(([a],[b])=>b.localeCompare(a)).slice(0,8);
                if(!sorted.length) return <Cap style={{textAlign:'center',paddingVertical:8}}>No sessions logged</Cap>;
                return sorted.map(([ds,count])=>(
                  <View key={ds} style={{flexDirection:'row',justifyContent:'space-between',paddingVertical:6,borderBottomWidth:1,borderBottomColor:C.faint}}>
                    <Txt style={{fontSize:11,color:C.muted}}>{new Date(ds).toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'})}</Txt>
                    <Txt style={{fontSize:11,fontFamily:F.semi,color:C.blue}}>{count} roll{count!==1?'s':''}</Txt>
                  </View>
                ));
              })()}
            </Section>
          )}
        </View>)}

        {/* ── SCORING TAB ── */}
        {chartTab==='scoring'&&(<View>
          {/* Scope selector */}
          <View style={{marginBottom:16}}>
            <Cap style={{marginBottom:8}}>Viewing</Cap>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{flexDirection:'row',gap:6}}>
                <TouchableOpacity onPress={()=>setScope('all')} activeOpacity={0.75}
                  style={{borderWidth:1,borderColor:scope==='all'?C.gold:C.border,backgroundColor:scope==='all'?C.goldDim:'transparent',paddingHorizontal:14,paddingVertical:8}}>
                  <Txt style={{fontSize:9,fontFamily:scope==='all'?F.semi:F.body,color:scope==='all'?C.gold:C.muted,letterSpacing:1.5,textTransform:'uppercase'}}>All Sessions</Txt>
                </TouchableOpacity>
                {rolls.slice(0,8).map((r,i)=>(
                  <TouchableOpacity key={r.id} onPress={()=>setScope(r.id)} activeOpacity={0.75}
                    style={{borderWidth:1,borderColor:scope===r.id?C.gold:C.border,backgroundColor:scope===r.id?C.goldDim:'transparent',paddingHorizontal:12,paddingVertical:8}}>
                    <Txt style={{fontSize:9,fontFamily:scope===r.id?F.semi:F.body,color:scope===r.id?C.gold:C.muted,letterSpacing:1.5,textTransform:'uppercase'}}>#{rolls.length-i}{r.partner?` ${r.partner}`:''}</Txt>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {scope!=='all'&&<View style={{marginBottom:12}}><ScoreComparison roll={rollData}/></View>}

          {/* W/L/D pie */}
          {scope==='all'&&rolls.length>0&&(
            <Section title="Training Record" accent={C.sage}>
              <PieChart
                size={200}
                label={String(rolls.length)}
                sublabel="rolls"
                data={[
                  {label:'Wins',value:wins,color:C.sage},
                  {label:'Losses',value:losses,color:C.red},
                  ...(draws>0?[{label:'Draws',value:draws,color:C.amber}]:[]),
                ].filter(d=>d.value>0)}/>
            </Section>
          )}

          {/* Points breakdown pie */}
          {(myTotalPts>0||oppTotalPts>0)&&(
            <Section title="Points Distribution" accent={C.gold}>
              <PieChart
                size={200}
                label={String(myTotalPts+oppTotalPts)}
                sublabel="total pts"
                data={Object.entries(SCORE_EVENTS).map(([key,ev])=>{
                  const pts=rollData.eventLog.filter(e=>e.side==='me'&&e.scored&&e.scoreKey===key).reduce((a,e)=>a+(e.pts||0),0);
                  return {label:ev.label,value:pts,color:ev.color};
                }).filter(d=>d.value>0)}/>
            </Section>
          )}

          {/* Comp record pie */}
          {scope==='all'&&competitions.length>0&&(()=>{
            const cW=competitions.reduce((a,c)=>a+c.rounds.filter(r=>r.result==='win').length,0);
            const cL=competitions.reduce((a,c)=>a+c.rounds.filter(r=>r.result==='loss').length,0);
            const cD=competitions.reduce((a,c)=>a+c.rounds.filter(r=>r.result==='draw').length,0);
            return(
              <Section title="Competition Record" accent={C.gold}>
                <PieChart size={200} label={String(cW+cL+cD)} sublabel="rounds"
                  data={[{label:'Wins',value:cW,color:C.sage},{label:'Losses',value:cL,color:C.red},...(cD>0?[{label:'Draws',value:cD,color:C.amber}]:[])].filter(d=>d.value>0)}/>
              </Section>
            );
          })()}

          {/* Points trend */}
          {rolls.length>0&&(
            <Section title="Points Per Session" accent={C.blue}>
              <PointsTrend/>
            </Section>
          )}
        </View>)}

        {/* ── TECHNIQUES TAB ── */}
        {chartTab==='techniques'&&(<View>
          {/* Scope selector */}
          <View style={{marginBottom:16}}>
            <Cap style={{marginBottom:8}}>Viewing</Cap>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{flexDirection:'row',gap:6}}>
                <TouchableOpacity onPress={()=>setScope('all')} activeOpacity={0.75}
                  style={{borderWidth:1,borderColor:scope==='all'?C.gold:C.border,backgroundColor:scope==='all'?C.goldDim:'transparent',paddingHorizontal:14,paddingVertical:8}}>
                  <Txt style={{fontSize:9,fontFamily:scope==='all'?F.semi:F.body,color:scope==='all'?C.gold:C.muted,letterSpacing:1.5,textTransform:'uppercase'}}>All Sessions</Txt>
                </TouchableOpacity>
                {rolls.slice(0,8).map((r,i)=>(
                  <TouchableOpacity key={r.id} onPress={()=>setScope(r.id)} activeOpacity={0.75}
                    style={{borderWidth:1,borderColor:scope===r.id?C.gold:C.border,backgroundColor:scope===r.id?C.goldDim:'transparent',paddingHorizontal:12,paddingVertical:8}}>
                    <Txt style={{fontSize:9,fontFamily:scope===r.id?F.semi:F.body,color:scope===r.id?C.gold:C.muted,letterSpacing:1.5,textTransform:'uppercase'}}>#{rolls.length-i}{r.partner?` ${r.partner}`:''}</Txt>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={{flexDirection:'row',alignItems:'center',marginBottom:12}}>
            <View style={{flex:1,height:1,backgroundColor:C.border}}/>
            <Cap style={{marginHorizontal:10,color:C.gold}}>Your Game</Cap>
            <View style={{flex:1,height:1,backgroundColor:C.border}}/>
          </View>

          <Section title="Submissions" accent={C.red}>
            <PieChart size={200} data={submissions.map((s,i)=>({label:s,value:rollData.subCounts[s]||0,color:PIE[i%PIE.length]})).filter(d=>d.value>0)}/>
          </Section>
          <Section title="Sweeps" accent={C.gold}>
            <PieChart size={200} data={sweeps.map((s,i)=>({label:s,value:rollData.sweepCounts[s]||0,color:PIE[i%PIE.length]})).filter(d=>d.value>0)}/>
          </Section>
          <Section title="Guard Passes" accent={C.teal}>
            <PieChart size={200} data={Object.entries(rollData.guardPassCounts||{}).map(([k,v],i)=>({label:k,value:v,color:PIE[i%PIE.length]})).filter(d=>d.value>0)}/>
          </Section>
          <Section title="Position Time" accent={C.sage}>
            <PieChart size={200} data={positions.map((p,i)=>({label:p,value:rollData.posDurations[p]||0,color:PIE[i%PIE.length]})).filter(d=>d.value>0)}/>
          </Section>
          <Section title="Takedowns" accent={C.blue}>
            <PieChart size={200} data={transitions.filter(t=>tdSet.has(t)).map((t,i)=>({label:t,value:rollData.transCounts[t]||0,color:PIE[i%PIE.length]})).filter(d=>d.value>0)}/>
          </Section>

          <View style={{flexDirection:'row',alignItems:'center',marginBottom:12,marginTop:4}}>
            <View style={{flex:1,height:1,backgroundColor:C.border}}/>
            <Cap style={{marginHorizontal:10,color:C.stone}}>Opponent Game</Cap>
            <View style={{flex:1,height:1,backgroundColor:C.border}}/>
          </View>

          <Section title="Opp. Submissions" accent={C.opp}>
            <PieChart size={200} data={submissions.map((s,i)=>({label:s,value:rollData.opp_subCounts[s]||0,color:PIE[i%PIE.length]})).filter(d=>d.value>0)}/>
          </Section>
          <Section title="Opp. Sweeps" accent={C.opp}>
            <PieChart size={200} data={sweeps.map((s,i)=>({label:s,value:rollData.opp_sweepCounts[s]||0,color:PIE[i%PIE.length]})).filter(d=>d.value>0)}/>
          </Section>
          <Section title="Opp. Position Time" accent={C.opp}>
            <PieChart size={200} data={positions.map((p,i)=>({label:p,value:rollData.opp_posDurations[p]||0,color:PIE[i%PIE.length]})).filter(d=>d.value>0)}/>
          </Section>
        </View>)}

        <View style={{height:20}}/>
      </ScrollView>
    </View>
  );
}

// ─── Track Screen ────────────────────────────────────────────────────────────────
function TrackScreen({ activeRoll, onStartRoll, onEndRoll, onTogglePause, onMutate, activeProfile, trackingProps }) {
  const [showStart, setShowStart] = useState(false);
  const [showEnd,   setShowEnd]   = useState(false);
  const isPaused = !!activeRoll?.paused;

  return (
    <View style={{ flex:1 }}>
      {!activeRoll ? (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:32 }}>
          {/* Large logo mark — centrepiece */}
          <GSLLogo size={100}/>
          <View style={{ width:40, height:2, backgroundColor:C.gold, marginTop:20, marginBottom:20 }}/>
          {/* Profile identity */}
          <Txt style={{ fontSize:9, color:C.muted, letterSpacing:4, textTransform:'uppercase', marginBottom:6, textAlign:'center' }}>{activeProfile?.name||'Athlete'}</Txt>
          <View style={{ marginBottom:8 }}><BeltBadge belt={activeProfile?.belt||'white'} stripes={activeProfile?.stripes||0} size="lg"/></View>
          {activeProfile?.gym ? <Txt style={{ fontSize:9, color:C.muted, letterSpacing:1, marginBottom:28 }}>{activeProfile.gym}</Txt> : <View style={{ height:28 }}/>}
          {/* Brand tagline */}
          <Txt style={{ fontSize:22, fontFamily:F.display, color:C.text, letterSpacing:-0.5, textAlign:'center', lineHeight:28 }}>Train. Measure.</Txt>
          <Txt style={{ fontSize:22, fontFamily:F.display, color:C.gold, letterSpacing:-0.5, textAlign:'center', lineHeight:28, marginBottom:36 }}>Improve. Repeat.</Txt>
          {/* CTA */}
          <TouchableOpacity onPress={()=>setShowStart(true)} activeOpacity={0.8}
            style={{ backgroundColor:C.gold, paddingHorizontal:44, paddingVertical:16, alignItems:'center' }}>
            <Txt style={{ fontSize:10, fontFamily:F.display, letterSpacing:3.5, textTransform:'uppercase', color:'#0D0D0B' }}>Start Session</Txt>
          </TouchableOpacity>
          <Txt style={{ fontSize:8, color:C.border, letterSpacing:2, textTransform:'uppercase', marginTop:40 }}>Structured practice. Measured progress.</Txt>
        </View>
      ) : (
        <View style={{ flex:1 }}>
          {/* Active roll header */}
          <View style={{ backgroundColor:C.faint, borderBottomWidth:1, borderBottomColor:isPaused?C.amber:`${C.gold}33`, flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:14 }}>
            <View>
              <Txt style={{ fontSize:8, color:isPaused?C.amber:C.gold, fontFamily:F.semi, letterSpacing:2.5, textTransform:'uppercase', marginBottom:2 }}>{isPaused?'⏸ Paused':'● Live'}</Txt>
              <Txt style={{ fontSize:13, fontFamily:F.semi }}>{activeRoll.partner||'Training Session'}</Txt>
            </View>
            <View style={{ flexDirection:'row', gap:8 }}>
              <PauseButton isPaused={isPaused} onToggle={onTogglePause} small/>
              <TouchableOpacity onPress={()=>setShowEnd(true)} activeOpacity={0.75} style={{ backgroundColor:C.sage, paddingHorizontal:14, paddingVertical:8, alignItems:'center', justifyContent:'center' }}>
                <Txt style={{ fontSize:9, fontFamily:F.semi, letterSpacing:2, textTransform:'uppercase', color:C.offWhite }}>End Roll</Txt>
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:16 }} keyboardShouldPersistTaps="handled">
            <RollTrackingPanel roll={activeRoll} onMutate={onMutate} {...trackingProps}/>
          </ScrollView>
        </View>
      )}
      <StartRollModal visible={showStart} onStart={name=>{ onStartRoll(name); setShowStart(false); }} onCancel={()=>setShowStart(false)}/>
      <EndRollModal visible={showEnd} submissions={trackingProps.submissions} onEnd={result=>{ onEndRoll(result); setShowEnd(false); }} onCancel={()=>setShowEnd(false)}/>
    </View>
  );
}

// ─── Rolls Screen ────────────────────────────────────────────────────────────────
function RollsScreen({ rolls, activeRoll, onTogglePause, onEndRoll, confirm, trackingProps }) {
  const [viewingRoll, setViewing] = useState(null);
  const [showEnd, setShowEnd]     = useState(false);
  const [rollsState, setRollsState] = useState(rolls);

  useEffect(() => setRollsState(rolls), [rolls]);

  const isPaused = !!activeRoll?.paused;

  if (viewingRoll) {
    const current = [...(activeRoll?[activeRoll]:[]), ...rolls].find(r=>r.id===viewingRoll.id) || viewingRoll;
    const isActive = activeRoll?.id === viewingRoll.id;
    return (
      <View style={{ flex:1 }}>
        <View style={{ backgroundColor:C.surface, borderBottomWidth:1, borderBottomColor:C.border, flexDirection:'row', alignItems:'center', padding:14, gap:12 }}>
          <TouchableOpacity onPress={()=>setViewing(null)} activeOpacity={0.7} style={{ padding:4 }}>
            <Txt style={{ fontSize:16, color:C.muted }}>←</Txt>
          </TouchableOpacity>
          <Txt style={{ flex:1, fontSize:14, fontFamily:F.semi }}>
            Roll {String(isActive ? rolls.length+1 : rolls.length - rolls.findIndex(r=>r.id===viewingRoll.id)).padStart(2,'0')}
            {current.partner?<Txt style={{ color:C.muted, fontFamily:F.body }}> · {current.partner}</Txt>:''}
          </Txt>
        </View>
        <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:16 }}>
          <ScoreComparison roll={current}/>
          <View style={{ height:16 }}/>
          <EventLogPanel log={current.eventLog||[]}/>
        </ScrollView>
        {isActive && <>
          <View style={{ backgroundColor:C.faint, borderTopWidth:1, borderTopColor:C.border, flexDirection:'row', gap:8, padding:12 }}>
            <PauseButton isPaused={isPaused} onToggle={onTogglePause} small/>
            <TouchableOpacity onPress={()=>setShowEnd(true)} activeOpacity={0.75} style={{ flex:1, backgroundColor:C.sage, alignItems:'center', justifyContent:'center', minHeight:44 }}>
              <Txt style={{ fontSize:9, fontFamily:F.bold, color:C.offWhite, letterSpacing:2, textTransform:'uppercase' }}>End Roll</Txt>
            </TouchableOpacity>
          </View>
          <EndRollModal visible={showEnd} submissions={trackingProps.submissions} onEnd={result=>{ onEndRoll(result); setShowEnd(false); setViewing(null); }} onCancel={()=>setShowEnd(false)}/>
        </>}
      </View>
    );
  }

  return (
    <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:16 }}>
      {activeRoll && (
        <TouchableOpacity onPress={()=>setViewing(activeRoll)} activeOpacity={0.75}
          style={{ borderWidth:1, borderColor:isPaused?C.amber:`${C.gold}44`, backgroundColor:C.faint, padding:14, marginBottom:12 }}>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
            <View>
              <Txt style={{ fontSize:8, color:isPaused?C.amber:C.gold, fontFamily:F.semi, letterSpacing:2, textTransform:'uppercase', marginBottom:2 }}>{isPaused?'⏸ Paused':'● Live Session'}</Txt>
              <Txt style={{ fontSize:13, fontFamily:F.semi }}>{activeRoll.partner||'Training'}</Txt>
            </View>
            <ScoreComparison roll={activeRoll} compact/>
          </View>
        </TouchableOpacity>
      )}
      {!rolls.length && !activeRoll && <Cap style={{ textAlign:'center', marginVertical:60 }}>No sessions recorded</Cap>}
      {rolls.map((r,i) => (
        <RollCard key={r.id} roll={r} index={rolls.length-i} onView={setViewing}
          onDelete={async id=>{ const ok=await confirm('Delete this roll?'); if(ok){ trackingProps.setRolls?.(rs=>rs.filter(x=>x.id!==id)); }}} confirm={confirm}/>
      ))}
    </ScrollView>
  );
}

// ─── Comps Screen (simplified comp detail inline) ─────────────────────────────
function CompsScreen({ competitions, setCompetitions, trackingProps, confirm, onLogDay }) {
  const [activeCompId, setActiveComp]     = useState(null);
  const [activeRoundId, setActiveRound]   = useState(null);
  const [showNewComp, setShowNewComp]     = useState(false);
  const [editingComp,   setEditingComp]   = useState(null);
  const [showStartRound, setShowStartRound] = useState(false);
  const [editingRound,  setEditingRound]  = useState(null);
  const [showEndRound, setShowEndRound]   = useState(false);
  const [endMeta, setEndMeta] = useState({ endType:null, result:'win', method:'points', submissionName:'', submissionWinner:'me', matchTime:'' });

  const activeComp  = competitions.find(c=>c.id===activeCompId)||null;
  const activeRound = activeComp?.rounds?.find(r=>r.id===activeRoundId)||null;

  const updateComp  = comp => setCompetitions(cs=>cs.map(c=>c.id===comp.id?comp:c));
  const deleteComp  = async id => { const ok=await confirm('Delete this competition and all rounds?'); if(ok){ setCompetitions(cs=>cs.filter(c=>c.id!==id)); setActiveComp(null); }};
  const mutateRound = fn => setCompetitions(cs=>cs.map(c=>c.id===activeCompId?{...c,rounds:c.rounds.map(r=>r.id===activeRoundId?fn(r):r)}:c));

  const startRound = (oppName, oppAbbr, oppBelt, oppStripes) => {
    const round = {
      ...emptyRoll(oppName, true),
      opponent: oppName, oppAbbr,
      oppBelt: oppBelt || 'white',
      oppStripes: oppStripes || 0,
      result: 'win', method: 'points', submissionName: '', matchTime: '',
    };
    setCompetitions(cs=>cs.map(c=>c.id===activeCompId?{...c,rounds:[...c.rounds,round]}:c));
    setActiveRound(round.id); setShowStartRound(false);
  };
  const endRound = meta => {
    const now = Date.now();
    const isSub = meta.endType === 'submission';

    // Submission always determines result — ignore points
    const resolvedResult = isSub ? meta.submissionWinner === 'me' ? 'win' : 'loss' : meta.result;

    const endEvent = {
      id: uid(), ts: now, side: 'me', type: 'end',
      item: isSub ? 'submission' : 'time',
      label: isSub
        ? `Ended — ${resolvedResult === 'win' ? 'WIN' : 'LOSS'} by Submission${meta.submissionName ? `: ${meta.submissionName}` : ''}${meta.submissionWinner === 'opp' ? ' (you tapped out)' : ' (you tapped them)'}`
        : `Ended — Time Expired · ${RESULT_CFG[resolvedResult]?.label || resolvedResult}${meta.matchTime ? ` (${meta.matchTime})` : ''}`,
      scoreKey: null, scored: false, pts: 0,
      endType: meta.endType,
      submissionName: meta.submissionName || '',
      submissionWinner: meta.submissionWinner || null,
      matchTime: meta.matchTime || '',
    };

    mutateRound(r => ({
      ...r,
      endedAt: now,
      result: resolvedResult,
      method: isSub ? 'submission' : 'points',
      endType: meta.endType,
      submissionName: meta.submissionName || '',
      submissionWinner: meta.submissionWinner || null,
      matchTime: meta.matchTime || '',
      eventLog: [...(r.eventLog || []), endEvent],
    }));

    // Auto-log today as a training day
    if (onLogDay) {
      const todayStr = new Date().toISOString().split('T')[0];
      onLogDay(todayStr);
    }
    // Reset endMeta for next round
    setEndMeta({ endType:null, result:'win', method:'points', submissionName:'', submissionWinner:'me', matchTime:'' });
    setShowEndRound(false); setActiveRound(null);
  };
  const deleteRound = async id => { const ok=await confirm('Delete this round?'); if(ok){ setCompetitions(cs=>cs.map(c=>c.id===activeCompId?{...c,rounds:c.rounds.filter(r=>r.id!==id)}:c)); if(activeRoundId===id) setActiveRound(null); }};

  // Live round tracking view
  if (activeRound && !activeRound.endedAt) {
    return (
      <View style={{ flex:1 }}>
        <View style={{ backgroundColor:C.surface, borderBottomWidth:1, borderBottomColor:C.border, flexDirection:'row', alignItems:'center', padding:14, gap:12 }}>
          <TouchableOpacity onPress={()=>setActiveRound(null)} activeOpacity={0.7} style={{ padding:4 }}>
            <Txt style={{ fontSize:16, color:C.muted }}>←</Txt>
          </TouchableOpacity>
          <View style={{ flex:1 }}>
            <Txt style={{ fontSize:13, fontFamily:F.semi }}>
              Round vs {activeRound.opponent||'Unknown'}
              <Txt style={{ fontSize:9, color:C.teal }}> {activeRound.oppAbbr}</Txt>
            </Txt>
            {activeRound.oppBelt && (
              <View style={{ marginTop:3 }}>
                <BeltBadge belt={activeRound.oppBelt} stripes={activeRound.oppStripes||0} size="sm"/>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={()=>{ setEndMeta({ endType:null, result:'win', method:'points', submissionName:'', submissionWinner:'me', matchTime:'' }); setShowEndRound(true); }} activeOpacity={0.75} style={{ backgroundColor:C.sage, paddingHorizontal:14, paddingVertical:8 }}>
            <Txt style={{ fontSize:9, fontFamily:F.semi, color:C.offWhite, letterSpacing:2, textTransform:'uppercase' }}>End Round</Txt>
          </TouchableOpacity>
        </View>
        <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:16 }} keyboardShouldPersistTaps="handled">
          <RollTrackingPanel roll={activeRound} onMutate={mutateRound} {...trackingProps}/>
        </ScrollView>
        <Modal visible={showEndRound} transparent animationType="fade" onRequestClose={()=>setShowEndRound(false)}>
          <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios'?'padding':'height'}>
            <ScrollView contentContainerStyle={{ flexGrow:1, backgroundColor:'rgba(10,10,8,0.9)', alignItems:'center', justifyContent:'center', padding:24 }}>
              <View style={{ backgroundColor:C.surface, borderWidth:1, borderColor:C.borderMid, width:'100%', maxWidth:400, padding:24 }}>
                <Cap style={{ marginBottom:4 }}>Grounded Skills Lab</Cap>
                <Txt style={{ fontSize:16, fontFamily:F.bold, marginBottom:20 }}>How did the round end?</Txt>

                {/* End type buttons */}
                <View style={{ flexDirection:'row', gap:8, marginBottom:20 }}>
                  {[
                    { type:'time',       icon:'⏱', label:'Time Expired', desc:'Match went the full duration' },
                    { type:'submission', icon:'🔒', label:'Submission',   desc:'Someone tapped out' },
                  ].map(({ type, icon, label, desc }) => (
                    <TouchableOpacity key={type} onPress={()=>setEndMeta(m=>({ ...m, endType:type, submissionName:'', submissionWinner:'me', result:'win', method:type==='submission'?'submission':'points' }))} activeOpacity={0.75}
                      style={{ flex:1, borderWidth:2, borderColor:endMeta.endType===type?C.gold:C.border, backgroundColor:endMeta.endType===type?C.goldDim:'transparent', padding:14 }}>
                      <Txt style={{ fontSize:20, marginBottom:6 }}>{icon}</Txt>
                      <Txt style={{ fontSize:10, fontFamily:F.bold, letterSpacing:1.5, textTransform:'uppercase', color:endMeta.endType===type?C.gold:C.textDim, marginBottom:4 }}>{label}</Txt>
                      <Txt style={{ fontSize:9, color:C.muted, lineHeight:14 }}>{desc}</Txt>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Time expired — result buttons */}
                {endMeta.endType === 'time' && (
                  <>
                    <Cap style={{ marginBottom:8 }}>Result</Cap>
                    <View style={{ flexDirection:'row', gap:8, marginBottom:16 }}>
                      {Object.entries(RESULT_CFG).map(([k,v])=>(
                        <TouchableOpacity key={k} onPress={()=>setEndMeta(m=>({...m,result:k}))} activeOpacity={0.75}
                          style={{ flex:1, paddingVertical:12, borderWidth:2, borderColor:endMeta.result===k?v.color:C.border, backgroundColor:endMeta.result===k?`${v.color}18`:'transparent', alignItems:'center' }}>
                          <Txt style={{ fontSize:12, fontFamily:F.semi, color:endMeta.result===k?v.color:C.muted }}>{v.icon} {v.label}</Txt>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={{ marginBottom:16 }}>
                      <Cap style={{ marginBottom:6 }}>Match Duration (optional)</Cap>
                      <TextInput
                        value={endMeta.matchTime||''} onChangeText={t=>setEndMeta(m=>({...m,matchTime:t}))}
                        placeholder="e.g. 6:00" placeholderTextColor={C.muted}
                        style={{ backgroundColor:'transparent', borderBottomWidth:1, borderBottomColor:C.borderMid, color:C.text, fontSize:14, paddingVertical:10, fontFamily:F.body }}/>
                    </View>
                  </>
                )}

                {/* Submission — who got it + technique */}
                {endMeta.endType === 'submission' && (
                  <>
                    {/* Submission overrides result */}
                    <View style={{ borderWidth:1, borderColor:`${C.gold}44`, backgroundColor:C.goldDim, padding:10, marginBottom:14 }}>
                      <Txt style={{ fontSize:9, color:C.gold, fontFamily:F.semi, letterSpacing:1.5, textTransform:'uppercase', marginBottom:2 }}>⚡ Submission overrides points</Txt>
                      <Txt style={{ fontSize:11, color:C.textDim }}>Whoever gets the submission wins — regardless of score.</Txt>
                    </View>
                    <Cap style={{ marginBottom:8 }}>Who got the submission?</Cap>
                    <View style={{ flexDirection:'row', gap:8, marginBottom:16 }}>
                      {[['me','I submitted them','WIN'],['opp','I was submitted','LOSS']].map(([val,lbl,outcome])=>(
                        <TouchableOpacity key={val} onPress={()=>setEndMeta(m=>({...m,submissionWinner:val,result:val==='me'?'win':'loss'}))} activeOpacity={0.75}
                          style={{ flex:1, paddingVertical:12, borderWidth:2, borderColor:endMeta.submissionWinner===val?(val==='me'?C.sage:C.red):C.border, alignItems:'center', backgroundColor:endMeta.submissionWinner===val?(val==='me'?`${C.sage}18`:`${C.red}18`):'transparent' }}>
                          <Txt style={{ fontSize:11, fontFamily:F.display, color:endMeta.submissionWinner===val?(val==='me'?C.sage:C.red):C.muted, marginBottom:3 }}>{outcome}</Txt>
                          <Txt style={{ fontSize:9, fontFamily:F.semi, letterSpacing:1, textTransform:'uppercase', color:endMeta.submissionWinner===val?(val==='me'?C.sage:C.red):C.muted }}>{lbl}</Txt>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Cap style={{ marginBottom:8 }}>Submission Technique</Cap>
                    <ScrollView style={{ maxHeight:160, borderWidth:1, borderColor:C.border, marginBottom:8 }} nestedScrollEnabled keyboardShouldPersistTaps="always">
                      {DEF_SUBS.map(sub=>(
                        <TouchableOpacity key={sub} onPress={()=>setEndMeta(m=>({...m,submissionName:sub}))} activeOpacity={0.75}
                          style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:12, borderBottomWidth:1, borderBottomColor:C.border, backgroundColor:endMeta.submissionName===sub?C.faint:'transparent' }}>
                          <Txt style={{ fontSize:13, color:C.textDim }}>{sub}</Txt>
                          {endMeta.submissionName===sub && <Txt style={{ color:C.gold }}>✓</Txt>}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    {/* Custom submission technique */}
                    <View style={{ flexDirection:'row', alignItems:'center', borderWidth:1,
                      borderColor:endMeta.submissionName&&!DEF_SUBS.includes(endMeta.submissionName)?C.gold:C.borderMid,
                      marginBottom:12 }}>
                      <TextInput
                        value={DEF_SUBS.includes(endMeta.submissionName)?'':endMeta.submissionName||''}
                        onChangeText={t=>setEndMeta(m=>({...m,submissionName:t}))}
                        placeholder="Or type custom technique…"
                        placeholderTextColor={C.muted}
                        returnKeyType="done"
                        style={{ flex:1, color:C.text, fontSize:13, fontFamily:F.body,
                          padding:12, backgroundColor:'transparent' }}/>
                      {endMeta.submissionName && !DEF_SUBS.includes(endMeta.submissionName) && (
                        <View style={{ paddingHorizontal:10 }}>
                          <Txt style={{ color:C.gold, fontSize:16 }}>✓</Txt>
                        </View>
                      )}
                    </View>
                    <View style={{ marginBottom:16 }}>
                      <Cap style={{ marginBottom:6 }}>Match Duration (optional)</Cap>
                      <TextInput
                        value={endMeta.matchTime||''} onChangeText={t=>setEndMeta(m=>({...m,matchTime:t}))}
                        placeholder="e.g. 4:47" placeholderTextColor={C.muted}
                        style={{ backgroundColor:'transparent', borderBottomWidth:1, borderBottomColor:C.borderMid, color:C.text, fontSize:14, paddingVertical:10, fontFamily:F.body }}/>
                    </View>
                  </>
                )}

                <View style={{ flexDirection:'row', gap:8, marginTop:8 }}>
                  <Btn label="Save Round"
                    onPress={()=>{ if(!endMeta.endType) return; endRound(endMeta); }}
                    disabled={!endMeta.endType}
                    color={endMeta.result==='win'?C.sage:endMeta.result==='loss'?C.red:C.amber}
                    textColor={C.offWhite} style={{ flex:1 }}/>
                  <Btn label="Cancel" onPress={()=>setShowEndRound(false)} outline style={{ paddingHorizontal:20 }}/>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    );
  }

  // Competition detail view
  if (activeComp) {
    const wins=activeComp.rounds.filter(r=>r.result==='win').length;
    const losses=activeComp.rounds.filter(r=>r.result==='loss').length;
    const draws=activeComp.rounds.filter(r=>r.result==='draw').length;
    return (
      <View style={{ flex:1 }}>
        <View style={{ backgroundColor:C.surface, borderBottomWidth:1, borderBottomColor:C.border, flexDirection:'row', alignItems:'center', padding:14, gap:12 }}>
          <TouchableOpacity onPress={()=>setActiveComp(null)} activeOpacity={0.7} style={{ padding:4 }}>
            <Txt style={{ fontSize:16, color:C.muted }}>←</Txt>
          </TouchableOpacity>
          <Txt style={{ flex:1, fontSize:14, fontFamily:F.bold }} numberOfLines={1}>{activeComp.name}</Txt>
          <TouchableOpacity onPress={()=>setEditingComp(activeComp)} activeOpacity={0.75} style={{ borderWidth:1, borderColor:C.border, paddingHorizontal:10, paddingVertical:6 }}>
            <Txt style={{ fontSize:8, color:C.muted, fontFamily:F.semi, letterSpacing:1.5, textTransform:'uppercase' }}>Edit</Txt>
          </TouchableOpacity>
          <TouchableOpacity onPress={()=>deleteComp(activeComp.id)} activeOpacity={0.75} style={{ borderWidth:1, borderColor:C.border, paddingHorizontal:10, paddingVertical:6 }}>
            <Txt style={{ fontSize:14, color:C.muted }}>✕</Txt>
          </TouchableOpacity>
        </View>
        <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:16 }}>
          {/* Header stats */}
          <View style={{ backgroundColor:C.faint, borderWidth:1, borderColor:`${C.gold}33`, padding:16, marginBottom:20 }}>
            <Cap style={{ color:C.gold, marginBottom:4 }}>Competition Record</Cap>
            <Txt style={{ fontSize:18, fontFamily:F.display, marginBottom:4 }}>{activeComp.name}</Txt>
            {activeComp.location && <Txt style={{ fontSize:11, color:C.muted }}>{activeComp.location}</Txt>}
            <Cap style={{ marginTop:2 }}>{activeComp.gi} · {activeComp.weightClass}</Cap>
            <View style={{ flexDirection:'row', gap:20, marginTop:12 }}>
              {[['W',wins,C.sage],['L',losses,C.red],['D',draws,C.amber]].map(([l,v,c])=>(
                <View key={l} style={{ alignItems:'center' }}>
                  <Txt style={{ fontSize:26, fontFamily:F.display, color:v>0?c:C.border }}>{v}</Txt>
                  <Cap style={{ fontSize:7 }}>{l}</Cap>
                </View>
              ))}
            </View>
          </View>

          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <Cap>{activeComp.rounds.length} Round{activeComp.rounds.length!==1?'s':''}</Cap>
            <TouchableOpacity onPress={()=>setShowStartRound(true)} activeOpacity={0.75} style={{ backgroundColor:C.gold, paddingHorizontal:16, paddingVertical:8 }}>
              <Txt style={{ fontSize:9, fontFamily:F.bold, color:'#0F0F0D', letterSpacing:2, textTransform:'uppercase' }}>+ Start Round</Txt>
            </TouchableOpacity>
          </View>

          {activeComp.rounds.length===0 && <Cap style={{ textAlign:'center', marginVertical:30 }}>No rounds yet. Tap Start Round.</Cap>}
          {activeComp.rounds.map((round,i) => {
            const rc=RESULT_CFG[round.result];
            const rMyPts=(round.eventLog||[]).filter(e=>e.side==='me'&&e.scored).reduce((a,e)=>a+(e.pts||0),0);
            const rOpPts=(round.eventLog||[]).filter(e=>e.side==='opp'&&e.scored).reduce((a,e)=>a+(e.pts||0),0);
            const isLive=!round.endedAt;
            return (
              <TouchableOpacity key={round.id} onPress={()=>setActiveRound(round.id)} activeOpacity={0.75}
                style={{ flexDirection:'row', borderWidth:1, borderColor:isLive?C.gold:C.border, marginBottom:8 }}>
                <View style={{ width:3, backgroundColor:rc?rc.color:C.border }}/>
                <View style={{ flex:1, padding:14 }}>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:4 }}>
                    {isLive && <View style={{ borderWidth:1, borderColor:`${C.gold}44`, paddingHorizontal:5, paddingVertical:1 }}><Txt style={{ fontSize:8, color:C.gold, fontFamily:F.semi, letterSpacing:2 }}>LIVE</Txt></View>}
                    {rc&&!isLive && <View style={{ borderWidth:1, borderColor:`${rc.color}44`, paddingHorizontal:5, paddingVertical:1 }}><Txt style={{ fontSize:8, color:rc.color, fontFamily:F.semi, letterSpacing:2 }}>{rc.icon} {rc.label.toUpperCase()}</Txt></View>}
                    <Txt style={{ fontSize:13, fontFamily:F.semi }}>Round {i+1}</Txt>
                    <Txt style={{ fontSize:12, color:C.textDim }}>{round.opponent||'Unknown'}</Txt>
                    {round.oppAbbr && <View style={{ borderWidth:1, borderColor:`${C.teal}44`, paddingHorizontal:5, paddingVertical:1 }}><Txt style={{ fontSize:8, color:C.teal, fontFamily:F.semi, letterSpacing:1.5 }}>{round.oppAbbr}</Txt></View>}
                  </View>
                  {round.oppBelt && (
                    <View style={{ marginBottom:4 }}>
                      <BeltBadge belt={round.oppBelt} stripes={round.oppStripes||0} size="sm"/>
                    </View>
                  )}
                  <Txt style={{ fontSize:10, color:C.muted }}>{fmtDateTime(round.startedAt)}{round.matchTime?` · ⏱ ${round.matchTime}`:''}</Txt>
                  {round.notes && <Txt style={{ fontSize:11, color:C.muted, marginTop:6, fontStyle:'italic' }}>{round.notes}</Txt>}
                </View>
                <View style={{ alignItems:'center', justifyContent:'center', padding:12, gap:4 }}>
                  <Txt style={{ fontSize:18, fontFamily:F.display, color:C.gold }}>{rMyPts}</Txt>
                  <Txt style={{ fontSize:9, color:C.border }}>·</Txt>
                  <Txt style={{ fontSize:18, fontFamily:F.display, color:C.stone }}>{rOpPts}</Txt>
                </View>
                {/* Edit button */}
                {!isLive && (
                  <TouchableOpacity onPress={()=>setEditingRound(round)} activeOpacity={0.75}
                    style={{ borderLeftWidth:1, borderLeftColor:C.border, paddingHorizontal:12, alignItems:'center', justifyContent:'center' }}>
                    <Txt style={{ color:C.gold, fontSize:14 }}>✎</Txt>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={()=>deleteRound(round.id)} activeOpacity={0.75}
                  style={{ borderLeftWidth:1, borderLeftColor:C.border, paddingHorizontal:12, alignItems:'center', justifyContent:'center' }}>
                  <Txt style={{ color:C.muted, fontSize:16 }}>✕</Txt>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Edit Round Modal */}
        {editingRound && (
          <Modal visible={!!editingRound} transparent animationType="fade" onRequestClose={()=>setEditingRound(null)}>
            <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios'?'padding':'height'}>
              <ScrollView contentContainerStyle={{ flexGrow:1, backgroundColor:'rgba(10,10,8,0.9)', alignItems:'center', justifyContent:'center', padding:24 }}>
                <View style={{ backgroundColor:C.surface, borderWidth:1, borderColor:C.borderMid, width:'100%', maxWidth:400, padding:24 }}>
                  <Txt style={{ fontSize:16, fontFamily:F.bold, marginBottom:4 }}>Edit Round</Txt>
                  <Cap style={{ marginBottom:20, color:C.muted }}>vs {editingRound.opponent||'Unknown'}</Cap>

                  {/* Result */}
                  <Cap style={{ marginBottom:8 }}>Result</Cap>
                  <View style={{ flexDirection:'row', gap:8, marginBottom:16 }}>
                    {Object.entries(RESULT_CFG).map(([k,v])=>(
                      <TouchableOpacity key={k} onPress={()=>setEditingRound(r=>({...r,result:k}))} activeOpacity={0.75}
                        style={{ flex:1, paddingVertical:12, borderWidth:2,
                          borderColor:editingRound.result===k?v.color:C.border,
                          backgroundColor:editingRound.result===k?`${v.color}18`:'transparent', alignItems:'center' }}>
                        <Txt style={{ fontSize:12, fontFamily:F.semi, color:editingRound.result===k?v.color:C.muted }}>{v.icon} {v.label}</Txt>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* End type */}
                  <Cap style={{ marginBottom:8 }}>How did it end?</Cap>
                  <View style={{ flexDirection:'row', gap:8, marginBottom:16 }}>
                    {[['time','⏱ Time'],['submission','🔒 Submission']].map(([k,l])=>(
                      <TouchableOpacity key={k} onPress={()=>setEditingRound(r=>({...r,endType:k}))} activeOpacity={0.75}
                        style={{ flex:1, paddingVertical:10, borderWidth:2,
                          borderColor:editingRound.endType===k?C.gold:C.border,
                          backgroundColor:editingRound.endType===k?C.goldDim:'transparent', alignItems:'center' }}>
                        <Txt style={{ fontSize:11, fontFamily:F.semi, color:editingRound.endType===k?C.gold:C.muted }}>{l}</Txt>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Submission details */}
                  {editingRound.endType === 'submission' && (
                    <>
                      <Cap style={{ marginBottom:8 }}>Who got the submission?</Cap>
                      <View style={{ flexDirection:'row', gap:8, marginBottom:16 }}>
                        {[['me','I submitted them'],['opp','I was submitted']].map(([val,lbl])=>(
                          <TouchableOpacity key={val} onPress={()=>setEditingRound(r=>({...r,submissionWinner:val,result:val==='me'?'win':'loss'}))} activeOpacity={0.75}
                            style={{ flex:1, paddingVertical:10, borderWidth:2,
                              borderColor:editingRound.submissionWinner===val?(val==='me'?C.sage:C.red):C.border,
                              backgroundColor:editingRound.submissionWinner===val?(val==='me'?`${C.sage}18`:`${C.red}18`):'transparent', alignItems:'center' }}>
                            <Txt style={{ fontSize:10, fontFamily:F.semi,
                              color:editingRound.submissionWinner===val?(val==='me'?C.sage:C.red):C.muted }}>{lbl}</Txt>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <Cap style={{ marginBottom:8 }}>Submission Technique</Cap>
                      <ScrollView style={{ maxHeight:140, borderWidth:1, borderColor:C.border, marginBottom:8 }} nestedScrollEnabled keyboardShouldPersistTaps="always">
                        {DEF_SUBS.map(sub=>(
                          <TouchableOpacity key={sub} onPress={()=>setEditingRound(r=>({...r,submissionName:sub}))} activeOpacity={0.75}
                            style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center',
                              padding:12, borderBottomWidth:1, borderBottomColor:C.border,
                              backgroundColor:editingRound.submissionName===sub?C.faint:'transparent' }}>
                            <Txt style={{ fontSize:13, color:C.textDim }}>{sub}</Txt>
                            {editingRound.submissionName===sub && <Txt style={{ color:C.gold }}>✓</Txt>}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      <View style={{ borderWidth:1, borderColor:C.borderMid, marginBottom:16 }}>
                        <TextInput
                          value={DEF_SUBS.includes(editingRound.submissionName)?'':editingRound.submissionName||''}
                          onChangeText={t=>setEditingRound(r=>({...r,submissionName:t}))}
                          placeholder="Or type custom technique…"
                          placeholderTextColor={C.muted}
                          returnKeyType="done"
                          style={{ color:C.text, fontSize:13, fontFamily:F.body, padding:12 }}/>
                      </View>
                    </>
                  )}

                  {/* Opponent */}
                  <Cap style={{ marginBottom:6 }}>Opponent Name</Cap>
                  <TextInput
                    value={editingRound.opponent||''}
                    onChangeText={t=>setEditingRound(r=>({...r,opponent:t}))}
                    placeholder="Opponent name…" placeholderTextColor={C.muted}
                    style={{ borderWidth:1, borderColor:C.borderMid, color:C.text, fontSize:13,
                      fontFamily:F.body, padding:12, marginBottom:16 }}/>

                  {/* Match time */}
                  <Cap style={{ marginBottom:6 }}>Match Duration</Cap>
                  <TextInput
                    value={editingRound.matchTime||''}
                    onChangeText={t=>setEditingRound(r=>({...r,matchTime:t}))}
                    placeholder="e.g. 5:00" placeholderTextColor={C.muted}
                    style={{ borderWidth:1, borderColor:C.borderMid, color:C.text, fontSize:13,
                      fontFamily:F.body, padding:12, marginBottom:24 }}/>

                  {/* Notes */}
                  <Cap style={{ marginBottom:6 }}>Notes</Cap>
                  <TextInput
                    value={editingRound.notes||''}
                    onChangeText={t=>setEditingRound(r=>({...r,notes:t}))}
                    placeholder="Optional notes…" placeholderTextColor={C.muted}
                    multiline numberOfLines={3}
                    style={{ borderWidth:1, borderColor:C.borderMid, color:C.text, fontSize:13,
                      fontFamily:F.body, padding:12, marginBottom:24, minHeight:72 }}/>

                  <View style={{ flexDirection:'row', gap:8 }}>
                    <TouchableOpacity onPress={()=>{
                      // Save the edited round back into competitions state
                      setCompetitions(cs => cs.map(c => ({
                        ...c,
                        rounds: c.rounds.map(r => r.id === editingRound.id ? editingRound : r)
                      })));
                      setEditingRound(null);
                    }} activeOpacity={0.8}
                      style={{ flex:1, backgroundColor:C.gold, padding:16, alignItems:'center' }}>
                      <Txt style={{ fontSize:10, fontFamily:F.display, letterSpacing:2, textTransform:'uppercase', color:'#0F0F0D' }}>Save Changes</Txt>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={()=>setEditingRound(null)} activeOpacity={0.75}
                      style={{ borderWidth:1, borderColor:C.border, paddingHorizontal:20, alignItems:'center', justifyContent:'center' }}>
                      <Cap>Cancel</Cap>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </Modal>
        )}

        {/* Start round modal */}
        <StartRoundModal visible={showStartRound} roundNum={(activeComp.rounds.length)+1} onStart={startRound} onCancel={()=>setShowStartRound(false)}/>
        <CompModal visible={!!editingComp} initial={editingComp} onSave={c=>{ updateComp(c); setEditingComp(null); }} onCancel={()=>setEditingComp(null)}/>
      </View>
    );
  }

  // Competitions list
  return (
    <View style={{ flex:1 }}>
      <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:16 }}>
        <CompetitionsList comps={competitions} onSelect={setActiveComp} onNew={()=>setShowNewComp(true)}/>
      </ScrollView>
      <CompModal visible={showNewComp} onSave={comp=>{ setCompetitions(cs=>[comp,...cs]); setActiveComp(comp.id); setShowNewComp(false); }} onCancel={()=>setShowNewComp(false)}/>
    </View>
  );
}

function StartRoundModal({ visible, roundNum, onStart, onCancel }) {
  const [oppName,    setOppName]    = useState('');
  const [oppBelt,    setOppBelt]    = useState('white');
  const [oppStripes, setOppStripes] = useState(0);
  const abbr = abbrevName(oppName);

  const reset = () => { setOppName(''); setOppBelt('white'); setOppStripes(0); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={()=>{ onCancel(); reset(); }}>
      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios'?'padding':'height'}>
        <ScrollView contentContainerStyle={{ flexGrow:1, backgroundColor:'rgba(10,10,8,0.9)', alignItems:'center', justifyContent:'center', padding:24 }}>
          <View style={{ backgroundColor:C.surface, borderWidth:1, borderColor:C.borderMid, width:'100%', maxWidth:400, padding:24 }}>
            <Txt style={{ fontSize:16, fontFamily:F.bold, marginBottom:4 }}>Round {roundNum}</Txt>
            <Cap style={{ marginBottom:20 }}>Enter opponent details to begin tracking</Cap>

            {/* Opponent name */}
            <FieldInput label="Opponent Full Name" value={oppName} onChangeText={setOppName} placeholder="First Last"/>
            {oppName.trim() && (
              <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginTop:-8, marginBottom:16 }}>
                <Txt style={{ fontSize:10, color:C.teal }}>Abbreviated: <Txt style={{ fontFamily:F.semi }}>{abbr}</Txt></Txt>
                <BeltBadge belt={oppBelt} stripes={oppStripes} size="sm"/>
              </View>
            )}

            {/* Belt selector */}
            <View style={{ marginBottom:14 }}>
              <Cap style={{ marginBottom:8 }}>Opponent Belt</Cap>
              <Cap style={{ marginBottom:6, color:C.muted, fontSize:8 }}>Juvenile</Cap>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:8 }}>
                <View style={{ flexDirection:'row', gap:6 }}>
                  {JUVENILE_BELTS.map(b => { const bc=BELT_COLORS[b]; return (
                    <TouchableOpacity key={b} onPress={()=>setOppBelt(b)} activeOpacity={0.75}
                      style={{ paddingVertical:7, paddingHorizontal:10, borderWidth:2,
                        borderColor:oppBelt===b?C.gold:C.border, backgroundColor:oppBelt===b?bc.bg:C.faint }}>
                      <Txt style={{ fontSize:8, fontFamily:F.bold, letterSpacing:1,
                        textTransform:'uppercase', color:oppBelt===b?bc.text:C.muted }}>{bc.label}</Txt>
                    </TouchableOpacity>
                  ); })}
                </View>
              </ScrollView>
              <Cap style={{ marginBottom:6, color:C.muted, fontSize:8 }}>Adult</Cap>
              <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6 }}>
                {ADULT_BELTS.map(b => {
                  const bc = BELT_COLORS[b];
                  return (
                    <TouchableOpacity key={b} onPress={()=>setOppBelt(b)} activeOpacity={0.75}
                      style={{ paddingVertical:8, paddingHorizontal:12, borderWidth:2, borderColor:oppBelt===b?C.gold:C.border, backgroundColor:oppBelt===b?bc.bg:C.faint }}>
                      <Txt style={{ fontSize:8, fontFamily:F.bold, letterSpacing:1.5, textTransform:'uppercase', color:oppBelt===b?bc.text:C.muted }}>{bc.label}</Txt>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Stripes selector */}
            <View style={{ marginBottom:20 }}>
              <Cap style={{ marginBottom:8 }}>Stripes ({oppStripes})</Cap>
              <View style={{ flexDirection:'row', gap:6 }}>
                {[0,1,2,3,4].map(n => (
                  <TouchableOpacity key={n} onPress={()=>setOppStripes(n)} activeOpacity={0.75}
                    style={{ flex:1, minHeight:40, borderWidth:1, borderColor:oppStripes===n?C.gold:C.border, backgroundColor:oppStripes===n?C.goldDim:'transparent', alignItems:'center', justifyContent:'center' }}>
                    <Txt style={{ fontSize:13, fontFamily:F.semi, color:oppStripes===n?C.gold:C.muted }}>{n}</Txt>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ flexDirection:'row', gap:8 }}>
              <Btn label="Start Round" onPress={()=>{ onStart(oppName.trim(), abbr, oppBelt, oppStripes); reset(); }} style={{ flex:1 }}/>
              <Btn label="Cancel" onPress={()=>{ onCancel(); reset(); }} outline style={{ paddingHorizontal:20 }}/>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────────
// ─── Coach Dashboard ───────────────────────────────────────────────────────────
// Simple fuzzy match — returns true if all chars of query appear in order in str
const fuzzyMatch = (str='', query='') => {
  if (!query.trim()) return true;
  const s = str.toLowerCase(); const q = query.toLowerCase().trim();
  let si = 0;
  for (let qi = 0; qi < q.length; qi++) {
    si = s.indexOf(q[qi], si);
    if (si === -1) return false;
    si++;
  }
  return true;
};

function CoachDashboard({ session, onSwitchToAthlete, userRole, onLogForAthlete }) {
  const isAdmin = userRole === 'admin';
  const [athletes,   setAthletes]  = useState([]);
  const [academies,  setAcademies] = useState([]);
  const [selected,      setSelected]      = useState(null);
  const [sidebarOpen,   setSidebarOpen]   = useState(true);
  const [rollsMap,   setRollsMap]  = useState({});
  const [compsMap,   setCompsMap]  = useState({});
  const [daysMap,    setDaysMap]   = useState({});
  const [loading,    setLoading]   = useState(true);
  const [isDark,     setIsDark]    = useState(true);
  const [activeView, setActiveView] = useState('athletes'); // 'athletes' | 'manage'

  // Manage panel state
  const [allUsers,    setAllUsers]    = useState([]); // for admin only
  const [newCoachEmail, setNewCoachEmail] = useState('');
  const [newCoachAcademy, setNewCoachAcademy] = useState('');
  const [manageMsg,   setManageMsg]   = useState('');
  const [manageLoading, setManageLoading] = useState(false);

  useEffect(() => { Object.assign(C, isDark ? DARK : LIGHT); }, [isDark]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [{ data: aths }, { data: acads }] = await Promise.all([
          supabase.from('athletes').select('*').order('name'),
          supabase.from('academies').select('*').order('name'),
        ]);
        setAthletes(aths || []);
        setAcademies(acads || []);

        const ids = (aths || []).map(a => a.id);
        if (ids.length) {
          const [{ data: rolls }, { data: comps }, { data: days }] = await Promise.all([
            supabase.from('rolls').select('*').in('athlete_id', ids).order('started_at', { ascending:false }),
            supabase.from('competitions').select('*, competition_rounds(*)').in('athlete_id', ids),
            supabase.from('training_days').select('*').in('athlete_id', ids),
          ]);
          const rm = {}, cm = {}, dm = {};
          ids.forEach(id => { rm[id]=[]; cm[id]=[]; dm[id]=[]; });
          (rolls||[]).forEach(r => rm[r.athlete_id]?.push(fromDbRoll(r)));
          (comps||[]).forEach(c => cm[c.athlete_id]?.push(fromDbComp(c)));
          (days||[]).forEach(d => dm[d.athlete_id]?.push(d.date));
          setRollsMap(rm); setCompsMap(cm); setDaysMap(dm);
        }

        // Admin: load all user roles for management
        if (isAdmin) {
          const { data: users } = await supabase
            .from('user_roles')
            .select('user_id, role, academy_id');
          setAllUsers(users || []);
        }
        // Load class logs for this coach/admin
        const myRole = (await supabase.from('user_roles').select('academy_id').eq('user_id', session?.user?.id).maybeSingle()).data;
        if (myRole?.academy_id) {
          const logs = await db.getClassLogs(myRole.academy_id);
          setCoachClassLogs(logs);
        }
      } catch(e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  // Group athletes by academy
  const academyGroups = academies.map(ac => ({
    ...ac,
    athletes: athletes.filter(a => a.academy_id === ac.id),
  }));
  const unassigned = athletes.filter(a => !a.academy_id);

  const sel = athletes.find(a => a.id === selected);
  const selRolls = selected ? (rollsMap[selected]||[]) : [];
  const selComps = selected ? (compsMap[selected]||[]) : [];
  const selDays  = selected ? (daysMap[selected]||[])  : [];

  const wins = selRolls.filter(r => {
    if (r.rollResult) return r.rollResult==='win';
    const my=(r.eventLog||[]).filter(e=>e.side==='me'&&e.scored).reduce((a,e)=>a+(e.pts||0),0);
    const op=(r.eventLog||[]).filter(e=>e.side==='opp'&&e.scored).reduce((a,e)=>a+(e.pts||0),0);
    return my>op;
  }).length;
  const subWins   = selRolls.filter(r=>r.endType==='submission'&&r.submissionWinner==='me').length;
  const compWins  = selComps.reduce((a,c)=>a+c.rounds.filter(r=>r.result==='win').length,0);
  const compTotal = selComps.reduce((a,c)=>a+c.rounds.filter(r=>r.endedAt).length,0);

  const streak = (() => {
    if (!selDays.length) return 0;
    const set = new Set(selDays); let s=0, d=new Date();
    while(s<365){ const ds=d.toISOString().split('T')[0]; if(!set.has(ds)){ if(s===0){d.setDate(d.getDate()-1);continue;} break; } s++; d.setDate(d.getDate()-1); }
    return s;
  })();

  const [showClassLog,    setShowClassLog]    = useState(false);
  const [editingClassLog, setEditingClassLog] = useState(null);
  const [coachClassLogs,  setCoachClassLogs]  = useState([]);
  const [classLogTechs,   setClassLogTechs]   = useState([{ name:'', notes:'', url:'' }]);
  const [classLogDate,    setClassLogDate]     = useState(new Date().toISOString().split('T')[0]);
  const [classLogType,    setClassLogType]     = useState('class');
  const [classLogNotes,   setClassLogNotes]    = useState('');
  const [classLogSaving,  setClassLogSaving]   = useState(false);
  const [ytSearchIndex,   setYtSearchIndex]    = useState(null);
  const [newAthleteFirst,   setNewAthleteFirst]   = useState('');
  const [newAthleteLast,    setNewAthleteLast]     = useState('');
  const [newAthleteEmail,   setNewAthleteEmail]    = useState('');
  const [newAthleteAcademy, setNewAthleteAcademy] = useState('');
  const [inviteEmail,       setInviteEmail]        = useState('');
  const [coachSearch,       setCoachSearch]        = useState('');
  const [academySearch,     setAcademySearch]      = useState('');
  const [athleteSearch,     setAthleteSearch]      = useState('');
  const [editingAthlete,    setEditingAthlete]     = useState(null);
  const [openSections,      setOpenSections]       = useState({ invite:true, logs:false, coaches:false, athletes:false, academy:false });
  const toggleSection = key => setOpenSections(s=>({...s,[key]:!s[key]}));

  // Option 2: Create account on behalf of athlete
  const createAthleteAccount = async () => {
    if (!newAthleteEmail.trim() || !newAthleteFirst.trim()) return;
    setManageLoading(true); setManageMsg('');
    try {
      const fullName = `${newAthleteFirst.trim()} ${newAthleteLast.trim()}`.trim();
      // Create user via Supabase admin API (uses service role — won't work from client)
      // Instead: sign up with a temp password and immediately send password reset
      const tempPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2).toUpperCase() + '1!';
      const { data, error } = await supabase.auth.signUp({
        email: newAthleteEmail.trim(),
        password: tempPassword,
        options: { data: { full_name: fullName } },
      });
      if (error) throw error;

      if (data?.user) {
        // Update their athlete name
        await supabase.from('athletes')
          .update({ name: fullName, academy_id: newAthleteAcademy || null })
          .eq('user_id', data.user.id);

        // Send password reset so they can set their own password
        await supabase.auth.resetPasswordForEmail(newAthleteEmail.trim(), {
          redirectTo: 'https://bjjanalytics.netlify.app',
        });

        setManageMsg(`✓ Account created for ${fullName}. A password setup email has been sent to ${newAthleteEmail.trim()}.`);
        setNewAthleteFirst(''); setNewAthleteLast(''); setNewAthleteEmail(''); setNewAthleteAcademy('');

        // Refresh athlete list
        const { data: aths } = await supabase.from('athletes').select('*').order('name');
        setAthletes(aths || []);
      }
    } catch(e) {
      const msg = e?.message || '';
      if (msg.includes('already registered') || msg.includes('already exists')) {
        setManageMsg(`❌ An account with ${newAthleteEmail} already exists.`);
      } else {
        setManageMsg('❌ Error: ' + (msg || 'Something went wrong'));
      }
    }
    setManageLoading(false);
  };

  // Option 3: Send invite email
  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setManageLoading(true); setManageMsg('');
    try {
      // Use password reset as invite mechanism — sends a magic link
      const { error } = await supabase.auth.resetPasswordForEmail(inviteEmail.trim(), {
        redirectTo: 'https://bjjanalytics.netlify.app',
      });
      if (error) throw error;
      setManageMsg(`✓ Invite sent to ${inviteEmail.trim()}. They'll receive an email with a link to set up their account.`);
      setInviteEmail('');
    } catch(e) {
      setManageMsg('❌ Error: ' + (e?.message || 'Something went wrong'));
    }
    setManageLoading(false);
  };

  const saveClassLog = async () => {
    const validTechs = classLogTechs.filter(t => t.name.trim());
    if (!validTechs.length) return;
    const myAcademyId = allUsers.find(u => u.user_id === session.user.id)?.academy_id;
    if (!myAcademyId && !editingClassLog) { setManageMsg('❌ No academy assigned to your account.'); return; }
    setClassLogSaving(true);
    try {
      if (editingClassLog) {
        // Update existing
        await db.updateClassLog(editingClassLog.id, {
          date: classLogDate, sessionType: classLogType,
          techniques: validTechs, notes: classLogNotes,
        });
        setCoachClassLogs(prev => prev.map(cl =>
          cl.id === editingClassLog.id
            ? { ...cl, date: classLogDate, session_type: classLogType, techniques: validTechs, notes: classLogNotes }
            : cl
        ));
        setManageMsg('✓ Class log updated.');
      } else {
        // Create new
        const newLog = await db.createClassLog({
          coachId: session.user.id, academyId: myAcademyId,
          date: classLogDate, sessionType: classLogType,
          techniques: validTechs, notes: classLogNotes,
        });
        setCoachClassLogs(prev => [newLog, ...prev]);
        setManageMsg('✓ Class log published to athletes.');
      }
      setShowClassLog(false);
      setEditingClassLog(null);
      setClassLogTechs([{ name:'', notes:'', url:'' }]);
      setClassLogNotes('');
      setClassLogDate(new Date().toISOString().split('T')[0]);
      setClassLogType('class');
    } catch(e) { setManageMsg('❌ ' + (e.message || 'Failed to save')); }
    setClassLogSaving(false);
  };

  const startEditClassLog = (cl) => {
    setEditingClassLog(cl);
    setClassLogDate(cl.date);
    setClassLogType(cl.session_type);
    setClassLogTechs(cl.techniques?.length ? cl.techniques.map(t=>({name:t.name||'',notes:t.notes||'',url:t.url||''})) : [{ name:'', notes:'', url:'' }]);
    setClassLogNotes(cl.notes || '');
    setShowClassLog(true);
  };

  const assignCoach = async (athleteUserId, athleteName) => {
    if (!athleteUserId) return;
    setManageLoading(true); setManageMsg('');
    try {
      const academyId = academies.find(a => a.name === newCoachAcademy || a.id === newCoachAcademy)?.id || null;

      // Try update first, then insert if no row exists
      const { data: existing } = await supabase
        .from('user_roles').select('id').eq('user_id', athleteUserId).maybeSingle();

      if (existing) {
        const { error } = await supabase.from('user_roles')
          .update({ role: 'coach', academy_id: academyId })
          .eq('user_id', athleteUserId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('user_roles')
          .insert({ user_id: athleteUserId, role: 'coach', academy_id: academyId });
        if (error) throw error;
      }

      if (academyId) {
        await supabase.from('athletes').update({ academy_id: academyId }).eq('user_id', athleteUserId);
        setAthletes(aths => aths.map(a => a.user_id === athleteUserId ? { ...a, academy_id: academyId } : a));
      }

      setManageMsg(`✓ ${athleteName} is now a coach${newCoachAcademy ? ` at ${newCoachAcademy}` : ''}.`);
      setNewCoachAcademy('');

      const { data: users } = await supabase.from('user_roles').select('user_id, role, academy_id');
      setAllUsers(users || []);
    } catch(e) {
      setManageMsg('❌ Error: ' + (e.message || 'Something went wrong'));
    }
    setManageLoading(false);
  };

  // Admin: create a new academy
  const createAcademy = async name => {
    if (!name.trim()) return;
    const { data } = await supabase.from('academies').insert({ name, created_by: session.user.id }).select().single();
    if (data) setAcademies(a => [...a, data]);
  };

  // Admin: assign athlete to academy
  const assignToAcademy = async (athleteId, academyId) => {
    await supabase.from('athletes').update({ academy_id: academyId||null }).eq('id', athleteId);
    setAthletes(aths => aths.map(a => a.id===athleteId ? {...a,academy_id:academyId||null} : a));
  };

  Object.assign(C, isDark ? DARK : LIGHT);

  const AthleteRow = ({ a, onSelect }) => {
    const userRole = allUsers.find(u => u.user_id === a.user_id)?.role;
    const isCoachUser = userRole === 'coach';
    const handlePress = () => {
      setSelected(a.id);
      if (onSelect) onSelect(a.id);
    };
    return (
      <TouchableOpacity key={a.id} onPress={handlePress} activeOpacity={0.75}
        style={{ padding:12, borderBottomWidth:1, borderBottomColor:C.faint,
          backgroundColor:selected===a.id?C.goldDim:'transparent' }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:4 }}>
          <ProfileAvatar name={a.name||'?'} size={22} belt={a.belt||'white'}/>
          <Txt style={{ fontSize:12, fontFamily:F.semi, color:selected===a.id?C.gold:C.text, flex:1 }} numberOfLines={1}>{a.name||'Unnamed'}</Txt>
          {isCoachUser && (
            <View style={{ borderWidth:1, borderColor:`${C.teal}55`, backgroundColor:`${C.teal}15`,
              paddingHorizontal:5, paddingVertical:2 }}>
              <Txt style={{ fontSize:7, fontFamily:F.semi, color:C.teal, letterSpacing:1 }}>COACH</Txt>
            </View>
          )}
        </View>
        <BeltBadge belt={a.belt||'white'} stripes={a.stripes||0} size="sm"/>
        <View style={{ flexDirection:'row', gap:8, marginTop:4 }}>
          <Cap style={{ fontSize:6 }}>{(rollsMap[a.id]||[]).length} rolls</Cap>
          <Cap style={{ fontSize:6 }}>{(daysMap[a.id]||[]).length}d</Cap>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex:1, backgroundColor:C.bg, paddingTop:TOP_INSET }}>
      <StatusBar barStyle={isDark?'light-content':'dark-content'} backgroundColor={C.surface}/>

      {/* Header */}
      <View style={{ backgroundColor:C.surface, borderBottomWidth:1, borderBottomColor:C.border, padding:12 }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
          <GSLLogo size={28}/>
          <View style={{ flex:1 }}>
            <Txt style={{ fontSize:11, fontFamily:F.display, letterSpacing:2, textTransform:'uppercase', color:C.text }}>
              {isAdmin ? 'Admin Dashboard' : 'Coach Dashboard'}
            </Txt>
            {isAdmin && <Cap style={{ color:C.gold, fontSize:7 }}>Grounded Skills Lab · All Academies</Cap>}
          </View>
          <TouchableOpacity onPress={()=>setShowClassLog(true)} activeOpacity={0.75}
            style={{ borderWidth:1, borderColor:`${C.teal}55`, backgroundColor:`${C.teal}15`,
              paddingHorizontal:8, paddingVertical:5 }}>
            <Txt style={{ fontSize:8, fontFamily:F.semi, color:C.teal, letterSpacing:1, textTransform:'uppercase' }}>📋 Class</Txt>
          </TouchableOpacity>
          <TouchableOpacity onPress={()=>setIsDark(p=>!p)} activeOpacity={0.75}
            style={{ borderWidth:1, borderColor:C.border, backgroundColor:C.faint, paddingHorizontal:8, paddingVertical:5 }}>
            <Txt style={{ fontSize:12 }}>{isDark?'☀️':'🌙'}</Txt>
          </TouchableOpacity>
          <TouchableOpacity onPress={onSwitchToAthlete} activeOpacity={0.75}
            style={{ borderWidth:1, borderColor:`${C.gold}66`, backgroundColor:C.goldDim, paddingHorizontal:8, paddingVertical:5 }}>
            <Txt style={{ fontSize:8, fontFamily:F.semi, letterSpacing:1, textTransform:'uppercase', color:C.gold }}>My Training</Txt>
          </TouchableOpacity>
          <TouchableOpacity onPress={()=>supabase.auth.signOut()} activeOpacity={0.75}
            style={{ borderWidth:1, borderColor:C.border, backgroundColor:C.faint, paddingHorizontal:8, paddingVertical:5 }}>
            <Txt style={{ fontSize:12 }}>⏻</Txt>
          </TouchableOpacity>
        </View>

        {/* Tab bar: Athletes | Manage (admin only) */}
        {isAdmin && (
          <View style={{ flexDirection:'row', marginTop:10, gap:6 }}>
            {[['athletes','Athletes'],['manage','Manage']].map(([key,label])=>(
              <TouchableOpacity key={key} onPress={()=>setActiveView(key)} activeOpacity={0.75}
                style={{ paddingHorizontal:14, paddingVertical:7, borderWidth:1,
                  borderColor:activeView===key?C.gold:C.border,
                  backgroundColor:activeView===key?C.goldDim:'transparent' }}>
                <Txt style={{ fontSize:9, fontFamily:activeView===key?F.semi:F.body,
                  letterSpacing:1.5, textTransform:'uppercase',
                  color:activeView===key?C.gold:C.muted }}>{label}</Txt>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {loading ? (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
          <ActivityIndicator color={C.gold} size="large"/>
          <Cap style={{ marginTop:16 }}>Loading…</Cap>
        </View>
      ) : activeView === 'manage' ? (

        /* ── ADMIN MANAGE PANEL — consolidated ── */
        <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:12 }} keyboardShouldPersistTaps="always">

          {/* Helper — collapsible section header */}
          {/* ── Section 1: Invite athletes ── */}
          {[{
            key:'invite', icon:'👥', label:'Invite athletes',
            meta:`${athletes.length} member${athletes.length!==1?'s':''}`,
            color:C.teal,
          },{
            key:'logs', icon:'📋', label:'Class logs',
            meta:`${coachClassLogs.length} published`,
            color:C.gold,
          },{
            key:'coaches', icon:'🛡️', label:'Coaches',
            meta:`${allUsers.filter(u=>u.role==='coach').length} assigned`,
            color:'#5A7AD0',
          },{
            key:'athletes', icon:'🥋', label:'Athletes',
            meta:`${athletes.length} total · ${academies.length} academy`,
            color:'#9A7ACA',
          },{
            key:'academy', icon:'🏛️', label:'Academy settings',
            meta: academies[0]?.name || 'Not set',
            color:C.muted,
          }].map(({ key, icon, label, meta, color }) => (
            <View key={key} style={{ borderWidth:1, borderColor:C.border,
              backgroundColor:C.card, marginBottom:10, borderRadius:8, overflow:'hidden' }}>
              <TouchableOpacity onPress={()=>toggleSection(key)} activeOpacity={0.75}
                style={{ flexDirection:'row', alignItems:'center', gap:10, padding:14 }}>
                <View style={{ width:30, height:30, borderRadius:6,
                  backgroundColor:`${color}18`, alignItems:'center', justifyContent:'center' }}>
                  <Txt style={{ fontSize:16 }}>{icon}</Txt>
                </View>
                <View style={{ flex:1 }}>
                  <Txt style={{ fontSize:13, fontFamily:F.semi, color:C.text }}>{label}</Txt>
                  <Cap style={{ fontSize:9, marginTop:2 }}>{meta}</Cap>
                </View>
                <Txt style={{ color:C.muted, fontSize:16 }}>{openSections[key]?'▲':'▼'}</Txt>
              </TouchableOpacity>

              {openSections[key] && (
                <View style={{ borderTopWidth:1, borderTopColor:C.border }}>

                  {/* ── INVITE ── */}
                  {key==='invite' && (
                    <View style={{ padding:14 }}>
                      {/* Signup link */}
                      <Cap style={{ marginBottom:6 }}>Share signup link</Cap>
                      <View style={{ flexDirection:'row', alignItems:'center', gap:8,
                        borderWidth:1, borderColor:C.borderMid, padding:10,
                        marginBottom:14, backgroundColor:C.faint }}>
                        <Txt style={{ fontSize:11, color:C.teal, flex:1 }}>bjjanalytics.netlify.app</Txt>
                        <TouchableOpacity onPress={()=>{
                          if(typeof navigator!=='undefined'&&navigator.clipboard)
                            navigator.clipboard.writeText('https://bjjanalytics.netlify.app');
                          setManageMsg('✓ Link copied!'); setTimeout(()=>setManageMsg(''),2000);
                        }} activeOpacity={0.75}
                          style={{ borderWidth:1, borderColor:`${C.teal}55`, paddingHorizontal:8, paddingVertical:4 }}>
                          <Cap style={{ fontSize:8, color:C.teal }}>Copy</Cap>
                        </TouchableOpacity>
                      </View>
                      {/* Send invite */}
                      <Cap style={{ marginBottom:6 }}>Send invite email</Cap>
                      <View style={{ flexDirection:'row', gap:8, marginBottom:14 }}>
                        <TextInput value={inviteEmail} onChangeText={setInviteEmail}
                          placeholder="athlete@email.com" placeholderTextColor={C.muted}
                          autoCapitalize="none" keyboardType="email-address"
                          style={{ flex:1, borderWidth:1, borderColor:C.borderMid, color:C.text,
                            fontSize:13, fontFamily:F.body, padding:10, backgroundColor:C.faint }}/>
                        <TouchableOpacity onPress={sendInvite} disabled={!inviteEmail.trim()||manageLoading}
                          activeOpacity={0.8}
                          style={{ backgroundColor:inviteEmail.trim()?C.teal:C.faint,
                            paddingHorizontal:14, alignItems:'center', justifyContent:'center' }}>
                          {manageLoading?<ActivityIndicator color="#fff" size="small"/>
                            :<Cap style={{ color:'#fff', fontSize:8 }}>Send</Cap>}
                        </TouchableOpacity>
                      </View>
                      {/* Create account */}
                      <Cap style={{ marginBottom:6 }}>Create account for athlete</Cap>
                      <View style={{ flexDirection:'row', gap:8, marginBottom:10 }}>
                        <TextInput value={newAthleteFirst} onChangeText={setNewAthleteFirst}
                          placeholder="First" placeholderTextColor={C.muted} autoCapitalize="words"
                          style={{ flex:1, borderWidth:1, borderColor:C.borderMid, color:C.text,
                            fontSize:13, fontFamily:F.body, padding:10, backgroundColor:C.faint }}/>
                        <TextInput value={newAthleteLast} onChangeText={setNewAthleteLast}
                          placeholder="Last" placeholderTextColor={C.muted} autoCapitalize="words"
                          style={{ flex:1, borderWidth:1, borderColor:C.borderMid, color:C.text,
                            fontSize:13, fontFamily:F.body, padding:10, backgroundColor:C.faint }}/>
                      </View>
                      <View style={{ flexDirection:'row', gap:8, marginBottom:14 }}>
                        <TextInput value={newAthleteEmail} onChangeText={setNewAthleteEmail}
                          placeholder="email@address.com" placeholderTextColor={C.muted}
                          autoCapitalize="none" keyboardType="email-address"
                          style={{ flex:1, borderWidth:1, borderColor:C.borderMid, color:C.text,
                            fontSize:13, fontFamily:F.body, padding:10, backgroundColor:C.faint }}/>
                        <TouchableOpacity onPress={createAthleteAccount}
                          disabled={!newAthleteFirst.trim()||!newAthleteEmail.trim()||manageLoading}
                          activeOpacity={0.8}
                          style={{ backgroundColor:newAthleteFirst.trim()&&newAthleteEmail.trim()?C.teal:C.faint,
                            paddingHorizontal:14, alignItems:'center', justifyContent:'center' }}>
                          {manageLoading?<ActivityIndicator color="#fff" size="small"/>
                            :<Cap style={{ color:'#fff', fontSize:8 }}>Create</Cap>}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* ── CLASS LOGS ── */}
                  {key==='logs' && (
                    <View style={{ padding:14 }}>
                      {coachClassLogs.length===0 ? (
                        <Cap style={{ textAlign:'center', color:C.muted, marginBottom:12 }}>No class logs yet.</Cap>
                      ) : coachClassLogs.map(cl=>{
                        const st=SESSION_TYPES.find(s=>s.key===cl.session_type)||SESSION_TYPES[0];
                        return (
                          <View key={cl.id} style={{ flexDirection:'row', alignItems:'center',
                            gap:8, paddingVertical:10, borderBottomWidth:1, borderBottomColor:C.faint }}>
                            <Txt style={{ fontSize:16 }}>{st.icon}</Txt>
                            <View style={{ flex:1 }}>
                              <Txt style={{ fontSize:12, fontFamily:F.semi, color:C.text }}>{st.label} · {cl.date}</Txt>
                              <Cap style={{ fontSize:8, marginTop:2 }} numberOfLines={1}>
                                {(cl.techniques||[]).map(t=>t.name).filter(Boolean).slice(0,3).join(', ')}
                              </Cap>
                            </View>
                            <TouchableOpacity onPress={()=>startEditClassLog(cl)} activeOpacity={0.75}
                              style={{ borderWidth:1, borderColor:`${C.gold}55`, paddingHorizontal:8, paddingVertical:4, borderRadius:4 }}>
                              <Txt style={{ fontSize:9, color:C.gold }}>✎ Edit</Txt>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={async()=>{
                              await db.deleteClassLog(cl.id);
                              setCoachClassLogs(p=>p.filter(c=>c.id!==cl.id));
                            }} activeOpacity={0.75}
                              style={{ borderWidth:1, borderColor:`${C.red}44`, paddingHorizontal:8, paddingVertical:4, borderRadius:4 }}>
                              <Txt style={{ fontSize:9, color:C.red }}>✕</Txt>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                      <TouchableOpacity onPress={()=>setShowClassLog(true)} activeOpacity={0.75}
                        style={{ borderWidth:1, borderColor:`${C.gold}44`, backgroundColor:`${C.gold}08`,
                          padding:12, alignItems:'center', marginTop:10, borderRadius:6 }}>
                        <Cap style={{ color:C.gold }}>+ New class log</Cap>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* ── COACHES ── */}
                  {key==='coaches' && (
                    <View style={{ padding:14 }}>
                      {/* Current coaches */}
                      {allUsers.filter(u=>u.role==='coach').map(u=>{
                        const ath=athletes.find(a=>a.user_id===u.user_id);
                        return ath ? (
                          <View key={u.user_id} style={{ flexDirection:'row', alignItems:'center',
                            gap:10, paddingVertical:10, borderBottomWidth:1, borderBottomColor:C.faint }}>
                            <View style={{ width:30, height:30, borderRadius:15,
                              backgroundColor:`${C.teal}22`, alignItems:'center', justifyContent:'center' }}>
                              <Txt style={{ fontSize:11, fontFamily:F.semi, color:C.teal }}>
                                {(ath.name||'?').slice(0,2).toUpperCase()}
                              </Txt>
                            </View>
                            <View style={{ flex:1 }}>
                              <Txt style={{ fontSize:12, fontFamily:F.semi, color:C.text }}>{ath.name}</Txt>
                              <Cap style={{ fontSize:8 }}>{ath.belt} belt · coach</Cap>
                            </View>
                            <TouchableOpacity onPress={async()=>{
                              await supabase.from('user_roles').update({role:'athlete'}).eq('user_id',u.user_id);
                              const {data:users}=await supabase.from('user_roles').select('user_id,role,academy_id');
                              setAllUsers(users||[]);
                              setManageMsg(`✓ ${ath.name} changed back to athlete.`);
                              setTimeout(()=>setManageMsg(''),3000);
                            }} activeOpacity={0.75}
                              style={{ borderWidth:1, borderColor:`${C.red}44`, paddingHorizontal:8, paddingVertical:4, borderRadius:4 }}>
                              <Txt style={{ fontSize:9, color:C.red }}>Remove</Txt>
                            </TouchableOpacity>
                          </View>
                        ) : null;
                      })}
                      {/* Fuzzy search to assign coach */}
                      <Cap style={{ marginBottom:8, marginTop:14 }}>Assign coach role</Cap>
                      <TextInput value={coachSearch} onChangeText={setCoachSearch}
                        placeholder="Search athlete name…" placeholderTextColor={C.muted}
                        style={{ borderWidth:1, borderColor:C.borderMid, color:C.text,
                          fontSize:13, fontFamily:F.body, padding:10,
                          backgroundColor:C.faint, marginBottom:6 }}/>
                      {coachSearch.trim().length > 0 && (
                        <View style={{ borderWidth:1, borderColor:C.border, backgroundColor:C.card }}>
                          {athletes
                            .filter(a=>fuzzyMatch(a.name,coachSearch) && allUsers.find(u=>u.user_id===a.user_id)?.role!=='coach')
                            .slice(0,5)
                            .map(a=>(
                              <TouchableOpacity key={a.id} onPress={()=>{
                                assignCoach(a.user_id, a.name);
                                setCoachSearch('');
                              }} activeOpacity={0.75}
                                style={{ flexDirection:'row', alignItems:'center', gap:8,
                                  padding:10, borderBottomWidth:1, borderBottomColor:C.faint }}>
                                <View style={{ width:26, height:26, borderRadius:13,
                                  backgroundColor:`${C.teal}18`, alignItems:'center', justifyContent:'center' }}>
                                  <Txt style={{ fontSize:9, fontFamily:F.semi, color:C.teal }}>
                                    {(a.name||'?').slice(0,2).toUpperCase()}
                                  </Txt>
                                </View>
                                <View style={{ flex:1 }}>
                                  <Txt style={{ fontSize:12, color:C.text }}>{a.name}</Txt>
                                  <Cap style={{ fontSize:8 }}>{a.belt} belt</Cap>
                                </View>
                                <Cap style={{ color:C.teal, fontSize:9 }}>Make coach</Cap>
                              </TouchableOpacity>
                            ))}
                          {athletes.filter(a=>fuzzyMatch(a.name,coachSearch) && allUsers.find(u=>u.user_id===a.user_id)?.role!=='coach').length===0 && (
                            <View style={{ padding:12 }}>
                              <Cap style={{ textAlign:'center', color:C.muted }}>No athletes match "{coachSearch}"</Cap>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  )}

                  {/* ── ATHLETES ── */}
                  {key==='athletes' && (
                    <View style={{ padding:14 }}>
                      <TextInput value={athleteSearch} onChangeText={setAthleteSearch}
                        placeholder="Search athletes…" placeholderTextColor={C.muted}
                        style={{ borderWidth:1, borderColor:C.borderMid, color:C.text,
                          fontSize:13, fontFamily:F.body, padding:10,
                          backgroundColor:C.faint, marginBottom:12 }}/>
                      {/* Group by academy */}
                      {[...academies.map(ac=>({
                        id:ac.id, name:ac.name,
                        members:athletes.filter(a=>a.academy_id===ac.id && fuzzyMatch(a.name,athleteSearch))
                      })),{
                        id:'unassigned', name:'Unassigned',
                        members:athletes.filter(a=>!a.academy_id && fuzzyMatch(a.name,athleteSearch))
                      }].filter(g=>g.members.length>0).map(group=>(
                        <View key={group.id} style={{ marginBottom:12 }}>
                          <View style={{ flexDirection:'row', alignItems:'center', gap:6,
                            paddingVertical:6, borderBottomWidth:1, borderBottomColor:`${C.gold}33` }}>
                            <Txt style={{ fontSize:9, fontFamily:F.semi, letterSpacing:1.5,
                              textTransform:'uppercase', flex:1,
                              color:group.id==='unassigned'?C.muted:C.gold }}>{group.name}</Txt>
                            <Cap style={{ fontSize:8 }}>{group.members.length}</Cap>
                          </View>
                          {group.members.map(a=>{
                            const role=allUsers.find(u=>u.user_id===a.user_id)?.role;
                            return (
                              <View key={a.id} style={{ flexDirection:'row', alignItems:'center',
                                gap:10, paddingVertical:10, borderBottomWidth:1, borderBottomColor:C.faint }}>
                                <View style={{ width:30, height:30, borderRadius:15,
                                  backgroundColor:BELT_AVATAR_COLORS[a.belt]||BELT_AVATAR_COLORS.white,
                                  alignItems:'center', justifyContent:'center' }}>
                                  <Txt style={{ fontSize:10, fontFamily:F.semi, color:C.text }}>
                                    {getInitials(a.name)}
                                  </Txt>
                                </View>
                                <View style={{ flex:1 }}>
                                  <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                                    <Txt style={{ fontSize:12, fontFamily:F.semi, color:C.text }}>{a.name}</Txt>
                                    {role==='coach'&&<View style={{ borderWidth:.5, borderColor:`${C.teal}55`, paddingHorizontal:4, paddingVertical:1 }}>
                                      <Txt style={{ fontSize:7, color:C.teal, fontFamily:F.semi }}>COACH</Txt>
                                    </View>}
                                    {role==='admin'&&<View style={{ borderWidth:.5, borderColor:`${C.gold}55`, paddingHorizontal:4, paddingVertical:1 }}>
                                      <Txt style={{ fontSize:7, color:C.gold, fontFamily:F.semi }}>ADMIN</Txt>
                                    </View>}
                                  </View>
                                  <Cap style={{ fontSize:8, marginTop:1 }}>
                                    {a.belt} belt{a.stripes?` · ${a.stripes} stripe${a.stripes!==1?'s':''}`:''}
                                  </Cap>
                                </View>
                                <TouchableOpacity onPress={()=>setEditingAthlete(a)} activeOpacity={0.75}
                                  style={{ borderWidth:1, borderColor:`${C.gold}55`,
                                    paddingHorizontal:8, paddingVertical:4, borderRadius:4 }}>
                                  <Txt style={{ fontSize:9, color:C.gold }}>✎ Edit</Txt>
                                </TouchableOpacity>
                              </View>
                            );
                          })}
                        </View>
                      ))}
                    </View>
                  )}

                  {/* ── ACADEMY SETTINGS ── */}
                  {key==='academy' && (
                    <View style={{ padding:14 }}>
                      {academies.map(ac=>(
                        <View key={ac.id} style={{ flexDirection:'row', alignItems:'center',
                          gap:10, paddingVertical:10, borderBottomWidth:1, borderBottomColor:C.faint }}>
                          <View style={{ flex:1 }}>
                            <Txt style={{ fontSize:13, fontFamily:F.semi, color:C.text }}>{ac.name}</Txt>
                            {ac.location?<Cap style={{ fontSize:9, marginTop:2 }}>{ac.location}</Cap>:null}
                          </View>
                        </View>
                      ))}
                      <Cap style={{ marginTop:14, marginBottom:8 }}>Add / find academy</Cap>
                      <TextInput value={academySearch} onChangeText={setAcademySearch}
                        placeholder="Search or create academy…" placeholderTextColor={C.muted}
                        style={{ borderWidth:1, borderColor:C.borderMid, color:C.text,
                          fontSize:13, fontFamily:F.body, padding:10,
                          backgroundColor:C.faint, marginBottom:6 }}/>
                      {academySearch.trim().length > 0 && (
                        <View style={{ borderWidth:1, borderColor:C.border, backgroundColor:C.card }}>
                          {academies.filter(ac=>fuzzyMatch(ac.name,academySearch)).map(ac=>(
                            <TouchableOpacity key={ac.id} onPress={()=>setAcademySearch('')}
                              activeOpacity={0.75}
                              style={{ padding:10, borderBottomWidth:1, borderBottomColor:C.faint }}>
                              <Txt style={{ fontSize:12, color:C.text }}>{ac.name}</Txt>
                              {ac.location?<Cap style={{ fontSize:9 }}>{ac.location}</Cap>:null}
                            </TouchableOpacity>
                          ))}
                          {/* No match — offer to create */}
                          {academies.filter(ac=>fuzzyMatch(ac.name,academySearch)).length===0 && (
                            <TouchableOpacity onPress={async()=>{
                              const {data}=await supabase.from('academies')
                                .insert({name:academySearch.trim(),created_by:session?.user?.id})
                                .select().single();
                              if(data){ setAcademies(p=>[...p,data]); setAcademySearch('');
                                setManageMsg(`✓ Academy "${data.name}" created.`);
                                setTimeout(()=>setManageMsg(''),3000); }
                            }} activeOpacity={0.75}
                              style={{ padding:10, flexDirection:'row', alignItems:'center', gap:8 }}>
                              <Txt style={{ fontSize:12, color:C.teal, flex:1 }}>
                                Create "{academySearch}"
                              </Txt>
                              <Cap style={{ color:C.teal, fontSize:9 }}>+ Create</Cap>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  )}

                </View>
              )}
            </View>
          ))}

          {/* Status message */}
          {manageMsg ? (
            <View style={{ marginBottom:16, padding:12, borderWidth:1, borderRadius:6,
              borderColor:manageMsg.startsWith('✓')?`${C.sage}55`:`${C.red}55`,
              backgroundColor:manageMsg.startsWith('✓')?`${C.sage}15`:`${C.red}15` }}>
              <Txt style={{ fontSize:12, color:manageMsg.startsWith('✓')?C.sage:C.red }}>{manageMsg}</Txt>
            </View>
          ) : null}

          {/* Athlete profile edit modal */}
          {editingAthlete && (
            <Modal visible transparent animationType="fade" onRequestClose={()=>setEditingAthlete(null)}>
              <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios'?'padding':'height'}>
                <ScrollView contentContainerStyle={{ flexGrow:1, backgroundColor:'rgba(0,0,0,0.85)',
                  justifyContent:'center', padding:20 }}>
                  <View style={{ backgroundColor:C.surface, borderWidth:1, borderColor:C.borderMid, padding:20 }}>
                    <View style={{ flexDirection:'row', alignItems:'center', marginBottom:16 }}>
                      <Txt style={{ fontSize:15, fontFamily:F.bold, flex:1 }}>Edit Profile</Txt>
                      <TouchableOpacity onPress={()=>setEditingAthlete(null)} activeOpacity={0.75}>
                        <Txt style={{ color:C.muted, fontSize:20 }}>✕</Txt>
                      </TouchableOpacity>
                    </View>
                    <Cap style={{ marginBottom:6 }}>Name</Cap>
                    <TextInput value={editingAthlete.name||''}
                      onChangeText={v=>setEditingAthlete(e=>({...e,name:v}))}
                      style={{ borderWidth:1, borderColor:C.borderMid, color:C.text,
                        fontSize:13, fontFamily:F.body, padding:10, marginBottom:12 }}/>
                    <Cap style={{ marginBottom:8 }}>Belt</Cap>
                    <Cap style={{ marginBottom:6, color:C.muted, fontSize:8 }}>Juvenile</Cap>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:8 }}>
                      <View style={{ flexDirection:'row', gap:6 }}>
                        {JUVENILE_BELTS.map(b=>{const bc=BELT_COLORS[b];return(
                          <TouchableOpacity key={b} onPress={()=>setEditingAthlete(e=>({...e,belt:b}))}
                            activeOpacity={0.75}
                            style={{ paddingHorizontal:8, paddingVertical:6, borderWidth:2,
                              borderColor:editingAthlete.belt===b?C.gold:C.border,
                              backgroundColor:editingAthlete.belt===b?bc.bg:C.faint }}>
                            <Txt style={{ fontSize:8, fontFamily:F.semi, color:editingAthlete.belt===b?bc.text:C.muted }}>
                              {bc.label}
                            </Txt>
                          </TouchableOpacity>
                        );})}
                      </View>
                    </ScrollView>
                    <Cap style={{ marginBottom:6, color:C.muted, fontSize:8 }}>Adult</Cap>
                    <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6, marginBottom:12 }}>
                      {ADULT_BELTS.map(b=>{const bc=BELT_COLORS[b];return(
                        <TouchableOpacity key={b} onPress={()=>setEditingAthlete(e=>({...e,belt:b}))}
                          activeOpacity={0.75}
                          style={{ paddingHorizontal:10, paddingVertical:6, borderWidth:2,
                            borderColor:editingAthlete.belt===b?C.gold:C.border,
                            backgroundColor:editingAthlete.belt===b?bc.bg:C.faint }}>
                          <Txt style={{ fontSize:8, fontFamily:F.semi, color:editingAthlete.belt===b?bc.text:C.muted }}>
                            {bc.label}
                          </Txt>
                        </TouchableOpacity>
                      );})}
                    </View>
                    <Cap style={{ marginBottom:8 }}>Stripes</Cap>
                    <View style={{ flexDirection:'row', gap:6, marginBottom:16 }}>
                      {[0,1,2,3,4].map(s=>(
                        <TouchableOpacity key={s} onPress={()=>setEditingAthlete(e=>({...e,stripes:s}))}
                          activeOpacity={0.75}
                          style={{ flex:1, paddingVertical:8, borderWidth:1, alignItems:'center',
                            borderColor:editingAthlete.stripes===s?C.gold:C.border,
                            backgroundColor:editingAthlete.stripes===s?C.goldDim:'transparent' }}>
                          <Txt style={{ fontSize:13, fontFamily:F.display,
                            color:editingAthlete.stripes===s?C.gold:C.muted }}>{s}</Txt>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Cap style={{ marginBottom:6 }}>Gym</Cap>
                    <TextInput value={editingAthlete.gym||''}
                      onChangeText={v=>setEditingAthlete(e=>({...e,gym:v}))}
                      placeholder="Gym name…" placeholderTextColor={C.muted}
                      style={{ borderWidth:1, borderColor:C.borderMid, color:C.text,
                        fontSize:13, fontFamily:F.body, padding:10, marginBottom:16 }}/>
                    <View style={{ flexDirection:'row', gap:8 }}>
                      <TouchableOpacity onPress={async()=>{
                        const {error}=await supabase.from('athletes')
                          .update({name:editingAthlete.name,belt:editingAthlete.belt,
                            stripes:editingAthlete.stripes,gym:editingAthlete.gym})
                          .eq('id',editingAthlete.id);
                        if(!error){
                          setAthletes(p=>p.map(a=>a.id===editingAthlete.id?{...a,...editingAthlete}:a));
                          setManageMsg(`✓ ${editingAthlete.name}'s profile updated.`);
                          setTimeout(()=>setManageMsg(''),3000);
                        }
                        setEditingAthlete(null);
                      }} activeOpacity={0.8}
                        style={{ flex:1, backgroundColor:C.gold, padding:14, alignItems:'center' }}>
                        <Txt style={{ fontSize:10, fontFamily:F.semi, color:'#0D0D0B',
                          letterSpacing:1, textTransform:'uppercase' }}>Save changes</Txt>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={()=>setEditingAthlete(null)} activeOpacity={0.75}
                        style={{ borderWidth:1, borderColor:C.border, paddingHorizontal:20,
                          alignItems:'center', justifyContent:'center' }}>
                        <Cap>Cancel</Cap>
                      </TouchableOpacity>
                    </View>
                  </View>
                </ScrollView>
              </KeyboardAvoidingView>
            </Modal>
          )}

        </ScrollView>

      ) : (

        /* ── ATHLETES VIEW ── */
        <View style={{ flex:1 }}>

          {/* Toggle bar — always visible */}
          <View style={{ flexDirection:'row', alignItems:'center', gap:8, padding:8,
            backgroundColor:C.surface, borderBottomWidth:1, borderBottomColor:C.border }}>
            <TouchableOpacity onPress={()=>setSidebarOpen(o=>!o)} activeOpacity={0.75}
              style={{ width:32, height:32, borderWidth:1, borderColor:C.border,
                backgroundColor:C.faint, alignItems:'center', justifyContent:'center' }}
              accessibilityLabel="Toggle athlete list">
              <Txt style={{ fontSize:16, color:C.gold }}>☰</Txt>
            </TouchableOpacity>
            {/* Breadcrumb */}
            <Txt style={{ fontSize:11, color:C.muted, flex:1 }} numberOfLines={1}>
              Athletes{selected && sel ? <Txt style={{ color:C.text }}> / {sel.name}</Txt> : ''}
            </Txt>
            {/* Close sidebar on detail tap — hint */}
            {sidebarOpen && selected && (
              <TouchableOpacity onPress={()=>setSidebarOpen(false)} activeOpacity={0.75}>
                <Cap style={{ color:C.gold, fontSize:8 }}>View detail →</Cap>
              </TouchableOpacity>
            )}
          </View>

          <View style={{ flex:1, flexDirection:'row' }}>

            {/* Sidebar — collapsible */}
            {sidebarOpen && (
              <View style={{ width:170, borderRightWidth:1, borderRightColor:C.border,
                backgroundColor:C.surface }}>
                <View style={{ padding:10, borderBottomWidth:1, borderBottomColor:C.border }}>
                  <Cap style={{ fontSize:7 }}>{athletes.length} athlete{athletes.length!==1?'s':''}</Cap>
                </View>
                <ScrollView>
                  {academyGroups.filter(ag=>ag.athletes.length>0).map(ag=>(
                    <View key={ag.id}>
                      <View style={{ paddingHorizontal:12, paddingVertical:6, backgroundColor:C.goldDim,
                        borderBottomWidth:1, borderBottomColor:C.border }}>
                        <Txt style={{ fontSize:9, fontFamily:F.semi, letterSpacing:1.5,
                          textTransform:'uppercase', color:C.gold }}>{ag.name}</Txt>
                        <Cap style={{ fontSize:6 }}>{ag.athletes.length} athlete{ag.athletes.length!==1?'s':''}</Cap>
                      </View>
                      {ag.athletes.map(a=>(
                        <AthleteRow key={a.id} a={a} onSelect={id=>{ setSelected(id); setSidebarOpen(false); }}/>
                      ))}
                    </View>
                  ))}
                  {unassigned.length > 0 && (
                    <View>
                      <View style={{ paddingHorizontal:12, paddingVertical:6, backgroundColor:C.faint,
                        borderBottomWidth:1, borderBottomColor:C.border }}>
                        <Txt style={{ fontSize:9, fontFamily:F.semi, letterSpacing:1.5,
                          textTransform:'uppercase', color:C.muted }}>Unassigned</Txt>
                      </View>
                      {unassigned.map(a=>(
                        <AthleteRow key={a.id} a={a} onSelect={id=>{ setSelected(id); setSidebarOpen(false); }}/>
                      ))}
                    </View>
                  )}
                  {athletes.length === 0 && (
                    <View style={{ padding:16 }}>
                      <Cap style={{ textAlign:'center', color:C.muted }}>No athletes yet</Cap>
                    </View>
                  )}
                </ScrollView>
              </View>
            )}

            {/* Detail panel */}
            {!selected ? (
              <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
                <GSLLogo size={48}/>
                <View style={{ width:30, height:2, backgroundColor:C.gold, marginVertical:14 }}/>
                <Cap>{sidebarOpen ? 'Select an athlete to view their data' : 'Tap ☰ to see athletes'}</Cap>
              </View>
            ) : (
              <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:16 }}>
              {/* Athlete header */}
              <View style={{ flexDirection:'row', alignItems:'center', gap:12, marginBottom:16,
                padding:14, backgroundColor:C.card, borderWidth:1, borderColor:C.border }}>
                <ProfileAvatar name={sel?.name||'?'} size={44} belt={sel?.belt||'white'}/>
                <View style={{ flex:1 }}>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:2 }}>
                    <Txt style={{ fontSize:15, fontFamily:F.bold, color:C.text }}>{sel?.name||'Unnamed'}</Txt>
                    {allUsers.find(u=>u.user_id===sel?.user_id)?.role==='coach' && (
                      <View style={{ borderWidth:1, borderColor:`${C.teal}55`, backgroundColor:`${C.teal}15`,
                        paddingHorizontal:6, paddingVertical:2 }}>
                        <Txt style={{ fontSize:8, fontFamily:F.semi, color:C.teal, letterSpacing:1 }}>COACH</Txt>
                      </View>
                    )}
                  </View>
                  <BeltBadge belt={sel?.belt||'white'} stripes={sel?.stripes||0} size="md"/>
                  {sel?.gym && <Cap style={{ marginTop:4 }}>{sel.gym}</Cap>}
                  {sel?.academy_id && (
                    <Cap style={{ marginTop:4, color:C.gold }}>
                      {academies.find(a=>a.id===sel.academy_id)?.name || ''}
                    </Cap>
                  )}
                  {/* Quick belt edit */}
                  {isAdmin && (
                    <View style={{ marginTop:8 }}>
                      <Cap style={{ marginBottom:4, fontSize:7, color:C.muted }}>Juvenile</Cap>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:6 }}>
                        <View style={{ flexDirection:'row', gap:4 }}>
                          {JUVENILE_BELTS.map(b=>(
                            <TouchableOpacity key={b} onPress={async()=>{
                              await supabase.from('athletes').update({belt:b}).eq('id',sel.id);
                              setAthletes(aths=>aths.map(a=>a.id===sel.id?{...a,belt:b}:a));
                            }} activeOpacity={0.75}
                              style={{ paddingHorizontal:6, paddingVertical:3, borderWidth:1,
                                borderColor:sel?.belt===b?C.gold:C.border,
                                backgroundColor:sel?.belt===b?BELT_COLORS[b].bg:'transparent' }}>
                              <Txt style={{ fontSize:7, fontFamily:F.semi,
                                color:sel?.belt===b?BELT_COLORS[b].text:C.muted, textTransform:'capitalize' }}>
                                {BELT_COLORS[b].label}
                              </Txt>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                      <Cap style={{ marginBottom:4, fontSize:7, color:C.muted }}>Adult</Cap>
                      <View style={{ flexDirection:'row', gap:4, flexWrap:'wrap', marginBottom:6 }}>
                        {ADULT_BELTS.map(b=>(
                          <TouchableOpacity key={b} onPress={async()=>{
                            await supabase.from('athletes').update({belt:b}).eq('id',sel.id);
                            setAthletes(aths=>aths.map(a=>a.id===sel.id?{...a,belt:b}:a));
                          }} activeOpacity={0.75}
                            style={{ paddingHorizontal:8, paddingVertical:4, borderWidth:1,
                              borderColor:sel?.belt===b?C.gold:C.border,
                              backgroundColor:sel?.belt===b?BELT_COLORS[b].bg:'transparent' }}>
                            <Txt style={{ fontSize:8, fontFamily:F.semi,
                              color:sel?.belt===b?BELT_COLORS[b].text:C.muted, textTransform:'capitalize' }}>
                              {BELT_COLORS[b].label}
                            </Txt>
                          </TouchableOpacity>
                        ))}
                      </View>
                      {/* Stripes */}
                      <View style={{ flexDirection:'row', gap:4 }}>
                        {[0,1,2,3,4].map(s=>(
                          <TouchableOpacity key={s} onPress={async()=>{
                            await supabase.from('athletes').update({stripes:s}).eq('id',sel.id);
                            setAthletes(aths=>aths.map(a=>a.id===sel.id?{...a,stripes:s}:a));
                          }} activeOpacity={0.75}
                            style={{ width:22, height:22, borderWidth:1, alignItems:'center', justifyContent:'center',
                              borderColor:sel?.stripes===s?C.gold:C.border,
                              backgroundColor:sel?.stripes===s?C.goldDim:'transparent' }}>
                            <Txt style={{ fontSize:9, color:sel?.stripes===s?C.gold:C.muted }}>{s}</Txt>
                          </TouchableOpacity>
                        ))}
                        <Cap style={{ alignSelf:'center', fontSize:7 }}>stripes</Cap>
                      </View>
                    </View>
                  )}
                </View>
                {/* Log session button */}
                <TouchableOpacity onPress={()=>onLogForAthlete && onLogForAthlete(sel)} activeOpacity={0.75}
                  style={{ borderWidth:1, borderColor:`${C.gold}66`, backgroundColor:C.goldDim,
                    paddingHorizontal:10, paddingVertical:8, alignItems:'center' }}>
                  <Txt style={{ fontSize:14, marginBottom:2 }}>📋</Txt>
                  <Txt style={{ fontSize:7, fontFamily:F.semi, letterSpacing:1,
                    textTransform:'uppercase', color:C.gold }}>Log Session</Txt>
                </TouchableOpacity>
              </View>

              {/* Stats */}
              <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:14 }}>
                {[
                  { label:'Rolls',       value:selRolls.length, color:C.gold },
                  { label:'Win Rate',    value:selRolls.length>0?`${Math.round((wins/selRolls.length)*100)}%`:'—', color:C.sage },
                  { label:'Sub Wins',   value:subWins,          color:C.red },
                  { label:'Comp',        value:`${compWins}W`,  color:C.teal },
                  { label:'Days',        value:selDays.length,  color:C.amber },
                  { label:'Streak',      value:`${streak}d`,    color:C.blue },
                ].map(({label,value,color})=>(
                  <View key={label} style={{ flex:1, minWidth:70, borderWidth:1, borderColor:C.border,
                    backgroundColor:C.card, padding:10, alignItems:'center' }}>
                    <Txt style={{ fontSize:16, fontFamily:F.display, color, lineHeight:20 }}>{value}</Txt>
                    <Cap style={{ fontSize:6, textAlign:'center', marginTop:3 }}>{label}</Cap>
                  </View>
                ))}
              </View>

              {/* Recent rolls */}
              <View style={{ borderWidth:1, borderColor:C.border, marginBottom:12 }}>
                <View style={{ flexDirection:'row', alignItems:'center', padding:12, borderBottomWidth:1, borderBottomColor:C.border, backgroundColor:C.faint }}>
                  <View style={{ width:3, height:12, backgroundColor:C.gold, marginRight:8 }}/>
                  <Txt style={{ fontSize:9, fontFamily:F.semi, letterSpacing:2, textTransform:'uppercase', color:C.textDim }}>Recent Rolls</Txt>
                </View>
                <View style={{ padding:12 }}>
                  {selRolls.length===0 && <Cap style={{ textAlign:'center', paddingVertical:8 }}>No rolls recorded</Cap>}
                  {selRolls.slice(0,6).map((r,i)=>{
                    const my=(r.eventLog||[]).filter(e=>e.side==='me'&&e.scored).reduce((a,e)=>a+(e.pts||0),0);
                    const op=(r.eventLog||[]).filter(e=>e.side==='opp'&&e.scored).reduce((a,e)=>a+(e.pts||0),0);
                    const res=r.rollResult||(my>op?'win':my<op?'loss':'draw');
                    const rc=res==='win'?C.sage:res==='loss'?C.red:C.amber;
                    return(
                      <View key={r.id} style={{ flexDirection:'row', alignItems:'center', paddingVertical:7,
                        borderBottomWidth:i<Math.min(selRolls.length,6)-1?1:0, borderBottomColor:C.faint }}>
                        <View style={{ flex:1 }}>
                          <Txt style={{ fontSize:11, color:C.text }}>{r.partner||'Open Mat'}</Txt>
                          <Cap style={{ fontSize:7, marginTop:1 }}>{r.startedAt?new Date(r.startedAt).toLocaleDateString():''}</Cap>
                        </View>
                        {r.endType==='submission'&&<View style={{ borderWidth:1, borderColor:`${C.red}44`, paddingHorizontal:4, paddingVertical:1, marginRight:6 }}><Txt style={{ fontSize:7, color:C.red, fontFamily:F.semi }}>🔒</Txt></View>}
                        <Txt style={{ fontSize:11, fontFamily:F.semi, color:C.gold, marginRight:6 }}>{my}–{op}</Txt>
                        <View style={{ borderWidth:1, borderColor:`${rc}44`, paddingHorizontal:5, paddingVertical:1 }}>
                          <Txt style={{ fontSize:8, fontFamily:F.semi, color:rc }}>{res==='win'?'W':res==='loss'?'L':'D'}</Txt>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Competitions */}
              {selComps.length>0&&(
                <View style={{ borderWidth:1, borderColor:C.border, marginBottom:12 }}>
                  <View style={{ flexDirection:'row', alignItems:'center', padding:12, borderBottomWidth:1, borderBottomColor:C.border, backgroundColor:C.faint }}>
                    <View style={{ width:3, height:12, backgroundColor:C.teal, marginRight:8 }}/>
                    <Txt style={{ fontSize:9, fontFamily:F.semi, letterSpacing:2, textTransform:'uppercase', color:C.textDim }}>Competitions</Txt>
                  </View>
                  <View style={{ padding:12 }}>
                    {selComps.map((c,i)=>{
                      const cW=c.rounds.filter(r=>r.result==='win').length;
                      const cL=c.rounds.filter(r=>r.result==='loss').length;
                      return(
                        <View key={c.id} style={{ paddingVertical:7, borderBottomWidth:i<selComps.length-1?1:0, borderBottomColor:C.faint }}>
                          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
                            <Txt style={{ fontSize:11, fontFamily:F.semi, color:C.text, flex:1 }} numberOfLines={1}>{c.name}</Txt>
                            <View style={{ flexDirection:'row', gap:4 }}>
                              <View style={{ borderWidth:1, borderColor:`${C.sage}44`, paddingHorizontal:5, paddingVertical:1 }}>
                                <Txt style={{ fontSize:8, color:C.sage, fontFamily:F.semi }}>{cW}W</Txt>
                              </View>
                              <View style={{ borderWidth:1, borderColor:`${C.red}44`, paddingHorizontal:5, paddingVertical:1 }}>
                                <Txt style={{ fontSize:8, color:C.red, fontFamily:F.semi }}>{cL}L</Txt>
                              </View>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Insights */}
              {selRolls.length>=2&&(()=>{
                const ins=generateInsights(selRolls,DEF_TAKEDOWNS,DEF_SWEEPS,DEF_TRANSITIONS,DEF_POS,selComps);
                if(!ins.length) return null;
                return(
                  <View style={{ borderWidth:1, borderColor:`${C.gold}55`, backgroundColor:C.goldDim, marginBottom:12 }}>
                    <View style={{ flexDirection:'row', alignItems:'center', padding:12, borderBottomWidth:1, borderBottomColor:`${C.gold}33` }}>
                      <Txt style={{ fontSize:13, marginRight:8 }}>💡</Txt>
                      <Txt style={{ fontSize:9, fontFamily:F.semi, letterSpacing:2, textTransform:'uppercase', color:C.gold }}>Performance Insights</Txt>
                    </View>
                    {ins.slice(0,3).map((ins2,i)=>(
                      <View key={i} style={{ padding:12, borderBottomWidth:i<2?1:0, borderBottomColor:`${C.gold}22` }}>
                        <Txt style={{ fontSize:10, fontFamily:F.semi, color:ins2.color, marginBottom:2 }}>{ins2.icon} {ins2.title}</Txt>
                        <Txt style={{ fontSize:11, color:C.text, lineHeight:16 }}>{ins2.text}</Txt>
                      </View>
                    ))}
                  </View>
                );
              })()}
            </ScrollView>
            )}
          </View>
        </View>
      )}

      {/* ── Log Class Modal ── */}
      <YouTubeSearchModal
        visible={ytSearchIndex !== null}
        initialQuery={ytSearchIndex !== null ? classLogTechs[ytSearchIndex]?.name || '' : ''}
        onClose={()=>setYtSearchIndex(null)}
        onSelect={url=>{ if(ytSearchIndex!==null) setClassLogTechs(ts=>ts.map((t,idx)=>idx===ytSearchIndex?{...t,url}:t)); }}/>
      <Modal visible={showClassLog} transparent animationType="slide" onRequestClose={()=>setShowClassLog(false)}>
        <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios'?'padding':'height'}>
          <ScrollView contentContainerStyle={{ flexGrow:1, backgroundColor:'rgba(10,10,8,0.97)',
            alignItems:'center', justifyContent:'center', padding:20 }}
            keyboardShouldPersistTaps="always">
            <View style={{ backgroundColor:C.surface, borderWidth:1, borderColor:C.borderMid,
              width:'100%', maxWidth:420, padding:20 }}>
              <View style={{ flexDirection:'row', alignItems:'center', marginBottom:16 }}>
                <View style={{ width:3, height:16, backgroundColor:C.teal, marginRight:10 }}/>
                <Txt style={{ fontSize:16, fontFamily:F.bold, flex:1 }}>
                  {editingClassLog ? 'Edit Class Log' : 'Log Class'}
                </Txt>
                <TouchableOpacity onPress={()=>{ setShowClassLog(false); setEditingClassLog(null); }} activeOpacity={0.75}>
                  <Txt style={{ color:C.muted, fontSize:20 }}>✕</Txt>
                </TouchableOpacity>
              </View>
              <Cap style={{ marginBottom:6 }}>Date</Cap>
              <TextInput value={classLogDate} onChangeText={setClassLogDate}
                placeholder="YYYY-MM-DD" placeholderTextColor={C.muted}
                style={{ borderWidth:1, borderColor:C.borderMid, color:C.text, fontSize:13,
                  fontFamily:F.body, padding:10, marginBottom:14 }}/>
              <Cap style={{ marginBottom:8 }}>Session type</Cap>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:14 }}>
                <View style={{ flexDirection:'row', gap:6 }}>
                  {SESSION_TYPES.map(st=>(
                    <TouchableOpacity key={st.key} onPress={()=>setClassLogType(st.key)} activeOpacity={0.75}
                      style={{ flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:12, paddingVertical:8,
                        borderWidth:1, borderColor:classLogType===st.key?C.teal:C.border,
                        backgroundColor:classLogType===st.key?`${C.teal}15`:'transparent' }}>
                      <Txt style={{ fontSize:13 }}>{st.icon}</Txt>
                      <Txt style={{ fontSize:11, fontFamily:F.semi, color:classLogType===st.key?C.teal:C.muted }}>{st.label}</Txt>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <Cap style={{ marginBottom:8 }}>Techniques covered</Cap>
              {classLogTechs.map((tech, i) => {
                const isYT = tech.url && (tech.url.includes('youtube') || tech.url.includes('youtu.be'));
                return (
                  <View key={i} style={{ marginBottom:8, padding:10, borderWidth:1,
                    borderColor:C.faint, backgroundColor:C.faint }}>
                    <View style={{ flexDirection:'row', alignItems:'center', gap:6, marginBottom:6 }}>
                      <TextInput value={tech.name}
                        onChangeText={v=>setClassLogTechs(ts=>ts.map((t,idx)=>idx===i?{...t,name:v}:t))}
                        placeholder="Technique name…" placeholderTextColor={C.muted}
                        style={{ flex:1, borderWidth:1, borderColor:C.borderMid, color:C.text,
                          fontSize:13, fontFamily:F.body, padding:8, backgroundColor:C.card }}/>
                      {classLogTechs.length > 1 && (
                        <TouchableOpacity onPress={()=>setClassLogTechs(ts=>ts.filter((_,idx)=>idx!==i))} activeOpacity={0.75}>
                          <Txt style={{ color:C.muted, fontSize:18 }}>✕</Txt>
                        </TouchableOpacity>
                      )}
                    </View>
                    <TextInput value={tech.notes||''}
                      onChangeText={v=>setClassLogTechs(ts=>ts.map((t,idx)=>idx===i?{...t,notes:v}:t))}
                      placeholder="Coaching note (optional)…" placeholderTextColor={C.muted}
                      style={{ borderWidth:1, borderColor:C.border, color:C.text, fontSize:11,
                        fontFamily:F.body, padding:8, backgroundColor:C.card, marginBottom:6 }}/>
                    {/* URL / video reference */}
                    <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                      <Txt style={{ fontSize:14 }}>{isYT ? '▶️' : '🔗'}</Txt>
                      <TextInput value={tech.url||''}
                        onChangeText={v=>setClassLogTechs(ts=>ts.map((t,idx)=>idx===i?{...t,url:v}:t))}
                        placeholder="Paste URL or search YouTube…"
                        placeholderTextColor={C.muted}
                        autoCapitalize="none" keyboardType="url"
                        style={{ flex:1, borderWidth:1,
                          borderColor:tech.url?`${C.teal}55`:C.border,
                          color:tech.url?C.teal:C.text, fontSize:11,
                          fontFamily:F.body, padding:8, backgroundColor:C.card }}/>
                      <TouchableOpacity onPress={()=>setYtSearchIndex(i)} activeOpacity={0.75}
                        style={{ backgroundColor:'#ff0000', paddingHorizontal:8, paddingVertical:8,
                          borderRadius:4 }}>
                        <Txt style={{ fontSize:10 }}>▶</Txt>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
              <TouchableOpacity onPress={()=>setClassLogTechs(ts=>[...ts,{name:'',notes:'',url:''}])} activeOpacity={0.75}
                style={{ flexDirection:'row', alignItems:'center', gap:8, padding:10,
                  borderWidth:1, borderStyle:'dashed', borderColor:C.borderMid, marginBottom:14 }}>
                <Txt style={{ fontSize:18, color:C.muted }}>+</Txt>
                <Cap>Add technique</Cap>
              </TouchableOpacity>
              <Cap style={{ marginBottom:6 }}>Class notes</Cap>
              <TextInput value={classLogNotes} onChangeText={setClassLogNotes}
                placeholder="Coaching cues, key details, what to focus on next session…"
                placeholderTextColor={C.muted} multiline numberOfLines={3}
                style={{ borderWidth:1, borderColor:C.borderMid, color:C.text, fontSize:13,
                  fontFamily:F.body, padding:10, minHeight:70, marginBottom:16, textAlignVertical:'top' }}/>
              <TouchableOpacity onPress={saveClassLog}
                disabled={classLogSaving || !classLogTechs.some(t=>t.name.trim())} activeOpacity={0.8}
                style={{ backgroundColor:classLogTechs.some(t=>t.name.trim())?C.teal:C.faint,
                  padding:14, alignItems:'center' }}>
                {classLogSaving
                  ? <ActivityIndicator color="#fff"/>
                  : <Txt style={{ fontSize:10, fontFamily:F.semi, letterSpacing:1.5,
                      textTransform:'uppercase', color:'#fff' }}>
                      {editingClassLog ? 'Save Changes' : 'Publish to Academy'}
                    </Txt>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Auth Screen ───────────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode,      setMode]      = useState('login');
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

  const submit = async () => {
    if (mode === 'signup' && !firstName.trim()) {
      setError('Please enter your first name.'); return;
    }
    setLoading(true); setError('');
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        // After signup, update the athlete name that the trigger created
        if (data?.user) {
          await supabase.from('athletes')
            .update({ name: fullName })
            .eq('user_id', data.user.id);
        }
        if (data?.user && !data?.session) {
          setError('✓ Account created! Check your email for a confirmation link, then sign in.');
          setMode('login'); setLoading(false); return;
        }
      }
    } catch (e) {
      const msg = (
        (typeof e === 'string' && e) ||
        e?.message || e?.error_description || e?.msg ||
        (e?.status ? `Error ${e.status}` : '') || ''
      );
      if (msg.includes('already registered') || msg.includes('already exists')) {
        setError('An account with this email already exists. Try signing in instead.');
        setMode('login');
      } else if (msg.includes('password') && msg.includes('character')) {
        setError('Password must be at least 6 characters.');
      } else if (msg.includes('valid email') || msg.includes('invalid email')) {
        setError('Please enter a valid email address.');
      } else if (msg.includes('Database error') || msg.includes('database')) {
        setError('There was a server error. Please try again in a moment.');
      } else if (msg.includes('rate limit') || msg.includes('too many')) {
        setError('Too many attempts. Please wait a minute and try again.');
      } else if (msg.includes('Invalid login') || msg.includes('Invalid credentials')) {
        setError('Incorrect email or password. Please try again.');
      } else if (msg) {
        setError(msg);
      } else {
        setError('Something went wrong. Please try again.');
      }
    }
    setLoading(false);
  };

  const canSubmit = email && password && (mode === 'login' || firstName.trim());

  return (
    <View style={{ flex:1, backgroundColor:C.bg, paddingTop:TOP_INSET }}>
      <StatusBar barStyle="light-content" backgroundColor={C.surface} translucent={false}/>
      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios'?'padding':'height'}>
        <ScrollView contentContainerStyle={{ flexGrow:1, alignItems:'center', justifyContent:'center', padding:32 }}>

          {/* Logo + wordmark */}
          <GSLLogo size={80}/>
          <View style={{ width:40, height:2, backgroundColor:C.gold, marginTop:20, marginBottom:8 }}/>
          <Txt style={{ fontSize:9, fontFamily:F.display, letterSpacing:3, textTransform:'uppercase', color:C.text, marginBottom:2 }}>Grounded</Txt>
          <Txt style={{ fontSize:9, fontFamily:F.display, letterSpacing:3, textTransform:'uppercase', color:C.gold, marginBottom:40 }}>Skills Lab</Txt>

          {/* Form */}
          <View style={{ width:'100%', maxWidth:380 }}>

            {/* Name fields — signup only */}
            {mode === 'signup' && (
              <View style={{ flexDirection:'row', gap:10, marginBottom:16 }}>
                <View style={{ flex:1 }}>
                  <Cap style={{ marginBottom:6 }}>First Name</Cap>
                  <TextInput
                    value={firstName} onChangeText={setFirstName}
                    placeholder="First" placeholderTextColor={C.muted}
                    autoCapitalize="words" returnKeyType="next"
                    style={{ borderWidth:1, borderColor:C.borderMid, color:C.text, fontSize:15,
                      fontFamily:F.body, padding:14, backgroundColor:C.card }}/>
                </View>
                <View style={{ flex:1 }}>
                  <Cap style={{ marginBottom:6 }}>Last Name</Cap>
                  <TextInput
                    value={lastName} onChangeText={setLastName}
                    placeholder="Last" placeholderTextColor={C.muted}
                    autoCapitalize="words" returnKeyType="next"
                    style={{ borderWidth:1, borderColor:C.borderMid, color:C.text, fontSize:15,
                      fontFamily:F.body, padding:14, backgroundColor:C.card }}/>
                </View>
              </View>
            )}

            <Cap style={{ marginBottom:6 }}>Email</Cap>
            <TextInput
              value={email} onChangeText={setEmail}
              placeholder="your@email.com" placeholderTextColor={C.muted}
              autoCapitalize="none" keyboardType="email-address" returnKeyType="next"
              style={{ borderWidth:1, borderColor:C.borderMid, color:C.text, fontSize:15,
                fontFamily:F.body, padding:14, marginBottom:16, backgroundColor:C.card }}/>

            <Cap style={{ marginBottom:6 }}>Password</Cap>
            <TextInput
              value={password} onChangeText={setPassword}
              placeholder="••••••••" placeholderTextColor={C.muted}
              secureTextEntry returnKeyType="done" onSubmitEditing={submit}
              style={{ borderWidth:1, borderColor:C.borderMid, color:C.text, fontSize:15,
                fontFamily:F.body, padding:14, marginBottom:24, backgroundColor:C.card }}/>

            {error ? (
              <View style={{ borderWidth:1,
                borderColor:error.startsWith('✓')?`${C.sage}44`:`${C.amber}44`,
                backgroundColor:error.startsWith('✓')?`${C.sage}15`:`${C.amber}15`,
                padding:12, marginBottom:16 }}>
                <Txt style={{ fontSize:12, color:error.startsWith('✓')?C.sage:C.amber, lineHeight:18 }}>{error}</Txt>
              </View>
            ) : null}

            <TouchableOpacity onPress={submit} disabled={loading || !canSubmit} activeOpacity={0.8}
              style={{ backgroundColor:!canSubmit?C.faint:C.gold, padding:16, alignItems:'center', marginBottom:16 }}>
              {loading
                ? <ActivityIndicator color="#0F0F0D"/>
                : <Txt style={{ fontSize:10, fontFamily:F.display, letterSpacing:3, textTransform:'uppercase', color:'#0F0F0D' }}>
                    {mode==='login'?'Sign In':'Create Account'}
                  </Txt>}
            </TouchableOpacity>

            <TouchableOpacity onPress={()=>{ setMode(m=>m==='login'?'signup':'login'); setError(''); }} activeOpacity={0.7} style={{ alignItems:'center' }}>
              <Txt style={{ fontSize:12, color:C.muted }}>
                {mode==='login'?'No account? ':'Already have an account? '}
                <Txt style={{ color:C.gold, fontFamily:F.semi }}>{mode==='login'?'Sign up':'Sign in'}</Txt>
              </Txt>
            </TouchableOpacity>
          </View>

          <Txt style={{ fontSize:8, color:C.border, letterSpacing:2, textTransform:'uppercase', marginTop:48 }}>
            Train. Measure. Improve. Repeat.
          </Txt>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

export default function App() {
  const [session,      setSession]      = useState(null);
  const [authReady,    setAuthReady]    = useState(false);
  const [userRole,     setUserRole]     = useState(null);
  const [coachMode,    setCoachMode]    = useState(true);
  const [impersonating, setImpersonating] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setAuthReady(true);
      if (session?.user) fetchRole(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) fetchRole(session.user.id);
      else setUserRole(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchRole = async userId => {
    const { data } = await supabase
      .from('user_roles').select('role').eq('user_id', userId).single();
    setUserRole(data?.role || 'athlete');
  };

  if (!authReady || (session && userRole === null)) return (
    <View style={{ flex:1, backgroundColor:C.bg, alignItems:'center', justifyContent:'center' }}>
      <StatusBar barStyle="light-content"/>
      <ActivityIndicator color={C.gold} size="large"/>
    </View>
  );

  if (!session) return <AuthScreen onAuth={setSession}/>;

  const isCoachOrAdmin = userRole === 'admin' || userRole === 'coach';

  // ── Keep AppMain always mounted for coach/admin so state persists ──────────
  // We show/hide using display:none equivalent (View with display style on web,
  // or just conditional rendering on native since native doesn't remount on hide)
  if (isCoachOrAdmin) {
    return (
      <View style={{ flex:1 }}>
        {/* Coach dashboard — shown when coachMode and not impersonating */}
        {coachMode && !impersonating && (
          <CoachDashboard
            session={session} userRole={userRole}
            onSwitchToAthlete={()=>setCoachMode(false)}
            onLogForAthlete={ath=>setImpersonating({
              id: ath.id, name: ath.name,
              belt: ath.belt||'white', stripes: ath.stripes||0,
              gym: ath.gym||'', user_id: ath.user_id, academy_id: ath.academy_id,
            })}/>
        )}

        {/* AppMain — kept mounted, hidden behind coach dashboard using display */}
        <View style={{
          flex: coachMode && !impersonating ? 0 : 1,
          display: coachMode && !impersonating ? 'none' : 'flex',
        }}>
          <AppMain
            session={session}
            onSwitchToCoach={()=>{ setImpersonating(null); setCoachMode(true); }}
            isCoach
            impersonatedAthlete={impersonating}
            onStopImpersonating={()=>setImpersonating(null)}/>
        </View>
      </View>
    );
  }

  return <AppMain session={session}/>;
}

// ─── Main App (authenticated) ─────────────────────────────────────────────────
function AppMain({ session, onSwitchToCoach, isCoach, impersonatedAthlete, onStopImpersonating }) {
  // ── Theme state ─────────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(true);
  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      Object.assign(C, next ? DARK : LIGHT);
      Object.assign(PIE, next ? PIE_DARK : PIE_LIGHT);
      PIE.length = (next ? PIE_DARK : PIE_LIGHT).length;
      return next;
    });
  };
  useEffect(() => { Object.assign(C, isDark ? DARK : LIGHT); }, []);

  // ── Supabase data state ──────────────────────────────────────────────────────
  const [athlete,    setAthlete]   = useState(null);
  const [loading,    setLoading]   = useState(true);

  const [fontsLoaded, setFontsLoaded] = useState(false);
  useEffect(() => {
    try {
      const { NativeModules } = require('react-native');
      if (NativeModules.Orientation) NativeModules.Orientation.lockToPortrait?.();
    } catch (_) {}
    Font.loadAsync({
      'Inter_400Regular':    { uri: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2' },
      'Inter_500Medium':     { uri: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hiJ-Ek-_EeA.woff2' },
      'Inter_600SemiBold':   { uri: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiJ-Ek-_EeA.woff2' },
      'Inter_700Bold':       { uri: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hiJ-Ek-_EeA.woff2' },
      'DMSerifDisplay_400Regular': { uri: 'https://fonts.gstatic.com/s/dmserifdisplay/v15/-nFnOHM81r4j6k0gjALR8uVua8QHJbkn_E3OSQ.woff2' },
    }).then(() => setFontsLoaded(true)).catch(() => setFontsLoaded(true));
  }, []);

  // ── Training state ───────────────────────────────────────────────────────────
  const [submissions,  setSubmissions]  = useState(DEF_SUBS);
  const [sweeps,       setSweeps]       = useState(DEF_SWEEPS);
  const [positions,    setPositions]    = useState(DEF_POS);
  const [transitions,  setTransitions]  = useState(DEF_TRANSITIONS);
  const [guardPulls,   setGuardPulls]   = useState(DEF_GUARD_PULLS);
  const [takedowns,    setTakedowns]    = useState(DEF_TAKEDOWNS);
  const [rolls,        setRolls]        = useState([]);
  const [activeRoll,   setActiveRoll]   = useState(null);
  const [competitions, setCompetitions] = useState([]);
  const [trainingDays, setTrainingDays] = useState([]);
  const [journal,         setJournal]         = useState([]);
  const [classLogs,       setClassLogs]       = useState([]);
  const [skippedLogIds,   setSkippedLogIds]   = useState(new Set());
  const [showTutorial,    setShowTutorial]    = useState(false);
  const [showConsent,     setShowConsent]     = useState(false);
  const [showProfiles, setShowProfiles] = useState(false);

  const [tab,     setTab]     = useState('Track');
  const [confirm, ConfirmDialog_] = useConfirm();

  useEffect(() => {
    if (!session?.user) return;
    (async () => {
      setLoading(true);
      try {
        let ath;
        if (impersonatedAthlete) {
          // Use the impersonated athlete directly — no need to fetch
          ath = impersonatedAthlete;
        } else {
          ath = await db.getAthlete(session.user.id);
          if (!ath) {
            ath = await db.upsertAthlete({
              user_id: session.user.id,
              name: session.user.email.split('@')[0],
              belt: 'white', stripes: 0, gym: '',
            });
          }
        }
        setAthlete(ath);

        const techs = await db.getTechniques(ath.id);
        if (techs) {
          if (techs.submissions?.length) setSubmissions(techs.submissions);
          if (techs.sweeps?.length)      setSweeps(techs.sweeps);
          if (techs.positions?.length)   setPositions(techs.positions);
          if (techs.transitions?.length) setTransitions(techs.transitions);
          if (techs.guard_pulls?.length) setGuardPulls(techs.guard_pulls);
          if (techs.takedowns?.length)   setTakedowns(techs.takedowns);
        }
        const [dbRolls, dbDays, dbComps, dbJournal] = await Promise.all([
          db.getRolls(ath.id),
          db.getTrainingDays(ath.id),
          db.getCompetitions(ath.id),
          db.getJournalEntries(ath.id),
        ]);
        setRolls(dbRolls.map(fromDbRoll));
        setTrainingDays(dbDays);
        setCompetitions(dbComps);
        setJournal(dbJournal.map(e => ({
          id: e.id, athleteId: e.athlete_id,
          date: e.date, sessionType: e.session_type,
          techniques: e.techniques || [], notes: e.notes || '',
          classLogId: e.class_log_id || null,
        })));

        // Load class logs if athlete has an academy
        if (ath.academy_id) {
          const logs = await db.getClassLogs(ath.academy_id);
          setClassLogs(logs);
        }

        // Load user settings (tutorial + skipped logs + consent)
        if (!impersonatedAthlete && session?.user) {
          const settings = await db.getUserSettings(session.user.id);
          if (!settings.tutorial_done) setShowTutorial(true);
          if (settings.skipped_logs?.length) {
            setSkippedLogIds(new Set(settings.skipped_logs));
          }
          if (!settings.consent_agreed) setShowConsent(true);
        }
      } catch (e) { console.error('Load error:', e); }
      setLoading(false);
    })();
  }, [session, impersonatedAthlete]);

  // ── Auto-save competitions to Supabase when they change ──────────────────
  const prevCompsRef = useRef(null);
  useEffect(() => {
    if (!athlete?.id || !competitions.length) return;
    // Only save if competitions actually changed
    const current = JSON.stringify(competitions);
    if (current === prevCompsRef.current) return;
    prevCompsRef.current = current;

    competitions.forEach(async comp => {
      try {
        // Upsert the competition
        const { rounds, ...compData } = comp;
        await supabase.from('competitions').upsert({
          id: compData.id, athlete_id: athlete.id,
          name: compData.name, date: compData.date,
          location: compData.location, gi: compData.gi, notes: compData.notes,
          bracket_size: compData.bracketSize || null,
          medal: compData.medal || 'none',
        }, { onConflict: 'id' });

        // Upsert each round
        if (rounds?.length) {
          const dbRounds = rounds.map(r => toDbRound(r, comp.id, athlete.id));
          await supabase.from('competition_rounds').upsert(dbRounds, { onConflict: 'id' });
        }
      } catch(e) { console.error('Save competition failed:', e.message); }
    });
  }, [competitions, athlete?.id]);
  const techSaveTimer = useRef(null);
  useEffect(() => {
    if (!athlete?.id) return;
    clearTimeout(techSaveTimer.current);
    techSaveTimer.current = setTimeout(() => {
      db.upsertTechniques(athlete.id, {
        submissions, sweeps, positions, transitions, guard_pulls: guardPulls, takedowns,
      }).catch(console.error);
    }, 1500);
  }, [submissions, sweeps, positions, transitions, guardPulls, takedowns, athlete?.id]);

  // ── Athlete / profile helpers (single athlete per account) ───────────────
  const profiles        = athlete ? [{ ...athlete, id: athlete.id }] : [];
  const activeProfileId = athlete?.id || null;
  const activeProfile   = athlete;

  const createProfile = async p => {
    if (!session?.user) return;
    try {
      const ath = await db.upsertAthlete({ ...p, user_id: session.user.id });
      setAthlete(ath); setShowProfiles(false);
    } catch (e) { console.error(e); }
  };
  const editProfile = async p => {
    try {
      const ath = await db.upsertAthlete({ ...athlete, ...p });
      setAthlete(ath);
    } catch (e) {
      console.error('editProfile error:', e.message);
      Alert.alert('Save failed', 'Could not save profile changes. Please try again.');
    }
  };
  const deleteProfile = async () => { await supabase.auth.signOut(); };
  const switchProfile = () => setShowProfiles(false);

  // ── Training day logging ──────────────────────────────────────────────────
  const logDay = async ds => {
    if (!athlete?.id) return;
    setTrainingDays(days => days.includes(ds) ? days : [...days, ds]);
    await db.logTrainingDay(athlete.id, ds).catch(console.error);
  };
  const removeDay = async ds => {
    if (!athlete?.id) return;
    setTrainingDays(days => days.filter(d => d !== ds));
    await db.removeTrainingDay(athlete.id, ds).catch(console.error);
  };

  const dismissTutorial = async () => {
    setShowTutorial(false);
    if (session?.user) await db.setTutorialDone(session.user.id);
  };


  // Roll lifecycle
  const isPaused   = !!activeRoll?.paused;
  const startRoll  = partner => setActiveRoll(emptyRoll(partner));
  const finishRoll = async result => {
    if (!activeRoll) return;
    const now = Date.now();

    const resolvedResult = { ...result };
    if (result.endType === 'submission') {
      resolvedResult.rollResult = result.submissionWinner === 'me' ? 'win' : 'loss';
    } else {
      const myPts  = (activeRoll.eventLog||[]).filter(e=>e.side==='me'&&e.scored).reduce((a,e)=>a+(e.pts||0),0);
      const oppPts = (activeRoll.eventLog||[]).filter(e=>e.side==='opp'&&e.scored).reduce((a,e)=>a+(e.pts||0),0);
      resolvedResult.rollResult = myPts > oppPts ? 'win' : myPts < oppPts ? 'loss' : 'draw';
    }

    const endEvent = {
      id: uid(), ts: now, side: 'me', type: 'end',
      item: result.endType === 'submission' ? 'submission' : 'time',
      label: result.endType === 'submission'
        ? `Ended — ${resolvedResult.rollResult === 'win' ? 'WIN' : 'LOSS'} by Submission: ${result.submissionName}${result.submissionWinner === 'opp' ? ' (you tapped out)' : ' (you tapped them)'}`
        : `Ended — Time Expired · ${resolvedResult.rollResult.toUpperCase()}${result.duration ? ` (${result.duration})` : ''}`,
      scoreKey: null, scored: false, pts: 0,
      endType: result.endType,
      submissionName: result.submissionName || '',
      submissionWinner: result.submissionWinner || null,
      duration: result.duration || '',
      rollResult: resolvedResult.rollResult,
    };

    const finished = {
      ...activeRoll,
      endedAt: now,
      ...resolvedResult,
      eventLog: [...(activeRoll.eventLog || []), endEvent],
    };

    const athleteId = athlete?.id;
    if (!athleteId) {
      console.error('finishRoll: no athlete id — roll not saved');
    } else {
      try {
        await db.upsertRoll({ ...finished, athleteId });
      } catch(e) {
        console.error('finishRoll save failed:', e.message);
      }
    }

    setRolls(rs => [finished, ...rs]);
    setActiveRoll(null);

    // Auto-log today as a training day
    const todayStr = new Date().toISOString().split('T')[0];
    setTrainingDays(days => days.includes(todayStr) ? days : [...days, todayStr]);
    if (athleteId) {
      db.logTrainingDay(athleteId, todayStr).catch(console.error);
    }
  };
  const togglePause = () => setActiveRoll(r => {
    if (!r) return r;
    if (!r.paused) return { ...r, paused:true, pausedAt:Date.now() };
    const extra = Date.now()-(r.pausedAt||Date.now());
    return { ...r, paused:false, pausedAt:null, totalPausedMs:(r.totalPausedMs||0)+extra };
  });
  const mutateActive = fn => setActiveRoll(r => r ? fn(r) : r);

  const trackingProps = { submissions, sweeps, positions, transitions, guardPulls, takedowns, setSubmissions, setSweeps, setPositions, setTransitions, setGuardPulls, setTakedowns, setRolls };

  if (!fontsLoaded || loading) return (
    <View style={{ flex:1, backgroundColor:C.bg, alignItems:'center', justifyContent:'center', paddingTop:TOP_INSET }}>
      <StatusBar barStyle={isDark?'light-content':'dark-content'}/>
      <GSLLogo size={56}/>
      <View style={{ width:30, height:2, backgroundColor:C.gold, marginTop:16, marginBottom:16 }}/>
      <ActivityIndicator color={C.gold} size="large"/>
      <Cap style={{ marginTop:16 }}>
        {impersonatedAthlete ? `Loading ${impersonatedAthlete.name}'s data…` : 'Loading your data…'}
      </Cap>
    </View>
  );

  // When coach is logging for an athlete, skip the profile chooser
  if (!impersonatedAthlete && (!profiles.length || !activeProfileId || showProfiles)) {
    return (
      <ProfileScreen
        profiles={profiles} activeProfileId={activeProfileId}
        onSelect={switchProfile} onNew={createProfile} onEdit={editProfile} onDelete={deleteProfile}
        confirm={confirm}/>
    );
  }

  const livePts    = activeRoll ? (activeRoll.eventLog||[]).filter(e=>e.side==='me'&&e.scored).reduce((a,e)=>a+(e.pts||0),0) : 0;
  const liveOppPts = activeRoll ? (activeRoll.eventLog||[]).filter(e=>e.side==='opp'&&e.scored).reduce((a,e)=>a+(e.pts||0),0) : 0;

  // Android status bar height offset
  const statusBarHeight = TOP_INSET;
  const theme = isDark ? DARK : LIGHT;
  // Sync global C with current theme on every render
  Object.assign(C, theme);

  return (
    <ThemeContext.Provider value={theme}>
    <View style={{ flex:1, backgroundColor:C.bg, paddingTop: statusBarHeight }}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={C.surface} translucent={false} animated/>

      {/* Impersonation banner — shown when coach is logging for an athlete */}
      {impersonatedAthlete && (
        <View style={{ backgroundColor:C.teal, paddingHorizontal:16, paddingVertical:8,
          flexDirection:'row', alignItems:'center', gap:10 }}>
          <Txt style={{ fontSize:11, fontFamily:F.semi, color:'#fff', flex:1 }}>
            📋 Logging for {impersonatedAthlete.name}
          </Txt>
          <TouchableOpacity onPress={onStopImpersonating} activeOpacity={0.75}
            style={{ borderWidth:1, borderColor:'rgba(255,255,255,0.5)', paddingHorizontal:10, paddingVertical:4 }}>
            <Txt style={{ fontSize:9, fontFamily:F.semi, color:'#fff', letterSpacing:1.5, textTransform:'uppercase' }}>
              ← Back to Dashboard
            </Txt>
          </TouchableOpacity>
        </View>
      )}
      {ConfirmDialog_}

      {/* ── Header ── */}
      <View style={{ backgroundColor:C.surface }}>
        <View style={{ borderBottomWidth:1, borderBottomColor:C.border, paddingHorizontal:12 }}>

          {/* Row 1: Logo + wordmark + controls */}
          <View style={{ flexDirection:'row', alignItems:'center', paddingTop:10, paddingBottom:8, gap:8 }}>
            {/* Logo */}
            <GSLLogo size={30}/>
            {/* Wordmark */}
            <View style={{ marginLeft:2 }}>
              <Txt style={{ fontSize:12, fontFamily:F.semi, letterSpacing:0.5, color:C.gold, lineHeight:15 }}>Grounded Skills Lab</Txt>
              <Txt style={{ fontSize:9, fontFamily:F.body, color:C.muted, lineHeight:12 }}>BJJ Analytics</Txt>
            </View>
            {/* Spacer */}
            <View style={{ flex:1 }}/>
            {/* Live score — only when rolling */}
            {activeRoll ? (
              <View style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
                <Txt style={{ fontSize:15, fontFamily:F.display, color:C.gold }}>{livePts}</Txt>
                <Cap style={{ fontSize:7 }}>–</Cap>
                <Txt style={{ fontSize:15, fontFamily:F.display, color:C.stone }}>{liveOppPts}</Txt>
              </View>
            ) : null}
            {/* Theme toggle */}
            <TouchableOpacity onPress={toggleTheme} activeOpacity={0.75}
              style={{ borderWidth:1, borderColor:C.border, backgroundColor:C.faint, paddingHorizontal:8, paddingVertical:5 }}>
              <Txt style={{ fontSize:13 }}>{isDark ? '☀️' : '🌙'}</Txt>
            </TouchableOpacity>
            {/* Coach toggle */}
            {isCoach && onSwitchToCoach && (
              <TouchableOpacity onPress={onSwitchToCoach} activeOpacity={0.75}
                style={{ borderWidth:1, borderColor:`${C.teal}66`, backgroundColor:`${C.teal}15`, paddingHorizontal:8, paddingVertical:5 }}>
                <Txt style={{ fontSize:8, fontFamily:F.semi, letterSpacing:1, textTransform:'uppercase', color:C.teal }}>Coach</Txt>
              </TouchableOpacity>
            )}
            {/* Replay tutorial */}
            <TouchableOpacity onPress={()=>setShowTutorial(true)} activeOpacity={0.75}
              style={{ borderWidth:1, borderColor:`${C.teal}55`, backgroundColor:`${C.teal}15`,
                paddingHorizontal:8, paddingVertical:5 }}>
              <Txt style={{ fontSize:9, fontFamily:F.semi, color:C.teal, letterSpacing:1,
                textTransform:'uppercase' }}>? Help</Txt>
            </TouchableOpacity>
            {/* Sign out */}
            <TouchableOpacity onPress={()=>supabase.auth.signOut()} activeOpacity={0.75}
              style={{ borderWidth:1, borderColor:C.border, backgroundColor:C.faint, paddingHorizontal:8, paddingVertical:5 }}>
              <Txt style={{ fontSize:12 }}>⏻</Txt>
            </TouchableOpacity>
          </View>

          {/* Row 2: Profile chip */}
          <TouchableOpacity onPress={()=>setShowProfiles(true)} activeOpacity={0.75}
            style={{ flexDirection:'row', alignItems:'center', gap:8, backgroundColor:C.faint,
              borderWidth:1, borderColor:C.border, paddingLeft:8, paddingRight:12,
              paddingVertical:6, marginBottom:8 }}>
            <ProfileAvatar name={activeProfile?.name||'?'} size={22} belt={activeProfile?.belt||'white'}/>
            <View style={{ flex:1 }}>
              <Txt style={{ fontSize:11, fontFamily:F.bold, lineHeight:14 }} numberOfLines={1}>{activeProfile?.name||'Set up profile'}</Txt>
              <BeltBadge belt={activeProfile?.belt||'white'} stripes={activeProfile?.stripes||0} size="sm"/>
            </View>
            <Txt style={{ fontSize:10, color:C.muted }}>▾</Txt>
          </TouchableOpacity>

          {/* Active roll pulse strip */}
          {activeRoll && (
            <View style={{ borderTopWidth:1, borderTopColor:C.border, paddingVertical:5,
              flexDirection:'row', alignItems:'center', gap:8, marginBottom:4 }}>
              <View style={{ width:6, height:6, borderRadius:3, backgroundColor:isPaused?C.amber:C.gold }}/>
              <Cap style={{ color:isPaused?C.amber:C.gold, letterSpacing:1.5 }}>{isPaused?'Paused':'Live'}{activeRoll.partner?` · ${activeRoll.partner}`:''}</Cap>
            </View>
          )}

          {/* Nav tabs */}
          <View style={{ flexDirection:'row', backgroundColor:C.surface, borderTopWidth:1, borderTopColor:C.border }}>
            {TABS.map(({ key, label, icon }) => {
              const isPending = key === 'Journal' && classLogs.filter(cl =>
                !journal.some(e => e.classLogId === cl.id) &&
                !skippedLogIds.has(cl.id)
              ).length > 0;              return (
                <TouchableOpacity key={key} onPress={()=>setTab(key)} activeOpacity={0.75}
                  style={{ flex:1, paddingVertical:9, alignItems:'center',
                    borderTopWidth:2, borderTopColor:tab===key?C.gold:'transparent',
                    backgroundColor:tab===key?C.goldDim:'transparent' }}>
                  <View style={{ position:'relative' }}>
                    <Text style={{ fontSize:18, lineHeight:22 }}>{icon}</Text>
                    {isPending && (
                      <View style={{ position:'absolute', top:-2, right:-4, width:8, height:8,
                        borderRadius:4, backgroundColor:C.teal, borderWidth:1, borderColor:C.bg }}/>
                    )}
                  </View>
                  <Text style={{ fontSize:9, fontFamily:tab===key?F.semi:F.body,
                    letterSpacing:0.5, color:tab===key?C.gold:C.muted, marginTop:2 }}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {/* ── Screens ── */}

      {/* Pending class log reminder banner — shown on Track/Charts/Rolls/Comps only */}
      {tab !== 'Journal' && tab !== 'Profiles' && (() => {
        const pending = classLogs.filter(cl =>
          !journal.some(e => e.classLogId === cl.id) &&
          !skippedLogIds.has(cl.id)
        );
        if (!pending.length) return null;
        const latest = pending[0];
        const st = SESSION_TYPES.find(s => s.key === latest.session_type) || SESSION_TYPES[0];
        return (
          <View style={{ flexDirection:'row', alignItems:'center', gap:12, backgroundColor:`${C.teal}18`,
            borderBottomWidth:1, borderBottomColor:`${C.teal}33`, paddingHorizontal:14, paddingVertical:10 }}>
            <Txt style={{ fontSize:16 }}>{st.icon}</Txt>
            <TouchableOpacity onPress={()=>setTab('Journal')} activeOpacity={0.85} style={{ flex:1 }}>
              <Txt style={{ fontSize:12, fontFamily:F.semi, color:C.teal }}>
                {pending.length === 1
                  ? `New class log — ${latest.date}`
                  : `${pending.length} unimported class logs`}
              </Txt>
              <Cap style={{ fontSize:8, color:C.teal, marginTop:2 }}>Tap to open Journal and import</Cap>
            </TouchableOpacity>
            {/* Didn't attend — permanently skips this log */}
            <TouchableOpacity onPress={async () => {
              const updated = await db.skipClassLog(
                session.user.id, latest.id, [...skippedLogIds]
              );
              setSkippedLogIds(new Set(updated));
            }} activeOpacity={0.75}
              style={{ borderWidth:1, borderColor:`${C.muted}44`, paddingHorizontal:8, paddingVertical:5,
                borderRadius:4 }}>
              <Txt style={{ fontSize:8, fontFamily:F.semi, color:C.muted }}>Didn't attend</Txt>
            </TouchableOpacity>
            {/* Dismiss for this session */}
            <TouchableOpacity onPress={async () => {
              const updated = await db.skipClassLog(
                session.user.id, latest.id, [...skippedLogIds]
              );
              setSkippedLogIds(new Set(updated));
            }} activeOpacity={0.75} style={{ padding:4 }}>
              <Txt style={{ color:C.muted, fontSize:16 }}>✕</Txt>
            </TouchableOpacity>
          </View>
        );
      })()}

      {tab==='Track' && (
        <TrackScreen
          activeRoll={activeRoll} onStartRoll={startRoll} onEndRoll={finishRoll}
          onTogglePause={togglePause} onMutate={mutateActive}
          activeProfile={activeProfile} trackingProps={trackingProps}/>
      )}
      {tab==='Academy' && (
        <AcademyScreen athlete={athlete} session={session}/>
      )}
      {tab==='Journal' && (
        <JournalScreen
          journal={journal} setJournal={setJournal}
          athlete={athlete}
          classLogs={classLogs}
          skippedLogIds={skippedLogIds}
          onLogDay={logDay}
          onSkipLog={async (logId) => {
            const updated = await db.skipClassLog(session.user.id, logId, [...skippedLogIds]);
            setSkippedLogIds(new Set(updated));
          }}
          allTechniques={[...submissions,...sweeps,...positions,...transitions,...guardPulls,...takedowns]}/>
      )}
      {tab==='Charts' && (
        <ChartsScreen
          rolls={rolls} activeRoll={activeRoll} competitions={competitions}
          submissions={submissions} sweeps={sweeps} positions={positions}
          transitions={transitions} takedowns={takedowns}
          trainingDays={trainingDays} onLogDay={logDay} onRemoveDay={removeDay}
          journal={journal}/>
      )}
      {tab==='Rolls' && (
        <RollsScreen
          rolls={rolls} activeRoll={activeRoll}
          onTogglePause={togglePause} onEndRoll={finishRoll}
          confirm={confirm} trackingProps={trackingProps}/>
      )}
      {tab==='Comps' && (
        <CompsScreen
          competitions={competitions} setCompetitions={setCompetitions}
          trackingProps={trackingProps} confirm={confirm} onLogDay={logDay}/>
      )}
      {tab==='Profiles' && (
        <ProfileScreen
          profiles={profiles} activeProfileId={activeProfileId}
          onSelect={switchProfile} onNew={createProfile} onEdit={editProfile} onDelete={deleteProfile}
          confirm={confirm}/>
      )}

      {/* Consent modal — shown before tutorial if not yet agreed */}
      {showConsent && (
        <ConsentModal
          onAgree={async()=>{
            setShowConsent(false);
            if (session?.user) await db.recordConsent(session.user.id);
          }}
          onDecline={()=>supabase.auth.signOut()}/>
      )}

      {/* Tutorial overlay — shown on first login, dismissed permanently */}
      {!showConsent && showTutorial && (
        <TutorialOverlay
          onDone={dismissTutorial}
          onSkip={dismissTutorial}/>
      )}
    </View>
    </ThemeContext.Provider>
  );
}
