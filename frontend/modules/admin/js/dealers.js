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
        const data = await res.json();
        renderDealers(data);
    } catch (e) { document.getElementById('dealerTableBody').innerHTML = '<tr><td colspan="6" style="padding:2rem;text-align:center;color:#ef4444;">Failed to load.</td></tr>'; }
}

function renderDealers(data) {
    allDealers = data;
    const tbody = document.getElementById('dealerTableBody');
    if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding:3rem;text-align:center;color:#64748b;">No dealers found.</td></tr>';
        return;
    }

    tbody.innerHTML = data.map((d, index) => `
        <tr>
            <td style="padding:1rem 1.25rem;">
                <div style="font-weight:700;color:#1e293b;">${d.dealer_name}</div>
                <div style="font-size:0.75rem;color:#64748b;">${d.email || 'No email'}</div>
            </td>
            <td style="padding:1rem 1.25rem;font-size:0.875rem;color:#475569;">${d.contact_person || '-'}</td>
            <td style="padding:1rem 1.25rem;font-size:0.875rem;color:#475569;">${d.phone}</td>
            <td style="padding:1rem 1.25rem;font-size:0.875rem;color:#475569;">${d.city || ''}, ${d.state || ''}</td>
            <td style="padding:1rem 1.25rem;">
                <span style="padding:0.25rem 0.6rem;border-radius:6px;font-size:0.7rem;font-weight:700;text-transform:uppercase;background:${d.status === 'active' ? '#dcfce7' : '#fee2e2'};color:${d.status === 'active' ? '#166534' : '#991b1b'};">
                    ${d.status}
                </span>
            </td>
            <td style="padding:1rem 1.25rem;">
                <div style="display:flex;gap:0.5rem;">
                    <button class="btn-primary" onclick="handleEditClick(${index})" style="padding:0.4rem 0.6rem;font-size:0.75rem;background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;"><i class="fas fa-edit"></i></button>
                    <button class="btn-primary" onclick="deleteDealer(${d.dealer_id})" style="padding:0.4rem 0.6rem;font-size:0.75rem;background:#fee2e2;color:#991b1b;border:1px solid #fecaca;"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function handleEditClick(index) {
    const dealer = allDealers[index];
    if (dealer) editDealer(dealer);
}

function filterDealers() {
    const q = document.getElementById('dealerSearch').value.toLowerCase();
    const status = document.getElementById('statusFilter').value;

    let filtered = allDealers.filter(d =>
    (d.dealer_name?.toLowerCase().includes(q) ||
        d.phone?.includes(q) ||
        d.contact_person?.toLowerCase().includes(q))
    );

    if (status !== 'all') {
        filtered = filtered.filter(d => (d.status || 'active') === status);
    }

    renderDealers(filtered);
}

function openModal(isEdit = false) {
    document.getElementById('dealerModal').style.display = 'flex';
    if (!isEdit) {
        document.getElementById('dealerForm').reset();
        document.getElementById('edit-id').value = '';
        document.getElementById('modalTitle').textContent = 'Add Dealer';
        document.getElementById('status').value = 'active';
    }
}
function closeModal() { document.getElementById('dealerModal').style.display = 'none'; }

function editDealer(d) {
    openModal(true);
    document.getElementById('modalTitle').textContent = 'Edit Dealer';
    document.getElementById('edit-id').value = d.dealer_id;
    document.getElementById('dealer_name').value = d.dealer_name;
    document.getElementById('contact_person').value = d.contact_person || '';
    document.getElementById('phone').value = d.phone;
    document.getElementById('alternate_number').value = d.alternate_number || '';
    document.getElementById('email').value = d.email || '';
    document.getElementById('address').value = d.address || '';
    document.getElementById('city').value = d.city || '';
    document.getElementById('state').value = d.state || '';
    document.getElementById('status').value = d.status || 'active';
}

async function handleSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const data = {
        dealer_name: document.getElementById('dealer_name').value,
        contact_person: document.getElementById('contact_person').value,
        phone: document.getElementById('phone').value,
        alternate_number: document.getElementById('alternate_number').value,
        email: document.getElementById('email').value,
        address: document.getElementById('address').value,
        city: document.getElementById('city').value,
        state: document.getElementById('state').value,
        status: document.getElementById('status').value
    };
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API}/${id}` : API;
    try {
        const res = await fetch(url, { 
            method, 
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${token()}` 
            }, 
            body: JSON.stringify(data) 
        });

        const result = await res.json();

        if (res.ok) {
            closeModal();
            fetchDealers();
            // Show success message if available
            console.log(result.message);
        } else {
            alert('Save failed: ' + (result.message || 'Unknown error'));
        }
    } catch (err) {
        console.error('Submit error:', err);
        alert('Check console for details');
    }
}


async function deleteDealer(id) {
    if (!confirm('Are you sure you want to delete/deactivate this dealer?')) return;
    try {
        const res = await fetch(`${API}/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token()}` }
        });
        const data = await res.json();
        alert(data.message || 'Operation successful');
        fetchDealers();
    } catch (e) {
        alert('Error deleting dealer');
    }
}
