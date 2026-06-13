'use client';

import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'ldkt_mobile_mvp_v1';
const todayISO = () => new Date().toISOString().slice(0, 10);
const makeCode = (n) => `LDKT${String(n).padStart(3, '0')}`;
const initialState = {
  users: [
    { id: 'u001', code: 'LDKT001', name: 'Anh Tuấn', email: 'tuan@example.com', phone: '0900000001', team: 'Marketing', role: 'learner', active: true, createdAt: '2026-06-01' },
    { id: 'u002', code: 'LDKT002', name: 'Bích Phương', email: 'phuong@example.com', phone: '0900000002', team: 'Sales', role: 'learner', active: true, createdAt: '2026-06-01' },
    { id: 'u003', code: 'LDKT003', name: 'Minh Khoa', email: 'khoa@example.com', phone: '0900000003', team: 'Marketing', role: 'learner', active: true, createdAt: '2026-06-01' },
    { id: 'trainer', code: 'GV001', name: 'Giảng viên Demo', email: 'trainer@senpharma.vn', phone: '0900000099', team: 'Trainer', role: 'trainer', active: true, createdAt: '2026-06-01' }
  ],
  checkins: [
    { id: 'c1', userId: 'u001', date: todayISO(), status: 'done', mood: 'Bình an', journal: 'Hôm nay thực hành lắng nghe không phán xét.', lesson: 'Chậm lại trước khi phản ứng.', xp: 15, createdAt: new Date().toISOString() },
    { id: 'c2', userId: 'u002', date: todayISO(), status: 'done', mood: 'Năng lượng', journal: 'Tôi đã chủ động hỏi đồng đội cần hỗ trợ gì.', lesson: 'Lãnh đạo bắt đầu từ quan sát.', xp: 15, createdAt: new Date().toISOString() }
  ]
};

function loadState() {
  if (typeof window === 'undefined') return initialState;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : initialState;
  } catch {
    return initialState;
  }
}

function calcStats(user, checkins) {
  const mine = checkins.filter(c => c.userId === user.id && c.status === 'done').sort((a,b) => b.date.localeCompare(a.date));
  const doneDays = new Set(mine.map(c => c.date));
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 21; i++) {
    const key = d.toISOString().slice(0,10);
    if (doneDays.has(key)) streak += 1;
    else break;
    d.setDate(d.getDate() - 1);
  }
  const xp = mine.reduce((s,c) => s + (c.xp || 10), 0);
  const badges = [];
  if (streak >= 3) badges.push('Mầm Sen');
  if (streak >= 7) badges.push('Bền Bỉ');
  if (streak >= 14) badges.push('Khai Tâm');
  if (mine.length >= 21) badges.push('Lãnh Đạo Tỉnh Thức');
  return { done: mine.length, streak, xp, badges, todayDone: doneDays.has(todayISO()) };
}

function csv(rows) {
  return rows.map(r => r.map(v => `"${String(v ?? '').replaceAll('"','""')}"`).join(',')).join('\n');
}

export default function Home() {
  const [data, setData] = useState(initialState);
  const [screen, setScreen] = useState('login');
  const [currentUserId, setCurrentUserId] = useState(null);
  const [login, setLogin] = useState({ identity: '', code: '' });
  const [reg, setReg] = useState({ name: '', email: '', phone: '', team: 'Marketing' });
  const [checkin, setCheckin] = useState({ status: 'done', mood: 'Bình an', journal: '', lesson: '' });
  const [toast, setToast] = useState('');

  useEffect(() => {
    const s = loadState();
    setData(s);
    const savedUser = localStorage.getItem('ldkt_current_user');
    if (savedUser && s.users.find(u => u.id === savedUser)) {
      setCurrentUserId(savedUser);
      setScreen('home');
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const user = data.users.find(u => u.id === currentUserId);
  const learners = data.users.filter(u => u.role === 'learner');
  const stats = user ? calcStats(user, data.checkins) : null;
  const leaderboard = useMemo(() => learners.map(u => ({ ...u, stats: calcStats(u, data.checkins) })).sort((a,b) => b.stats.xp - a.stats.xp), [data]);

  function show(msg) { setToast(msg); setTimeout(() => setToast(''), 2500); }

  function doLogin(e) {
    e.preventDefault();
    const id = login.identity.trim().toLowerCase();
    const code = login.code.trim().toUpperCase();
    const found = data.users.find(u => u.active && (u.email.toLowerCase() === id || u.phone === id) && u.code.toUpperCase() === code);
    if (!found) return show('Không tìm thấy tài khoản hoặc mã học viên chưa đúng.');
    setCurrentUserId(found.id);
    localStorage.setItem('ldkt_current_user', found.id);
    setScreen(found.role === 'trainer' ? 'trainer' : 'home');
    show(`Chào mừng ${found.name}!`);
  }

  function doRegister(e) {
    e.preventDefault();
    if (!reg.name || !reg.email || !reg.phone) return show('Vui lòng nhập đủ họ tên, email và số điện thoại.');
    const exists = data.users.some(u => u.email.toLowerCase() === reg.email.toLowerCase() || u.phone === reg.phone);
    if (exists) return show('Email hoặc số điện thoại đã được đăng ký.');
    const code = makeCode(data.users.filter(u => u.role === 'learner').length + 1);
    const newUser = { id: `u${Date.now()}`, code, ...reg, role: 'learner', active: true, createdAt: todayISO() };
    setData(d => ({ ...d, users: [...d.users, newUser] }));
    setCurrentUserId(newUser.id);
    localStorage.setItem('ldkt_current_user', newUser.id);
    setScreen('home');
    show(`Đăng ký thành công. Mã của bạn: ${code}`);
  }

  function submitCheckin(e) {
    e.preventDefault();
    if (!user) return;
    const existed = data.checkins.some(c => c.userId === user.id && c.date === todayISO());
    if (existed) return show('Hôm nay bạn đã check-in rồi.');
    const xp = checkin.status === 'done' ? 10 + (checkin.journal.trim() ? 5 : 0) : 0;
    const item = { id: `c${Date.now()}`, userId: user.id, date: todayISO(), ...checkin, xp, createdAt: new Date().toISOString() };
    setData(d => ({ ...d, checkins: [...d.checkins, item] }));
    setCheckin({ status: 'done', mood: 'Bình an', journal: '', lesson: '' });
    setScreen('home');
    show(xp ? `Check-in thành công! +${xp} XP` : 'Đã ghi nhận. Ngày mai mình bắt đầu lại nhé.');
  }

  function logout() {
    localStorage.removeItem('ldkt_current_user');
    setCurrentUserId(null);
    setScreen('login');
  }

  function resetDemo() {
    if (!confirm('Reset toàn bộ dữ liệu demo trên trình duyệt này?')) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('ldkt_current_user');
    setData(initialState);
    setCurrentUserId(null);
    setScreen('login');
  }

  function exportCheckins() {
    const rows = [['Date','Name','Email','Team','Status','Mood','Journal','Lesson','XP'], ...data.checkins.map(c => {
      const u = data.users.find(x => x.id === c.userId) || {};
      return [c.date, u.name, u.email, u.team, c.status, c.mood, c.journal, c.lesson, c.xp];
    })];
    const blob = new Blob([csv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `ldkt-checkins-${todayISO()}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  return <main className="phone-shell">
    <header className="topbar">
      <div><b>Lãnh Đạo Khai Tâm</b><span>21 ngày</span></div>
      {user && <button className="ghost" onClick={logout}>Thoát</button>}
    </header>

    {screen === 'login' && <section className="auth-card">
      <div className="hero"><div className="lotus">✦</div><h1>Thử thách 21 ngày</h1><p>Check-in mỗi ngày, giữ streak, tích XP và nuôi dưỡng lãnh đạo tỉnh thức.</p></div>
      <form onSubmit={doLogin} className="form">
        <h2>Đăng nhập</h2>
        <input placeholder="Email hoặc số điện thoại" value={login.identity} onChange={e=>setLogin({...login, identity:e.target.value})}/>
        <input placeholder="Mã học viên, ví dụ LDKT001" value={login.code} onChange={e=>setLogin({...login, code:e.target.value})}/>
        <button className="primary">Vào app</button>
      </form>
      <button className="link" onClick={()=>setScreen('register')}>Chưa có mã? Đăng ký học viên</button>
      <div className="demo-note">Demo nhanh: tuan@example.com / LDKT001 hoặc trainer@senpharma.vn / GV001</div>
    </section>}

    {screen === 'register' && <section className="auth-card">
      <form onSubmit={doRegister} className="form">
        <h2>Đăng ký học viên</h2>
        <input placeholder="Họ và tên" value={reg.name} onChange={e=>setReg({...reg, name:e.target.value})}/>
        <input placeholder="Email" value={reg.email} onChange={e=>setReg({...reg, email:e.target.value})}/>
        <input placeholder="Số điện thoại" value={reg.phone} onChange={e=>setReg({...reg, phone:e.target.value})}/>
        <select value={reg.team} onChange={e=>setReg({...reg, team:e.target.value})}><option>Marketing</option><option>Sales</option><option>Operations</option><option>RD</option><option>QA/QC</option></select>
        <button className="primary">Tạo mã học viên</button>
      </form>
      <button className="link" onClick={()=>setScreen('login')}>Quay lại đăng nhập</button>
    </section>}

    {screen === 'home' && user && stats && <section className="page">
      <div className="hello"><div><p>Xin chào,</p><h1>{user.name}</h1></div><div className="avatar">{user.name.split(' ').map(x=>x[0]).slice(-2).join('')}</div></div>
      <div className="challenge-card"><span>Ngày thử thách</span><h2>Mở rộng tầm lượng, buông dần tự ngã</h2><div className="progress"><i style={{width:`${Math.min(100, stats.done/21*100)}%`}} /></div><small>{stats.done}/21 ngày hoàn thành</small></div>
      <div className="stats-grid"><div><b>{stats.streak}🔥</b><span>Streak</span></div><div><b>{stats.xp}</b><span>XP</span></div><div><b>{stats.badges.length}</b><span>Huy hiệu</span></div></div>
      <button className="checkin-big" onClick={()=>setScreen('checkin')} disabled={stats.todayDone}>{stats.todayDone ? '✅ Đã check-in hôm nay' : 'Check-in hôm nay →'}</button>
      <Card title="Huy hiệu của bạn">{stats.badges.length ? <div className="badges">{stats.badges.map(b=><span key={b}>🏅 {b}</span>)}</div> : <p className="muted">Giữ streak 3 ngày để nhận huy hiệu đầu tiên.</p>}</Card>
      <Card title="Bảng xếp hạng"><Ranking rows={leaderboard.slice(0,5)} /></Card>
      <nav className="bottom-nav"><button onClick={()=>setScreen('home')}>🏠<span>Home</span></button><button onClick={()=>setScreen('checkin')}>✅<span>Check-in</span></button><button onClick={()=>setScreen('leaderboard')}>🏆<span>Top</span></button></nav>
    </section>}

    {screen === 'checkin' && user && <section className="page">
      <h1 className="title">Check-in hôm nay</h1><p className="sub">{todayISO()}</p>
      <form className="form card" onSubmit={submitCheckin}>
        <label>Hôm nay bạn đã hoàn thành thử thách chưa?</label>
        <div className="toggle"><button type="button" className={checkin.status==='done'?'active':''} onClick={()=>setCheckin({...checkin,status:'done'})}>✅ Hoàn thành</button><button type="button" className={checkin.status==='miss'?'active danger':''} onClick={()=>setCheckin({...checkin,status:'miss'})}>❌ Chưa làm</button></div>
        <label>Cảm xúc hôm nay</label><select value={checkin.mood} onChange={e=>setCheckin({...checkin,mood:e.target.value})}><option>Bình an</option><option>Năng lượng</option><option>Biết ơn</option><option>Khó khăn</option><option>Mệt mỏi</option></select>
        <label>Nhật ký ngắn</label><textarea placeholder="Hôm nay bạn thực hành điều gì?" value={checkin.journal} onChange={e=>setCheckin({...checkin,journal:e.target.value})}/>
        <label>Bài học rút ra</label><textarea placeholder="Một điều bạn nhận ra..." value={checkin.lesson} onChange={e=>setCheckin({...checkin,lesson:e.target.value})}/>
        <button className="primary">Gửi check-in</button><button type="button" className="link" onClick={()=>setScreen('home')}>Quay lại</button>
      </form>
    </section>}

    {screen === 'leaderboard' && <section className="page"><h1 className="title">Leaderboard</h1><Card title="Top học viên"><Ranking rows={leaderboard} /></Card><button className="primary" onClick={()=>setScreen('home')}>Về trang chủ</button></section>}

    {screen === 'trainer' && user && <section className="page">
      <div className="hello"><div><p>Dashboard</p><h1>Giảng viên</h1></div><button className="ghost" onClick={exportCheckins}>Xuất CSV</button></div>
      <div className="stats-grid"><div><b>{data.checkins.filter(c=>c.date===todayISO()).length}</b><span>Check-in hôm nay</span></div><div><b>{learners.length}</b><span>Học viên</span></div><div><b>{Math.round(data.checkins.filter(c=>c.date===todayISO()).length/Math.max(1,learners.length)*100)}%</b><span>Tỷ lệ</span></div></div>
      <Card title="Cần nhắc hôm nay"><div className="list">{learners.filter(l=>!data.checkins.some(c=>c.userId===l.id && c.date===todayISO())).map(l=><div key={l.id} className="list-row"><b>{l.name}</b><span>{l.team}</span></div>)}</div></Card>
      <Card title="Leaderboard"><Ranking rows={leaderboard} /></Card>
      <Card title="Quản trị demo"><button className="secondary" onClick={resetDemo}>Reset dữ liệu demo</button></Card>
    </section>}

    {toast && <div className="toast">{toast}</div>}
  </main>;
}

function Card({ title, children }) { return <div className="card"><h3>{title}</h3>{children}</div>; }
function Ranking({ rows }) { return <div className="ranking">{rows.map((r,i)=><div key={r.id} className="rank-row"><span className="rank">#{i+1}</span><div><b>{r.name}</b><small>{r.team}</small></div><strong>{r.stats.xp} XP</strong></div>)}</div>; }
