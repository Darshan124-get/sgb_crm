/* ============================================================
   media.js — Products & Media Library Interactive Engine
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Auth check
    if (!window.requireAuth(['admin', 'super-admin'])) return;

    // Load current user profile name
    const currentUser = window.getCurrentUser();
    const profileNameEl = document.getElementById('profileName');
    if (profileNameEl && currentUser.name) {
        profileNameEl.textContent = currentUser.name;
    }

    // Render initial list
    renderMediaTable();

    // Bind real-time search
    const searchInput = document.getElementById('mediaSearch');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderMediaTable();
        });
    }
});

// Mock Initial Files Database
let mediaFiles = [
    {
        id: 1,
        name: 'SGB Rotavator Multi-Speed Brochure',
        filename: 'sgb_rotavator_brochure.pdf',
        type: 'pdf',
        category: 'brochure',
        size: '2.40 MB',
        date: '2026-08-11 14:24'
    },
    {
        id: 2,
        name: 'WhatsApp Welcome Banner (Emerald)',
        filename: 'welcome_banner_emerald.png',
        type: 'image',
        category: 'welcome',
        size: '850 KB',
        date: '2026-08-13 10:15'
    },
    {
        id: 3,
        name: 'Tractor Rotavator Demo Video',
        filename: 'tractor_rotavator_demo.mp4',
        type: 'video',
        category: 'product',
        size: '12.80 MB',
        date: '2026-08-06 17:40'
    }
];

let currentFilter = 'all';

function renderMediaTable() {
    const tableBody = document.getElementById('mediaTableBody');
    const searchQuery = document.getElementById('mediaSearch')?.value.toLowerCase() || '';

    // Filter files
    const filtered = mediaFiles.filter(file => {
        const matchesCategory = currentFilter === 'all' || file.type === currentFilter;
        const matchesSearch = file.name.toLowerCase().includes(searchQuery) || file.filename.toLowerCase().includes(searchQuery) || file.category.toLowerCase().includes(searchQuery);
        return matchesCategory && matchesSearch;
    });

    if (filtered.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:2rem;"><i class="fa-solid fa-folder-open" style="font-size:2rem;margin-bottom:0.5rem;display:block;"></i> No media files found matching the criteria.</td></tr>`;
        return;
    }

    tableBody.innerHTML = filtered.map(file => {
        let iconClass = 'fa-file-lines';
        let iconTheme = 'icon-pdf';
        if (file.type === 'image') { iconClass = 'fa-file-image'; iconTheme = 'icon-image'; }
        if (file.type === 'video') { iconClass = 'fa-file-video'; iconTheme = 'icon-video'; }
        if (file.type === 'audio') { iconClass = 'fa-file-audio'; iconTheme = 'icon-audio'; }

        let badgeClass = 'badge-welcome';
        if (file.category === 'brochure') badgeClass = 'badge-brochure';
        if (file.category === 'product') badgeClass = 'badge-product';

        const mockUrl = `${window.BASE_URL || 'http://localhost:5000'}/media/uploads/${file.filename}`;

        return `
            <tr id="media-row-${file.id}">
                <td>
                    <div class="file-name-cell">
                        <div class="file-icon ${iconTheme}">
                            <i class="fa-solid ${iconClass}"></i>
                        </div>
                        <div>
                            <div class="file-name">${file.name}</div>
                            <div class="file-path">${file.filename}</div>
                        </div>
                    </div>
                </td>
                <td><span class="media-badge ${badgeClass}">${file.category}</span></td>
                <td>${file.size}</td>
                <td>${file.date}</td>
                <td>
                    <button class="btn-action" onclick="copyMediaLink('${mockUrl}')" title="Copy Media URL"><i class="fa-solid fa-link"></i></button>
                    <button class="btn-action btn-danger" onclick="deleteMedia(${file.id})" title="Delete Media"><i class="fa-solid fa-trash-can"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

function filterCategory(cat, btn) {
    currentFilter = cat;
    // Set active tab styling
    document.querySelectorAll('.category-tabs .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderMediaTable();
}

function copyMediaLink(url) {
    navigator.clipboard.writeText(url).then(() => {
        window.showAlert("Copied", "Direct media link copied to clipboard!", "success");
    }).catch(err => {
        console.error('Copy link failed:', err);
    });
}

function deleteMedia(id) {
    if (confirm("Are you sure you want to delete this media asset? Any chatbot flows using this file's URL may break.")) {
        mediaFiles = mediaFiles.filter(file => file.id !== id);
        renderMediaTable();
        window.showAlert("Deleted", "Media asset removed successfully.", "success");
    }
}

// Modal controls
function openUploadModal() {
    document.getElementById('uploadModal').style.display = 'flex';
}

function closeUploadModal() {
    document.getElementById('uploadModal').style.display = 'none';
}

function triggerFileInput() {
    document.getElementById('fileInput').click();
}

let selectedFile = null;

function handleFileSelect(input) {
    if (input.files && input.files[0]) {
        selectedFile = input.files[0];
        document.getElementById('uploadName').value = selectedFile.name.replace(/\.[^/.]+$/, "");
        window.showAlert("File Selected", `Selected "${selectedFile.name}" ready to upload.`, "info");
    }
}

function simulateUpload() {
    const name = document.getElementById('uploadName').value.trim();
    const category = document.getElementById('uploadCategory').value;

    if (!name) {
        alert("Please enter a file label.");
        return;
    }

    // Determine type
    let fileType = 'pdf';
    let mockFilename = 'document.pdf';
    let size = '1.20 MB';

    if (selectedFile) {
        mockFilename = selectedFile.name;
        const ext = selectedFile.name.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) fileType = 'image';
        else if (['mp4', 'avi', 'mov'].includes(ext)) fileType = 'video';
        else if (['mp3', 'wav', 'ogg'].includes(ext)) fileType = 'audio';
        
        size = (selectedFile.size / (1024 * 1024)).toFixed(2) + ' MB';
        if (selectedFile.size < 1024 * 1024) {
            size = (selectedFile.size / 1024).toFixed(0) + ' KB';
        }
    } else {
        mockFilename = name.toLowerCase().replace(/\s+/g, '_') + '.pdf';
    }

    closeUploadModal();
    window.showAlert("Uploading File", "Uploading media to WhatsApp Server...", "info");

    setTimeout(() => {
        const today = new Date();
        const dateStr = today.getFullYear() + '-' + 
                        String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                        String(today.getDate()).padStart(2, '0') + ' ' + 
                        String(today.getHours()).padStart(2, '0') + ':' + 
                        String(today.getMinutes()).padStart(2, '0');

        mediaFiles.unshift({
            id: Date.now(),
            name: name,
            filename: mockFilename,
            type: fileType,
            category: category,
            size: size,
            date: dateStr
        });

        // Reset inputs
        document.getElementById('uploadName').value = '';
        selectedFile = null;

        renderMediaTable();
        window.showAlert("Upload Successful", "Media asset is now online and available.", "success");
    }, 1500);
}
