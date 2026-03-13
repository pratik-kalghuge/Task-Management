import React, {
  useState, useReducer, useMemo, useCallback, useEffect,
  createContext, useContext
} from 'react'

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const PRIORITIES = ['critical','high','medium','low']
const STATUSES   = ['todo','in-progress','done']
const CATEGORIES = ['Engineering','Design','Marketing','Management','Research','Other']

const P_CFG = {
  critical: { label:'Critical', color:'#f43f5e', bg:'rgba(244,63,94,0.13)'   },
  high:     { label:'High',     color:'#f97316', bg:'rgba(249,115,22,0.13)'  },
  medium:   { label:'Medium',   color:'#3b82f6', bg:'rgba(59,130,246,0.13)'  },
  low:      { label:'Low',      color:'#22c55e', bg:'rgba(34,197,94,0.13)'   },
}
const S_CFG = {
  'todo':        { label:'To Do',       color:'#6b7280', bg:'rgba(107,114,128,0.12)' },
  'in-progress': { label:'In Progress', color:'#f59e0b', bg:'rgba(245,158,11,0.12)'  },
  'done':        { label:'Done',        color:'#10b981', bg:'rgba(16,185,129,0.12)'  },
}
const CAT_COLOR = {
  Engineering:'#38bdf8', Design:'#a78bfa', Marketing:'#f472b6',
  Management:'#f59e0b',  Research:'#34d399', Other:'#9ca3af',
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2) }

function initials(name = '') {
  return name.split(' ').map(n => n[0] || '').join('').toUpperCase().slice(0, 2) || '?'
}

function avatarColor(name = '') {
  const list = ['#f59e0b','#3b82f6','#10b981','#a78bfa','#f472b6','#34d399']
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0
  return list[Math.abs(h) % list.length]
}

function dueLabel(str) {
  if (!str) return null
  const d = new Date(str), now = new Date()
  const diff = Math.ceil((d - now) / 86400000)
  if (diff < 0)   return { text: `${Math.abs(diff)}d overdue`, color: '#f43f5e' }
  if (diff === 0) return { text: 'Due today',    color: '#f59e0b' }
  if (diff === 1) return { text: 'Due tomorrow', color: '#f59e0b' }
  if (diff <= 7)  return { text: `${diff}d left`, color: '#9ca3af' }
  return { text: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), color: '#9ca3af' }
}

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s/60)}m ago`
  if (s < 86400) return `${Math.floor(s/3600)}h ago`
  return `${Math.floor(s/86400)}d ago`
}

// ─────────────────────────────────────────────
// SEED DATA
// ─────────────────────────────────────────────


// ─────────────────────────────────────────────
// STYLES (shared objects)
// ─────────────────────────────────────────────
const C = {
  bg:      '#0f0e0c',
  surface: '#161410',
  card:    '#1c1a16',
  cardHov: '#201e19',
  border:  'rgba(255,255,255,0.07)',
  text:    '#f0ece4',
  sub:     '#6b6558',
  muted:   '#2a2820',
  accent:  '#f59e0b',
}

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
const initialState = {
  tasks: [],
  search: '', statusF: 'all', priorityF: 'all', categoryF: 'all',
  sortBy: 'createdAt', sortDir: 'desc',
  view: 'board',
  selected: new Set(),
}

function reducer(s, a) {
  switch (a.type) {
    case 'ADD':        return { ...s, tasks: [a.task, ...s.tasks] }
    case 'UPDATE':     return { ...s, tasks: s.tasks.map(t => t.id === a.task.id ? a.task : t) }
    case 'DELETE':     return { ...s, tasks: s.tasks.filter(t => t.id !== a.id), selected: new Set() }
    case 'BULK_DEL':   return { ...s, tasks: s.tasks.filter(t => !s.selected.has(t.id)), selected: new Set() }
    case 'PIN':        return { ...s, tasks: s.tasks.map(t => t.id === a.id ? { ...t, pinned: !t.pinned } : t) }
    case 'ADD_SUB':    return { ...s, tasks: s.tasks.map(t => t.id === a.tid ? { ...t, subtasks: [...t.subtasks, a.sub] } : t) }
    case 'TOG_SUB':    return { ...s, tasks: s.tasks.map(t => t.id === a.tid ? { ...t, subtasks: t.subtasks.map(x => x.id === a.sid ? { ...x, done: !x.done } : x) } : t) }
    case 'DEL_SUB':    return { ...s, tasks: s.tasks.map(t => t.id === a.tid ? { ...t, subtasks: t.subtasks.filter(x => x.id !== a.sid) } : t) }
    case 'ADD_CMT':    return { ...s, tasks: s.tasks.map(t => t.id === a.tid ? { ...t, comments: [...t.comments, a.cmt] } : t) }
    case 'SET_SEARCH': return { ...s, search: a.v }
    case 'SET_SF':     return { ...s, statusF: a.v }
    case 'SET_PF':     return { ...s, priorityF: a.v }
    case 'SET_CF':     return { ...s, categoryF: a.v }
    case 'SET_SORT':   return { ...s, sortBy: a.by, sortDir: s.sortBy === a.by && s.sortDir === 'asc' ? 'desc' : 'asc' }
    case 'RESET_F':    return { ...s, search: '', statusF: 'all', priorityF: 'all', categoryF: 'all' }
    case 'TOG_SEL': {
      const n = new Set(s.selected); n.has(a.id) ? n.delete(a.id) : n.add(a.id)
      return { ...s, selected: n }
    }
    case 'SEL_ALL':    return { ...s, selected: new Set(a.ids) }
    case 'CLR_SEL':    return { ...s, selected: new Set() }
    case 'SET_VIEW':   return { ...s, view: a.v }
    default: return s
  }
}

// ─────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────
const Ctx = createContext(null)
function useTasks() { return useContext(Ctx) }

function Provider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const filtered = useMemo(() => {
    let r = [...state.tasks]
    const q = state.search.toLowerCase().trim()
    if (q) r = r.filter(t => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || t.assignee?.toLowerCase().includes(q) || t.tags?.some(g => g.includes(q)))
    if (state.statusF   !== 'all') r = r.filter(t => t.status   === state.statusF)
    if (state.priorityF !== 'all') r = r.filter(t => t.priority === state.priorityF)
    if (state.categoryF !== 'all') r = r.filter(t => t.category === state.categoryF)
    const po = { critical:0, high:1, medium:2, low:3 }
    r.sort((a, b) => {
      let c = 0
      if      (state.sortBy === 'priority') c = po[a.priority] - po[b.priority]
      else if (state.sortBy === 'dueDate')  c = new Date(a.dueDate || '9999') - new Date(b.dueDate || '9999')
      else if (state.sortBy === 'title')    c = a.title.localeCompare(b.title)
      else c = new Date(b.createdAt) - new Date(a.createdAt)
      return state.sortDir === 'asc' ? c : -c
    })
    r.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
    return r
  }, [state])

  const stats = useMemo(() => {
    const t = state.tasks, total = t.length
    const done   = t.filter(x => x.status === 'done').length
    const inProg = t.filter(x => x.status === 'in-progress').length
    const todo   = t.filter(x => x.status === 'todo').length
    const overdue= t.filter(x => x.dueDate && new Date(x.dueDate) < new Date() && x.status !== 'done').length
    const pinned = t.filter(x => x.pinned).length
    return { total, done, inProg, todo, overdue, pinned, pct: total ? Math.round(done / total * 100) : 0 }
  }, [state.tasks])

  const cats = useMemo(() => [...new Set(state.tasks.map(t => t.category).filter(Boolean))].sort(), [state.tasks])

  const addTask    = useCallback(d => dispatch({ type:'ADD', task:{ ...d, id:uid(), pinned:false, subtasks:[], comments:[], createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() } }), [])
  const updateTask = useCallback((id, d) => dispatch({ type:'UPDATE', task:{ ...state.tasks.find(t => t.id === id), ...d, updatedAt:new Date().toISOString() } }), [state.tasks])
  const deleteTask = useCallback(id => dispatch({ type:'DELETE', id }), [])
  const bulkDelete = useCallback(() => dispatch({ type:'BULK_DEL' }), [])
  const cycleStatus= useCallback(task => {
    const nxt = { todo:'in-progress', 'in-progress':'done', done:'todo' }
    updateTask(task.id, { status: nxt[task.status] })
  }, [updateTask])

  return <Ctx.Provider value={{ state, dispatch, filtered, stats, cats, addTask, updateTask, deleteTask, bulkDelete, cycleStatus }}>{children}</Ctx.Provider>
}

// ─────────────────────────────────────────────
// SMALL UI COMPONENTS
// ─────────────────────────────────────────────
function Badge({ label, color, bg, dot }) {
  return (
    <span style={{ color, background: bg, border:`1px solid ${color}20`, borderRadius:99, padding:'2px 9px', fontSize:11, fontWeight:600, display:'inline-flex', alignItems:'center', gap:5, whiteSpace:'nowrap' }}>
      {dot && <span style={{ width:6, height:6, borderRadius:'50%', background:color, flexShrink:0 }} />}
      {label}
    </span>
  )
}

function Avatar({ name = '?', size = 28 }) {
  const color = avatarColor(name)
  return (
    <div title={name} style={{ width:size, height:size, borderRadius:'50%', background:`${color}20`, color, border:`1px solid ${color}40`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.36, fontWeight:700, flexShrink:0, userSelect:'none' }}>
      {initials(name)}
    </div>
  )
}

function Btn({ children, onClick, variant='primary', size='md', disabled, style={} }) {
  const v = {
    primary: { background:C.accent, color:'#0a0908', border:'none', boxShadow:'0 4px 14px rgba(245,158,11,0.28)' },
    ghost:   { background:'transparent', color:C.sub, border:'none' },
    outline: { background:'transparent', color:C.sub, border:`1px solid ${C.border}` },
    danger:  { background:'rgba(244,63,94,0.1)', color:'#fb7185', border:'1px solid rgba(244,63,94,0.22)' },
  }[variant]
  const sz = { xs:{ padding:'3px 8px', fontSize:11 }, sm:{ padding:'5px 11px', fontSize:12 }, md:{ padding:'7px 15px', fontSize:13 }, lg:{ padding:'10px 20px', fontSize:14 } }[size]
  return <button onClick={onClick} disabled={disabled} style={{ display:'inline-flex', alignItems:'center', gap:6, borderRadius:10, fontWeight:600, cursor:disabled?'not-allowed':'pointer', transition:'all .15s', opacity:disabled?0.5:1, ...sz, ...v, ...style }}>{children}</button>
}

function Field({ label, children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
      {label && <span style={{ fontSize:10, fontWeight:700, color:C.sub, textTransform:'uppercase', letterSpacing:'.07em' }}>{label}</span>}
      {children}
    </div>
  )
}

const inputSt = { width:'100%', padding:'8px 10px', borderRadius:8, border:`1px solid ${C.border}`, background:C.card, color:C.text, fontSize:13, boxSizing:'border-box' }
const selectSt = { ...inputSt, cursor:'pointer', background:C.surface }

function ProgressBar({ value, color=C.accent, height=6, style={} }) {
  return (
    <div style={{ height, background:C.muted, borderRadius:99, overflow:'hidden', ...style }}>
      <div style={{ width:`${Math.min(100,Math.max(0,value))}%`, height:'100%', background:color, borderRadius:99, transition:'width .5s' }} />
    </div>
  )
}

function Spinner() {
  return <div style={{ width:32, height:32, borderRadius:'50%', border:`2px solid ${C.muted}`, borderTopColor:C.accent, animation:'spin .8s linear infinite' }} />
}

function Modal({ children, onClose, width=540 }) {
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:500, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div className="pop-in" onClick={e => e.stopPropagation()} style={{ position:'relative', width:'100%', maxWidth:width, maxHeight:'90vh', overflowY:'auto', background:C.card, border:`1px solid ${C.border}`, borderRadius:20, boxShadow:'0 32px 80px rgba(0,0,0,.55)' }}>
        {children}
      </div>
    </div>
  )
}

function MHead({ children, onClose }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'20px 20px 14px', borderBottom:`1px solid ${C.border}` }}>
      <div style={{ flex:1 }}>{children}</div>
      <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:C.sub, fontSize:22, lineHeight:1, paddingLeft:12 }}>×</button>
    </div>
  )
}

function MFoot({ children }) {
  return <div style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:'14px 20px', borderTop:`1px solid ${C.border}` }}>{children}</div>
}

function Toast({ msg, type }) {
  if (!msg) return null
  const colors = { success:['rgba(16,185,129,.15)','rgba(16,185,129,.3)','#34d399'], error:['rgba(244,63,94,.15)','rgba(244,63,94,.3)','#fb7185'], info:['rgba(59,130,246,.15)','rgba(59,130,246,.3)','#60a5fa'] }
  const [bg, border, color] = colors[type] || colors.success
  return <div style={{ position:'fixed', bottom:24, right:24, zIndex:9999, padding:'12px 20px', borderRadius:12, background:bg, border:`1px solid ${border}`, color, fontWeight:600, fontSize:13, backdropFilter:'blur(12px)', boxShadow:'0 8px 32px rgba(0,0,0,.4)', animation:'slideUp .3s ease' }}>{msg}</div>
}

// ─────────────────────────────────────────────
// HEADER
// ─────────────────────────────────────────────
function Header({ onNew }) {
  return (
    <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 28px', background:'rgba(15,14,12,0.95)', borderBottom:`1px solid ${C.border}`, position:'sticky', top:0, zIndex:100, backdropFilter:'blur(12px)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#f59e0b,#d97706)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, boxShadow:'0 4px 16px rgba(245,158,11,.35)' }}>✓</div>
        <span style={{ fontWeight:800, fontSize:20, letterSpacing:'-.5px' }}>Task-management</span>
        {/* <span style={{ fontSize:10, padding:'2px 7px', borderRadius:4, background:'rgba(245,158,11,.15)', color:C.accent, border:'1px solid rgba(245,158,11,.25)', fontFamily:"'JetBrains Mono',monospace" }}>PRO</span> */}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        {/* <span style={{ fontSize:11, color:'#34d399', display:'flex', alignItems:'center', gap:5, fontFamily:"'JetBrains Mono',monospace" }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:'#34d399', display:'inline-block' }} />
          Live
        </span> */}
        <Btn size="sm" onClick={onNew}>＋ New Task</Btn>
      </div>
    </header>
  )
}

// ─────────────────────────────────────────────
// STATS BAR
// ─────────────────────────────────────────────
function StatsBar() {
  const { stats } = useTasks()
  const cards = [
    { icon:'📋', label:'Total',       val:stats.total,   color:'#f59e0b' },
    { icon:'✅', label:'Done',         val:stats.done,    color:'#10b981', sub:`${stats.pct}%` },
    { icon:'⚡', label:'In Progress',  val:stats.inProg,  color:'#3b82f6' },
    { icon:'○',  label:'To Do',        val:stats.todo,    color:'#6b7280' },
    { icon:'⚠️', label:'Overdue',      val:stats.overdue, color:'#f43f5e' },
    { icon:'📌', label:'Pinned',       val:stats.pinned,  color:'#a78bfa' },
  ]
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10 }}>
        {cards.map(c => (
          <div key={c.label} className="fade-in" style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:'14px 16px', display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:38, height:38, borderRadius:10, background:`${c.color}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>{c.icon}</div>
            <div>
              <div style={{ fontWeight:800, fontSize:22, lineHeight:1 }}>{c.val}{c.sub && <span style={{ fontSize:12, color:c.color, marginLeft:5 }}>{c.sub}</span>}</div>
              <div style={{ fontSize:11, color:C.sub, marginTop:2 }}>{c.label}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:'12px 20px', display:'flex', alignItems:'center', gap:14 }}>
        <span style={{ fontWeight:600, fontSize:13, whiteSpace:'nowrap' }}>Overall Progress</span>
        <ProgressBar value={stats.pct} color="linear-gradient(90deg,#f59e0b,#10b981)" height={8} style={{ flex:1 }} />
        <span style={{ fontWeight:800, fontSize:13, color:'#10b981', whiteSpace:'nowrap' }}>{stats.pct}%</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// TOOLBAR
// ─────────────────────────────────────────────
function Toolbar({ onBulkDel }) {
  const { state, dispatch, filtered, cats } = useTasks()
  const sel = state.selected.size
  const hasF = state.search || state.statusF !== 'all' || state.priorityF !== 'all' || state.categoryF !== 'all'

  const tab = (active) => ({ padding:'7px 12px', fontSize:12, fontWeight:600, background: active ? 'rgba(245,158,11,.14)' : 'transparent', color: active ? C.accent : C.sub, border:'none', cursor:'pointer', transition:'all .15s' })

  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:'14px 16px', display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
        {/* Search */}
        <div style={{ position:'relative', flex:1, minWidth:200 }}>
          <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:C.sub }}>🔍</span>
          <input value={state.search} onChange={e => dispatch({ type:'SET_SEARCH', v:e.target.value })}
            placeholder="Search tasks, assignees, tags…"
            style={{ ...inputSt, paddingLeft:34, width:'100%' }} />
        </div>
        {/* Sort */}
        <div style={{ display:'flex', borderRadius:10, border:`1px solid ${C.border}`, overflow:'hidden', background:C.surface }}>
          {[['createdAt','Date'],['priority','Priority'],['dueDate','Due'],['title','Title']].map(([k, l]) => (
            <button key={k} onClick={() => dispatch({ type:'SET_SORT', by:k })} style={tab(state.sortBy === k)}>
              {l}{state.sortBy === k && (state.sortDir === 'asc' ? ' ↑' : ' ↓')}
            </button>
          ))}
        </div>
        {/* View */}
        <div style={{ display:'flex', borderRadius:10, border:`1px solid ${C.border}`, overflow:'hidden', background:C.surface }}>
          {[['board','⊞ Board'],['list','☰ List'],['calendar','📅 Cal'],['analytics','📊 Stats']].map(([v, l]) => (
            <button key={v} onClick={() => dispatch({ type:'SET_VIEW', v })} style={tab(state.view === v)}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
        <select value={state.statusF}   onChange={e => dispatch({ type:'SET_SF', v:e.target.value })}   style={{ ...selectSt, width:'auto' }}>
          <option value="all">All Status</option>
          {STATUSES.map(s => <option key={s} value={s}>{S_CFG[s].label}</option>)}
        </select>
        <select value={state.priorityF} onChange={e => dispatch({ type:'SET_PF', v:e.target.value })}   style={{ ...selectSt, width:'auto' }}>
          <option value="all">All Priority</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{P_CFG[p].label}</option>)}
        </select>
        <select value={state.categoryF} onChange={e => dispatch({ type:'SET_CF', v:e.target.value })}   style={{ ...selectSt, width:'auto' }}>
          <option value="all">All Categories</option>
          {cats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {hasF && <Btn variant="ghost" size="sm" style={{ color:'#fb7185' }} onClick={() => dispatch({ type:'RESET_F' })}>✕ Clear</Btn>}
        {sel > 0 && (
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:12, color:C.sub }}>{sel} selected</span>
            <Btn size="xs" variant="outline" onClick={() => dispatch({ type:'SEL_ALL', ids:filtered.map(t => t.id) })}>All</Btn>
            <Btn size="xs" variant="ghost"   onClick={() => dispatch({ type:'CLR_SEL' })}>None</Btn>
            <Btn size="sm" variant="danger"  onClick={onBulkDel}>🗑 Delete {sel}</Btn>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// TASK CARD
// ─────────────────────────────────────────────
function TaskCard({ task, onDetail, onEdit, onDelete }) {
  const { state, dispatch, cycleStatus } = useTasks()
  const sel  = state.selected.has(task.id)
  const pCfg = P_CFG[task.priority] || P_CFG.low
  const due  = dueLabel(task.dueDate)
  const done = task.status === 'done'
  const dc   = task.subtasks?.filter(s => s.done).length || 0
  const sp   = task.subtasks?.length ? Math.round(dc / task.subtasks.length * 100) : null

  return (
    <div className="fade-in" onClick={() => onDetail(task)}
      style={{ background: sel ? `linear-gradient(145deg,rgba(245,158,11,.07),${C.card})` : C.card, border:`1px solid ${sel?'rgba(245,158,11,.35)':C.border}`, borderRadius:14, padding:14, cursor:'pointer', transition:'all .15s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = sel?'rgba(245,158,11,.35)':'rgba(255,255,255,.13)'; e.currentTarget.style.transform='translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = sel?'rgba(245,158,11,.35)':C.border; e.currentTarget.style.transform='translateY(0)' }}>

      <div style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:8 }}>
        <button onClick={e => { e.stopPropagation(); dispatch({ type:'TOG_SEL', id:task.id }) }}
          style={{ width:16, height:16, borderRadius:4, flexShrink:0, marginTop:2, border:`1px solid ${sel?C.accent:'rgba(255,255,255,.2)'}`, background:sel?C.accent:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#0a0908' }}>
          {sel ? '✓' : ''}
        </button>
        {task.pinned && <span style={{ fontSize:11 }}>📌</span>}
        <span style={{ flex:1, fontWeight:700, fontSize:13, lineHeight:1.35, color:done?C.sub:C.text, textDecoration:done?'line-through':'none' }}>{task.title}</span>
        <div style={{ display:'flex', gap:1 }}>
          <IBtn onClick={e => { e.stopPropagation(); dispatch({ type:'PIN', id:task.id }) }}>📍</IBtn>
          <IBtn onClick={e => { e.stopPropagation(); onEdit(task) }}>✏️</IBtn>
          <IBtn onClick={e => { e.stopPropagation(); onDelete(task) }}>🗑</IBtn>
        </div>
      </div>

      {task.description && <p style={{ fontSize:12, color:C.sub, lineHeight:1.5, marginBottom:8, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{task.description}</p>}

      <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:8 }}>
        <Badge label={pCfg.label} color={pCfg.color} bg={pCfg.bg} dot />
        {task.category && <Badge label={task.category} color={CAT_COLOR[task.category]||'#9ca3af'} bg={`${CAT_COLOR[task.category]||'#9ca3af'}18`} />}
      </div>

      {task.tags?.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>
          {task.tags.slice(0,3).map(t => <span key={t} style={{ fontSize:10, fontFamily:"'JetBrains Mono',monospace", padding:'2px 6px', borderRadius:4, background:'rgba(107,101,88,.14)', color:C.sub, border:`1px solid rgba(107,101,88,.22)` }}>#{t}</span>)}
          {task.tags.length > 3 && <span style={{ fontSize:10, color:C.sub }}>+{task.tags.length-3}</span>}
        </div>
      )}

      {sp !== null && (
        <div style={{ marginBottom:8 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
            <span style={{ fontSize:10, color:C.sub }}>Subtasks {dc}/{task.subtasks.length}</span>
            <span style={{ fontSize:10, color:sp===100?'#10b981':C.accent }}>{sp}%</span>
          </div>
          <ProgressBar value={sp} color={sp===100?'#10b981':C.accent} height={4} />
        </div>
      )}

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:8, borderTop:`1px solid ${C.border}` }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {due && <span style={{ fontSize:11, fontFamily:"'JetBrains Mono',monospace", color:due.color }}>⏰ {due.text}</span>}
          {task.comments?.length > 0 && <span style={{ fontSize:11, color:C.sub }}>💬 {task.comments.length}</span>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <button onClick={e => { e.stopPropagation(); cycleStatus(task) }}
            style={{ background:'none', border:'none', cursor:'pointer', fontSize:15, color:done?'#10b981':C.sub, lineHeight:1 }}>
            {done ? '✅' : '⭕'}
          </button>
          {task.assignee && <Avatar name={task.assignee} size={24} />}
        </div>
      </div>
    </div>
  )
}

function IBtn({ children, onClick }) {
  return <button onClick={onClick} style={{ background:'none', border:'none', cursor:'pointer', fontSize:12, opacity:.45, padding:2, lineHeight:1 }}>{children}</button>
}

// ─────────────────────────────────────────────
// TASK ROW (list view)
// ─────────────────────────────────────────────
function TaskRow({ task, onDetail, onEdit, onDelete }) {
  const { state, dispatch, cycleStatus } = useTasks()
  const sel  = state.selected.has(task.id)
  const pCfg = P_CFG[task.priority] || P_CFG.low
  const sCfg = S_CFG[task.status]   || S_CFG.todo
  const due  = dueLabel(task.dueDate)

  return (
    <div onClick={() => onDetail(task)}
      style={{ display:'grid', gridTemplateColumns:'24px 24px 1fr 110px 120px 110px 44px 60px', gap:8, padding:'10px 16px', borderBottom:`1px solid ${C.border}`, cursor:'pointer', background:sel?'rgba(245,158,11,.04)':'transparent', transition:'background .1s' }}
      onMouseEnter={e => { if(!sel) e.currentTarget.style.background='rgba(255,255,255,.025)' }}
      onMouseLeave={e => { e.currentTarget.style.background=sel?'rgba(245,158,11,.04)':'transparent' }}>

      <button onClick={e=>{e.stopPropagation();dispatch({type:'TOG_SEL',id:task.id})}} style={{width:16,height:16,borderRadius:4,border:`1px solid ${sel?C.accent:'rgba(255,255,255,.18)'}`,background:sel?C.accent:'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:'#0a0908',alignSelf:'center'}}>
        {sel?'✓':''}
      </button>
      <button onClick={e=>{e.stopPropagation();cycleStatus(task)}} style={{background:'none',border:'none',cursor:'pointer',fontSize:14,color:task.status==='done'?'#10b981':C.sub,alignSelf:'center',lineHeight:1}}>
        {task.status==='done'?'✅':'⭕'}
      </button>
      <div style={{minWidth:0,alignSelf:'center'}}>
        <div style={{fontWeight:700,fontSize:13,color:task.status==='done'?C.sub:C.text,textDecoration:task.status==='done'?'line-through':'none',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{task.pinned&&'📌 '}{task.title}</div>
        {task.description&&<div style={{fontSize:11,color:C.sub,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{task.description}</div>}
      </div>
      <div style={{alignSelf:'center'}}><Badge label={pCfg.label} color={pCfg.color} bg={pCfg.bg} dot /></div>
      <div style={{alignSelf:'center'}}><Badge label={sCfg.label} color={sCfg.color} bg={sCfg.bg} /></div>
      <div style={{alignSelf:'center',fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:due?.color||C.sub}}>{due?.text||'—'}</div>
      <div style={{alignSelf:'center'}}>{task.assignee?<Avatar name={task.assignee} size={24}/>:<span style={{color:C.muted}}>—</span>}</div>
      <div style={{display:'flex',gap:2,alignSelf:'center'}}>
        <IBtn onClick={e=>{e.stopPropagation();onEdit(task)}}>✏️</IBtn>
        <IBtn onClick={e=>{e.stopPropagation();onDelete(task)}}>🗑</IBtn>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// VIEWS
// ─────────────────────────────────────────────
function BoardView({ onDetail, onEdit, onDelete }) {
  const { filtered, state } = useTasks()
  const by = { todo:[], 'in-progress':[], done:[] }
  filtered.forEach(t => by[t.status]?.push(t))

  if (!filtered.length) return (
    <div style={{ padding:80, textAlign:'center', color:C.sub, display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
      <div style={{ width:72, height:72, borderRadius:20, background:'rgba(245,158,11,.1)', border:'2px dashed rgba(245,158,11,.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32 }}>📋</div>
      <div>
        <p style={{ fontWeight:800, fontSize:18, color:C.text, marginBottom:6 }}>{state.tasks.length === 0 ? 'No tasks yet' : 'No tasks found'}</p>
        <p style={{ fontSize:13 }}>{state.tasks.length === 0 ? 'Click "+ New Task" to get started' : 'Adjust your filters or create a new task'}</p>
      </div>
    </div>
  )

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:16, alignItems:'start' }}>
      {[['todo','○','To Do'],['in-progress','◑','In Progress'],['done','●','Done']].map(([key, icon, label]) => {
        const cfg = S_CFG[key], tasks = by[key]
        return (
          <div key={key}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, padding:'0 2px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ color:cfg.color, fontSize:15 }}>{icon}</span>
                <span style={{ fontWeight:700, fontSize:13 }}>{label}</span>
              </div>
              <span style={{ fontSize:11, padding:'2px 8px', borderRadius:99, background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.color}28` }}>{tasks.length}</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {tasks.map(t => <TaskCard key={t.id} task={t} onDetail={onDetail} onEdit={onEdit} onDelete={onDelete} />)}
              {!tasks.length && <div style={{ borderRadius:12, padding:'28px 16px', textAlign:'center', border:`2px dashed ${C.border}`, color:C.sub, fontSize:12 }}>Empty</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ListView({ onDetail, onEdit, onDelete }) {
  const { filtered } = useTasks()
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden' }}>
      <div style={{ display:'grid', gridTemplateColumns:'24px 24px 1fr 110px 120px 110px 44px 60px', gap:8, padding:'8px 16px', borderBottom:`1px solid ${C.border}`, background:'rgba(255,255,255,.02)' }}>
        {['','','Title','Priority','Status','Due','','Actions'].map((h,i) => <span key={i} style={{ fontSize:10, fontWeight:700, color:C.sub, textTransform:'uppercase', letterSpacing:'.06em' }}>{h}</span>)}
      </div>
      {!filtered.length && <div style={{ padding:40, textAlign:'center', color:C.sub }}>No tasks found</div>}
      {filtered.map(t => <TaskRow key={t.id} task={t} onDetail={onDetail} onEdit={onEdit} onDelete={onDelete} />)}
      <div style={{ padding:'8px 16px', borderTop:`1px solid ${C.border}`, fontSize:11, color:C.sub, fontFamily:"'JetBrains Mono',monospace" }}>
        {filtered.length} task{filtered.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}

function CalendarView({ onDetail }) {
  const { state } = useTasks()
  const [cur, setCur] = useState(new Date())
  const yr=cur.getFullYear(), mo=cur.getMonth()
  const first=new Date(yr,mo,1).getDay(), days=new Date(yr,mo+1,0).getDate()
  const today=new Date()
  const MN=['January','February','March','April','May','June','July','August','September','October','November','December']
  const byDay={}
  state.tasks.forEach(t=>{
    if(!t.dueDate) return
    const d=new Date(t.dueDate)
    if(d.getMonth()===mo&&d.getFullYear()===yr){const n=d.getDate();byDay[n]=[...(byDay[n]||[]),t]}
  })
  const cells=[...Array(first).fill(null),...Array.from({length:days},(_,i)=>i+1)]

  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:20 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <Btn variant="ghost" size="sm" onClick={()=>setCur(new Date(yr,mo-1))}>← Prev</Btn>
        <span style={{ fontWeight:700, fontSize:16 }}>{MN[mo]} {yr}</span>
        <Btn variant="ghost" size="sm" onClick={()=>setCur(new Date(yr,mo+1))}>Next →</Btn>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:8 }}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} style={{textAlign:'center',fontSize:11,fontWeight:700,color:C.sub,padding:'4px 0'}}>{d}</div>)}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
        {cells.map((day,i)=>{
          if(!day) return <div key={i}/>
          const isToday=today.getDate()===day&&today.getMonth()===mo&&today.getFullYear()===yr
          const dt=byDay[day]||[]
          return (
            <div key={i} style={{minHeight:72,padding:4,borderRadius:8,border:`1px solid ${isToday?'rgba(245,158,11,.45)':C.border}`,background:isToday?'rgba(245,158,11,.06)':'transparent'}}>
              <span style={{fontSize:12,fontWeight:isToday?700:400,color:isToday?C.accent:C.sub}}>{day}</span>
              <div style={{display:'flex',flexDirection:'column',gap:2,marginTop:2}}>
                {dt.slice(0,2).map(t=>{const pc=P_CFG[t.priority];return<div key={t.id} onClick={()=>onDetail(t)} style={{fontSize:10,padding:'1px 4px',borderRadius:4,background:pc.bg,color:pc.color,cursor:'pointer',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.title}</div>})}
                {dt.length>2&&<span style={{fontSize:9,color:C.sub}}>+{dt.length-2} more</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AnalyticsView() {
  const { state, stats } = useTasks()
  const tasks=state.tasks
  const byCat=CATEGORIES.reduce((a,c)=>({...a,[c]:tasks.filter(t=>t.category===c).length}),{})
  const byPri=PRIORITIES.reduce((a,p)=>({...a,[p]:tasks.filter(t=>t.priority===p).length}),{})
  const maxCat=Math.max(...Object.values(byCat),1)
  const maxPri=Math.max(...Object.values(byPri),1)
  const Acard=({title,children})=>(
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:20}}>
      <h3 style={{fontWeight:700,marginBottom:16,fontSize:15}}>{title}</h3>
      {children}
    </div>
  )
  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:16}}>
      <Acard title="Status Breakdown">
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {[['todo','To Do',stats.todo],['in-progress','In Progress',stats.inProg],['done','Done',stats.done]].map(([k,l,n])=>{
            const cfg=S_CFG[k],pct=stats.total?Math.round(n/stats.total*100):0
            return(<div key={k}><div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><span style={{fontSize:13}}>{l}</span><span style={{fontSize:13,fontWeight:700,color:cfg.color}}>{n} <span style={{fontSize:11,color:C.sub}}>({pct}%)</span></span></div><ProgressBar value={pct} color={cfg.color} height={8}/></div>)
          })}
        </div>
      </Acard>
      <Acard title="By Priority">
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {PRIORITIES.map(p=>{const cfg=P_CFG[p],n=byPri[p],pct=Math.round(n/maxPri*100);return(<div key={p}><div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><span style={{fontSize:13,color:cfg.color,fontWeight:600}}>{cfg.label}</span><span style={{fontSize:13,fontWeight:700,color:cfg.color}}>{n}</span></div><ProgressBar value={pct} color={cfg.color} height={6}/></div>)})}
        </div>
      </Acard>
      <Acard title="By Category">
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {CATEGORIES.filter(c=>byCat[c]>0).sort((a,b)=>byCat[b]-byCat[a]).map(c=>{const color=CAT_COLOR[c]||'#9ca3af',pct=Math.round(byCat[c]/maxCat*100);return(<div key={c}><div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}><span style={{fontSize:12,color,fontWeight:600}}>{c}</span><span style={{fontSize:12,color:C.sub}}>{byCat[c]}</span></div><ProgressBar value={pct} color={color} height={5}/></div>)})}
        </div>
      </Acard>
      <Acard title="Quick Insights">
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {[{i:'🔥',l:'Completion',v:`${stats.pct}%`,c:'#10b981'},{i:'⚠️',l:'Overdue',v:stats.overdue,c:stats.overdue>0?'#f43f5e':'#10b981'},{i:'📌',l:'Pinned',v:stats.pinned,c:'#a78bfa'},{i:'⚡',l:'Active',v:stats.inProg+stats.todo,c:'#3b82f6'},{i:'💬',l:'Comments',v:tasks.reduce((s,t)=>s+(t.comments?.length||0),0),c:C.accent}].map(r=>(
            <div key={r.l} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',borderRadius:8,background:'rgba(255,255,255,.02)'}}>
              <span style={{fontSize:13,color:C.sub}}>{r.i} {r.l}</span>
              <span style={{fontSize:18,fontWeight:800,color:r.c}}>{r.v}</span>
            </div>
          ))}
        </div>
      </Acard>
    </div>
  )
}

// ─────────────────────────────────────────────
// MODALS
// ─────────────────────────────────────────────
const BLANK = { title:'', description:'', status:'todo', priority:'medium', category:'Engineering', dueDate:'', assignee:'', tags:[] }

function FormModal({ task, onSave, onClose, saving }) {
  const [form, setForm] = useState(task ? { ...BLANK, ...task } : BLANK)
  const [tagIn, setTagIn] = useState('')
  const [err, setErr] = useState({})
  const set = (k, v) => { setForm(f => ({ ...f, [k]:v })); if (err[k]) setErr(e => ({ ...e, [k]:null })) }
  const addTag = () => { const t=tagIn.trim().toLowerCase().replace(/\s+/g,'-'); if(t&&!form.tags.includes(t)) set('tags',[...form.tags,t]); setTagIn('') }

  return (
    <Modal onClose={onClose}>
      <MHead onClose={onClose}>
        <h2 style={{ fontWeight:800, fontSize:18, margin:0 }}>{task ? 'Edit Task' : 'New Task'}</h2>
        <p style={{ fontSize:12, color:C.sub, marginTop:3 }}>Fill in the details below</p>
      </MHead>
      <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:14 }}>
        <Field label="Title *">
          <input value={form.title} onChange={e=>set('title',e.target.value)} placeholder="What needs to be done?"
            style={{ ...inputSt, borderColor:err.title?'#f43f5e':undefined }} />
          {err.title && <span style={{ fontSize:11, color:'#fb7185' }}>{err.title}</span>}
        </Field>
        <Field label="Description">
          <textarea value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Add context or details…"
            rows={3} style={{ ...inputSt, resize:'none' }} />
        </Field>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <Field label="Status">
            <select value={form.status} onChange={e=>set('status',e.target.value)} style={selectSt}>
              {STATUSES.map(s => <option key={s} value={s}>{S_CFG[s].label}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select value={form.priority} onChange={e=>set('priority',e.target.value)} style={selectSt}>
              {PRIORITIES.map(p => <option key={p} value={p}>{P_CFG[p].label}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <Field label="Category">
            <select value={form.category} onChange={e=>set('category',e.target.value)} style={selectSt}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Due Date">
            <input type="date" value={form.dueDate} onChange={e=>set('dueDate',e.target.value)} style={selectSt} />
          </Field>
        </div>
        <Field label="Assignee">
          <input value={form.assignee} onChange={e=>set('assignee',e.target.value)} placeholder="e.g. Alex M." style={inputSt} />
        </Field>
        <Field label="Tags">
          <div style={{ display:'flex', gap:6 }}>
            <input value={tagIn} onChange={e=>setTagIn(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addTag()}}} placeholder="Add tag, press Enter…" style={{ ...inputSt, flex:1 }} />
            <Btn size="sm" variant="outline" onClick={addTag}>Add</Btn>
          </div>
          {form.tags.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:6 }}>
              {form.tags.map(t => (
                <span key={t} onClick={() => set('tags', form.tags.filter(x=>x!==t))}
                  style={{ fontSize:11, fontFamily:"'JetBrains Mono',monospace", padding:'2px 8px', borderRadius:4, background:'rgba(107,101,88,.14)', color:C.sub, border:`1px solid rgba(107,101,88,.22)`, cursor:'pointer' }}>
                  #{t} ✕
                </span>
              ))}
            </div>
          )}
        </Field>
      </div>
      <MFoot>
        <Btn variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn>
        <Btn disabled={saving} onClick={() => { if(!form.title.trim()){setErr({title:'Required'});return} onSave(form) }}>
          {saving ? 'Saving…' : task ? 'Save Changes' : '＋ Create Task'}
        </Btn>
      </MFoot>
    </Modal>
  )
}

function DetailModal({ task, onClose, onEdit, onDelete }) {
  const { dispatch, state } = useTasks()
  const live = state.tasks.find(t => t.id === task.id) || task
  const [newSub, setNewSub] = useState('')
  const [newCmt, setNewCmt] = useState('')

  const pCfg=P_CFG[live.priority]||P_CFG.low, sCfg=S_CFG[live.status]||S_CFG.todo
  const catC=CAT_COLOR[live.category]||'#9ca3af'
  const due=dueLabel(live.dueDate)
  const dc=live.subtasks?.filter(s=>s.done).length||0
  const sp=live.subtasks?.length?Math.round(dc/live.subtasks.length*100):null
  const iSt={flex:1,padding:'8px 10px',borderRadius:8,border:`1px solid ${C.border}`,background:C.card,color:C.text,fontSize:12,outline:'none'}

  return (
    <Modal onClose={onClose} width={620}>
      <MHead onClose={onClose}>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
          <Badge label={pCfg.label} color={pCfg.color} bg={pCfg.bg} dot />
          <Badge label={sCfg.label} color={sCfg.color} bg={sCfg.bg} />
          <Badge label={live.category} color={catC} bg={`${catC}18`} />
        </div>
        <h2 style={{ fontWeight:800, fontSize:20, lineHeight:1.25, margin:0 }}>{live.title}</h2>
        {live.description && <p style={{ fontSize:13, color:C.sub, lineHeight:1.6, marginTop:6 }}>{live.description}</p>}
        <div style={{ display:'flex', gap:14, marginTop:8, fontSize:12, color:C.sub, flexWrap:'wrap' }}>
          {live.assignee && <span>👤 {live.assignee}</span>}
          {due && <span style={{ color:due.color }}>⏰ {due.text}</span>}
          <span>🕐 {timeAgo(live.updatedAt)}</span>
          {live.tags?.length>0 && <span>🏷 {live.tags.map(t=>`#${t}`).join(' ')}</span>}
        </div>
        <div style={{ display:'flex', gap:8, marginTop:12 }}>
          <Btn size="sm" variant="outline" onClick={() => onEdit(live)}>✏️ Edit</Btn>
          <Btn size="sm" variant="danger"  onClick={() => onDelete(live)}>🗑 Delete</Btn>
        </div>
      </MHead>
      <div style={{ padding:'16px 20px 20px', display:'flex', flexDirection:'column', gap:20 }}>
        {/* Subtasks */}
        <div>
          <h4 style={{ fontWeight:700, fontSize:14, marginBottom:10 }}>Subtasks {live.subtasks?.length ? `(${dc}/${live.subtasks.length})` : ''}</h4>
          {sp!==null && <ProgressBar value={sp} color={sp===100?'#10b981':C.accent} height={5} style={{marginBottom:10}}/>}
          <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:10 }}>
            {live.subtasks?.map(s => (
              <div key={s.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', borderRadius:8, background:'rgba(255,255,255,.025)' }}>
                <button onClick={()=>dispatch({type:'TOG_SUB',tid:live.id,sid:s.id})} style={{width:16,height:16,borderRadius:4,border:`1px solid ${s.done?'#10b981':'rgba(255,255,255,.2)'}`,background:s.done?'#10b981':'transparent',cursor:'pointer',color:'#0a0908',fontSize:10,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{s.done?'✓':''}</button>
                <span style={{flex:1,fontSize:13,color:s.done?C.sub:C.text,textDecoration:s.done?'line-through':'none'}}>{s.text}</span>
                <button onClick={()=>dispatch({type:'DEL_SUB',tid:live.id,sid:s.id})} style={{background:'none',border:'none',cursor:'pointer',color:C.sub,fontSize:12}}>✕</button>
              </div>
            ))}
            {!live.subtasks?.length && <p style={{ fontSize:12, color:C.sub, fontStyle:'italic' }}>No subtasks yet</p>}
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <input value={newSub} onChange={e=>setNewSub(e.target.value)} onKeyDown={e=>e.key==='Enter'&&newSub.trim()&&(dispatch({type:'ADD_SUB',tid:live.id,sub:{id:uid(),text:newSub.trim(),done:false}}),setNewSub(''))} placeholder="Add subtask…" style={iSt}/>
            <Btn size="sm" onClick={()=>newSub.trim()&&(dispatch({type:'ADD_SUB',tid:live.id,sub:{id:uid(),text:newSub.trim(),done:false}}),setNewSub(''))}>Add</Btn>
          </div>
        </div>
        {/* Comments */}
        <div>
          <h4 style={{ fontWeight:700, fontSize:14, marginBottom:10 }}>Comments {live.comments?.length ? `(${live.comments.length})` : ''}</h4>
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:10 }}>
            {live.comments?.map(c => (
              <div key={c.id} style={{ padding:'8px 12px', borderRadius:8, background:'rgba(255,255,255,.025)', border:`1px solid ${C.border}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}><Avatar name={c.author} size={20}/><span style={{ fontSize:11, fontWeight:700 }}>{c.author}</span></div>
                  <span style={{ fontSize:10, color:C.sub }}>{timeAgo(c.time)}</span>
                </div>
                <p style={{ fontSize:12, color:C.sub, lineHeight:1.5, margin:0 }}>{c.text}</p>
              </div>
            ))}
            {!live.comments?.length && <p style={{ fontSize:12, color:C.sub, fontStyle:'italic' }}>No comments yet</p>}
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <input value={newCmt} onChange={e=>setNewCmt(e.target.value)} onKeyDown={e=>e.key==='Enter'&&newCmt.trim()&&(dispatch({type:'ADD_CMT',tid:live.id,cmt:{id:uid(),text:newCmt.trim(),author:'You',time:new Date().toISOString()}}),setNewCmt(''))} placeholder="Write a comment…" style={iSt}/>
            <Btn size="sm" onClick={()=>newCmt.trim()&&(dispatch({type:'ADD_CMT',tid:live.id,cmt:{id:uid(),text:newCmt.trim(),author:'You',time:new Date().toISOString()}}),setNewCmt(''))}>Post</Btn>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function ConfirmModal({ count, onConfirm, onClose, loading }) {
  return (
    <Modal onClose={onClose} width={420}>
      <div style={{ padding:24 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
          <div style={{ width:44, height:44, borderRadius:12, background:'rgba(244,63,94,.12)', border:'1px solid rgba(244,63,94,.22)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>⚠️</div>
          <div>
            <h3 style={{ fontWeight:800, fontSize:16, margin:0 }}>Delete {count>1?`${count} tasks`:'task'}</h3>
            <p style={{ fontSize:12, color:C.sub, marginTop:2 }}>This cannot be undone</p>
          </div>
        </div>
        <p style={{ fontSize:13, color:C.sub, marginBottom:20 }}>{count>1?`Permanently delete these ${count} tasks?`:'Permanently delete this task?'}</p>
        <div style={{ display:'flex', gap:10 }}>
          <Btn variant="outline" style={{ flex:1 }} onClick={onClose} disabled={loading}>Cancel</Btn>
          <Btn variant="danger"  style={{ flex:1 }} onClick={onConfirm} disabled={loading}>{loading?'Deleting…':`Delete ${count>1?count:''}`}</Btn>
        </div>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────
function Dashboard() {
  const { state, addTask, updateTask, deleteTask, bulkDelete } = useTasks()
  const [modal,    setModal]    = useState(null)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toastMsg, setToastMsg] = useState({ msg:null, type:'success' })

  const toast = useCallback((msg, type='success') => {
    setToastMsg({ msg, type })
    setTimeout(() => setToastMsg({ msg:null, type:'success' }), 3000)
  }, [])

  const close = () => setModal(null)

  const handleSave = async (data) => {
    setSaving(true)
    await new Promise(r => setTimeout(r, 250))
    if (modal?.task) { updateTask(modal.task.id, data); toast('Task updated ✓') }
    else             { addTask(data);                   toast('Task created ✓') }
    setSaving(false); close()
  }

  const handleDelete = async (task) => {
    setDeleting(true)
    await new Promise(r => setTimeout(r, 200))
    deleteTask(task.id); toast('Task deleted', 'info')
    setDeleting(false); close()
  }

  const handleBulk = async () => {
    const n = state.selected.size
    setDeleting(true)
    await new Promise(r => setTimeout(r, 200))
    bulkDelete(); toast(`${n} tasks deleted`, 'info')
    setDeleting(false); close()
  }

  const vp = { onDetail:(t)=>setModal({type:'detail',task:t}), onEdit:(t)=>setModal({type:'form',task:t}), onDelete:(t)=>setModal({type:'delete',task:t}) }

  return (
    <div style={{ minHeight:'100vh', background:C.bg, color:C.text }}>
      <Header onNew={() => setModal({ type:'form' })} />

      <main style={{ maxWidth:1400, margin:'0 auto', padding:'28px 20px', display:'flex', flexDirection:'column', gap:22 }}>
        <div>
          <h1 style={{ fontWeight:800, fontSize:28, letterSpacing:'-.5px', margin:0 }}>Task Dashboard</h1>
          <p style={{ fontSize:13, color:C.sub, marginTop:4 }}>Manage and track all your work in one place</p>
        </div>
        <StatsBar />
        <Toolbar onBulkDel={() => setModal({ type:'bulk-delete' })} />
        {state.view==='board'     && <BoardView     {...vp} />}
        {state.view==='list'      && <ListView      {...vp} />}
        {state.view==='calendar'  && <CalendarView  onDetail={vp.onDetail} />}
        {state.view==='analytics' && <AnalyticsView />}
      </main>

      {modal?.type==='form'   && <FormModal   task={modal.task} onSave={handleSave} onClose={close} saving={saving} />}
      {modal?.type==='detail' && <DetailModal task={modal.task} onClose={close} onEdit={t=>{close();setTimeout(()=>setModal({type:'form',task:t}),60)}} onDelete={t=>{close();setTimeout(()=>setModal({type:'delete',task:t}),60)}} />}
      {(modal?.type==='delete'||modal?.type==='bulk-delete') && (
        <ConfirmModal count={modal.type==='bulk-delete'?state.selected.size:1} onConfirm={modal.type==='bulk-delete'?handleBulk:()=>handleDelete(modal.task)} onClose={close} loading={deleting} />
      )}
      <Toast msg={toastMsg.msg} type={toastMsg.type} />
    </div>
  )
}

// ─────────────────────────────────────────────
// ROOT APP EXPORT
// ─────────────────────────────────────────────
export default function App() {
  return (
    <Provider>
      <Dashboard />
    </Provider>
  )
}
