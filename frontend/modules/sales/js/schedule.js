document.addEventListener('DOMContentLoaded', async () => {
    if (!window.requireAuth(['admin', 'sales'])) return;
    
    let currentRange = 'today';
    let currentStaff = '';

    const listEl = document.getElementById('followups-list');
    const tabs = document.querySelectorAll('.schedule-tab');
    const staffSelect = document.getElementById('staff-filter');

    // 1. Check if Admin to show staff filter
    const userRole = localStorage.getItem('role')?.toLowerCase();
    if (userRole === 'admin' && staffSelect) {
        document.getElementById('staffFilterSection').style.display = 'block';
        await loadStaffList();
    }

    // 2. Initial Data Load
    await fetchAndRender();

    // 3. Tab Navigation
    tabs.forEach(tab => {
        tab.addEventListener('click', async () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentRange = tab.dataset.range;
            await fetchAndRender();
        });
    });

    // 4. Staff Filtering (Admin only)
    if (staffSelect) {
        staffSelect.addEventListener('change', async (e) => {
            currentStaff = e.target.value;
            await fetchAndRender();
        });
    }

    async function loadStaffList() {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${window.API_URL}/users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const users = await res.json();
            users.filter(u => u.role_name === 'sales').forEach(u => {
                const opt = document.createElement('option');
                opt.value = u.user_id;
                opt.textContent = u.name;
                staffSelect.appendChild(opt);
            });
        } catch (err) { console.error('Error loading staff:', err); }
    }

    async function fetchAndRender() {
        listEl.innerHTML = `<div style="text-align:center; padding:5rem;"><i class="fas fa-circle-notch fa-spin" style="font-size:2rem; color:var(--primary-color);"></i><p style="margin-top:1rem; color:#64748b;">Syncing Schedules...</p></div>`;
        const token = localStorage.getItem('token');
        
        let url = `${window.API_URL}/followups?date_range=${currentRange}&status=pending`;
        if (currentStaff) url += `&assigned_to=${currentStaff}`;

        try {
            const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();

            // Update stats
            const countTodayEl = document.getElementById('count-today');
            if (currentRange === 'today' && countTodayEl) countTodayEl.textContent = data.length;
            
            if (data.length === 0) {
                listEl.innerHTML = `
                    <div style="text-align:center; padding:5rem; background:white; border-radius:1.5rem; border:1px dashed #e2e8f0;">
                        <h2 style="font-weight:900; color:#1e293b; margin:0;">No follow-ups found</h2>
                        <p style="color:#64748b; margin-top:0.5rem;">The schedule is clear for this view.</p>
                    </div>`;
                return;
            }

            listEl.innerHTML = data.map(f => renderFollowupCard(f)).join('');
        } catch (err) {
            console.error('Fetch error:', err);
            listEl.innerHTML = `<p style="color:red; text-align:center;">Failed to load data.</p>`;
        }
    }

    function renderFollowupCard(f) {
        const d = new Date(f.followup_date);
        const day = d.getDate();
        const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
        const time = d.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit' });
        
        const isMissed = d < new Date() && f.status === 'pending';
        const dateClass = isMissed ? 'missed' : (d.toDateString() === new Date().toDateString() ? 'today' : '');

        return `
            <div class="followup-card">
                <div class="date-pills ${dateClass}">
                    <div class="month" style="font-size:0.6rem; font-weight:800; color:#94a3b8;">${month}</div>
                    <div class="day" style="font-size:1.25rem; font-weight:900;">${day}</div>
                </div>
                <div>
                    <div style="display:flex; align-items:center; gap:0.75rem;">
                        <span style="font-weight:900; font-size:1.1rem; color:#1e293b;">${f.customer_name}</span>
                        <span style="padding:0.25rem 0.6rem; background:#f1f5f9; border-radius:1rem; font-size:0.65rem; font-weight:800; color:#64748b; text-transform:uppercase;">${f.lead_status}</span>
                        ${currentStaff === '' && userRole === 'admin' ? `<span style="font-size:0.75rem; color:#64748b; font-weight:600;">(Assigned to: ${f.assigned_to_name})</span>` : ''}
                    </div>
                    <div style="display:flex; gap:1.5rem; margin-top:0.5rem; font-size:0.85rem; font-weight:600; color:#64748b;">
                        <span><i class="fas fa-phone" style="margin-right:0.4rem; color:var(--primary-color);"></i>${f.phone_number}</span>
                        <span><i class="fas fa-clock" style="margin-right:0.4rem;"></i>Scheduled ${time}</span>
                        <span><i class="fas fa-map-marker-alt" style="margin-right:0.4rem;"></i>${f.city}, ${f.state}</span>
                    </div>
                    ${f.remarks ? `<p style="margin-top:0.75rem; font-size:0.85rem; color:#475569; padding:0.5rem 0.75rem; background:#f8fafc; border-left:3px solid #cbd5e1; border-radius:0.25rem;">${f.remarks}</p>` : ''}
                </div>
                <div style="display:flex; gap:0.75rem;">
                    <a href="https://wa.me/${f.phone_number.replace(/\D/g,'')}" target="_blank" class="action-btn whatsapp"><i class="fab fa-whatsapp"></i></a>
                    <button onclick="openRescheduleModal(${f.followup_id})" class="action-btn edit"><i class="fas fa-calendar-alt"></i></button>
                    <button onclick="markDone(${f.followup_id})" class="action-btn done"><i class="fas fa-check"></i></button>
                </div>
            </div>
        `;
    }

    // Global Action Handlers
    window.markDone = async (id) => {
        if (!confirm('Mark this follow-up as completed?')) return;
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${window.API_URL}/followups/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ status: 'done' })
            });
            if (res.ok) fetchAndRender();
        } catch (err) { console.error('Error:', err); }
    };

    window.openRescheduleModal = (id) => {
        document.getElementById('modal-followup-id').value = id;
        document.getElementById('rescheduleModal').style.display = 'flex';
    };

    document.getElementById('confirmReschedule').addEventListener('click', async () => {
        const id = document.getElementById('modal-followup-id').value;
        const nextDate = document.getElementById('modal-next-date').value;
        const remarks = document.getElementById('modal-remarks').value;

        if (!nextDate) return alert('Please select a new date');

        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${window.API_URL}/followups/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ 
                    status: 'done', 
                    remarks: `Rescheduled to ${nextDate}: ${remarks}`,
                    next_followup_date: nextDate 
                })
            });
            if (res.ok) {
                document.getElementById('rescheduleModal').style.display = 'none';
                fetchAndRender();
            }
        } catch (err) { console.error('Error:', err); }
    });
});
