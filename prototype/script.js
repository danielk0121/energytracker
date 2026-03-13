// --- 테마 전환 로직 ---
function toggleTheme() {
    const body = document.body;
    const btn = document.querySelector('.theme-btn');
    body.classList.toggle('dark-mode');
    const isDark = body.classList.contains('dark-mode');
    btn.textContent = isDark ? '☀️' : '🌙';
    sessionStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// --- 1. 데이터 생성 및 관리 ---
const generateHistoricalData = () => {
    const data = [];
    const endDate = new Date("2026-03-12");
    const startDate = new Date("2024-01-01"); 
    let seed = 12345;
    const pseudoRandom = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const month = d.getMonth();
        let seasonalBoost = 0;
        if (month === 6 || month === 7) seasonalBoost = 5;
        if (month === 11 || month === 0) seasonalBoost = 4;
        const usage = parseFloat((pseudoRandom() * 6 + 4 + seasonalBoost).toFixed(1));
        data.push({
            date: d.toISOString().split('T')[0],
            usage: usage
        });
    }
    return data;
};

const FIXED_DATA = generateHistoricalData();
let currentData = [...FIXED_DATA];
let pendingData = []; 
let currentTab = 'monthly';
let monthlyFilter = '13months';
let dailyFilter = '40days';
let listFilter = '40days';
let uploadedFilesData = []; // 사진 데이터 (IndexedDB에 저장됨)

// --- 2. 상태 보존 (IndexedDB + sessionStorage) ---
const DB_NAME = 'EnergyTrackerDB';
const STORE_NAME = 'photos';

const openDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject('IndexedDB 오픈 실패');
    });
};

const savePhotosToDB = async (photos) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.clear();
        photos.forEach(photo => store.add(photo));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject('사진 저장 실패');
    });
};

const loadPhotosFromDB = async () => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject('사진 로드 실패');
    });
};

const clearPhotosDB = async () => {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    transaction.objectStore(STORE_NAME).clear();
};

const saveState = async () => {
    // 가벼운 상태값들
    const metaState = {
        currentData,
        pendingData,
        currentTab,
        monthlyFilter,
        dailyFilter,
        listFilter
    };
    sessionStorage.setItem('energyTrackerMeta', JSON.stringify(metaState));
    
    // 무거운 사진 데이터는 IndexedDB로 (비동기)
    await savePhotosToDB(uploadedFilesData);
};

const loadState = async () => {
    // 1. 메타 데이터 로드
    const savedMeta = sessionStorage.getItem('energyTrackerMeta');
    if (savedMeta) {
        const state = JSON.parse(savedMeta);
        currentData = state.currentData;
        pendingData = state.pendingData;
        currentTab = state.currentTab;
        monthlyFilter = state.monthlyFilter;
        dailyFilter = state.dailyFilter;
        listFilter = state.listFilter || '40days';
    }

    // 2. 사진 데이터 로드 (IndexedDB)
    try {
        uploadedFilesData = await loadPhotosFromDB();
    } catch (e) {
        console.error(e);
        uploadedFilesData = [];
    }
    
    // 3. UI 복구
    renderThumbnails();
    if (uploadedFilesData.length > 0) uploadResetBtn.style.display = 'block';
    
    if (pendingData.length > 0) {
        renderAnalysisResults();
        applyBtn.style.display = 'block';
        resetBtn.style.display = 'block';
    }
    
    const theme = sessionStorage.getItem('theme');
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
        document.querySelector('.theme-btn').textContent = '☀️';
    }
    
    updateUI();
};

// --- 3. 사진 업로드 및 분석 로직 ---
const photoInput = document.getElementById('photo-input');
const thumbnailPreview = document.getElementById('thumbnail-preview');
const analyzeBtn = document.getElementById('analyze-btn');
const uploadResetBtn = document.getElementById('upload-reset-btn');
const applyBtn = document.getElementById('apply-btn');
const resetBtn = document.getElementById('reset-btn');
const analysisResults = document.getElementById('analysis-results');
const analysisInstruction = document.getElementById('analysis-instruction');

photoInput.addEventListener('change', async (e) => {
    if (e.target.files && e.target.files.length > 0) {
        const files = Array.from(e.target.files);
        for (const file of files) {
            const base64 = await fileToBase64(file);
            uploadedFilesData.push({ name: file.name, data: base64 });
        }
        renderThumbnails();
        uploadResetBtn.style.display = 'block';
        await saveState();
    }
});

const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
};

const renderThumbnails = () => {
    thumbnailPreview.innerHTML = '';
    uploadedFilesData.forEach(fileObj => {
        const img = document.createElement('img');
        img.src = fileObj.data;
        img.className = 'thumbnail';
        thumbnailPreview.appendChild(img);
    });
};

const mockAnalyzeImage = (filesData) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const extracted = [];
            const baseDate = new Date("2026-03-12"); 
            let dayOffset = 1;

            for (let i = 0; i < filesData.length; i++) {
                let dataCount = (i === 0) ? 3 : (i === 1 ? 2 : 1);
                for (let j = 0; j < dataCount; j++) {
                    const date = new Date(baseDate);
                    date.setDate(baseDate.getDate() + dayOffset++);
                    extracted.push({
                        photoIndex: i + 1,
                        date: date.toISOString().split('T')[0],
                        usage: parseFloat((Math.random() * 5 + 7).toFixed(1))
                    });
                }
            }
            resolve(extracted);
        }, 1500);
    });
};

analyzeBtn.addEventListener('click', async () => {
    if (uploadedFilesData.length === 0) {
        alert('분석할 사진을 먼저 선택해주세요.');
        return;
    }

    alert('아직 사진 분석 기능이 개발중이라, 임시로 샘플 데이터를 사용할께요.');
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = '이미지 분석 중...';
    applyBtn.style.display = 'none';
    resetBtn.style.display = 'block';
    analysisResults.innerHTML = `<div class="analysis-empty"><strong>${uploadedFilesData.length}장</strong>의 사진을 분석하고 있습니다...</div>`;

    pendingData = await mockAnalyzeImage(uploadedFilesData);
    renderAnalysisResults();
    
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = '사진 분석 시작';
    applyBtn.style.display = 'block'; 
    await saveState();
});

const renderAnalysisResults = () => {
    analysisInstruction.style.display = 'block';
    let detailHtml = `
        <p style="color: var(--primary-blue); font-weight: bold; margin-bottom: 5px;">✅ 분석 완료 (${pendingData.length}건)</p>
    `;
    pendingData.forEach((data) => {
        detailHtml += `
            <div class="analysis-item">
                <span>사진 ${data.photoIndex}: ${data.date}</span>
                <strong>${data.usage} kWh</strong>
            </div>`;
    });
    analysisResults.innerHTML = detailHtml;
};

applyBtn.addEventListener('click', async () => {
    if (pendingData.length === 0) return;
    currentData = [...currentData, ...pendingData];
    updateUI();
    alert(`${pendingData.length}건의 데이터가 차트와 목록에 반영되었습니다.`);
    applyBtn.disabled = true;
    applyBtn.textContent = '반영 완료';
    await saveState();
});

resetBtn.addEventListener('click', async () => {
    if (!confirm('분석 결과를 초기화하시겠습니까?')) return;
    analysisInstruction.style.display = 'none';
    analysisResults.innerHTML = `<div class="analysis-empty">업로드된 사진이 없습니다.<br>분석을 시작해주세요.</div>`;
    pendingData = [];
    applyBtn.style.display = 'none';
    applyBtn.disabled = false;
    applyBtn.textContent = '데이터 반영하기';
    resetBtn.style.display = 'none';
    await saveState();
});

uploadResetBtn.addEventListener('click', async () => {
    if (!confirm('업로드된 사진 목록을 초기화하시겠습니까?')) return;
    uploadedFilesData = [];
    photoInput.value = '';
    renderThumbnails();
    uploadResetBtn.style.display = 'none';
    await clearPhotosDB();
    await saveState();
});

// --- 4. UI 렌더링 및 필터 로직 ---
const updateMonthlyFilter = async (filter) => {
    monthlyFilter = filter;
    await saveState();
    updateUI();
};

const updateDailyFilter = async (filter) => {
    dailyFilter = filter;
    await saveState();
    updateUI();
};

const updateListFilter = async (filter) => {
    listFilter = filter;
    await saveState();
    updateUI();
};

const switchTab = async (tab) => {
    currentTab = tab;
    await saveState();
    updateUI();
};

const updateUI = () => {
    // 버튼 상태 동기화
    document.getElementById('filter-monthly-13').classList.toggle('active', monthlyFilter === '13months');
    document.getElementById('filter-monthly-year').classList.toggle('active', monthlyFilter === 'thisyear');
    document.getElementById('filter-monthly-last').classList.toggle('active', monthlyFilter === 'lastyear');
    document.getElementById('filter-monthly-26').classList.toggle('active', monthlyFilter === '26months');
    
    document.getElementById('filter-daily-40').classList.toggle('active', dailyFilter === '40days');
    document.getElementById('filter-daily-month').classList.toggle('active', dailyFilter === 'thismonth');
    document.getElementById('filter-daily-last').classList.toggle('active', dailyFilter === 'lastmonth');
    document.getElementById('filter-daily-year').classList.toggle('active', dailyFilter === 'thisyear');

    document.getElementById('filter-list-40').classList.toggle('active', listFilter === '40days');
    document.getElementById('filter-list-thismonth').classList.toggle('active', listFilter === 'thismonth');
    document.getElementById('filter-list-lastmonth').classList.toggle('active', listFilter === 'lastmonth');
    document.getElementById('filter-list-thisyear').classList.toggle('active', listFilter === 'thisyear');
    document.getElementById('filter-list-lastyear').classList.toggle('active', listFilter === 'lastyear');
    document.getElementById('filter-list-2years').classList.toggle('active', listFilter === '2years');
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', 
            (currentTab === 'daily' && btn.id === 'tab-daily') || 
            (currentTab === 'monthly' && btn.id === 'tab-monthly')
        );
    });
    document.getElementById('list-header').innerHTML = 
        currentTab === 'daily' ? '<th>날짜</th><th>사용량 (kWh)</th><th>등락</th>' : '<th>날짜</th><th>사용량 (kWh)</th><th>등락</th>';

    renderDailyChart();
    renderMonthlyChart();
    renderUsageList();
    updatePrediction();
};

const updatePrediction = () => {
    const currentMonthStr = "2026-03";
    const lastYearMonthStr = "2025-03";
    const yearBeforeLastMonthStr = "2024-03";

    const currentMonthData = currentData.filter(d => d.date.startsWith(currentMonthStr));
    const currentSum = currentMonthData.reduce((acc, cur) => acc + cur.usage, 0);
    const daysPassed = currentMonthData.length;
    const totalDaysInMonth = 31;

    document.getElementById('current-month-sum').textContent = `${currentSum.toFixed(1)} kWh`;
    
    if (daysPassed > 0) {
        const predicted = (currentSum / daysPassed) * totalDaysInMonth;
        document.getElementById('predicted-month-total').textContent = `${predicted.toFixed(1)} kWh`;
    } else {
        document.getElementById('predicted-month-total').textContent = "- kWh";
    }

    const calculateMonthlySum = (monthStr) => {
        const monthData = currentData.filter(d => d.date.startsWith(monthStr));
        return monthData.reduce((acc, cur) => acc + cur.usage, 0);
    };

    const lastYearSum = calculateMonthlySum(lastYearMonthStr);
    const yearBeforeLastSum = calculateMonthlySum(yearBeforeLastMonthStr);

    document.getElementById('last-year-month-sum').textContent = lastYearSum > 0 ? `${lastYearSum.toFixed(1)} kWh` : "- kWh";
    document.getElementById('year-before-last-month-sum').textContent = yearBeforeLastSum > 0 ? `${yearBeforeLastSum.toFixed(1)} kWh` : "- kWh";
};

const drawYAxisAndGrid = (wrapperId, yAxisId, maxUsage) => {
    const yAxis = document.getElementById(yAxisId);
    const wrapper = document.getElementById(wrapperId);
    yAxis.innerHTML = '';
    wrapper.querySelectorAll('.grid-line').forEach(el => el.remove());

    const step = maxUsage > 100 ? 50 : (maxUsage > 30 ? 10 : 2);
    const maxVal = Math.ceil(maxUsage / step) * step;
    const stepsCount = maxVal / step;

    for (let i = 0; i <= stepsCount; i++) {
        const val = i * step;
        const label = document.createElement('div');
        label.innerHTML = (i === stepsCount) ? `${val}<br>(kWh)` : val;
        yAxis.appendChild(label);

        const line = document.createElement('div');
        line.className = 'grid-line';
        const bottomPos = (val / maxVal) * 200 + 50; 
        line.style.bottom = `${bottomPos}px`;
        wrapper.appendChild(line);
    }
    return maxVal;
};

const setupDragScroll = (containerId) => {
    const slider = document.getElementById(containerId);
    let isDown = false;
    let startX;
    let scrollLeft;

    slider.addEventListener('mousedown', (e) => {
        isDown = true;
        slider.classList.add('active');
        startX = e.pageX - slider.offsetLeft;
        scrollLeft = slider.scrollLeft;
        slider.style.scrollBehavior = 'auto';
    });
    slider.addEventListener('mouseleave', () => {
        isDown = false;
        slider.classList.remove('active');
    });
    slider.addEventListener('mouseup', () => {
        isDown = false;
        slider.classList.remove('active');
        slider.style.scrollBehavior = 'smooth';
    });
    slider.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - slider.offsetLeft;
        const walk = (x - startX) * 2; 
        slider.scrollLeft = scrollLeft - walk;
    });
};

const renderDailyChart = () => {
    const container = document.getElementById('daily-chart');
    const summaryContainer = document.getElementById('daily-summary');
    
    let filteredData = [...currentData];
    const currentYear = "2026";
    const currentMonth = "2026-03";
    const lastMonth = "2026-02";

    if (dailyFilter === '40days') {
        filteredData = filteredData.slice(-40);
    } else if (dailyFilter === 'thismonth') {
        filteredData = filteredData.filter(d => d.date.startsWith(currentMonth));
    } else if (dailyFilter === 'lastmonth') {
        filteredData = filteredData.filter(d => d.date.startsWith(lastMonth));
    } else if (dailyFilter === 'thisyear') {
        filteredData = filteredData.filter(d => d.date.startsWith(currentYear));
    }

    if (filteredData.length === 0) {
        container.innerHTML = '<div class="analysis-empty">해당 기간의 데이터가 없습니다.</div>';
        summaryContainer.innerHTML = '';
        return;
    }

    const usages = filteredData.map(d => d.usage);
    const maxUsage = Math.max(...usages);
    const minUsage = Math.min(...usages);
    const maxDay = filteredData.find(d => d.usage === maxUsage).date;
    const minDay = filteredData.find(d => d.usage === minUsage).date;

    summaryContainer.innerHTML = `
        <div>최대: <span class="summary-max">${maxUsage.toFixed(1)} kWh</span> (${maxDay})</div>
        <div>최소: <span class="summary-min">${minUsage.toFixed(1)} kWh</span> (${minDay})</div>
    `;

    const maxVal = drawYAxisAndGrid('daily-wrapper', 'daily-y-axis', maxUsage);
    container.querySelectorAll('.bar').forEach(el => el.remove());

    filteredData.forEach((item, index) => {
        const bar = document.createElement('div');
        bar.className = 'bar';
        if (item.usage === maxUsage) bar.classList.add('max');
        if (item.usage === minUsage) bar.classList.add('min');

        const height = (item.usage / maxVal) * 200;
        bar.style.height = `${height}px`;
        bar.title = `${item.date}: ${item.usage}kWh`;
        
        const valLabel = document.createElement('div');
        valLabel.className = 'value-label';
        valLabel.innerHTML = `<span>${item.usage}</span>`;
        bar.appendChild(valLabel);

        const label = document.createElement('div');
        label.className = 'bar-label';
        const [y, m, d] = item.date.split('-');
        label.innerHTML = `${m}/${d}<br>${y}`;
        bar.appendChild(label);
        container.appendChild(bar);
    });
};

const renderMonthlyChart = () => {
    const container = document.getElementById('monthly-chart');
    const summaryContainer = document.getElementById('monthly-summary');
    
    const monthlyMap = {};
    currentData.forEach(item => {
        const month = item.date.substring(0, 7);
        monthlyMap[month] = (monthlyMap[month] || 0) + item.usage;
    });

    let months = Object.keys(monthlyMap).sort();
    const currentYear = "2026";
    const lastYear = "2025";

    if (monthlyFilter === '13months') {
        months = months.slice(-13);
    } else if (monthlyFilter === 'thisyear') {
        months = months.filter(m => m.startsWith(currentYear));
    } else if (monthlyFilter === 'lastyear') {
        months = months.filter(m => m.startsWith(lastYear));
    } else if (monthlyFilter === '26months') {
        months = months.slice(-26);
    }

    if (months.length === 0) {
        container.innerHTML = '<div class="analysis-empty">해당 기간의 데이터가 없습니다.</div>';
        summaryContainer.innerHTML = '';
        return;
    }

    const usages = months.map(m => monthlyMap[m]);
    const maxUsage = Math.max(...usages);
    const minUsage = Math.min(...usages);
    const maxMonth = months.find(m => monthlyMap[m] === maxUsage);
    const minMonth = months.find(m => monthlyMap[m] === minUsage);

    summaryContainer.innerHTML = `
        <div>최대: <span class="summary-max">${maxUsage.toFixed(1)} kWh</span> (${maxMonth})</div>
        <div>최소: <span class="summary-min">${minUsage.toFixed(1)} kWh</span> (${minMonth})</div>
    `;

    const maxVal = drawYAxisAndGrid('monthly-wrapper', 'monthly-y-axis', maxUsage);
    container.querySelectorAll('.bar').forEach(el => el.remove());

    months.forEach((month) => {
        const usage = monthlyMap[month];
        const bar = document.createElement('div');
        bar.className = 'bar';
        if (usage === maxUsage) bar.classList.add('max');
        if (usage === minUsage) bar.classList.add('min');

        const height = (usage / maxVal) * 200;
        bar.style.height = `${height}px`;
        bar.title = `${month}: ${usage.toFixed(1)}kWh`;

        const valLabel = document.createElement('div');
        valLabel.className = 'value-label';
        valLabel.innerHTML = `<span>${usage.toFixed(1)}</span>`;
        bar.appendChild(valLabel);

        const label = document.createElement('div');
        label.className = 'bar-label';
        const [y, m] = month.split('-');
        label.innerHTML = `${m}월<br>${y}`;
        bar.appendChild(label);
        container.appendChild(bar);
    });
};

const getMonthlyData = () => {
    const monthlyMap = {};
    currentData.forEach(item => {
        const month = item.date.substring(0, 7);
        monthlyMap[month] = (monthlyMap[month] || 0) + item.usage;
    });
    return monthlyMap;
};

const renderUsageList = () => {
    const tbody = document.getElementById('usage-list-body');
    tbody.innerHTML = '';
    
    const currentYear = "2026";
    const currentMonth = "2026-03";
    const lastMonth = "2026-02";
    const lastYear = "2025";

    if (currentTab === 'daily') {
        let sortedData = [...currentData].sort((a, b) => a.date.localeCompare(b.date));
        const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
        
        // 필터 적용
        if (listFilter === '40days') {
            sortedData = sortedData.slice(-40);
        } else if (listFilter === 'thismonth') {
            sortedData = sortedData.filter(d => d.date.startsWith(currentMonth));
        } else if (listFilter === 'lastmonth') {
            sortedData = sortedData.filter(d => d.date.startsWith(lastMonth));
        } else if (listFilter === 'thisyear') {
            sortedData = sortedData.filter(d => d.date.startsWith(currentYear));
        } else if (listFilter === 'lastyear') {
            sortedData = sortedData.filter(d => d.date.startsWith(lastYear));
        } else if (listFilter === '2years') {
            sortedData = sortedData.slice(-730); // 약 2년치 데이터
        }

        sortedData.forEach((item, index) => {
            let variationHtml = '<span class="variation same">-</span>';
            // 원본 데이터 기준으로 등락 계산을 위해 index 대신 실제 데이터 배열에서 찾기
            const realIndex = FIXED_DATA.findIndex(d => d.date === item.date);
            if (realIndex > 0) {
                const diff = (item.usage - FIXED_DATA[realIndex-1].usage).toFixed(1);
                if (diff > 0) variationHtml = `<span class="variation up">▲${diff}</span>`;
                else if (diff < 0) variationHtml = `<span class="variation down">▼${Math.abs(diff)}</span>`;
            }
            
            const dateObj = new Date(item.date);
            const dayOfWeek = dateObj.getDay(); 
            const dayName = weekDays[dayOfWeek];
            const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
            const dateStyle = isWeekend ? 'color: var(--up-color);' : '';
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="date-col" style="${dateStyle}">${item.date} (${dayName})</td>
                <td><span class="usage-val">${item.usage.toFixed(1)}</span></td>
                <td>${variationHtml}</td>
            `;
            tbody.prepend(tr); 
        });
    } else {
        const monthlyMap = getMonthlyData();
        let sortedMonths = Object.keys(monthlyMap).sort((a, b) => a.localeCompare(b));
        
        // 필터 적용
        if (listFilter === '40days') {
            sortedMonths = sortedMonths.slice(-2); // 40일은 약 2개월
        } else if (listFilter === 'thismonth') {
            sortedMonths = sortedMonths.filter(m => m === currentMonth);
        } else if (listFilter === 'lastmonth') {
            sortedMonths = sortedMonths.filter(m => m === lastMonth);
        } else if (listFilter === 'thisyear') {
            sortedMonths = sortedMonths.filter(m => m.startsWith(currentYear));
        } else if (listFilter === 'lastyear') {
            sortedMonths = sortedMonths.filter(m => m.startsWith(lastYear));
        } else if (listFilter === '2years') {
            sortedMonths = sortedMonths.slice(-24);
        }

        sortedMonths.forEach((month, index) => {
            let variationHtml = '<span class="variation same">-</span>';
            const allMonths = Object.keys(monthlyMap).sort((a, b) => a.localeCompare(b));
            const realIndex = allMonths.indexOf(month);
            
            if (realIndex > 0) {
                const diff = (monthlyMap[month] - monthlyMap[allMonths[realIndex-1]]).toFixed(1);
                if (diff > 0) variationHtml = `<span class="variation up">▲${diff}</span>`;
                else if (diff < 0) variationHtml = `<span class="variation down">▼${Math.abs(diff)}</span>`;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="date-col">${month}</td>
                <td><span class="usage-val">${monthlyMap[month].toFixed(1)}</span></td>
                <td>${variationHtml}</td>
            `;
            tbody.prepend(tr);
        });
    }
};

// 초기화 시 상태 로드
window.addEventListener('load', async () => {
    await loadState();
    if (!sessionStorage.getItem('energyTrackerMeta')) {
        updateUI();
    }
});

setupDragScroll('daily-chart');
setupDragScroll('monthly-chart');
