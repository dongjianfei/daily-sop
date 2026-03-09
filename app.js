// ===== 应用主逻辑 =====

(function() {
    'use strict';

    // ===== 工具函数 =====
    function getToday() {
        return new Date().toISOString().split('T')[0];
    }

    function getDateKey(date) {
        if (typeof date === 'string') return date;
        return date.toISOString().split('T')[0];
    }

    function formatDateChinese(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${weekdays[d.getDay()]}`;
    }

    function formatMonthChinese(year, month) {
        return `${year}年${month}月`;
    }

    function timeToMinutes(timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }

    function getCurrentMinutes() {
        const now = new Date();
        return now.getHours() * 60 + now.getMinutes();
    }

    // ===== 存储管理 =====
    const Storage = {
        COMPLETION_PREFIX: 'sop_completion_',
        THEME_KEY: 'sop_theme',
        NOTIF_DISMISSED: 'sop_notif_dismissed',
        LAST_RESET_DATE: 'sop_last_reset_date',

        getCompletionKey(dateStr) {
            return this.COMPLETION_PREFIX + dateStr;
        },

        getCompletion(dateStr) {
            const key = this.getCompletionKey(dateStr);
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : {};
        },

        setCompletion(dateStr, itemId, completed) {
            const key = this.getCompletionKey(dateStr);
            const data = this.getCompletion(dateStr);
            data[itemId] = completed;
            localStorage.setItem(key, JSON.stringify(data));
        },

        getTheme() {
            return localStorage.getItem(this.THEME_KEY) || 'dark';
        },

        setTheme(theme) {
            localStorage.setItem(this.THEME_KEY, theme);
        },

        isNotifDismissed() {
            return localStorage.getItem(this.NOTIF_DISMISSED) === 'true';
        },

        setNotifDismissed() {
            localStorage.setItem(this.NOTIF_DISMISSED, 'true');
        },

        // 检查并执行每日重置
        checkDailyReset() {
            const lastReset = localStorage.getItem(this.LAST_RESET_DATE);
            const today = getToday();
            if (lastReset !== today) {
                // 新的一天，标记重置日期（旧数据保留用于统计）
                localStorage.setItem(this.LAST_RESET_DATE, today);
            }
        },

        // 获取有数据的所有日期
        getAllDatesWithData() {
            const dates = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.COMPLETION_PREFIX)) {
                    const dateStr = key.replace(this.COMPLETION_PREFIX, '');
                    dates.push(dateStr);
                }
            }
            return dates.sort();
        },

        // 清理超过半年的数据
        cleanOldData() {
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            const cutoff = getDateKey(sixMonthsAgo);

            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.COMPLETION_PREFIX)) {
                    const dateStr = key.replace(this.COMPLETION_PREFIX, '');
                    if (dateStr < cutoff) {
                        localStorage.removeItem(key);
                    }
                }
            }
        }
    };

    // ===== 主题管理 =====
    const ThemeManager = {
        init() {
            const theme = Storage.getTheme();
            this.apply(theme);
            document.getElementById('themeToggle').addEventListener('click', () => {
                const current = Storage.getTheme();
                const next = current === 'dark' ? 'light' : 'dark';
                this.apply(next);
                Storage.setTheme(next);
            });
        },

        apply(theme) {
            document.documentElement.setAttribute('data-theme', theme);
            document.getElementById('themeToggle').textContent = theme === 'dark' ? '☀️' : '🌙';
        }
    };

    // ===== 导航管理 =====
    const NavManager = {
        init() {
            const btns = document.querySelectorAll('.nav-btn');
            btns.forEach(btn => {
                btn.addEventListener('click', () => {
                    btns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    document.querySelectorAll('.tab-content').forEach(tab => {
                        tab.classList.remove('active');
                    });
                    const tabId = 'tab-' + btn.dataset.tab;
                    document.getElementById(tabId).classList.add('active');

                    // 切换到统计页面时刷新
                    if (btn.dataset.tab === 'stats') {
                        StatsManager.render();
                    }
                });
            });
        }
    };

    // ===== SOP时间线管理 =====
    const SOPManager = {
        init() {
            this.renderDate();
            this.renderTimeline();
            this.updateCurrentState();
            // 每分钟更新状态
            setInterval(() => this.updateCurrentState(), 60000);
        },

        renderDate() {
            document.getElementById('currentDate').textContent = formatDateChinese(getToday());
        },

        renderTimeline() {
            const container = document.getElementById('timeline');
            const today = getToday();
            const completion = Storage.getCompletion(today);

            container.innerHTML = SOP_ITEMS.map(item => {
                const isChecked = completion[item.id] === true;
                const detailHtml = item.detail.replace(/\n/g, '<br>');

                return `
                <div class="timeline-item" data-id="${item.id}" data-time="${item.time}">
                    <div class="timeline-dot"></div>
                    <div class="timeline-card">
                        <div class="card-header">
                            <span class="card-time">${item.icon} ${item.time}</span>
                            <span class="card-title">${item.title}</span>
                            <button class="card-check ${isChecked ? 'checked' : ''}" data-id="${item.id}" title="标记完成">✓</button>
                        </div>
                        <div class="card-expand-hint">点击展开详情 ▾</div>
                        <div class="card-detail">
                            <span class="science-tag">🔬 ${item.scienceTag}</span>
                            <p>${detailHtml}</p>
                        </div>
                    </div>
                </div>`;
            }).join('');

            // 绑定事件
            container.querySelectorAll('.card-check').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = btn.dataset.id;
                    const isNowChecked = !btn.classList.contains('checked');
                    btn.classList.toggle('checked');
                    Storage.setCompletion(today, id, isNowChecked);
                    this.updateCurrentState();
                });
            });

            container.querySelectorAll('.timeline-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    if (e.target.closest('.card-check')) return;
                    const detail = card.querySelector('.card-detail');
                    const hint = card.querySelector('.card-expand-hint');
                    detail.classList.toggle('open');
                    hint.textContent = detail.classList.contains('open') ? '点击收起 ▴' : '点击展开详情 ▾';
                });
            });
        },

        updateCurrentState() {
            const now = getCurrentMinutes();
            const today = getToday();
            const completion = Storage.getCompletion(today);
            const items = document.querySelectorAll('.timeline-item');

            let currentIndex = -1;
            const sortedTimes = SOP_ITEMS.map((item, i) => ({ index: i, minutes: timeToMinutes(item.time) }));

            // 找到当前时段
            for (let i = sortedTimes.length - 1; i >= 0; i--) {
                if (now >= sortedTimes[i].minutes) {
                    currentIndex = sortedTimes[i].index;
                    break;
                }
            }

            items.forEach((el, i) => {
                const itemTime = timeToMinutes(SOP_ITEMS[i].time);
                const id = SOP_ITEMS[i].id;
                const isCompleted = completion[id] === true;

                el.classList.remove('is-current', 'is-past', 'is-completed');

                if (isCompleted) {
                    el.classList.add('is-completed');
                } else if (i === currentIndex) {
                    el.classList.add('is-current');
                } else if (now > itemTime) {
                    el.classList.add('is-past');
                }
            });

            // 更新进度条
            const completedCount = SOP_ITEMS.filter(item => completion[item.id] === true).length;
            const total = SOP_ITEMS.length;
            const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
            document.getElementById('progressFill').style.width = pct + '%';
            document.getElementById('progressText').textContent = `${completedCount}/${total} 完成 (${pct}%)`;

            // 自动滚动到当前时段
            if (currentIndex >= 0) {
                const currentEl = items[currentIndex];
                if (currentEl && !currentEl.classList.contains('is-completed')) {
                    setTimeout(() => {
                        currentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 500);
                }
            }
        }
    };

    // ===== 通知管理 =====
    const NotificationManager = {
        notifiedItems: new Set(),

        init() {
            if (!('Notification' in window)) return;

            if (Notification.permission === 'default' && !Storage.isNotifDismissed()) {
                document.getElementById('notificationPrompt').style.display = 'block';

                document.getElementById('enableNotification').addEventListener('click', () => {
                    Notification.requestPermission().then(permission => {
                        document.getElementById('notificationPrompt').style.display = 'none';
                        if (permission === 'granted') {
                            this.startChecking();
                        }
                    });
                });

                document.getElementById('dismissNotification').addEventListener('click', () => {
                    document.getElementById('notificationPrompt').style.display = 'none';
                    Storage.setNotifDismissed();
                });
            } else if (Notification.permission === 'granted') {
                this.startChecking();
            }
        },

        startChecking() {
            this.check();
            setInterval(() => this.check(), 60000); // 每分钟检查
        },

        check() {
            const now = getCurrentMinutes();
            const today = getToday();
            const completion = Storage.getCompletion(today);

            SOP_ITEMS.forEach(item => {
                const itemMinutes = timeToMinutes(item.time);
                const notifKey = today + '_' + item.id;

                // 提前5分钟提醒，或者正好到时间
                if ((now === itemMinutes - 5 || now === itemMinutes) && !this.notifiedItems.has(notifKey) && !completion[item.id]) {
                    this.send(item, now === itemMinutes - 5 ? '即将开始' : '现在开始');
                    this.notifiedItems.add(notifKey);
                }
            });
        },

        send(item, prefix) {
            if (Notification.permission !== 'granted') return;
            try {
                new Notification(`${item.icon} ${prefix}：${item.time}`, {
                    body: item.title,
                    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⚡</text></svg>',
                    tag: item.id,
                    requireInteraction: false
                });
            } catch (e) {
                // 静默失败
            }
        }
    };

    // ===== 统计管理 =====
    const StatsManager = {
        mode: 'daily', // 'daily' or 'monthly'
        selectedDate: getToday(),
        selectedYear: new Date().getFullYear(),
        selectedMonth: new Date().getMonth() + 1,

        init() {
            // 模式切换
            document.querySelectorAll('.stats-mode-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.stats-mode-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.mode = btn.dataset.mode;
                    this.renderSelector();
                    this.renderContent();
                });
            });

            this.renderSelector();
            this.renderContent();
        },

        render() {
            this.renderSelector();
            this.renderContent();
        },

        renderSelector() {
            const container = document.getElementById('statsSelector');

            if (this.mode === 'daily') {
                // 日期选择器
                const sixMonthsAgo = new Date();
                sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                const minDate = getDateKey(sixMonthsAgo);
                const maxDate = getToday();

                container.innerHTML = `
                    <input type="date" id="dailyDatePicker" value="${this.selectedDate}" min="${minDate}" max="${maxDate}">
                `;

                document.getElementById('dailyDatePicker').addEventListener('change', (e) => {
                    this.selectedDate = e.target.value;
                    this.renderContent();
                });
            } else {
                // 月份选择器
                const now = new Date();
                const options = [];
                for (let i = 0; i < 6; i++) {
                    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    const year = d.getFullYear();
                    const month = d.getMonth() + 1;
                    const label = formatMonthChinese(year, month);
                    const value = `${year}-${String(month).padStart(2, '0')}`;
                    const selected = (year === this.selectedYear && month === this.selectedMonth) ? 'selected' : '';
                    options.push(`<option value="${value}" ${selected}>${label}</option>`);
                }

                container.innerHTML = `
                    <select id="monthPicker">${options.join('')}</select>
                `;

                document.getElementById('monthPicker').addEventListener('change', (e) => {
                    const [y, m] = e.target.value.split('-').map(Number);
                    this.selectedYear = y;
                    this.selectedMonth = m;
                    this.renderContent();
                });
            }
        },

        renderContent() {
            const container = document.getElementById('statsContent');

            if (this.mode === 'daily') {
                this.renderDailyView(container);
            } else {
                this.renderMonthlyView(container);
            }
        },

        renderDailyView(container) {
            const dateStr = this.selectedDate;
            const completion = Storage.getCompletion(dateStr);
            const hasAnyData = Object.keys(completion).length > 0;

            if (!hasAnyData) {
                container.innerHTML = `
                    <div class="no-data">
                        <div class="no-data-icon">📭</div>
                        <p>${formatDateChinese(dateStr)}</p>
                        <p>该日期暂无记录数据</p>
                    </div>`;
                return;
            }

            const completedCount = SOP_ITEMS.filter(item => completion[item.id] === true).length;
            const total = SOP_ITEMS.length;
            const rate = Math.round((completedCount / total) * 100);

            let itemsHtml = SOP_ITEMS.map(item => {
                const done = completion[item.id] === true;
                return `
                <div class="stats-item">
                    <div class="stats-item-status ${done ? 'completed' : 'missed'}">${done ? '✓' : '✗'}</div>
                    <span class="stats-item-time">${item.time}</span>
                    <span class="stats-item-title">${item.icon} ${item.title}</span>
                </div>`;
            }).join('');

            container.innerHTML = `
                <div class="stats-daily-header">
                    <h2>${formatDateChinese(dateStr)}</h2>
                    <div class="stats-rate">${rate}%</div>
                    <div class="stats-rate-label">完成率（${completedCount}/${total}项）</div>
                </div>
                <div class="stats-item-list">${itemsHtml}</div>`;
        },

        renderMonthlyView(container) {
            const year = this.selectedYear;
            const month = this.selectedMonth;
            const daysInMonth = new Date(year, month, 0).getDate();
            const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0=Sun
            const today = getToday();
            const todayDate = new Date(today + 'T00:00:00');

            // 收集每天的数据
            const dailyData = [];
            let totalCompleted = 0;
            let totalItems = 0;
            const itemMissCount = {}; // 记录每个item在本月被miss的次数
            const itemTotalCount = {}; // 记录每个item在本月有数据的天数

            SOP_ITEMS.forEach(item => {
                itemMissCount[item.id] = 0;
                itemTotalCount[item.id] = 0;
            });

            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dateObj = new Date(dateStr + 'T00:00:00');
                const isFuture = dateObj > todayDate;
                const completion = Storage.getCompletion(dateStr);
                const hasData = Object.keys(completion).length > 0;

                let dayCompleted = 0;
                let dayTotal = SOP_ITEMS.length;

                if (hasData && !isFuture) {
                    SOP_ITEMS.forEach(item => {
                        if (completion[item.id] === true) {
                            dayCompleted++;
                        } else {
                            itemMissCount[item.id]++;
                        }
                        itemTotalCount[item.id]++;
                    });
                    totalCompleted += dayCompleted;
                    totalItems += dayTotal;
                }

                dailyData.push({
                    day,
                    dateStr,
                    isFuture,
                    hasData: hasData && !isFuture,
                    completed: dayCompleted,
                    total: dayTotal,
                    rate: hasData && !isFuture ? Math.round((dayCompleted / dayTotal) * 100) : null
                });
            }

            const overallRate = totalItems > 0 ? Math.round((totalCompleted / totalItems) * 100) : 0;
            const daysWithData = dailyData.filter(d => d.hasData).length;

            // 月度总览
            let html = `
                <div class="stats-monthly-summary">
                    <h2>${formatMonthChinese(year, month)}</h2>
                    <div class="stats-rate">${overallRate}%</div>
                    <div class="stats-rate-label">月度总完成率（共${daysWithData}天有记录）</div>
                </div>`;

            // 日历网格
            html += `<div class="stats-calendar-grid">`;
            const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
            weekdays.forEach(w => {
                html += `<div class="calendar-weekday">${w}</div>`;
            });

            // 填充月初空白
            for (let i = 0; i < firstDayOfWeek; i++) {
                html += `<div class="calendar-day empty"></div>`;
            }

            // 填充日期
            dailyData.forEach(d => {
                let classes = 'calendar-day';
                if (d.isFuture) classes += ' is-future';
                if (d.dateStr === today) classes += ' is-today';
                if (d.hasData) {
                    classes += ' has-data';
                    if (d.rate >= 80) classes += ' rate-high';
                    else if (d.rate >= 50) classes += ' rate-mid';
                    else classes += ' rate-low';
                }

                html += `
                    <div class="${classes}" data-date="${d.dateStr}" title="${d.hasData ? d.rate + '%' : '无数据'}">
                        <span class="day-num">${d.day}</span>
                        ${d.hasData ? `<span class="day-rate">${d.rate}%</span>` : ''}
                    </div>`;
            });

            html += `</div>`;

            // 每日完成率列表
            if (daysWithData > 0) {
                html += `<div class="stats-analysis"><h3>📅 每日完成率明细</h3>`;
                dailyData.filter(d => d.hasData).forEach(d => {
                    const rateColor = d.rate >= 80 ? 'var(--success)' : (d.rate >= 50 ? 'var(--accent)' : 'var(--danger)');
                    html += `
                        <div class="stats-item" style="cursor:pointer;" data-goto-date="${d.dateStr}">
                            <span class="stats-item-time" style="min-width:70px;">${month}月${d.day}日</span>
                            <div style="flex:1;">
                                <div style="background:var(--progress-bg);height:8px;border-radius:4px;overflow:hidden;">
                                    <div style="width:${d.rate}%;height:100%;background:${rateColor};border-radius:4px;"></div>
                                </div>
                            </div>
                            <span style="min-width:70px;text-align:right;color:${rateColor};font-weight:600;">${d.rate}% (${d.completed}/${d.total})</span>
                        </div>`;
                });
                html += `</div>`;
            }

            // TOP3改进分析
            if (daysWithData >= 3) {
                const itemStats = SOP_ITEMS.map(item => ({
                    ...item,
                    missed: itemMissCount[item.id],
                    total: itemTotalCount[item.id],
                    missRate: itemTotalCount[item.id] > 0 ? Math.round((itemMissCount[item.id] / itemTotalCount[item.id]) * 100) : 0
                })).filter(item => item.missed > 0).sort((a, b) => b.missRate - a.missRate);

                const top3 = itemStats.slice(0, 3);

                if (top3.length > 0) {
                    html += `
                        <div class="stats-analysis" style="margin-top:24px;">
                            <h3>⚠️ 下月需要重点改进的TOP ${top3.length} 项</h3>`;

                    const tips = {
                        'wake-up': '尝试前一晚将闹钟放在需要走过去才能关掉的位置，强迫自己起床。一旦站起来，顺手拉开窗帘。',
                        'zone2-cardio': '将划船机放在卧室旁边，降低启动阻力。可以从15分钟开始，逐步增加到30分钟。',
                        'shower-supplements-am': '将补剂放在餐桌上最显眼的位置，与早餐绑定，形成触发习惯。',
                        'first-coffee': '在手机上设定09:30闹钟，贴一张便签在咖啡机旁：等到9:30！',
                        'stand-am': '设定10:30手机闹钟，升降桌调到站立高度，至少站1小时。',
                        'lunch': '提前准备好午间补剂（姜黄素+维C/锌），和午餐放在一起。',
                        'nap': '手机定好25分钟闹钟，不要依赖自然醒来。使用眼罩隔绝光线加速入睡。',
                        'stand-pm': '设定15:00手机闹钟。下午是久坐最危险的时段，务必站起来活动。',
                        'dinner': '在餐前回忆顺序：先菜后肉再饭。可以在手机壁纸上写上提醒。',
                        'leave-office': '设定20:00闹钟，到点即走。未完成的工作明天处理，健康优先。',
                        'brain-shutdown': '22:30是大脑关机时间！把手机/电脑设为"专注模式"，屏蔽工作通知。',
                        'supplements-pm': '将镁补剂放在床头柜上，与睡前阅读绑定。看到书就想到吃镁。',
                        'sleep': '提前准备好抱枕和凉爽环境（18-20℃）。23:10是硬性截止时间。'
                    };

                    top3.forEach((item, i) => {
                        html += `
                            <div class="analysis-item">
                                <div class="analysis-item-header">
                                    <span class="analysis-item-rank">TOP ${i + 1}</span>
                                    <span class="analysis-item-rate">未完成率 ${item.missRate}%（${item.missed}/${item.total}天未完成）</span>
                                </div>
                                <div class="analysis-item-title">${item.icon} ${item.time} ${item.title}</div>
                                <div class="analysis-item-tip">💡 改进建议：${tips[item.id] || '请尝试将此项与前一个已养成的习惯绑定，形成"习惯堆叠"。'}</div>
                            </div>`;
                    });

                    html += `</div>`;
                }
            }

            container.innerHTML = html;

            // 绑定日历点击事件（点击某天跳转到日视图）
            container.querySelectorAll('.calendar-day.has-data').forEach(el => {
                el.addEventListener('click', () => {
                    this.mode = 'daily';
                    this.selectedDate = el.dataset.date;
                    document.querySelectorAll('.stats-mode-btn').forEach(b => b.classList.remove('active'));
                    document.querySelector('.stats-mode-btn[data-mode="daily"]').classList.add('active');
                    this.renderSelector();
                    this.renderContent();
                });
            });

            // 绑定每日明细点击事件
            container.querySelectorAll('[data-goto-date]').forEach(el => {
                el.addEventListener('click', () => {
                    this.mode = 'daily';
                    this.selectedDate = el.dataset.gotoDate;
                    document.querySelectorAll('.stats-mode-btn').forEach(b => b.classList.remove('active'));
                    document.querySelector('.stats-mode-btn[data-mode="daily"]').classList.add('active');
                    this.renderSelector();
                    this.renderContent();
                });
            });
        }
    };

    // ===== 参考资料管理 =====
    const ReferenceManager = {
        init() {
            this.renderIntro();
            this.renderAccordion();
            this.bindSearch();
        },

        renderIntro() {
            document.getElementById('referenceIntro').innerHTML = REFERENCE_INTRO;
        },

        renderAccordion() {
            const container = document.getElementById('accordion');
            container.innerHTML = REFERENCE_SECTIONS.map(section => `
                <div class="accordion-item" data-section-id="${section.id}">
                    <div class="accordion-header">
                        <h3>${section.icon} ${section.title}</h3>
                        <span class="accordion-arrow">▶</span>
                    </div>
                    <div class="accordion-body">${section.content}</div>
                </div>
            `).join('');

            container.querySelectorAll('.accordion-header').forEach(header => {
                header.addEventListener('click', () => {
                    const item = header.parentElement;
                    item.classList.toggle('open');
                });
            });
        },

        bindSearch() {
            const input = document.getElementById('searchInput');
            let debounceTimer;

            input.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.search(input.value.trim());
                }, 300);
            });
        },

        search(keyword) {
            const items = document.querySelectorAll('.accordion-item');
            const introEl = document.getElementById('referenceIntro');

            if (!keyword) {
                // 清除搜索，恢复原始内容
                items.forEach(item => {
                    item.classList.remove('hidden');
                    item.classList.remove('open');
                });
                introEl.classList.remove('hidden');
                this.renderIntro();
                this.renderAccordion();
                // 重新绑定事件
                document.querySelectorAll('.accordion-header').forEach(header => {
                    header.addEventListener('click', () => {
                        header.parentElement.classList.toggle('open');
                    });
                });
                return;
            }

            introEl.classList.add('hidden');
            const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');

            items.forEach(item => {
                const body = item.querySelector('.accordion-body');
                const originalHtml = REFERENCE_SECTIONS.find(s => s.id === item.dataset.sectionId)?.content || '';
                const textContent = body.textContent;

                if (textContent.toLowerCase().includes(keyword.toLowerCase())) {
                    item.classList.remove('hidden');
                    item.classList.add('open');
                    // 高亮匹配文本
                    body.innerHTML = this.highlightText(originalHtml, regex);
                } else {
                    item.classList.add('hidden');
                }
            });
        },

        highlightText(html, regex) {
            // 只在文本节点中高亮，不影响HTML标签
            const div = document.createElement('div');
            div.innerHTML = html;

            function walkNodes(node) {
                if (node.nodeType === 3) { // 文本节点
                    const text = node.textContent;
                    if (regex.test(text)) {
                        regex.lastIndex = 0;
                        const span = document.createElement('span');
                        span.innerHTML = text.replace(regex, '<mark>$1</mark>');
                        node.parentNode.replaceChild(span, node);
                    }
                } else if (node.nodeType === 1 && node.tagName !== 'MARK') {
                    Array.from(node.childNodes).forEach(walkNodes);
                }
            }

            Array.from(div.childNodes).forEach(walkNodes);
            return div.innerHTML;
        }
    };

    // ===== 初始化应用 =====
    function init() {
        Storage.checkDailyReset();
        Storage.cleanOldData();
        ThemeManager.init();
        NavManager.init();
        SOPManager.init();
        StatsManager.init();
        ReferenceManager.init();
        NotificationManager.init();
    }

    // DOM加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();