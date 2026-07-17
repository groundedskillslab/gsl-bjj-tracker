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
  bg:        '#0F0F0D',
  surface:   '#161612',
  card:      '#1E1E1A',
  border:    '#2E2E28',
  borderMid: '#3E3E36',
  charcoal:  '#1C1C1E',
  stone:     '#8E8E82',
  sand:      '#DCCC86',
  offWhite:  '#F5F3EF',
  sage:      '#7A8F72',
  gold:      '#C8A24D',
  goldLight: '#E2C87A',
  goldSoft:  'rgba(200,162,77,0.15)',
  goldDim:   'rgba(200,162,77,0.08)',
  green:     '#7A8F72',
  red:       '#9B4040',
  amber:     '#B89A4A',
  amberSoft: 'rgba(184,154,74,0.15)',
  teal:      '#5A7A72',
  blue:      '#4A6280',
  opp:       '#6B5E7A',
  oppSoft:   'rgba(107,94,122,0.15)',
  oppDim:    '#3A3244',
  text:      '#F0EDE6',
  textDim:   '#C8C4BC',
  muted:     '#6A6660',
  faint:     '#252520',
};

const LIGHT = {
  bg:        '#F5F3EF',
  surface:   '#FFFFFF',
  card:      '#F0EDE8',
  border:    '#DEDAD4',
  borderMid: '#C8C4BC',
  charcoal:  '#1C1C1E',
  stone:     '#6A6660',
  sand:      '#B89A4A',
  offWhite:  '#1C1C1E',
  sage:      '#4A6E40',
  gold:      '#9A7030',
  goldLight: '#C8A24D',
  goldSoft:  'rgba(154,112,48,0.12)',
  goldDim:   'rgba(154,112,48,0.07)',
  green:     '#4A6E40',
  red:       '#8B2A2A',
  amber:     '#8A6A20',
  amberSoft: 'rgba(138,106,32,0.12)',
  teal:      '#2A5A52',
  blue:      '#2A4A6A',
  opp:       '#5A4A70',
  oppSoft:   'rgba(90,74,112,0.12)',
  oppDim:    '#E8E4F0',
  text:      '#1C1C1E',
  textDim:   '#3A3A3C',
  muted:     '#8A8680',
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
const BELT_COLORS     = { white:{bg:'#E8E4DC',text:'#1C1C1E',label:'White'}, blue:{bg:'#2A4A7A',text:'#FFFFFF',label:'Blue'}, purple:{bg:'#5A3A7A',text:'#FFFFFF',label:'Purple'}, brown:{bg:'#5A3018',text:'#FFFFFF',label:'Brown'}, black:{bg:'#1C1C1E',text:'#C8A24D',label:'Black'} };
const BELT_ORDER      = ['white','blue','purple','brown','black'];
const TABS            = ['Track','Charts','Rolls','Comps','Profiles'];

// ─── Helpers ───────────────────────────────────────────────────────────────────
const uid         = () => Math.random().toString(36).slice(2,9);
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
    // Use update if we have an id, insert otherwise
    if (athlete.id) {
      const { id, user_id, created_at, ...fields } = athlete;
      const { data, error } = await supabase
        .from('athletes')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('athletes')
        .insert(athlete)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  // ── Technique lists ───────────────────────────────────────────────────────────
  async getTechniques(athleteId) {
    const { data } = await supabase.from('technique_lists').select('*').eq('athlete_id', athleteId).single();
    return data;
  },
  async upsertTechniques(athleteId, lists) {
    await supabase.from('technique_lists').upsert({ athlete_id: athleteId, ...lists, updated_at: new Date().toISOString() });
  },

  // ── Rolls ─────────────────────────────────────────────────────────────────────
  async getRolls(athleteId) {
    const { data } = await supabase.from('rolls').select('*').eq('athlete_id', athleteId).order('started_at', { ascending: false });
    return data || [];
  },
  async upsertRoll(roll) {
    const { error } = await supabase.from('rolls').upsert(toDbRoll(roll));
    if (error) console.error('upsertRoll', error);
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
    await supabase.from('training_days').upsert({ athlete_id: athleteId, date });
  },
  async removeTrainingDay(athleteId, date) {
    await supabase.from('training_days').delete().eq('athlete_id', athleteId).eq('date', date);
  },

  // ── Competitions ──────────────────────────────────────────────────────────────
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
    rounds: (c.competition_rounds || []).map(fromDbRound),
  };
}

// ─── Typography helpers ─────────────────────────────────────────────────────────
const F = {
  light:   { fontFamily:'Outfit_400Regular' },
  regular: { fontFamily:'Outfit_400Regular' },
  semi:    { fontFamily:'Outfit_600SemiBold' },
  bold:    { fontFamily:'Outfit_700Bold' },
  extra:   { fontFamily:'Outfit_800ExtraBold' },
  black:   { fontFamily:'Outfit_900Black' },
};

// ─── Reusable style helpers ─────────────────────────────────────────────────────
const s = StyleSheet.create({
  row:    { flexDirection:'row', alignItems:'center' },
  col:    { flexDirection:'column' },
  center: { alignItems:'center', justifyContent:'center' },
  flex1:  { flex:1 },
  fill:   { position:'absolute', top:0, left:0, right:0, bottom:0 },
  card:   { backgroundColor:C.card, borderWidth:1, borderColor:C.border },
  input:  { backgroundColor:'transparent', borderBottomWidth:1, borderBottomColor:C.borderMid, color:C.text, fontSize:14, paddingVertical:10, paddingHorizontal:0, fontFamily:'Outfit_400Regular' },
  label:  { fontSize:9, letterSpacing:2, textTransform:'uppercase', color:C.muted, fontFamily:'Outfit_700Bold', marginBottom:6 },
  btn:    { minHeight:48, alignItems:'center', justifyContent:'center', paddingHorizontal:16 },
  btnGold:{ backgroundColor:C.gold, minHeight:48, alignItems:'center', justifyContent:'center', paddingHorizontal:20 },
  btnSage:{ backgroundColor:C.sage, minHeight:48, alignItems:'center', justifyContent:'center', paddingHorizontal:20 },
  btnRed: { backgroundColor:C.red,  minHeight:48, alignItems:'center', justifyContent:'center', paddingHorizontal:20 },
  btnGhost:{ borderWidth:1, borderColor:C.border, minHeight:44, alignItems:'center', justifyContent:'center', paddingHorizontal:16 },
  btnText:{ fontSize:9, letterSpacing:2.5, textTransform:'uppercase', fontFamily:'Outfit_800ExtraBold' },
  tag:    { borderWidth:1, paddingHorizontal:6, paddingVertical:2 },
});

// ─── Primitive UI components ────────────────────────────────────────────────────
const Txt  = ({ style, ...p }) => <Text style={[{ fontFamily:'Outfit_400Regular', color:C.text }, style]} {...p}/>;
const Cap  = ({ style, ...p }) => <Text style={[{ fontFamily:'Outfit_700Bold', fontSize:9, letterSpacing:2, textTransform:'uppercase', color:C.muted }, style]} {...p}/>;
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
      <Txt style={{ fontSize:8, fontFamily:'Outfit_700Bold', letterSpacing:1.5,
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
      <Txt style={{ fontSize:9, letterSpacing:2.5, textTransform:'uppercase', fontFamily:'Outfit_800ExtraBold', color: outline ? C.muted : textColor }}>{label}</Txt>
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
              <Txt style={{ fontSize:9, letterSpacing:2, textTransform:'uppercase', fontFamily:'Outfit_700Bold', color:C.muted }}>Cancel</Txt>
            </TouchableOpacity>
            <TouchableOpacity onPress={onConfirm} activeOpacity={0.75} style={[{ flex:1, minHeight:44, alignItems:'center', justifyContent:'center', backgroundColor:confirmColor }]}>
              <Txt style={{ fontSize:9, letterSpacing:2, textTransform:'uppercase', fontFamily:'Outfit_800ExtraBold', color:C.offWhite }}>{confirmLabel}</Txt>
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
        <Txt style={{ fontSize:size==='lg'?9:7, fontFamily:'Outfit_800ExtraBold', letterSpacing:2, textTransform:'uppercase', color:bc.text }}>{bc.label}</Txt>
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
      <Txt style={{ fontSize:size*0.38, fontFamily:'Outfit_900Black', color:bc.text }}>{initials}</Txt>
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
            <Txt style={{ fontSize:10, color:sl.color, fontFamily:'Outfit_700Bold' }}>{fmt(sl.value)}</Txt>
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
        <Txt style={{ fontSize:22, fontFamily:'Outfit_900Black', color:C.gold, lineHeight:26 }}>{myPts}</Txt>
        <Cap style={{ fontSize:7, color:C.muted }}>You</Cap>
        {myAdv>0&&<Txt style={{fontSize:8,color:C.sand,fontFamily:'Outfit_700Bold'}}>+{myAdv} adv</Txt>}
      </View>
      <Txt style={{ fontSize:11, color:C.border, fontFamily:'Outfit_700Bold', marginHorizontal:10 }}>—</Txt>
      <View style={{ backgroundColor:C.oppSoft, borderWidth:1, borderColor:`${C.opp}33`, paddingHorizontal:10, paddingVertical:6, alignItems:'center', minWidth:52 }}>
        <Txt style={{ fontSize:22, fontFamily:'Outfit_900Black', color:C.stone, lineHeight:26 }}>{opPts}</Txt>
        <Cap style={{ fontSize:7, color:C.muted }}>Opp</Cap>
        {opAdv>0&&<Txt style={{fontSize:8,color:C.sand,fontFamily:'Outfit_700Bold'}}>+{opAdv} adv</Txt>}
      </View>
    </View>
  );
  return (
    <View style={{ borderWidth:1, borderColor:C.border }}>
      {/* Main score header */}
      <View style={{ flexDirection:'row' }}>
        <View style={{ flex:1, backgroundColor:C.faint, padding:16, borderRightWidth:1, borderRightColor:C.border }}>
          <Cap style={{ marginBottom:4 }}>You</Cap>
          <Txt style={{ fontSize:40, fontFamily:'Outfit_900Black', color:C.gold, lineHeight:44 }}>{myPts}</Txt>
          {myAdv>0 && <Txt style={{fontSize:10,color:C.sand,fontFamily:'Outfit_700Bold',marginTop:2}}>{myAdv} advantage{myAdv!==1?'s':''}</Txt>}
          {myGP>0  && <Txt style={{fontSize:10,color:C.sage,fontFamily:'Outfit_700Bold',marginTop:1}}>{myGP} guard pull{myGP!==1?'s':''}</Txt>}
        </View>
        <View style={{ flex:1, backgroundColor:C.faint, padding:16, alignItems:'flex-end' }}>
          <Cap style={{ marginBottom:4 }}>Opponent</Cap>
          <Txt style={{ fontSize:40, fontFamily:'Outfit_900Black', color:C.stone, lineHeight:44 }}>{opPts}</Txt>
          {opAdv>0 && <Txt style={{fontSize:10,color:C.sand,fontFamily:'Outfit_700Bold',marginTop:2,textAlign:'right'}}>{opAdv} advantage{opAdv!==1?'s':''}</Txt>}
          {opGP>0  && <Txt style={{fontSize:10,color:C.sage,fontFamily:'Outfit_700Bold',marginTop:1,textAlign:'right'}}>{opGP} guard pull{opGP!==1?'s':''}</Txt>}
        </View>
      </View>
      {/* Point-scoring rows */}
      {ptRows.map((row,i) => (
        <View key={row.key} style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:10, borderTopWidth:1, borderTopColor:C.border }}>
          <Txt style={{ width:36, fontSize:16, fontFamily:'Outfit_900Black', color:row.myPts>0?C.gold:C.faint }}>{row.myPts||'—'}</Txt>
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
          <Txt style={{ width:36, fontSize:16, fontFamily:'Outfit_900Black', color:row.opPts>0?C.opp:C.faint, textAlign:'right' }}>{row.opPts||'—'}</Txt>
        </View>
      ))}
      {/* Advantages row — shown if any */}
      {(myAdv>0||opAdv>0) && (
        <View style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:10, borderTopWidth:1, borderTopColor:C.border, backgroundColor:`${C.sand}08` }}>
          <Txt style={{ width:36, fontSize:16, fontFamily:'Outfit_900Black', color:myAdv>0?C.sand:C.faint }}>{myAdv||'—'}</Txt>
          <View style={{ flex:1 }}>
            <Cap style={{ textAlign:'center', marginBottom:4, color:C.sand }}>Advantages</Cap>
            <View style={{ flexDirection:'row', height:3, backgroundColor:C.faint }}>
              <View style={{ flex:myAdv||0, backgroundColor:C.sand, minWidth:myAdv>0?4:0 }}/>
              <View style={{ flex:opAdv||0, backgroundColor:C.opp, minWidth:opAdv>0?4:0 }}/>
            </View>
          </View>
          <Txt style={{ width:36, fontSize:16, fontFamily:'Outfit_900Black', color:opAdv>0?C.opp:C.faint, textAlign:'right' }}>{opAdv||'—'}</Txt>
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
                    <Txt style={{ fontSize:14, fontFamily:'Outfit_800ExtraBold', color:C.text }}>{ev.submissionName}</Txt>
                  ) : null}
                  {isSub && ev.submissionWinner ? (
                    <View style={{ marginTop:5, flexDirection:'row' }}>
                      <View style={{ borderWidth:1, borderColor:`${ev.submissionWinner==='me'?C.sage:C.red}55`, paddingHorizontal:7, paddingVertical:3 }}>
                        <Txt style={{ fontSize:9, fontFamily:'Outfit_700Bold', letterSpacing:1.5, textTransform:'uppercase', color:ev.submissionWinner==='me'?C.sage:C.red }}>
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
                <Txt style={{ fontSize:13, fontFamily:'Outfit_600SemiBold' }}>{ev.label||ev.item}</Txt>
                {ev.scored && ev.pts > 0 && (
                  <View style={{ marginLeft:8, borderWidth:1, borderColor:`${sc}44`, paddingHorizontal:5, paddingVertical:1 }}>
                    <Txt style={{ fontSize:8, color:sc, fontFamily:'Outfit_700Bold', letterSpacing:1.5 }}>+{ev.pts} PTS</Txt>
                  </View>
                )}
                {ev.scored && ev.pts === 0 && (
                  <View style={{ marginLeft:8, borderWidth:1, borderColor:`${C.sand}44`, paddingHorizontal:5, paddingVertical:1 }}>
                    <Txt style={{ fontSize:8, color:C.sand, fontFamily:'Outfit_700Bold', letterSpacing:1.5 }}>ADV</Txt>
                  </View>
                )}
              </View>
              {contextStr ? <Txt style={{ fontSize:10, color:C.teal, marginTop:3, fontFamily:'Outfit_600SemiBold' }}>{contextStr}</Txt> : null}
              <View style={{ flexDirection:'row', marginTop:4 }}>
                <View style={{ borderWidth:1, borderColor:`${tc}33`, paddingHorizontal:4, paddingVertical:1, marginRight:8 }}>
                  <Txt style={{ fontSize:8, color:tc, letterSpacing:1.5, textTransform:'uppercase', fontFamily:'Outfit_700Bold' }}>{ev.type}</Txt>
                </View>
                <Txt style={{ fontSize:9, color:C.muted }}>{ev.side==='me'?'You':'Opp'} · {fmtTime(ev.ts)}</Txt>
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

  // OptionList: scrollable items + pinned custom input OUTSIDE the scroll
  const OptionList = ({ items, onPick, pts, accent, showPts=true }) => {
    // Predictive suggestions: match custom input against all known techniques
    const suggestions = customVal.trim().length > 0
      ? allTechniques.filter(t =>
          t.toLowerCase().includes(customVal.toLowerCase()) &&
          !items.includes(t) // don't show if already in main list
        ).slice(0, 5)
      : [];

    return (
    <View style={{ flex:1 }}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always">
        {items.map(item => (
          <TouchableOpacity key={item} onPress={()=>{ setShowCustom(false); onPick(item); }} activeOpacity={0.75}
            style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:12, marginBottom:4, borderWidth:1, borderColor:C.border }}>
            <Txt style={{ fontSize:13, color:C.textDim, flex:1 }}>{item}</Txt>
            {showPts && pts !== undefined && (
              <View style={{ borderWidth:1, borderColor:`${accent}44`, paddingHorizontal:7, paddingVertical:2, marginLeft:8 }}>
                <Txt style={{ fontSize:9, color:accent, fontFamily:'Outfit_700Bold', letterSpacing:1.5 }}>{pts>0?`+${pts} PTS`:'0 PTS'}</Txt>
              </View>
            )}
          </TouchableOpacity>
        ))}
        <View style={{ height:8 }}/>
      </ScrollView>

      {/* Pinned custom input + predictive suggestions */}
      {!showCustom ? (
        <TouchableOpacity onPress={openCustom} activeOpacity={0.75}
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
                  <TouchableOpacity key={s} onPress={()=>{ setCustomVal(''); setShowCustom(false); onPick(s); }}
                    activeOpacity={0.75}
                    style={{ borderWidth:1, borderColor:`${accent}55`, backgroundColor:`${accent}12`,
                      paddingHorizontal:10, paddingVertical:7, flexDirection:'row', alignItems:'center', gap:4 }}>
                    <Txt style={{ fontSize:9, color:accent }}>↑</Txt>
                    <Txt style={{ fontSize:11, color:accent, fontFamily:'Outfit_600SemiBold' }}>{s}</Txt>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          {/* Text input */}
          <View style={{ flexDirection:'row', alignItems:'center', borderWidth:2, borderColor:accent }}>
            <TextInput
              ref={inputRef}
              value={customVal}
              onChangeText={setCustomVal}
              placeholder="e.g. Calf Slicer, Twister…"
              placeholderTextColor={C.muted}
              returnKeyType="done"
              blurOnSubmit={false}
              onSubmitEditing={()=>{ if(customVal.trim()) onPick(customVal.trim()); }}
              style={{ flex:1, color:C.text, fontSize:14, fontFamily:'Outfit_400Regular',
                paddingVertical:14, paddingHorizontal:14 }}
            />
            <TouchableOpacity
              onPress={()=>{ if(customVal.trim()) onPick(customVal.trim()); }}
              disabled={!customVal.trim()} activeOpacity={0.75}
              style={{ backgroundColor:customVal.trim()?accent:C.faint,
                paddingHorizontal:16, paddingVertical:14 }}>
              <Txt style={{ fontSize:9, fontFamily:'Outfit_900Black',
                color:customVal.trim()?'#0F0F0D':C.muted, letterSpacing:1.5, textTransform:'uppercase' }}>Add</Txt>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={()=>{ setShowCustom(false); setCustomVal(''); }}
            style={{ paddingVertical:10, alignItems:'center' }} activeOpacity={0.7}>
            <Cap style={{ color:C.muted }}>Cancel</Cap>
          </TouchableOpacity>
        </View>
      )}
    </View>
    );
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
                  <Txt style={{ fontSize:14, fontFamily:'Outfit_700Bold', color:ac }}>{stepHeaders[step]||'Record Score'}</Txt>
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
                      <Txt style={{ fontSize:13, fontFamily:'Outfit_700Bold' }}>{ev.label}</Txt>
                      <Cap style={{ marginTop:2, fontSize:8 }}>{ev.desc}</Cap>
                    </View>
                    <View style={{ borderWidth:1, borderColor:`${ev.color}44`, paddingHorizontal:8, paddingVertical:3 }}>
                      <Txt style={{ fontSize:9, color:ev.color, fontFamily:'Outfit_700Bold', letterSpacing:2 }}>{ev.pts>0?`+${ev.pts} PTS`:'ADV'}</Txt>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {step==='sweep_startPos' && <OptionList items={DEF_POS} accent={ac} showPts={false}
              onPick={pos=>{ setSel1(pos); setStep('sweep_tech'); setShowCustom(false); setCustomVal(''); }}/>}
            {step==='sweep_tech'     && <OptionList items={DEF_SWEEPS} pts={2} accent={ac}
              onPick={tech=>finish('sweep', { technique:tech, fromPosition:sel1 })}/>}
            {step==='td_technique'   && <OptionList items={DEF_TAKEDOWNS} accent={ac} showPts={false}
              onPick={tech=>{ setSel1(tech); setStep('td_endPos'); setShowCustom(false); setCustomVal(''); }}/>}
            {step==='td_endPos'      && <OptionList items={DEF_POS} pts={2} accent={ac}
              onPick={pos=>finish('takedown', { technique:sel1, toPosition:pos })}/>}
            {step==='gp_guardType'   && <OptionList items={DEF_GUARD_TYPES} accent={ac} showPts={false}
              onPick={guard=>{ setSel1(guard); setStep('gp_technique'); setShowCustom(false); setCustomVal(''); }}/>}
            {step==='gp_technique'   && <OptionList items={DEF_GUARD_PASSES} pts={3} accent={ac}
              onPick={tech=>finish('guardPass', { guardPassed:sel1, technique:tech })}/>}
            {step==='pull_endPos'    && <OptionList items={DEF_POS} pts={0} accent={ac}
              onPick={pos=>finish('guardPull', { toPosition:pos })}/>}
            {step==='adv_type'       && <OptionList items={ADV_TYPES} pts={0} accent={ac}
              onPick={type=>finish('advantage', { advType:type })}/>}

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
        <Txt style={{ fontSize:26, fontFamily:'Outfit_900Black', color:count>0?ac:C.border, lineHeight:32 }}>{count}</Txt>
      </View>
      <TouchableOpacity onPress={()=>!disabled&&onAdd(item)} activeOpacity={0.7} style={{ paddingHorizontal:14, paddingVertical:10, backgroundColor:disabled?C.faint:ac, alignItems:'center', justifyContent:'center' }}>
        <Txt style={{ fontSize:20, fontFamily:'Outfit_700Bold', color:disabled?C.muted:'#0F0F0D' }}>+</Txt>
      </TouchableOpacity>
    </View>
  );
}

// ─── Opp Toggle ─────────────────────────────────────────────────────────────────
function OppToggle({ isOpp, onChange }) {
  return (
    <View style={{ flexDirection:'row', borderWidth:1, borderColor:C.border, marginBottom:14 }}>
      <TouchableOpacity onPress={()=>onChange(false)} activeOpacity={0.75} style={{ flex:1, paddingVertical:10, alignItems:'center', backgroundColor:!isOpp?C.gold:'transparent' }}>
        <Txt style={{ fontSize:9, fontFamily:'Outfit_700Bold', letterSpacing:2, textTransform:'uppercase', color:!isOpp?'#0F0F0D':C.muted }}>You</Txt>
      </TouchableOpacity>
      <View style={{ width:1, backgroundColor:C.border }}/>
      <TouchableOpacity onPress={()=>onChange(true)} activeOpacity={0.75} style={{ flex:1, paddingVertical:10, alignItems:'center', backgroundColor:isOpp?C.opp:'transparent' }}>
        <Txt style={{ fontSize:9, fontFamily:'Outfit_700Bold', letterSpacing:2, textTransform:'uppercase', color:isOpp?C.offWhite:C.muted }}>Opponent</Txt>
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
      <Txt style={{ fontSize:9, fontFamily:'Outfit_700Bold', letterSpacing:2, textTransform:'uppercase', color:isPaused?C.amber:C.muted }}>{isPaused?'▶ Resume':'⏸ Pause'}</Txt>
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
              <Txt style={{ fontSize:10, fontFamily:'Outfit_700Bold', letterSpacing:1.5, textTransform:'uppercase', color:isOn?'#0F0F0D':C.text }}>
                {isOn?'◼ ':'▶ '}{pos}
                {pv>0&&!isOn&&<Txt style={{ fontSize:8, color:pc, fontFamily:'Outfit_700Bold' }}> +{pv}PTS</Txt>}
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
          <Txt style={{ fontSize:28, fontFamily:'Outfit_900Black', color:C.gold, lineHeight:32 }}>{myPts}</Txt>
          <Cap style={{ color:C.gold, fontSize:7 }}>Score</Cap>
        </TouchableOpacity>
        <View style={{ alignItems:'center', justifyContent:'center', paddingHorizontal:8 }}>
          <Txt style={{ fontSize:9, color:C.border, letterSpacing:2 }}>{isPaused?'PAUSED':'VS'}</Txt>
        </View>
        <TouchableOpacity onPress={()=>setScoreSheet('opp')} activeOpacity={0.75}
          style={{ flex:1, backgroundColor:C.oppSoft, borderWidth:1, borderColor:`${C.opp}33`, paddingVertical:12, alignItems:'center', opacity:isPaused?0.4:1 }}>
          <Cap style={{ color:C.stone, marginBottom:2 }}>Opponent</Cap>
          <Txt style={{ fontSize:28, fontFamily:'Outfit_900Black', color:C.stone, lineHeight:32 }}>{oppPts}</Txt>
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
            <Txt style={{ fontSize:9, fontFamily:subTab===t?'Outfit_700Bold':'Outfit_400Regular', color:subTab===t?C.gold:C.muted, letterSpacing:1.5, textTransform:'uppercase' }}>{t}</Txt>
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
            <Txt style={{ fontSize:16, fontFamily:'Outfit_800ExtraBold', marginBottom:20 }}>Start New Roll</Txt>
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
      <Txt style={{ fontSize:10, fontFamily:'Outfit_800ExtraBold', letterSpacing:1.5, textTransform:'uppercase', color:endType===type?C.gold:C.textDim, marginBottom:4 }}>{label}</Txt>
      <Txt style={{ fontSize:9, color:C.muted, lineHeight:14 }}>{desc}</Txt>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={()=>{ onCancel(); reset(); }}>
      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios'?'padding':'height'}>
        <ScrollView contentContainerStyle={{ flexGrow:1, backgroundColor:'rgba(10,10,8,0.9)', alignItems:'center', justifyContent:'center', padding:24 }}>
          <View style={{ backgroundColor:C.surface, borderWidth:1, borderColor:C.borderMid, width:'100%', maxWidth:400, padding:24 }}>
            <Cap style={{ marginBottom:4 }}>Grounded Skills Lab</Cap>
            <Txt style={{ fontSize:16, fontFamily:'Outfit_800ExtraBold', marginBottom:20 }}>How did it end?</Txt>
            <View style={{ flexDirection:'row', gap:8, marginBottom:20 }}>
              <ETBtn type="time" icon="⏱" label="Time Expired" desc="Match ended on the clock"/>
              <ETBtn type="submission" icon="🔒" label="Submission" desc="Someone tapped out"/>
            </View>
            {endType==='time' && <FieldInput label="Duration (optional)" value={duration} onChangeText={setDuration} placeholder="e.g. 6:00"/>}
            {endType==='submission' && (
              <>
                {/* Submission result — overrides points regardless */}
                <View style={{ borderWidth:1, borderColor:`${C.gold}44`, backgroundColor:C.goldDim, padding:10, marginBottom:14 }}>
                  <Txt style={{ fontSize:9, color:C.gold, fontFamily:'Outfit_700Bold', letterSpacing:1.5, textTransform:'uppercase', marginBottom:2 }}>⚡ Submission overrides points</Txt>
                  <Txt style={{ fontSize:11, color:C.textDim }}>Whoever gets the submission wins — regardless of score.</Txt>
                </View>
                <Cap style={{ marginBottom:8 }}>Who got the submission?</Cap>
                <View style={{ flexDirection:'row', gap:8, marginBottom:16 }}>
                  {[['me','I submitted them','WIN'],['opp','I was submitted','LOSS']].map(([val,lbl,outcome]) => (
                    <TouchableOpacity key={val} onPress={()=>setWinner(val)} activeOpacity={0.75}
                      style={{ flex:1, paddingVertical:12, borderWidth:2, borderColor:winner===val?(val==='me'?C.sage:C.red):C.border, alignItems:'center', backgroundColor:winner===val?(val==='me'?`${C.sage}18`:`${C.red}18`):'transparent' }}>
                      <Txt style={{ fontSize:11, fontFamily:'Outfit_900Black', color:winner===val?(val==='me'?C.sage:C.red):C.muted, marginBottom:3 }}>{outcome}</Txt>
                      <Txt style={{ fontSize:9, fontFamily:'Outfit_700Bold', letterSpacing:1, textTransform:'uppercase', color:winner===val?(val==='me'?C.sage:C.red):C.muted }}>{lbl}</Txt>
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
                      s.toLowerCase().includes(customSub.toLowerCase())
                    ).length > 0 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}
                        keyboardShouldPersistTaps="always" style={{ marginBottom:8 }}>
                        <View style={{ flexDirection:'row', gap:6 }}>
                          {submissions.filter(s =>
                            s.toLowerCase().includes(customSub.toLowerCase())
                          ).slice(0,5).map(s => (
                            <TouchableOpacity key={s} onPress={()=>{ setSubName(s); setCustomSub(''); setShowC(false); }}
                              activeOpacity={0.75}
                              style={{ borderWidth:1, borderColor:`${C.red}55`, backgroundColor:`${C.red}12`,
                                paddingHorizontal:10, paddingVertical:7, flexDirection:'row', alignItems:'center', gap:4 }}>
                              <Txt style={{ fontSize:9, color:C.red }}>↑</Txt>
                              <Txt style={{ fontSize:11, color:C.red, fontFamily:'Outfit_600SemiBold' }}>{s}</Txt>
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
                <Txt style={{ fontSize:9, fontFamily:'Outfit_800ExtraBold', letterSpacing:2.5, textTransform:'uppercase', color:canSave?C.offWhite:C.muted }}>Save Roll</Txt>
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
  // Use stored rollResult if available (handles submission wins regardless of points)
  const res = roll.rollResult ? (roll.rollResult==='win'?'W':roll.rollResult==='loss'?'L':'D') : (myPts>oppPts?'W':myPts<oppPts?'L':'T');
  const rc  = res==='W'?C.sage:res==='L'?C.red:C.amber;
  const isSub = roll.endType==='submission';
  return (
    <View style={{ flexDirection:'row', borderWidth:1, borderColor:C.border, marginBottom:8 }}>
      <View style={{ width:3, backgroundColor:rc }}/>
      <TouchableOpacity onPress={()=>onView(roll)} activeOpacity={0.75} style={{ flex:1, padding:14 }}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' }}>
          <View style={{ flex:1 }}>
            <Txt style={{ fontSize:14, fontFamily:'Outfit_700Bold' }}>Roll {String(index).padStart(2,'0')}{roll.partner?<Txt style={{ color:C.muted, fontFamily:'Outfit_400Regular' }}> · {roll.partner}</Txt>:''}</Txt>
            <Txt style={{ fontSize:9, color:C.muted, marginTop:2 }}>{fmtDateTime(roll.startedAt)}</Txt>
          </View>
          <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginLeft:8 }}>
            <View style={{ alignItems:'center' }}><Txt style={{ fontSize:20, fontFamily:'Outfit_900Black', color:C.gold, lineHeight:24 }}>{myPts}</Txt><Cap style={{ fontSize:7 }}>You</Cap></View>
            <Txt style={{ color:C.border }}>·</Txt>
            <View style={{ alignItems:'center' }}><Txt style={{ fontSize:20, fontFamily:'Outfit_900Black', color:C.stone, lineHeight:24 }}>{oppPts}</Txt><Cap style={{ fontSize:7 }}>Opp</Cap></View>
          </View>
        </View>
        <View style={{ flexDirection:'row', marginTop:10, alignItems:'center' }}>
          {totalPos>0 && <Txt style={{ fontSize:11, color:C.textDim, marginRight:14 }}>{fmtSecs(totalPos)} <Cap style={{ fontSize:8 }}>mat</Cap></Txt>}
          {isSub && <View style={{ borderWidth:1, borderColor:`${C.red}44`, paddingHorizontal:6, paddingVertical:2, marginRight:6 }}>
            <Txt style={{ fontSize:8, fontFamily:'Outfit_700Bold', color:C.red, letterSpacing:1 }}>🔒 SUB</Txt>
          </View>}
          <View style={{ marginLeft:'auto', borderWidth:1, borderColor:`${rc}44`, paddingHorizontal:8, paddingVertical:3 }}>
            <Txt style={{ fontSize:9, fontFamily:'Outfit_700Bold', color:rc, letterSpacing:2 }}>{res==='W'?'WIN':res==='L'?'LOSS':'DRAW'}</Txt>
          </View>
        </View>
      </TouchableOpacity>
      <TouchableOpacity onPress={async()=>{ const ok = await confirm('Delete this roll?'); if(ok) onDelete(roll.id); }} activeOpacity={0.75}
        style={{ borderLeftWidth:1, borderLeftColor:C.border, paddingHorizontal:14, alignItems:'center', justifyContent:'center' }}>
        <Txt style={{ color:C.muted, fontSize:16 }}>✕</Txt>
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
          <Txt style={{ fontSize:9, fontFamily:'Outfit_700Bold', color:C.gold, letterSpacing:2, textTransform:'uppercase' }}>+ New</Txt>
        </TouchableOpacity>
      </View>
      {comps.map(comp => {
        const wins=comp.rounds.filter(r=>r.result==='win').length;
        const losses=comp.rounds.filter(r=>r.result==='loss').length;
        const draws=comp.rounds.filter(r=>r.result==='draw').length;
        const ov=wins>losses?'W':losses>wins?'L':comp.rounds.length>0?'D':null;
        const oc=wins>losses?C.sage:losses>wins?C.red:C.amber;
        return (
          <TouchableOpacity key={comp.id} onPress={()=>onSelect(comp.id)} activeOpacity={0.75}
            style={{ borderWidth:1, borderColor:C.border, marginBottom:8 }}>
            <View style={{ flexDirection:'row', alignItems:'flex-start', padding:14 }}>
              <View style={{ flex:1 }}>
                <Txt style={{ fontSize:14, fontFamily:'Outfit_800ExtraBold' }}>{comp.name}</Txt>
                <Txt style={{ fontSize:9, color:C.muted, marginTop:2, textTransform:'uppercase', letterSpacing:1 }}>{fmtCompDate(comp.date)}{comp.location?` · ${comp.location}`:''} · {comp.gi}</Txt>
                <View style={{ flexDirection:'row', gap:14, marginTop:10 }}>
                  {[['W',wins,C.sage],['L',losses,C.red],['D',draws,C.amber],['Rounds',comp.rounds.length,C.muted]].map(([lbl,val,clr])=>(
                    <View key={lbl} style={{ alignItems:'center' }}>
                      <Txt style={{ fontSize:16, fontFamily:'Outfit_900Black', color:val>0?clr:C.border }}>{val}</Txt>
                      <Cap style={{ fontSize:7 }}>{lbl}</Cap>
                    </View>
                  ))}
                </View>
              </View>
              {ov && <View style={{ borderWidth:1, borderColor:`${oc}44`, paddingHorizontal:12, paddingVertical:6, alignItems:'center', marginLeft:12 }}>
                <Txt style={{ fontSize:18, fontFamily:'Outfit_900Black', color:oc }}>{ov}</Txt>
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
            <Txt style={{ fontSize:11, fontFamily:'Outfit_900Black', letterSpacing:3, textTransform:'uppercase', color:C.text, lineHeight:15 }}>Grounded Skills Lab</Txt>
            <View style={{ flexDirection:'row', alignItems:'center', gap:6, marginTop:4 }}>
              <View style={{ width:16, height:1, backgroundColor:C.gold }}/>
              <Cap style={{ fontSize:7, color:C.gold, letterSpacing:2 }}>Select Profile</Cap>
            </View>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:20 }}>
        <Txt style={{ fontSize:9, color:C.muted, letterSpacing:3, textTransform:'uppercase', marginBottom:4 }}>Who's training today?</Txt>
        <Txt style={{ fontSize:22, fontFamily:'Outfit_900Black', marginBottom:24 }}>Choose your profile.</Txt>

        {profiles.map(p => {
          const isActive = p.id === activeProfileId;
          return (
            <TouchableOpacity key={p.id} onPress={()=>onSelect(p.id)} activeOpacity={0.75}
              style={{ flexDirection:'row', alignItems:'center', padding:14, marginBottom:8, borderWidth:2, borderColor:isActive?C.gold:C.border, backgroundColor:isActive?C.goldDim:C.card }}>
              <ProfileAvatar name={p.name} size={44} belt={p.belt||'white'}/>
              <View style={{ flex:1, marginLeft:14 }}>
                <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:5 }}>
                  <Txt style={{ fontSize:14, fontFamily:'Outfit_800ExtraBold', color:isActive?C.gold:C.text }}>{p.name}</Txt>
                  {isActive && <View style={{ borderWidth:1, borderColor:`${C.gold}44`, paddingHorizontal:5, paddingVertical:1 }}><Txt style={{ fontSize:7, color:C.gold, letterSpacing:2, textTransform:'uppercase', fontFamily:'Outfit_700Bold' }}>Active</Txt></View>}
                </View>
                <BeltBadge belt={p.belt||'white'} stripes={p.stripes||0} size="sm"/>
                {p.gym && <Txt style={{ fontSize:9, color:C.muted, marginTop:4 }}>{p.gym}</Txt>}
              </View>
              <View style={{ flexDirection:'row', gap:6 }}>
                <TouchableOpacity onPress={e=>{ e.stopPropagation?.(); setEditingProfile(p); }} activeOpacity={0.75}
                  style={{ borderWidth:1, borderColor:C.border, paddingHorizontal:10, paddingVertical:6 }}>
                  <Txt style={{ fontSize:8, color:C.muted, letterSpacing:1.5, textTransform:'uppercase', fontFamily:'Outfit_700Bold' }}>Edit</Txt>
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
  const save = () => { if(!name.trim()) return; onSave({ ...(initial||{}), id:initial?.id||uid(), name:name.trim(), belt, stripes, gym:gym.trim(), createdAt:initial?.createdAt||Date.now() }); };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios'?'padding':'height'}>
        <ScrollView contentContainerStyle={{ flexGrow:1, backgroundColor:'rgba(10,10,8,0.97)', alignItems:'center', justifyContent:'center', padding:24 }}>
          <View style={{ backgroundColor:C.surface, borderWidth:1, borderColor:C.borderMid, width:'100%', maxWidth:400, padding:24 }}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
              <View>
                <Cap style={{ marginBottom:4 }}>Grounded Skills Lab</Cap>
                <Txt style={{ fontSize:16, fontFamily:'Outfit_800ExtraBold' }}>{initial?'Edit Profile':'New Profile'}</Txt>
              </View>
              <TouchableOpacity onPress={onCancel} activeOpacity={0.75} style={{ width:32, height:32, borderWidth:1, borderColor:C.border, alignItems:'center', justifyContent:'center' }}>
                <Txt style={{ color:C.muted }}>✕</Txt>
              </TouchableOpacity>
            </View>

            {/* Live preview */}
            <View style={{ flexDirection:'row', alignItems:'center', gap:14, padding:14, borderWidth:1, borderColor:C.border, backgroundColor:C.faint, marginBottom:20 }}>
              <ProfileAvatar name={name||'?'} size={44} belt={belt}/>
              <View>
                <Txt style={{ fontSize:14, fontFamily:'Outfit_800ExtraBold', marginBottom:5 }}>{name||'Athlete Name'}</Txt>
                <BeltBadge belt={belt} stripes={stripes} size="sm"/>
                {gym ? <Txt style={{ fontSize:9, color:C.muted, marginTop:4 }}>{gym}</Txt> : null}
              </View>
            </View>

            <FieldInput label="Full Name *" value={name} onChangeText={setName} placeholder="First Last"/>
            <View style={{ marginBottom:14 }}>
              <Cap style={{ marginBottom:8 }}>Belt</Cap>
              <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6 }}>
                {BELT_ORDER.map(b => { const bc=BELT_COLORS[b]; return (
                  <TouchableOpacity key={b} onPress={()=>setBelt(b)} activeOpacity={0.75}
                    style={{ paddingVertical:8, paddingHorizontal:12, borderWidth:2, borderColor:belt===b?C.gold:C.border, backgroundColor:belt===b?bc.bg:C.faint }}>
                    <Txt style={{ fontSize:8, fontFamily:'Outfit_800ExtraBold', letterSpacing:1.5, textTransform:'uppercase', color:belt===b?bc.text:C.muted }}>{bc.label}</Txt>
                  </TouchableOpacity>
                ); })}
              </View>
            </View>
            <View style={{ marginBottom:14 }}>
              <Cap style={{ marginBottom:8 }}>Stripes ({stripes})</Cap>
              <View style={{ flexDirection:'row', gap:6 }}>
                {[0,1,2,3,4].map(n => (
                  <TouchableOpacity key={n} onPress={()=>setStripes(n)} activeOpacity={0.75} style={{ flex:1, minHeight:40, borderWidth:1, borderColor:stripes===n?C.gold:C.border, backgroundColor:stripes===n?C.goldDim:'transparent', alignItems:'center', justifyContent:'center' }}>
                    <Txt style={{ fontSize:13, fontFamily:'Outfit_700Bold', color:stripes===n?C.gold:C.muted }}>{n}</Txt>
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
  const [name,     setName]     = useState(initial?.name||'');
  const [location, setLocation] = useState(initial?.location||'');
  const [gi,       setGi]       = useState(initial?.gi||'Gi');
  const [weight,   setWeight]   = useState(initial?.weightClass||'Middle');
  useEffect(() => { if(visible){ setName(initial?.name||''); setLocation(initial?.location||''); setGi(initial?.gi||'Gi'); setWeight(initial?.weightClass||'Middle'); }}, [visible]);
  const save = () => { if(!name.trim()) return; onSave({ ...(initial||{}), id:initial?.id||uid(), name:name.trim(), location:location.trim(), gi, weightClass:weight, rounds:initial?.rounds||[], createdAt:initial?.createdAt||Date.now() }); };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios'?'padding':'height'}>
        <ScrollView contentContainerStyle={{ flexGrow:1, backgroundColor:'rgba(10,10,8,0.9)', alignItems:'center', justifyContent:'center', padding:24 }}>
          <View style={{ backgroundColor:C.surface, borderWidth:1, borderColor:C.borderMid, width:'100%', maxWidth:400, padding:24 }}>
            <Cap style={{ marginBottom:4 }}>Grounded Skills Lab</Cap>
            <Txt style={{ fontSize:16, fontFamily:'Outfit_800ExtraBold', marginBottom:20 }}>{initial?'Edit Competition':'New Competition'}</Txt>
            <FieldInput label="Competition Name *" value={name} onChangeText={setName} placeholder="e.g. IBJJF Pan Championship"/>
            <FieldInput label="Location" value={location} onChangeText={setLocation} placeholder="City, State"/>
            <View style={{ flexDirection:'row', gap:12, marginBottom:16 }}>
              <View style={{ flex:1 }}>
                <Cap style={{ marginBottom:8 }}>Format</Cap>
                <View style={{ flexDirection:'row', gap:6 }}>
                  {GI_OPTIONS.map(g=>(
                    <TouchableOpacity key={g} onPress={()=>setGi(g)} activeOpacity={0.75}
                      style={{ flex:1, borderWidth:1, borderColor:gi===g?C.gold:C.border, backgroundColor:gi===g?C.goldDim:'transparent', paddingVertical:10, alignItems:'center' }}>
                      <Txt style={{ fontSize:11, fontFamily:'Outfit_700Bold', color:gi===g?C.gold:C.muted }}>{g}</Txt>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            <View style={{ marginBottom:20 }}>
              <Cap style={{ marginBottom:8 }}>Weight Class</Cap>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection:'row', gap:6 }}>
                  {WEIGHT_CLASSES.map(w=>(
                    <TouchableOpacity key={w} onPress={()=>setWeight(w)} activeOpacity={0.75}
                      style={{ borderWidth:1, borderColor:weight===w?C.gold:C.border, backgroundColor:weight===w?C.goldDim:'transparent', paddingVertical:7, paddingHorizontal:10 }}>
                      <Txt style={{ fontSize:10, fontFamily:'Outfit_700Bold', color:weight===w?C.gold:C.muted }}>{w}</Txt>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
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
function generateInsights(rolls, takedowns, sweeps, transitions, positions, competitions) {
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

  return insights;
}

// ─── Charts Screen ────────────────────────────────────────────────────────────
function ChartsScreen({ rolls, activeRoll, competitions, submissions, sweeps, positions, transitions, takedowns, trainingDays, onLogDay, onRemoveDay }) {
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
  const insights = generateInsights(rolls, takedowns, sweeps, transitions, positions, competitions);

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
              <Txt style={{fontSize:10,color:sl.color,fontFamily:'Outfit_700Bold'}}>{sl.value} ({sl.pct}%)</Txt>
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
        <Txt style={{fontSize:9,fontFamily:'Outfit_700Bold',letterSpacing:2,textTransform:'uppercase',color:C.textDim}}>{title}</Txt>
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
            <Txt style={{fontSize:10,fontFamily:'Outfit_700Bold',color:C.gold}}>{my}<Cap style={{fontSize:7}}> you</Cap></Txt>
            <Txt style={{fontSize:10,fontFamily:'Outfit_700Bold',color:C.stone}}>{op}<Cap style={{fontSize:7}}> opp</Cap></Txt>
            <View style={{borderWidth:1,borderColor:win?`${C.sage}44`:loss?`${C.red}44`:`${C.amber}44`,paddingHorizontal:5,paddingVertical:1}}>
              <Txt style={{fontSize:8,fontFamily:'Outfit_700Bold',color:win?C.sage:loss?C.red:C.amber}}>{win?'W':loss?'L':'D'}</Txt>
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
              <Txt style={{fontSize:9,fontFamily:chartTab===t.key?'Outfit_700Bold':'Outfit_400Regular',letterSpacing:1.5,textTransform:'uppercase',color:chartTab===t.key?C.gold:C.muted}}>{t.label}</Txt>
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
                <Txt style={{fontSize:14,fontFamily:'Outfit_800ExtraBold',color:C.gold}}>Performance Insights</Txt>
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
                <Txt style={{fontSize:18,fontFamily:'Outfit_900Black',color,lineHeight:22}}>{value}</Txt>
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
                <Txt style={{fontSize:11,fontFamily:'Outfit_800ExtraBold',color:ins.color,flex:1}}>{ins.title}</Txt>
                <View style={{borderWidth:1,borderColor:`${ins.color}44`,paddingHorizontal:6,paddingVertical:2}}>
                  <Cap style={{fontSize:7,color:ins.color}}>{ins.category}</Cap>
                </View>
              </View>
              <View style={{padding:14}}>
                <Txt style={{fontSize:13,color:C.text,lineHeight:20,marginBottom:6}}>{ins.text}</Txt>
                <Txt style={{fontSize:10,color:C.muted,fontFamily:'Outfit_600SemiBold'}}>{ins.detail}</Txt>
              </View>
            </View>
          ))}

          {/* Top Finishing Positions — shows as soon as any sub data exists */}
          {subStats.length > 0 && (
            <View style={{borderWidth:1,borderColor:C.border,backgroundColor:C.card,marginBottom:12}}>
              <View style={{flexDirection:'row',alignItems:'center',padding:14,borderBottomWidth:1,borderBottomColor:C.border,backgroundColor:C.faint}}>
                <View style={{width:3,height:14,backgroundColor:C.red,marginRight:10}}/>
                <Txt style={{fontSize:9,fontFamily:'Outfit_700Bold',letterSpacing:2,textTransform:'uppercase',color:C.textDim}}>Submission Rate by Position</Txt>
              </View>
              <View style={{padding:14}}>
                {[...subStats].sort((a,b)=>b.rate-a.rate||b.successes-a.successes).slice(0,5).map((item,i)=>{
                  const rc = item.rate>=70?C.sage:item.rate>=40?C.amber:item.rate>0?C.red:C.muted;
                  return(
                    <View key={item.pos} style={{flexDirection:'row',alignItems:'center',paddingVertical:8,borderBottomWidth:i<Math.min(subStats.length,5)-1?1:0,borderBottomColor:C.faint}}>
                      <Txt style={{fontSize:10,fontFamily:'Outfit_700Bold',color:C.muted,width:18}}>{i+1}</Txt>
                      <View style={{flex:1}}>
                        <Txt style={{fontSize:12,color:C.text}} numberOfLines={1}>{item.pos}</Txt>
                        <Cap style={{fontSize:7,marginTop:2}}>{item.successes} win{item.successes!==1?'s':''} / {item.attempts} attempt{item.attempts!==1?'s':''}</Cap>
                      </View>
                      <View style={{width:70,height:6,backgroundColor:C.faint,marginHorizontal:10}}>
                        <View style={{height:6,width:`${item.rate}%`,backgroundColor:rc}}/>
                      </View>
                      <View style={{width:42,borderWidth:1,borderColor:`${rc}44`,backgroundColor:`${rc}10`,paddingHorizontal:4,paddingVertical:2,alignItems:'center'}}>
                        <Txt style={{fontSize:10,fontFamily:'Outfit_700Bold',color:rc}}>{item.rate}%</Txt>
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
              <Txt style={{fontSize:9,fontFamily:'Outfit_700Bold',letterSpacing:2,textTransform:'uppercase',color:C.textDim}}>
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
                        <Txt style={{fontSize:11,fontFamily:'Outfit_700Bold',color:isActive?C.muted:C.textDim}}>{item.label}</Txt>
                        {isActive && <View style={{borderWidth:1,borderColor:`${C.sage}55`,paddingHorizontal:5,paddingVertical:1,backgroundColor:`${C.sage}15`}}><Cap style={{fontSize:6,color:C.sage}}>active</Cap></View>}
                      </View>
                      <Txt style={{fontSize:11,color:C.muted,lineHeight:16,marginBottom:4}}>{item.desc}</Txt>
                      <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
                        <Txt style={{fontSize:9,color:C.border}}>Needs:</Txt>
                        <Txt style={{fontSize:9,color:C.border,fontFamily:'Outfit_600SemiBold'}}>{item.need}</Txt>
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
                  <Txt style={{fontSize:13,fontFamily:'Outfit_700Bold',color:C.sage}}>✓ Trained Today</Txt>
                  <Cap style={{marginTop:2,color:C.sage}}>{todayStr}</Cap>
                </View>
                <TouchableOpacity onPress={()=>onRemoveDay(todayStr)} activeOpacity={0.75}
                  style={{borderWidth:1,borderColor:`${C.red}44`,paddingHorizontal:12,paddingVertical:8}}>
                  <Txt style={{fontSize:9,fontFamily:'Outfit_700Bold',color:C.red,letterSpacing:1.5,textTransform:'uppercase'}}>Remove</Txt>
                </TouchableOpacity>
              </View>
            ):(
              <TouchableOpacity onPress={()=>onLogDay(todayStr)} activeOpacity={0.8}
                style={{backgroundColor:C.gold,padding:16,alignItems:'center'}}>
                <Txt style={{fontSize:10,fontFamily:'Outfit_900Black',letterSpacing:3,textTransform:'uppercase',color:'#0D0D0B'}}>+ Log Today's Training</Txt>
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
                <Txt style={{fontSize:20,fontFamily:'Outfit_900Black',color:C.gold,lineHeight:24}}>{value}</Txt>
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
                    <Txt style={{fontSize:11,fontFamily:'Outfit_700Bold',color:C.teal}}>{m.trained} <Cap style={{fontSize:8}}>days</Cap></Txt>
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
                    <Txt style={{fontSize:11,fontFamily:'Outfit_700Bold',color:C.blue}}>{count} roll{count!==1?'s':''}</Txt>
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
                  <Txt style={{fontSize:9,fontFamily:scope==='all'?'Outfit_700Bold':'Outfit_400Regular',color:scope==='all'?C.gold:C.muted,letterSpacing:1.5,textTransform:'uppercase'}}>All Sessions</Txt>
                </TouchableOpacity>
                {rolls.slice(0,8).map((r,i)=>(
                  <TouchableOpacity key={r.id} onPress={()=>setScope(r.id)} activeOpacity={0.75}
                    style={{borderWidth:1,borderColor:scope===r.id?C.gold:C.border,backgroundColor:scope===r.id?C.goldDim:'transparent',paddingHorizontal:12,paddingVertical:8}}>
                    <Txt style={{fontSize:9,fontFamily:scope===r.id?'Outfit_700Bold':'Outfit_400Regular',color:scope===r.id?C.gold:C.muted,letterSpacing:1.5,textTransform:'uppercase'}}>#{rolls.length-i}{r.partner?` ${r.partner}`:''}</Txt>
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
                  <Txt style={{fontSize:9,fontFamily:scope==='all'?'Outfit_700Bold':'Outfit_400Regular',color:scope==='all'?C.gold:C.muted,letterSpacing:1.5,textTransform:'uppercase'}}>All Sessions</Txt>
                </TouchableOpacity>
                {rolls.slice(0,8).map((r,i)=>(
                  <TouchableOpacity key={r.id} onPress={()=>setScope(r.id)} activeOpacity={0.75}
                    style={{borderWidth:1,borderColor:scope===r.id?C.gold:C.border,backgroundColor:scope===r.id?C.goldDim:'transparent',paddingHorizontal:12,paddingVertical:8}}>
                    <Txt style={{fontSize:9,fontFamily:scope===r.id?'Outfit_700Bold':'Outfit_400Regular',color:scope===r.id?C.gold:C.muted,letterSpacing:1.5,textTransform:'uppercase'}}>#{rolls.length-i}{r.partner?` ${r.partner}`:''}</Txt>
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
          <Txt style={{ fontSize:22, fontFamily:'Outfit_900Black', color:C.text, letterSpacing:-0.5, textAlign:'center', lineHeight:28 }}>Train. Measure.</Txt>
          <Txt style={{ fontSize:22, fontFamily:'Outfit_900Black', color:C.gold, letterSpacing:-0.5, textAlign:'center', lineHeight:28, marginBottom:36 }}>Improve. Repeat.</Txt>
          {/* CTA */}
          <TouchableOpacity onPress={()=>setShowStart(true)} activeOpacity={0.8}
            style={{ backgroundColor:C.gold, paddingHorizontal:44, paddingVertical:16, alignItems:'center' }}>
            <Txt style={{ fontSize:10, fontFamily:'Outfit_900Black', letterSpacing:3.5, textTransform:'uppercase', color:'#0D0D0B' }}>Start Session</Txt>
          </TouchableOpacity>
          <Txt style={{ fontSize:8, color:C.border, letterSpacing:2, textTransform:'uppercase', marginTop:40 }}>Structured practice. Measured progress.</Txt>
        </View>
      ) : (
        <View style={{ flex:1 }}>
          {/* Active roll header */}
          <View style={{ backgroundColor:C.faint, borderBottomWidth:1, borderBottomColor:isPaused?C.amber:`${C.gold}33`, flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:14 }}>
            <View>
              <Txt style={{ fontSize:8, color:isPaused?C.amber:C.gold, fontFamily:'Outfit_700Bold', letterSpacing:2.5, textTransform:'uppercase', marginBottom:2 }}>{isPaused?'⏸ Paused':'● Live'}</Txt>
              <Txt style={{ fontSize:13, fontFamily:'Outfit_700Bold' }}>{activeRoll.partner||'Training Session'}</Txt>
            </View>
            <View style={{ flexDirection:'row', gap:8 }}>
              <PauseButton isPaused={isPaused} onToggle={onTogglePause} small/>
              <TouchableOpacity onPress={()=>setShowEnd(true)} activeOpacity={0.75} style={{ backgroundColor:C.sage, paddingHorizontal:14, paddingVertical:8, alignItems:'center', justifyContent:'center' }}>
                <Txt style={{ fontSize:9, fontFamily:'Outfit_700Bold', letterSpacing:2, textTransform:'uppercase', color:C.offWhite }}>End Roll</Txt>
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
          <Txt style={{ flex:1, fontSize:14, fontFamily:'Outfit_700Bold' }}>
            Roll {String(isActive ? rolls.length+1 : rolls.length - rolls.findIndex(r=>r.id===viewingRoll.id)).padStart(2,'0')}
            {current.partner?<Txt style={{ color:C.muted, fontFamily:'Outfit_400Regular' }}> · {current.partner}</Txt>:''}
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
              <Txt style={{ fontSize:9, fontFamily:'Outfit_800ExtraBold', color:C.offWhite, letterSpacing:2, textTransform:'uppercase' }}>End Roll</Txt>
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
              <Txt style={{ fontSize:8, color:isPaused?C.amber:C.gold, fontFamily:'Outfit_700Bold', letterSpacing:2, textTransform:'uppercase', marginBottom:2 }}>{isPaused?'⏸ Paused':'● Live Session'}</Txt>
              <Txt style={{ fontSize:13, fontFamily:'Outfit_700Bold' }}>{activeRoll.partner||'Training'}</Txt>
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
  const [editingComp, setEditingComp]     = useState(null);
  const [showStartRound, setShowStartRound] = useState(false);
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
            <Txt style={{ fontSize:13, fontFamily:'Outfit_700Bold' }}>
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
            <Txt style={{ fontSize:9, fontFamily:'Outfit_700Bold', color:C.offWhite, letterSpacing:2, textTransform:'uppercase' }}>End Round</Txt>
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
                <Txt style={{ fontSize:16, fontFamily:'Outfit_800ExtraBold', marginBottom:20 }}>How did the round end?</Txt>

                {/* End type buttons */}
                <View style={{ flexDirection:'row', gap:8, marginBottom:20 }}>
                  {[
                    { type:'time',       icon:'⏱', label:'Time Expired', desc:'Match went the full duration' },
                    { type:'submission', icon:'🔒', label:'Submission',   desc:'Someone tapped out' },
                  ].map(({ type, icon, label, desc }) => (
                    <TouchableOpacity key={type} onPress={()=>setEndMeta(m=>({ ...m, endType:type, submissionName:'', submissionWinner:'me', result:'win', method:type==='submission'?'submission':'points' }))} activeOpacity={0.75}
                      style={{ flex:1, borderWidth:2, borderColor:endMeta.endType===type?C.gold:C.border, backgroundColor:endMeta.endType===type?C.goldDim:'transparent', padding:14 }}>
                      <Txt style={{ fontSize:20, marginBottom:6 }}>{icon}</Txt>
                      <Txt style={{ fontSize:10, fontFamily:'Outfit_800ExtraBold', letterSpacing:1.5, textTransform:'uppercase', color:endMeta.endType===type?C.gold:C.textDim, marginBottom:4 }}>{label}</Txt>
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
                          <Txt style={{ fontSize:12, fontFamily:'Outfit_700Bold', color:endMeta.result===k?v.color:C.muted }}>{v.icon} {v.label}</Txt>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={{ marginBottom:16 }}>
                      <Cap style={{ marginBottom:6 }}>Match Duration (optional)</Cap>
                      <TextInput
                        value={endMeta.matchTime||''} onChangeText={t=>setEndMeta(m=>({...m,matchTime:t}))}
                        placeholder="e.g. 6:00" placeholderTextColor={C.muted}
                        style={{ backgroundColor:'transparent', borderBottomWidth:1, borderBottomColor:C.borderMid, color:C.text, fontSize:14, paddingVertical:10, fontFamily:'Outfit_400Regular' }}/>
                    </View>
                  </>
                )}

                {/* Submission — who got it + technique */}
                {endMeta.endType === 'submission' && (
                  <>
                    {/* Submission overrides result */}
                    <View style={{ borderWidth:1, borderColor:`${C.gold}44`, backgroundColor:C.goldDim, padding:10, marginBottom:14 }}>
                      <Txt style={{ fontSize:9, color:C.gold, fontFamily:'Outfit_700Bold', letterSpacing:1.5, textTransform:'uppercase', marginBottom:2 }}>⚡ Submission overrides points</Txt>
                      <Txt style={{ fontSize:11, color:C.textDim }}>Whoever gets the submission wins — regardless of score.</Txt>
                    </View>
                    <Cap style={{ marginBottom:8 }}>Who got the submission?</Cap>
                    <View style={{ flexDirection:'row', gap:8, marginBottom:16 }}>
                      {[['me','I submitted them','WIN'],['opp','I was submitted','LOSS']].map(([val,lbl,outcome])=>(
                        <TouchableOpacity key={val} onPress={()=>setEndMeta(m=>({...m,submissionWinner:val,result:val==='me'?'win':'loss'}))} activeOpacity={0.75}
                          style={{ flex:1, paddingVertical:12, borderWidth:2, borderColor:endMeta.submissionWinner===val?(val==='me'?C.sage:C.red):C.border, alignItems:'center', backgroundColor:endMeta.submissionWinner===val?(val==='me'?`${C.sage}18`:`${C.red}18`):'transparent' }}>
                          <Txt style={{ fontSize:11, fontFamily:'Outfit_900Black', color:endMeta.submissionWinner===val?(val==='me'?C.sage:C.red):C.muted, marginBottom:3 }}>{outcome}</Txt>
                          <Txt style={{ fontSize:9, fontFamily:'Outfit_700Bold', letterSpacing:1, textTransform:'uppercase', color:endMeta.submissionWinner===val?(val==='me'?C.sage:C.red):C.muted }}>{lbl}</Txt>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Cap style={{ marginBottom:8 }}>Submission Technique</Cap>
                    <ScrollView style={{ maxHeight:160, borderWidth:1, borderColor:C.border, marginBottom:12 }} nestedScrollEnabled>
                      {DEF_SUBS.map(sub=>(
                        <TouchableOpacity key={sub} onPress={()=>setEndMeta(m=>({...m,submissionName:sub}))} activeOpacity={0.75}
                          style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:12, borderBottomWidth:1, borderBottomColor:C.border, backgroundColor:endMeta.submissionName===sub?C.faint:'transparent' }}>
                          <Txt style={{ fontSize:13, color:C.textDim }}>{sub}</Txt>
                          {endMeta.submissionName===sub && <Txt style={{ color:C.gold }}>✓</Txt>}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <View style={{ marginBottom:16 }}>
                      <Cap style={{ marginBottom:6 }}>Match Duration (optional)</Cap>
                      <TextInput
                        value={endMeta.matchTime||''} onChangeText={t=>setEndMeta(m=>({...m,matchTime:t}))}
                        placeholder="e.g. 4:47" placeholderTextColor={C.muted}
                        style={{ backgroundColor:'transparent', borderBottomWidth:1, borderBottomColor:C.borderMid, color:C.text, fontSize:14, paddingVertical:10, fontFamily:'Outfit_400Regular' }}/>
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
          <Txt style={{ flex:1, fontSize:14, fontFamily:'Outfit_800ExtraBold' }} numberOfLines={1}>{activeComp.name}</Txt>
          <TouchableOpacity onPress={()=>setEditingComp(activeComp)} activeOpacity={0.75} style={{ borderWidth:1, borderColor:C.border, paddingHorizontal:10, paddingVertical:6 }}>
            <Txt style={{ fontSize:8, color:C.muted, fontFamily:'Outfit_700Bold', letterSpacing:1.5, textTransform:'uppercase' }}>Edit</Txt>
          </TouchableOpacity>
          <TouchableOpacity onPress={()=>deleteComp(activeComp.id)} activeOpacity={0.75} style={{ borderWidth:1, borderColor:C.border, paddingHorizontal:10, paddingVertical:6 }}>
            <Txt style={{ fontSize:14, color:C.muted }}>✕</Txt>
          </TouchableOpacity>
        </View>
        <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:16 }}>
          {/* Header stats */}
          <View style={{ backgroundColor:C.faint, borderWidth:1, borderColor:`${C.gold}33`, padding:16, marginBottom:20 }}>
            <Cap style={{ color:C.gold, marginBottom:4 }}>Competition Record</Cap>
            <Txt style={{ fontSize:18, fontFamily:'Outfit_900Black', marginBottom:4 }}>{activeComp.name}</Txt>
            {activeComp.location && <Txt style={{ fontSize:11, color:C.muted }}>{activeComp.location}</Txt>}
            <Cap style={{ marginTop:2 }}>{activeComp.gi} · {activeComp.weightClass}</Cap>
            <View style={{ flexDirection:'row', gap:20, marginTop:12 }}>
              {[['W',wins,C.sage],['L',losses,C.red],['D',draws,C.amber]].map(([l,v,c])=>(
                <View key={l} style={{ alignItems:'center' }}>
                  <Txt style={{ fontSize:26, fontFamily:'Outfit_900Black', color:v>0?c:C.border }}>{v}</Txt>
                  <Cap style={{ fontSize:7 }}>{l}</Cap>
                </View>
              ))}
            </View>
          </View>

          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <Cap>{activeComp.rounds.length} Round{activeComp.rounds.length!==1?'s':''}</Cap>
            <TouchableOpacity onPress={()=>setShowStartRound(true)} activeOpacity={0.75} style={{ backgroundColor:C.gold, paddingHorizontal:16, paddingVertical:8 }}>
              <Txt style={{ fontSize:9, fontFamily:'Outfit_800ExtraBold', color:'#0F0F0D', letterSpacing:2, textTransform:'uppercase' }}>+ Start Round</Txt>
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
                    {isLive && <View style={{ borderWidth:1, borderColor:`${C.gold}44`, paddingHorizontal:5, paddingVertical:1 }}><Txt style={{ fontSize:8, color:C.gold, fontFamily:'Outfit_700Bold', letterSpacing:2 }}>LIVE</Txt></View>}
                    {rc&&!isLive && <View style={{ borderWidth:1, borderColor:`${rc.color}44`, paddingHorizontal:5, paddingVertical:1 }}><Txt style={{ fontSize:8, color:rc.color, fontFamily:'Outfit_700Bold', letterSpacing:2 }}>{rc.icon} {rc.label.toUpperCase()}</Txt></View>}
                    <Txt style={{ fontSize:13, fontFamily:'Outfit_700Bold' }}>Round {i+1}</Txt>
                    <Txt style={{ fontSize:12, color:C.textDim }}>{round.opponent||'Unknown'}</Txt>
                    {round.oppAbbr && <View style={{ borderWidth:1, borderColor:`${C.teal}44`, paddingHorizontal:5, paddingVertical:1 }}><Txt style={{ fontSize:8, color:C.teal, fontFamily:'Outfit_700Bold', letterSpacing:1.5 }}>{round.oppAbbr}</Txt></View>}
                  </View>
                  {round.oppBelt && (
                    <View style={{ marginBottom:4 }}>
                      <BeltBadge belt={round.oppBelt} stripes={round.oppStripes||0} size="sm"/>
                    </View>
                  )}
                  <Txt style={{ fontSize:9, color:C.muted }}>{fmtDateTime(round.startedAt)}{round.matchTime?` · ⏱ ${round.matchTime}`:''}</Txt>
                  {round.notes && <Txt style={{ fontSize:11, color:C.muted, marginTop:6, fontStyle:'italic' }}>{round.notes}</Txt>}
                </View>
                <View style={{ alignItems:'center', justifyContent:'center', padding:12, gap:4 }}>
                  <Txt style={{ fontSize:18, fontFamily:'Outfit_900Black', color:C.gold }}>{rMyPts}</Txt>
                  <Txt style={{ fontSize:9, color:C.border }}>·</Txt>
                  <Txt style={{ fontSize:18, fontFamily:'Outfit_900Black', color:C.stone }}>{rOpPts}</Txt>
                </View>
                <TouchableOpacity onPress={()=>deleteRound(round.id)} activeOpacity={0.75}
                  style={{ borderLeftWidth:1, borderLeftColor:C.border, paddingHorizontal:12, alignItems:'center', justifyContent:'center' }}>
                  <Txt style={{ color:C.muted, fontSize:16 }}>✕</Txt>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

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
            <Txt style={{ fontSize:16, fontFamily:'Outfit_800ExtraBold', marginBottom:4 }}>Round {roundNum}</Txt>
            <Cap style={{ marginBottom:20 }}>Enter opponent details to begin tracking</Cap>

            {/* Opponent name */}
            <FieldInput label="Opponent Full Name" value={oppName} onChangeText={setOppName} placeholder="First Last"/>
            {oppName.trim() && (
              <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginTop:-8, marginBottom:16 }}>
                <Txt style={{ fontSize:10, color:C.teal }}>Abbreviated: <Txt style={{ fontFamily:'Outfit_700Bold' }}>{abbr}</Txt></Txt>
                <BeltBadge belt={oppBelt} stripes={oppStripes} size="sm"/>
              </View>
            )}

            {/* Belt selector */}
            <View style={{ marginBottom:14 }}>
              <Cap style={{ marginBottom:8 }}>Opponent Belt</Cap>
              <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6 }}>
                {BELT_ORDER.map(b => {
                  const bc = BELT_COLORS[b];
                  return (
                    <TouchableOpacity key={b} onPress={()=>setOppBelt(b)} activeOpacity={0.75}
                      style={{ paddingVertical:8, paddingHorizontal:12, borderWidth:2, borderColor:oppBelt===b?C.gold:C.border, backgroundColor:oppBelt===b?bc.bg:C.faint }}>
                      <Txt style={{ fontSize:8, fontFamily:'Outfit_800ExtraBold', letterSpacing:1.5, textTransform:'uppercase', color:oppBelt===b?bc.text:C.muted }}>{bc.label}</Txt>
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
                    <Txt style={{ fontSize:13, fontFamily:'Outfit_700Bold', color:oppStripes===n?C.gold:C.muted }}>{n}</Txt>
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
function CoachDashboard({ session, onSwitchToAthlete, userRole }) {
  const isAdmin = userRole === 'admin';
  const [athletes,   setAthletes]  = useState([]);
  const [academies,  setAcademies] = useState([]);
  const [selected,   setSelected]  = useState(null);
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

  // Admin: assign role to a user by email
  const assignCoach = async (athleteUserId, athleteName) => {
    if (!athleteUserId) return;
    setManageLoading(true); setManageMsg('');
    try {
      const academyId = academies.find(a => a.name === newCoachAcademy || a.id === newCoachAcademy)?.id || null;

      await supabase.from('user_roles').upsert({
        user_id: athleteUserId,
        role: 'coach',
        academy_id: academyId,
      });

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

  const AthleteRow = ({ a }) => (
    <TouchableOpacity key={a.id} onPress={()=>setSelected(a.id)} activeOpacity={0.75}
      style={{ padding:12, borderBottomWidth:1, borderBottomColor:C.faint,
        backgroundColor:selected===a.id?C.goldDim:'transparent' }}>
      <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:4 }}>
        <ProfileAvatar name={a.name||'?'} size={22} belt={a.belt||'white'}/>
        <Txt style={{ fontSize:12, fontFamily:'Outfit_700Bold', color:selected===a.id?C.gold:C.text, flex:1 }} numberOfLines={1}>{a.name||'Unnamed'}</Txt>
      </View>
      <BeltBadge belt={a.belt||'white'} stripes={a.stripes||0} size="sm"/>
      <View style={{ flexDirection:'row', gap:8, marginTop:4 }}>
        <Cap style={{ fontSize:6 }}>{(rollsMap[a.id]||[]).length} rolls</Cap>
        <Cap style={{ fontSize:6 }}>{(daysMap[a.id]||[]).length}d</Cap>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex:1, backgroundColor:C.bg, paddingTop:TOP_INSET }}>
      <StatusBar barStyle={isDark?'light-content':'dark-content'} backgroundColor={C.surface}/>

      {/* Header */}
      <View style={{ backgroundColor:C.surface, borderBottomWidth:1, borderBottomColor:C.border, padding:12 }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
          <GSLLogo size={28}/>
          <View style={{ flex:1 }}>
            <Txt style={{ fontSize:11, fontFamily:'Outfit_900Black', letterSpacing:2, textTransform:'uppercase', color:C.text }}>
              {isAdmin ? 'Admin Dashboard' : 'Coach Dashboard'}
            </Txt>
            {isAdmin && <Cap style={{ color:C.gold, fontSize:7 }}>Grounded Skills Lab · All Academies</Cap>}
          </View>
          <TouchableOpacity onPress={()=>setIsDark(p=>!p)} activeOpacity={0.75}
            style={{ borderWidth:1, borderColor:C.border, backgroundColor:C.faint, paddingHorizontal:8, paddingVertical:5 }}>
            <Txt style={{ fontSize:12 }}>{isDark?'☀️':'🌙'}</Txt>
          </TouchableOpacity>
          <TouchableOpacity onPress={onSwitchToAthlete} activeOpacity={0.75}
            style={{ borderWidth:1, borderColor:`${C.gold}66`, backgroundColor:C.goldDim, paddingHorizontal:8, paddingVertical:5 }}>
            <Txt style={{ fontSize:8, fontFamily:'Outfit_700Bold', letterSpacing:1, textTransform:'uppercase', color:C.gold }}>My Training</Txt>
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
                <Txt style={{ fontSize:9, fontFamily:activeView===key?'Outfit_700Bold':'Outfit_400Regular',
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

        /* ── ADMIN MANAGE PANEL ── */
        <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:16 }}>

          {/* Academies */}
          <View style={{ borderWidth:1, borderColor:C.border, backgroundColor:C.card, marginBottom:16 }}>
            <View style={{ flexDirection:'row', alignItems:'center', padding:14, borderBottomWidth:1, borderBottomColor:C.border, backgroundColor:C.faint }}>
              <View style={{ width:3, height:14, backgroundColor:C.gold, marginRight:10 }}/>
              <Txt style={{ fontSize:9, fontFamily:'Outfit_700Bold', letterSpacing:2, textTransform:'uppercase', color:C.textDim, flex:1 }}>Academies</Txt>
            </View>
            <View style={{ padding:14 }}>
              {academies.map(ac=>(
                <View key={ac.id} style={{ flexDirection:'row', alignItems:'center', paddingVertical:8, borderBottomWidth:1, borderBottomColor:C.faint }}>
                  <View style={{ flex:1 }}>
                    <Txt style={{ fontSize:13, fontFamily:'Outfit_700Bold', color:C.text }}>{ac.name}</Txt>
                    {ac.location&&<Cap style={{ fontSize:7, marginTop:2 }}>{ac.location}</Cap>}
                    <Cap style={{ fontSize:7, marginTop:2, color:C.muted }}>
                      {athletes.filter(a=>a.academy_id===ac.id).length} athletes
                    </Cap>
                  </View>
                </View>
              ))}
              {/* Create new academy */}
              <View style={{ marginTop:12 }}>
                <Cap style={{ marginBottom:6 }}>Create New Academy</Cap>
                <View style={{ flexDirection:'row', gap:8 }}>
                  <TextInput
                    placeholder="Academy name…" placeholderTextColor={C.muted}
                    style={{ flex:1, borderWidth:1, borderColor:C.borderMid, color:C.text,
                      fontSize:13, fontFamily:'Outfit_400Regular', padding:10, backgroundColor:C.faint }}
                    onSubmitEditing={e=>createAcademy(e.nativeEvent.text)}
                    returnKeyType="done"/>
                </View>
                <Cap style={{ color:C.muted, marginTop:4 }}>Press Enter to create</Cap>
              </View>
            </View>
          </View>

          {/* Assign coach */}
          <View style={{ borderWidth:1, borderColor:C.border, backgroundColor:C.card, marginBottom:16 }}>
            <View style={{ flexDirection:'row', alignItems:'center', padding:14, borderBottomWidth:1, borderBottomColor:C.border, backgroundColor:C.faint }}>
              <View style={{ width:3, height:14, backgroundColor:C.teal, marginRight:10 }}/>
              <Txt style={{ fontSize:9, fontFamily:'Outfit_700Bold', letterSpacing:2, textTransform:'uppercase', color:C.textDim }}>Assign Coach Role</Txt>
            </View>
            <View style={{ padding:14 }}>
              <Cap style={{ marginBottom:8 }}>Select Academy for New Coach</Cap>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:16 }}>
                <View style={{ flexDirection:'row', gap:6 }}>
                  {academies.map(ac=>(
                    <TouchableOpacity key={ac.id} onPress={()=>setNewCoachAcademy(ac.name)} activeOpacity={0.75}
                      style={{ paddingHorizontal:12, paddingVertical:8, borderWidth:1,
                        borderColor:newCoachAcademy===ac.name?C.gold:C.border,
                        backgroundColor:newCoachAcademy===ac.name?C.goldDim:'transparent' }}>
                      <Txt style={{ fontSize:11, color:newCoachAcademy===ac.name?C.gold:C.textDim }}>{ac.name}</Txt>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Cap style={{ marginBottom:8 }}>Tap an athlete to make them a coach</Cap>
              {athletes.filter(a => {
                const role = allUsers.find(u => u.user_id === a.user_id)?.role;
                return role === 'athlete' || !role;
              }).map(a => (
                <TouchableOpacity key={a.id} onPress={()=>assignCoach(a.user_id, a.name||'Unnamed')}
                  disabled={manageLoading} activeOpacity={0.75}
                  style={{ flexDirection:'row', alignItems:'center', gap:10, padding:12,
                    marginBottom:6, borderWidth:1, borderColor:C.border, backgroundColor:C.faint }}>
                  <ProfileAvatar name={a.name||'?'} size={28} belt={a.belt||'white'}/>
                  <View style={{ flex:1 }}>
                    <Txt style={{ fontSize:12, fontFamily:'Outfit_700Bold', color:C.text }}>{a.name||'Unnamed'}</Txt>
                    <BeltBadge belt={a.belt||'white'} stripes={a.stripes||0} size="sm"/>
                  </View>
                  <View style={{ borderWidth:1, borderColor:`${C.teal}55`, paddingHorizontal:8, paddingVertical:4 }}>
                    <Txt style={{ fontSize:8, color:C.teal, fontFamily:'Outfit_700Bold', letterSpacing:1 }}>Make Coach</Txt>
                  </View>
                </TouchableOpacity>
              ))}

              {/* Current coaches */}
              {allUsers.filter(u => u.role === 'coach').length > 0 && (
                <View style={{ marginTop:12 }}>
                  <Cap style={{ marginBottom:8, color:C.teal }}>Current Coaches</Cap>
                  {allUsers.filter(u => u.role === 'coach').map(u => {
                    const ath = athletes.find(a => a.user_id === u.user_id);
                    const ac = academies.find(a => a.id === u.academy_id);
                    return (
                      <View key={u.user_id} style={{ flexDirection:'row', alignItems:'center', gap:8,
                        padding:10, marginBottom:4, borderWidth:1, borderColor:`${C.teal}44`,
                        backgroundColor:`${C.teal}0A` }}>
                        <Txt style={{ fontSize:12, color:C.teal, fontFamily:'Outfit_700Bold', flex:1 }}>
                          {ath?.name || 'Unknown'}
                        </Txt>
                        {ac && <Cap style={{ color:C.teal, fontSize:7 }}>{ac.name}</Cap>}
                        <TouchableOpacity onPress={async ()=>{
                          await supabase.from('user_roles').upsert({ user_id: u.user_id, role:'athlete', academy_id: u.academy_id });
                          const { data: users } = await supabase.from('user_roles').select('user_id, role, academy_id');
                          setAllUsers(users||[]);
                          setManageMsg(`✓ ${ath?.name||'User'} changed back to athlete.`);
                        }} activeOpacity={0.75}
                          style={{ borderWidth:1, borderColor:`${C.red}44`, paddingHorizontal:6, paddingVertical:3 }}>
                          <Txt style={{ fontSize:8, color:C.red, fontFamily:'Outfit_700Bold' }}>Remove</Txt>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}

              {manageMsg ? (
                <View style={{ marginTop:10, padding:10, borderWidth:1,
                  borderColor:manageMsg.startsWith('✓')?`${C.sage}55`:`${C.red}55`,
                  backgroundColor:manageMsg.startsWith('✓')?`${C.sage}15`:`${C.red}15` }}>
                  <Txt style={{ fontSize:12, color:manageMsg.startsWith('✓')?C.sage:C.red }}>{manageMsg}</Txt>
                </View>
              ) : null}
            </View>
          </View>

          {/* Assign athletes to academies */}
          <View style={{ borderWidth:1, borderColor:C.border, backgroundColor:C.card, marginBottom:16 }}>
            <View style={{ flexDirection:'row', alignItems:'center', padding:14, borderBottomWidth:1, borderBottomColor:C.border, backgroundColor:C.faint }}>
              <View style={{ width:3, height:14, backgroundColor:C.amber, marginRight:10 }}/>
              <Txt style={{ fontSize:9, fontFamily:'Outfit_700Bold', letterSpacing:2, textTransform:'uppercase', color:C.textDim }}>Athlete → Academy</Txt>
            </View>
            <View style={{ padding:14 }}>
              {athletes.map(a=>(
                <View key={a.id} style={{ paddingVertical:8, borderBottomWidth:1, borderBottomColor:C.faint }}>
                  <Txt style={{ fontSize:12, fontFamily:'Outfit_700Bold', color:C.text, marginBottom:6 }}>{a.name||'Unnamed'}</Txt>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection:'row', gap:6 }}>
                      <TouchableOpacity onPress={()=>assignToAcademy(a.id, null)} activeOpacity={0.75}
                        style={{ paddingHorizontal:10, paddingVertical:5, borderWidth:1,
                          borderColor:!a.academy_id?C.red:C.border,
                          backgroundColor:!a.academy_id?`${C.red}18`:'transparent' }}>
                        <Txt style={{ fontSize:9, color:!a.academy_id?C.red:C.muted }}>None</Txt>
                      </TouchableOpacity>
                      {academies.map(ac=>(
                        <TouchableOpacity key={ac.id} onPress={()=>assignToAcademy(a.id, ac.id)} activeOpacity={0.75}
                          style={{ paddingHorizontal:10, paddingVertical:5, borderWidth:1,
                            borderColor:a.academy_id===ac.id?C.gold:C.border,
                            backgroundColor:a.academy_id===ac.id?C.goldDim:'transparent' }}>
                          <Txt style={{ fontSize:9, color:a.academy_id===ac.id?C.gold:C.muted }}>{ac.name}</Txt>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

      ) : (

        /* ── ATHLETES VIEW ── */
        <View style={{ flex:1, flexDirection:'row' }}>
          {/* Sidebar — grouped by academy */}
          <View style={{ width:170, borderRightWidth:1, borderRightColor:C.border, backgroundColor:C.surface }}>
            <View style={{ padding:10, borderBottomWidth:1, borderBottomColor:C.border }}>
              <Cap style={{ fontSize:7 }}>{athletes.length} athlete{athletes.length!==1?'s':''}</Cap>
            </View>
            <ScrollView>
              {/* Academy groups */}
              {academyGroups.filter(ag=>ag.athletes.length>0).map(ag=>(
                <View key={ag.id}>
                  <View style={{ paddingHorizontal:12, paddingVertical:6, backgroundColor:C.goldDim, borderBottomWidth:1, borderBottomColor:C.border }}>
                    <Txt style={{ fontSize:9, fontFamily:'Outfit_700Bold', letterSpacing:1.5, textTransform:'uppercase', color:C.gold }}>{ag.name}</Txt>
                    <Cap style={{ fontSize:6 }}>{ag.athletes.length} athlete{ag.athletes.length!==1?'s':''}</Cap>
                  </View>
                  {ag.athletes.map(a=><AthleteRow key={a.id} a={a}/>)}
                </View>
              ))}
              {/* Unassigned */}
              {unassigned.length > 0 && (
                <View>
                  <View style={{ paddingHorizontal:12, paddingVertical:6, backgroundColor:C.faint, borderBottomWidth:1, borderBottomColor:C.border }}>
                    <Txt style={{ fontSize:9, fontFamily:'Outfit_700Bold', letterSpacing:1.5, textTransform:'uppercase', color:C.muted }}>Unassigned</Txt>
                  </View>
                  {unassigned.map(a=><AthleteRow key={a.id} a={a}/>)}
                </View>
              )}
              {athletes.length === 0 && (
                <View style={{ padding:16 }}>
                  <Cap style={{ textAlign:'center', color:C.muted }}>No athletes yet</Cap>
                </View>
              )}
            </ScrollView>
          </View>

          {/* Detail panel */}
          {!selected ? (
            <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
              <GSLLogo size={48}/>
              <View style={{ width:30, height:2, backgroundColor:C.gold, marginVertical:14 }}/>
              <Cap>Select an athlete to view their data</Cap>
            </View>
          ) : (
            <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:16 }}>
              {/* Athlete header */}
              <View style={{ flexDirection:'row', alignItems:'center', gap:12, marginBottom:16,
                padding:14, backgroundColor:C.card, borderWidth:1, borderColor:C.border }}>
                <ProfileAvatar name={sel?.name||'?'} size={44} belt={sel?.belt||'white'}/>
                <View style={{ flex:1 }}>
                  <Txt style={{ fontSize:15, fontFamily:'Outfit_800ExtraBold', color:C.text }}>{sel?.name||'Unnamed'}</Txt>
                  <BeltBadge belt={sel?.belt||'white'} stripes={sel?.stripes||0} size="md"/>
                  {sel?.gym && <Cap style={{ marginTop:4 }}>{sel.gym}</Cap>}
                  {sel?.academy_id && (
                    <Cap style={{ marginTop:4, color:C.gold }}>
                      {academies.find(a=>a.id===sel.academy_id)?.name || ''}
                    </Cap>
                  )}
                </View>
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
                    <Txt style={{ fontSize:16, fontFamily:'Outfit_900Black', color, lineHeight:20 }}>{value}</Txt>
                    <Cap style={{ fontSize:6, textAlign:'center', marginTop:3 }}>{label}</Cap>
                  </View>
                ))}
              </View>

              {/* Recent rolls */}
              <View style={{ borderWidth:1, borderColor:C.border, marginBottom:12 }}>
                <View style={{ flexDirection:'row', alignItems:'center', padding:12, borderBottomWidth:1, borderBottomColor:C.border, backgroundColor:C.faint }}>
                  <View style={{ width:3, height:12, backgroundColor:C.gold, marginRight:8 }}/>
                  <Txt style={{ fontSize:9, fontFamily:'Outfit_700Bold', letterSpacing:2, textTransform:'uppercase', color:C.textDim }}>Recent Rolls</Txt>
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
                        {r.endType==='submission'&&<View style={{ borderWidth:1, borderColor:`${C.red}44`, paddingHorizontal:4, paddingVertical:1, marginRight:6 }}><Txt style={{ fontSize:7, color:C.red, fontFamily:'Outfit_700Bold' }}>🔒</Txt></View>}
                        <Txt style={{ fontSize:11, fontFamily:'Outfit_700Bold', color:C.gold, marginRight:6 }}>{my}–{op}</Txt>
                        <View style={{ borderWidth:1, borderColor:`${rc}44`, paddingHorizontal:5, paddingVertical:1 }}>
                          <Txt style={{ fontSize:8, fontFamily:'Outfit_700Bold', color:rc }}>{res==='win'?'W':res==='loss'?'L':'D'}</Txt>
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
                    <Txt style={{ fontSize:9, fontFamily:'Outfit_700Bold', letterSpacing:2, textTransform:'uppercase', color:C.textDim }}>Competitions</Txt>
                  </View>
                  <View style={{ padding:12 }}>
                    {selComps.map((c,i)=>{
                      const cW=c.rounds.filter(r=>r.result==='win').length;
                      const cL=c.rounds.filter(r=>r.result==='loss').length;
                      return(
                        <View key={c.id} style={{ paddingVertical:7, borderBottomWidth:i<selComps.length-1?1:0, borderBottomColor:C.faint }}>
                          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
                            <Txt style={{ fontSize:11, fontFamily:'Outfit_700Bold', color:C.text, flex:1 }} numberOfLines={1}>{c.name}</Txt>
                            <View style={{ flexDirection:'row', gap:4 }}>
                              <View style={{ borderWidth:1, borderColor:`${C.sage}44`, paddingHorizontal:5, paddingVertical:1 }}>
                                <Txt style={{ fontSize:8, color:C.sage, fontFamily:'Outfit_700Bold' }}>{cW}W</Txt>
                              </View>
                              <View style={{ borderWidth:1, borderColor:`${C.red}44`, paddingHorizontal:5, paddingVertical:1 }}>
                                <Txt style={{ fontSize:8, color:C.red, fontFamily:'Outfit_700Bold' }}>{cL}L</Txt>
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
                      <Txt style={{ fontSize:9, fontFamily:'Outfit_700Bold', letterSpacing:2, textTransform:'uppercase', color:C.gold }}>Performance Insights</Txt>
                    </View>
                    {ins.slice(0,3).map((ins2,i)=>(
                      <View key={i} style={{ padding:12, borderBottomWidth:i<2?1:0, borderBottomColor:`${C.gold}22` }}>
                        <Txt style={{ fontSize:10, fontFamily:'Outfit_700Bold', color:ins2.color, marginBottom:2 }}>{ins2.icon} {ins2.title}</Txt>
                        <Txt style={{ fontSize:11, color:C.text, lineHeight:16 }}>{ins2.text}</Txt>
                      </View>
                    ))}
                  </View>
                );
              })()}
            </ScrollView>
          )}
        </View>
      )}
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
          <Txt style={{ fontSize:9, fontFamily:'Outfit_900Black', letterSpacing:3, textTransform:'uppercase', color:C.text, marginBottom:2 }}>Grounded</Txt>
          <Txt style={{ fontSize:9, fontFamily:'Outfit_900Black', letterSpacing:3, textTransform:'uppercase', color:C.gold, marginBottom:40 }}>Skills Lab</Txt>

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
                      fontFamily:'Outfit_400Regular', padding:14, backgroundColor:C.card }}/>
                </View>
                <View style={{ flex:1 }}>
                  <Cap style={{ marginBottom:6 }}>Last Name</Cap>
                  <TextInput
                    value={lastName} onChangeText={setLastName}
                    placeholder="Last" placeholderTextColor={C.muted}
                    autoCapitalize="words" returnKeyType="next"
                    style={{ borderWidth:1, borderColor:C.borderMid, color:C.text, fontSize:15,
                      fontFamily:'Outfit_400Regular', padding:14, backgroundColor:C.card }}/>
                </View>
              </View>
            )}

            <Cap style={{ marginBottom:6 }}>Email</Cap>
            <TextInput
              value={email} onChangeText={setEmail}
              placeholder="your@email.com" placeholderTextColor={C.muted}
              autoCapitalize="none" keyboardType="email-address" returnKeyType="next"
              style={{ borderWidth:1, borderColor:C.borderMid, color:C.text, fontSize:15,
                fontFamily:'Outfit_400Regular', padding:14, marginBottom:16, backgroundColor:C.card }}/>

            <Cap style={{ marginBottom:6 }}>Password</Cap>
            <TextInput
              value={password} onChangeText={setPassword}
              placeholder="••••••••" placeholderTextColor={C.muted}
              secureTextEntry returnKeyType="done" onSubmitEditing={submit}
              style={{ borderWidth:1, borderColor:C.borderMid, color:C.text, fontSize:15,
                fontFamily:'Outfit_400Regular', padding:14, marginBottom:24, backgroundColor:C.card }}/>

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
                : <Txt style={{ fontSize:10, fontFamily:'Outfit_900Black', letterSpacing:3, textTransform:'uppercase', color:'#0F0F0D' }}>
                    {mode==='login'?'Sign In':'Create Account'}
                  </Txt>}
            </TouchableOpacity>

            <TouchableOpacity onPress={()=>{ setMode(m=>m==='login'?'signup':'login'); setError(''); }} activeOpacity={0.7} style={{ alignItems:'center' }}>
              <Txt style={{ fontSize:12, color:C.muted }}>
                {mode==='login'?'No account? ':'Already have an account? '}
                <Txt style={{ color:C.gold, fontFamily:'Outfit_700Bold' }}>{mode==='login'?'Sign up':'Sign in'}</Txt>
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
  const [session,   setSession]   = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [userRole,  setUserRole]  = useState(null);
  const [coachMode, setCoachMode] = useState(true);

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
    const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId).single();
    setUserRole(data?.role || 'athlete');
  };

  if (!authReady || (session && userRole === null)) return (
    <View style={{ flex:1, backgroundColor:C.bg, alignItems:'center', justifyContent:'center' }}>
      <StatusBar barStyle="light-content"/>
      <ActivityIndicator color={C.gold} size="large"/>
    </View>
  );

  if (!session) return <AuthScreen onAuth={setSession}/>;

  if (userRole === 'admin' || userRole === 'coach') {
    if (coachMode) return <CoachDashboard session={session} userRole={userRole} onSwitchToAthlete={()=>setCoachMode(false)}/>;
    return <AppMain session={session} onSwitchToCoach={()=>setCoachMode(true)} isCoach/>;
  }

  return <AppMain session={session}/>;
}

// ─── Main App (authenticated) ─────────────────────────────────────────────────
function AppMain({ session, onSwitchToCoach, isCoach }) {
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
      'Outfit_400Regular':   { uri: 'https://fonts.gstatic.com/s/outfit/v11/QGYyz_MVcBeNP4NjuGObqx1XmO1I4TC1C4G-EiAou6Y.woff2' },
      'Outfit_600SemiBold':  { uri: 'https://fonts.gstatic.com/s/outfit/v11/QGYyz_MVcBeNP4NjuGObqx1XmO1I4TC1C4G-EiAou6Y.woff2' },
      'Outfit_700Bold':      { uri: 'https://fonts.gstatic.com/s/outfit/v11/QGYyz_MVcBeNP4NjuGObqx1XmO1I4TC1C4G-EiAou6Y.woff2' },
      'Outfit_800ExtraBold': { uri: 'https://fonts.gstatic.com/s/outfit/v11/QGYyz_MVcBeNP4NjuGObqx1XmO1I4TC1C4G-EiAou6Y.woff2' },
      'Outfit_900Black':     { uri: 'https://fonts.gstatic.com/s/outfit/v11/QGYyz_MVcBeNP4NjuGObqx1XmO1I4TC1C4G-EiAou6Y.woff2' },
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
  const [showProfiles, setShowProfiles] = useState(false);

  const [tab,     setTab]     = useState('Track');
  const [confirm, ConfirmDialog_] = useConfirm();

  // ── Load all data from Supabase on mount ─────────────────────────────────
  useEffect(() => {
    if (!session?.user) return;
    const userId = session.user.id;
    (async () => {
      setLoading(true);
      try {
        let ath = await db.getAthlete(userId);
        if (!ath) {
          ath = await db.upsertAthlete({
            user_id: userId,
            name: session.user.email.split('@')[0],
            belt: 'white', stripes: 0, gym: '',
          });
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
        const [dbRolls, dbDays, dbComps] = await Promise.all([
          db.getRolls(ath.id),
          db.getTrainingDays(ath.id),
          db.getCompetitions(ath.id),
        ]);
        setRolls(dbRolls.map(fromDbRoll));
        setTrainingDays(dbDays);
        setCompetitions(dbComps);
      } catch (e) { console.error('Load error:', e); }
      setLoading(false);
    })();
  }, [session]);

  // ── Debounced technique list save ─────────────────────────────────────────
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
    try { const ath = await db.upsertAthlete({ ...athlete, ...p }); setAthlete(ath); }
    catch (e) { console.error(e); }
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


  // Roll lifecycle
  const isPaused   = !!activeRoll?.paused;
  const startRoll  = partner => setActiveRoll(emptyRoll(partner));
  const finishRoll = result => {
    if (!activeRoll) return;
    const now = Date.now();

    // If ended by submission, winner is determined by who got the sub — ignore points
    const resolvedResult = { ...result };
    if (result.endType === 'submission') {
      resolvedResult.rollResult = result.submissionWinner === 'me' ? 'win' : 'loss';
    } else {
      // Time expired — determine result by points
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
    setRolls(rs => {
      const next = [finished, ...rs];
      if (athlete?.id) db.upsertRoll({ ...finished, athleteId: athlete.id }).catch(console.error);
      return next;
    });
    setActiveRoll(null);
    // Auto-log today as a training day
    const todayStr = new Date().toISOString().split('T')[0];
    setTrainingDays(days => days.includes(todayStr) ? days : [...days, todayStr]);
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
      <Cap style={{ marginTop:16 }}>Loading your data…</Cap>
    </View>
  );

  // Show profile chooser if no profiles or explicitly requested
  if (!profiles.length || !activeProfileId || showProfiles) {
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
      {ConfirmDialog_}

      {/* ── Header ── */}
      <View style={{ backgroundColor:C.surface }}>
        <View style={{ borderBottomWidth:1, borderBottomColor:C.border, paddingHorizontal:12 }}>

          {/* Row 1: Logo + wordmark + controls */}
          <View style={{ flexDirection:'row', alignItems:'center', paddingTop:10, paddingBottom:8, gap:8 }}>
            {/* Logo */}
            <GSLLogo size={30}/>
            {/* Wordmark */}
            <View>
              <Txt style={{ fontSize:9, fontFamily:'Outfit_900Black', letterSpacing:2, textTransform:'uppercase', color:C.text, lineHeight:11 }}>Grounded</Txt>
              <Txt style={{ fontSize:9, fontFamily:'Outfit_900Black', letterSpacing:2, textTransform:'uppercase', color:C.gold, lineHeight:11 }}>Skills Lab</Txt>
            </View>
            {/* Spacer */}
            <View style={{ flex:1 }}/>
            {/* Live score — only when rolling */}
            {activeRoll ? (
              <View style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
                <Txt style={{ fontSize:15, fontFamily:'Outfit_900Black', color:C.gold }}>{livePts}</Txt>
                <Cap style={{ fontSize:7 }}>–</Cap>
                <Txt style={{ fontSize:15, fontFamily:'Outfit_900Black', color:C.stone }}>{liveOppPts}</Txt>
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
                <Txt style={{ fontSize:8, fontFamily:'Outfit_700Bold', letterSpacing:1, textTransform:'uppercase', color:C.teal }}>Coach</Txt>
              </TouchableOpacity>
            )}
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
              <Txt style={{ fontSize:11, fontFamily:'Outfit_800ExtraBold', lineHeight:14 }} numberOfLines={1}>{activeProfile?.name||'Set up profile'}</Txt>
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
          <View style={{ flexDirection:'row' }}>
            {TABS.map(t => (
              <TouchableOpacity key={t} onPress={()=>setTab(t)} activeOpacity={0.75}
                style={{ flex:1, paddingVertical:10, alignItems:'center', borderTopWidth:2, borderTopColor:tab===t?C.gold:'transparent' }}>
                <Txt style={{ fontSize:8, fontFamily:tab===t?'Outfit_700Bold':'Outfit_400Regular', letterSpacing:1.2, textTransform:'uppercase', color:tab===t?C.gold:C.muted }}>{t}</Txt>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* ── Screens ── */}
      {tab==='Track' && (
        <TrackScreen
          activeRoll={activeRoll} onStartRoll={startRoll} onEndRoll={finishRoll}
          onTogglePause={togglePause} onMutate={mutateActive}
          activeProfile={activeProfile} trackingProps={trackingProps}/>
      )}
      {tab==='Charts' && (
        <ChartsScreen
          rolls={rolls} activeRoll={activeRoll} competitions={competitions}
          submissions={submissions} sweeps={sweeps} positions={positions}
          transitions={transitions} takedowns={takedowns}
          trainingDays={trainingDays} onLogDay={logDay} onRemoveDay={removeDay}/>
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
    </View>
    </ThemeContext.Provider>
  );
}
