'use client';

import { useEffect, useMemo, useState } from 'react';

const SHEET_API_URL = '/api/sheet';
const CURRENT_USER_KEY = 'ldkt_current_user_v03';

const todayISO = () => new Date().toISOString().slice(0, 10);

const emptyState = {
  users: [],
  checkins: [],
  challenges: []
};

function norm(v) {
  return String(v ?? '').trim();
}

function normLower(v) {
  return norm(v).toLowerCase();
}

function normPhone(v) {
  // Google Sheet đôi khi làm mất số 0 đầu. Chuẩn hóa để 0909123456 và 909123456 vẫn khớp.
  return norm(v).replace(/\D/g, '').replace(/^84/, '0').replace(/^0+/, '');
}

function getField(row, keys, fallback = '') {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') return row[key];
  }
  return fallback;
}

function normalizeUser(row) {
  const id = norm(getField(row, ['id', 'ID', 'Id', 'code', 'Code']));
  const email = normLower(getField(row, ['email', 'Email']));
  const role = normLower(getField(row, ['role', 'Role'], 'learner')) || 'learner';
  const status = normLower(getField(row, ['status', 'Status'], 'active')) || 'active';
  const phone = norm(getField(row, ['phone', 'Phone']));

  return {
    id,
    code: id,
    name: norm(getField(row, ['name', 'Name'])),
    email,
    phone,
    phoneKey: normPhone(phone),
    team: norm(getField(row, ['team', 'Team'])),
    role,
    active: ['active', 'true', 'yes', '1'].includes(status),
    createdAt: norm(getField(row, ['joinDate', 'JoinDate', 'createdAt', 'CreatedAt'])),
    currentXP: Number(getField(row, ['currentXP', 'CurrentXP', 'XP', 'xp'], 0)) || 0,
    currentStreak: Number(getField(row, ['currentStreak', 'CurrentStreak', 'Streak', 'streak'], 0)) || 0,
    avatar: norm(getField(row, ['avatar', 'Avatar']))
  };
}

function normalizeCheckin(row) {
  const email = normLower(getField(row, ['email', 'Email']));
  const completedRaw = normLower(getField(row, ['completed', 'Completed', 'status', 'Status']));
  const status = ['true', 'yes', 'done', 'hoàn thành', 'completed', '1'].includes(completedRaw) ? 'done' : 'miss';
  const rawDate = getField(row, ['date', 'Date']);
  const date = rawDate ? String(rawDate).slice(0, 10) : '';

  return {
    id: norm(getField(row, ['id', 'ID'], `${email}-${date}-${Math.random()}`)),
    email,
    name: norm(getField(row, ['name', 'Name'])),
    team: norm(getField(row, ['team', 'Team'])),
    date,
    day: norm(getField(row, ['day', 'Day'])),
    status,
    mood: norm(getField(row, ['mood', 'Mood', 'CamXuc'])),
    journal: norm(getField(row, ['journal', 'Journal', 'NhatKy'])),
    lesson: norm(getField(row, ['lesson', 'Lesson', 'BaiHoc'])),
    challenge: norm(getField(row, ['challenge', 'Challenge', 'ThuThach'])),
    xp: Number(getField(row, ['xp', 'XP'], 0)) || 0,
    createdAt: norm(getField(row, ['timestamp', 'Timestamp', 'createdAt', 'CreatedAt']))
  };
}

function calcStats(user, checkins) {
  const mine = checkins
    .filter(c => c.email === user.email && c.status === 'done')
    .sort((a, b) => b.date.localeCompare(a.date));

  const doneDays = new Set(mine.map(c => c.date));
  let streak = 0;
  const d = new Date();

  for (let i = 0; i < 21; i++) {
    const key = d.toISOString().slice(0, 10);
    if (doneDays.has(key)) streak += 1;
    else break;
    d.setDate(d.getDate() - 1);
  }

  const xpFromCheckins = mine.reduce((s, c) => s + (Number(c.xp) || 0), 0);
  const xp = Math.max(Number(user.currentXP) || 0, xpFromCheckins);

  const badges = [];
  if (streak >= 3) badges.push('Mầm Sen');
  if (streak >= 7) badges.push('Bền Bỉ');
  if (streak >= 14) badges.push('Khai Tâm');
  if (mine.length >= 21) badges.push('Lãnh Đạo Tỉnh Thức');

  return {
    done: mine.length,
    streak: Math.max(streak, Number(user.currentStreak) || 0),
    xp,
    badges,
    todayDone: doneDays.has(todayISO())
  };
}

function csv(rows) {
  return rows.map(r => r.map(v => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
}

async function apiGet() {
  const res = await fetch(SHEET_API_URL, { method: 'GET', cache: 'no-store' });
  const text = await res.text();

  if (text.trim().startsWith('<')) {
    throw new Error('API trả về HTML thay vì JSON. Kiểm tra route /api/sheet hoặc Apps Script public.');
  }

  const json = JSON.parse(text);
  if (!json.ok) throw new Error(json.error || 'Không đọc được Google Sheet.');

  return {
    users: (json.users || []).map(normalizeUser).filter(u => u.id && (u.email || u.phone)),
    checkins: (json.checkins || []).map(normalizeCheckin).filter(c => c.email && c.date),
    challenges: json.challenges || []
  };
}

async function apiPost(payload) {
  const res = await fetch(SHEET_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });

  const text = await res.text();

  if (text.trim().startsWith('<')) {
    throw new Error('API trả về HTML thay vì JSON. Kiểm tra route /api/sheet hoặc Apps Script public.');
  }

  const json = JSON.parse(text);
  if (!json.ok) throw new Error(json.error || 'Không ghi được Google Sheet.');
  return json;
}

export default function Home() {
  const [data, setData] = useState(emptyState);
  const [screen, setScreen] = useState('login');
  const [currentUserId, setCurrentUserId] = useState(null);
  const [login, setLogin] = useState({ identity: '', code: '' });
  const [reg, setReg] = useState({ name: '', email: '', phone: '', team: 'Marketing' });
  const [registeredUser, setRegisteredUser] = useState(null);
  const [checkin, setCheckin] = useState({ status: 'done', mood: 'Bình an', journal: '', lesson: '' });
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);

  function show(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }

  async function reload(restoreLogin = true) {
    setLoading(true);
    try {
      const s = await apiGet();
      setData(s);

      if (restoreLogin && typeof window !== 'undefined') {
        const savedUser = localStorage.getItem(CURRENT_USER_KEY);
        const found = s.users.find(u => u.id === savedUser && u.active);
        if (found) {
          setCurrentUserId(found.id);
          setScreen(found.role === 'trainer' ? 'trainer' : 'home');
        }
      }
    } catch (err) {
      show(`Lỗi kết nối Sheet: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload(true);
  }, []);

  const user = data.users.find(u => u.id === currentUserId);
  const learners = data.users.filter(u => u.role === 'learner' && u.active);
  const stats = user ? calcStats(user, data.checkins) : null;
  const leaderboard = useMemo(
    () => learners.map(u => ({ ...u, stats: calcStats(u, data.checkins) })).sort((a, b) => b.stats.xp - a.stats.xp),
    [data]
  );

  async function doLogin(e) {
    e.preventDefault();
    const identity = login.identity.trim();
    const identityLower = identity.toLowerCase();
    const identityPhone = normPhone(identity);
    const code = login.code.trim().toUpperCase();

    const found = data.users.find(u =>
      u.active &&
      String(u.code || '').toUpperCase() === code &&
      (
        u.email === identityLower ||
        u.phoneKey === identityPhone
      )
    );

    if (!found) return show('Không tìm thấy tài khoản hoặc mã học viên chưa đúng.');

    setCurrentUserId(found.id);
    localStorage.setItem(CURRENT_USER_KEY, found.id);
    setScreen(found.role === 'trainer' ? 'trainer' : 'home');
    show(`Chào mừng ${found.name}!`);
  }

  async function doRegister(e) {
    e.preventDefault();
    if (!reg.name || !reg.email || !reg.phone) return show('Vui lòng nhập đủ họ tên, email và số điện thoại.');

    try {
      setLoading(true);
      const result = await apiPost({ action: 'register', user: reg });
      const newUser = normalizeUser(result.user);

      await reload(false);
      setRegisteredUser(newUser);
      setCurrentUserId(newUser.id);
      localStorage.setItem(CURRENT_USER_KEY, newUser.id);
      setScreen('register-success');
      setReg({ name: '', email: '', phone: '', team: 'Marketing' });
    } catch (err) {
      show(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitCheckin(e) {
    e.preventDefault();
    if (!user || !stats) return;

    const existed = data.checkins.some(c => c.email === user.email && c.date === todayISO());
    if (existed || stats.todayDone) {
      setScreen('home');
      return show('Bạn đã check-in hôm nay rồi. Hãy quay lại vào ngày mai nhé.');
    }

    const xp = checkin.status === 'done' ? 10 + (checkin.journal.trim() ? 5 : 0) : 0;

    try {
      setLoading(true);
      await apiPost({
        action: 'checkin',
        checkin: {
          email: user.email,
          name: user.name,
          team: user.team,
          date: todayISO(),
          day: stats.done + 1,
          completed: checkin.status === 'done' ? 'done' : 'miss',
          journal: checkin.journal,
          lesson: checkin.lesson,
          mood: checkin.mood,
          challenge: 'Thử thách 21 ngày',
          xp
        }
      });

      const s = await apiGet();
      setData(s);
      setCheckin({ status: 'done', mood: 'Bình an', journal: '', lesson: '' });
      setScreen('home');
      show(xp ? `Check-in thành công! +${xp} XP` : 'Đã ghi nhận. Ngày mai mình bắt đầu lại nhé.');
    } catch (err) {
      show(err.message);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem(CURRENT_USER_KEY);
    setCurrentUserId(null);
    setRegisteredUser(null);
    setScreen('login');
  }

  function copyCode() {
    const code = registeredUser?.code || registeredUser?.id || '';
    if (!code) return;
    navigator.clipboard?.writeText(code);
    show('Đã sao chép mã học viên.');
  }

  function exportCheckins() {
    const rows = [['Date', 'Name', 'Email', 'Team', 'Status', 'Mood', 'Journal', 'Lesson', 'XP'], ...data.checkins.map(c => {
      const u = data.users.find(x => x.email === c.email) || {};
      return [c.date, u.name || c.name, c.email, u.team || c.team, c.status, c.mood, c.journal, c.lesson, c.xp];
    })];
    const blob = new Blob([csv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ldkt-checkins-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return <main className="phone-shell">
    <header className="topbar">
      <div><b>Lãnh Đạo Khai Tâm</b><span>21 ngày</span></div>
      {user && <button className="ghost" onClick={logout}>Thoát</button>}
    </header>

    {loading && <div className="toast">Đang đồng bộ Google Sheet...</div>}

    {screen === 'login' && <section className="auth-card">
      <div className="hero"><div className="lotus">✦</div><h1>Thử thách 21 ngày</h1><p>Check-in mỗi ngày, giữ streak, tích XP và nuôi dưỡng lãnh đạo tỉnh thức.</p></div>
      <form onSubmit={doLogin} className="form">
        <h2>Đăng nhập</h2>
        <input placeholder="Email hoặc số điện thoại" value={login.identity} onChange={e => setLogin({ ...login, identity: e.target.value })} />
        <input placeholder="Mã học viên, ví dụ LDKT001" value={login.code} onChange={e => setLogin({ ...login, code: e.target.value })} />
        <button className="primary" disabled={loading}>Vào app</button>
      </form>
      <button className="link" onClick={() => setScreen('register')}>Chưa có mã? Đăng ký học viên</button>
      <div className="demo-note">Bạn có thể đăng nhập bằng email hoặc số điện thoại + mã học viên.</div>
    </section>}

    {screen === 'register' && <section className="auth-card">
      <form onSubmit={doRegister} className="form">
        <h2>Đăng ký học viên</h2>
        <input placeholder="Họ và tên" value={reg.name} onChange={e => setReg({ ...reg, name: e.target.value })} />
        <input placeholder="Email" value={reg.email} onChange={e => setReg({ ...reg, email: e.target.value })} />
        <input placeholder="Số điện thoại" value={reg.phone} onChange={e => setReg({ ...reg, phone: e.target.value })} />
        <select value={reg.team} onChange={e => setReg({ ...reg, team: e.target.value })}><option>Marketing</option><option>Sales</option><option>Operations</option><option>RD</option><option>QA/QC</option></select>
        <button className="primary" disabled={loading}>Tạo mã học viên</button>
      </form>
      <button className="link" onClick={() => setScreen('login')}>Quay lại đăng nhập</button>
    </section>}

    {screen === 'register-success' && registeredUser && <section className="auth-card">
      <div className="hero">
        <div className="lotus">✓</div>
        <h1>Đăng ký thành công</h1>
        <p>Vui lòng lưu lại mã học viên để đăng nhập cho các lần sau.</p>
      </div>
      <div className="card" style={{ textAlign: 'center' }}>
        <h3>Mã học viên của bạn</h3>
        <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: 1, margin: '14px 0' }}>{registeredUser.code}</div>
        <p className="muted">Tên: {registeredUser.name}</p>
        <p className="muted">Email: {registeredUser.email}</p>
        <button className="secondary" onClick={copyCode}>Sao chép mã</button>
      </div>
      <button className="primary" onClick={() => setScreen('home')}>Vào app</button>
    </section>}

    {screen === 'home' && user && stats && <section className="page">
      <div className="hello"><div><p>Xin chào,</p><h1>{user.name}</h1></div><div className="avatar">{user.name.split(' ').map(x => x[0]).slice(-2).join('')}</div></div>
      <div className="challenge-card"><span>Ngày thử thách</span><h2>Mở rộng tầm lượng, buông dần tự ngã</h2><div className="progress"><i style={{ width: `${Math.min(100, stats.done / 21 * 100)}%` }} /></div><small>{stats.done}/21 ngày hoàn thành</small></div>
      <div className="stats-grid"><div><b>{stats.streak}🔥</b><span>Streak</span></div><div><b>{stats.xp}</b><span>XP</span></div><div><b>{stats.badges.length}</b><span>Huy hiệu</span></div></div>
      <button className="checkin-big" onClick={() => setScreen('checkin')} disabled={stats.todayDone}>{stats.todayDone ? '✅ Đã check-in hôm nay' : 'Check-in hôm nay →'}</button>
      <Card title="Huy hiệu của bạn">{stats.badges.length ? <div className="badges">{stats.badges.map(b => <span key={b}>🏅 {b}</span>)}</div> : <p className="muted">Giữ streak 3 ngày để nhận huy hiệu đầu tiên.</p>}</Card>
      <Card title="Bảng xếp hạng"><Ranking rows={leaderboard.slice(0, 5)} /></Card>
      <nav className="bottom-nav"><button onClick={() => setScreen('home')}>🏠<span>Home</span></button><button onClick={() => setScreen('checkin')}>✅<span>Check-in</span></button><button onClick={() => setScreen('leaderboard')}>🏆<span>Top</span></button></nav>
    </section>}

    {screen === 'checkin' && user && stats && <section className="page">
      <h1 className="title">Check-in hôm nay</h1><p className="sub">{todayISO()}</p>
      {stats.todayDone ? <Card title="Bạn đã check-in hôm nay"><p className="muted">Hãy quay lại vào ngày mai để tiếp tục giữ streak nhé.</p><button className="primary" onClick={() => setScreen('home')}>Về trang chủ</button></Card> :
        <form className="form card" onSubmit={submitCheckin}>
          <label>Hôm nay bạn đã hoàn thành thử thách chưa?</label>
          <div className="toggle"><button type="button" className={checkin.status === 'done' ? 'active' : ''} onClick={() => setCheckin({ ...checkin, status: 'done' })}>✅ Hoàn thành</button><button type="button" className={checkin.status === 'miss' ? 'active danger' : ''} onClick={() => setCheckin({ ...checkin, status: 'miss' })}>❌ Chưa làm</button></div>
          <label>Cảm xúc hôm nay</label><select value={checkin.mood} onChange={e => setCheckin({ ...checkin, mood: e.target.value })}><option>Bình an</option><option>Năng lượng</option><option>Biết ơn</option><option>Khó khăn</option><option>Mệt mỏi</option></select>
          <label>Nhật ký ngắn</label><textarea placeholder="Hôm nay bạn thực hành điều gì?" value={checkin.journal} onChange={e => setCheckin({ ...checkin, journal: e.target.value })} />
          <label>Bài học rút ra</label><textarea placeholder="Một điều bạn nhận ra..." value={checkin.lesson} onChange={e => setCheckin({ ...checkin, lesson: e.target.value })} />
          <button className="primary" disabled={loading}>Gửi check-in</button><button type="button" className="link" onClick={() => setScreen('home')}>Quay lại</button>
        </form>}
    </section>}

    {screen === 'leaderboard' && <section className="page"><h1 className="title">Leaderboard</h1><Card title="Top học viên"><Ranking rows={leaderboard} /></Card><button className="primary" onClick={() => setScreen('home')}>Về trang chủ</button></section>}

    {screen === 'trainer' && user && <section className="page">
      <div className="hello"><div><p>Dashboard</p><h1>Giảng viên</h1></div><button className="ghost" onClick={exportCheckins}>Xuất CSV</button></div>
      <div className="stats-grid"><div><b>{data.checkins.filter(c => c.date === todayISO()).length}</b><span>Check-in hôm nay</span></div><div><b>{learners.length}</b><span>Học viên</span></div><div><b>{Math.round(data.checkins.filter(c => c.date === todayISO()).length / Math.max(1, learners.length) * 100)}%</b><span>Tỷ lệ</span></div></div>
      <Card title="Cần nhắc hôm nay"><div className="list">{learners.filter(l => !data.checkins.some(c => c.email === l.email && c.date === todayISO())).map(l => <div key={l.id} className="list-row"><b>{l.name}</b><span>{l.team}</span></div>)}</div></Card>
      <Card title="Leaderboard"><Ranking rows={leaderboard} /></Card>
    </section>}

    {toast && !loading && <div className="toast">{toast}</div>}
  </main>;
}

function Card({ title, children }) { return <div className="card"><h3>{title}</h3>{children}</div>; }
function Ranking({ rows }) { return <div className="ranking">{rows.map((r, i) => <div key={r.id} className="rank-row"><span className="rank">#{i + 1}</span><div><b>{r.name}</b><small>{r.team}</small></div><strong>{r.stats.xp} XP</strong></div>)}</div>; }

