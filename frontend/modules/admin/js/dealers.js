document.addEventListener('DOMContentLoaded', () => {
    if (!window.requireAuth(['admin'])) return;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('profileName').textContent = user.name || 'Administrator';
    fetchDealers();
    document.getElementById('dealerForm').addEventListener('submit', handleSubmit);
});

const API = `${window.API_URL}/dealers`;
const token = () => localStorage.getItem('token');
let allDealers = [];

async function fetchDealers() {
    try {
        const res = await fetch(API, { headers: { 'Authorization': `Bearer ${token()}` } });
        allDealers = await res.json();
        renderDealers(allDealers);
    } catch(e) { document.getElementById('dealerTableBody').innerHTML = '<tr><td colspan="6" style="padding:2rem;text-align:center;color:#ef4444;">Failed to load.</td></tr>'; }
}

function renderDealers(dealers) {
    const tbody = document.getElementById('dealerTableBody');
    if (!dealers.length) { tbody.innerHTML = '<tr><td colspan="6" style="padding:3rem;text-align:center;color:#94a3b8;">No dealers found.</td></tr>'; return; }
    tbody.innerHTML = dealers.map(d => `
        <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:1rem 1.25rem;font-weight:700;color:#1e293b;">${d.firm_name}</td>
            <td style="padding:1rem 1.25rem;">${d.owner_name || '—'}</td>
            <td style="padding:1rem 1.25rem;">${d.phone_number}</td>
            <td style="padding:1rem 1.25rem;">${d.city || '—'}</td>
            <td style="padding:1rem 1.25rem;font-size:0.8rem;color:#64748b;">${new Date(d.created_at).toLocaleDateString('en-IN')}</td>
            <td style="padding:1rem 1.25rem;">
                <div style="display:flex;gap:0.5rem;">
                    <button onclick='editDealer(${JSON.stringify(d)})' style="padding:4px 10px;background:#eff6ff;color:#3b82f6;border:none;border-radius:6px;cursor:pointer;font-size:0.75rem;font-weight:600;">Edit</button>
                    <button onclick="deleteDealer(${d.dealer_id})" style="padding:4px 10px;background:#fef2f2;color:#ef4444;border:none;border-radius:6px;cursor:pointer;font-size:0.75rem;font-weight:600;">Delete</button>
                </div>
            </td>
        </tr>`).join('');
}

function filterDealers() {
    const q = document.getElementById('dealerSearch').value.toLowerCase();
    renderDealers(allDealers.filter(d => d.firm_name?.toLowerCase().includes(q) || d.phone_number?.includes(q)));
}

function openModal(isEdit=false) {
    document.getElementById('dealerModal').style.display = 'flex';
    if (!isEdit) { document.getElementById('dealerForm').reset(); document.getElementById('edit-id').value=''; document.getElementById('modalTitle').textContent='Add Dealer'; }
}
function closeModal() { document.getElementById('dealerModal').style.display = 'none'; }

function editDealer(d) {
    openModal(true);
    document.getElementById('modalTitle').textContent = 'Edit Dealer';
    document.getElementById('edit-id').value   = d.dealer_id;
    document.getElementById('firm_name').value = d.firm_name;
    document.getElementById('owner_name').value= d.owner_name||'';
    document.getElementById('phone_number').value = d.phone_number;
    document.getElementById('city').value      = d.city||'';
}

async function handleSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const data = { firm_name: document.getElementById('firm_name').value, owner_name: document.getElementById('owner_name').value, phone_number: document.getElementById('phone_number').value, city: document.getElementById('city').value };
    const method = id ? 'PUT' : 'POST';
    const url    = id ? `${API}/${id}` : API;
    try {
        const res = await fetch(url, { method, headers: { 'Content-Type':'application/json','Authorization':`Bearer ${token()}` }, body: JSON.stringify(data) });
        if (res.ok) { closeModal(); fetchDealers(); } else { alert('Save failed'); }
    } catch(e) { alert('Server error'); }
}

async function deleteDealer(id) {
    if (!confirm('Delete this dealer?')) return;
    await fetch(`${API}/${id}`, { method:'DELETE', headers:{'Authorization':`Bearer ${token()}`} });
    fetchDealers();
}
