/* ==========================================================================
   Logika Utama Aplikasi - PP. Nurul Chalik Sistem Absensi QR Code
   ========================================================================== */

const LOCAL_STORAGE_KEY = 'pp_nurul_chalik_absensi_v3';
const SESSION_STORAGE_KEY = 'pp_nurul_chalik_active_session_v1';

const DEFAULT_SETTINGS = {
    namaMadrasah: 'PP. Nurul Chalik',
    namaKamad: 'KH. Abdurrahman Chalik',
    nipKamad: '-',
    tahun: '2026/2027',
    semester: 'Ganjil',
    alamat: 'Jl. Pondok Pesantren Nurul Chalik, Indonesia',
    jamMasuk: '07:00',
    batasTerlambat: '07:15',
    jamPulang: '14:00'
};

let appSettings = { ...DEFAULT_SETTINGS };
let currentUser = null;
let activeTabName = 'dashboard';
let scanMode = 'MASUK';
let nativeMediaStream = null;
let scanAnimationFrame = null;
let isScanning = false;
let isStartingScanner = false;
let lastScannedCode = '';
let lastScannedTimestamp = 0;
let attendanceChartInstance = null;
let activeCorrectionDate = '';

let appData = {
    users: [
        { username: 'Admin', password: 'admin321', fullName: 'TU / Administrator', role: 'Admin', kelasBinaan: '' }
    ],
    kelasList: [
        { id: 'KLS-1', tingkat: 'VII', kode: 'A', nama: 'VII A', waliKelas: 'Ust. Ahmad Fauzi, S.Pd.I' },
        { id: 'KLS-2', tingkat: 'VIII', kode: 'A', nama: 'VIII A', waliKelas: 'Ustadzah Siti Aminah, S.Pd' },
        { id: 'KLS-3', tingkat: 'IX', kode: 'A', nama: 'IX A', waliKelas: 'Ust. Muhammad Ridwan, M.Pd' },
        { id: 'KLS-4', tingkat: 'X', kode: 'A', nama: 'X A', waliKelas: 'Ustadzah Nurul Hidayah, S.Pd' },
        { id: 'KLS-5', tingkat: 'XI', kode: 'A', nama: 'XI A', waliKelas: 'Ust. Abdul Aziz, S.Ag' },
        { id: 'KLS-6', tingkat: 'XII', kode: 'A', nama: 'XII A', waliKelas: 'Ustadzah Fatimah Azzahra, M.Pd' }
    ],
    students: [
        { nis: '2026001', nama: 'Ahmad Zaki Al-Fatih', kelas: 'VII A', wa: '081234567890' },
        { nis: '2026002', nama: 'Fatimah Az-Zahra', kelas: 'VII A', wa: '081234567891' },
        { nis: '2026003', nama: 'Muhammad Hasan Al-Banna', kelas: 'VIII A', wa: '081234567892' },
        { nis: '2026004', nama: 'Aisyah Humaira', kelas: 'IX A', wa: '081234567893' }
    ],
    guruList: [
        { npk: '198501012010011001', nama: 'KH. Abdurrahman Chalik', tempat: 'Jombang', tgl: '1975-05-12', mapel: 'Kitab Kuning', jabatan: 'Pengasuh / Kepala Madrasah', hp: '081211112222' },
        { npk: '199003152015031002', nama: 'Ust. Ahmad Fauzi, S.Pd.I', tempat: 'Kediri', tgl: '1990-03-15', mapel: 'Fiqih', jabatan: 'Wali Kelas VII A', hp: '081233334444' }
    ],
    attendance: {}
};

function getTodayKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getCurrentMonthKey() {
    return getTodayKey().slice(0, 7);
}

function getCurrentTimeStr() {
    const now = new Date();
    return now.toTimeString().slice(0, 5);
}

function showToast(title, message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    const colorMap = {
        success: 'bg-emerald-900 border-emerald-500 text-white',
        warning: 'bg-amber-900 border-amber-500 text-white',
        error: 'bg-rose-900 border-rose-500 text-white'
    };
    toast.className = `pointer-events-auto p-4 rounded-2xl border-l-4 shadow-xl transition-all duration-300 ${colorMap[type] || colorMap.success}`;
    toast.innerHTML = `<p class="font-bold text-xs">${title}</p><p class="text-xs opacity-90 mt-0.5">${message}</p>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-x-4');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function saveAllState() {
    try {
        const payload = {
            settings: appSettings,
            users: appData.users,
            kelasList: appData.kelasList,
            students: appData.students,
            guruList: appData.guruList,
            attendance: appData.attendance,
            updatedAt: Date.now()
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
        if (typeof window.pushStateToFirestore === 'function') {
            window.pushStateToFirestore(payload);
        }
    } catch (e) {
        console.warn('Gagal menyimpan state:', e);
    }
}

function loadLocalState() {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed.settings) appSettings = { ...DEFAULT_SETTINGS, ...parsed.settings };
        if (Array.isArray(parsed.users) && parsed.users.length > 0) appData.users = parsed.users;
        if (Array.isArray(parsed.kelasList)) appData.kelasList = parsed.kelasList;
        if (Array.isArray(parsed.students)) appData.students = parsed.students;
        if (Array.isArray(parsed.guruList)) appData.guruList = parsed.guruList;
        if (parsed.attendance && typeof parsed.attendance === 'object') appData.attendance = parsed.attendance;
    } catch (e) {
        console.warn('Gagal membaca localStorage:', e);
    }
}

window.applyCloudState = function(remote) {
    if (!remote) return;
    if (remote.settings) appSettings = { ...DEFAULT_SETTINGS, ...remote.settings };
    if (Array.isArray(remote.users) && remote.users.length > 0) appData.users = remote.users;
    if (Array.isArray(remote.kelasList)) appData.kelasList = remote.kelasList;
    if (Array.isArray(remote.students)) appData.students = remote.students;
    if (Array.isArray(remote.guruList)) appData.guruList = remote.guruList;
    if (remote.attendance && typeof remote.attendance === 'object') appData.attendance = remote.attendance;

    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
            settings: appSettings,
            users: appData.users,
            kelasList: appData.kelasList,
            students: appData.students,
            guruList: appData.guruList,
            attendance: appData.attendance
        }));
    } catch (e) {}

    applyBrandingUI();
    if (currentUser) refreshAllViews();
};

function saveActiveSession(user, tab = activeTabName) {
    try {
        const sessionObj = { user, tab };
        const serialized = JSON.stringify(sessionObj);
        localStorage.setItem(SESSION_STORAGE_KEY, serialized);
        sessionStorage.setItem(SESSION_STORAGE_KEY, serialized);
    } catch (e) {}
}

function clearActiveSession() {
    try {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {}
}

function restoreActiveSession() {
    try {
        const raw = localStorage.getItem(SESSION_STORAGE_KEY) || sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        if (parsed && parsed.user && parsed.user.username) {
            const matchedUser = appData.users.find(u => u.username === parsed.user.username) || parsed.user;
            enterDashboard(matchedUser, parsed.tab || 'dashboard', true);
            return true;
        }
    } catch (e) {}
    return false;
}

function applyBrandingUI() {
    const nama = appSettings.namaMadrasah || 'PP. Nurul Chalik';
    const elLoginTitle = document.getElementById('login-brand-title');
    const elSideName = document.getElementById('sidebar-madrasah-name');
    const elSideTa = document.getElementById('sidebar-tahun-ajaran');
    const elPrintName = document.getElementById('print-madrasah-name');
    const elPrintAddr = document.getElementById('print-madrasah-address');
    const elCardTitle = document.getElementById('card-madrasah-title');
    const elKamadName = document.getElementById('print-kamad-name');
    const elKamadNip = document.getElementById('print-kamad-nip');

    if (elLoginTitle) elLoginTitle.textContent = nama;
    if (elSideName) elSideName.textContent = nama;
    if (elSideTa) elSideTa.textContent = `TA ${appSettings.tahun} • ${appSettings.semester}`;
    if (elPrintName) elPrintName.textContent = nama;
    if (elPrintAddr) elPrintAddr.textContent = appSettings.alamat;
    if (elCardTitle) elCardTitle.textContent = nama;
    if (elKamadName) elKamadName.textContent = appSettings.namaKamad || 'Kepala Madrasah';
    if (elKamadNip) elKamadNip.textContent = `NIP/NPK. ${appSettings.nipKamad || '-'}`;
    document.title = `${nama} - Sistem Informasi Absensi Madrasah QR Code`;
}

function enterDashboard(user, initialTab = 'dashboard', isRestore = false) {
    currentUser = user;
    document.getElementById('login-view')?.classList.add('hidden');
    document.getElementById('dashboard-view')?.classList.remove('hidden');

    const initials = (user.fullName || user.username || 'AD').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const avatarEl = document.getElementById('user-avatar');
    const nameEl = document.getElementById('user-display-name');
    const roleEl = document.getElementById('user-role-badge');
    const mobileRoleEl = document.getElementById('mobile-header-role');

    if (avatarEl) avatarEl.textContent = initials;
    if (nameEl) nameEl.textContent = user.fullName || user.username;
    if (roleEl) roleEl.textContent = user.role;
    if (mobileRoleEl) mobileRoleEl.textContent = user.role;

    const isAdmin = user.role === 'Admin';
    document.querySelectorAll('.role-admin-only').forEach(el => {
        el.classList.toggle('hidden', !isAdmin);
    });

    populateSettingsForm();
    refreshAllViews();
    switchTab(initialTab || 'dashboard', isRestore);
}

function switchTab(tabName, isRestore = false) {
    activeTabName = tabName;
    if (currentUser && !isRestore) {
        saveActiveSession(currentUser, tabName);
    }

    document.querySelectorAll('.tab-content').forEach(sec => sec.classList.add('hidden'));
    const targetSection = document.getElementById(`tab-${tabName}`);
    if (targetSection) targetSection.classList.remove('hidden');

    const titles = {
        dashboard: 'Dashboard & Statistik',
        scanner: 'Scanner QR Gerbang',
        rekap: 'Rekap & Koreksi Absensi',
        siswa: 'Data Siswa & Kartu QR',
        kelas: 'Data Kelas & Wali Kelas',
        guru: 'Data Guru & Tendik',
        laporan: 'Laporan & Cetak PDF',
        pengaturan: 'Pengaturan & Akun'
    };
    const pageTitleEl = document.getElementById('page-title');
    if (pageTitleEl) pageTitleEl.textContent = titles[tabName] || 'Dashboard';

    document.querySelectorAll('.nav-btn').forEach(btn => {
        const isTarget = btn.getAttribute('data-tab') === tabName;
        if (isTarget) {
            btn.className = btn.className.replace('text-emerald-100/80 hover:bg-emerald-900/70 hover:text-white', 'bg-emerald-600 text-white shadow-sm');
            if (!btn.classList.contains('bg-emerald-600')) btn.classList.add('bg-emerald-600', 'text-white', 'shadow-sm');
        } else {
            btn.classList.remove('bg-emerald-600', 'text-white', 'shadow-sm');
            if (!btn.classList.contains('text-emerald-100/80')) {
                btn.classList.add('text-emerald-100/80', 'hover:bg-emerald-900/70', 'hover:text-white');
            }
        }
    });

    document.getElementById('sidebar')?.classList.add('-translate-x-full');

    if (tabName === 'scanner') {
        setTimeout(() => startQRScanner(true), 250);
    } else if (isScanning) {
        stopQRScanner();
    }
}

function logoutUser() {
    if (isScanning) stopQRScanner();
    currentUser = null;
    clearActiveSession();
    document.getElementById('dashboard-view')?.classList.add('hidden');
    document.getElementById('login-view')?.classList.remove('hidden');
    document.getElementById('login-form')?.reset();
    showToast('Keluar Sistem', 'Anda telah keluar dari sesi aktif.', 'warning');
}

function getTodayRecords(targetDate = getTodayKey()) {
    const dayMap = appData.attendance[targetDate] || {};
    return appData.students.map(s => {
        const rec = dayMap[s.nis] || { masuk: '-', pulang: '-', status: 'Alpa', note: '' };
        return { ...s, ...rec };
    });
}

function getMonthlySummaryMap(monthPrefix) {
    const summary = {};
    appData.students.forEach(s => {
        summary[s.nis] = { Hadir: 0, Terlambat: 0, Izin: 0, Sakit: 0, Alpa: 0, totalDays: 0 };
    });

    const matchingDates = Object.keys(appData.attendance || {}).filter(d => d.startsWith(monthPrefix));
    matchingDates.forEach(dateKey => {
        const dayMap = appData.attendance[dateKey] || {};
        appData.students.forEach(s => {
            const rec = dayMap[s.nis];
            if (rec && rec.status) {
                if (summary[s.nis][rec.status] !== undefined) {
                    summary[s.nis][rec.status] += 1;
                    summary[s.nis].totalDays += 1;
                }
            }
        });
    });
    return { summary, recordedDaysCount: matchingDates.length };
}

function refreshAllViews() {
    const todayRecords = getTodayRecords(getTodayKey());
    const total = todayRecords.length;
    const hadir = todayRecords.filter(r => r.status === 'Hadir').length;
    const terlambat = todayRecords.filter(r => r.status === 'Terlambat').length;
    const tidakHadir = todayRecords.filter(r => ['Izin', 'Sakit', 'Alpa'].includes(r.status)).length;
    const persen = total > 0 ? Math.round(((hadir + terlambat) / total) * 100) : 0;

    document.getElementById('stat-total-siswa').textContent = total;
    document.getElementById('stat-hadir').textContent = hadir;
    document.getElementById('stat-persen-hadir').textContent = `${persen}% Kehadiran`;
    document.getElementById('stat-terlambat').textContent = terlambat;
    document.getElementById('stat-tidak-hadir').textContent = tidakHadir;

    const fBulanRekap = document.getElementById('filter-bulan-rekap');
    if (fBulanRekap && !fBulanRekap.value) fBulanRekap.value = getCurrentMonthKey();

    const fBulanLaporan = document.getElementById('filter-bulan-laporan');
    if (fBulanLaporan && !fBulanLaporan.value) fBulanLaporan.value = getCurrentMonthKey();

    syncDropdownOptions();
    renderRecentScans(todayRecords);
    renderAttendanceChart(todayRecords);
    renderRekapTable();
    renderSiswaTable();
    renderKelasGrid();
    renderGuruTable();
    renderPrintTable();
    renderAccountsList();
}

function renderRekapTable() {
    const tbody = document.getElementById('rekap-table-body');
    if (!tbody) return;

    const selectedMonth = document.getElementById('filter-bulan-rekap')?.value || getCurrentMonthKey();
    const selectedDate = document.getElementById('filter-tanggal-rekap')?.value || '';
    const activeDateKey = selectedDate || (selectedMonth === getCurrentMonthKey() ? getTodayKey() : `${selectedMonth}-01`);

    const records = getTodayRecords(activeDateKey);
    const { summary: monthlyMap, recordedDaysCount } = getMonthlySummaryMap(selectedMonth);

    const periodLabel = document.getElementById('rekap-period-label');
    const monthlyStatsLabel = document.getElementById('rekap-monthly-stats');
    if (periodLabel) periodLabel.textContent = `Bulan: ${selectedMonth} • Tanggal Detail: ${activeDateKey}`;
    if (monthlyStatsLabel) monthlyStatsLabel.textContent = `Hari Tercatat Bulan Ini: ${recordedDaysCount} Hari`;

    const search = (document.getElementById('search-rekap')?.value || '').toLowerCase();
    const fKelas = document.getElementById('filter-kelas-rekap')?.value || '';
    const fStatus = document.getElementById('filter-status-rekap')?.value || '';

    const filtered = records.filter(r => {
        const matchSearch = r.nama.toLowerCase().includes(search) || r.nis.toLowerCase().includes(search);
        const matchKelas = !fKelas || r.kelas === fKelas;
        const matchStatus = !fStatus || r.status === fStatus;
        return matchSearch && matchKelas && matchStatus;
    });

    const badgeColors = {
        Hadir: 'bg-emerald-100 text-emerald-800',
        Terlambat: 'bg-amber-100 text-amber-800',
        Izin: 'bg-sky-100 text-sky-800',
        Sakit: 'bg-purple-100 text-purple-800',
        Alpa: 'bg-rose-100 text-rose-800'
    };

    tbody.innerHTML = filtered.map(r => {
        const m = monthlyMap[r.nis] || { Hadir: 0, Terlambat: 0, Izin: 0, Sakit: 0, Alpa: 0 };
        return `
        <tr class="hover:bg-slate-50/80">
            <td class="py-3 px-3 font-mono text-xs text-slate-600">${r.nis}</td>
            <td class="py-3 px-3 font-bold text-slate-900">${r.nama}</td>
            <td class="py-3 px-3 text-xs font-semibold text-slate-600">${r.kelas}</td>
            <td class="py-3 px-3 font-mono text-xs">${r.masuk}</td>
            <td class="py-3 px-3 font-mono text-xs">${r.pulang}</td>
            <td class="py-3 px-3">
                <span class="px-2.5 py-1 rounded-lg text-[11px] font-bold ${badgeColors[r.status] || 'bg-slate-100 text-slate-700'}">${r.status}</span>
            </td>
            <td class="py-3 px-3 text-center font-mono text-[11px] text-slate-600">
                <span class="text-emerald-700 font-bold">${m.Hadir}</span> /
                <span class="text-amber-700 font-bold">${m.Terlambat}</span> /
                <span class="text-sky-700 font-bold">${m.Izin}</span> /
                <span class="text-purple-700 font-bold">${m.Sakit}</span> /
                <span class="text-rose-700 font-bold">${m.Alpa}</span>
            </td>
            <td class="py-3 px-3 text-right">
                <button onclick="openCorrectionModal('${r.nis}', '${activeDateKey}')" class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 text-xs font-bold transition">Koreksi</button>
            </td>
        </tr>
    `}).join('');
}

function renderPrintTable() {
    const tbody = document.getElementById('print-table-body');
    const dateEl = document.getElementById('print-report-date');
    const subEl = document.getElementById('print-report-subtitle');
    const signDateEl = document.getElementById('print-sign-date');

    const selectedMonth = document.getElementById('filter-bulan-laporan')?.value || getCurrentMonthKey();
    const fKelas = document.getElementById('filter-kelas-laporan')?.value || '';
    const fStatus = document.getElementById('filter-status-laporan')?.value || '';

    const { summary: monthlyMap, recordedDaysCount } = getMonthlySummaryMap(selectedMonth);

    if (subEl) {
        subEl.textContent = `LAPORAN REKAPITULASI KEHADIRAN SISWA • TAHUN AJARAN ${appSettings.tahun} (SEMESTER ${appSettings.semester.toUpperCase()})`;
    }
    if (dateEl) {
        dateEl.textContent = `Periode Bulan: ${selectedMonth} | Kelas: ${fKelas || 'Semua Kelas'} | Hari Efektif Tercatat: ${recordedDaysCount} Hari`;
    }
    if (signDateEl) {
        signDateEl.textContent = `Dicetak pada ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    }

    if (!tbody) return;
    const filteredStudents = appData.students.filter(s => {
        const matchKelas = !fKelas || s.kelas === fKelas;
        const m = monthlyMap[s.nis] || { Hadir: 0, Terlambat: 0, Izin: 0, Sakit: 0, Alpa: 0 };
        const matchStatus = !fStatus || (m[fStatus] && m[fStatus] > 0);
        return matchKelas && matchStatus;
    });

    tbody.innerHTML = filteredStudents.map((s, idx) => {
        const m = monthlyMap[s.nis] || { Hadir: 0, Terlambat: 0, Izin: 0, Sakit: 0, Alpa: 0 };
        const totalHadir = m.Hadir + m.Terlambat;
        const persen = recordedDaysCount > 0 ? Math.round((totalHadir / recordedDaysCount) * 100) : 0;
        return `
        <tr>
            <td class="py-1.5 px-2">${idx + 1}</td>
            <td class="py-1.5 px-2 font-mono">${s.nis}</td>
            <td class="py-1.5 px-2 font-semibold">${s.nama}</td>
            <td class="py-1.5 px-2">${s.kelas}</td>
            <td class="py-1.5 px-2 text-center font-bold text-emerald-700">${m.Hadir}</td>
            <td class="py-1.5 px-2 text-center font-bold text-amber-700">${m.Terlambat}</td>
            <td class="py-1.5 px-2 text-center">${m.Izin}</td>
            <td class="py-1.5 px-2 text-center">${m.Sakit}</td>
            <td class="py-1.5 px-2 text-center text-rose-700">${m.Alpa}</td>
            <td class="py-1.5 px-2 text-center font-extrabold">${persen}%</td>
        </tr>
    `}).join('');
}

function setScanMode(mode) {
    scanMode = mode;
    const masukBtn = document.getElementById('mode-masuk-btn');
    const pulangBtn = document.getElementById('mode-pulang-btn');
    if (mode === 'MASUK') {
        masukBtn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white shadow-sm transition';
        pulangBtn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 transition';
    } else {
        pulangBtn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold bg-teal-600 text-white shadow-sm transition';
        masukBtn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 transition';
    }
}

async function startQRScanner(isAutoStart = false) {
    if (isScanning || isStartingScanner) return;
    isStartingScanner = true;

    const videoEl = document.getElementById('native-qr-video');
    const canvasEl = document.getElementById('native-qr-canvas');
    const overlayEl = document.getElementById('qr-scan-overlay');
    const placeholderEl = document.getElementById('scanner-placeholder');
    const statusTitle = document.getElementById('scanner-status-title');
    const statusDesc = document.getElementById('scanner-status-desc');
    const iframeBox = document.getElementById('iframe-warning-box');

    try {
        if (window.location.protocol === 'file:') {
            throw new Error('FILE_PROTOCOL');
        }
        if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            throw new Error('INSECURE_HTTP');
        }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('NO_MEDIA_DEVICES');
        }

        const camSelect = document.getElementById('camera-device-select');
        const selectedDeviceId = camSelect && camSelect.value ? camSelect.value : null;

        const constraintList = selectedDeviceId
            ? [{ video: { deviceId: { exact: selectedDeviceId } }, audio: false }]
            : [
                { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
                { video: { facingMode: 'user' }, audio: false },
                { video: true, audio: false }
            ];

        let stream = null;
        let lastErr = null;
        for (const constraints of constraintList) {
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                if (stream) break;
            } catch (err) {
                lastErr = err;
            }
        }

        if (!stream) {
            throw lastErr || new Error('Gagal mendapatkan stream kamera');
        }

        nativeMediaStream = stream;
        videoEl.srcObject = stream;
        videoEl.setAttribute('playsinline', 'true');
        await videoEl.play();

        videoEl.classList.remove('hidden');
        overlayEl?.classList.remove('hidden');
        placeholderEl?.classList.add('hidden');
        iframeBox?.classList.add('hidden');

        isScanning = true;
        document.getElementById('start-scan-btn')?.classList.add('hidden');
        document.getElementById('stop-scan-btn')?.classList.remove('hidden');
        showToast('Kamera Aktif', 'Arahkan kartu QR siswa ke kotak pemindai.');

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoInputs = devices.filter(d => d.kind === 'videoinput');
            const camSelectWrapper = document.getElementById('camera-select-wrapper');
            if (camSelect && videoInputs.length > 1) {
                const currentVal = camSelect.value;
                camSelect.innerHTML = videoInputs.map((d, i) => `<option value="${d.deviceId}">${d.label || 'Kamera ' + (i + 1)}</option>`).join('');
                if (currentVal) camSelect.value = currentVal;
                camSelectWrapper?.classList.remove('hidden');
            }
        } catch (e) {}

        const barcodeDetector = ('BarcodeDetector' in window)
            ? new BarcodeDetector({ formats: ['qr_code'] })
            : null;
        const ctx = canvasEl.getContext('2d', { willReadFrequently: true });

        const scanLoop = async () => {
            if (!isScanning || !videoEl || videoEl.readyState < 2) {
                if (isScanning) scanAnimationFrame = requestAnimationFrame(scanLoop);
                return;
            }

            try {
                let decodedText = null;

                if (barcodeDetector) {
                    const codes = await barcodeDetector.detect(videoEl);
                    if (codes && codes.length > 0) {
                        decodedText = codes[0].rawValue;
                    }
                }

                if (!decodedText && typeof jsQR === 'function' && videoEl.videoWidth > 0) {
                    canvasEl.width = videoEl.videoWidth;
                    canvasEl.height = videoEl.videoHeight;
                    ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
                    const imgData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
                    const code = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'dontInvert' });
                    if (code && code.data) {
                        decodedText = code.data;
                    }
                }

                if (decodedText) {
                    const now = Date.now();
                    if (decodedText !== lastScannedCode || (now - lastScannedTimestamp) >= 3000) {
                        lastScannedCode = decodedText;
                        lastScannedTimestamp = now;
                        processScannedQR(decodedText);
                    }
                }
            } catch (frameErr) {}

            if (isScanning) {
                scanAnimationFrame = requestAnimationFrame(scanLoop);
            }
        };

        scanAnimationFrame = requestAnimationFrame(scanLoop);
    } catch (err) {
        isScanning = false;
        videoEl?.classList.add('hidden');
        overlayEl?.classList.add('hidden');
        placeholderEl?.classList.remove('hidden');

        const inIframe = window.self !== window.top;
        const errMsg = String(err?.message || err?.name || '');
        let titleText = 'Kamera Memerlukan Izin Browser';
        let descText = 'Klik ikon gembok/pengaturan di sebelah alamat URL → Izinkan Kamera, lalu klik Mulai Kamera QR.';

        if (errMsg === 'FILE_PROTOCOL') {
            titleText = 'File Dibuka Offline (file://)';
            descText = 'Browser memblokir kamera jika file dibuka langsung dari penyimpanan HP/PC. Buka melalui link HTTPS hosting Anda.';
        } else if (errMsg === 'INSECURE_HTTP' || errMsg === 'NO_MEDIA_DEVICES') {
            titleText = 'Halaman Tidak Menggunakan HTTPS atau Dibuka di WebView';
            descText = 'Pastikan link diawali https:// dan buka langsung di Google Chrome / Safari (bukan browser dalam WhatsApp).';
        } else if (errMsg.includes('NotAllowed') || errMsg.includes('Permission')) {
            titleText = 'Izin Kamera Diblokir oleh Browser / HP';
            descText = 'Buka Pengaturan Situs di Chrome/Safari → Izin → Kamera → Pilih Izinkan (Allow), lalu muat ulang halaman.';
        } else if (errMsg.includes('NotReadable') || errMsg.includes('TrackStartError')) {
            titleText = 'Kamera Sedang Dipakai Aplikasi Lain';
            descText = 'Tutup aplikasi lain yang memakai kamera (atau tab preview lain), lalu klik Mulai Kamera QR.';
        } else if (inIframe) {
            titleText = 'Kamera Live Dibatasi oleh Frame';
            descText = 'Buka link website Anda langsung di tab Google Chrome / Safari baru.';
        }

        if (statusTitle) statusTitle.textContent = titleText;
        if (statusDesc) statusDesc.textContent = descText;
        if (iframeBox) {
            iframeBox.innerHTML = `<p class="text-[11px] text-amber-300 bg-amber-950/80 border border-amber-500/40 rounded-xl px-3 py-2 text-left leading-relaxed"><b>Penyebab terdeteksi:</b> ${descText}<br><span class="text-slate-300">Alternatif cepat: gunakan tombol <b>"📷 Potret Kartu QR"</b> di bawah.</span></p>`;
            iframeBox.classList.remove('hidden');
        }

        if (!isAutoStart) {
            showToast(titleText, descText, 'error');
        }
    } finally {
        isStartingScanner = false;
    }
}

async function stopQRScanner() {
    isScanning = false;
    isStartingScanner = false;
    if (scanAnimationFrame) {
        cancelAnimationFrame(scanAnimationFrame);
        scanAnimationFrame = null;
    }
    if (nativeMediaStream) {
        nativeMediaStream.getTracks().forEach(track => track.stop());
        nativeMediaStream = null;
    }
    const videoEl = document.getElementById('native-qr-video');
    if (videoEl) {
        videoEl.srcObject = null;
        videoEl.classList.add('hidden');
    }
    document.getElementById('qr-scan-overlay')?.classList.add('hidden');
    document.getElementById('start-scan-btn')?.classList.remove('hidden');
    document.getElementById('stop-scan-btn')?.classList.add('hidden');
    document.getElementById('scanner-placeholder')?.classList.remove('hidden');
}

function processScannedQR(rawCode) {
    const cleanNis = String(rawCode || '').trim();
    const student = appData.students.find(s => s.nis === cleanNis);
    if (!student) {
        showToast('QR Tidak Dikenal', `Kode "${cleanNis}" tidak terdaftar di database siswa.`, 'error');
        return;
    }

    const today = getTodayKey();
    if (!appData.attendance[today]) appData.attendance[today] = {};
    const nowTime = getCurrentTimeStr();
    const existing = appData.attendance[today][student.nis] || { masuk: '-', pulang: '-', status: 'Alpa', note: '' };

    if (scanMode === 'MASUK') {
        const isLate = nowTime > (appSettings.batasTerlambat || '07:15');
        existing.masuk = nowTime;
        existing.status = isLate ? 'Terlambat' : 'Hadir';
        existing.note = isLate ? 'Melewati batas jam masuk' : 'Scan QR Gerbang';
    } else {
        if (existing.masuk === '-') existing.masuk = nowTime;
        if (existing.status === 'Alpa') existing.status = 'Hadir';
        existing.pulang = nowTime;
    }

    appData.attendance[today][student.nis] = existing;
    saveAllState();

    document.getElementById('last-scan-name').textContent = student.nama;
    document.getElementById('last-scan-meta').textContent = `NIS: ${student.nis} • Kelas: ${student.kelas}`;
    document.getElementById('last-scan-time').textContent = `Waktu (${scanMode}): ${nowTime}`;
    document.getElementById('last-scan-badge').textContent = existing.status;

    showToast(`Presensi ${scanMode} Berhasil`, `${student.nama} (${student.kelas}) — ${existing.status}`);
    refreshAllViews();
}

function renderRecentScans(records) {
    const container = document.getElementById('recent-scans-list');
    if (!container) return;
    const scanned = records.filter(r => r.masuk !== '-').slice(0, 8);
    if (scanned.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 text-center py-8">Belum ada pemindaian hari ini.</p>`;
        return;
    }
    container.innerHTML = scanned.map(r => `
        <div class="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div class="min-w-0">
                <p class="text-xs font-bold text-slate-900 truncate">${r.nama}</p>
                <p class="text-[11px] text-slate-500">${r.kelas} • Masuk ${r.masuk}</p>
            </div>
            <span class="px-2 py-0.5 rounded-md text-[10px] font-bold ${r.status === 'Terlambat' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">${r.status}</span>
        </div>
    `).join('');
}

function renderAttendanceChart(records) {
    const canvas = document.getElementById('attendanceChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const labels = appData.kelasList.map(k => k.nama);
    const hadirCounts = labels.map(kName => records.filter(r => r.kelas === kName && (r.status === 'Hadir' || r.status === 'Terlambat')).length);
    const absenCounts = labels.map(kName => records.filter(r => r.kelas === kName && !['Hadir', 'Terlambat'].includes(r.status)).length);

    if (attendanceChartInstance) attendanceChartInstance.destroy();
    attendanceChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Hadir', data: hadirCounts, backgroundColor: '#059669', borderRadius: 6 },
                { label: 'Belum / Tidak Hadir', data: absenCounts, backgroundColor: '#e2e8f0', borderRadius: 6 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

function renderSiswaTable() {
    const tbody = document.getElementById('siswa-table-body');
    if (!tbody) return;
    tbody.innerHTML = appData.students.map(s => `
        <tr class="hover:bg-slate-50/80">
            <td class="py-3 px-3 font-mono text-xs text-slate-600">${s.nis}</td>
            <td class="py-3 px-3 font-bold text-slate-900">${s.nama}</td>
            <td class="py-3 px-3 text-xs font-semibold text-slate-600">${s.kelas}</td>
            <td class="py-3 px-3 text-xs text-slate-500">${s.wa || '-'}</td>
            <td class="py-3 px-3 text-right space-x-1.5">
                <button onclick="showStudentQRCard('${s.nis}')" class="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white text-xs font-bold transition">Kartu QR</button>
                <button onclick="deleteStudent('${s.nis}')" class="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white text-xs font-bold transition">Hapus</button>
            </td>
        </tr>
    `).join('');
}

function renderKelasGrid() {
    const grid = document.getElementById('kelas-grid');
    if (!grid) return;
    grid.innerHTML = appData.kelasList.map(k => {
        const count = appData.students.filter(s => s.kelas === k.nama).length;
        return `
            <div class="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-start justify-between">
                <div>
                    <span class="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">Tingkat ${k.tingkat}</span>
                    <h4 class="font-extrabold text-slate-900 text-base mt-1">${k.nama}</h4>
                    <p class="text-xs text-slate-500 mt-0.5">Wali: ${k.waliKelas}</p>
                    <p class="text-xs font-bold text-emerald-700 mt-2">${count} Siswa Terdaftar</p>
                </div>
                <button onclick="deleteKelas('${k.id}')" class="text-xs font-bold text-rose-500 hover:text-rose-700">Hapus</button>
            </div>
        `;
    }).join('');
}

function renderGuruTable() {
    const tbody = document.getElementById('guru-table-body');
    if (!tbody) return;
    tbody.innerHTML = appData.guruList.map((g, idx) => `
        <tr class="hover:bg-slate-50/80">
            <td class="py-3 px-3 font-mono text-xs text-slate-600">${g.npk}</td>
            <td class="py-3 px-3 font-bold text-slate-900">${g.nama}</td>
            <td class="py-3 px-3 text-xs text-slate-600">${g.jabatan} ${g.mapel ? `(${g.mapel})` : ''}</td>
            <td class="py-3 px-3 text-xs text-slate-500">${g.hp || '-'}</td>
            <td class="py-3 px-3 text-right">
                <button onclick="deleteGuru(${idx})" class="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white text-xs font-bold transition">Hapus</button>
            </td>
        </tr>
    `).join('');
}

function renderAccountsList() {
    const list = document.getElementById('accounts-list');
    if (!list) return;
    list.innerHTML = appData.users.map((u, idx) => `
        <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div>
                <p class="font-bold text-slate-900">${u.fullName} <span class="text-emerald-700">(${u.role})</span></p>
                <p class="text-[11px] text-slate-500">User: <span class="font-mono font-bold">${u.username}</span></p>
            </div>
            ${u.username !== 'Admin' ? `<button onclick="deleteAccount(${idx})" class="text-rose-600 font-bold hover:underline">Hapus</button>` : '<span class="text-[10px] font-bold text-slate-400">Utama</span>'}
        </div>
    `).join('');
}

function syncDropdownOptions() {
    const kelasOptions = appData.kelasList.map(k => `<option value="${k.nama}">${k.nama}</option>`).join('');
    const filterKelas = document.getElementById('filter-kelas-rekap');
    if (filterKelas) {
        const cur = filterKelas.value;
        filterKelas.innerHTML = `<option value="">Semua Kelas</option>${kelasOptions}`;
        filterKelas.value = cur;
    }
    const filterKelasLaporan = document.getElementById('filter-kelas-laporan');
    if (filterKelasLaporan) {
        const curL = filterKelasLaporan.value;
        filterKelasLaporan.innerHTML = `<option value="">Semua Kelas</option>${kelasOptions}`;
        filterKelasLaporan.value = curL;
    }
    const newKelas = document.getElementById('new-kelas');
    if (newKelas) newKelas.innerHTML = kelasOptions;
    const accKelas = document.getElementById('acc-kelas');
    if (accKelas) accKelas.innerHTML = kelasOptions;

    const quickStudent = document.getElementById('quick-student-select');
    if (quickStudent) {
        const curS = quickStudent.value;
        quickStudent.innerHTML = `<option value="">-- Pilih Siswa --</option>` + appData.students.map(s => `<option value="${s.nis}">${s.nis} - ${s.nama} (${s.kelas})</option>`).join('');
        quickStudent.value = curS;
    }
}

function populateSettingsForm() {
    document.getElementById('set-nama-madrasah').value = appSettings.namaMadrasah || '';
    document.getElementById('set-nama-kamad').value = appSettings.namaKamad || '';
    document.getElementById('set-nip-kamad').value = appSettings.nipKamad || '';
    document.getElementById('set-tahun').value = appSettings.tahun || '';
    document.getElementById('set-semester').value = appSettings.semester || 'Ganjil';
    document.getElementById('set-alamat').value = appSettings.alamat || '';
    document.getElementById('set-jam-masuk').value = appSettings.jamMasuk || '07:00';
    document.getElementById('set-batas-terlambat').value = appSettings.batasTerlambat || '07:15';
    document.getElementById('set-jam-pulang').value = appSettings.jamPulang || '14:00';
}

function openModal(id) {
    document.getElementById(id)?.classList.remove('hidden');
}

function closeModal(id) {
    document.getElementById(id)?.classList.add('hidden');
}

function openCorrectionModal(nis, targetDate = getTodayKey()) {
    const student = appData.students.find(s => s.nis === nis);
    if (!student) return;
    activeCorrectionDate = targetDate;
    const currentRec = (appData.attendance[targetDate] && appData.attendance[targetDate][nis]) || { status: 'Alpa', note: '' };
    document.getElementById('corr-nis').value = nis;
    document.getElementById('corr-student-info').textContent = `${student.nama} (${student.nis}) — Kelas ${student.kelas} [${targetDate}]`;
    document.getElementById('corr-status').value = currentRec.status;
    document.getElementById('corr-note').value = currentRec.note || '';
    openModal('correction-modal');
}

function downloadStudentCSVTemplate() {
    const sampleKelas = appData.kelasList[0]?.nama || 'VII A';
    const csv = `NIS,Nama Lengkap,Kelas,No WA\n2026101,Ahmad Fauzan,${sampleKelas},081234567890\n2026102,Siti Aisyah,${sampleKelas},081234567891`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Template_Upload_Siswa_PP_Nurul_Chalik.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function showStudentQRCard(nis) {
    const student = appData.students.find(s => s.nis === nis);
    if (!student) return;
    document.getElementById('card-student-name').textContent = student.nama;
    document.getElementById('card-student-meta').textContent = `NIS: ${student.nis} • Kelas: ${student.kelas}`;
    const qrContainer = document.getElementById('qrcode-canvas');
    qrContainer.innerHTML = '';
    if (typeof QRCode !== 'undefined') {
        new QRCode(qrContainer, { text: student.nis, width: 160, height: 160 });
    }
    openModal('qr-card-modal');
}

function deleteStudent(nis) {
    appData.students = appData.students.filter(s => s.nis !== nis);
    saveAllState();
    refreshAllViews();
    showToast('Siswa Dihapus', `Data siswa dengan NIS ${nis} telah dihapus.`, 'warning');
}

function deleteKelas(id) {
    appData.kelasList = appData.kelasList.filter(k => k.id !== id);
    saveAllState();
    refreshAllViews();
    showToast('Kelas Dihapus', 'Rombongan belajar berhasil dihapus.', 'warning');
}

function deleteGuru(idx) {
    appData.guruList.splice(idx, 1);
    saveAllState();
    refreshAllViews();
    showToast('Data Guru Dihapus', 'Data guru/tendik berhasil dihapus.', 'warning');
}

function deleteAccount(idx) {
    appData.users.splice(idx, 1);
    saveAllState();
    refreshAllViews();
    showToast('Akun Dihapus', 'Akun pengguna berhasil dihapus.', 'warning');
}

function toggleAccKelasField() {
    const role = document.getElementById('acc-role').value;
    document.getElementById('acc-kelas-wrapper').classList.toggle('hidden', role !== 'Wali Kelas');
}

function exportRekapCSV() {
    const selectedMonth = document.getElementById('filter-bulan-laporan')?.value || getCurrentMonthKey();
    const fKelas = document.getElementById('filter-kelas-laporan')?.value || '';
    const fStatus = document.getElementById('filter-status-laporan')?.value || '';
    const { summary: monthlyMap, recordedDaysCount } = getMonthlySummaryMap(selectedMonth);

    const filteredStudents = appData.students.filter(s => {
        const matchKelas = !fKelas || s.kelas === fKelas;
        const m = monthlyMap[s.nis] || { Hadir: 0, Terlambat: 0, Izin: 0, Sakit: 0, Alpa: 0 };
        const matchStatus = !fStatus || (m[fStatus] && m[fStatus] > 0);
        return matchKelas && matchStatus;
    });

    const rows = [['NIS', 'Nama Siswa', 'Kelas', 'Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alpa', 'Persentase Hadir']];
    filteredStudents.forEach(s => {
        const m = monthlyMap[s.nis] || { Hadir: 0, Terlambat: 0, Izin: 0, Sakit: 0, Alpa: 0 };
        const persen = recordedDaysCount > 0 ? Math.round(((m.Hadir + m.Terlambat) / recordedDaysCount) * 100) : 0;
        rows.push([s.nis, `"${s.nama}"`, s.kelas, m.Hadir, m.Terlambat, m.Izin, m.Sakit, m.Alpa, `${persen}%`]);
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Laporan_Absensi_${selectedMonth}_${fKelas || 'Semua_Kelas'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function startLiveClock() {
    const updateClock = () => {
        const now = new Date();
        const dateEl = document.getElementById('live-date-display');
        const clockEl = document.getElementById('live-clock-display');
        if (dateEl) dateEl.textContent = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        if (clockEl) clockEl.textContent = now.toTimeString().slice(0, 8);
    };
    updateClock();
    setInterval(updateClock, 1000);
}

function setupEventListeners() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const uname = document.getElementById('username').value.trim();
            const pwd = document.getElementById('password').value;
            const found = appData.users.find(u => u.username.toLowerCase() === uname.toLowerCase() && u.password === pwd);
            if (!found) {
                showToast('Login Gagal', 'Username atau kata sandi salah.', 'error');
                return;
            }
            saveActiveSession(found, 'dashboard');
            enterDashboard(found, 'dashboard');
            showToast('Selamat Datang', `Berhasil masuk sebagai ${found.fullName} (${found.role}).`);
        });
    }

    document.getElementById('toggle-password')?.addEventListener('click', () => {
        const pwdInput = document.getElementById('password');
        if (pwdInput) pwdInput.type = pwdInput.type === 'password' ? 'text' : 'password';
    });

    document.getElementById('logout-btn')?.addEventListener('click', logoutUser);

    document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.remove('-translate-x-full');
    });

    document.getElementById('close-sidebar-btn')?.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.add('-translate-x-full');
    });

    document.getElementById('start-scan-btn')?.addEventListener('click', () => startQRScanner(false));
    document.getElementById('stop-scan-btn')?.addEventListener('click', stopQRScanner);

    document.getElementById('camera-device-select')?.addEventListener('change', async () => {
        if (isScanning) {
            await stopQRScanner();
            setTimeout(() => startQRScanner(false), 200);
        }
    });

    const handleQRImageInput = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            let decodedText = null;
            if ('BarcodeDetector' in window) {
                try {
                    const bitmap = await createImageBitmap(file);
                    const detector = new BarcodeDetector({ formats: ['qr_code'] });
                    const barcodes = await detector.detect(bitmap);
                    if (barcodes && barcodes.length > 0) {
                        decodedText = barcodes[0].rawValue;
                    }
                } catch (bdErr) {}
            }
            if (!decodedText && typeof Html5Qrcode !== 'undefined') {
                const fileScanner = new Html5Qrcode('qr-file-reader-temp');
                decodedText = await fileScanner.scanFile(file, true);
                await fileScanner.clear();
            }
            if (decodedText) {
                processScannedQR(decodedText);
            } else {
                throw new Error('QR tidak ditemukan');
            }
        } catch (err) {
            showToast('QR Tidak Terbaca', 'Pastikan foto kartu QR fokus, terang, dan tidak terpotong.', 'error');
        } finally {
            e.target.value = '';
        }
    };

    document.getElementById('qr-camera-snap')?.addEventListener('change', handleQRImageInput);
    document.getElementById('qr-image-file')?.addEventListener('change', handleQRImageInput);

    document.getElementById('manual-scan-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const nis = document.getElementById('quick-student-select')?.value;
        if (!nis) {
            showToast('Pilih Siswa', 'Silakan pilih nama siswa terlebih dahulu.', 'warning');
            return;
        }
        processScannedQR(nis);
    });

    document.getElementById('filter-bulan-rekap')?.addEventListener('change', (e) => {
        const tglInput = document.getElementById('filter-tanggal-rekap');
        if (tglInput && tglInput.value && !tglInput.value.startsWith(e.target.value)) {
            tglInput.value = '';
        }
        renderRekapTable();
    });
    document.getElementById('filter-tanggal-rekap')?.addEventListener('change', (e) => {
        if (e.target.value) {
            const blnInput = document.getElementById('filter-bulan-rekap');
            if (blnInput) blnInput.value = e.target.value.slice(0, 7);
        }
        renderRekapTable();
    });
    document.getElementById('search-rekap')?.addEventListener('input', renderRekapTable);
    document.getElementById('filter-kelas-rekap')?.addEventListener('change', renderRekapTable);
    document.getElementById('filter-status-rekap')?.addEventListener('change', renderRekapTable);

    document.getElementById('filter-bulan-laporan')?.addEventListener('change', renderPrintTable);
    document.getElementById('filter-kelas-laporan')?.addEventListener('change', renderPrintTable);
    document.getElementById('filter-status-laporan')?.addEventListener('change', renderPrintTable);

    document.getElementById('bulk-student-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('bulk-csv-file');
        let rawText = document.getElementById('bulk-csv-text').value.trim();

        if (fileInput && fileInput.files && fileInput.files[0]) {
            rawText = await fileInput.files[0].text();
        }

        if (!rawText) {
            showToast('Data Kosong', 'Pilih file CSV atau tempel daftar siswa terlebih dahulu.', 'warning');
            return;
        }

        const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        let addedCount = 0;
        let updatedCount = 0;

        lines.forEach((line, index) => {
            const sep = line.includes(';') ? ';' : ',';
            const cols = line.split(sep).map(c => c.replace(/^"|"$/g, '').trim());
            if (cols.length < 3) return;
            const [nis, nama, kelas, wa = ''] = cols;
            if (index === 0 && nis.toLowerCase() === 'nis') return;
            if (!nis || !nama) return;

            const existingIdx = appData.students.findIndex(s => s.nis === nis);
            if (existingIdx >= 0) {
                appData.students[existingIdx] = { nis, nama, kelas: kelas || appData.students[existingIdx].kelas, wa };
                updatedCount++;
            } else {
                appData.students.push({ nis, nama, kelas: kelas || (appData.kelasList[0]?.nama || 'VII A'), wa });
                addedCount++;
            }
        });

        saveAllState();
        refreshAllViews();
        e.target.reset();
        closeModal('bulk-student-modal');
        showToast('Impor Siswa Selesai', `${addedCount} siswa baru ditambahkan, ${updatedCount} diperbarui.`);
    });

    document.getElementById('add-student-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const nis = document.getElementById('new-nis').value.trim();
        const nama = document.getElementById('new-nama').value.trim();
        const kelas = document.getElementById('new-kelas').value;
        const wa = document.getElementById('new-wa').value.trim();
        if (appData.students.some(s => s.nis === nis)) {
            showToast('NIS Duplikat', 'NIS tersebut sudah terdaftar.', 'error');
            return;
        }
        appData.students.push({ nis, nama, kelas, wa });
        saveAllState();
        refreshAllViews();
        e.target.reset();
        closeModal('add-student-modal');
        showToast('Siswa Ditambahkan', `${nama} berhasil disimpan.`);
    });

    document.getElementById('add-kelas-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const tingkat = document.getElementById('new-kelas-tingkat').value;
        const kode = document.getElementById('new-kelas-kode').value.trim();
        const nama = document.getElementById('new-kelas-nama').value.trim();
        const waliKelas = document.getElementById('new-kelas-wali').value.trim();
        appData.kelasList.push({ id: 'KLS-' + Date.now(), tingkat, kode, nama, waliKelas });
        saveAllState();
        refreshAllViews();
        e.target.reset();
        closeModal('add-kelas-modal');
        showToast('Kelas Ditambahkan', `Rombel ${nama} berhasil disimpan.`);
    });

    document.getElementById('add-guru-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        appData.guruList.push({
            npk: document.getElementById('new-guru-npk').value.trim(),
            nama: document.getElementById('new-guru-nama').value.trim(),
            tempat: document.getElementById('new-guru-tempat').value.trim(),
            tgl: document.getElementById('new-guru-tgl').value,
            mapel: document.getElementById('new-guru-mapel').value.trim(),
            jabatan: document.getElementById('new-guru-jabatan').value.trim(),
            hp: document.getElementById('new-guru-hp').value.trim()
        });
        saveAllState();
        refreshAllViews();
        e.target.reset();
        closeModal('add-guru-modal');
        showToast('Data Guru Disimpan', 'Data pendidik baru berhasil ditambahkan.');
    });

    document.getElementById('correction-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const nis = document.getElementById('corr-nis').value;
        const status = document.getElementById('corr-status').value;
        const note = document.getElementById('corr-note').value.trim();
        const targetDate = activeCorrectionDate || getTodayKey();
        if (!appData.attendance[targetDate]) appData.attendance[targetDate] = {};
        const existing = appData.attendance[targetDate][nis] || { masuk: '-', pulang: '-' };
        existing.status = status;
        existing.note = note;
        appData.attendance[targetDate][nis] = existing;
        saveAllState();
        refreshAllViews();
        closeModal('correction-modal');
        showToast('Status Diperbarui', `Status kehadiran tanggal ${targetDate} diubah menjadi ${status}.`);
    });

    document.getElementById('settings-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        appSettings.namaMadrasah = document.getElementById('set-nama-madrasah').value.trim() || 'PP. Nurul Chalik';
        appSettings.namaKamad = document.getElementById('set-nama-kamad').value.trim() || 'KH. Abdurrahman Chalik';
        appSettings.nipKamad = document.getElementById('set-nip-kamad').value.trim() || '-';
        appSettings.tahun = document.getElementById('set-tahun').value.trim() || '2026/2027';
        appSettings.semester = document.getElementById('set-semester').value;
        appSettings.alamat = document.getElementById('set-alamat').value.trim();
        appSettings.jamMasuk = document.getElementById('set-jam-masuk').value;
        appSettings.batasTerlambat = document.getElementById('set-batas-terlambat').value;
        appSettings.jamPulang = document.getElementById('set-jam-pulang').value;
        saveAllState();
        applyBrandingUI();
        refreshAllViews();
        showToast('Pengaturan Disimpan', 'Identitas madrasah, Kepala Madrasah, dan Tahun Ajaran berhasil diperbarui.');
    });

    document.getElementById('create-user-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const role = document.getElementById('acc-role').value;
        const kelasBinaan = role === 'Wali Kelas' ? document.getElementById('acc-kelas').value : '';
        const fullName = document.getElementById('acc-fullname').value.trim();
        const username = document.getElementById('acc-username').value.trim();
        const password = document.getElementById('acc-password').value;
        if (appData.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
            showToast('Username Terpakai', 'Gunakan username lain.', 'error');
            return;
        }
        appData.users.push({ username, password, fullName, role, kelasBinaan });
        saveAllState();
        refreshAllViews();
        e.target.reset();
        toggleAccKelasField();
        showToast('Akun Dibuat', `Akun ${username} (${role}) berhasil ditambahkan.`);
    });
}

window.addEventListener('DOMContentLoaded', () => {
    activeCorrectionDate = getTodayKey();
    loadLocalState();
    applyBrandingUI();
    startLiveClock();
    setupEventListeners();
    restoreActiveSession();
});