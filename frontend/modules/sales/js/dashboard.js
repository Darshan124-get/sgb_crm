document.addEventListener('DOMContentLoaded', async () => {
    if (!window.requireAuth(['sales', 'admin', 'super-admin', 'whatsapp_manager', 'whatsapp_management_executive'])) return;

    const API_URL = `${window.BASE_URL}/api`;
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Role Detection
    const normRole = (user.role_name || user.role || '').replace(/[-_]/g, ' ').toLowerCase();
    const isWhatsAppExecutive = normRole.includes('whatsapp executive') || normRole.includes('whatsapp_management_executive') || (normRole.includes('whatsapp') && !normRole.includes('manager') && !user.is_manager);
    const isWhatsAppManager = normRole.includes('whatsapp manager') || normRole.includes('whatsapp_manager') || (normRole.includes('whatsapp') && user.is_manager);
    const isWhatsAppRole = isWhatsAppManager || isWhatsAppExecutive;

    const isManager = !isWhatsAppRole && (user.is_manager || normRole.includes('manager') || normRole.includes('admin') || normRole.includes('super'));
    const isTelecaller = !isWhatsAppRole && (normRole.includes('telecaller') || normRole.includes('telecom') || (!isManager && (normRole.includes('sales') || normRole.includes('executive'))));

    // Header & Profile Setup
    const headerBadge = document.getElementById('headerBadge');
    const welcomeEl = document.getElementById('welcomeMessage');
    const welcomeDesc = document.getElementById('welcomeDesc');
    const profileNameEl = document.getElementById('profileName');
    const todayDateEl = document.getElementById('todayDate');
    const deptLabel = document.getElementById('deptLabel');

    if (isWhatsAppRole) {
        if (headerBadge) {
            headerBadge.innerHTML = `<i class="fab fa-whatsapp"></i> ${isWhatsAppExecutive ? 'WHATSAPP EXECUTIVE COMMAND CENTER' : 'WHATSAPP MANAGER COMMAND CENTER'}`;
            headerBadge.style.background = 'rgba(16, 185, 129, 0.15)';
            headerBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
            headerBadge.style.color = '#34d399';
        }
        if (welcomeEl) welcomeEl.textContent = `${user.name || (isWhatsAppExecutive ? 'WhatsApp Executive' : 'WhatsApp Manager')}'s WhatsApp Command Center`;
        if (welcomeDesc) welcomeDesc.textContent = `Real-time WhatsApp communication monitoring, chatbot handoffs, message volume, lead conversions, and team activity analytics.`;
        if (deptLabel) deptLabel.textContent = isWhatsAppExecutive ? `Role: WhatsApp Executive` : `Department: WhatsApp & Communication Management`;

        const mainTitle = document.getElementById('mainChartTitle');
        const mainSub = document.getElementById('mainChartSubtitle');
        if (mainTitle) mainTitle.innerHTML = `<i class="fab fa-whatsapp" style="color:#10b981;"></i> WhatsApp Chat & Lead Conversion Growth Trend`;
        if (mainSub) mainSub.textContent = `Daily tracking of incoming WhatsApp messages vs converted leads over time`;

        const dual1Title = document.getElementById('dualChart1Title');
        const dual1Sub = document.getElementById('dualChart1Subtitle');
        if (dual1Title) dual1Title.innerHTML = `<i class="fas fa-chart-pie" style="color:#8b5cf6;"></i> WhatsApp Chat Status & Handoff Breakdown`;
        if (dual1Sub) dual1Sub.textContent = `Distribution of active WhatsApp chats (Bot Active, Human Handoffs, Follow-up Pending, Converted, Lost)`;

        const dual2Title = document.getElementById('dualChart2Title');
        const dual2Sub = document.getElementById('dualChart2Subtitle');
        if (dual2Title) dual2Title.innerHTML = `<i class="fas fa-bullhorn" style="color:#f59e0b;"></i> Top WhatsApp Campaign Inquiries`;
        if (dual2Sub) dual2Sub.textContent = `Inquiries and orders generated per campaign tag`;

        const tbl1Title = document.getElementById('table1Title');
        const tbl1Sub = document.getElementById('table1Subtitle');
        if (tbl1Title) tbl1Title.innerHTML = `<i class="fab fa-whatsapp" style="color:#25d366;"></i> Recent WhatsApp Conversations & Lead Activity`;
        if (tbl1Sub) tbl1Sub.textContent = `Live feed of recent WhatsApp customer chats, assigned executive, current status, and quick response links`;

        const tbl2Title = document.getElementById('table2Title');
        const tbl2Sub = document.getElementById('table2Subtitle');
        if (tbl2Title) tbl2Title.innerHTML = `<i class="fas fa-users-gear" style="color:#10b981;"></i> WhatsApp Executive Staff Performance`;
        if (tbl2Sub) tbl2Sub.textContent = `Performance breakdown of WhatsApp Executives handling chats, response rates, and sales conversions`;
    } else if (isTelecaller) {
        if (headerBadge) {
            headerBadge.innerHTML = `<i class="fas fa-headset"></i> TELECOM AGENT COMMAND CENTER`;
            headerBadge.style.background = 'rgba(139, 92, 246, 0.15)';
            headerBadge.style.borderColor = 'rgba(139, 92, 246, 0.4)';
            headerBadge.style.color = '#a78bfa';
        }
        if (welcomeEl) welcomeEl.textContent = `${user.name || 'Telecaller'}'s Telecom Dashboard`;
        if (welcomeDesc) welcomeDesc.textContent = `Real-time call productivity, assigned lead status breakdown, follow-ups, and sales conversions.`;
        if (deptLabel) deptLabel.textContent = `Role: Telecalling Executive`;

        // Hide manager specific target bar
        const targetBar = document.getElementById('targetBarContainer');
        const targetLabels = document.getElementById('targetLabelContainer');
        if (targetBar) targetBar.style.display = 'none';
        if (targetLabels) targetLabels.style.display = 'none';

        // Update Section Titles for Telecaller view
        const mainTitle = document.getElementById('mainChartTitle');
        const mainSub = document.getElementById('mainChartSubtitle');
        if (mainTitle) mainTitle.innerHTML = `<i class="fas fa-chart-line" style="color:#10b981;"></i> Call Activity & Lead Conversion Trend`;
        if (mainSub) mainSub.textContent = `Daily tracking of calls made vs connected calls vs converted deals`;

        const dual1Title = document.getElementById('dualChart1Title');
        const dual1Sub = document.getElementById('dualChart1Subtitle');
        if (dual1Title) dual1Title.innerHTML = `<i class="fas fa-chart-pie" style="color:#8b5cf6;"></i> My Assigned Lead Status Breakdown`;
        if (dual1Sub) dual1Sub.textContent = `Distribution of your assigned leads (New, Contacted, In Follow-up, Converted, Lost, Unreachable)`;

        const dual2Title = document.getElementById('dualChart2Title');
        const dual2Sub = document.getElementById('dualChart2Subtitle');
        if (dual2Title) dual2Title.innerHTML = `<i class="fas fa-boxes-stacked" style="color:#f59e0b;"></i> My Products Sold Share`;
        if (dual2Sub) dual2Sub.textContent = `Units sold and gross revenue generated from your converted leads`;

        const tbl1Title = document.getElementById('table1Title');
        const tbl1Sub = document.getElementById('table1Subtitle');
        const tbl1Search = document.getElementById('telecallerSearch');
        if (tbl1Title) tbl1Title.innerHTML = `<i class="fas fa-list-check" style="color:#6366f1;"></i> My Assigned Leads & Recent Call Activity`;
        if (tbl1Sub) tbl1Sub.textContent = `Live list of leads assigned to you with call status, next follow-up date, and quick action buttons.`;
        if (tbl1Search) tbl1Search.placeholder = `Search assigned leads...`;

        const tbl1Thead = document.getElementById('table1Thead');
        if (tbl1Thead) {
            tbl1Thead.innerHTML = `
                <th style="padding:0.9rem 1.25rem;text-align:left;">Lead / Customer Name</th>
                <th style="padding:0.9rem 1rem;text-align:left;">Phone & City</th>
                <th style="padding:0.9rem 1rem;text-align:center;">Current Status</th>
                <th style="padding:0.9rem 1rem;text-align:center;">Assigned / Last Activity</th>
                <th style="padding:0.9rem 1rem;text-align:center;">Next Follow-up</th>
                <th style="padding:0.9rem 1.25rem;text-align:center;">Quick Actions</th>
            `;
        }

        const tbl2Title = document.getElementById('table2Title');
        const tbl2Sub = document.getElementById('table2Subtitle');
        if (tbl2Title) tbl2Title.innerHTML = `<i class="fas fa-award" style="color:#10b981;"></i> My Closed Orders & Product Sales`;
        if (tbl2Sub) tbl2Sub.textContent = `Top products sold by you in the selected period.`;
    } else {
        if (welcomeEl) welcomeEl.textContent = `${user.name || 'Sales Manager'}'s Command Center`;
    }

    if (profileNameEl) profileNameEl.textContent = user.name || (isTelecaller ? 'Telecaller' : 'Sales Manager');

    if (todayDateEl) {
        todayDateEl.textContent = new Date().toLocaleDateString('en-IN', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    // State Variables
    let currentDashboardData = null;
    let currentTelecallerData = null;
    let myAssignedLeads = [];
    let activeMainChartTab = 'revenue';
    let revenueChartInstance = null;
    let telecallerChartInstance = null;
    let productChartInstance = null;

    // Filter Controls
    const customDateRange = document.getElementById('customDateRange');
    const filterStartDate = document.getElementById('filterStartDate');
    const filterEndDate = document.getElementById('filterEndDate');
    const btnApplyCustomDate = document.getElementById('btnApplyCustomDate');
    const btnRefreshData = document.getElementById('btnRefreshData');

    // Helper: Local Date to YYYY-MM-DD
    function toLocalYMD(dateObj) {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // Default Date Range = Current Month (MTD)
    const now = new Date();
    const firstDayStr = toLocalYMD(new Date(now.getFullYear(), now.getMonth(), 1));
    const todayStr = toLocalYMD(now);

    if (filterStartDate) filterStartDate.value = firstDayStr;
    if (filterEndDate) filterEndDate.value = todayStr;

    // Period Buttons Click Handler
    document.querySelectorAll('.sm-period-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.sm-period-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const period = e.currentTarget.getAttribute('data-period');
            
            if (period === 'custom') {
                if (customDateRange) customDateRange.style.display = 'flex';
            } else {
                if (customDateRange) customDateRange.style.display = 'none';
                const { start, end } = getDateRangeFromPeriod(period);
                loadDashboardData(start, end);
            }
        });
    });

    if (btnApplyCustomDate) {
        btnApplyCustomDate.addEventListener('click', () => {
            const start = filterStartDate?.value || firstDayStr;
            const end = filterEndDate?.value || todayStr;
            loadDashboardData(start, end);
        });
    }

    if (btnRefreshData) {
        btnRefreshData.addEventListener('click', () => {
            const activePeriodBtn = document.querySelector('.sm-period-btn.active');
            const period = activePeriodBtn ? activePeriodBtn.getAttribute('data-period') : 'this_month';
            const { start, end } = getDateRangeFromPeriod(period);
            loadDashboardData(start, end);
        });
    }

    // Main Chart Tab Switching
    document.querySelectorAll('.chart-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.chart-tab-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            activeMainChartTab = e.currentTarget.getAttribute('data-chart');
            renderRevenueTrendChart(currentDashboardData);
        });
    });

    // Telecaller Table Search Filter
    const telecallerSearchInput = document.getElementById('telecallerSearch');
    if (telecallerSearchInput) {
        telecallerSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            filterTableRows(query);
        });
    }

    function getDateRangeFromPeriod(period = 'this_month') {
        const d = new Date();
        const currentToday = toLocalYMD(d);
        let start = '', end = currentToday;

        if (period === 'today') {
            start = currentToday;
            end = currentToday;
        } else if (period === 'yesterday') {
            const y = new Date(d);
            y.setDate(y.getDate() - 1);
            start = toLocalYMD(y);
            end = start;
        } else if (period === 'this_week') {
            const dayOfWeek = d.getDay();
            const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            const mon = new Date(d.setDate(diff));
            start = toLocalYMD(mon);
            end = currentToday;
        } else if (period === 'last_month') {
            const firstOfLast = new Date(d.getFullYear(), d.getMonth() - 1, 1);
            const lastOfLast = new Date(d.getFullYear(), d.getMonth(), 0);
            start = toLocalYMD(firstOfLast);
            end = toLocalYMD(lastOfLast);
        } else if (period === 'custom') {
            start = filterStartDate?.value || firstDayStr;
            end = filterEndDate?.value || todayStr;
        } else {
            // this_month
            start = firstDayStr;
            end = currentToday;
        }
        return { start, end };
    }

    async function loadDashboardData(startDate = firstDayStr, endDate = todayStr) {
        try {
            const dashRes = await fetch(`${API_URL}/reports/dashboard-stats?start_date=${startDate}&end_date=${endDate}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (dashRes.status === 401) {
                window.doLogout();
                return;
            }

            currentDashboardData = await dashRes.json();

            // Fetch telecaller performance endpoint for actual call metrics
            try {
                const teleUrl = isTelecaller 
                    ? `${API_URL}/reports/telecaller-performance?start_date=${startDate}&end_date=${endDate}&telecaller_id=${user.user_id || user.id}`
                    : `${API_URL}/reports/telecaller-performance?start_date=${startDate}&end_date=${endDate}`;
                const teleRes = await fetch(teleUrl, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (teleRes.ok) {
                    currentTelecallerData = await teleRes.json();
                }
            } catch (teleErr) {
                console.warn('Telecaller performance endpoint notice:', teleErr);
                currentTelecallerData = [];
            }

            // Fetch Assigned Leads list for Telecaller
            if (isTelecaller) {
                try {
                    const leadsRes = await fetch(`${API_URL}/leads?assigned_to=${user.user_id || user.id}&limit=100`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (leadsRes.ok) {
                        const leadsData = await leadsRes.json();
                        myAssignedLeads = Array.isArray(leadsData) ? leadsData : (leadsData.leads || []);
                    }
                } catch (lErr) {
                    console.warn('My assigned leads fetch notice:', lErr);
                    myAssignedLeads = [];
                }
            }

            renderKpiCards(currentDashboardData, currentTelecallerData);
            renderPipelineFunnel(currentDashboardData);
            renderRevenueTrendChart(currentDashboardData);
            
            if (isTelecaller) {
                renderTelecallerLeadStatusPieChart(currentDashboardData, myAssignedLeads);
                renderTelecallerLeadsTable(myAssignedLeads);
            } else {
                renderTelecallerBarChart(currentTelecallerData || currentDashboardData?.telecallerPerformance);
                renderTelecallerTable(currentTelecallerData || currentDashboardData?.telecallerPerformance);
            }

            renderProductDoughnutChart(currentDashboardData);
            renderProductSalesTable(currentDashboardData);

        } catch (e) {
            console.error('Dashboard loading error:', e);
        }
    }

    function renderKpiCards(data, teleData) {
        if (!data) return;
        const kpis = data.kpis || {};
        const comp = data.comparison || {};
        const revOverview = data.revenueOverview || {};

        const leadsCount = kpis.newLeads ?? 0;
        const convertedCount = kpis.convertedLeads ?? 0;
        const totalRevenue = kpis.revenueMTD ?? kpis.revenue ?? 0;
        const todayRev = revOverview.today ?? 0;
        const winRate = kpis.conversionRate ?? (leadsCount > 0 ? ((convertedCount / leadsCount) * 100).toFixed(1) : '0.0');

        if (isWhatsAppRole) {
            const wa = data.whatsapp || {};
            const kpi1Title = document.querySelector('.sm-kpi-card:nth-child(1) span');
            if (kpi1Title) kpi1Title.textContent = 'WhatsApp Sales Revenue';
            const totalRevEl = document.getElementById('kpiTotalRevenue');
            if (totalRevEl) totalRevEl.textContent = `₹${Number(totalRevenue).toLocaleString('en-IN')}`;
            const todayRevEl = document.getElementById('kpiTodayRevenue');
            if (todayRevEl) todayRevEl.textContent = `₹${Number(todayRev).toLocaleString('en-IN')}`;
            const revTrendEl = document.getElementById('kpiRevenueTrend');
            if (revTrendEl) {
                const trendText = comp.revenue || '+0.0%';
                revTrendEl.innerHTML = `<i class="fas ${trendText.includes('-') ? 'fa-arrow-down' : 'fa-arrow-up'}"></i> ${trendText}`;
                revTrendEl.className = `sm-badge-trend ${trendText.includes('-') ? 'sm-trend-down' : 'sm-trend-up'}`;
            }

            const kpi2Title = document.querySelector('.sm-kpi-card:nth-child(2) span');
            if (kpi2Title) kpi2Title.textContent = 'Total WhatsApp Leads';
            const leadsEl = document.getElementById('kpiLeadsCount');
            if (leadsEl) leadsEl.textContent = Number(leadsCount).toLocaleString();
            const convEl = document.getElementById('kpiConvertedCount');
            if (convEl) convEl.textContent = Number(convertedCount).toLocaleString();
            const winRateEl = document.getElementById('kpiWinRate');
            if (winRateEl) winRateEl.textContent = `${winRate}% Win Rate`;

            const kpi3Title = document.querySelector('.sm-kpi-card:nth-child(3) span');
            if (kpi3Title) kpi3Title.textContent = 'Messages Received & Sent';
            const callsConnEl = document.getElementById('kpiCallsConnected');
            if (callsConnEl) callsConnEl.textContent = Number(wa.received || 0).toLocaleString();
            const connRateEl = document.getElementById('kpiConnectionRate');
            if (connRateEl) connRateEl.textContent = `${wa.readRate || 95}% Read Rate`;
            const activeRepsEl = document.getElementById('kpiActiveReps');
            if (activeRepsEl) activeRepsEl.textContent = wa.sent || 0;

            const kpi4Title = document.querySelector('.sm-kpi-card:nth-child(4) span');
            if (kpi4Title) kpi4Title.textContent = 'Unread & Pending Chats';
            const avgDealEl = document.getElementById('kpiAvgDealValue');
            if (avgDealEl) avgDealEl.textContent = Number(wa.unread || 0).toLocaleString();

            const kpi5Title = document.querySelector('.sm-kpi-card:nth-child(5) span');
            if (kpi5Title) kpi5Title.textContent = 'Bot Handoffs to Humans';
            const urgentEl = document.getElementById('kpiOverdueCount');
            const handoffsCount = data.chatbotHandoffs || Math.round((leadsCount || 0) * 0.35);
            if (urgentEl) urgentEl.textContent = Number(handoffsCount).toLocaleString();
            return;
        }

        if (isTelecaller) {
            // 1. My Assigned Leads
            const kpi1Title = document.getElementById('kpi1Title');
            if (kpi1Title) kpi1Title.textContent = 'My Assigned Leads';

            const totalRevEl = document.getElementById('kpiTotalRevenue');
            if (totalRevEl) totalRevEl.textContent = Number(leadsCount).toLocaleString();

            const revTrendEl = document.getElementById('kpiRevenueTrend');
            if (revTrendEl) {
                revTrendEl.innerHTML = `<i class="fas fa-id-card"></i> Active: ${kpis.activeLeads || 0}`;
                revTrendEl.className = 'sm-badge-trend sm-trend-up';
                revTrendEl.style.background = '#e0e7ff';
                revTrendEl.style.color = '#3730a3';
            }

            const todayRevEl = document.getElementById('kpiTodayRevenue');
            if (todayRevEl) todayRevEl.textContent = `${kpis.activeLeads || 0} In Progress`;

            // 2. Leads & Deals Closed
            const kpi2Title = document.getElementById('kpi2Title');
            if (kpi2Title) kpi2Title.textContent = 'My Deals & Conversions';

            const leadsEl = document.getElementById('kpiLeadsCount');
            if (leadsEl) leadsEl.textContent = Number(leadsCount).toLocaleString();

            const convEl = document.getElementById('kpiConvertedCount');
            if (convEl) convEl.textContent = Number(convertedCount).toLocaleString();

            const winRateEl = document.getElementById('kpiWinRate');
            if (winRateEl) winRateEl.textContent = `${winRate}% Win Rate`;

            const leadsTrendEl = document.getElementById('kpiLeadsTrend');
            if (leadsTrendEl) {
                const trendText = comp.newLeads || '+0.0%';
                leadsTrendEl.innerHTML = `<i class="fas ${trendText.includes('-') ? 'fa-arrow-down' : 'fa-arrow-up'}"></i> ${trendText}`;
                leadsTrendEl.className = `sm-badge-trend ${trendText.includes('-') ? 'sm-trend-down' : 'sm-trend-up'}`;
            }

            // 3. Calls & Connections
            const kpi3Title = document.getElementById('kpi3Title');
            if (kpi3Title) kpi3Title.textContent = 'Calls Done & Connected';

            const callsConnected = parseInt(myRep.calls_connected || 0);
            const callsMade = parseInt(myRep.no_of_calls || 0);
            const connRate = callsMade > 0 ? Math.round((callsConnected / callsMade) * 100) : (leadsCount > 0 ? Math.round((callsConnected / leadsCount) * 100) : 0);

            const callsConnEl = document.getElementById('kpiCallsConnected');
            if (callsConnEl) callsConnEl.textContent = Number(callsConnected).toLocaleString();

            const connRateEl = document.getElementById('kpiConnectionRate');
            if (connRateEl) connRateEl.textContent = `${connRate}% Conn. Rate`;

            const activeRepsEl = document.getElementById('kpi3Subtext');
            if (activeRepsEl) activeRepsEl.innerHTML = `<i class="fas fa-phone-volume" style="color:#8b5cf6;"></i> <strong>${callsMade}</strong> Total Calls Dialed`;

            // 4. Revenue & Products Sold
            const kpi4Title = document.getElementById('kpi4Title');
            if (kpi4Title) kpi4Title.textContent = 'My Revenue & Products Sold';

            const avgDealEl = document.getElementById('kpiAvgDealValue');
            if (avgDealEl) avgDealEl.textContent = `₹${Number(totalRevenue).toLocaleString('en-IN')}`;

            const ordersCountEl = document.getElementById('kpiOrdersCount');
            if (ordersCountEl) ordersCountEl.textContent = Number(kpis.ordersReceived ?? convertedCount).toLocaleString();

            const kpi4Badge = document.getElementById('kpi4Badge');
            if (kpi4Badge) kpi4Badge.textContent = `${myRep.sold_count || convertedCount} Sold`;

            // 5. Urgent Follow-ups
            const kpi5Title = document.getElementById('kpi5Title');
            if (kpi5Title) kpi5Title.textContent = 'Urgent Follow-ups';

            const pendingFollowups = kpis.followupsPending ?? 0;
            const overdueCountEl = document.getElementById('kpiOverdueCount');
            if (overdueCountEl) overdueCountEl.textContent = pendingFollowups;

            const overdueBadge = document.getElementById('overdueBadge');
            if (overdueBadge) overdueBadge.textContent = `${pendingFollowups} Overdue`;

        } else {
            // Manager View Card Setup
            const totalRevEl = document.getElementById('kpiTotalRevenue');
            if (totalRevEl) totalRevEl.textContent = `₹${Number(totalRevenue).toLocaleString('en-IN')}`;

            const todayRevEl = document.getElementById('kpiTodayRevenue');
            if (todayRevEl) todayRevEl.textContent = `₹${Number(todayRev).toLocaleString('en-IN')}`;

            const revTrendEl = document.getElementById('kpiRevenueTrend');
            if (revTrendEl) {
                const trendText = comp.revenue || '+0.0%';
                revTrendEl.innerHTML = `<i class="fas ${trendText.includes('-') ? 'fa-arrow-down' : 'fa-arrow-up'}"></i> ${trendText}`;
                revTrendEl.className = `sm-badge-trend ${trendText.includes('-') ? 'sm-trend-down' : 'sm-trend-up'}`;
            }

            const leadsEl = document.getElementById('kpiLeadsCount');
            if (leadsEl) leadsEl.textContent = Number(leadsCount).toLocaleString();

            const convEl = document.getElementById('kpiConvertedCount');
            if (convEl) convEl.textContent = Number(convertedCount).toLocaleString();

            const winRateEl = document.getElementById('kpiWinRate');
            if (winRateEl) winRateEl.textContent = `${winRate}% Win Rate`;

            const leadsTrendEl = document.getElementById('kpiLeadsTrend');
            if (leadsTrendEl) {
                const trendText = comp.newLeads || '+0.0%';
                leadsTrendEl.innerHTML = `<i class="fas ${trendText.includes('-') ? 'fa-arrow-down' : 'fa-arrow-up'}"></i> ${trendText}`;
                leadsTrendEl.className = `sm-badge-trend ${trendText.includes('-') ? 'sm-trend-down' : 'sm-trend-up'}`;
            }

            // Target Calculation (₹25,00,000 monthly target)
            const targetAmount = 2500000;
            const targetPct = Math.min(100, Math.round((totalRevenue / targetAmount) * 100));
            const targetPctEl = document.getElementById('kpiTargetPct');
            if (targetPctEl) targetPctEl.textContent = `${targetPct}%`;

            const progressBar = document.getElementById('targetProgressBar');
            if (progressBar) progressBar.style.width = `${targetPct}%`;

            const targetAmountEl = document.getElementById('kpiTargetAmount');
            if (targetAmountEl) targetAmountEl.textContent = `₹25L`;

            // Telecaller Calls Summary for Team
            let totalCallsMade = 0;
            let totalCallsConnected = 0;
            let activeRepsCount = 0;

            if (repList.length > 0) {
                activeRepsCount = repList.length;
                repList.forEach(t => {
                    totalCallsMade += parseInt(t.no_of_calls || t.assigned || 0);
                    totalCallsConnected += parseInt(t.calls_connected || t.contacted || 0);
                });
            }

            const connRate = totalCallsMade > 0 ? Math.round((totalCallsConnected / totalCallsMade) * 100) : 0;
            
            const callsConnEl = document.getElementById('kpiCallsConnected');
            if (callsConnEl) callsConnEl.textContent = Number(totalCallsConnected).toLocaleString();

            const connRateEl = document.getElementById('kpiConnectionRate');
            if (connRateEl) connRateEl.textContent = `${connRate}% Conn. Rate`;

            const activeRepsEl = document.getElementById('kpiActiveReps');
            if (activeRepsEl) activeRepsEl.textContent = activeRepsCount;

            const ordersCount = kpis.ordersReceived ?? convertedCount;
            const avgValue = ordersCount > 0 ? Math.round(totalRevenue / ordersCount) : Math.round(revOverview.avgOrderValue || 0);
            
            const avgDealEl = document.getElementById('kpiAvgDealValue');
            if (avgDealEl) avgDealEl.textContent = `₹${avgValue.toLocaleString('en-IN')}`;

            const ordersCountEl = document.getElementById('kpiOrdersCount');
            if (ordersCountEl) ordersCountEl.textContent = Number(ordersCount).toLocaleString();

            const pendingFollowups = kpis.followupsPending ?? 0;
            const overdueCountEl = document.getElementById('kpiOverdueCount');
            if (overdueCountEl) overdueCountEl.textContent = pendingFollowups;

            const overdueBadge = document.getElementById('overdueBadge');
            if (overdueBadge) overdueBadge.textContent = `${pendingFollowups} Overdue`;
        }
    }

    function renderPipelineFunnel(data) {
        const funnel = data?.funnel || [];
        const container = document.getElementById('pipelineFunnelList');
        if (!container) return;

        const stageMap = {
            'new': { label: 'New Unassigned Leads', color: '#3b82f6', count: 0 },
            'assigned': { label: 'Assigned to Telecallers', color: '#8b5cf6', count: 0 },
            'contacted': { label: 'Contacted / Discussion', color: '#06b6d4', count: 0 },
            'followup': { label: 'Follow-up Scheduled', color: '#f59e0b', count: 0 },
            'interested': { label: 'Interested / Negotiation', color: '#ec4899', count: 0 },
            'converted': { label: 'Converted / Orders Closed', color: '#10b981', count: 0 }
        };

        let totalFunnelLeads = 0;
        funnel.forEach(item => {
            const key = item.status ? item.status.toLowerCase() : '';
            const cnt = parseInt(item.count || 0);
            totalFunnelLeads += cnt;
            if (stageMap[key]) {
                stageMap[key].count += cnt;
            } else {
                if (key.includes('call') || key.includes('talk')) stageMap['contacted'].count += cnt;
                else if (key.includes('lost') || key.includes('not')) stageMap['contacted'].count += cnt;
                else stageMap['new'].count += cnt;
            }
        });

        if (totalFunnelLeads === 0) {
            container.innerHTML = `<div style="text-align:center;padding:2rem;color:#94a3b8;font-size:0.85rem;"><i class="fas fa-inbox fa-2x" style="margin-bottom:0.5rem;display:block;"></i>No leads recorded in this period.</div>`;
            return;
        }

        container.innerHTML = Object.keys(stageMap).map(key => {
            const stage = stageMap[key];
            const pct = totalFunnelLeads > 0 ? Math.round((stage.count / totalFunnelLeads) * 100) : 0;
            return `
                <div>
                    <div style="display:flex;justify-content:space-between;font-size:0.8rem;font-weight:600;margin-bottom:0.25rem;">
                        <span style="color:#334155;">${stage.label}</span>
                        <span style="color:#0f172a;font-weight:700;">${stage.count} <span style="font-size:0.75rem;color:#94a3b8;">(${pct}%)</span></span>
                    </div>
                    <div style="height:7px;background:#f1f5f9;border-radius:4px;overflow:hidden;">
                        <div style="width:${pct}%;height:100%;background:${stage.color};border-radius:4px;transition:width 0.6s cubic-bezier(0.4, 0, 0.2, 1);"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderRevenueTrendChart(data) {
        const ctx = document.getElementById('revenueTrendChart');
        if (!ctx) return;

        if (revenueChartInstance) {
            revenueChartInstance.destroy();
        }

        const revTrend = data?.revenueOverview?.trend || [];
        const labels = revTrend.length > 0
            ? revTrend.map(r => new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }))
            : ['Today'];

        const revData = revTrend.length > 0
            ? revTrend.map(r => parseFloat(r.total || 0))
            : [data?.kpis?.revenue || 0];

        if (activeMainChartTab === 'revenue') {
            revenueChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        {
                            label: isTelecaller ? 'My Revenue (₹)' : 'Gross Sales Revenue (₹)',
                            data: revData,
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.12)',
                            borderWidth: 3,
                            tension: 0.35,
                            fill: true,
                            pointRadius: 5,
                            pointBackgroundColor: '#10b981'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'top' },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    return `Revenue: ₹${context.raw.toLocaleString('en-IN')}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: '#f1f5f9' },
                            ticks: {
                                callback: function (val) {
                                    return `₹${val.toLocaleString('en-IN')}`;
                                }
                            }
                        },
                        x: { grid: { display: false } }
                    }
                }
            });
        } else if (activeMainChartTab === 'funnel') {
            const funnelList = data?.funnel || [];
            const labels = funnelList.map(f => f.status ? f.status.toUpperCase() : 'UNKNOWN');
            const counts = funnelList.map(f => f.count || 0);

            revenueChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels.length > 0 ? labels : ['No Data'],
                    datasets: [{
                        label: 'Lead Volume per Stage',
                        data: counts.length > 0 ? counts : [0],
                        backgroundColor: '#6366f1',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
                        x: { grid: { display: false } }
                    }
                }
            });
        } else if (activeMainChartTab === 'products') {
            const topProducts = data?.topProducts || [];
            const prodLabels = topProducts.map(p => p.name);
            const prodData = topProducts.map(p => p.total_qty || 0);

            revenueChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: prodLabels.length > 0 ? prodLabels : ['No Data'],
                    datasets: [{
                        label: 'Units Sold',
                        data: prodData.length > 0 ? prodData : [0],
                        backgroundColor: '#10b981',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
                        x: { grid: { display: false } }
                    }
                }
            });
        }
    }

    function renderTelecallerBarChart(teleData) {
        const ctx = document.getElementById('telecallerBarChart');
        if (!ctx) return;

        if (telecallerChartInstance) {
            telecallerChartInstance.destroy();
        }

        const reps = Array.isArray(teleData) ? teleData : [];

        const names = reps.map(r => r.telecaller || r.name || 'Sales Rep');
        const callsMade = reps.map(r => parseInt(r.no_of_calls || r.assigned || 0));
        const callsConn = reps.map(r => parseInt(r.calls_connected || r.contacted || 0));
        const dealsWon = reps.map(r => parseInt(r.sold_count || r.converted || 0));

        telecallerChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: names.length > 0 ? names : ['No Active Reps'],
                datasets: [
                    {
                        label: 'Calls Made',
                        data: callsMade.length > 0 ? callsMade : [0],
                        backgroundColor: '#cbd5e1',
                        borderRadius: 4
                    },
                    {
                        label: 'Connected Calls',
                        data: callsConn.length > 0 ? callsConn : [0],
                        backgroundColor: '#8b5cf6',
                        borderRadius: 4
                    },
                    {
                        label: 'Deals Closed',
                        data: dealsWon.length > 0 ? dealsWon : [0],
                        backgroundColor: '#10b981',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top' } },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    function renderTelecallerLeadStatusPieChart(data, leadsList) {
        const ctx = document.getElementById('telecallerBarChart');
        if (!ctx) return;

        if (telecallerChartInstance) {
            telecallerChartInstance.destroy();
        }

        const counts = {
            new: 0,
            contacted: 0,
            followup: 0,
            converted: 0,
            lost: 0,
            unreachable: 0
        };

        if (Array.isArray(leadsList) && leadsList.length > 0) {
            leadsList.forEach(l => {
                const s = (l.status || '').toLowerCase();
                if (s === 'new' || s === 'assigned') counts.new++;
                else if (s === 'contacted' || s === 'discussion' || s === 'callback') counts.contacted++;
                else if (s === 'followup' || s === 'interested' || s === 'negotiation') counts.followup++;
                else if (s === 'converted' || s === 'advance_paid' || s === 'dealer_converted') counts.converted++;
                else if (s === 'lost' || s === 'not_interested' || s === 'cancelled') counts.lost++;
                else counts.unreachable++;
            });
        } else if (data?.funnel) {
            (data.funnel || []).forEach(f => {
                const s = (f.status || '').toLowerCase();
                const cnt = parseInt(f.count || 0);
                if (s.includes('new') || s.includes('assigned')) counts.new += cnt;
                else if (s.includes('contact') || s.includes('call')) counts.contacted += cnt;
                else if (s.includes('follow')) counts.followup += cnt;
                else if (s.includes('convert')) counts.converted += cnt;
                else if (s.includes('lost') || s.includes('not')) counts.lost += cnt;
                else counts.unreachable += cnt;
            });
        }

        const labels = ['New / Uncalled', 'Contacted / In Call', 'In Follow-up', 'Converted Deals', 'Lost / Not Interested', 'Unreachable'];
        const chartData = [counts.new, counts.contacted, counts.followup, counts.converted, counts.lost, counts.unreachable];

        telecallerChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: chartData,
                    backgroundColor: ['#3b82f6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#94a3b8'],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return ` ${context.label}: ${context.raw} leads`;
                            }
                        }
                    }
                },
                cutout: '60%'
            }
        });
    }

    function renderProductDoughnutChart(data) {
        const ctx = document.getElementById('productDoughnutChart');
        if (!ctx) return;

        if (productChartInstance) {
            productChartInstance.destroy();
        }

        const topProducts = data?.topProducts || [];
        const labels = topProducts.map(p => p.name);
        const qtyData = topProducts.map(p => parseInt(p.total_qty || 0));

        productChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels.length > 0 ? labels : ['No Sales Recorded'],
                datasets: [{
                    data: qtyData.length > 0 ? qtyData : [1],
                    backgroundColor: labels.length > 0 ? ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899'] : ['#e2e8f0'],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { boxWidth: 14, font: { size: 11 } } },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return ` Units Sold: ${context.raw}`;
                            }
                        }
                    }
                },
                cutout: '65%'
            }
        });
    }

    function renderTelecallerTable(teleData) {
        const tbody = document.getElementById('telecallerTableBody');
        if (!tbody) return;

        const reps = Array.isArray(teleData) ? teleData : [];

        if (reps.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2.5rem;color:#94a3b8;"><i class="fas fa-user-slash fa-2x" style="margin-bottom:0.5rem;display:block;"></i>No telecaller performance data recorded for this date range.</td></tr>`;
            return;
        }

        tbody.innerHTML = reps.map(row => {
            const name = row.telecaller || row.name || 'Sales Rep';
            const assigned = parseInt(row.new_leads_given || row.assigned || 0);
            const callsMade = parseInt(row.no_of_calls || 0);
            const connected = parseInt(row.calls_connected || row.contacted || 0);
            const soldCount = parseInt(row.sold_count || row.converted || 0);
            const soldVal = parseFloat(row.sold_value || 0);

            const connRate = assigned > 0 ? Math.round((connected / assigned) * 100) : (callsMade > 0 ? Math.round((connected / callsMade) * 100) : 0);
            const winRate = assigned > 0 ? ((soldCount / assigned) * 100).toFixed(1) : (connected > 0 ? ((soldCount / connected) * 100).toFixed(1) : '0.0');
            const initials = name.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2);

            const statusLabel = soldCount >= 10 ? 'Top Performer' : (soldCount > 0 ? 'Active' : 'Needs Followup');
            const badgeBg = statusLabel === 'Top Performer' ? '#fef3c7' : (statusLabel === 'Active' ? '#ecfdf5' : '#f8fafc');
            const badgeColor = statusLabel === 'Top Performer' ? '#b45309' : (statusLabel === 'Active' ? '#047857' : '#64748b');

            return `
                <tr class="telecaller-row" data-name="${name.toLowerCase()}">
                    <td style="padding:1rem 1.25rem;">
                        <div style="display:flex;align-items:center;gap:0.75rem;">
                            <div class="avatar-circle">${initials}</div>
                            <div>
                                <div style="font-weight:700;color:#0f172a;font-size:0.9rem;">${name}</div>
                                <div style="font-size:0.75rem;color:#64748b;">Sales Executive / Telecaller</div>
                            </div>
                        </div>
                    </td>
                    <td style="text-align:center;font-weight:700;color:#0f172a;">${assigned}</td>
                    <td style="text-align:center;font-weight:600;color:#334155;">
                        <span style="color:#0f172a;font-weight:700;">${connected}</span> / <span style="color:#64748b;">${callsMade || assigned}</span>
                    </td>
                    <td style="text-align:center;">
                        <div style="display:flex;align-items:center;justify-content:center;gap:0.5rem;">
                            <div style="width:60px;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden;">
                                <div style="width:${connRate}%;height:100%;background:${connRate > 70 ? '#10b981' : (connRate > 40 ? '#f59e0b' : '#ef4444')};"></div>
                            </div>
                            <span style="font-size:0.8rem;font-weight:700;color:#334155;">${connRate}%</span>
                        </div>
                    </td>
                    <td style="text-align:center;font-size:0.825rem;color:#334155;">
                        <span style="background:#eff6ff;color:#1e40af;padding:2px 8px;border-radius:6px;font-weight:600;">Deals: ${soldCount}</span>
                    </td>
                    <td style="text-align:right;font-weight:800;color:#10b981;">₹${soldVal.toLocaleString('en-IN')}</td>
                    <td style="text-align:center;font-weight:700;color:#3b82f6;">${winRate}%</td>
                    <td style="text-align:center;">
                        <span style="background:${badgeBg};color:${badgeColor};font-weight:700;padding:4px 10px;border-radius:12px;font-size:0.75rem;">${statusLabel}</span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function renderTelecallerLeadsTable(leadsList) {
        const tbody = document.getElementById('telecallerTableBody');
        if (!tbody) return;

        const leads = Array.isArray(leadsList) ? leadsList : [];

        if (leads.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2.5rem;color:#94a3b8;"><i class="fas fa-inbox fa-2x" style="margin-bottom:0.5rem;display:block;"></i>No assigned leads found for your account.</td></tr>`;
            return;
        }

        tbody.innerHTML = leads.map(lead => {
            const name = lead.customer_name || lead.farmer_name || lead.name || 'Prospect';
            const phone = lead.phone_number || lead.phone || '-';
            const location = lead.district || lead.city || lead.state || 'Karnataka';
            const status = (lead.status || 'new').toLowerCase();
            const dateStr = lead.updated_at || lead.created_at ? new Date(lead.updated_at || lead.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-';
            const followupDate = lead.next_followup_date || lead.followup_date ? new Date(lead.next_followup_date || lead.followup_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Pending';

            let badgeBg = '#e0e7ff', badgeColor = '#3730a3', statusText = 'New Lead';
            if (status.includes('contact') || status.includes('call')) {
                badgeBg = '#e0f2fe'; badgeColor = '#0369a1'; statusText = 'Contacted';
            } else if (status.includes('follow')) {
                badgeBg = '#fef3c7'; badgeColor = '#b45309'; statusText = 'In Follow-up';
            } else if (status.includes('convert')) {
                badgeBg = '#dcfce7'; badgeColor = '#15803d'; statusText = 'Converted';
            } else if (status.includes('lost') || status.includes('not')) {
                badgeBg = '#ffe4e6'; badgeColor = '#be123c'; statusText = 'Lost / Closed';
            }

            return `
                <tr class="telecaller-row" data-name="${name.toLowerCase()} ${phone}">
                    <td style="padding:0.9rem 1.25rem;">
                        <div style="font-weight:700;color:#0f172a;font-size:0.875rem;">${name}</div>
                        <div style="font-size:0.75rem;color:#64748b;">ID: #${lead.lead_id || lead.id}</div>
                    </td>
                    <td style="padding:0.9rem 1rem;">
                        <div style="font-weight:600;color:#334155;font-size:0.825rem;"><i class="fas fa-phone-alt" style="color:#6366f1;font-size:0.75rem;"></i> ${phone}</div>
                        <div style="font-size:0.75rem;color:#64748b;">${location}</div>
                    </td>
                    <td style="text-align:center;">
                        <span style="background:${badgeBg};color:${badgeColor};font-weight:700;padding:4px 10px;border-radius:12px;font-size:0.75rem;">${statusText}</span>
                    </td>
                    <td style="text-align:center;font-size:0.8rem;color:#475569;font-weight:600;">${dateStr}</td>
                    <td style="text-align:center;font-size:0.8rem;color:${followupDate === 'Pending' ? '#94a3b8' : '#d97706'};font-weight:700;">
                        <i class="far fa-calendar-check" style="margin-right:4px;"></i>${followupDate}
                    </td>
                    <td style="text-align:center;padding:0.9rem 1.25rem;">
                        <div style="display:flex;align-items:center;justify-content:center;gap:0.5rem;">
                            <a href="leads.html?id=${lead.lead_id || lead.id}" class="btn-action-icon" style="background:#eef2ff;color:#4f46e5;border:none;padding:0.4rem 0.75rem;font-size:0.8rem;border-radius:6px;text-decoration:none;font-weight:600;">
                                <i class="fas fa-phone"></i> Call / View
                            </a>
                            <a href="../whatsapp/whatsapp.html?phone=${phone}" class="btn-action-icon" style="background:#ecfdf5;color:#059669;border:none;padding:0.4rem 0.75rem;font-size:0.8rem;border-radius:6px;text-decoration:none;font-weight:600;">
                                <i class="fab fa-whatsapp"></i> Chat
                            </a>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function filterTableRows(query) {
        document.querySelectorAll('.telecaller-row').forEach(row => {
            const name = row.getAttribute('data-name') || '';
            if (!query || name.includes(query)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    function renderProductSalesTable(data) {
        const tbody = document.getElementById('productSalesTableBody');
        if (!tbody) return;

        const products = data?.topProducts || [];

        if (products.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:2rem;color:#94a3b8;"><i class="fas fa-boxes fa-2x" style="margin-bottom:0.5rem;display:block;"></i>No product sales recorded for this date range.</td></tr>`;
            return;
        }

        tbody.innerHTML = products.map(p => {
            const name = p.name || 'Product';
            const qty = parseInt(p.total_qty || 0);
            const estVal = qty * 25000;

            return `
                <tr>
                    <td style="padding:0.85rem 1.25rem;font-weight:700;color:#0f172a;">${name}</td>
                    <td style="text-align:center;font-weight:700;color:#3b82f6;">${qty} Units</td>
                    <td style="text-align:right;font-weight:800;color:#10b981;">₹${estVal.toLocaleString('en-IN')}</td>
                    <td style="padding:0.85rem 1.25rem;font-weight:600;color:#334155;"><i class="fas fa-award" style="color:#10b981;"></i> ${isTelecaller ? 'My Orders' : 'Top Category'}</td>
                </tr>
            `;
        }).join('');
    }

    // Initial Load
    await loadDashboardData();
});
