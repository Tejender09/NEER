import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
    Leaf, MessageCircle, Image as ImageIcon,
    FileText, ArrowLeft, Send, UploadCloud,
    MapPin, CheckCircle2, ChevronRight, Droplets,
    Search, ShieldAlert, Sparkles, AlertTriangle, Camera, ArrowRight,
    Zap, ChevronDown, Cloud, Wind, Sun, Thermometer,
    Users, ThumbsUp, Store, Tag, Clock, TrendingUp,
    CalendarDays, Bell, BellOff, Volume2, VolumeX, Mic
} from 'lucide-react';
import './index.css';

// ============================================================
//    ERROR BOUNDARY — To catch and display render crashes
//    ============================================================ */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) { return { hasError: true, error }; }
    componentDidCatch(error, info) { console.error("Render Crash:", error, info); }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: 40, background: '#111', color: '#f87171', height: '100vh', fontFamily: 'monospace' }}>
                    <h1 style={{ fontSize: '1.5rem' }}>CRITICAL UI CRASH</h1>
                    <p style={{ color: '#fff' }}>{this.state.error?.toString()}</p>
                    <button onClick={() => window.location.reload()} style={{ marginTop: 20, padding: '10px 20px', background: 'var(--primary)', border: 'none', borderRadius: 8 }}>Reload App</button>
                    <button onClick={() => { localStorage.clear(); window.location.reload(); }} style={{ marginLeft: 10, padding: '10px 20px', background: '#333', border: 'none', borderRadius: 8, color: '#999' }}>Clear Storage & Reset</button>
                </div>
            );
        }
        return this.props.children;
    }
}


const API = 'http://127.0.0.1:8000';

/* ============================================================
   Markdown-like formatter for AI responses
   ============================================================ */
const Fmt = ({ text }) => {
    if (!text) return null;

    // Safety check: ensure text is a string to prevent React crash (white screen)
    if (typeof text === 'object') {
        try {
            text = JSON.stringify(text, null, 2);
        } catch (e) {
            text = String(text);
        }
    } else if (typeof text !== 'string') {
        text = String(text);
    }

    const lines = text.split('\n');
    const out = [];
    let list = [];

    const parse = (line, k) => {
        const parts = line.split(/(\*\*.*?\*\*|\[.*?\]\(.*?\))/g);
        return parts.map((p, i) => {
            if (p.startsWith('**') && p.endsWith('**'))
                return <strong key={`${k}-${i}`}>{p.slice(2, -2)}</strong>;
            if (p.startsWith('[') && p.includes('](') && p.endsWith(')')) {
                const m = p.match(/\[(.*?)\]\((.*?)\)/);
                if (m) {
                    return (
                        <a key={`${k}-${i}`}
                            href={m[2].startsWith('http') ? m[2] : `https://${m[2]}`}
                            target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}>
                            {m[1]}
                        </a>
                    );
                }
            }
            return p;
        });
    };

    lines.forEach((line, i) => {
        const t = line.trim();
        if (t.startsWith('* ') || t.startsWith('- ')) {
            list.push(<li key={i}>{parse(t.substring(2), i)}</li>);
        } else {
            if (list.length) { out.push(<ul key={`ul-${i}`}>{list}</ul>); list = []; }
            if (t === '') out.push(<br key={i} />);
            else out.push(<p key={i}>{parse(line, i)}</p>);
        }
    });
    if (list.length) out.push(<ul key="ul-end">{list}</ul>);

    return <div className="fmt">{out}</div>;
};


/* ============================================================
   NEER Logo SVG
   ============================================================ */
const NeerLogo = ({ size = 48 }) => (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        {/* Water drop shape */}
        <path d="M24 4C24 4 8 20 8 30C8 38.837 15.163 46 24 46C32.837 46 40 38.837 40 30C40 20 24 4 24 4Z"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Inner wave */}
        <path d="M14 32C17 28 20 30 24 28C28 26 31 29 34 32"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
        {/* Leaf accent */}
        <path d="M24 22C24 22 28 18 32 18C32 18 30 24 24 26"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="24" cy="30" r="3" fill="currentColor" opacity="0.9" />
    </svg>
);

const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'];

const CROPS = ['Wheat', 'Rice', 'Maize', 'Cotton', 'Sugarcane', 'Tomato', 'Potato', 'Onion', 'Mustard', 'Soybean', 'Groundnut', 'Barley', 'Chickpea', 'Lentil', 'Bajra'];

/* ============================================================
   CUSTOM SELECT — Fully styled dropdown (React Portal)
   ============================================================ */
function CustomSelect({ value, onChange, options, style }) {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef(null);
    const listRef = useRef(null);
    const [coords, setCoords] = useState({ left: 0, top: 0, width: 0 });

    useEffect(() => {
        if (open && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setCoords({
                left: rect.left,
                top: rect.bottom + window.scrollY + 6,
                width: rect.width
            });
        }
    }, [open]);

    useEffect(() => {
        const handler = (e) => {
            if (open && triggerRef.current && !triggerRef.current.contains(e.target)) {
                if (listRef.current && listRef.current.contains(e.target)) return;
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    return (
        <div style={{ position: 'relative', width: '100%', ...style }}>
            <div
                ref={triggerRef}
                className={`field-input custom-select-trigger ${open ? 'active' : ''}`}
                onClick={() => setOpen(!open)}
                style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
                <ChevronDown size={14} style={{ color: 'var(--primary)', flexShrink: 0, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0)' }} />
            </div>

            {open && createPortal(
                <div
                    ref={listRef}
                    className="custom-select-list"
                    style={{
                        position: 'absolute',
                        left: `${coords.left}px`,
                        top: `${coords.top}px`,
                        width: `${coords.width}px`,
                        zIndex: 999999
                    }}
                >
                    {options.map((opt, i) => (
                        <div
                            key={opt}
                            className={`custom-select-option${opt === value ? ' active' : ''}`}
                            style={{
                                '--item-delay': `${i * 45}ms`,
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange(opt);
                                setOpen(false);
                            }}
                        >
                            {opt}
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
}

/* ============================================================
   DAY ADVISOR MODAL — full month view + live AI schedule
   ============================================================ */
const TASK_COLORS_ADV = { sowing: '#6ee7b7', irrigation: '#60a5fa', fertilizer: '#fbbf24', pesticide: '#f87171', harvesting: '#f4a261', preparation: '#a78bfa', other: '#94a3b8' };
const TASK_EMOJIS_ADV = { sowing: '🌱', irrigation: '💧', fertilizer: '🌿', pesticide: '🛡️', harvesting: '🌾', preparation: '⚙️', other: '📌' };
const MONTH_NAMES_ADV = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function DayAdvisorModal({ open, onClose, lang }) {
    const [calArr, setCalArr] = useState([]);
    const [calInfo, setCalInfo] = useState(null);
    const [viewMonth, setViewMonth] = useState(new Date().getMonth());
    const [viewYear, setViewYear] = useState(new Date().getFullYear());
    const [selectedDay, setSelectedDay] = useState(null);
    const [selectedTask, setSelectedTask] = useState(null);
    const [advisor, setAdvisor] = useState(null);
    const [advLoading, setAdvLoading] = useState(false);
    const [advError, setAdvError] = useState('');

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    useEffect(() => {
        if (!open) return;
        try {
            const saved = localStorage.getItem('neer_calendar');
            if (!saved) return;
            const cal = JSON.parse(saved);
            const arr = cal?.calendar?.calendar || cal?.calendar || [];
            setCalArr(arr);
            setCalInfo({ crop: cal.crop, state: cal.state });
        } catch (e) { }
    }, [open]);

    const fetchAdvisor = async (dateStr, task) => {
        if (!calInfo) return;
        setAdvisor(null); setAdvError(''); setAdvLoading(true);
        try {
            const r = await axios.post(`${API}/farm-advisor`, { state: calInfo.state, crop: calInfo.crop, task_type: task.type, date: dateStr, lang });
            setAdvisor(r.data);
        } catch (e) { setAdvError(e.response?.data?.detail || 'Could not fetch AI advice.'); }
        finally { setAdvLoading(false); }
    };

    const handleDayClick = (dayNum) => {
        const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        setSelectedDay({ date: dateStr, dayNum, tasks: calArr[viewMonth]?.tasks || [] });
        setSelectedTask(null); setAdvisor(null); setAdvError('');
    };

    const handleTaskClick = (task, dateStr) => { setSelectedTask(task); fetchAdvisor(dateStr, task); };

    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const monthTasks = calArr[viewMonth]?.tasks || [];

    if (!open) return null;

    return createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 99997, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s' }} onClick={onClose}>
            <div onClick={e => e.stopPropagation()} style={{ width: '94vw', maxWidth: 900, maxHeight: '92vh', background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 22, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.8)' }}>
                {/* Header */}
                <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                    <CalendarDays size={20} style={{ color: 'var(--primary)' }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                            Smart Farm Calendar
                            {calInfo && <span style={{ marginLeft: 10, fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>{calInfo.crop} · {calInfo.state}</span>}
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); }} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', color: 'var(--text-secondary)', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: '1rem' }}>‹</button>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem', minWidth: 100, textAlign: 'center' }}>{MONTH_NAMES_ADV[viewMonth]} {viewYear}</span>
                        <button onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); }} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', color: 'var(--text-secondary)', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: '1rem' }}>›</button>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.4rem', lineHeight: 1, padding: 4 }}>✕</button>
                </div>

                {/* Body */}
                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {/* Calendar column */}
                    <div style={{ width: 320, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.07)', padding: '14px 12px', overflowY: 'auto' }}>
                        {monthTasks.length > 0 && (
                            <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {[...new Set(monthTasks.map(t => t.type))].map(tp => (
                                    <span key={tp} style={{ fontSize: '0.65rem', background: `${TASK_COLORS_ADV[tp]}18`, color: TASK_COLORS_ADV[tp], borderRadius: 6, padding: '2px 7px', border: `1px solid ${TASK_COLORS_ADV[tp]}30`, fontWeight: 600 }}>
                                        {TASK_EMOJIS_ADV[tp]} {tp}
                                    </span>
                                ))}
                            </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 6 }}>
                            {DAY_NAMES.map(d => <div key={d} style={{ textAlign: 'center', fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, padding: '4px 0' }}>{d}</div>)}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                            {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} />)}
                            {Array(daysInMonth).fill(null).map((_, i) => {
                                const dayNum = i + 1;
                                const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                                const isToday = dateStr === todayStr;
                                const isSelected = selectedDay?.dayNum === dayNum;
                                const taskTypes = monthTasks.length > 0 ? [...new Set(monthTasks.map(t => t.type))] : [];
                                return (
                                    <div key={dayNum} onClick={() => handleDayClick(dayNum)} style={{ borderRadius: 9, padding: '6px 3px', textAlign: 'center', cursor: 'pointer', background: isSelected ? 'var(--primary)' : isToday ? 'rgba(0,232,162,0.1)' : 'rgba(255,255,255,0.03)', border: isToday && !isSelected ? '1.5px solid var(--primary)' : '1px solid rgba(255,255,255,0.05)', transition: 'all 0.15s' }}>
                                        <div style={{ fontSize: '0.76rem', fontWeight: isToday ? 700 : 400, color: isSelected ? '#041510' : isToday ? 'var(--primary)' : 'var(--text-primary)' }}>{dayNum}</div>
                                        {taskTypes.length > 0 && <div style={{ display: 'flex', justifyContent: 'center', gap: 1, marginTop: 2 }}>{taskTypes.slice(0, 3).map(tp => <div key={tp} style={{ width: 4, height: 4, borderRadius: '50%', background: isSelected ? 'rgba(4,21,16,0.5)' : TASK_COLORS_ADV[tp] }} />)}</div>}
                                    </div>
                                );
                            })}
                        </div>

                        {selectedDay && (
                            <div style={{ marginTop: 16, animation: 'fadeIn 0.2s' }}>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 10 }}>{selectedDay.date} Tasks</div>
                                {selectedDay.tasks.length === 0
                                    ? <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: 14 }}>No tasks</div>
                                    : selectedDay.tasks.map((task, ti) => {
                                        const col = TASK_COLORS_ADV[task.type] || '#94a3b8';
                                        const isActive = selectedTask?.type === task.type && selectedTask?.description === task.description;
                                        return (
                                            <div key={ti} onClick={() => handleTaskClick(task, selectedDay.date)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 11px', borderRadius: 11, marginBottom: 6, cursor: 'pointer', background: isActive ? `${col}22` : `${col}0e`, border: `1.5px solid ${isActive ? col : col + '28'}`, transition: 'all 0.15s' }}>
                                                <span style={{ fontSize: '1rem' }}>{TASK_EMOJIS_ADV[task.type] || '📌'}</span>
                                                <div>
                                                    <div style={{ fontSize: '0.6rem', color: col, fontWeight: 700, textTransform: 'uppercase' }}>{task.type}</div>
                                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>{task.description}</div>
                                                </div>
                                                {isActive && <div style={{ marginLeft: 'auto', color: col }}>●</div>}
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        )}
                    </div>

                    {/* AI Advisor column */}
                    <div style={{ flex: 1, padding: '18px 20px', overflowY: 'auto' }}>
                        {!selectedDay && (
                            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                                <CalendarDays size={48} style={{ opacity: 0.2, marginBottom: 14 }} />
                                <div style={{ fontSize: '0.9rem' }}>{lang === 'Hindi' ? 'किसी दिन पर क्लिक करें' : 'Click a day to see tasks'}</div>
                                <div style={{ fontSize: '0.73rem', marginTop: 5, opacity: 0.6 }}>{lang === 'Hindi' ? 'फिर कार्य चुनें — AI मौसम के अनुसार समय बताएगा' : 'Then tap a task — AI advises with live weather data'}</div>
                                {!calInfo && <div style={{ marginTop: 24, padding: '12px 18px', background: 'rgba(0,232,162,0.06)', borderRadius: 12, border: '1px solid rgba(0,232,162,0.15)', fontSize: '0.8rem', color: 'var(--primary)' }}>⚠️ {lang === 'Hindi' ? 'पहले Crop Calendar से कैलेंडर बनाएं' : 'Generate a calendar from Crop Calendar first'}</div>}
                            </div>
                        )}
                        {selectedDay && !selectedTask && (
                            <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '2rem', marginBottom: 10 }}>👆</div>
                                <div style={{ fontSize: '0.86rem' }}>{lang === 'Hindi' ? 'कोई कार्य चुनें' : 'Select a task to get AI schedule'}</div>
                                <div style={{ fontSize: '0.73rem', marginTop: 4, opacity: 0.6 }}>{lang === 'Hindi' ? 'AI मौसम डेटा से सटीक समय बताएगा' : 'AI uses live weather to find the best times today'}</div>
                            </div>
                        )}
                        {selectedTask && (
                            <div>
                                <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ fontSize: '1.5rem' }}>{TASK_EMOJIS_ADV[selectedTask.type]}</span>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{selectedTask.description}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{selectedDay.date} · {calInfo?.crop} · {calInfo?.state}</div>
                                    </div>
                                </div>
                                {advLoading && <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}><div className="typing-dots" style={{ justifyContent: 'center', marginBottom: 12 }}><span /><span /><span /></div><div style={{ fontSize: '0.82rem' }}>{lang === 'Hindi' ? '🌤️ मौसम + AI सलाह लोड हो रही है...' : '🌤️ Fetching live weather + generating schedule...'}</div></div>}
                                {advError && <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 12, padding: '12px 14px', color: '#f87171', fontSize: '0.83rem' }}>⚠️ {advError}</div>}
                                {advisor && !advLoading && (
                                    <div style={{ animation: 'fadeIn 0.3s' }}>
                                        {/* Weather strip */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 7, marginBottom: 16 }}>
                                            {[{ label: 'Max', value: `${advisor.weather_raw?.temp_max}°C`, icon: '🌡️' }, { label: 'Min', value: `${advisor.weather_raw?.temp_min}°C`, icon: '❄️' }, { label: 'Rain', value: `${advisor.weather_raw?.rain_total}mm`, icon: '🌧️' }, { label: 'Rain%', value: `${advisor.weather_raw?.rain_prob_max}%`, icon: '☁️' }].map(w => (
                                                <div key={w.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '9px 8px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)' }}>
                                                    <div style={{ fontSize: '1.1rem' }}>{w.icon}</div>
                                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 3 }}>{w.value}</div>
                                                    <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>{w.label}</div>
                                                </div>
                                            ))}
                                        </div>
                                        <div style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 11, padding: '9px 13px', fontSize: '0.8rem', color: '#60a5fa', marginBottom: 14 }}>🌤️ {advisor.weather_summary}</div>
                                        {advisor.skip_today && <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 11, padding: '11px 13px', fontSize: '0.83rem', color: '#f87171', marginBottom: 14 }}>⛔ <strong>{lang === 'Hindi' ? 'आज यह कार्य न करें' : 'Skip today'}</strong> — {advisor.skip_reason}</div>}
                                        {!advisor.skip_today && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                                <div style={{ background: 'rgba(0,232,162,0.1)', border: '1.5px solid rgba(0,232,162,0.3)', borderRadius: 13, padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary)' }}>{advisor.times_today}×</span>
                                                    <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>{lang === 'Hindi' ? 'आज इतनी बार' : 'sessions today'}</span>
                                                </div>
                                            </div>
                                        )}
                                        {(advisor.schedule || []).map((slot, si) => {
                                            const col = TASK_COLORS_ADV[selectedTask.type] || '#94a3b8';
                                            return (
                                                <div key={si} style={{ background: `${col}10`, border: `1px solid ${col}28`, borderRadius: 13, padding: '13px 15px', marginBottom: 9, animation: `selectItemIn 0.3s ease ${si * 70}ms both` }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                                                        <div style={{ background: col, borderRadius: 9, padding: '4px 11px', fontSize: '0.83rem', fontWeight: 800, color: '#041510', flexShrink: 0 }}>{slot.time}</div>
                                                        <div style={{ fontSize: '0.7rem', color: col, fontWeight: 600 }}>{slot.duration_minutes} min</div>
                                                    </div>
                                                    <div style={{ fontSize: '0.86rem', color: 'var(--text-primary)', marginBottom: 4 }}>{slot.action}</div>
                                                    <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>💡 {slot.reason}</div>
                                                </div>
                                            );
                                        })}
                                        {advisor.pro_tip && <div style={{ marginTop: 12, background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 11, padding: '10px 13px', fontSize: '0.8rem', color: '#a78bfa' }}>⚡ <strong>Pro tip:</strong> {advisor.pro_tip}</div>}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

/* ============================================================
   NOTIFICATION PANEL DRAWER
   ============================================================ */
function NotificationPanel({ open, onClose, onOpenCalendar, onOpenAdvisor, lang }) {
    const panelRef = useRef(null);
    const [tasks, setTasks] = useState([]);
    const [calInfo, setCalInfo] = useState(null);

    const TASK_EMOJIS = { sowing: '🌱', irrigation: '💧', fertilizer: '🌿', pesticide: '🛡️', harvesting: '🌾', preparation: '⚙️', other: '📌' };
    const TASK_COLORS_MAP = { sowing: '#6ee7b7', irrigation: '#60a5fa', fertilizer: '#fbbf24', pesticide: '#f87171', harvesting: '#f4a261', preparation: '#a78bfa', other: '#94a3b8' };
    const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    useEffect(() => {
        if (!open) return;
        try {
            const saved = localStorage.getItem('neer_calendar');
            if (!saved) { setTasks([]); return; }
            const cal = JSON.parse(saved);
            const arr = cal?.calendar?.calendar || cal?.calendar || [];
            const monthIdx = new Date().getMonth();
            const nextIdx = (monthIdx + 1) % 12;
            setCalInfo({ crop: cal.crop, state: cal.state });

            const thisMonthTasks = (arr[monthIdx]?.tasks || []).map(t => ({ ...t, month: MONTH_NAMES[monthIdx], isNow: true }));
            const nextMonthTasks = (arr[nextIdx]?.tasks || []).map(t => ({ ...t, month: MONTH_NAMES[nextIdx], isNow: false }));
            setTasks([...thisMonthTasks, ...nextMonthTasks]);
        } catch (e) { setTasks([]); }
    }, [open]);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = e => { if (panelRef.current && !panelRef.current.contains(e.target)) onClose(); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open, onClose]);

    const noCalendar = tasks.length === 0;

    return createPortal(
        <>
            {/* Backdrop */}
            <div style={{
                position: 'fixed', inset: 0, zIndex: 99998,
                background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
                opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
                transition: 'opacity 0.22s'
            }} onClick={onClose} />

            {/* Panel */}
            <div
                ref={panelRef}
                style={{
                    position: 'fixed', top: 56, right: 12, zIndex: 99999,
                    width: 340, maxHeight: 'calc(100vh - 80px)',
                    background: 'var(--bg-elevated)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 18,
                    boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,232,162,0.08)',
                    overflow: 'hidden', display: 'flex', flexDirection: 'column',
                    transform: open ? 'translateY(0) scale(1)' : 'translateY(-12px) scale(0.96)',
                    opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
                    transition: 'transform 0.25s cubic-bezier(0.22,1,0.36,1), opacity 0.22s',
                    transformOrigin: 'top right',
                }}
            >
                {/* Header */}
                <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Bell size={16} style={{ color: 'var(--primary)' }} />
                            {lang === 'Hindi' ? 'फार्म रिमाइंडर' : 'Farm Reminders'}
                        </div>
                        {calInfo && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{calInfo.crop} · {calInfo.state}</div>}
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, borderRadius: 8, fontSize: '1.1rem' }}>✕</button>
                </div>

                {/* Task list */}
                <div style={{ overflowY: 'auto', flex: 1, padding: '10px 12px' }}>
                    {noCalendar ? (
                        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <CalendarDays size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
                            <div style={{ fontSize: '0.85rem' }}>{lang === 'Hindi' ? 'कोई कैलेंडर नहीं। पहले कैलेंडर बनाएं।' : 'No calendar yet. Generate one from Crop Calendar.'}</div>
                            <button onClick={() => { onClose(); onOpenCalendar(); }} style={{ marginTop: 14, padding: '8px 18px', background: 'var(--primary)', color: '#041510', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>
                                {lang === 'Hindi' ? 'कैलेंडर खोलें' : 'Open Calendar'}
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Group by month */}
                            {['isNow', 'isNext'].map((grp, gi) => {
                                const grpTasks = tasks.filter(t => grp === 'isNow' ? t.isNow : !t.isNow);
                                if (!grpTasks.length) return null;
                                return (
                                    <div key={grp} style={{ marginBottom: 14 }}>
                                        <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: grp === 'isNow' ? 'var(--primary)' : 'var(--text-muted)', marginBottom: 8, paddingLeft: 4 }}>
                                            {grp === 'isNow' ? `🔴 ${grpTasks[0].month} — ${lang === 'Hindi' ? 'अभी' : 'This Month'}` : `⏳ ${grpTasks[0].month} — ${lang === 'Hindi' ? 'अगला महीना' : 'Coming Up'}`}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                            {grpTasks.map((task, i) => {
                                                const col = TASK_COLORS_MAP[task.type] || '#94a3b8';
                                                const emoji = TASK_EMOJIS[task.type] || '📌';
                                                return (
                                                    <div key={i} onClick={() => { onClose(); onOpenAdvisor(); }} style={{
                                                        display: 'flex', alignItems: 'center', gap: 11,
                                                        background: `${col}12`, borderRadius: 11, padding: '9px 13px',
                                                        border: `1px solid ${col}28`,
                                                        animation: `selectItemIn 0.3s ease ${i * 40}ms both`,
                                                        cursor: 'pointer', transition: 'background 0.15s'
                                                    }}>
                                                        <span style={{ fontSize: '1.15rem', flexShrink: 0 }}>{emoji}</span>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', color: col, fontWeight: 700, marginBottom: 1, letterSpacing: '0.5px' }}>{task.type}</div>
                                                            <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.35 }}>{task.description}</div>
                                                        </div>
                                                        <span style={{ color: col, fontSize: '0.7rem', flexShrink: 0, opacity: 0.7 }}>▶</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>

                {/* Footer */}
                {!noCalendar && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '11px 16px' }}>
                        <button onClick={() => { onClose(); onOpenCalendar(); }} style={{
                            width: '100%', background: 'rgba(0,232,162,0.08)', border: '1px solid rgba(0,232,162,0.2)',
                            borderRadius: 10, padding: '9px 0', color: 'var(--primary)', cursor: 'pointer',
                            fontWeight: 600, fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7
                        }}>
                            <CalendarDays size={14} />
                            {lang === 'Hindi' ? 'पूरा कैलेंडर देखें' : 'View Full Calendar'} →
                        </button>
                    </div>
                )}
            </div>
        </>,
        document.body
    );
}

/* ============================================================
   APP ROOT
   ============================================================ */
function App() {
    const [page, setPage] = useState('landing');
    const [lang, setLang] = useState('English');
    const [chatCtx, setChatCtx] = useState(null);
    const [session, setSession] = useState(null);
    const [user, setUser] = useState(null);
    const [notifPanelOpen, setNotifPanelOpen] = useState(false);
    const [dayAdvisorOpen, setDayAdvisorOpen] = useState(false);
    const [notifCount, setNotifCount] = useState(0);

    useEffect(() => {
        // Mock Auth check
        const storedSession = localStorage.getItem('neer_session');
        if (storedSession) {
            try {
                const s = JSON.parse(storedSession);
                setSession(s);
                syncUser(s);
            } catch (e) { }
        } else {
            setSession(null);
            if (page !== 'landing') setPage('landing');
        }

        const saved = localStorage.getItem('neer_calendar');
        if (saved) {
            try {
                const cal = JSON.parse(saved);
                const arr = cal?.calendar?.calendar || cal?.calendar || [];
                const idx = new Date().getMonth();
                const next = (idx + 1) % 12;
                setNotifCount((arr[idx]?.tasks?.length || 0) + (arr[next]?.tasks?.length || 0));
            } catch (e) { }
        }
    }, []);

    const isSyncing = useRef(false);
    const syncUser = async (session) => {
        if (isSyncing.current) return;
        isSyncing.current = true;
        try {
            const res = await axios.post(`${API}/auth/sync`, {
                user_id: session.user.id,
                email: session.user.email,
                phone: session.user.phone,
                name: session.user.user_metadata?.full_name,
                lang
            });
            const userData = res.data;
            setUser(userData);
            if (!userData.profile_complete) setPage('profile-setup');
            else if (['landing', 'language', 'login', 'profile-setup'].includes(page)) setPage('home');
        } catch (e) { console.error("Sync failed:", e); } finally { isSyncing.current = false; }
    };

    // Proactive Dashboard Weather: Fetch when landing on Home
    useEffect(() => {
        if (page === 'home' && user && !chatCtx) {
            const fetchWeather = async () => {
                const city = user.district || user.village || 'Rajasthan';
                const state = user.state || 'Rajasthan';
                try {
                    const r = await axios.post(`${API}/weather`, { city, state, lang });
                    setChatCtx(r.data);
                } catch (e) { console.error("Auto weather fetch failed", e); }
            };
            fetchWeather();
        }
    }, [page, user?.id]);

    const go = (p, ctx) => { if (ctx !== undefined) setChatCtx(ctx); setPage(p); setNotifPanelOpen(false); setDayAdvisorOpen(false); };

    const render = () => {
        if (user?.id === 'guest') {
            switch (page) {
                case 'home': return <HomePage go={go} lang={lang} />;
                case 'chat': return <ChatPage onBack={() => { go('home'); setChatCtx(null); }} lang={lang} ctx={chatCtx} />;
                case 'detect': return <DetectPage onBack={() => go('home')} lang={lang} user={user} />;
                case 'schemes': return <SchemesPage onBack={() => go('home')} lang={lang} go={go} />;
                case 'weather': return <WeatherPage onBack={() => go('home')} lang={lang} />;
                case 'community': return <CommunityPage onBack={() => go('home')} lang={lang} user={user} />;
                case 'calendar': return <CropCalendarPage onBack={() => go('home')} lang={lang} user={user} onNotifCountChange={setNotifCount} />;
                default: return <HomePage go={go} lang={lang} />;
            }
        }
        if (!session) {
            switch (page) {
                case 'language': return <LangPage onNext={() => go('login')} setLang={setLang} />;
                case 'login': return <LoginPage lang={lang} onGuest={() => { setUser({ id: 'guest', name: 'Guest', profile_complete: true }); setPage('home'); }} onLogin={(mockSession) => {
                    localStorage.setItem('neer_session', JSON.stringify(mockSession));
                    setSession(mockSession);
                    syncUser(mockSession);
                }} />;
                default: return <LandingPage onEnter={() => go('language')} />;
            }
        }
        if (page === 'profile-setup') return <ProfileSetup user={user} lang={lang} onComplete={() => syncUser(session)} />;
        switch (page) {
            case 'home': return <HomePage go={go} lang={lang} />;
            case 'chat': return <ChatPage onBack={() => { go('home'); setChatCtx(null); }} lang={lang} ctx={chatCtx} />;
            case 'detect': return <DetectPage onBack={() => go('home')} lang={lang} user={user} />;
            case 'schemes': return <SchemesPage onBack={() => go('home')} lang={lang} go={go} />;
            case 'weather': return <WeatherPage onBack={() => go('home')} lang={lang} />;
            case 'community': return <CommunityPage onBack={() => go('home')} lang={lang} user={user} />;
            case 'calendar': return <CropCalendarPage onBack={() => go('home')} lang={lang} user={user} onNotifCountChange={setNotifCount} />;
            default: return <HomePage go={go} lang={lang} />;
        }
    };

    const showHeader = ['home', 'chat', 'detect', 'schemes', 'weather', 'community', 'calendar'].includes(page);

    return (
        <div className="app-shell">
            {showHeader && (
                <header className="app-header" onClick={() => go('home')} style={{ cursor: 'pointer' }}>
                    <div className="header-logo"><Droplets size={22} /></div>
                    <div className="header-info"><span className="header-brand">NEER</span> <span className="header-title">Farmer AI</span></div>
                    <div onClick={e => { e.stopPropagation(); setNotifPanelOpen(o => !o); }} style={{ marginLeft: 'auto', marginRight: 8, position: 'relative', cursor: 'pointer', color: notifCount > 0 ? 'var(--primary)' : 'var(--text-muted)', padding: 6 }}>
                        <Bell size={22} /> {notifCount > 0 && <span style={{ position: 'absolute', top: 0, right: 0, background: '#f56565', color: '#fff', borderRadius: '50%', fontSize: '0.62rem', width: 17, height: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, pointerEvents: 'none' }}>{notifCount}</span>}
                    </div>
                </header>
            )}
            {render()}
            <NotificationPanel open={notifPanelOpen} onClose={() => setNotifPanelOpen(false)} onOpenCalendar={() => go('calendar')} onOpenAdvisor={() => setDayAdvisorOpen(true)} lang={lang} />
            <DayAdvisorModal open={dayAdvisorOpen} onClose={() => setDayAdvisorOpen(false)} lang={lang} />
        </div>
    );
}

function LoginPage({ lang, onGuest, onLogin }) {
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const t = {
        title: lang === 'Hindi' ? 'लॉग इन करें' : 'Welcome to NEER',
        sub: lang === 'Hindi' ? 'अपना मोबाइल नंबर दर्ज करें' : 'Enter your mobile number to continue',
        otpSub: lang === 'Hindi' ? 'सत्यापन कोड दर्ज करें' : 'Enter the verification code sent to your phone',
        btn: lang === 'Hindi' ? 'OTP भेजें' : 'Get OTP',
        verifyBtn: lang === 'Hindi' ? 'सत्यापित करें' : 'Verify & Login',
        googleBtn: lang === 'Hindi' ? 'Google के साथ लॉगिन करें' : 'Sign in with Google',
        guestBtn: lang === 'Hindi' ? 'बिना साइन अप के जारी रखें' : 'Continue without signing up',
        wait: lang === 'Hindi' ? 'सत्यापित कर रहा है...' : 'Verifying...',
        or: lang === 'Hindi' ? 'या' : 'OR'
    };

    const sendOtp = async () => {
        if (phone.length < 10) return;
        setLoading(true); setError('');
        // Mock OTP send latency
        setTimeout(() => {
            setStep(2);
            setLoading(false);
        }, 600);
    };

    const verifyOtp = async () => {
        if (otp.length < 6) return;
        setLoading(true); setError('');

        // Mock OTP verify latency
        setTimeout(() => {
            setLoading(false);
            const mockSession = {
                user: {
                    id: 'mock_user_' + phone,
                    phone: `+91${phone}`,
                    email: null,
                    user_metadata: { full_name: 'Farmer Friend' }
                }
            };
            onLogin(mockSession);
        }, 800);
    };

    const loginWithGoogle = async () => {
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            const mockSession = {
                user: {
                    id: 'mock_google_user_' + Date.now(),
                    phone: null,
                    email: 'farmer@gmail.com',
                    user_metadata: { full_name: 'Google Farmer' }
                }
            };
            onLogin(mockSession);
        }, 1000);
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <h1>{t.title}</h1>
                <p className="auth-sub">{step === 1 ? t.sub : t.otpSub}</p>
                {step === 1 ? (
                    <>
                        <div className="phone-field"><span className="phone-prefix">+91</span><input type="tel" placeholder="99999 99999" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} /></div>
                        <button className="btn-primary" onClick={sendOtp} disabled={phone.length < 10 || loading} style={{ width: '100%', marginBottom: 20 }}>{loading ? t.wait : t.btn}</button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 24px', opacity: 0.4 }}><div style={{ flex: 1, height: 1, background: 'var(--text-muted)' }} /><span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{t.or}</span><div style={{ flex: 1, height: 1, background: 'var(--text-muted)' }} /></div>
                        <button className="auth-google-btn" onClick={loginWithGoogle}>
                            <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" width="20" height="20" alt="" />
                            {t.googleBtn}
                        </button>
                        <button className="btn-ghost" onClick={onGuest} style={{ width: '100%', marginTop: 12, fontWeight: 600 }}>
                            {t.guestBtn}
                        </button>
                    </>
                ) : (
                    <>
                        <div className="phone-field" style={{ justifyContent: 'center' }}><input type="number" placeholder="000000" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} style={{ textAlign: 'center', letterSpacing: 8, fontSize: '1.5rem' }} /></div>
                        <button className="btn-primary" onClick={verifyOtp} disabled={otp.length < 6 || loading} style={{ width: '100%' }}>{loading ? t.wait : t.verifyBtn}</button>
                        <button className="btn-ghost" onClick={() => setStep(1)} style={{ width: '100%', marginTop: 12 }}>{lang === 'Hindi' ? 'नंबर बदलें' : 'Change Number'}</button>
                    </>
                )}
                {error && <p style={{ color: '#f87171', marginTop: 16, fontSize: '0.85rem' }}>{error}</p>}
            </div>
        </div>
    );
}


/* ============================================================
   0C. PROFILE SETUP
   ============================================================ */
function ProfileSetup({ user, lang, onComplete }) {
    const [name, setName] = useState(user.name || '');
    const [state, setState] = useState(user.state || 'Rajasthan');
    const [district, setDistrict] = useState(user.district || '');
    const [village, setVillage] = useState(user.village || '');
    const [crop, setCrop] = useState(user.primary_crop || 'Wheat');
    const [land, setLand] = useState(user.land_size || '');
    const [loading, setLoading] = useState(false);

    const t = {
        title: lang === 'Hindi' ? 'अपनी प्रोफाइल बनाएं' : 'Create Your Profile',
        sub: lang === 'Hindi' ? 'बेहतर सलाह के लिए अपनी जानकारी साझा करें' : 'Help us give you better advice by sharing some details',
        name: lang === 'Hindi' ? 'आपका नाम' : 'Full Name',
        village: lang === 'Hindi' ? 'गाँव' : 'Village',
        district: lang === 'Hindi' ? 'जिला' : 'District',
        state: lang === 'Hindi' ? 'राज्य' : 'State',
        crop: lang === 'Hindi' ? 'मुख्य फसल' : 'Primary Crop',
        land: lang === 'Hindi' ? 'भूमि का आकार (एकड़)' : 'Land Size (Acres)',
        save: lang === 'Hindi' ? 'प्रोफ़ाइल सहेजें' : 'Save Profile',
        wait: lang === 'Hindi' ? 'सहेज रहा है...' : 'Saving...'
    };

    const submit = async () => {
        if (!name || !district || !village || !land) return;
        setLoading(true);
        try {
            await axios.patch(`${API}/user/profile`, {
                user_id: user.id,
                name,
                language: lang,
                state,
                district,
                village,
                primary_crop: crop,
                land_size: parseFloat(land)
            });
            onComplete();
        } catch (e) {
            console.error(e);
            alert("Failed to save profile.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-content" style={{ maxWidth: 500, margin: '0 auto', padding: '40px 20px' }}>
            <div className="anim-fade-up">
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{ background: 'var(--primary-subtle)', width: 64, height: 64, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', margin: '0 auto 16px' }}>
                        <Users size={32} />
                    </div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>{t.title}</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{t.sub}</p>
                </div>

                <div className="form-card">
                    <div className="field">
                        <label>{t.name}</label>
                        <input className="field-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rajesh Kumar" />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div className="field">
                            <label>{t.state}</label>
                            <CustomSelect value={state} onChange={setState} options={STATES} />
                        </div>
                        <div className="field">
                            <label>{t.district}</label>
                            <input className="field-input" value={district} onChange={e => setDistrict(e.target.value)} placeholder="e.g. Jodhpur" />
                        </div>
                    </div>

                    <div className="field">
                        <label>{t.village}</label>
                        <input className="field-input" value={village} onChange={e => setVillage(e.target.value)} placeholder="e.g. Ramgarh" />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div className="field">
                            <label>{t.crop}</label>
                            <CustomSelect value={crop} onChange={setCrop} options={CROPS} />
                        </div>
                        <div className="field">
                            <label>{t.land}</label>
                            <input className="field-input" type="number" value={land} onChange={e => setLand(e.target.value)} placeholder="5.5" />
                        </div>
                    </div>

                    <button className="btn-primary" onClick={submit} disabled={loading} style={{ width: '100%', marginTop: 8 }}>
                        {loading ? t.wait : t.save}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ============================================================
   0. LANDING PAGE
   ============================================================ */
function LandingPage({ onEnter }) {
    return (
        <div className="landing">
            <div className="landing-bg">
                <div className="particle" />
                <div className="particle" />
                <div className="particle" />
                <div className="particle" />
                <div className="particle" />
                <div className="particle" />
            </div>

            <div className="landing-content">
                <div className="landing-logo-wrap anim-fade-up">
                    <div className="landing-logo-ring">
                        <NeerLogo size={56} />
                    </div>
                </div>

                <h1 className="landing-title anim-fade-up delay-1">NEER</h1>
                <p className="landing-tagline anim-fade-up delay-2">
                    Your AI-powered farming companion. Smarter decisions, healthier crops, better harvests.
                </p>

                <div className="stats-strip">
                    <div className="stat-item">
                        <div className="stat-value">1M+</div>
                        <div className="stat-label">Farmers</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-value">50+</div>
                        <div className="stat-label">Schemes</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-value">24/7</div>
                        <div className="stat-label">AI Support</div>
                    </div>
                </div>

                <button className="cta-btn anim-fade-up delay-4" onClick={onEnter}>
                    Begin Your Journey <ArrowRight size={22} />
                </button>
            </div>
        </div>
    );
}

/* ============================================================
   0A. LANGUAGE SELECTION
   ============================================================ */
function LangPage({ onNext, setLang }) {
    const pick = l => { setLang(l); onNext(); };

    return (
        <div className="lang-page">
            <div className="lang-card">
                <div className="landing-logo-wrap" style={{ marginBottom: '0.5rem' }}>
                    <div className="landing-logo-ring" style={{ width: 72, height: 72 }}>
                        <NeerLogo size={36} />
                    </div>
                </div>
                <div className="lang-card-header">
                    <h2>Choose Language</h2>
                    <p>भाषा का चयन करें</p>
                </div>
                <div className="lang-grid">
                    <button className="lang-option" onClick={() => pick('English')}>
                        <span className="lang-flag">🇬🇧</span>
                        <span className="lang-name">English</span>
                        <span className="lang-sub">Primary</span>
                    </button>
                    <button className="lang-option" onClick={() => pick('Hindi')}>
                        <span className="lang-flag">🇮🇳</span>
                        <span className="lang-name">हिंदी</span>
                        <span className="lang-sub">Hindi</span>
                    </button>
                </div>
            </div>
        </div>
    );
}



/* ============================================================
   1. HOME / DASHBOARD
   ============================================================ */
function HomePage({ go, lang }) {
    const t = {
        hi: lang === 'Hindi' ? 'वापसी पर स्वागत है।' : 'Welcome back.',
        sub: lang === 'Hindi' ? 'नीर आज आपके खेत की कैसे मदद करे?' : 'How can NEER assist your farm today?',
        d_t: lang === 'Hindi' ? 'फसल जांच' : 'Crop Check',
        d_s: lang === 'Hindi' ? 'पत्ती का फोटो से रोग पहचानें' : 'Detect diseases from a leaf photo',
        s_t: lang === 'Hindi' ? 'सरकारी योजनाएं' : 'Govt Schemes',
        s_s: lang === 'Hindi' ? 'अपनी ज़मीन के लिए सब्सिडी खोजें' : 'Find subsidies tailored to your land',
        w_t: lang === 'Hindi' ? 'मौसम स्काउट' : 'Weather Scout',
        w_s: lang === 'Hindi' ? 'खेती के लिए मौसम सलाह और अलर्ट' : 'Weather alerts & farming advice',
        com_t: lang === 'Hindi' ? 'किसान समुदाय' : 'Kisan Community',
        com_s: lang === 'Hindi' ? 'किसानों से जुड़ें और मंडी में बेचें' : 'Connect & trade in online Mandi',
        c_t: lang === 'Hindi' ? 'स्मार्ट सलाहकार' : 'Smart Advisor',
        c_s: lang === 'Hindi' ? 'मौसम, फसल, या कुछ भी पूछें' : 'Ask anything about crops or weather',
        cal_t: lang === 'Hindi' ? 'फसल कैलेंडर' : 'Crop Calendar',
        cal_s: lang === 'Hindi' ? 'AI फसल योजना और मासिक अनुस्मारक' : 'AI monthly planner & smart reminders'
    };

    return (
        <div className="dashboard">
            <div className="welcome-section anim-fade-up">
                <h1>{t.hi}</h1>
                <p>{t.sub}</p>
            </div>
            <div className="feature-grid">
                <div className="feature-card anim-slide-up delay-1" onClick={() => go('detect')}>
                    <div className="feature-icon crop"><ImageIcon size={32} strokeWidth={2.5} /></div>
                    <div className="feature-body"><h3>{t.d_t}</h3><p>{t.d_s}</p></div>
                </div>
                <div className="feature-card anim-slide-up delay-2" onClick={() => go('schemes')}>
                    <div className="feature-icon scheme"><FileText size={32} strokeWidth={2.5} /></div>
                    <div className="feature-body"><h3>{t.s_t}</h3><p>{t.s_s}</p></div>
                </div>
                <div className="feature-card anim-slide-up delay-3" onClick={() => go('calendar')}>
                    <div className="feature-icon calendar"><CalendarDays size={32} strokeWidth={2.5} /></div>
                    <div className="feature-body"><h3>{t.cal_t}</h3><p>{t.cal_s}</p></div>
                </div>
                <div className="feature-card anim-slide-up delay-4" onClick={() => go('weather')}>
                    <div className="feature-icon weather"><Cloud size={32} strokeWidth={2.5} /></div>
                    <div className="feature-body"><h3>{t.w_t}</h3><p>{t.w_s}</p></div>
                </div>
                <div className="feature-card anim-slide-up delay-4" onClick={() => go('community')}>
                    <div className="feature-icon community"><Users size={32} strokeWidth={2.5} /></div>
                    <div className="feature-body"><h3>{t.com_t}</h3><p>{t.com_s}</p></div>
                </div>
                <div className="feature-card anim-slide-up delay-5" onClick={() => go('chat')}>
                    <div className="feature-icon advisor"><MessageCircle size={32} strokeWidth={2.5} /></div>
                    <div className="feature-body"><h3>{t.c_t}</h3><p>{t.c_s}</p></div>
                </div>
            </div>
        </div>
    );
}

/* ============================================================
   2. CHAT PAGE
   ============================================================ */
function ChatPage({ onBack, lang, ctx }) {
    const [msgs, setMsgs] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [listening, setListening] = useState(false);
    const endRef = useRef(null);
    const init = useRef(false);

    useEffect(() => {
        if (init.current) return;
        init.current = true;
        if (ctx) {
            setMsgs([{
                role: 'bot',
                text: lang === 'Hindi'
                    ? 'मुझे आपकी योजनाओं की जानकारी मिली है। कौन सी योजना के बारे में विस्तार से जानना चाहेंगे?'
                    : 'I see the schemes we found for you! Which one would you like to explore in detail?'
            }]);
        } else {
            setMsgs([{
                role: 'bot',
                text: lang === 'Hindi'
                    ? 'नमस्ते! मैं नीर AI सलाहकार हूँ। आज मैं आपकी कैसे मदद करूँ?'
                    : 'Namaste! I\'m NEER, your AI farming advisor. What questions do you have today?'
            }]);
        }
    }, [ctx, lang]);

    const t = {
        title: lang === 'Hindi' ? 'स्मार्ट सलाहकार' : 'Smart Advisor',
        ph: lang === 'Hindi' ? 'अपना प्रश्न टाइप करें...' : 'Type your question...',
        micErr: lang === 'Hindi' ? 'माइक एक्सेस नहीं मिला।' : 'Mic access denied.',
    };

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, loading]);

    const toggleListen = () => {
        if (listening) {
            setListening(false);
            if (window.speechRecognitionInstance) window.speechRecognitionInstance.stop();
            return;
        }
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert(lang === 'Hindi' ? 'इस ब्राउज़र में स्पीच टू टेक्स्ट सपोर्ट नहीं है।' : 'Speech-to-Text not supported in this browser.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = lang === 'Hindi' ? 'hi-IN' : 'en-IN';
        recognition.interimResults = true;

        recognition.onstart = () => setListening(true);
        recognition.onresult = (e) => {
            const transcript = Array.from(e.results)
                .map(res => res[0].transcript)
                .join('');
            setInput(transcript);
        };
        recognition.onerror = (e) => {
            setListening(false);
            console.error(e);
            if (e.error === 'not-allowed') alert(t.micErr);
        };
        recognition.onend = () => setListening(false);

        window.speechRecognitionInstance = recognition;
        recognition.start();
    };

    const send = async () => {
        if (!input.trim() || loading) return;
        const q = input.trim();
        setMsgs(p => [...p, { role: 'user', text: q }]);
        setInput('');
        setLoading(true);

        const trySend = async (attempts = 4) => {
            for (let i = 0; i < attempts; i++) {
                try {
                    const r = await axios.post(`${API}/chat`, { message: q, context: ctx });
                    const reply = r.data.response || r.data.reply || (lang === 'Hindi' ? 'क्षमा करें, अभी मदद नहीं कर पा रहा।' : 'Sorry, I couldn\'t process that.');
                    setMsgs(p => [...p, { role: 'bot', text: reply }]);
                    return true;
                } catch (err) {
                    const isRateLimit = err.response?.status === 429 || String(err.response?.data?.detail).toLowerCase().includes('busy');
                    if (isRateLimit && i < attempts - 1) {
                        console.warn(`AI Busy, retrying... (${i + 1}/${attempts})`);
                        await new Promise(r => setTimeout(r, 4000));
                        continue;
                    }
                    let e = err.response?.data?.detail || (lang === 'Hindi' ? 'संपर्क टूट गया, पुनः प्रयास करें।' : 'Connection lost, please try again.');
                    if (typeof e === 'object') e = JSON.stringify(e);
                    setMsgs(p => [...p, { role: 'bot', text: String(e) }]);
                    return false;
                }
            }
        };

        await trySend();
        setLoading(false);
    };

    return (
        <div className="page-content chat-layout" style={{ padding: 0 }}>
            <div className="page-bar">
                <button className="back-btn" onClick={onBack}><ArrowLeft size={18} /></button>
                <span className="page-name">{t.title}</span>
            </div>
            <div className="chat-feed">
                {msgs.map((m, i) => (
                    <div key={i} className={`bubble ${m.role}`}>
                        {m.role === 'bot' ? <Fmt text={m.text} /> : m.text}
                    </div>
                ))}
                {loading && (
                    <div className="bubble bot">
                        <div className="typing-dots"><span /><span /><span /></div>
                    </div>
                )}
                <div ref={endRef} />
            </div>
            <div className="chat-input-bar">
                <div className="chat-input-wrap">
                    <button
                        className={`mic-btn ${listening ? 'listening' : ''}`}
                        onClick={toggleListen}
                        style={{
                            background: 'none', border: 'none',
                            color: listening ? '#f87171' : 'var(--text-muted)',
                            padding: '8px 10px', display: 'flex', alignItems: 'center',
                            cursor: 'pointer', transition: 'color 0.2s',
                            animation: listening ? 'pulse 1.5s infinite' : 'none'
                        }}
                    >
                        {listening ? <div style={{ width: 16, height: 16, background: '#f87171', borderRadius: 4 }} /> : <Mic size={20} />}
                    </button>
                    <input value={input} onChange={e => setInput(e.target.value)}
                        placeholder={t.ph} onKeyDown={e => e.key === 'Enter' && send()}
                        style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: 12 }} />
                    <button className="send-btn" onClick={send} disabled={loading || !input.trim()}>
                        <Send size={18} style={{ marginLeft: 2 }} />
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ============================================================
   2B. CROP CALENDAR PAGE
   ============================================================ */
const TASK_COLORS = {
    sowing: { bg: 'rgba(110,231,183,0.15)', color: '#6ee7b7', label: '🌱' },
    irrigation: { bg: 'rgba(96,165,250,0.15)', color: '#60a5fa', label: '💧' },
    fertilizer: { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', label: '🌿' },
    pesticide: { bg: 'rgba(248,113,113,0.15)', color: '#f87171', label: '🛡️' },
    harvesting: { bg: 'rgba(244,162,97,0.15)', color: '#f4a261', label: '🌾' },
    preparation: { bg: 'rgba(167,139,250,0.15)', color: '#a78bfa', label: '⚙️' },
    other: { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8', label: '📌' },
};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function CropCalendarPage({ onBack, lang, user, onNotifCountChange }) {
    const [state, setState] = useState('Rajasthan');
    const [crop, setCrop] = useState('Wheat');
    const [calendar, setCalendar] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [expandedMonth, setExpandedMonth] = useState(null);
    const [notifPerm, setNotifPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'default');

    const currentMonthIdx = new Date().getMonth(); // 0-indexed

    const t = {
        title: lang === 'Hindi' ? 'फसल कैलेंडर' : 'Crop Calendar',
        generate: lang === 'Hindi' ? 'कैलेंडर बनाएं' : 'Generate Calendar',
        generating: lang === 'Hindi' ? 'AI तैयार कर रहा है...' : 'AI is generating...',
        enableNotif: lang === 'Hindi' ? 'रिमाइंडर चालू करें' : 'Enable Reminders',
        notifOn: lang === 'Hindi' ? 'रिमाइंडर चालू है' : 'Reminders Active',
        notifDenied: lang === 'Hindi' ? 'रिमाइंडर बंद है' : 'Reminders Blocked',
        thisMonth: lang === 'Hindi' ? 'इस महीने' : 'This Month',
        noTasks: lang === 'Hindi' ? 'इस महीने कोई काम नहीं' : 'No tasks this month',
    };

    // On mount: fetch from cloud if logged in, else localStorage
    useEffect(() => {
        const fetchSaved = async () => {
            if (user?.id) {
                try {
                    const r = await axios.get(`${API}/calendar/${user.id}`);
                    if (r.data) {
                        setCalendar(r.data.calendar_json);
                        setState(r.data.state || 'Rajasthan');
                        setCrop(r.data.crop || 'Wheat');
                        checkAndFireNotifications(r.data.calendar_json);
                        return; // Successfully got from cloud
                    }
                } catch (e) { console.error("Cloud calendar fetch failed", e); }
            }

            const saved = localStorage.getItem('neer_calendar');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    setCalendar(parsed.calendar);
                    setState(parsed.state || 'Rajasthan');
                    setCrop(parsed.crop || 'Wheat');
                    checkAndFireNotifications(parsed.calendar.calendar);
                } catch (e) { }
            }
        };
        fetchSaved();
    }, [user?.id]);

    const checkAndFireNotifications = (calArr) => {
        if (!calArr) return;
        const now = new Date();
        const monthIdx = now.getMonth();
        const nextMonthIdx = (monthIdx + 1) % 12;
        const shownKey = `neer_notif_shown_${now.getFullYear()}_${monthIdx}`;
        const alreadyShown = localStorage.getItem(shownKey);

        // Count upcoming tasks (this + next month)
        const thisMonth = calArr[monthIdx];
        const nextMonth = calArr[nextMonthIdx];
        const upcomingCount = (thisMonth?.tasks?.length || 0) + (nextMonth?.tasks?.length || 0);
        if (onNotifCountChange) onNotifCountChange(upcomingCount);

        // Fire browser notification once per month
        if (!alreadyShown && typeof Notification !== 'undefined' && Notification.permission === 'granted' && thisMonth?.tasks?.length > 0) {
            const taskSummary = thisMonth.tasks.slice(0, 2).map(t => t.description).join(', ');
            new Notification(`🌾 NEER: ${thisMonth.month} Farm Tasks`, {
                body: taskSummary + (thisMonth.tasks.length > 2 ? ` +${thisMonth.tasks.length - 2} more` : ''),
                icon: '/favicon.ico',
                badge: '/favicon.ico',
            });
            localStorage.setItem(shownKey, '1');
        }
    };

    const generate = async () => {
        setLoading(true);
        setError('');
        setCalendar(null);
        try {
            const r = await axios.post(`${API}/crop-calendar`, { state, crop, lang });
            setCalendar(r.data);
            localStorage.setItem('neer_calendar', JSON.stringify(r.data));

            if (user?.id) {
                axios.post(`${API}/calendar`, {
                    user_id: user.id,
                    state,
                    crop,
                    calendar: r.data
                }).catch(e => console.error("Cloud calendar save failed", e));
            }

            checkAndFireNotifications(r.data.calendar);
            setExpandedMonth(currentMonthIdx);
        } catch (e) {
            setError(lang === 'Hindi' ? 'कैलेंडर बनाने में त्रुटि हुई।' : 'Failed to generate calendar. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const enableNotifications = async () => {
        const result = await Notification.requestPermission();
        setNotifPerm(result);
        if (result === 'granted' && calendar) {
            checkAndFireNotifications(calendar.calendar);
        }
    };

    const calArr = calendar?.calendar || [];

    return (
        <div className="page-content">
            <div className="page-bar">
                <button className="back-btn" onClick={onBack}><ArrowLeft size={18} /></button>
                <span className="page-name">{t.title}</span>
            </div>

            {/* Controls */}
            <div className="form-card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div className="field">
                        <label><MapPin size={13} /> {lang === 'Hindi' ? 'राज्य' : 'State'}</label>
                        <CustomSelect value={state} onChange={setState} options={STATES} />
                    </div>
                    <div className="field">
                        <label><Leaf size={13} /> {lang === 'Hindi' ? 'फसल' : 'Crop'}</label>
                        <CustomSelect value={crop} onChange={setCrop} options={CROPS} />
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn-primary" onClick={generate} disabled={loading} style={{ flex: 1 }}>
                        {loading ? (
                            <><div className="typing-dots" style={{ filter: 'brightness(0.3)' }}><span style={{ background: 'var(--text-on-primary)' }} /><span style={{ background: 'var(--text-on-primary)' }} /><span style={{ background: 'var(--text-on-primary)' }} /></div> {t.generating}</>
                        ) : (
                            <><CalendarDays size={17} /> {t.generate}</>
                        )}
                    </button>
                    <button
                        onClick={enableNotifications}
                        disabled={notifPerm === 'denied'}
                        className={`notif-toggle ${notifPerm === 'granted' ? 'granted' : notifPerm === 'denied' ? 'denied' : ''}`}
                    >
                        {notifPerm === 'granted' ? <Bell size={15} /> : <BellOff size={15} />}
                        {notifPerm === 'granted' ? t.notifOn : notifPerm === 'denied' ? t.notifDenied : t.enableNotif}
                    </button>
                </div>
                {error && <p style={{ color: '#f87171', marginTop: 10, fontSize: '0.85rem' }}>{error}</p>}
            </div>

            {/* Month grid */}
            {calArr.length > 0 && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20 }}>
                        {calArr.map((m, i) => {
                            const isCurrent = i === currentMonthIdx;
                            const isExpanded = expandedMonth === i;
                            const types = [...new Set((m.tasks || []).map(t => t.type))];
                            return (
                                <div
                                    key={m.month}
                                    onClick={() => setExpandedMonth(isExpanded ? null : i)}
                                    style={{
                                        borderRadius: 12, padding: '10px 9px',
                                        background: isCurrent ? 'rgba(0,232,162,0.12)' : 'rgba(255,255,255,0.03)',
                                        border: isCurrent ? '1.5px solid rgba(0,232,162,0.5)' : '1px solid rgba(255,255,255,0.06)',
                                        cursor: 'pointer', transition: 'all 0.18s',
                                        boxShadow: isExpanded ? '0 0 0 2px var(--primary)' : 'none'
                                    }}
                                >
                                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: isCurrent ? 'var(--primary)' : 'var(--text-muted)', marginBottom: 5 }}>
                                        {m.month.slice(0, 3).toUpperCase()}
                                        {isCurrent && <span style={{ marginLeft: 4, fontSize: '0.6rem', background: 'var(--primary)', color: '#041510', borderRadius: 4, padding: '1px 4px' }}>NOW</span>}
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                        {types.slice(0, 4).map(tp => (
                                            <span key={tp} title={tp} style={{ fontSize: '1rem' }}>{TASK_COLORS[tp]?.label || '📌'}</span>
                                        ))}
                                    </div>
                                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 4 }}>{m.tasks?.length || 0} tasks</div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Expanded month detail */}
                    {expandedMonth !== null && calArr[expandedMonth] && (
                        <div style={{ animation: 'fadeIn 0.25s', marginBottom: 24 }}>
                            <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <CalendarDays size={17} style={{ color: 'var(--primary)' }} />
                                {calArr[expandedMonth].month} — {crop} in {state}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {calArr[expandedMonth].tasks?.length > 0 ? calArr[expandedMonth].tasks.map((task, ti) => {
                                    const tc = TASK_COLORS[task.type] || TASK_COLORS.other;
                                    return (
                                        <div key={ti} style={{
                                            display: 'flex', alignItems: 'center', gap: 12,
                                            background: tc.bg, borderRadius: 12, padding: '11px 15px',
                                            border: `1px solid ${tc.color}30`
                                        }}>
                                            <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{tc.label}</span>
                                            <div>
                                                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.6px', color: tc.color, fontWeight: 700, marginBottom: 2 }}>{task.type}</div>
                                                <div style={{ fontSize: '0.87rem', color: 'var(--text-primary)' }}>{task.description}</div>
                                            </div>
                                        </div>
                                    );
                                }) : (
                                    <div style={{ color: 'var(--text-muted)', padding: 16, textAlign: 'center', fontSize: '0.85rem' }}>{t.noTasks}</div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

/* ============================================================
   3. DETECT PAGE (Crop Check)
   ============================================================ */
function DetectPage({ onBack, lang, user }) {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [result, setResult] = useState('');
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [live, setLive] = useState(false);
    const [camErr, setCamErr] = useState('');
    const [showBoost, setShowBoost] = useState(false);
    const [cropName, setCropName] = useState('');
    const [userState, setUserState] = useState('');
    const vidRef = useRef(null);
    const streamRef = useRef(null);
    const [guidance, setGuidance] = useState(null);
    const [speaking, setSpeaking] = useState(false);

    const cropOptions = [
        'Apple', 'Banana', 'Barley', 'Brinjal', 'Cabbage', 'Capsicum',
        'Carrot', 'Cauliflower', 'Chilli', 'Coriander', 'Cotton', 'Cucumber',
        'Garlic', 'Ginger', 'Grapes', 'Groundnut', 'Lemon', 'Maize',
        'Mango', 'Millet', 'Mustard', 'Okra', 'Onion', 'Orange', 'Papaya',
        'Pea', 'Pigeon Pea', 'Pomegranate', 'Potato', 'Rice', 'Sorghum',
        'Soybean', 'Spinach', 'Sugarcane', 'Sunflower', 'Tea', 'Tomato',
        'Turmeric', 'Watermelon', 'Wheat'
    ];

    const stateOptions = [
        'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
        'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
        'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
        'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
        'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
        'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
    ];

    const t = {
        title: lang === 'Hindi' ? 'फसल जांच' : 'Crop Check',
        up: lang === 'Hindi' ? 'पत्ती का फोटो अपलोड करें' : 'Tap to upload leaf photo',
        hint: lang === 'Hindi' ? 'JPG, PNG (5MB तक)' : 'Supports JPG, PNG up to 5MB',
        change: lang === 'Hindi' ? 'फोटो बदलें' : 'Change Photo',
        btn: lang === 'Hindi' ? 'स्वास्थ्य विश्लेषण' : 'Analyze Health',
        wait: lang === 'Hindi' ? 'विश्लेषण कर रहा है...' : 'Analyzing...',
        err: lang === 'Hindi' ? 'विजन AI से जुड़ने में त्रुटि।' : 'Error connecting to Vision AI.',
        liveTab: lang === 'Hindi' ? 'लाइव कैमरा' : 'Live Camera',
        upTab: lang === 'Hindi' ? 'अपलोड' : 'Upload',
        capture: lang === 'Hindi' ? 'फोटो खींचें' : 'Capture',
        camErr: lang === 'Hindi' ? 'कैमरा एक्सेस अस्वीकृत।' : 'Camera access denied.'
    };

    const startCam = async () => {
        setCamErr('');
        try {
            const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            streamRef.current = s;
            if (vidRef.current) vidRef.current.srcObject = s;
        } catch { setCamErr(t.camErr); setLive(false); }
    };

    const stopCam = () => {
        streamRef.current?.getTracks().forEach(tr => tr.stop());
        streamRef.current = null;
    };

    const analyzeFrame = () => {
        if (!vidRef.current || vidRef.current.readyState < 2) return;
        const video = vidRef.current;
        if (!video.videoWidth) return;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth / 4; // Downsample for performance
        canvas.height = video.videoHeight / 4;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;
            const w = canvas.width;
            const h = canvas.height;

            let totalLuma = 0;
            const gray = new Float32Array(w * h);

            // Calculate Brightness
            for (let i = 0; i < data.length; i += 4) {
                const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                totalLuma += luma;
                gray[i / 4] = luma;
            }
            const avgBrightness = totalLuma / (w * h);

            // Calculate Sharpness (Edge magnitude)
            let edgeSum = 0;
            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    const idx = y * w + x;
                    const val = gray[idx];
                    const dx = Math.abs(val - gray[idx + 1]) + Math.abs(val - gray[idx - 1]);
                    const dy = Math.abs(val - gray[idx + w]) + Math.abs(val - gray[idx - w]);
                    edgeSum += dx + dy;
                }
            }
            const sharpness = edgeSum / (w * h);

            if (avgBrightness < 35) {
                setGuidance({ text: lang === 'Hindi' ? 'कम रोशनी है' : 'Low light detected', color: '#f87171', icon: '🌑' });
            } else if (sharpness < 15) {
                setGuidance({ text: lang === 'Hindi' ? 'धुंधला है — स्थिर रखें' : 'Too blurry — hold steady', color: '#f87171', icon: '🖐️' });
            } else if (sharpness < 28) {
                setGuidance({ text: lang === 'Hindi' ? 'पत्ती के और करीब जाएं' : 'Move closer to the leaf', color: '#fbbf24', icon: '🔍' });
            } else {
                setGuidance({ text: lang === 'Hindi' ? 'एकदम सही — अभी फोटो लें!' : 'Perfect — capture now!', color: '#4ade80', icon: '✨' });
            }
        } catch (e) { }
    };

    useEffect(() => {
        if (user?.id) {
            setHistoryLoading(true);
            axios.get(`${API}/history/${user.id}`)
                .then(r => setHistory(r.data))
                .catch(e => console.error("History fetch failed", e))
                .finally(() => setHistoryLoading(false));
        }

        let timer;
        if (live && !preview) {
            startCam();
            timer = setInterval(analyzeFrame, 500);
        } else {
            stopCam();
            setGuidance(null);
        }
        return () => {
            stopCam();
            if (timer) clearInterval(timer);
            if (window.speechSynthesis) window.speechSynthesis.cancel();
        };
    }, [live, preview, user?.id]);

    const capture = () => {
        if (!vidRef.current) return;
        const c = document.createElement('canvas');
        c.width = vidRef.current.videoWidth;
        c.height = vidRef.current.videoHeight;
        c.getContext('2d').drawImage(vidRef.current, 0, 0, c.width, c.height);
        c.toBlob(blob => {
            if (!blob) return;
            const f = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
            setFile(f);
            setPreview(URL.createObjectURL(f));
            stopCam();
        }, 'image/jpeg', 0.9);
    };

    const onFile = e => {
        if (e.target.files?.[0]) {
            const f = e.target.files[0];
            setFile(f);
            setPreview(URL.createObjectURL(f));
            setResult('');
            setLive(false);
        }
    };

    const detect = async () => {
        if (!file) return;
        setLoading(true);
        setResult(null);
        const fd = new FormData();
        fd.append('image', file);
        fd.append('lang', lang);
        if (cropName) fd.append('crop_name', cropName);
        if (userState) fd.append('state', userState);
        if (user?.id) fd.append('user_id', user.id);

        const attempt = () => axios.post(`${API}/detect`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });

        try {
            let r;
            try { r = await attempt(); } catch (e1) {
                if (e1.response?.status === 429) {
                    await new Promise(r => setTimeout(r, 30000));
                    r = await attempt();
                } else throw e1;
            }
            if (r.data.status === 'success') {
                setResult(r.data.data);
                if (user?.id) setHistory(prev => [r.data, ...prev]); // Optimistic update or wait for refresh
            }
            else setResult({ error: t.err });
        } catch (err) {
            let e = err.response?.data?.detail || t.err;
            if (typeof e === 'object') e = JSON.stringify(e);
            setResult({ error: String(e) });
        } finally {
            setLoading(false);
        }
    };

    const toggleSpeech = () => {
        if (!window.speechSynthesis) return;

        if (speaking) {
            window.speechSynthesis.cancel();
            setSpeaking(false);
            return;
        }

        if (!result || !result.disease_candidates) return;

        const synth = window.speechSynthesis;
        const diseaseName = result.disease_candidates[0]?.name || (lang === 'Hindi' ? 'अज्ञात बीमारी' : 'Unknown disease');

        let textToSpeak = '';
        if (lang === 'Hindi') {
            textToSpeak = `आपके पौधे में ${diseaseName} की संभावना है। `;
            if (result.organic_treatment?.length > 0) {
                textToSpeak += `प्राकृतिक उपचार है: ${result.organic_treatment[0]}। `;
            }
            if (result.chemical_treatment?.length > 0) {
                textToSpeak += `रासायनिक उपचार है: ${result.chemical_treatment[0]}। `;
            }
        } else {
            textToSpeak = `Your plant likely has ${diseaseName}. `;
            if (result.organic_treatment?.length > 0) {
                textToSpeak += `Organic treatment: ${result.organic_treatment[0]}. `;
            }
            if (result.chemical_treatment?.length > 0) {
                textToSpeak += `Chemical treatment: ${result.chemical_treatment[0]}. `;
            }
        }

        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = lang === 'Hindi' ? 'hi-IN' : 'en-US';
        // Adjust speed slightly for clarity
        utterance.rate = 0.95;

        utterance.onstart = () => setSpeaking(true);
        utterance.onend = () => setSpeaking(false);
        utterance.onerror = () => setSpeaking(false);

        synth.speak(utterance);
    };

    return (
        <div className="page-content">
            <div className="page-bar"><button className="back-btn" onClick={() => { stopCam(); onBack(); }}><ArrowLeft size={18} /></button><span className="page-name">{t.title}</span></div>

            <div className="mode-tabs">
                <button className={`mode-tab ${!live ? 'active' : ''}`} onClick={() => setLive(false)}>
                    <UploadCloud size={16} /> {t.upTab}
                </button>
                <button className={`mode-tab ${live ? 'active' : ''}`} onClick={() => { setLive(true); setPreview(null); setFile(null); setResult(''); }}>
                    <Camera size={16} /> {t.liveTab}
                </button>
            </div>

            {live && !preview ? (
                <div className="camera-box">
                    {camErr ? <div className="error-box">{camErr}</div> : (
                        <>
                            <video ref={vidRef} autoPlay playsInline muted className="camera-video" />
                            {guidance && (
                                <div style={{
                                    position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
                                    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
                                    border: `1.5px solid ${guidance.color}50`, borderRadius: 24,
                                    padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8,
                                    color: guidance.color, fontSize: '0.82rem', fontWeight: 600,
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 10,
                                    animation: 'fadeIn 0.2s', whiteSpace: 'nowrap', transition: 'all 0.2s'
                                }}>
                                    <span style={{ fontSize: '1.1rem' }}>{guidance.icon}</span>
                                    {guidance.text}
                                </div>
                            )}
                            <button className="shutter-btn" onClick={capture}><div className="shutter-core" /></button>
                            <span className="shutter-label">{t.capture}</span>
                        </>
                    )}
                </div>
            ) : !preview ? (
                <>
                    <label className="upload-zone">
                        <input type="file" accept="image/*" onChange={onFile} />
                        <div className="upload-icon-circle"><UploadCloud size={28} /></div>
                        <span className="upload-label">{t.up}</span>
                        <span className="upload-hint">{t.hint}</span>
                    </label>

                    {history.length > 0 && !result && (
                        <div className="section" style={{ marginTop: 24 }}>
                            <h3 style={{ fontSize: '0.9rem', marginBottom: 16, opacity: 0.7 }}>{lang === 'Hindi' ? 'हालिया जांच' : 'Recent Checks'}</h3>
                            <div className="history-list">
                                {history.map((item, i) => (
                                    <div key={item.id || i} className="history-card" onClick={() => {
                                        const data = {
                                            crop_type: item.crop_name,
                                            disease_candidates: [{ name: item.disease_name, confidence_percentage: item.confidence }],
                                            organic_treatment: typeof item.treatment === 'string' ? JSON.parse(item.treatment) : item.treatment,
                                            chemical_treatment: [],
                                            image_url: item.image_url,
                                            disease_found: true
                                        };
                                        setResult(data);
                                        setPreview(item.image_url);
                                    }}>
                                        <img src={item.image_url} alt="" className="history-thumb" />
                                        <div className="history-info">
                                            <div className="history-name">{item.disease_name}</div>
                                            <div className="history-meta">{item.crop_name} • {new Date(item.timestamp).toLocaleDateString()}</div>
                                        </div>
                                        <ChevronRight size={16} opacity={0.3} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div className="preview-box">
                    <img src={preview} alt="Crop Preview" />
                    <label className="change-photo-btn">
                        {t.change}
                        <input type="file" accept="image/*" onChange={onFile} style={{ opacity: 0, position: 'absolute', inset: 0, cursor: 'pointer' }} />
                    </label>
                </div>
            )}

            <button className="btn-primary" style={{ marginTop: 20 }} onClick={detect} disabled={!file || loading}>
                {loading ? (
                    <><div className="typing-dots" style={{ filter: 'brightness(0.3)' }}><span style={{ background: 'var(--text-on-primary)' }} /><span style={{ background: 'var(--text-on-primary)' }} /><span style={{ background: 'var(--text-on-primary)' }} /></div> {t.wait}</>
                ) : (
                    <><Leaf size={18} /> {t.btn}</>
                )}
            </button>

            {/* Accuracy Boost — Optional */}
            <div className="boost-section" style={{ marginTop: 16 }}>
                <button
                    className="boost-toggle"
                    onClick={() => setShowBoost(!showBoost)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                        background: 'rgba(0, 232, 162, 0.06)', border: '1px solid rgba(0, 232, 162, 0.15)',
                        borderRadius: 12, padding: '10px 16px', color: 'var(--primary)',
                        cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                        transition: 'all 0.2s'
                    }}
                >
                    <Zap size={16} />
                    {lang === 'Hindi' ? '🎯 सटीकता बढ़ाएं (वैकल्पिक)' : '🎯 Boost Accuracy (Optional)'}
                    <ChevronDown size={16} style={{
                        marginLeft: 'auto',
                        transform: showBoost ? 'rotate(180deg)' : 'rotate(0)',
                        transition: 'transform 0.2s'
                    }} />
                </button>

                {showBoost && (
                    <div style={{
                        marginTop: 10, display: 'flex', gap: 10,
                        animation: 'fadeIn 0.3s'
                    }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                                {lang === 'Hindi' ? 'फसल का नाम' : 'Crop Name'}
                            </label>
                            <CustomSelect
                                value={cropName || (lang === 'Hindi' ? '— चुनें —' : '— Select —')}
                                onChange={val => setCropName(val.startsWith('—') ? '' : val)}
                                options={[lang === 'Hindi' ? '— चुनें —' : '— Select —', ...cropOptions]}
                                style={{ fontSize: '0.85rem', padding: '8px 12px' }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                                <MapPin size={12} style={{ verticalAlign: -2 }} /> {lang === 'Hindi' ? 'राज्य' : 'State'}
                            </label>
                            <CustomSelect
                                value={userState || (lang === 'Hindi' ? '— चुनें —' : '— Select —')}
                                onChange={val => setUserState(val.startsWith('—') ? '' : val)}
                                options={[lang === 'Hindi' ? '— चुनें —' : '— Select —', ...stateOptions]}
                                style={{ fontSize: '0.85rem', padding: '8px 12px' }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {result && (
                <div style={{ marginTop: '1.25rem', animation: 'fadeIn 0.4s' }}>
                    {result.error ? (
                        <div className="error-box">{result.error}</div>
                    ) : result.is_plant === false ? (
                        <div className="error-box">This doesn't look like a crop. Please take a clearer photo of the plant leaf.</div>
                    ) : (
                        <div className="result-panel">
                            {/* Multi-Candidate Data Visualization */}
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <h3 className="disease-title" style={{ marginBottom: 4, flex: 1 }}>
                                        {result.disease_candidates?.[0]?.name || "Unknown"}
                                    </h3>
                                    <button
                                        onClick={toggleSpeech}
                                        style={{
                                            background: speaking ? 'rgba(0, 232, 162, 0.2)' : 'rgba(255,255,255,0.06)',
                                            border: `1px solid ${speaking ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}`,
                                            color: speaking ? 'var(--primary)' : 'var(--text-primary)',
                                            borderRadius: 20, padding: '6px 14px', fontSize: '0.8rem',
                                            fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                                            cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
                                            animation: speaking ? 'pulse 2s infinite' : 'none'
                                        }}
                                    >
                                        {speaking ? <VolumeX size={15} /> : <Volume2 size={15} />}
                                        {lang === 'Hindi' ? (speaking ? 'रोकें' : 'सुनें') : (speaking ? 'Stop' : 'Listen')}
                                    </button>
                                </div>
                                {result.crop_type && (
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)', display: 'block', marginBottom: 16 }}>
                                        {result.crop_type}{result.plant_part ? ` — ${result.plant_part}` : ''}
                                    </span>
                                )}

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {(result.disease_candidates || []).map((candidate, idx) => {
                                        const conf = candidate.confidence_percentage;
                                        // Determine color based on index and confidence
                                        let barColor = 'var(--primary)'; // Top match (Green)
                                        if (idx > 0) {
                                            if (conf > 40) barColor = '#f59e0b'; // Strong alternative (Orange)
                                            else barColor = '#94a3b8'; // Weak alternative (Gray)
                                        }

                                        return (
                                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: idx === 0 ? 700 : 500, color: idx === 0 ? 'var(--text)' : 'var(--text-dim)' }}>
                                                    <span>{candidate.name}</span>
                                                    <span>{conf}%</span>
                                                </div>
                                                <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                                                    <div style={{
                                                        height: '100%', width: `${conf}%`, background: barColor, borderRadius: 4,
                                                        transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
                                                        animation: `slideRight 0.8s ${idx * 0.15}s backwards`
                                                    }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Badges row */}
                            {result.disease_found && (
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                                    {result.kb_match && (
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 4,
                                            background: 'rgba(0, 232, 162, 0.12)', color: 'var(--primary)',
                                            padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600
                                        }}>
                                            <CheckCircle2 size={13} /> KB Verified
                                        </span>
                                    )}
                                    {result.urgency && (
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 4,
                                            background: result.urgency.includes('immediately') ? 'rgba(255, 99, 99, 0.15)' : 'rgba(244, 162, 97, 0.15)',
                                            color: result.urgency.includes('immediately') ? '#ff6363' : 'var(--accent)',
                                            padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600
                                        }}>
                                            <AlertTriangle size={13} /> {result.urgency}
                                        </span>
                                    )}
                                </div>
                            )}

                            {result.disease_found ? (
                                <>
                                    <div className="info-block">
                                        <div className="info-block-title"><Search size={16} /> Symptoms</div>
                                        <ul>{result.symptoms.map((s, i) => <li key={i}>{s}</li>)}</ul>
                                    </div>
                                    <div className="info-block warning">
                                        <div className="info-block-title"><AlertTriangle size={16} /> Cause</div>
                                        <p>{result.cause}</p>
                                    </div>
                                    <div className="info-block">
                                        <div className="info-block-title" style={{ color: 'var(--primary)' }}><Sparkles size={16} /> Organic Treatment</div>
                                        <ul>{result.organic_treatment.map((t, i) => <li key={i}>{t}</li>)}</ul>
                                    </div>
                                    {result.chemical_treatment?.length > 0 && (
                                        <div className="info-block">
                                            <div className="info-block-title"><ShieldAlert size={16} /> Chemical Treatment</div>
                                            <ul>{result.chemical_treatment.map((t, i) => <li key={i}>{t}</li>)}</ul>
                                        </div>
                                    )}
                                    <div className="info-block">
                                        <div className="info-block-title"><ShieldAlert size={16} /> Prevention</div>
                                        <ul>{result.prevention.map((p, i) => <li key={i}>{p}</li>)}</ul>
                                    </div>
                                </>
                            ) : (
                                <div className="healthy-msg">
                                    <h4>✨ Your crop looks healthy!</h4>
                                    <p>Keep up your good farming practices.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ============================================================
   4. SCHEMES PAGE
   ============================================================ */
function SchemesPage({ onBack, lang, go }) {
    const [state, setState] = useState('Maharashtra');
    const [land, setLand] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const t = {
        title: lang === 'Hindi' ? 'योजना नेविगेटर' : 'Scheme Navigator',
        st: lang === 'Hindi' ? 'अपना राज्य चुनें' : 'Select Your State',
        ln: lang === 'Hindi' ? 'जमीन (एकड़)' : 'Land Ownership (Acres)',
        lp: lang === 'Hindi' ? 'जैसे 2.5' : 'e.g. 2.5',
        btn: lang === 'Hindi' ? 'योजनाएं खोजें' : 'Find My Schemes',
        wait: lang === 'Hindi' ? 'विश्लेषण कर रहा है...' : 'Analyzing eligibility...',
        err: lang === 'Hindi' ? 'योजनाएं लाने में त्रुटि।' : 'Error fetching schemes.',
        apply: lang === 'Hindi' ? 'आवेदन करें' : 'Apply Now',
        steps: lang === 'Hindi' ? 'आवेदन चरण' : 'How to Apply'
    };

    const tierConfig = {
        critical: {
            label: lang === 'Hindi' ? '🔴 तत्काल' : '🔴 Critical',
            bg: 'rgba(255, 99, 99, 0.10)',
            border: '#ff6363',
            badge: 'rgba(255, 99, 99, 0.18)',
            color: '#ff6363'
        },
        recommended: {
            label: lang === 'Hindi' ? '🟡 अनुशंसित' : '🟡 Recommended',
            bg: 'rgba(244, 162, 97, 0.08)',
            border: '#f4a261',
            badge: 'rgba(244, 162, 97, 0.18)',
            color: '#f4a261'
        },
        available: {
            label: lang === 'Hindi' ? '🟢 उपलब्ध' : '🟢 Available',
            bg: 'rgba(0, 232, 162, 0.06)',
            border: 'var(--primary)',
            badge: 'rgba(0, 232, 162, 0.12)',
            color: 'var(--primary)'
        }
    };

    const states = [
        "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
        "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
        "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
        "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
    ];

    const search = async () => {
        if (!land) { alert(lang === 'Hindi' ? 'कृपया भूमि का आकार दर्ज करें' : 'Please enter land size'); return; }
        setLoading(true);
        setResult(null);
        try {
            const r = await axios.post(`${API}/schemes`, { state, land_size: parseFloat(land), lang });
            setResult(r.data);
        } catch (err) {
            let e = err.response?.data?.detail || t.err;
            if (typeof e === 'object') e = JSON.stringify(e);
            setResult({ error: String(e) });
        } finally {
            setLoading(false);
        }
    };

    const [expandedId, setExpandedId] = useState(null);

    return (
        <div className="page-content">
            <div className="page-bar"><button className="back-btn" onClick={onBack}><ArrowLeft size={18} /></button><span className="page-name">{t.title}</span></div>

            <div className="form-card">
                <div className="field">
                    <label><MapPin size={14} /> {t.st}</label>
                    <CustomSelect value={state} onChange={setState} options={states} />
                </div>
                <div className="field">
                    <label>{t.ln}</label>
                    <input type="number" className="field-input" step="0.1" placeholder={t.lp}
                        value={land} onChange={e => setLand(e.target.value)} />
                </div>
            </div>

            <button className="btn-primary" style={{ marginTop: '1.5rem' }} onClick={search} disabled={loading}>
                {loading ? (
                    <><div className="typing-dots" style={{ filter: 'brightness(0.3)' }}><span style={{ background: 'var(--text-on-primary)' }} /><span style={{ background: 'var(--text-on-primary)' }} /><span style={{ background: 'var(--text-on-primary)' }} /></div> {t.wait}</>
                ) : (
                    <><Search size={18} /> {t.btn}</>
                )}
            </button>

            {result && (
                <div style={{ marginTop: '1.25rem', animation: 'fadeIn 0.4s' }}>
                    {result.error ? (
                        <div className="error-box">{result.error}</div>
                    ) : (
                        <>
                            {/* Summary header */}
                            <div style={{
                                background: 'rgba(0, 232, 162, 0.06)',
                                border: '1px solid rgba(0, 232, 162, 0.15)',
                                borderRadius: 14, padding: '14px 18px', marginBottom: 16
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <span style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 700 }}>
                                        {result.total_schemes} {lang === 'Hindi' ? 'योजनाएं मिलीं' : 'schemes matched'}
                                    </span>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                                        {result.agent_steps?.length || 0} {lang === 'Hindi' ? 'चरण' : 'steps'}
                                    </span>
                                </div>
                                {result.summary && (
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                                        {result.summary}
                                    </p>
                                )}
                            </div>

                            {/* Scheme cards */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {result.schemes?.map((scheme, i) => {
                                    const tier = tierConfig[scheme.tier] || tierConfig.available;
                                    const isExpanded = expandedId === scheme.id;

                                    return (
                                        <div key={scheme.id || i}
                                            className="scheme-card"
                                            style={{
                                                background: tier.bg,
                                                borderLeft: `3px solid ${tier.border}`,
                                                borderRadius: 14,
                                                padding: '16px 18px',
                                                cursor: 'pointer',
                                                transition: 'all 0.25s ease',
                                                animation: `fadeIn 0.4s ease ${i * 0.06}s both`
                                            }}
                                            onClick={() => setExpandedId(isExpanded ? null : scheme.id)}
                                        >
                                            {/* Card header */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                                                <div style={{ flex: 1 }}>
                                                    <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                                                        {scheme.name}
                                                    </h4>
                                                    <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                                                        {scheme.short}
                                                    </p>
                                                </div>
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                                    background: tier.badge, color: tier.color,
                                                    padding: '4px 10px', borderRadius: 20,
                                                    fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap',
                                                    flexShrink: 0
                                                }}>
                                                    {tier.label}
                                                </span>
                                            </div>

                                            {/* AI reason */}
                                            {scheme.reason && (
                                                <p style={{
                                                    margin: '8px 0 0', fontSize: '0.8rem',
                                                    color: tier.color, fontStyle: 'italic',
                                                    opacity: 0.9
                                                }}>
                                                    → {scheme.reason}
                                                </p>
                                            )}

                                            {/* Expanded section */}
                                            {isExpanded && (
                                                <div style={{ marginTop: 14, animation: 'fadeIn 0.3s' }}>
                                                    {/* Benefits */}
                                                    <div style={{
                                                        background: 'rgba(255,255,255,0.04)',
                                                        borderRadius: 10, padding: '12px 14px', marginBottom: 10
                                                    }}>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700, marginBottom: 6 }}>
                                                            <Sparkles size={13} style={{ verticalAlign: -2 }} /> {lang === 'Hindi' ? 'लाभ' : 'Benefits'}
                                                        </div>
                                                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                                                            {scheme.benefits}
                                                        </p>
                                                    </div>

                                                    {/* Apply steps */}
                                                    {scheme.apply_steps?.length > 0 && (
                                                        <div style={{
                                                            background: 'rgba(255,255,255,0.04)',
                                                            borderRadius: 10, padding: '12px 14px', marginBottom: 10
                                                        }}>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 700, marginBottom: 8 }}>
                                                                <FileText size={13} style={{ verticalAlign: -2 }} /> {t.steps}
                                                            </div>
                                                            <ol style={{
                                                                margin: 0, paddingLeft: 20,
                                                                fontSize: '0.82rem', color: 'var(--text-secondary)',
                                                                lineHeight: 1.7
                                                            }}>
                                                                {scheme.apply_steps.map((step, si) => (
                                                                    <li key={si}>{step}</li>
                                                                ))}
                                                            </ol>
                                                        </div>
                                                    )}

                                                    {/* Apply button */}
                                                    {scheme.apply_url && (
                                                        <a
                                                            href={scheme.apply_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onClick={e => e.stopPropagation()}
                                                            style={{
                                                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                                                background: tier.badge, color: tier.color,
                                                                padding: '8px 18px', borderRadius: 10,
                                                                fontSize: '0.82rem', fontWeight: 700,
                                                                textDecoration: 'none', transition: 'all 0.2s'
                                                            }}
                                                        >
                                                            <ArrowRight size={14} /> {t.apply}
                                                        </a>
                                                    )}
                                                </div>
                                            )}

                                            {/* Expand hint */}
                                            {!isExpanded && (
                                                <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--text-dim)', opacity: 0.6 }}>
                                                    {lang === 'Hindi' ? 'विवरण देखने के लिए टैप करें ▾' : 'Tap for details ▾'}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Discuss with Advisor */}
                            <button className="advisor-bridge-btn" style={{ marginTop: 16 }}
                                onClick={() => go('chat', result.summary || JSON.stringify(result.schemes?.map(s => s.name)))}>
                                <MessageCircle size={18} /> {lang === 'Hindi' ? 'सलाहकार से चर्चा करें' : 'Discuss with Advisor'}
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
/* ============================================================
   5. WEATHER PAGE
   ============================================================ */
function WeatherPage({ onBack, lang }) {
    const [state, setState] = useState('Rajasthan');
    const [city, setCity] = useState('Jaipur');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const t = {
        title: lang === 'Hindi' ? 'मौसम स्काउट' : 'Weather Scout',
        btn: lang === 'Hindi' ? 'मौसम जानें' : 'Get Weather Intelligence',
        wait: lang === 'Hindi' ? 'मौसम ला रहा है...' : 'Fetching weather...',
        err: lang === 'Hindi' ? 'मौसम लाने में त्रुटि।' : 'Error fetching weather.',
        forecast: lang === 'Hindi' ? '7 दिन का पूर्वानुमान' : '7-Day Forecast',
        alerts: lang === 'Hindi' ? 'खेती अलर्ट' : 'Farming Alerts',
        advisory: lang === 'Hindi' ? 'AI सलाह' : 'AI Advisory',
        season: lang === 'Hindi' ? 'मौसमी गतिविधि' : 'Seasonal Activity'
    };

    const alertColors = {
        danger: { bg: 'rgba(255, 99, 99, 0.10)', border: '#ff6363', color: '#ff6363' },
        caution: { bg: 'rgba(244, 162, 97, 0.08)', border: '#f4a261', color: '#f4a261' },
        favorable: { bg: 'rgba(0, 232, 162, 0.06)', border: 'var(--primary)', color: 'var(--primary)' },
        irrigation: { bg: 'rgba(100, 181, 246, 0.08)', border: '#64b5f6', color: '#64b5f6' }
    };

    const stateCities = {
        "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Kurnool", "Rajahmundry", "Tirupati", "Kakinada", "Kadapa", "Anantapur", "Vizianagaram", "Eluru", "Ongole", "Nandyal", "Machilipatnam", "Adoni", "Tenali", "Chittoor", "Hindupur", "Proddatur", "Bhimavaram", "Madanapalle", "Guntakal", "Srikakulam"],
        "Arunachal Pradesh": ["Itanagar", "Pasighat", "Tawang", "Ziro", "Roing", "Tezu", "Bomdila", "Aalo", "Changlang"],
        "Assam": ["Guwahati", "Silchar", "Dibrugarh", "Jorhat", "Nagaon", "Tinsukia", "Tezpur", "Bongaigaon", "Diphu", "Dhubri", "North Lakhimpur", "Lumding", "Goalpara", "Sivasagar", "Barpeta", "Golaghat", "Karimganj", "Hailakandi"],
        "Bihar": ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Purnia", "Darbhanga", "Bihar Sharif", "Arrah", "Begusarai", "Katihar", "Munger", "Chhapra", "Samastipur", "Saharsa", "Sasaram", "Hajipur", "Dehri", "Bettiah", "Motihari", "Kishanganj", "Jamui"],
        "Chhattisgarh": ["Raipur", "Bhilai", "Bilaspur", "Korba", "Rajnandgaon", "Raigarh", "Jagdalpur", "Ambikapur", "Dhamtari", "Durg", "Mahasamund", "Chirmiri", "Bhatapara", "Baloda Bazar", "Dongargarh"],
        "Goa": ["Panaji", "Margao", "Vasco da Gama", "Mapusa", "Ponda", "Bicholim", "Curchorem", "Sanquelim", "Valpoi"],
        "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar", "Junagadh", "Gandhinagar", "Gandhidham", "Anand", "Navsari", "Morbi", "Nadiad", "Surendranagar", "Bharuch", "Vapi", "Bhuj", "Porbandar", "Palanpur", "Valsad", "Godhra", "Patan", "Botad", "Amreli"],
        "Haryana": ["Faridabad", "Gurugram", "Panipat", "Ambala", "Chandigarh", "Rohtak", "Hisar", "Karnal", "Sonipat", "Panchkula", "Bhiwani", "Sirsa", "Yamunanagar", "Bahadurgarh", "Jind", "Thanesar", "Kaithal", "Rewari", "Palwal", "Hansi", "Fatehabad"],
        "Himachal Pradesh": ["Shimla", "Dharamshala", "Mandi", "Solan", "Kullu", "Manali", "Dalhousie", "Palampur", "Nahan", "Chamba", "Una", "Hamirpur", "Sundarnagar", "Bilaspur", "Paonta Sahib"],
        "Jharkhand": ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Deoghar", "Phusro", "Hazaribagh", "Giridih", "Ramgarh", "Medininagar", "Chirkunda", "Jhumri Telaiya", "Sahibganj", "Chaibasa", "Lohardaga"],
        "Karnataka": ["Bengaluru", "Mysuru", "Hubballi", "Mangaluru", "Belagavi", "Kalaburagi", "Davanagere", "Ballari", "Vijayapura", "Shivamogga", "Tumakuru", "Udupi", "Raichur", "Bidar", "Hospet", "Gadag", "Hassan", "Chitradurga", "Kolar", "Mandya", "Chikkamagaluru", "Bagalkot", "Karwar", "Ramanagara"],
        "Kerala": ["Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Kollam", "Alappuzha", "Palakkad", "Kottayam", "Kannur", "Manjeri", "Thalassery", "Ponnani", "Vatakara", "Kanhangad", "Malarpuram", "Kayamkulam", "Changanassery", "Tirur"],
        "Madhya Pradesh": ["Indore", "Bhopal", "Jabalpur", "Gwalior", "Ujjain", "Sagar", "Dewas", "Satna", "Ratlam", "Rewa", "Khandwa", "Burhanpur", "Chhindwara", "Murwara (Katni)", "Singrauli", "Bhind", "Morena", "Guna", "Shivpuri", "Chhatarpur", "Vidisha", "Mandsaur", "Hoshangabad", "Kargone"],
        "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Nashik", "Aurangabad", "Solapur", "Amravati", "Navi Mumbai", "Kolhapur", "Akola", "Jalgaon", "Latur", "Dhule", "Ahmednagar", "Chandrapur", "Parbhani", "Nanded", "Satara", "Sangli", "Malegaon", "Mira-Bhayandar", "Bhiwandi", "Amalner", "Gondia", "Yavatmal", "Beed", "Wardha"],
        "Manipur": ["Imphal", "Thoubal", "Kakching", "Ukhrul", "Churachandpur", "Senapati", "Jiribam", "Moirang"],
        "Meghalaya": ["Shillong", "Tura", "Jowai", "Nongstoin", "Williamnagar", "Baghmara", "Resubelpara", "Mairang"],
        "Mizoram": ["Aizawl", "Lunglei", "Saiha", "Champhai", "Kolasib", "Serchhip", "Lawngtlai", "Mamit"],
        "Nagaland": ["Kohima", "Dimapur", "Mokokchung", "Tuensang", "Wokha", "Zunheboto", "Mon", "Phek"],
        "Odisha": ["Bhubaneswar", "Cuttack", "Rourkela", "Berhampur", "Sambalpur", "Puri", "Balasore", "Bhadrak", "Baripada", "Jharsuguda", "Bargarh", "Rayagada", "Bolangir", "Jeypore", "Bhawani Patna"],
        "Punjab": ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda", "Hoshiarpur", "Pathankot", "Moga", "Batala", "Khanna", "Phagwara", "S.A.S. Nagar", "Abohar", "Firozpur", "Kapurthala", "Faridkot", "Barnala", "Muktsar"],
        "Rajasthan": ["Jaipur", "Jodhpur", "Kota", "Bikaner", "Ajmer", "Udaipur", "Bhilwara", "Alwar", "Bharatpur", "Pali", "Sikar", "Chittorgarh", "Banswara", "Hanumangarh", "Sawai Madhopur", "Kishangarh", "Beawar", "Tonk", "Jhunjhunu", "Churu", "Barmer", "Jalore", "Sirohi", "Jaisalmer"],
        "Sikkim": ["Gangtok", "Namchi", "Gyalshing", "Mangan", "Singtam", "Rangpo"],
        "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli", "Erode", "Vellore", "Thoothukudi", "Dindigul", "Thanjavur", "Ranipet", "Karur", "Nagercoil", "Kancheepuram", "Tiruppur", "Cuddalore", "Neyveli", "Kumbakonam", "Rajapalayam", "Pudukkottai", "Hosur", "Ambur", "Karaikudi"],
        "Telangana": ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Ramagundam", "Khammam", "Mahbubnagar", "Nalgonda", "Adilabad", "Suryapet", "Miryalaguda", "Jagtial", "Mancherial", "Kothagudem", "Siddipet", "Kamareddy", "Zaheerabad", "Nagarkurnool"],
        "Tripura": ["Agartala", "Dharmanagar", "Udaipur", "Kailasahar", "Belonia", "Ambassa", "Khowai", "Bishalgarh", "Sabroom"],
        "Uttar Pradesh": ["Lucknow", "Kanpur", "Ghaziabad", "Agra", "Varanasi", "Meerut", "Prayagraj", "Bareilly", "Aligarh", "Moradabad", "Saharanpur", "Gorakhpur", "Noida", "Firozabad", "Jhansi", "Muzaffarnagar", "Mathura", "Rampur", "Shahjahanpur", "Farrukhabad", "Orai", "Faizabad", "Etawah", "Mirzapur", "Bulandshahr", "Sambhal", "Amroha", "Hardoi", "Banda", "Hapur"],
        "Uttarakhand": ["Dehradun", "Haridwar", "Roorkee", "Haldwani", "Rudrapur", "Kashipur", "Rishikesh", "Pantnagar", "Pithoragarh", "Ramnagar", "Kichha", "Manglaur", "Kotdwar", "Almora", "Mussoorie", "Nainital", "Bageshwar", "Chamoli"],
        "West Bengal": ["Kolkata", "Asansol", "Siliguri", "Durgapur", "Bardhaman", "English Bazar", "Baharampur", "Habra", "Kharagpur", "Shantipur", "Dankuni", "Haldia", "Jalpaiguri", "Balurghat", "Alipurduar", "Bhatpara", "Maheshtala", "Rajpur Sonarpur", "South Dumdum", "Gopalpur", "Bally", "Midnapore", "Raniganj", "Navadwip"]
    };

    const cities = stateCities[state] || ["New Delhi"];

    const onStateChange = (newState) => {
        setState(newState);
        const defaultCity = (stateCities[newState] || ["New Delhi"])[0];
        setCity(defaultCity);
    };

    const dayName = (dateStr, i) => {
        if (i === 0) return lang === 'Hindi' ? 'आज' : 'Today';
        if (i === 1) return lang === 'Hindi' ? 'कल' : 'Tmrw';
        return new Date(dateStr).toLocaleDateString('en', { weekday: 'short' });
    };

    const search = async () => {
        setLoading(true);
        setResult(null);
        try {
            const r = await axios.post(`${API}/weather`, { city, state, lang });
            setResult(r.data);
        } catch (err) {
            let e = err.response?.data?.detail || t.err;
            if (typeof e === 'object') e = JSON.stringify(e);
            setResult({ status: 'error', message: String(e) });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-content">
            <div className="page-bar"><button className="back-btn" onClick={onBack}><ArrowLeft size={18} /></button><span className="page-name">{t.title}</span></div>

            <div className="form-card">
                <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                            <MapPin size={12} style={{ verticalAlign: -2 }} /> {lang === 'Hindi' ? 'राज्य' : 'State'}
                        </label>
                        <CustomSelect value={state} onChange={onStateChange} options={Object.keys(stateCities)} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                            {lang === 'Hindi' ? 'शहर' : 'City'}
                        </label>
                        <CustomSelect value={city} onChange={setCity} options={cities} />
                    </div>
                </div>
            </div>

            <button className="btn-primary" onClick={search} disabled={loading} style={{ position: 'relative', zIndex: 5 }}>
                {loading ? (
                    <><div className="typing-dots" style={{ filter: 'brightness(0.3)' }}><span style={{ background: 'var(--text-on-primary)' }} /><span style={{ background: 'var(--text-on-primary)' }} /><span style={{ background: 'var(--text-on-primary)' }} /></div> {t.wait}</>
                ) : (
                    <><Cloud size={18} /> {t.btn}</>
                )}
            </button>

            {result && (
                <div style={{ marginTop: '1.25rem', position: 'relative', zIndex: 1 }}>
                    {result.status === 'error' ? (
                        <div className="error-box">{result.message}</div>
                    ) : (
                        <>
                            {/* Current Weather Hero */}
                            <div style={{
                                background: 'linear-gradient(135deg, rgba(100, 181, 246, 0.12) 0%, rgba(0, 232, 162, 0.08) 100%)',
                                border: '1px solid rgba(100, 181, 246, 0.2)',
                                borderRadius: 18, padding: '24px 22px', marginBottom: 16,
                                position: 'relative', overflow: 'hidden'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                                            {Math.round(result.current.temp)}°C
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: 4 }}>
                                            {lang === 'Hindi' ? 'अनुभव' : 'Feels like'} {Math.round(result.current.feels_like)}°C
                                        </div>
                                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: 6, fontWeight: 600 }}>
                                            {result.current.weather_emoji} {result.current.weather_label}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '3.5rem', lineHeight: 1 }}>{result.current.weather_emoji}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700, marginTop: 8 }}>
                                            {result.city}, {result.state}
                                        </div>
                                    </div>
                                </div>
                                {/* Weather stats */}
                                <div style={{
                                    display: 'flex', gap: 16, marginTop: 18,
                                    paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                                        <Droplets size={14} color="#64b5f6" /> {result.current.humidity}%
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                                        <Wind size={14} color="#a5d6a7" /> {Math.round(result.current.wind_speed)} km/h
                                    </div>
                                </div>
                            </div>

                            {/* 7-Day Forecast Strip */}
                            <div style={{ marginBottom: 16 }}>
                                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Sun size={16} color="#f4a261" /> {t.forecast}
                                </h4>
                                <div style={{
                                    display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8,
                                    scrollbarWidth: 'none'
                                }}>
                                    {result.forecast?.map((day, i) => (
                                        <div key={i} style={{
                                            minWidth: 80, background: i === 0 ? 'rgba(100, 181, 246, 0.12)' : 'rgba(255,255,255,0.03)',
                                            border: i === 0 ? '1px solid rgba(100, 181, 246, 0.25)' : '1px solid rgba(255,255,255,0.06)',
                                            borderRadius: 14, padding: '12px 10px', textAlign: 'center',
                                            flexShrink: 0, animation: `fadeIn 0.3s ease ${i * 0.05}s both`
                                        }}>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 600 }}>
                                                {dayName(day.date, i)}
                                            </div>
                                            <div style={{ fontSize: '1.5rem', margin: '6px 0' }}>{day.weather_emoji}</div>
                                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                {Math.round(day.temp_max)}°
                                            </div>
                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                                                {Math.round(day.temp_min)}°
                                            </div>
                                            {day.rain_prob > 30 && (
                                                <div style={{ fontSize: '0.65rem', color: '#64b5f6', marginTop: 4 }}>
                                                    🌧️ {day.rain_prob}%
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Farming Alerts */}
                            {result.alerts?.length > 0 && (
                                <div style={{ marginBottom: 16 }}>
                                    <h4 style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <AlertTriangle size={16} color="#f4a261" /> {t.alerts}
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {result.alerts.map((alert, i) => {
                                            const ac = alertColors[alert.type] || alertColors.caution;
                                            return (
                                                <div key={i} style={{
                                                    background: ac.bg, borderLeft: `3px solid ${ac.border}`,
                                                    borderRadius: 12, padding: '12px 16px',
                                                    animation: `fadeIn 0.3s ease ${i * 0.08}s both`
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                        <span style={{ fontSize: '1.1rem' }}>{alert.icon}</span>
                                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: ac.color }}>
                                                            {alert.title}
                                                        </span>
                                                    </div>
                                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                                        {alert.message}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* AI Advisory */}
                            {result.advisory && (
                                <div style={{
                                    background: 'rgba(0, 232, 162, 0.06)',
                                    border: '1px solid rgba(0, 232, 162, 0.15)',
                                    borderRadius: 14, padding: '16px 18px', marginBottom: 16
                                }}>
                                    <h4 style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Sparkles size={16} /> {t.advisory}
                                    </h4>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                        <Fmt text={result.advisory} />
                                    </div>
                                </div>
                            )}

                            {/* Season Info */}
                            {result.season && (
                                <div style={{
                                    background: 'rgba(244, 162, 97, 0.06)',
                                    border: '1px solid rgba(244, 162, 97, 0.12)',
                                    borderRadius: 14, padding: '14px 18px'
                                }}>
                                    <h4 style={{ fontSize: '0.82rem', color: '#f4a261', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Leaf size={14} /> {result.season.label} — {t.season}
                                    </h4>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
                                        {result.season.current_activity}
                                    </p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                                        {result.season.crops?.slice(0, 6).map((c, i) => (
                                            <span key={i} style={{
                                                background: 'rgba(244, 162, 97, 0.1)', color: '#f4a261',
                                                padding: '3px 10px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 600
                                            }}>{c}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

/* ============================================================
   6. COMMUNITY & MANDI PAGE
   ============================================================ */
function CommunityPage({ onBack, lang, user }) {
    const [posts, setPosts] = useState([]);
    const [tab, setTab] = useState('discussion');
    const [loading, setLoading] = useState(true);

    const [showNewPost, setShowNewPost] = useState(false);
    const [newPostType, setNewPostType] = useState('discussion');
    const [content, setContent] = useState('');
    const [crop, setCrop] = useState('');
    const [price, setPrice] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [commentTexts, setCommentTexts] = useState({});
    const [bidAmounts, setBidAmounts] = useState({});

    const fileInputRef = useRef(null);

    const t = {
        title: lang === 'Hindi' ? 'किसान समुदाय' : 'Kisan Community',
        disc: lang === 'Hindi' ? 'चर्चा' : 'Discussion',
        mandi: lang === 'Hindi' ? 'ऑनलाइन मंडी' : 'Online Mandi',
        new: lang === 'Hindi' ? 'नया पोस्ट' : 'New Post',
        ask: lang === 'Hindi' ? 'कुछ पूछें या बताएं...' : 'Ask or share something...',
        sell: lang === 'Hindi' ? 'फसल का नाम और मंडी भाव...' : 'What are you selling?',
        cropLbl: lang === 'Hindi' ? 'फसल का नाम' : 'Crop Name',
        priceLbl: lang === 'Hindi' ? 'भाव (₹/क्विंटल)' : 'Price (₹/Qtl)',
        postBtn: lang === 'Hindi' ? 'पोस्ट करें' : 'Post',
        cancel: lang === 'Hindi' ? 'रद्द करें' : 'Cancel',
        commentPlc: lang === 'Hindi' ? 'टिप्पणी लिखें...' : 'Write a comment...',
    };

    const getUserId = () => {
        if (user && user.id) return user.id;
        let id = localStorage.getItem('neer_device_id');
        if (!id) {
            id = 'user-' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('neer_device_id', id);
        }
        return id;
    };
    const userId = useRef(getUserId()).current;

    const loadPosts = async () => {
        try {
            setLoading(true);
            const r = await axios.get(`${API}/community/posts?type=${tab}`);
            setPosts(r.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadPosts(); }, [tab]);

    const handleImageSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handlePost = async () => {
        if (!content.trim() && !imageFile) return;
        try {
            setLoading(true);
            let uploadedImageUrl = null;

            if (imageFile) {
                const fd = new FormData();
                fd.append('image', imageFile);
                const uploadRes = await axios.post(`${API}/upload`, fd);
                uploadedImageUrl = uploadRes.data.url;
            }

            await axios.post(`${API}/community/posts`, {
                author: user?.name || (lang === 'Hindi' ? "किसान मित्र" : "Farmer Friend"),
                location: lang === 'Hindi' ? "स्थानीय" : "Local",
                avatar: newPostType === 'mandi' ? "🌾" : "👨🏽‍🌾",
                type: newPostType,
                content: content,
                crop: newPostType === 'mandi' ? crop : null,
                price: newPostType === 'mandi' && price ? parseFloat(price) : null,
                image_url: uploadedImageUrl
            });
            setContent(''); setCrop(''); setPrice('');
            setImageFile(null); setImagePreview(null);
            setShowNewPost(false);
            loadPosts();
        } catch (e) {
            console.error(e);
            setLoading(false);
        }
    };

    const handleLike = async (id) => {
        try {
            const r = await axios.post(`${API}/community/like`, { post_id: id, user_id: userId });
            setPosts(posts.map(p => p.id === id ? { ...p, likes: r.data.likes, liked_by: r.data.liked_by } : p));
        } catch (e) { console.error(e); }
    };

    const handleComment = async (id) => {
        const text = commentTexts[id];
        if (!text || !text.trim()) return;
        try {
            const r = await axios.post(`${API}/community/comment`, {
                post_id: id,
                author: user?.name || (lang === 'Hindi' ? "आप" : "You"),
                content: text
            });
            setCommentTexts({ ...commentTexts, [id]: '' });
            setPosts(posts.map(p => p.id === id ? { ...p, comments: [...(p.comments || []), r.data] } : p));
        } catch (e) { console.error(e); }
    };

    const handleBid = async (id, basePrice) => {
        const amtStr = bidAmounts[id];
        if (!amtStr) return;
        const amt = parseFloat(amtStr);
        if (isNaN(amt)) return;

        const post = posts.find(p => p.id === id);
        const highestBid = (post.bids?.length ?? 0) > 0 ? Math.max(...(post.bids ?? []).map(b => b.amount)) : (basePrice || 0);

        if (amt <= highestBid) {
            alert(lang === 'Hindi'
                ? `बोली ₹${highestBid} से अधिक होनी चाहिए।`
                : `Bid must be strictly greater than ₹${highestBid}.`);
            return;
        }

        try {
            const r = await axios.post(`${API}/community/bid`, {
                post_id: id,
                author: user?.name || (lang === 'Hindi' ? "आप" : "You"),
                amount: amt
            });
            setBidAmounts({ ...bidAmounts, [id]: '' });
            setPosts(posts.map(p => p.id === id ? { ...p, bids: [...(p.bids || []), r.data] } : p));
        } catch (e) { console.error(e); }
    };

    const timeAgo = (iso) => {
        const diff = Math.floor((new Date() - new Date(iso)) / 60000);
        if (diff < 60) return `${diff}m`;
        if (diff < 1440) return `${Math.floor(diff / 60)}h`;
        return `${Math.floor(diff / 1440)}d`;
    };

    return (
        <div className="page-content" style={{ padding: 16 }}>
            <div className="page-bar" style={{ background: 'var(--bg-main)', position: 'sticky', top: 0, zIndex: 10, padding: '16px 0' }}>
                <button className="back-btn" onClick={onBack}><ArrowLeft size={18} /></button>
                <span className="page-name" style={{ marginLeft: 12 }}>{t.title}</span>
                <button className="btn-primary" style={{ width: 'auto', padding: '6px 14px', fontSize: '0.8rem', marginLeft: 'auto', borderRadius: 20 }} onClick={() => { setShowNewPost(true); setNewPostType(tab); }}>
                    {t.new}
                </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, padding: '0 4px' }}>
                <button className={`tab-btn ${tab === 'discussion' ? 'active' : ''}`} onClick={() => setTab('discussion')}>
                    <MessageCircle size={15} /> {t.disc}
                </button>
                <button className={`tab-btn ${tab === 'mandi' ? 'active' : ''}`} onClick={() => setTab('mandi')}>
                    <Store size={15} /> {t.mandi}
                </button>
            </div>

            {/* Create Post Modal */}
            {showNewPost && (
                <div className="post-modal-overlay">
                    <div className="form-card anim-slide-up" style={{ margin: 20, maxWidth: 600, width: '100%' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: '1.2rem', color: 'var(--text-primary)' }}>{t.new}</h3>

                        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                            <button className={`chip ${newPostType === 'discussion' ? 'active' : ''}`} onClick={() => setNewPostType('discussion')}>{t.disc}</button>
                            <button className={`chip ${newPostType === 'mandi' ? 'active' : ''}`} style={newPostType === 'mandi' ? { background: 'rgba(186, 104, 200, 0.15)', color: '#ba68c8', border: '1px solid rgba(186, 104, 200, 0.4)' } : {}} onClick={() => setNewPostType('mandi')}>{t.mandi}</button>
                        </div>

                        {newPostType === 'mandi' && (
                            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                                <input className="field-input" placeholder={t.cropLbl} value={crop} onChange={e => setCrop(e.target.value)} style={{ flex: 2 }} />
                                <input className="field-input" placeholder={t.priceLbl} type="number" value={price} onChange={e => setPrice(e.target.value)} style={{ flex: 1 }} />
                            </div>
                        )}

                        <textarea className="field-input" placeholder={newPostType === 'discussion' ? t.ask : t.sell} rows={4} value={content} onChange={e => setContent(e.target.value)} style={{ resize: 'none', marginBottom: 16, width: '100%', boxSizing: 'border-box' }} />

                        {imagePreview && (
                            <div style={{ position: 'relative', marginBottom: 16 }}>
                                <img src={imagePreview} alt="preview" style={{ width: '100%', borderRadius: 8, maxHeight: 200, objectFit: 'cover' }} />
                                <button onClick={() => { setImageFile(null); setImagePreview(null); }} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
                            <button className="post-action-btn static" onClick={() => fileInputRef.current.click()} style={{ cursor: 'pointer', color: 'var(--primary)' }}>
                                <ImageIcon size={18} /> <span style={{ fontWeight: 700 }}>Photo</span>
                            </button>
                            <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageSelect} />

                            <div style={{ display: 'flex', gap: 12 }}>
                                <button className="btn-secondary" onClick={() => { setShowNewPost(false); setImageFile(null); setImagePreview(null); }} style={{ padding: '8px 16px' }}>{t.cancel}</button>
                                <button className="btn-primary" onClick={handlePost} disabled={!content.trim() && !imageFile} style={{ padding: '8px 16px' }}>{t.postBtn}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Feed */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {loading && posts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40 }}><div className="typing-dots"><span /><span /><span /></div></div>
                ) : posts.map(post => (
                    <div key={post.id} className="post-card anim-fade-up">
                        <div className="post-header">
                            <div className="post-avatar">{post.avatar}</div>
                            <div style={{ flex: 1 }}>
                                <div className="post-author">{post.author}</div>
                                <div className="post-meta">
                                    <MapPin size={10} style={{ display: 'inline', verticalAlign: -1, marginRight: 2 }} />{post.location}
                                    <span style={{ margin: '0 6px' }}>•</span>
                                    <Clock size={10} style={{ display: 'inline', verticalAlign: -1, marginRight: 2 }} />{timeAgo(post.timestamp)}
                                </div>
                            </div>
                            {post.type === 'mandi' && (
                                <div className="mandi-badge"><Tag size={12} /> {t.mandi}</div>
                            )}
                        </div>

                        <div className="post-body">
                            {post.type === 'mandi' && post.crop && (
                                <div className="mandi-price-tag" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span className="mandi-crop">{post.crop}</span>
                                        {post.price && <span className="mandi-price">₹{post.price} / Qtl</span>}
                                    </div>
                                    {(post.bids?.length ?? 0) > 0 && (
                                        <div style={{ fontSize: '0.8rem', color: '#00e8a2', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                                            <TrendingUp size={14} /> Highest Bid: ₹{Math.max(...(post.bids ?? []).map(b => b.amount))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {post.image_url && (
                                <img src={post.image_url} alt="post" className="post-image" />
                            )}

                            <p className="post-text">{post.content}</p>
                        </div>

                        <div className="post-actions">
                            {(() => {
                                const isLiked = post.liked_by?.includes(userId);
                                return (
                                    <button className={`post-action-btn ${isLiked ? 'active' : ''}`} style={isLiked ? { color: 'var(--primary)' } : {}} onClick={() => handleLike(post.id)}>
                                        <ThumbsUp size={16} color={isLiked ? "var(--primary)" : "#a0aec0"} fill={isLiked ? "var(--primary)" : "none"} strokeWidth={isLiked ? 2 : 2.5} /> <span>{post.likes || 0}</span>
                                    </button>
                                );
                            })()}
                            <span className="post-action-btn static">
                                <MessageCircle size={16} color="#a0aec0" strokeWidth={2.5} /> <span>{post.comments?.length || 0}</span>
                            </span>
                        </div>

                        {post.comments && post.comments.length > 0 && (
                            <div className="post-comments">
                                {post.comments.map(c => (
                                    <div key={c.id} className="comment">
                                        <div className="comment-author">{c.author} <span className="comment-time">{timeAgo(c.timestamp)}</span></div>
                                        <div className="comment-text">{c.content}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="comment-input-row" style={{ marginTop: 12 }}>
                            <input
                                className="comment-input field-input"
                                placeholder={t.commentPlc}
                                value={commentTexts[post.id] || ''}
                                onChange={e => setCommentTexts({ ...commentTexts, [post.id]: e.target.value })}
                                onKeyDown={e => { if (e.key === 'Enter') handleComment(post.id) }}
                            />
                            <button className="comment-send-btn" onClick={() => handleComment(post.id)} disabled={!(commentTexts[post.id] && commentTexts[post.id].trim())}>
                                <Send size={15} />
                            </button>
                        </div>

                        {/* Bid Section for Mandi Options */}
                        {post.type === 'mandi' && (
                            <div style={{ marginTop: 16, borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: 16 }}>
                                {post.bids && post.bids.length > 0 && (
                                    <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-dim)', fontWeight: 700 }}>Bid History</div>
                                        {post.bids.slice().reverse().map(b => (
                                            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: 6 }}>
                                                <span style={{ color: 'var(--text-secondary)' }}>{b.author}</span>
                                                <span style={{ color: '#00e8a2', fontWeight: 600 }}>₹{b.amount}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <div style={{ position: 'relative', flex: 1 }}>
                                        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', fontSize: '0.9rem', fontWeight: 600 }}>₹</span>
                                        <input
                                            className="field-input"
                                            type="number"
                                            placeholder={lang === 'Hindi' ? "बोली राशि..." : "Bid Amount..."}
                                            value={bidAmounts[post.id] || ''}
                                            onChange={e => setBidAmounts({ ...bidAmounts, [post.id]: e.target.value })}
                                            style={{ paddingLeft: 30, borderRadius: 20, width: '100%', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                    <button
                                        className="btn-primary"
                                        style={{ padding: '0 16px', borderRadius: 20, fontSize: '0.85rem' }}
                                        onClick={() => handleBid(post.id, post.price)}
                                        disabled={!bidAmounts[post.id]}
                                    >
                                        Place Bid
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                {!loading && posts.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', background: 'var(--bg-elevated)', borderRadius: 16, border: '1px dashed rgba(255,255,255,0.1)' }}>
                        <Users size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} color="var(--primary)" />
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>No posts found</div>
                        <div style={{ fontSize: '0.85rem', marginTop: 8 }}>Be the first to share something with the community!</div>
                    </div>
                )}
            </div>
            <div style={{ height: 60 }} />
        </div>
    );
}

export default App;
