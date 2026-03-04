import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  LayoutDashboard, ReceiptText, Wallet, Banknote, Percent, CheckCircle2,
  AlertCircle, RefreshCw, Search, Users, X, Menu, Landmark, Users2,
  TrendingDown, DatabaseZap, Copy, ShieldAlert, LogOut, Plus, Save,
  FileText, ChevronRight, ChevronLeft, Bike, UserCircle, CheckSquare,
  TrendingUp, Eye, EyeOff, Zap, BarChart2, History, Bell, Wifi, WifiOff,
  LineChart, BarChart3, Edit3, Trash2, Printer, Bot, Target, Filter,
  Calendar, Award, Truck, MapPin, DollarSign, AlertTriangle, ArrowUp,
  ArrowDown, Minus, PieChart, Package, Star
} from 'lucide-react';

// ─────────────────────────────────────────────
// CONFIG — reads from env vars (Vercel / .env)
// Falls back to manual login if not set
// ─────────────────────────────────────────────
const ENV_URL = (import.meta.env?.VITE_SUPABASE_URL) || '';
const ENV_KEY = (import.meta.env?.VITE_SUPABASE_KEY) || '';

// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────
const formatPHP = (n) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(n || 0);

const parseNum = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  const r = parseFloat(String(v).replace(/[^0-9.-]+/g, ''));
  return isNaN(r) ? 0 : r;
};

const daysSince = (d) => {
  if (!d) return 0;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
};

const todayISO = () => new Date().toISOString().split('T')[0];

const getDebtAge = (txs) => {
  const unpaid = txs.filter(t => parseNum(t.sales) - parseNum(t.paid) > 0.05);
  if (!unpaid.length) return null;
  const oldest = [...unpaid].sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  return daysSince(oldest.date);
};

// ─────────────────────────────────────────────
// AI INVOICE (Gemini)
// ─────────────────────────────────────────────
const generateAIInvoice = async (clientName, debtAmount, history, geminiKey) => {
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (!geminiKey) {
    const isPunctual = history?.every(h => parseNum(h.sales) <= parseNum(h.paid) + 1);
    return `🛍️ BELLE'S ONLINE STORE\nDate: ${today}\n\nHi ${clientName}! 💖\n\n${isPunctual ? 'Thank you for being such a loyal customer! 🌟' : 'We hope you\'re doing well!'}\n\nYour current balance is: ${formatPHP(debtAmount)}\n\n💳 PAYMENT OPTIONS:\n• GCash: 09XX-XXX-XXXX\n• BDO: XXXXXX-XXXXX\n\nReply with "PICKUP" or "RIDER" and send your payment screenshot. 😊\n\nThank you for shopping with Belle's! 🌸`;
  }
  const txCount = history?.length || 0;
  const unpaidCount = history?.filter(h => parseNum(h.sales) - parseNum(h.paid) > 0.05).length || 0;
  const isPunctual = unpaidCount === 0 || unpaidCount / txCount < 0.2;
  const prompt = `You are a friendly Filipino online shop assistant for "Belle's Online Store".
Client: ${clientName} | Amount Due: ${formatPHP(debtAmount)}
History: ${txCount} orders, ${unpaidCount} unpaid | Profile: ${isPunctual ? 'Excellent loyal customer' : 'Has overdue balances'}
Write a short payment reminder in Taglish (Filipino-English mix). ${isPunctual ? 'Be warm and casual.' : 'Be polite but firm.'}
Include: GCash 09XX-XXX-XXXX, BDO XXXXXX-XXXXX. Ask to reply PICKUP or RIDER with screenshot.
Max 120 words. Use emojis naturally. No markdown.`;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'AI generation failed. Please try again.';
  } catch { return 'AI generation failed. Check your Gemini API key.'; }
};

// ─────────────────────────────────────────────
// ANIMATED NUMBER — fixed, no infinite loop
// ─────────────────────────────────────────────
const AnimatedNumber = ({ value, isPercent = false }) => {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef(null);
  const startRef = useRef(0);

  useEffect(() => {
    const end = parseNum(value);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const from = startRef.current;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / 750, 1);
      const ease = 1 - Math.pow(1 - p, 4);
      const cur = from + (end - from) * ease;
      startRef.current = cur;
      setDisplay(cur);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else { startRef.current = end; setDisplay(end); }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value]);

  if (isPercent) return <span>{display.toFixed(1)}%</span>;
  return <span>{formatPHP(display)}</span>;
};

// ─────────────────────────────────────────────
// TREND INDICATOR
// ─────────────────────────────────────────────
const Trend = ({ current, previous, isPercent = false }) => {
  if (!previous || previous === 0) return null;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const up = pct >= 0;
  const neutral = Math.abs(pct) < 0.5;
  return (
    <div className={`flex items-center gap-1 text-[10px] font-bold mt-1 ${neutral ? 'text-slate-400' : up ? 'text-emerald-500' : 'text-rose-500'}`}>
      {neutral ? <Minus size={10} /> : up ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
      <span>{neutral ? 'Flat' : `${Math.abs(pct).toFixed(1)}% vs last period`}</span>
    </div>
  );
};

// ─────────────────────────────────────────────
// DONUT CHART (CSS-only, no library)
// ─────────────────────────────────────────────
const DonutChart = ({ data, total }) => {
  if (!data?.length || !total) return (
    <div className="flex items-center justify-center h-40 text-slate-400 text-xs font-medium">No expense data yet.</div>
  );
  const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16'];
  let cumulative = 0;
  const segments = data.map((d, i) => {
    const pct = (d.value / total) * 100;
    const start = cumulative;
    cumulative += pct;
    return { ...d, pct, start, color: COLORS[i % COLORS.length] };
  });

  const describeArc = (start, end) => {
    const r = 15.9155;
    const startAngle = (start / 100) * 2 * Math.PI - Math.PI / 2;
    const endAngle = (end / 100) * 2 * Math.PI - Math.PI / 2;
    const x1 = 21 + r * Math.cos(startAngle);
    const y1 = 21 + r * Math.sin(startAngle);
    const x2 = 21 + r * Math.cos(endAngle);
    const y2 = 21 + r * Math.sin(endAngle);
    const large = end - start > 50 ? 1 : 0;
    return `M 21 21 L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
  };

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 42 42" className="w-28 h-28 shrink-0">
        {segments.map((s, i) => (
          <path key={i} d={describeArc(s.start, s.start + s.pct)} fill={s.color} opacity="0.9" />
        ))}
        <circle cx="21" cy="21" r="10" fill="white" />
        <text x="21" y="22" textAnchor="middle" fontSize="3.5" fontWeight="bold" fill="#475569">OpEx</text>
      </svg>
      <div className="flex-1 space-y-1.5 min-w-0">
        {segments.slice(0, 6).map((s, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="text-[10px] font-medium text-slate-600 truncate">{s.label}</span>
            </div>
            <span className="text-[10px] font-bold text-slate-700 shrink-0">{s.pct.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// BAR CHART
// ─────────────────────────────────────────────
const BarChart = ({ data, timeframe }) => {
  const [hovered, setHovered] = useState(null);
  if (!data?.length) return (
    <div className="p-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
      <BarChart2 size={36} className="mx-auto mb-3 text-slate-300" />
      <p className="font-semibold text-sm">No data yet. Log your first transaction.</p>
    </div>
  );
  const max = Math.max(...data.map(d => Math.max(parseNum(d.sales), parseNum(d.paid)))) || 1;
  const shown = [...data].slice(0, 12).reverse();
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 rounded-lg border border-indigo-100"><LineChart size={15} className="text-indigo-600" /></div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Revenue & Collection Trajectory</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">{timeframe} · Last {shown.length} periods</p>
          </div>
        </div>
        <div className="flex gap-5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-slate-800 inline-block" />Revenue</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />Collected</span>
        </div>
      </div>
      <div className="flex items-end gap-1 h-48">
        {shown.map((d, i) => {
          const hS = Math.max((parseNum(d.sales) / max) * 100, 2);
          const hP = Math.max((parseNum(d.paid) / max) * 100, 2);
          const isH = hovered === i;
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full relative cursor-pointer group"
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              {isH && (
                <div className="absolute bottom-full mb-2 bg-slate-900 text-white text-[10px] font-medium p-2.5 rounded-lg z-20 whitespace-nowrap shadow-xl border border-slate-700 pointer-events-none left-1/2 -translate-x-1/2">
                  <span className="font-bold text-indigo-300 block mb-1.5">{d.date}</span>
                  <div className="space-y-1">
                    <div className="flex justify-between gap-3"><span className="text-slate-400">Revenue:</span><span className="font-bold">{formatPHP(parseNum(d.sales))}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-400">Collected:</span><span className="text-emerald-400 font-bold">{formatPHP(parseNum(d.paid))}</span></div>
                    <div className="flex justify-between gap-3 border-t border-slate-700 pt-1"><span className="text-slate-400">Rate:</span><span className="text-indigo-400 font-bold">{d.sales > 0 ? ((d.paid / d.sales) * 100).toFixed(0) : 0}%</span></div>
                  </div>
                </div>
              )}
              <div className="w-full flex justify-center gap-0.5 items-end h-full">
                <div className={`w-full max-w-[14px] rounded-t-sm transition-all duration-300 ${isH ? 'bg-indigo-600' : 'bg-slate-700'}`} style={{ height: `${hS}%` }} />
                <div className={`w-full max-w-[14px] rounded-t-sm transition-all duration-300 ${isH ? 'bg-emerald-400' : 'bg-emerald-500'}`} style={{ height: `${hP}%` }} />
              </div>
              <span className="text-[8px] font-bold text-slate-400 mt-1.5 truncate w-full text-center">{d.date}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// TOASTS
// ─────────────────────────────────────────────
const Toasts = ({ toasts, remove }) => (
  <div className="fixed top-4 right-4 z-[200] space-y-2 pointer-events-none">
    {toasts.map(t => (
      <div key={t.id} className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-semibold max-w-xs
        ${t.type === 'error' ? 'bg-rose-900 text-rose-100 border-rose-700' : t.type === 'success' ? 'bg-emerald-900 text-emerald-100 border-emerald-700' : t.type === 'warning' ? 'bg-amber-900 text-amber-100 border-amber-700' : 'bg-slate-900 text-slate-100 border-slate-700'}`}>
        {t.type === 'error' && <ShieldAlert size={15} className="shrink-0" />}
        {t.type === 'success' && <CheckCircle2 size={15} className="shrink-0" />}
        {t.type === 'warning' && <AlertTriangle size={15} className="shrink-0" />}
        {t.type === 'info' && <Bell size={15} className="shrink-0" />}
        <span className="flex-1">{t.text}</span>
        <button onClick={() => remove(t.id)} className="opacity-60 hover:opacity-100"><X size={13} /></button>
      </div>
    ))}
  </div>
);

// ─────────────────────────────────────────────
// MODAL WRAPPER
// ─────────────────────────────────────────────
const Modal = ({ open, onClose, title, icon: Icon, iconColor = 'text-indigo-600', iconBg = 'bg-indigo-50', children, maxW = 'max-w-lg', footer }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className={`bg-white rounded-2xl w-full ${maxW} shadow-2xl overflow-hidden`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            {Icon && <div className={`p-2 ${iconBg} rounded-lg`}><Icon size={16} className={iconColor} /></div>}
            <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">{title}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"><X size={16} /></button>
        </div>
        <div className="p-6">{children}</div>
        {footer && <div className="px-6 pb-6">{footer}</div>}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// SHARED STYLES
// ─────────────────────────────────────────────
const inp = "w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-medium text-slate-800 transition-all";
const lbl = "block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5";
const btnP = "flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95";
const btnS = "flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 disabled:opacity-50 transition-colors";

const StatusBadge = ({ status, paid, sales }) => {
  const done = parseNum(paid) >= parseNum(sales);
  const label = done ? 'Completed' : (status || 'Pending');
  const s = { Completed: 'bg-emerald-100 text-emerald-700 border-emerald-200', Pending: 'bg-amber-100 text-amber-700 border-amber-200', Cancelled: 'bg-slate-100 text-slate-500 border-slate-200' };
  return <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${s[label] || s.Pending}`}>{label}</span>;
};

const RiskBadge = ({ level }) => {
  const k = level?.toLowerCase().includes('high') ? 'high' : level?.toLowerCase().includes('medium') ? 'medium' : 'low';
  const s = { high: 'bg-rose-100 text-rose-700 border-rose-200', medium: 'bg-amber-100 text-amber-700 border-amber-200', low: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  return <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${s[k]}`}>{level}</span>;
};

// ─────────────────────────────────────────────
// FORM DEFAULTS
// ─────────────────────────────────────────────
const defaultTx = () => ({ date: todayISO(), miner_name: '', sales: '', paid: '', fulfillment: 'Pickup', payment_mode: 'GCash', status: 'Pending' });
const defaultExp = () => ({ date: todayISO(), category: '', amount: '', payment_mode: 'GCash', notes: '' });

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  // ── ROUTING ──────────────────────────────────
  const [role, setRole] = useState(() => sessionStorage.getItem('app_role') || 'admin');
  const [view, setView] = useState('analytics');

  // ── DATA ─────────────────────────────────────
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [investors, setInvestors] = useState([]);

  // ── CONNECTION ───────────────────────────────
  const [sbUrl, setSbUrl] = useState(() => ENV_URL || sessionStorage.getItem('sb_url') || '');
  const [sbKey, setSbKey] = useState(() => ENV_KEY || sessionStorage.getItem('sb_key') || '');
  const [gemKey, setGemKey] = useState(() => sessionStorage.getItem('gem_key') || '');
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showKey, setShowKey] = useState(false);

  // ── OFFLINE QUEUE ────────────────────────────
  const [queue, setQueue] = useState(() => { try { return JSON.parse(localStorage.getItem('belle_queue') || '[]'); } catch { return []; } });
  const queueRef = useRef(queue);
  useEffect(() => { queueRef.current = queue; }, [queue]);

  // ── UI ────────────────────────────────────────
  const [toasts, setToasts] = useState([]);
  const [sidebar, setSidebar] = useState(false);

  // ── LEDGER STATE ─────────────────────────────
  const [txSearch, setTxSearch] = useState('');
  const [txPage, setTxPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // ── CLIENT MATRIX STATE ──────────────────────
  const [clientSearch, setClientSearch] = useState('');
  const [minerPage, setMinerPage] = useState(1);

  // ── ANALYTICS STATE ──────────────────────────
  const [timeframe, setTimeframe] = useState('Monthly');
  const [goal, setGoal] = useState(() => parseNum(localStorage.getItem('belle_goal')) || 0);
  const [goalInput, setGoalInput] = useState('');
  const [showGoalEdit, setShowGoalEdit] = useState(false);

  // ── MODALS ────────────────────────────────────
  const [entryModal, setEntryModal] = useState(false);
  const [editModal, setEditModal] = useState(null);       // tx object
  const [expModal, setExpModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);   // { id, type }
  const [invoiceModal, setInvoiceModal] = useState(null); // { name, debt }
  const [clientModal, setClientModal] = useState(null);   // portfolio entry
  const [payModal, setPayModal] = useState(null);         // tx object — replaces prompt()
  const [riderModal, setRiderModal] = useState(null);     // tx object
  const [riderView, setRiderView] = useState('tasks');    // 'tasks' | 'history'

  // ── FORMS ─────────────────────────────────────
  const [newTx, setNewTx] = useState(defaultTx);
  const [editTx, setEditTx] = useState(defaultTx);
  const [newExp, setNewExp] = useState(defaultExp);
  const [payAmount, setPayAmount] = useState('');
  const [riderAmount, setRiderAmount] = useState('');
  const [riderMode, setRiderMode] = useState('Cash');

  // ── INVOICE ───────────────────────────────────
  const [aiMsg, setAiMsg] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const PER_PAGE = 50;

  // ─────────────────────────────────────────────
  // TOASTS
  // ─────────────────────────────────────────────
  const removeToast = useCallback((id) => setToasts(p => p.filter(t => t.id !== id)), []);
  const toast = useCallback((text, type = 'info', ms = 5000) => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p.slice(-4), { id, text, type }]);
    if (type !== 'error') setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), ms);
  }, []);

  // ─────────────────────────────────────────────
  // ONLINE / OFFLINE
  // ─────────────────────────────────────────────
  useEffect(() => {
    const on = () => {
      setIsOnline(true);
      setToasts(p => [...p.slice(-4), { id: Date.now(), text: 'Connection restored.', type: 'success' }]);
    };
    const off = () => {
      setIsOnline(false);
      setToasts(p => [...p.slice(-4), { id: Date.now(), text: 'Offline — actions queued.', type: 'warning' }]);
    };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Drain queue when back online
  useEffect(() => {
    if (isOnline && queueRef.current.length > 0) drainQueue();
  }, [isOnline]);

  // ─────────────────────────────────────────────
  // SUPABASE API
  // ─────────────────────────────────────────────
  const baseUrl = () => { let u = sbUrl.trim().replace(/\/$/, ''); if (u && !u.startsWith('http')) u = `https://${u}`; return u; };
  const headers = () => ({ apikey: sbKey.trim(), Authorization: `Bearer ${sbKey.trim()}`, 'Content-Type': 'application/json', Prefer: 'return=representation' });

  const dbFetch = async (table, opts = {}) => {
    const { order = 'date.desc', filter = '', limit = 1000 } = opts;
    let all = [], offset = 0, more = true;
    while (more) {
      let url = `${baseUrl()}/rest/v1/${table}?select=*&order=${order}&limit=${limit}&offset=${offset}`;
      if (filter) url += `&${filter}`;
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(url, { headers: headers(), signal: ctrl.signal });
      clearTimeout(tid);
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || `HTTP ${res.status}`); }
      const data = await res.json();
      all = [...all, ...data];
      more = data.length === limit;
      offset += limit;
    }
    return all;
  };

  const dbWrite = async (method, table, payload, id = null) => {
    if (!isOnline) {
      const item = { method, table, payload, id, ts: Date.now() };
      const nq = [...queueRef.current, item];
      setQueue(nq); queueRef.current = nq;
      localStorage.setItem('belle_queue', JSON.stringify(nq));
      toast('Offline — action queued.', 'warning');
      return false;
    }
    const url = id ? `${baseUrl()}/rest/v1/${table}?id=eq.${id}` : `${baseUrl()}/rest/v1/${table}`;
    const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(payload) });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || `HTTP ${res.status}`); }
    return true;
  };

  const drainQueue = async () => {
    const q = [...queueRef.current];
    if (!q.length) return;
    let ok = 0; const fail = [];
    for (const a of q) {
      try { await dbWrite(a.method, a.table, a.payload, a.id); ok++; }
      catch { fail.push(a); }
    }
    setQueue(fail); queueRef.current = fail;
    localStorage.setItem('belle_queue', JSON.stringify(fail));
    if (ok > 0) { toast(`${ok} queued action(s) synced.`, 'success'); await sync(); }
  };

  // ─────────────────────────────────────────────
  // SYNC
  // ─────────────────────────────────────────────
  const sync = async () => {
    if (!sbUrl || !sbKey) { toast('Missing credentials.', 'error'); return; }
    setLoading(true);
    const safe = async (t, o) => { try { return await dbFetch(t, o); } catch (e) { console.warn(t, e.message); return []; } };
    try {
      const txs = await dbFetch('transactions', { order: 'date.desc' });
      const [exps, invs] = await Promise.all([safe('expenses', { order: 'date.desc' }), safe('investors', { order: 'name.asc' })]);
      setTransactions(txs || []);
      setExpenses(exps || []);
      setInvestors(invs || []);
      setIsLive(true);
    } catch (err) {
      setIsLive(false);
      toast(err.message?.includes('relation') ? "Auth OK — 'transactions' table missing." : `Auth Failed: ${err.message}`, 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (sbUrl && sbKey) sync(); }, []);

  // ─────────────────────────────────────────────
  // MEMOIZED DATA
  // ─────────────────────────────────────────────
  const safeTx  = useMemo(() => Array.isArray(transactions) ? transactions : [], [transactions]);
  const safeExp = useMemo(() => Array.isArray(expenses) ? expenses : [], [expenses]);
  const safeInv = useMemo(() => Array.isArray(investors) ? investors : [], [investors]);

  // All-time metrics
  const metrics = useMemo(() => {
    let sales = 0, paid = 0, expTotal = 0;
    const treasury = { GCash: 0, Cash: 0, BDO: 0, BPI: 0, COD: 0, Other: 0 };
    const assign = (mode, amt) => {
      const k = Object.keys(treasury).find(k => String(mode).toLowerCase().includes(k.toLowerCase())) || 'Other';
      treasury[k] += amt;
    };
    safeTx.forEach(t => { sales += parseNum(t.sales); paid += parseNum(t.paid); assign(t.payment_mode, parseNum(t.paid)); });
    safeExp.forEach(e => { expTotal += parseNum(e.amount); assign(e.payment_mode, -parseNum(e.amount)); });
    return { sales, paid, debt: sales - paid, expenses: expTotal, netProfit: paid - expTotal, pct: sales > 0 ? (paid / sales) * 100 : 0, treasury, totalTx: safeTx.length, completedTx: safeTx.filter(t => parseNum(t.paid) >= parseNum(t.sales)).length };
  }, [safeTx, safeExp]);

  // Aggregated analytics + trend
  const analytics = useMemo(() => {
    const agg = {};
    safeTx.forEach(t => {
      const d = new Date(t.date);
      if (isNaN(d.getTime())) return;
      let key = t.date;
      if (timeframe === 'Monthly') key = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      else if (timeframe === 'Annual') key = `${d.getFullYear()}`;
      else if (timeframe === 'Weekly') {
        const dn = d.getDay() || 7; const mon = new Date(d); mon.setDate(d.getDate() - (dn - 1));
        key = `Wk ${mon.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      }
      if (!agg[key]) agg[key] = { date: key, sales: 0, paid: 0, transactions: 0, ts: d.getTime() };
      agg[key].sales += parseNum(t.sales); agg[key].paid += parseNum(t.paid); agg[key].transactions++;
    });
    return Object.values(agg).map(a => ({ ...a, debt: a.sales - a.paid })).sort((a, b) => b.ts - a.ts);
  }, [safeTx, timeframe]);

  const currentPeriod  = analytics[0] || null;
  const previousPeriod = analytics[1] || null;

  // Debt aging
  const aging = useMemo(() => {
    const b = { d7: 0, d30: 0, d90: 0, old: 0 };
    safeTx.forEach(t => {
      const debt = parseNum(t.sales) - parseNum(t.paid);
      if (debt <= 0) return;
      const age = daysSince(t.date);
      if (age <= 7) b.d7 += debt; else if (age <= 30) b.d30 += debt; else if (age <= 90) b.d90 += debt; else b.old += debt;
    });
    return b;
  }, [safeTx]);

  // Client portfolio
  const portfolio = useMemo(() => {
    const agg = {};
    safeTx.forEach(t => {
      const n = t.miner_name; if (!n) return;
      if (!agg[n]) agg[n] = { name: n, count: 0, sales: 0, paid: 0, unpaid: 0, history: [], last: null };
      const sl = parseNum(t.sales), pd = parseNum(t.paid);
      agg[n].count++; agg[n].sales += sl; agg[n].paid += pd;
      if (sl - pd > 0.05) agg[n].unpaid++;
      agg[n].history.push(t);
      if (!agg[n].last || t.date > agg[n].last) agg[n].last = t.date;
    });
    return Object.values(agg).map(m => {
      const debt = m.sales - m.paid;
      const age = getDebtAge(m.history);
      let risk = 'Low Risk';
      if (debt > 0 && m.unpaid >= 3) risk = 'High Risk';
      else if (debt > 2000 || (debt > 0 && age > 30)) risk = 'Medium Risk';
      return { ...m, debt, age, risk };
    }).sort((a, b) => b.debt - a.debt);
  }, [safeTx]);

  // Top 5 clients
  const top5ByLTV   = useMemo(() => [...portfolio].sort((a, b) => b.sales - a.sales).slice(0, 5), [portfolio]);
  const top5ByDebt  = useMemo(() => [...portfolio].filter(p => p.debt > 0).sort((a, b) => b.debt - a.debt).slice(0, 5), [portfolio]);

  // Expense breakdown for donut
  const expByCategory = useMemo(() => {
    const agg = {};
    safeExp.forEach(e => { const k = e.category || 'Other'; agg[k] = (agg[k] || 0) + parseNum(e.amount); });
    return Object.entries(agg).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [safeExp]);

  // Rider tasks
  const riderTasks = useMemo(() => safeTx.filter(t => t.fulfillment?.toLowerCase() === 'rider' && t.status !== 'Completed'), [safeTx]);
  const riderDone  = useMemo(() => safeTx.filter(t => t.fulfillment?.toLowerCase() === 'rider' && t.status === 'Completed'), [safeTx]);

  // Filtered transactions
  const filteredTx = useMemo(() => {
    return safeTx.filter(t => {
      const q = txSearch.toLowerCase();
      const matchQ = !txSearch || String(t.miner_name).toLowerCase().includes(q) || String(t.date).includes(q);
      const matchFrom = !dateFrom || t.date >= dateFrom;
      const matchTo   = !dateTo   || t.date <= dateTo;
      const matchSt   = statusFilter === 'All' || (statusFilter === 'Completed' ? parseNum(t.paid) >= parseNum(t.sales) : parseNum(t.paid) < parseNum(t.sales));
      return matchQ && matchFrom && matchTo && matchSt;
    });
  }, [safeTx, txSearch, dateFrom, dateTo, statusFilter]);

  useEffect(() => { setTxPage(1); }, [txSearch, dateFrom, dateTo, statusFilter]);

  const pageTx  = filteredTx.slice((txPage - 1) * PER_PAGE, txPage * PER_PAGE);
  const totalTxPages = Math.ceil(filteredTx.length / PER_PAGE);

  const filteredClients = useMemo(() => {
    if (!clientSearch) return portfolio;
    const q = clientSearch.toLowerCase();
    return portfolio.filter(p => p.name.toLowerCase().includes(q));
  }, [portfolio, clientSearch]);

  useEffect(() => { setMinerPage(1); }, [clientSearch]);
  const pageClients = filteredClients.slice((minerPage - 1) * PER_PAGE, minerPage * PER_PAGE);
  const totalClientPages = Math.ceil(filteredClients.length / PER_PAGE);

  // ─────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────
  const doCreate = async () => {
    if (!newTx.miner_name?.trim()) { toast('Client name required.', 'error'); return; }
    setLoading(true);
    try {
      await dbWrite('POST', 'transactions', { ...newTx, sales: parseNum(newTx.sales), paid: parseNum(newTx.paid) });
      await sync(); setEntryModal(false); setNewTx(defaultTx());
      toast('Transaction logged.', 'success');
    } catch (e) { toast(`Error: ${e.message}`, 'error'); } finally { setLoading(false); }
  };

  const doEdit = async () => {
    if (!editTx.miner_name?.trim()) { toast('Client name required.', 'error'); return; }
    setLoading(true);
    try {
      await dbWrite('PATCH', 'transactions', { ...editTx, sales: parseNum(editTx.sales), paid: parseNum(editTx.paid) }, editTx.id);
      await sync(); setEditModal(null);
      toast('Transaction updated.', 'success');
    } catch (e) { toast(`Error: ${e.message}`, 'error'); } finally { setLoading(false); }
  };

  const doDelete = async () => {
    if (!deleteModal) return;
    setLoading(true);
    try {
      await dbWrite('DELETE', deleteModal.type, {}, deleteModal.id);
      await sync(); setDeleteModal(null);
      toast('Record deleted.', 'success');
    } catch (e) { toast(`Error: ${e.message}`, 'error'); } finally { setLoading(false); }
  };

  const doQuickPay = async () => {
    if (!payModal) return;
    const amt = parseNum(payAmount);
    if (amt <= 0) { toast('Enter a valid amount.', 'error'); return; }
    const newPaid = parseNum(payModal.paid) + amt;
    setLoading(true);
    try {
      await dbWrite('PATCH', 'transactions', { paid: newPaid, status: newPaid >= parseNum(payModal.sales) ? 'Completed' : 'Pending' }, payModal.id);
      await sync(); setPayModal(null); setPayAmount('');
      toast(`Payment of ${formatPHP(amt)} recorded.`, 'success');
    } catch (e) { toast(`Error: ${e.message}`, 'error'); } finally { setLoading(false); }
  };

  const doCreateExp = async () => {
    if (!newExp.category?.trim()) { toast('Category required.', 'error'); return; }
    setLoading(true);
    try {
      await dbWrite('POST', 'expenses', { ...newExp, amount: parseNum(newExp.amount) });
      await sync(); setExpModal(false); setNewExp(defaultExp());
      toast('Expense logged.', 'success');
    } catch (e) { toast(`Error: ${e.message}`, 'error'); } finally { setLoading(false); }
  };

  const doBulkSettle = async (client) => {
    const unpaidTxs = client.history.filter(t => parseNum(t.sales) - parseNum(t.paid) > 0.05);
    if (!unpaidTxs.length) { toast('No outstanding balances.', 'info'); return; }
    setLoading(true);
    try {
      await Promise.all(unpaidTxs.map(t => dbWrite('PATCH', 'transactions', { paid: parseNum(t.sales), status: 'Completed' }, t.id)));
      await sync(); setClientModal(null);
      toast(`${unpaidTxs.length} transaction(s) settled for ${client.name}.`, 'success');
    } catch (e) { toast(`Error: ${e.message}`, 'error'); } finally { setLoading(false); }
  };

  const doRiderDelivery = async () => {
    if (!riderModal) return;
    const amt = parseNum(riderAmount);
    if (amt <= 0) { toast('Enter amount.', 'error'); return; }
    const newPaid = parseNum(riderModal.paid) + amt;
    setLoading(true);
    try {
      await dbWrite('PATCH', 'transactions', { paid: newPaid, payment_mode: riderMode, status: newPaid >= parseNum(riderModal.sales) ? 'Completed' : 'Pending' }, riderModal.id);
      await sync(); setRiderModal(null); setRiderAmount(''); setRiderMode('Cash');
      toast('Delivery confirmed.', 'success');
    } catch (e) { toast(`Error: ${e.message}`, 'error'); } finally { setLoading(false); }
  };

  const doInvoice = async (row) => {
    const client = portfolio.find(p => p.name === row.miner_name);
    const debt = parseNum(row.sales) - parseNum(row.paid);
    setInvoiceModal({ name: row.miner_name, debt });
    setAiLoading(true); setAiMsg('');
    const msg = await generateAIInvoice(row.miner_name, debt, client?.history, gemKey);
    setAiMsg(msg); setAiLoading(false);
  };

  const exportCSV = () => {
    let csv = `data:text/csv;charset=utf-8,"BELLE'S ENTERPRISE v3.0 — REPORT"\n"Generated","${new Date().toLocaleString()}"\n\n`;
    csv += `"METRICS"\n"Revenue","${metrics.sales}"\n"Collected","${metrics.paid}"\n"Receivables","${metrics.debt}"\n"Net Profit","${metrics.netProfit}"\n\n`;
    csv += `"TRANSACTIONS"\n"Date","Client","Gross","Paid","Fulfillment","Payment","Status"\n`;
    safeTx.forEach(t => { csv += `"${t.date}","${t.miner_name}","${parseNum(t.sales)}","${parseNum(t.paid)}","${t.fulfillment}","${t.payment_mode}","${t.status}"\n`; });
    const a = document.createElement('a'); a.href = encodeURI(csv);
    a.download = `Belles_v3_${todayISO()}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast('CSV exported.', 'success');
  };

  const logout = () => { sessionStorage.clear(); setIsLive(false); setTransactions([]); setExpenses([]); setInvestors([]); };

  const saveGoal = () => {
    const g = parseNum(goalInput);
    setGoal(g); localStorage.setItem('belle_goal', g);
    setShowGoalEdit(false); setGoalInput('');
    toast('Goal updated.', 'success');
  };

  // ═══════════════════════════════════════════════════════════════
  // LOGIN
  // ═══════════════════════════════════════════════════════════════
  if (!isLive) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex items-center justify-center p-4 font-sans">
        <Toasts toasts={toasts} remove={removeToast} />
        <div className="bg-white rounded-2xl p-8 sm:p-10 w-full max-w-md shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <DatabaseZap size={26} className="text-white" />
            </div>
            <h1 className="text-2xl font-black text-slate-900">Belle's Enterprise</h1>
            <p className="text-slate-500 text-sm mt-1">v3.0 · Operational Command Platform</p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            {[{ r: 'admin', label: 'Command Center', icon: LayoutDashboard, c: 'indigo' }, { r: 'rider', label: 'Rider Portal', icon: Bike, c: 'emerald' }].map(({ r, label, icon: Icon, c }) => (
              <button key={r} onClick={() => setRole(r)}
                className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${role === r ? `border-${c}-500 bg-${c}-50 text-${c}-700` : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                <Icon size={22} /><span className="text-[11px] font-bold uppercase tracking-wide">{label}</span>
              </button>
            ))}
          </div>

          <div className="space-y-4 mb-6">
            <div><label className={lbl}>Supabase URL</label><input type="url" value={sbUrl} onChange={e => setSbUrl(e.target.value)} className={inp} placeholder="https://xyz.supabase.co" /></div>
            <div><label className={lbl}>Anon Key</label>
              <div className="relative">
                <input type={showKey ? 'text' : 'password'} value={sbKey} onChange={e => setSbKey(e.target.value)} className={inp + ' pr-10'} placeholder="eyJhbGci..." />
                <button type="button" onClick={() => setShowKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showKey ? <EyeOff size={14} /> : <Eye size={14} />}</button>
              </div>
            </div>
            <div><label className={lbl}>Gemini Key <span className="normal-case font-normal text-slate-400">(optional)</span></label>
              <input type="password" value={gemKey} onChange={e => setGemKey(e.target.value)} className={inp} placeholder="AIzaSy..." />
            </div>
          </div>

          <button onClick={() => { sessionStorage.setItem('sb_url', sbUrl); sessionStorage.setItem('sb_key', sbKey); sessionStorage.setItem('app_role', role); if (gemKey) sessionStorage.setItem('gem_key', gemKey); sync(); }}
            disabled={loading || !sbUrl || !sbKey}
            className={`w-full py-3.5 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 ${role === 'admin' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} />}
            {loading ? 'Connecting...' : `Launch ${role === 'admin' ? 'Admin Hub' : 'Rider App'}`}
          </button>
          <p className="text-center text-[10px] text-slate-400 mt-3">Credentials stored in session only. Cleared on tab close.</p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RIDER APP
  // ═══════════════════════════════════════════════════════════════
  if (role === 'rider') {
    return (
      <div className="min-h-screen bg-slate-100 font-sans flex flex-col max-w-md mx-auto relative">
        <Toasts toasts={toasts} remove={removeToast} />
        {!isOnline && <div className="bg-amber-500 text-white text-xs font-bold py-2 text-center flex items-center justify-center gap-2 z-50"><WifiOff size={12} /> Offline Mode</div>}

        {/* Header */}
        <header className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-6 pb-10 rounded-b-3xl shadow-xl sticky top-0 z-20">
          <div className="flex justify-between items-center mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl"><Bike size={20} /></div>
              <div><span className="font-black text-base block">Rider Portal</span><span className="text-emerald-200 text-[10px] font-bold uppercase tracking-widest">Belle's Enterprise v3</span></div>
            </div>
            <button onClick={logout} className="p-2 bg-white/10 rounded-full hover:bg-white/20"><LogOut size={16} /></button>
          </div>
          <div className="flex justify-between items-end">
            <div>
              <div className="text-emerald-200 text-[10px] font-bold uppercase tracking-widest mb-1">
                {riderView === 'tasks' ? 'Pending Deliveries' : 'Completed Today'}
              </div>
              <div className="text-4xl font-black">{riderView === 'tasks' ? riderTasks.length : riderDone.length}</div>
            </div>
            <button onClick={sync} disabled={loading} className="flex items-center gap-2 bg-white text-emerald-700 px-4 py-2 rounded-full text-xs font-black shadow-md active:scale-95">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Sync
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-3 pb-28">
          {riderView === 'tasks' ? (
            riderTasks.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4"><CheckSquare size={36} /></div>
                <h3 className="text-xl font-black text-slate-700 mb-2">All clear!</h3>
                <p className="text-sm text-slate-500">No pending deliveries right now.</p>
              </div>
            ) : riderTasks.map(t => (
              <div key={t.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t.date}</div>
                    <h4 className="text-lg font-black text-slate-800">{t.miner_name}</h4>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded uppercase">{t.payment_mode || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Collect</div>
                    <div className="text-xl font-black text-emerald-600">{formatPHP(parseNum(t.sales) - parseNum(t.paid))}</div>
                  </div>
                </div>
                <button onClick={() => { setRiderModal(t); setRiderAmount((parseNum(t.sales) - parseNum(t.paid)).toFixed(2)); setRiderMode(t.payment_mode || 'Cash'); }}
                  className="w-full bg-slate-900 text-white py-3.5 rounded-xl text-sm font-black active:scale-95 transition-transform flex items-center justify-center gap-2">
                  <CheckCircle2 size={16} /> Process Handover
                </button>
              </div>
            ))
          ) : (
            riderDone.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <History size={40} className="mx-auto mb-4 text-slate-300" />
                <p className="font-semibold">No completed deliveries yet.</p>
              </div>
            ) : riderDone.map(t => (
              <div key={t.id} className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-100">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{t.date}</div>
                    <h4 className="text-base font-black text-slate-700">{t.miner_name}</h4>
                    <span className="text-[10px] font-bold text-emerald-600">{t.payment_mode}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-slate-800">{formatPHP(parseNum(t.sales))}</div>
                    <div className="text-[10px] font-bold text-emerald-500 mt-0.5">COMPLETED</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bottom Nav */}
        <div className="bg-white border-t border-slate-200 p-4 fixed bottom-0 w-full max-w-md flex justify-around items-center z-20">
          <button onClick={() => setRiderView('tasks')} className={`flex flex-col items-center gap-1 ${riderView === 'tasks' ? 'text-emerald-600' : 'text-slate-400'}`}>
            <Truck size={20} /><span className="text-[10px] font-bold">Deliveries</span>
          </button>
          <button onClick={() => setRiderView('history')} className={`flex flex-col items-center gap-1 ${riderView === 'history' ? 'text-emerald-600' : 'text-slate-400'}`}>
            <History size={20} /><span className="text-[10px] font-bold">History</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-slate-400">
            <UserCircle size={20} /><span className="text-[10px] font-bold">Profile</span>
          </button>
        </div>

        {/* Rider Handover Modal */}
        {riderModal && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-end justify-center">
            <div className="bg-white rounded-t-3xl p-8 w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-slate-800">Complete Delivery</h3>
                <button onClick={() => setRiderModal(null)} className="p-2 bg-slate-100 rounded-full"><X size={18} /></button>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl mb-5">
                <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Delivering to</div>
                <div className="text-lg font-black text-slate-800">{riderModal.miner_name}</div>
                <div className="text-sm font-bold text-emerald-700 mt-1">Expected: {formatPHP(parseNum(riderModal.sales) - parseNum(riderModal.paid))}</div>
              </div>
              <div className="space-y-4">
                <div><label className={lbl}>Amount Collected (PHP)</label>
                  <input type="number" value={riderAmount} onChange={e => setRiderAmount(e.target.value)} className={inp + ' text-emerald-700 font-black text-lg'} step="0.01" /></div>
                <div><label className={lbl}>Payment Method</label>
                  <select value={riderMode} onChange={e => setRiderMode(e.target.value)} className={inp}>
                    <option value="Cash">Cash on Delivery</option>
                    <option value="GCash">GCash</option>
                    <option value="BDO">BDO Transfer</option>
                    <option value="Unpaid">Left Unpaid (Credit)</option>
                  </select></div>
                <button onClick={doRiderDelivery} disabled={loading}
                  className="w-full bg-emerald-600 text-white py-4 rounded-xl font-black text-base shadow-lg active:scale-95 flex items-center justify-center gap-2">
                  {loading ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}Confirm & Sync
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // ADMIN COMMAND CENTER
  // ═══════════════════════════════════════════════════════════════
  const navItems = [
    { id: 'analytics', label: 'Financial Analytics', icon: BarChart3 },
    { id: 'registry',  label: 'Master Ledger',       icon: DatabaseZap },
    { id: 'customers', label: 'Client Risk Matrix',  icon: Users },
    { id: 'treasury',  label: 'Treasury & Burn',     icon: Landmark },
    { id: 'investors', label: 'Investor Relations',  icon: Users2 },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-800 overflow-hidden">
      <Toasts toasts={toasts} remove={removeToast} />

      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white text-xs font-bold py-2 text-center flex items-center justify-center gap-2 z-50">
          <WifiOff size={12} /> Offline — {queue.length} action(s) queued
        </div>
      )}

      {sidebar && <div className="fixed inset-0 bg-slate-900/60 z-30 md:hidden" onClick={() => setSidebar(false)} />}

      {/* ── SIDEBAR ── */}
      <aside className={`${sidebar ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:static inset-y-0 left-0 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-300 z-40 print:hidden`}>
        <div className="h-20 flex items-center px-5 border-b border-slate-800">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center mr-3 shadow-lg">
            <DatabaseZap size={17} className="text-white" />
          </div>
          <div>
            <span className="text-sm font-black text-white block">Belle's Command</span>
            <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Enterprise v3.0</span>
          </div>
          <button className="ml-auto md:hidden p-1.5 hover:bg-slate-800 rounded" onClick={() => setSidebar(false)}><X size={15} className="text-slate-400" /></button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="text-[9px] font-bold uppercase text-slate-600 mb-3 px-3 tracking-widest">Executive Views</div>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { setView(id); setSidebar(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${view === id ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/25' : 'hover:bg-slate-800 text-slate-400 border border-transparent'}`}>
              <Icon size={16} />{label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2">
          <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border self-start ${isLive ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
            {isLive ? <Wifi size={10} /> : <WifiOff size={10} />}<span>{isLive ? 'Live' : 'Offline'}</span>
          </div>
          <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition-colors">
            <LogOut size={14} /> Close Session
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-5 z-20 shadow-sm print:hidden">
          <div className="flex items-center gap-2.5">
            <button onClick={() => setSidebar(true)} className="md:hidden p-2 bg-slate-50 border border-slate-200 rounded-lg"><Menu size={16} /></button>
            <button onClick={() => setEntryModal(true)} className={btnP}><Plus size={14} /><span>Log Transaction</span></button>
            <button onClick={() => setExpModal(true)} className={btnS}><TrendingDown size={13} /><span className="hidden sm:inline">Log Expense</span></button>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex gap-2">
              <button onClick={exportCSV} className={btnS}><FileText size={13} /><span>Export CSV</span></button>
              <button onClick={() => window.print()} className={btnS}><Printer size={13} /><span>Print</span></button>
            </div>
            <div className="hidden sm:block text-right border-l border-slate-200 pl-4">
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Net Profit</div>
              <div className={`text-sm font-black ${metrics.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}><AnimatedNumber value={metrics.netProfit} /></div>
            </div>
            <button onClick={sync} disabled={loading} className="p-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 active:scale-95 transition-all shadow-sm">
              <RefreshCw size={15} className={loading ? 'animate-spin text-indigo-400' : ''} />
            </button>
          </div>
        </header>

        {/* Page */}
        <div className="flex-1 overflow-auto p-5 bg-slate-50">
          <div className="max-w-7xl mx-auto space-y-5">

            {/* KPI Cards — always visible */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              {[
                { label: 'Gross Revenue',          val: metrics.sales,      prevVal: previousPeriod?.sales,    icon: Wallet,      c: 'text-slate-800',  bg: 'bg-slate-50',   bd: 'border-slate-200'  },
                { label: 'Realized Collections',   val: metrics.paid,       prevVal: previousPeriod?.paid,     icon: Banknote,    c: 'text-emerald-600',bg: 'bg-emerald-50', bd: 'border-emerald-100'},
                { label: 'Outstanding Receivables',val: metrics.debt,       prevVal: null,                     icon: AlertCircle, c: 'text-rose-600',   bg: 'bg-rose-50',    bd: 'border-rose-100'   },
                { label: 'Collection Efficiency',  val: metrics.pct,        prevVal: null,                     icon: Percent,     c: 'text-indigo-600', bg: 'bg-indigo-50',  bd: 'border-indigo-100', isPct: true },
              ].map((k, i) => (
                <div key={i} className={`bg-white p-5 rounded-xl border ${k.bd} shadow-sm`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-tight pr-2">{k.label}</span>
                    <div className={`p-1.5 ${k.bg} rounded-lg shrink-0`}><k.icon size={13} className={k.c} /></div>
                  </div>
                  <div className={`text-xl font-black ${k.c}`}><AnimatedNumber value={k.val} isPercent={k.isPct} /></div>
                  {k.prevVal !== undefined && k.prevVal !== null && <Trend current={k.val} previous={k.prevVal} />}
                  {!k.prevVal && <div className="text-[10px] text-slate-400 mt-1">{metrics.totalTx} transactions</div>}
                </div>
              ))}
            </div>

            {/* ══ ANALYTICS ══ */}
            {view === 'analytics' && (
              <div className="space-y-5">

                {/* Goal Tracker */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 rounded-lg border border-indigo-100"><Target size={15} className="text-indigo-600" /></div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">Monthly Revenue Goal</h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">Tracking current period performance</p>
                      </div>
                    </div>
                    <button onClick={() => { setShowGoalEdit(v => !v); setGoalInput(goal || ''); }} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                      <Edit3 size={11} /> {goal ? 'Edit Goal' : 'Set Goal'}
                    </button>
                  </div>
                  {showGoalEdit && (
                    <div className="flex gap-2 mb-4">
                      <input type="number" value={goalInput} onChange={e => setGoalInput(e.target.value)} className={inp + ' flex-1'} placeholder="e.g. 50000" />
                      <button onClick={saveGoal} className={btnP + ' px-4'}><Save size={14} /></button>
                      <button onClick={() => setShowGoalEdit(false)} className={btnS + ' px-3'}><X size={14} /></button>
                    </div>
                  )}
                  {goal > 0 ? (() => {
                    const current = currentPeriod?.sales || 0;
                    const pct = Math.min((current / goal) * 100, 100);
                    const remaining = Math.max(goal - current, 0);
                    return (
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-2">
                          <span className="text-slate-600">{formatPHP(current)} <span className="text-slate-400 font-medium">of {formatPHP(goal)} goal</span></span>
                          <span className={pct >= 100 ? 'text-emerald-600' : 'text-indigo-600'}>{pct.toFixed(1)}%</span>
                        </div>
                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-700 ${pct >= 100 ? 'bg-emerald-500' : pct >= 70 ? 'bg-indigo-500' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="mt-2 text-[10px] font-bold text-slate-400">
                          {pct >= 100 ? '🎉 Goal achieved this period!' : `${formatPHP(remaining)} remaining to reach goal`}
                        </div>
                      </div>
                    );
                  })() : (
                    <div className="text-center py-4 text-slate-400 text-xs font-medium">No goal set. Click "Set Goal" to track your progress.</div>
                  )}
                </div>

                {/* Chart */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-base font-black text-slate-800">Revenue Performance</h2>
                      <p className="text-slate-500 text-xs mt-0.5">Aggregated from master ledger</p>
                    </div>
                    <div className="flex p-1 bg-slate-100 rounded-lg border border-slate-200 self-start">
                      {['Daily','Weekly','Monthly','Annual'].map(t => (
                        <button key={t} onClick={() => setTimeframe(t)} className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${timeframe === t ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>{t}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <BarChart data={analytics} timeframe={timeframe} />

                {/* Debt Aging */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: '0–7 Days',       val: aging.d7,  c: 'text-slate-700',  bg: 'bg-slate-50',   bd: 'border-slate-200'  },
                    { label: '8–30 Days',      val: aging.d30, c: 'text-amber-700',  bg: 'bg-amber-50',   bd: 'border-amber-100'  },
                    { label: '31–90 Days',     val: aging.d90, c: 'text-orange-700', bg: 'bg-orange-50',  bd: 'border-orange-100' },
                    { label: '90+ Days (!)' ,  val: aging.old, c: 'text-rose-700',   bg: 'bg-rose-50',    bd: 'border-rose-100'   },
                  ].map((b, i) => (
                    <div key={i} className={`${b.bg} border ${b.bd} rounded-xl p-5`}>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Aged Debt · {b.label}</div>
                      <div className={`text-xl font-black ${b.c}`}>{formatPHP(b.val)}</div>
                    </div>
                  ))}
                </div>

                {/* Top 5 Widgets */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Top LTV */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center gap-3">
                      <div className="p-2 bg-amber-50 rounded-lg border border-amber-100"><Star size={14} className="text-amber-500" /></div>
                      <h3 className="text-sm font-bold text-slate-800">Top 5 by Lifetime Value</h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {top5ByLTV.map((c, i) => (
                        <div key={i} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 cursor-pointer" onClick={() => setClientModal(c)}>
                          <div className="flex items-center gap-3">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white ${['bg-amber-500','bg-slate-600','bg-orange-400','bg-slate-400','bg-slate-300'][i]}`}>{i + 1}</span>
                            <span className="text-sm font-bold text-slate-800">{c.name}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-black text-slate-800">{formatPHP(c.sales)}</div>
                            <div className="text-[10px] font-bold text-slate-400">{c.count} orders</div>
                          </div>
                        </div>
                      ))}
                      {!top5ByLTV.length && <div className="p-8 text-center text-slate-400 text-xs">No client data yet.</div>}
                    </div>
                  </div>

                  {/* Top Debtors */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center gap-3">
                      <div className="p-2 bg-rose-50 rounded-lg border border-rose-100"><AlertCircle size={14} className="text-rose-500" /></div>
                      <h3 className="text-sm font-bold text-slate-800">Top 5 Outstanding Balances</h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {top5ByDebt.map((c, i) => (
                        <div key={i} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 cursor-pointer" onClick={() => setClientModal(c)}>
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-[10px] font-black">{i + 1}</span>
                            <div>
                              <span className="text-sm font-bold text-slate-800 block">{c.name}</span>
                              <RiskBadge level={c.risk} />
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-black text-rose-600">{formatPHP(c.debt)}</div>
                            {c.age !== null && <div className="text-[10px] font-bold text-slate-400">{c.age}d old</div>}
                          </div>
                        </div>
                      ))}
                      {!top5ByDebt.length && <div className="p-8 text-center text-slate-400 text-xs">No outstanding balances. 🎉</div>}
                    </div>
                  </div>
                </div>

                {/* Analytics Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">Aggregated Report — {timeframe}</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="px-5 py-3">Period</th><th className="px-5 py-3 text-center">Tx</th>
                          <th className="px-5 py-3 text-right">Revenue</th><th className="px-5 py-3 text-right">Collected</th>
                          <th className="px-5 py-3 text-right">Receivables</th><th className="px-5 py-3 text-right">Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {analytics.slice(0, 15).map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-5 py-3 font-semibold text-slate-800">{r.date}</td>
                            <td className="px-5 py-3 text-center text-slate-500">{r.transactions}</td>
                            <td className="px-5 py-3 text-right font-semibold">{formatPHP(r.sales)}</td>
                            <td className="px-5 py-3 text-right font-semibold text-emerald-600">{formatPHP(r.paid)}</td>
                            <td className="px-5 py-3 text-right font-semibold text-rose-500">{formatPHP(r.debt)}</td>
                            <td className="px-5 py-3 text-right font-bold text-indigo-600">{r.sales > 0 ? ((r.paid / r.sales) * 100).toFixed(1) : 0}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ══ MASTER LEDGER ══ */}
            {view === 'registry' && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col" style={{ height: '76vh' }}>
                {/* Filters */}
                <div className="p-4 border-b border-slate-200 bg-slate-50/50 shrink-0 space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-3">
                      <h2 className="font-bold text-sm uppercase tracking-wider text-slate-800 flex items-center gap-2"><DatabaseZap size={14} className="text-indigo-500" />Master Ledger</h2>
                      <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-100">{filteredTx.length} records</span>
                    </div>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                      <input type="text" placeholder="Search client or date..." className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                        value={txSearch} onChange={e => setTxSearch(e.target.value)} />
                    </div>
                  </div>
                  {/* Date + Status filters */}
                  <div className="flex flex-wrap gap-2 items-center">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider"><Calendar size={11} />From</div>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium bg-white outline-none focus:ring-2 focus:ring-indigo-500" />
                    <span className="text-[10px] font-bold text-slate-400">to</span>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium bg-white outline-none focus:ring-2 focus:ring-indigo-500" />
                    {(dateFrom || dateTo) && <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-[10px] font-bold text-rose-500 hover:text-rose-700 flex items-center gap-1"><X size={10} />Clear</button>}
                    <div className="ml-auto flex p-0.5 bg-slate-100 rounded-lg border border-slate-200">
                      {['All','Pending','Completed'].map(s => (
                        <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${statusFilter === s ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>{s}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 sticky top-0 border-b border-slate-200 shadow-sm z-10">
                      <tr>
                        <th className="px-4 py-3.5">Date</th><th className="px-4 py-3.5">Client</th>
                        <th className="px-4 py-3.5 text-right">Gross</th><th className="px-4 py-3.5 text-right">Paid</th>
                        <th className="px-4 py-3.5 text-center">Method</th><th className="px-4 py-3.5 text-center">Status</th>
                        <th className="px-4 py-3.5 text-right print:hidden">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pageTx.map(row => (
                        <tr key={row.id} className="hover:bg-slate-50/70 group">
                          <td className="px-4 py-3 text-slate-500 font-medium text-xs whitespace-nowrap">{row.date}</td>
                          <td className="px-4 py-3 font-bold text-slate-800">{row.miner_name}</td>
                          <td className="px-4 py-3 text-right font-semibold">{formatPHP(parseNum(row.sales))}</td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-600">{formatPHP(parseNum(row.paid))}</td>
                          <td className="px-4 py-3 text-center"><span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase">{row.payment_mode || 'N/A'}</span></td>
                          <td className="px-4 py-3 text-center"><StatusBadge status={row.status} paid={row.paid} sales={row.sales} /></td>
                          <td className="px-4 py-3 text-right print:hidden">
                            <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setPayModal(row); setPayAmount((parseNum(row.sales) - parseNum(row.paid)).toFixed(2)); }} className="p-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded hover:bg-emerald-500 hover:text-white transition-all" title="Add Payment"><Banknote size={12} /></button>
                              <button onClick={() => doInvoice(row)} className="p-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded hover:bg-indigo-500 hover:text-white transition-all" title="Invoice"><ReceiptText size={12} /></button>
                              <button onClick={() => { setEditTx({ ...row }); setEditModal(row); }} className="p-1.5 bg-slate-50 text-slate-600 border border-slate-200 rounded hover:bg-slate-500 hover:text-white transition-all" title="Edit"><Edit3 size={12} /></button>
                              <button onClick={() => setDeleteModal({ id: row.id, type: 'transactions', label: row.miner_name })} className="p-1.5 bg-rose-50 text-rose-600 border border-rose-200 rounded hover:bg-rose-500 hover:text-white transition-all" title="Delete"><Trash2 size={12} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!pageTx.length && <div className="p-12 text-center text-slate-400 font-medium"><Search size={28} className="mx-auto mb-3 text-slate-300" />No records match your filters.</div>}
                </div>

                {totalTxPages > 1 && (
                  <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 shrink-0 text-xs font-bold text-slate-500">
                    <span>Showing {(txPage - 1) * PER_PAGE + 1}–{Math.min(txPage * PER_PAGE, filteredTx.length)} of {filteredTx.length}</span>
                    <div className="flex gap-2">
                      <button onClick={() => setTxPage(p => Math.max(1, p - 1))} disabled={txPage === 1} className={btnS + ' py-1.5 px-3 disabled:opacity-40'}><ChevronLeft size={12} />Prev</button>
                      <span className="px-3 py-1.5 text-indigo-600">{txPage}/{totalTxPages}</span>
                      <button onClick={() => setTxPage(p => Math.min(totalTxPages, p + 1))} disabled={txPage === totalTxPages} className={btnS + ' py-1.5 px-3 disabled:opacity-40'}>Next<ChevronRight size={12} /></button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ══ CLIENT RISK MATRIX ══ */}
            {view === 'customers' && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col" style={{ height: '76vh' }}>
                <div className="p-4 border-b border-slate-200 bg-slate-50/50 shrink-0 space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <h2 className="font-bold text-sm uppercase tracking-wider text-slate-800 flex items-center gap-2"><Users size={14} className="text-indigo-500" />Client Risk Matrix</h2>
                      <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-100">{filteredClients.length} clients</span>
                    </div>
                    <div className="flex gap-2 text-[10px] font-bold">
                      <span className="flex items-center gap-1 px-2 py-1 bg-rose-50 text-rose-600 rounded border border-rose-100"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" />High: {portfolio.filter(p => p.risk === 'High Risk').length}</span>
                      <span className="flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-600 rounded border border-amber-100"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Med: {portfolio.filter(p => p.risk === 'Medium Risk').length}</span>
                    </div>
                  </div>
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                    <input type="text" placeholder="Search client name..." className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                      value={clientSearch} onChange={e => setClientSearch(e.target.value)} />
                  </div>
                </div>

                <div className="flex-1 overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3.5">Client</th><th className="px-5 py-3.5 text-center">Orders</th>
                        <th className="px-5 py-3.5 text-right">Lifetime Value</th><th className="px-5 py-3.5 text-right">Balance</th>
                        <th className="px-5 py-3.5 text-center">Age</th><th className="px-5 py-3.5 text-center">Risk</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pageClients.map((m, i) => (
                        <tr key={i} className="hover:bg-slate-50 cursor-pointer" onClick={() => setClientModal(m)}>
                          <td className="px-5 py-3.5 font-bold text-indigo-600">{m.name}</td>
                          <td className="px-5 py-3.5 text-center text-slate-500 font-medium">{m.count}</td>
                          <td className="px-5 py-3.5 text-right font-semibold">{formatPHP(m.sales)}</td>
                          <td className="px-5 py-3.5 text-right font-bold text-rose-500">{formatPHP(m.debt)}</td>
                          <td className="px-5 py-3.5 text-center text-[10px] font-bold text-slate-500">{m.age !== null && m.debt > 0 ? `${m.age}d` : '—'}</td>
                          <td className="px-5 py-3.5 text-center"><RiskBadge level={m.risk} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!pageClients.length && <div className="p-12 text-center text-slate-400 font-medium"><Search size={28} className="mx-auto mb-3 text-slate-300" />No clients match your search.</div>}
                </div>

                {totalClientPages > 1 && (
                  <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 shrink-0 text-xs font-bold text-slate-500">
                    <span>Showing {(minerPage - 1) * PER_PAGE + 1}–{Math.min(minerPage * PER_PAGE, filteredClients.length)} of {filteredClients.length}</span>
                    <div className="flex gap-2">
                      <button onClick={() => setMinerPage(p => Math.max(1, p - 1))} disabled={minerPage === 1} className={btnS + ' py-1.5 px-3 disabled:opacity-40'}><ChevronLeft size={12} />Prev</button>
                      <button onClick={() => setMinerPage(p => Math.min(totalClientPages, p + 1))} disabled={minerPage === totalClientPages} className={btnS + ' py-1.5 px-3 disabled:opacity-40'}>Next<ChevronRight size={12} /></button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ══ TREASURY ══ */}
            {view === 'treasury' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 mb-5 text-slate-800 border-b border-slate-100 pb-4"><Landmark className="text-emerald-500" size={15} />Distributed Treasury</h3>
                  <div className="space-y-2.5">
                    {Object.entries(metrics.treasury).filter(([, v]) => parseNum(v) !== 0).sort(([, a], [, b]) => b - a).map(([k, v]) => {
                      const pct = metrics.paid > 0 ? (Math.abs(v) / metrics.paid) * 100 : 0;
                      return (
                        <div key={k} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                          <div>
                            <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{k}</span>
                            <div className="w-28 h-1.5 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
                              <div className={`h-full rounded-full ${parseNum(v) < 0 ? 'bg-rose-400' : 'bg-emerald-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                          </div>
                          <span className={`text-sm font-black ${parseNum(v) < 0 ? 'text-rose-600' : 'text-slate-800'}`}>{formatPHP(parseNum(v))}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-2 gap-3">
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl"><div className="text-[9px] font-bold text-rose-500 uppercase tracking-widest mb-1">Total OpEx</div><div className="font-black text-rose-700">{formatPHP(metrics.expenses)}</div></div>
                    <div className={`p-3 rounded-xl border ${metrics.netProfit >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                      <div className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${metrics.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>Net Profit</div>
                      <div className={`font-black ${metrics.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatPHP(metrics.netProfit)}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-5">
                    <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-slate-800"><PieChart className="text-rose-500" size={15} />Expense Breakdown</h3>
                    <button onClick={() => setExpModal(true)} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-100 flex items-center gap-1"><Plus size={11} />Add</button>
                  </div>
                  <DonutChart data={expByCategory} total={metrics.expenses} />
                  <div className="flex-1 overflow-auto mt-4 max-h-52 space-y-1.5 pr-1">
                    {safeExp.map((e, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                        <div>
                          <div className="text-xs font-bold text-slate-700">{e.category}</div>
                          <div className="text-[10px] font-medium text-slate-400 mt-0.5">{e.date} · {e.payment_mode}</div>
                          {e.notes && <div className="text-[10px] text-slate-400 italic">{e.notes}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-rose-500">-{formatPHP(parseNum(e.amount))}</span>
                          <button onClick={() => setDeleteModal({ id: e.id, type: 'expenses', label: e.category })} className="p-1 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={12} /></button>
                        </div>
                      </div>
                    ))}
                    {!safeExp.length && <div className="text-center py-8 text-slate-400 text-xs font-medium">No expenses logged yet.</div>}
                  </div>
                </div>
              </div>
            )}

            {/* ══ INVESTORS ══ */}
            {view === 'investors' && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-7">
                <div className="border-b border-slate-100 pb-5 mb-6">
                  <h2 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2 text-slate-800"><Users2 className="text-indigo-500" size={15} />Equity & Dividend Projections</h2>
                  <p className="text-xs text-slate-500 mt-1.5">Distributable profit: <strong className="text-emerald-600">{formatPHP(metrics.netProfit)}</strong></p>
                </div>
                {!safeInv.length ? (
                  <div className="text-center py-12 text-slate-400 text-sm">No investor records. Add via Supabase <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">investors</code> table.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {safeInv.map((inv, i) => {
                      const eq = parseNum(inv.equity);
                      const share = metrics.netProfit * (eq / 100);
                      const roi = parseNum(inv.capital) > 0 ? (share / parseNum(inv.capital)) * 100 : 0;
                      return (
                        <div key={i} className="p-6 rounded-xl border border-slate-200 hover:shadow-md transition-all">
                          <div className="flex justify-between items-start mb-5">
                            <div><div className="font-black text-lg text-slate-800">{inv.name}</div><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Equity Partner</div></div>
                            <span className="text-sm font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">{eq}%</span>
                          </div>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between"><span className="text-slate-500 font-semibold">Capital</span><span className="font-bold">{formatPHP(parseNum(inv.capital))}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 font-semibold">Withdrawn</span><span className="font-bold text-rose-600">{formatPHP(parseNum(inv.withdrawn))}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 font-semibold">ROI</span><span className={`font-bold ${roi >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{roi.toFixed(1)}%</span></div>
                            <div className="flex justify-between pt-3 mt-2 border-t border-slate-200">
                              <span className="font-black text-slate-600 uppercase tracking-wide">Dividend</span>
                              <span className={`font-black text-base ${share >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatPHP(share)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </main>

      {/* ═══════════════════════════════════════════
          MODALS
      ═══════════════════════════════════════════ */}

      {/* Create Transaction */}
      <Modal open={entryModal} onClose={() => setEntryModal(false)} title="New Ledger Entry" icon={Plus}>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className={lbl}>Client Name *</label><input type="text" value={newTx.miner_name} onChange={e => setNewTx({ ...newTx, miner_name: e.target.value })} className={inp} placeholder="e.g. Maria Santos" /></div>
          <div><label className={lbl}>Date</label><input type="date" value={newTx.date} onChange={e => setNewTx({ ...newTx, date: e.target.value })} className={inp} /></div>
          <div><label className={lbl}>Status</label><select value={newTx.status} onChange={e => setNewTx({ ...newTx, status: e.target.value })} className={inp}><option>Pending</option><option>Completed</option><option>Cancelled</option></select></div>
          <div><label className={lbl}>Gross Amount (PHP)</label><input type="number" value={newTx.sales} onChange={e => setNewTx({ ...newTx, sales: e.target.value })} className={inp} placeholder="0.00" step="0.01" /></div>
          <div><label className={lbl}>Amount Received</label><input type="number" value={newTx.paid} onChange={e => setNewTx({ ...newTx, paid: e.target.value })} className={inp + ' text-emerald-700 font-bold'} placeholder="0.00" step="0.01" /></div>
          <div><label className={lbl}>Fulfillment</label><select value={newTx.fulfillment} onChange={e => setNewTx({ ...newTx, fulfillment: e.target.value })} className={inp}><option>Pickup</option><option>Rider</option><option>Ship</option><option>N/A</option></select></div>
          <div><label className={lbl}>Payment Channel</label><select value={newTx.payment_mode} onChange={e => setNewTx({ ...newTx, payment_mode: e.target.value })} className={inp}><option>GCash</option><option>BDO</option><option>BPI</option><option>Cash</option><option>COD</option><option>Unpaid</option></select></div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setEntryModal(false)} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800">Cancel</button>
          <button onClick={doCreate} disabled={loading || !newTx.miner_name} className={btnP}>{loading ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}Commit to DB</button>
        </div>
      </Modal>

      {/* Edit Transaction */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Edit Transaction" icon={Edit3} iconColor="text-amber-600" iconBg="bg-amber-50">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className={lbl}>Client Name *</label><input type="text" value={editTx.miner_name} onChange={e => setEditTx({ ...editTx, miner_name: e.target.value })} className={inp} /></div>
          <div><label className={lbl}>Date</label><input type="date" value={editTx.date} onChange={e => setEditTx({ ...editTx, date: e.target.value })} className={inp} /></div>
          <div><label className={lbl}>Status</label><select value={editTx.status} onChange={e => setEditTx({ ...editTx, status: e.target.value })} className={inp}><option>Pending</option><option>Completed</option><option>Cancelled</option></select></div>
          <div><label className={lbl}>Gross Amount</label><input type="number" value={editTx.sales} onChange={e => setEditTx({ ...editTx, sales: e.target.value })} className={inp} step="0.01" /></div>
          <div><label className={lbl}>Amount Paid</label><input type="number" value={editTx.paid} onChange={e => setEditTx({ ...editTx, paid: e.target.value })} className={inp + ' text-emerald-700 font-bold'} step="0.01" /></div>
          <div><label className={lbl}>Fulfillment</label><select value={editTx.fulfillment} onChange={e => setEditTx({ ...editTx, fulfillment: e.target.value })} className={inp}><option>Pickup</option><option>Rider</option><option>Ship</option><option>N/A</option></select></div>
          <div><label className={lbl}>Payment Channel</label><select value={editTx.payment_mode} onChange={e => setEditTx({ ...editTx, payment_mode: e.target.value })} className={inp}><option>GCash</option><option>BDO</option><option>BPI</option><option>Cash</option><option>COD</option><option>Unpaid</option></select></div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setEditModal(null)} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800">Cancel</button>
          <button onClick={doEdit} disabled={loading || !editTx.miner_name} className="flex items-center gap-2 bg-amber-500 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-md hover:bg-amber-600 disabled:opacity-50 active:scale-95 transition-all">{loading ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}Save Changes</button>
        </div>
      </Modal>

      {/* Quick Pay Modal — replaces window.prompt() */}
      <Modal open={!!payModal} onClose={() => { setPayModal(null); setPayAmount(''); }} title="Record Payment" icon={Banknote} iconColor="text-emerald-600" iconBg="bg-emerald-50">
        {payModal && (
          <>
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl mb-5 flex justify-between items-center">
              <div><div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Client</div><div className="font-black text-slate-800">{payModal.miner_name}</div></div>
              <div className="text-right"><div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Outstanding</div><div className="font-black text-rose-600">{formatPHP(parseNum(payModal.sales) - parseNum(payModal.paid))}</div></div>
            </div>
            <div><label className={lbl}>Payment Amount (PHP)</label>
              <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} className={inp + ' text-emerald-700 font-black text-lg'} step="0.01" autoFocus />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setPayModal(null); setPayAmount(''); }} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800">Cancel</button>
              <button onClick={doQuickPay} disabled={loading || !payAmount} className={btnP}>{loading ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}Record Payment</button>
            </div>
          </>
        )}
      </Modal>

      {/* Add Expense */}
      <Modal open={expModal} onClose={() => setExpModal(false)} title="Log Expense" icon={TrendingDown} iconColor="text-rose-500" iconBg="bg-rose-50">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className={lbl}>Category *</label><input type="text" value={newExp.category} onChange={e => setNewExp({ ...newExp, category: e.target.value })} className={inp} placeholder="e.g. Rider Fee, Packaging" /></div>
          <div><label className={lbl}>Date</label><input type="date" value={newExp.date} onChange={e => setNewExp({ ...newExp, date: e.target.value })} className={inp} /></div>
          <div><label className={lbl}>Amount (PHP)</label><input type="number" value={newExp.amount} onChange={e => setNewExp({ ...newExp, amount: e.target.value })} className={inp + ' text-rose-600 font-bold'} placeholder="0.00" step="0.01" /></div>
          <div className="col-span-2"><label className={lbl}>Payment Channel</label><select value={newExp.payment_mode} onChange={e => setNewExp({ ...newExp, payment_mode: e.target.value })} className={inp}><option>GCash</option><option>BDO</option><option>BPI</option><option>Cash</option></select></div>
          <div className="col-span-2"><label className={lbl}>Notes</label><input type="text" value={newExp.notes} onChange={e => setNewExp({ ...newExp, notes: e.target.value })} className={inp} placeholder="Optional context..." /></div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setExpModal(false)} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800">Cancel</button>
          <button onClick={doCreateExp} disabled={loading || !newExp.category} className="flex items-center gap-2 bg-rose-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-md hover:bg-rose-700 disabled:opacity-50 active:scale-95 transition-all">{loading ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}Log Expense</button>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal open={!!deleteModal} onClose={() => setDeleteModal(null)} title="Confirm Delete" icon={Trash2} iconColor="text-rose-600" iconBg="bg-rose-50" maxW="max-w-sm">
        {deleteModal && (
          <>
            <p className="text-sm text-slate-600 font-medium mb-2">Are you sure you want to delete this record?</p>
            <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-sm font-bold text-rose-700 mb-5">"{deleteModal.label}"</div>
            <p className="text-xs text-slate-400 mb-5">This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteModal(null)} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800">Cancel</button>
              <button onClick={doDelete} disabled={loading} className="flex items-center gap-2 bg-rose-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-md hover:bg-rose-700 disabled:opacity-50 active:scale-95 transition-all">{loading ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}Delete</button>
            </div>
          </>
        )}
      </Modal>

      {/* Client Dossier */}
      <Modal open={!!clientModal} onClose={() => setClientModal(null)} title={clientModal?.name || 'Client'} icon={UserCircle} maxW="max-w-xl">
        {clientModal && (
          <>
            <div className="flex items-center gap-3 mb-5 -mt-2">
              <RiskBadge level={clientModal.risk} />
              <span className="text-[10px] font-bold text-slate-400">{clientModal.count} orders · LTV {formatPHP(clientModal.sales)}</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-200"><div className="text-base font-black text-slate-800">{formatPHP(clientModal.sales)}</div><div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Billed</div></div>
              <div className="text-center p-3 bg-emerald-50 rounded-xl border border-emerald-100"><div className="text-base font-black text-emerald-700">{formatPHP(clientModal.paid)}</div><div className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest mt-1">Paid</div></div>
              <div className="text-center p-3 bg-rose-50 rounded-xl border border-rose-100"><div className="text-base font-black text-rose-700">{formatPHP(clientModal.debt)}</div><div className="text-[9px] font-bold text-rose-400 uppercase tracking-widest mt-1">Balance</div></div>
            </div>
            {clientModal.debt > 0 && (
              <button onClick={() => doBulkSettle(clientModal)} disabled={loading}
                className="w-full mb-4 flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 rounded-xl text-sm font-black shadow-md hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50">
                {loading ? <RefreshCw size={15} className="animate-spin" /> : <CheckSquare size={15} />}
                Settle All Outstanding ({formatPHP(clientModal.debt)})
              </button>
            )}
            <div className="max-h-64 overflow-auto space-y-2 pr-1">
              {clientModal.history.map((h, i) => (
                <div key={i} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center">
                  <div><div className="text-sm font-bold text-slate-800">{h.date}</div><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{h.payment_mode} · {h.fulfillment}</div></div>
                  <div className="text-right">
                    <div className="font-black text-slate-800">{formatPHP(parseNum(h.sales))}</div>
                    <div className={`text-[10px] font-bold mt-0.5 ${parseNum(h.sales) > parseNum(h.paid) ? 'text-rose-500' : 'text-emerald-500'}`}>Paid: {formatPHP(parseNum(h.paid))}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Modal>

      {/* AI Invoice */}
      <Modal open={!!invoiceModal} onClose={() => setInvoiceModal(null)} title={gemKey ? 'AI-Powered Invoice' : 'Invoice Generator'} icon={Bot} iconColor="text-indigo-600" iconBg="bg-indigo-50">
        {invoiceModal && (
          <>
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-200 mb-4">
              <span className="text-xs font-bold text-slate-600">{invoiceModal.name}</span>
              <span className="text-sm font-black text-rose-600">{formatPHP(invoiceModal.debt)}</span>
            </div>
            {aiLoading ? (
              <div className="h-40 flex items-center justify-center gap-3 text-slate-500 text-sm font-medium">
                <RefreshCw size={18} className="animate-spin text-indigo-500" />
                {gemKey ? 'Gemini is composing...' : 'Generating...'}
              </div>
            ) : (
              <textarea readOnly className="w-full h-44 p-4 bg-white border border-slate-200 rounded-xl text-sm leading-relaxed outline-none resize-none font-medium text-slate-700 shadow-inner" value={aiMsg} />
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={() => { navigator.clipboard.writeText(aiMsg); setCopied(true); toast('Copied!', 'success'); setTimeout(() => setCopied(false), 2000); }}
                disabled={aiLoading || !aiMsg}
                className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 ${copied ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
                {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}{copied ? 'Copied!' : 'Copy Message'}
              </button>
              {gemKey && (
                <button onClick={async () => { const c = portfolio.find(p => p.name === invoiceModal.name); setAiLoading(true); setAiMsg(''); setAiMsg(await generateAIInvoice(invoiceModal.name, invoiceModal.debt, c?.history, gemKey)); setAiLoading(false); }}
                  disabled={aiLoading} className="px-4 py-3 border border-indigo-200 text-indigo-600 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-indigo-50 transition-colors">
                  <RefreshCw size={13} className={aiLoading ? 'animate-spin' : ''} />Regen
                </button>
              )}
            </div>
          </>
        )}
      </Modal>

    </div>
  );
}
