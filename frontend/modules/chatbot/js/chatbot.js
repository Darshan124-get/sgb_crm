/* ============================================================
   chatbot.js — Chatbot Flow Builder Redesigned Interactive Engine
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Auth & Sidebar Check
    if (typeof window.requireAuth === 'function') {
        if (!window.requireAuth(['admin', 'super-admin'])) return;
    }

    // Load current user profile name
    const currentUser = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : {};
    const profileNameEl = document.getElementById('profileName');
    if (profileNameEl && currentUser.name) {
        profileNameEl.textContent = currentUser.name;
    }

    // 2. DOM Elements Reference
    const canvasViewport = document.getElementById('canvas-viewport');
    const canvas = document.getElementById('flow-canvas');
    const connectionSvg = document.getElementById('connection-svg');
    const zoomPercentageEl = document.getElementById('ctrl-zoom-percentage');
    const gridToggleBtn = document.getElementById('gridToggleBtn');
    const inspectorContent = document.getElementById('inspector-content');
    const saveStatusIndicator = document.getElementById('saveStatusIndicator');
    const btnValidationWarning = document.getElementById('btn-validation-warning');
    const valWarningCount = document.getElementById('valWarningCount');
    const valIssuesDropdown = document.getElementById('valIssuesDropdown');
    const nodePickerPopover = document.getElementById('node-picker-popover');
    const popoverSearch = document.getElementById('popoverSearch');
    const popoverNodesList = document.getElementById('popoverNodesList');
    const customContextMenu = document.getElementById('custom-context-menu');

    // 3. State Management
    let zoomLevel = 1.0;
    let panX = 150;
    let panY = 50;
    let isFlowLocked = false;
    let selectedNodeId = null;
    let selectedEdge = null;
    let activeDragNode = null;
    let dragStartX = 0;
    let dragStartY = 0;
    let nodeStartX = 0;
    let nodeStartY = 0;
    let currentInspectorTab = 'node'; // 'node' or 'flow'

    // Panning state
    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;
    let isSpacePressed = false;

    // Drag-to-connect state
    let isConnecting = false;
    let isClickConnecting = false;
    let connectSourcePortId = null;
    let tempPathElement = null;
    let connectMouseStartPos = { x: 0, y: 0 };

    // Popover source port
    let popoverSourcePortId = null;

    // History undo/redo stacks
    const undoStack = [];
    const redoStack = [];

    // Unsaved changes tracking state
    let hasUnsavedChanges = false;
    let pendingNavigationTarget = null;
    let isAutoSaveEnabled = true;
    let autoSaveTimer = null;

    // Flow metadata settings
    let currentFlowId = 1;
    let flowSettings = {
        name: '',
        description: '',
        status: 'draft',
        triggerType: 'Keyword',
        keywords: '',
        startNodeId: 'node-start',
        language: 'English'
    };

    // Node library data definition (used for demonstration canvas flow)
    const nodes = [];
    const connections = [];

    // Parse URL parameter to load active Flow ID
    const urlParams = new URLSearchParams(window.location.search);
    const urlFlowId = urlParams.get('flowId') || urlParams.get('id') || 1;
    currentFlowId = parseInt(urlFlowId);
    fetchFlowDetails(currentFlowId);

    async function fetchFlowDetails(id) {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${window.API_URL}/chatbot/flows/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to load flow details');
            const data = await res.json();

            // Populate flow metadata settings
            flowSettings.name = data.flow.name;
            flowSettings.description = data.flow.description;
            flowSettings.status = data.flow.status;

            // Extract keywords, triggerType, and language from start node's config
            const rawStartNode = data.nodes.find(n => n.type === 'start');
            if (rawStartNode && rawStartNode.config) {
                flowSettings.triggerType = rawStartNode.config.triggerType || 'Keyword';
                flowSettings.keywords = rawStartNode.config.keywords || '';
                flowSettings.language = rawStartNode.config.language || 'English';
            } else {
                flowSettings.triggerType = 'Keyword';
                flowSettings.keywords = '';
                flowSettings.language = 'English';
            }
            flowSettings.startNodeId = 'node-start';

            // Update UI headers
            const headerFlowName = document.getElementById('headerFlowName');
            const headerFlowStatus = document.getElementById('headerFlowStatus');
            const headerFlowVersion = document.getElementById('headerFlowVersion');

            if (headerFlowName) headerFlowName.textContent = flowSettings.name;
            if (headerFlowStatus) {
                headerFlowStatus.textContent = flowSettings.status.charAt(0).toUpperCase() + flowSettings.status.slice(1);
                headerFlowStatus.className = `flow-status-badge status-${flowSettings.status}`;
            }
            if (headerFlowVersion) {
                headerFlowVersion.textContent = data.loadedVersionNumber ? `v${data.loadedVersionNumber}` : 'v1.0';
            }

            // Sync nodes array
            nodes.length = 0;
            data.nodes.forEach(n => {
                nodes.push({
                    id: n.id,
                    type: n.type,
                    name: n.name,
                    x: n.position ? n.position.x : n.x || 0,
                    y: n.position ? n.position.y : n.y || 0,
                    config: n.config || {},
                    disabled: !!n.disabled
                });
            });

            // Fail-safe: Ensure Start node exists as default node on canvas (reference Salesforce / n8n trigger rule)
            let startNode = nodes.find(n => n.type === 'start');
            if (!startNode) {
                startNode = {
                    id: 'node-start',
                    type: 'start',
                    name: 'Start',
                    x: 400,
                    y: 100,
                    config: {
                        triggerType: 'Keyword',
                        keywords: 'hello, help',
                        language: 'English'
                    },
                    disabled: false
                };
                nodes.push(startNode);
            }

            // Sync connections array (mapping backend sourceHandle strings back to choice port indices)
            connections.length = 0;
            data.edges.forEach(edge => {
                let fromPort = `port-${edge.source}-out`;
                if (edge.sourceHandle) {
                    const sourceNode = nodes.find(n => n.id === edge.source);
                    if (sourceNode && sourceNode.config && sourceNode.config.choices) {
                        const idx = sourceNode.config.choices.indexOf(edge.sourceHandle);
                        if (idx !== -1) {
                            fromPort = `port-${edge.source}-out-${idx}`;
                        }
                    }
                }
                connections.push({
                    from: fromPort,
                    to: `port-${edge.target}-in`,
                    active: true
                });
            });

            // Render updated state on canvas after DOM paints
            requestAnimationFrame(() => {
                if (typeof renderCanvasNodes === 'function') {
                    renderCanvasNodes();
                }
                // Double-raf ensures layout is fully computed before we measure viewport
                requestAnimationFrame(() => {
                    if (typeof fitCanvasView === 'function') {
                        fitCanvasView();
                    }
                    if (typeof runLiveValidation === 'function') {
                        runLiveValidation();
                    }
                });
            });
            hasUnsavedChanges = false;
            showSaveIndicator("Saved");

        } catch (err) {
            console.error('[LOAD FLOW ERROR]', err);
            if (typeof window.showAlert === 'function') {
                window.showAlert("Error Loading Flow", err.message, "error");
            }
        }
    }

    // Node Picker Choices Definitions
    const allPickerNodes = [
        { type: 'start', name: 'Start', category: 'TRIGGER', desc: 'Trigger keywords flow', icon: 'fa-play', iconClass: 'orange-node-icon' },
        { type: 'question', name: 'Question', category: 'QUESTION / INPUT', desc: 'Ask user choice / text', icon: 'fa-circle-question', iconClass: 'purple-node-icon' },
        { type: 'buttons', name: 'Buttons', category: 'QUESTION / INPUT', desc: 'Predefined choice buttons', icon: 'fa-circle-nodes', iconClass: 'purple-node-icon' },
        { type: 'list', name: 'List', category: 'QUESTION / INPUT', desc: 'Option list menu', icon: 'fa-list-ul', iconClass: 'purple-node-icon' },
        { type: 'text_input', name: 'Text Input', category: 'QUESTION / INPUT', desc: 'Capture open text answers', icon: 'fa-keyboard', iconClass: 'purple-node-icon' },
        { type: 'number_input', name: 'Number Input', category: 'QUESTION / INPUT', desc: 'Capture numbers', icon: 'fa-hashtag', iconClass: 'purple-node-icon' },
        { type: 'contact_time', name: 'Contact Time', category: 'QUESTION / INPUT', desc: 'Request callback timing', icon: 'fa-clock', iconClass: 'purple-node-icon' },
        { type: 'message', name: 'Message', category: 'MESSAGE', desc: 'Send simple text response', icon: 'fa-message', iconClass: 'blue-node-icon' },
        { type: 'image', name: 'Image', category: 'MESSAGE', desc: 'Send photo message', icon: 'fa-image', iconClass: 'green-node-icon' },
        { type: 'video', name: 'Video', category: 'MESSAGE', desc: 'Send video file', icon: 'fa-video', iconClass: 'green-node-icon' },
        { type: 'document', name: 'Document', category: 'MESSAGE', desc: 'Send PDF or catalog files', icon: 'fa-file-invoice', iconClass: 'green-node-icon' },
        { type: 'product', name: 'Product', category: 'MESSAGE', desc: 'Send product brochure card', icon: 'fa-box-open', iconClass: 'orange-node-icon' },
        { type: 'condition', name: 'Condition', category: 'FLOW LOGIC', desc: 'Set branch rules', icon: 'fa-code-branch', iconClass: 'pink-node-icon' },
        { type: 'end', name: 'End', category: 'FLOW LOGIC', desc: 'Terminate interaction', icon: 'fa-ban', iconClass: 'pink-node-icon' },
        { type: 'create_lead', name: 'Create Lead', category: 'INTEGRATION', desc: 'Insert new lead into CRM', icon: 'fa-address-card', iconClass: 'indigo-node-icon' }
    ];

    function updateCanvasTransform() {
        canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;

        // Dynamically update viewport background grid position & scale for true 360-degree infinite canvas
        if (canvasViewport) {
            const gridSize = 20 * zoomLevel;
            canvasViewport.style.backgroundPosition = `${panX}px ${panY}px`;
            canvasViewport.style.backgroundSize = `${gridSize}px ${gridSize}px`;
        }

        drawConnections();
    }

    canvasViewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomSpeed = 0.05;
        const previousZoom = zoomLevel;

        if (e.deltaY < 0) {
            zoomLevel = Math.min(1.6, zoomLevel + zoomSpeed);
        } else {
            zoomLevel = Math.max(0.4, zoomLevel - zoomSpeed);
        }

        // Zoom relative to cursor point on canvas
        const rect = canvasViewport.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        panX = cursorX - (cursorX - panX) * (zoomLevel / previousZoom);
        panY = cursorY - (cursorY - panY) * (zoomLevel / previousZoom);

        zoomPercentageEl.textContent = `${Math.round(zoomLevel * 100)}%`;
        updateCanvasTransform();
    });

    // Space panning & middle-click panning listeners
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            isSpacePressed = true;
            canvasViewport.style.cursor = 'grab';
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            isSpacePressed = false;
            canvasViewport.style.cursor = 'default';
        }
    });

    canvasViewport.addEventListener('mousedown', (e) => {
        // Panning trigger: Space key held OR middle mouse button (button 1)
        if (isSpacePressed || e.button === 1 || e.target === canvasViewport || e.target === canvas) {
            isPanning = true;
            panStartX = e.clientX - panX;
            panStartY = e.clientY - panY;
            canvasViewport.style.cursor = 'grabbing';
            e.preventDefault();
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (isPanning) {
            panX = e.clientX - panStartX;
            panY = e.clientY - panStartY;
            updateCanvasTransform();
        }
    });

    document.addEventListener('mouseup', () => {
        if (isPanning) {
            isPanning = false;
            canvasViewport.style.cursor = isSpacePressed ? 'grab' : 'default';
        }
    });

    // 5. Drag-to-Connect Handles System
    function finalizeConnectionAtElement(targetElement) {
        isConnecting = false;
        isClickConnecting = false;

        if (tempPathElement) {
            tempPathElement.remove();
            tempPathElement = null;
        }

        if (!targetElement) {
            connectSourcePortId = null;
            return;
        }

        const targetPort = targetElement.closest('.port-in');
        const nodeCard = targetElement.closest('.canvas-node');

        let targetPortId = null;
        if (targetPort) {
            targetPortId = targetPort.id;
        } else if (nodeCard && nodeCard.id !== 'node-start') {
            targetPortId = `port-${nodeCard.id}-in`;
        }

        if (targetPortId && connectSourcePortId) {
            // Prevent duplicate connections (same from→to pair)
            const duplicate = connections.some(c => c.from === connectSourcePortId && c.to === targetPortId);
            if (!duplicate) {
                saveStateForUndo();
                // Allow fan-out: one output can connect to multiple inputs.
                // Do NOT remove existing connections to targetPortId — multiple sources allowed.
                connections.push({ from: connectSourcePortId, to: targetPortId, active: true });
                showSaveIndicator("Unsaved changes");
                renderCanvasNodes();
                runLiveValidation();
            }
        }
        connectSourcePortId = null;
    }

    document.addEventListener('mousedown', (e) => {
        // Click-and-Click finalize interceptor
        if (isClickConnecting) {
            finalizeConnectionAtElement(e.target);
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        const portOut = e.target.closest('.port-out, .branch-port');
        const portIn = e.target.closest('.port-in');

        if (!portOut && !portIn) return;

        if (portOut) {
            isConnecting = true;
            isClickConnecting = false;
            connectSourcePortId = portOut.id;
            connectMouseStartPos = { x: e.clientX, y: e.clientY };

            // Save history state
            saveStateForUndo();

            // Create temp SVG path line
            tempPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            tempPathElement.setAttribute('class', 'connection-path active-edge');
            tempPathElement.style.strokeDasharray = '4';
            tempPathElement.style.pointerEvents = 'none';
            connectionSvg.appendChild(tempPathElement);

            e.preventDefault();
            e.stopPropagation();
        } else if (portIn) {
            // Clicking an input port disconnects ALL incoming connections to it (toggle-off)
            const incomingConns = connections.filter(c => c.to === portIn.id);
            if (incomingConns.length > 0) {
                saveStateForUndo();
                // Remove all incoming connections to this port on click (full disconnect)
                for (let i = connections.length - 1; i >= 0; i--) {
                    if (connections[i].to === portIn.id) connections.splice(i, 1);
                }
                renderCanvasNodes();
                runLiveValidation();
                showSaveIndicator("Unsaved changes");

                e.preventDefault();
                e.stopPropagation();
            }
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (!isConnecting || !tempPathElement) return;

        const canvasRect = canvas.getBoundingClientRect();
        const startPort = document.getElementById(connectSourcePortId);
        if (!startPort) return;

        const portRect = startPort.getBoundingClientRect();

        // Coordinates relative to canvas taking scale/offset into account
        const x1 = (portRect.left - canvasRect.left + portRect.width / 2) / zoomLevel;
        const y1 = (portRect.top - canvasRect.top + portRect.height / 2) / zoomLevel;

        const x2 = (e.clientX - canvasRect.left) / zoomLevel;
        const y2 = (e.clientY - canvasRect.top) / zoomLevel;

        const deltaX = Math.abs(x2 - x1);
        const controlOffset = Math.max(50, deltaX * 0.4);

        tempPathElement.setAttribute('d', `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`);
    });

    document.addEventListener('mouseup', (e) => {
        if (!isConnecting) return;

        // Check if it was a quick click or a drag-and-release
        const dist = Math.hypot(e.clientX - connectMouseStartPos.x, e.clientY - connectMouseStartPos.y);
        if (dist < 5) {
            // Quick click! Transition into click-connecting state
            isClickConnecting = true;
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        // Drag-and-release: finalize right away
        finalizeConnectionAtElement(e.target);
    });

    // 6. Inline Node Picker Popover
    canvas.addEventListener('click', (e) => {
        // Quick plus button selector
        const plusBtn = e.target.closest('.btn-add-next');
        if (plusBtn) {
            e.stopPropagation();
            popoverSourcePortId = plusBtn.id || `port-${plusBtn.closest('.canvas-node').id}-out`;

            // Render Popover Menu
            renderPopoverNodePickerList();

            // Position selector near click
            const rect = canvasViewport.getBoundingClientRect();
            nodePickerPopover.style.left = `${e.clientX - rect.left + 10}px`;
            nodePickerPopover.style.top = `${e.clientY - rect.top + 10}px`;
            nodePickerPopover.style.display = 'block';
            popoverSearch.value = '';
            popoverSearch.focus();
            return;
        }

        // Hide Popovers and menus on background clicks
        nodePickerPopover.style.display = 'none';
        customContextMenu.style.display = 'none';
        valIssuesDropdown.style.display = 'none';
    });

    function renderPopoverNodePickerList(query = '') {
        popoverNodesList.innerHTML = '';
        const filtered = allPickerNodes.filter(n =>
            n.name.toLowerCase().includes(query.toLowerCase()) ||
            n.desc.toLowerCase().includes(query.toLowerCase())
        );

        if (filtered.length === 0) {
            popoverNodesList.innerHTML = `<div style="font-size:0.75rem; color:var(--text-light); text-align:center; padding:1rem;">No nodes found.</div>`;
            return;
        }

        filtered.forEach(nodeDef => {
            const item = document.createElement('div');
            item.className = 'popover-item';
            item.innerHTML = `
                <span class="node-icon ${nodeDef.iconClass}" style="width:1.5rem; height:1.5rem; font-size:0.7rem;"><i class="fa-solid ${nodeDef.icon}"></i></span>
                <div style="display:flex; flex-direction:column;">
                    <span style="font-weight:700; font-size:0.75rem;">${nodeDef.name}</span>
                    <span style="font-size:0.625rem; color:var(--text-muted);">${nodeDef.desc}</span>
                </div>
            `;
            item.addEventListener('click', () => {
                nodePickerPopover.style.display = 'none';
                createAndConnectNode(nodeDef.type);
            });
            popoverNodesList.appendChild(item);
        });
    }

    popoverSearch.addEventListener('input', () => {
        renderPopoverNodePickerList(popoverSearch.value);
    });

    function getDefaultNodeConfig(type) {
        if (type === 'start') {
            return { triggerType: 'Keyword', keywords: 'hello, help, enquiry', language: 'English' };
        } else if (type === 'question') {
            return { question: 'Sir, what purpose are you looking for?', responseType: 'buttons', choices: ['Normal Wheelbarrow', 'Dumper Wheelbarrow'], saveTo: 'usage_purpose' };
        } else if (type === 'buttons') {
            return { question: 'Please select an option below:', choices: ['Option 1', 'Option 2'], saveTo: 'button_selection' };
        } else if (type === 'list') {
            return { question: 'Choose from list options:', buttonText: 'View Menu', sectionTitle: 'Available Products', choices: ['Option 1', 'Option 2'], items: [{ title: 'Option 1', desc: 'Description for option 1' }, { title: 'Option 2', desc: 'Description for option 2' }], saveTo: 'list_selection' };
        } else if (type === 'text_input') {
            return { question: 'Please enter your address / details:', saveTo: 'customer_address', placeholder: 'Type here...', validationType: 'text', minLength: 1, maxLength: 500 };
        } else if (type === 'number_input') {
            return { question: 'How many acres or units do you need?', saveTo: 'land_acres', placeholder: 'e.g. 5', minVal: 0, maxVal: 10000, integerOnly: false };
        } else if (type === 'contact_time') {
            return { question: 'Choose preferred callback timing:', slots: ['9:30 AM - 1:00 PM', '2:30 PM - 6:00 PM'], saveTo: 'preferred_call_time' };
        } else if (type === 'message') {
            return { message: 'Thank you for reaching out to SGB Agro.' };
        } else if (type === 'image') {
            return { mediaUrl: 'https://images.unsplash.com/photo-1599824434955-443a02302305?w=500', caption: 'SGB Agro Machinery photo' };
        } else if (type === 'video') {
            return { mediaUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', caption: 'Product demonstration video' };
        } else if (type === 'document') {
            return { mediaUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', filename: 'SGB_Agro_Catalog.pdf', caption: 'Product catalog brochure' };
        } else if (type === 'audio') {
            return { mediaUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', caption: 'Voice response note' };
        } else if (type === 'product') {
            return { product: 'Machine 12K', price: '₹12,000', desc: 'Heavy-duty agricultural wheelbarrow machine.', image: 'https://images.unsplash.com/photo-1599824434955-443a02302305?w=150' };
        } else if (type === 'multi_media') {
            return { caption: 'SGB Product photos gallery', mediaItems: ['https://images.unsplash.com/photo-1599824434955-443a02302305?w=500'] };
        } else if (type === 'condition') {
            return { variable: 'land_acres', operator: '>', value: '2', trueTarget: 'unconnected', falseTarget: 'unconnected' };
        } else if (type === 'goto') {
            return { targetNodeId: 'unconnected' };
        } else if (type === 'delay') {
            return { duration: 5, unit: 'seconds' };
        } else if (type === 'end') {
            return { message: 'Thank you for visiting SGB Agro!' };
        } else if (type === 'save_lead_field') {
            return { field: 'crop_type', value: 'Cotton' };
        } else if (type === 'create_lead') {
            return { nameVar: 'name', phoneVar: 'phone', status: 'new', source: 'WhatsApp Chatbot' };
        } else if (type === 'assign_to_user') {
            return { agentName: 'Sales Representative', note: 'Customer requested live human support' };
        } else if (type === 'webhook') {
            return { webhookUrl: 'https://api.example.com/crm/webhook', method: 'POST', sendVariables: true };
        }
        return { message: 'Node settings' };
    }

    function createAndConnectNode(type) {
        if (!popoverSourcePortId) return;

        saveStateForUndo();

        const count = nodes.filter(n => n.type === type).length + 1;
        const matchedDef = allPickerNodes.find(n => n.type === type);
        const label = matchedDef ? matchedDef.name : 'Node';
        const newId = `node-${Date.now()}`;

        // Find parent position
        const parentNodeId = popoverSourcePortId.replace('port-', '').split('-out')[0];
        const parentNode = nodes.find(n => n.id === parentNodeId);
        const startX = parentNode ? parentNode.x + 280 : 300;
        const startY = parentNode ? parentNode.y : 200;

        const config = getDefaultNodeConfig(type);

        const newNode = {
            id: newId,
            type: type,
            name: `${label} ${count}`,
            x: startX,
            y: startY,
            config: config,
            disabled: false
        };

        nodes.push(newNode);

        // Connect automatically
        connections.push({ from: popoverSourcePortId, to: `port-${newId}-in`, active: true });

        renderCanvasNodes();
        selectNode(newId);
        runLiveValidation();
        showSaveIndicator("Unsaved changes");
    }

    // 7. Right-Click Context Menus
    canvasViewport.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const nodeEl = e.target.closest('.canvas-node');
        const edgeEl = e.target.closest('.connection-path');

        const rect = canvasViewport.getBoundingClientRect();
        customContextMenu.style.left = `${e.clientX - rect.left}px`;
        customContextMenu.style.top = `${e.clientY - rect.top}px`;
        customContextMenu.style.display = 'block';

        if (nodeEl) {
            // Node Context Menu
            selectedNodeId = nodeEl.id;
            const matched = nodes.find(n => n.id === selectedNodeId);
            const isStart = matched && matched.type === 'start';
            const disableLabel = matched && matched.disabled ? 'Enable Node' : 'Disable Node';

            customContextMenu.innerHTML = `
                <div class="context-menu-item" onclick="selectInspectorTab('node')"><i class="fa-solid fa-gear"></i> Configure</div>
                ${!isStart ? `<div class="context-menu-item" onclick="duplicateNode('${selectedNodeId}')"><i class="fa-solid fa-copy"></i> Duplicate</div>` : ''}
                ${!isStart ? `<div class="context-menu-item" onclick="toggleDisableNode('${selectedNodeId}')"><i class="fa-solid fa-ban"></i> ${disableLabel}</div>` : ''}
                ${!isStart ? `<div class="context-menu-divider"></div>` : ''}
                ${!isStart ? `<div class="context-menu-item" style="color:var(--danger-color);" onclick="deleteNode('${selectedNodeId}')"><i class="fa-solid fa-trash-can"></i> Delete</div>` : ''}
            `;
        } else if (edgeEl) {
            // Edge Context Menu
            const from = edgeEl.dataset.from;
            const to = edgeEl.dataset.to;
            selectedEdge = connections.find(c => c.from === from && c.to === to);

            customContextMenu.innerHTML = `
                <div class="context-menu-item" style="color:var(--danger-color);" onclick="deleteConnection()"><i class="fa-solid fa-trash-can"></i> Delete Line</div>
            `;
        } else {
            // Canvas Context Menu
            customContextMenu.innerHTML = `
                <div class="context-menu-item" onclick="fitCanvasView()"><i class="fa-solid fa-compress"></i> Fit Canvas</div>
                <div class="context-menu-item" onclick="toggleCanvasGrid()"><i class="fa-solid fa-border-all"></i> Toggle Grid</div>
                <div class="context-menu-divider"></div>
                <div class="context-menu-item" onclick="addNodeToCanvas('question')"><i class="fa-solid fa-circle-question"></i> Add Question</div>
                <div class="context-menu-item" onclick="addNodeToCanvas('message')"><i class="fa-solid fa-message"></i> Add Message</div>
            `;
        }
    });

    window.toggleDisableNode = function (id) {
        const node = nodes.find(n => n.id === id);
        if (node) {
            saveStateForUndo();
            node.disabled = !node.disabled;

            // disable related connection lines visually
            connections.forEach(c => {
                if (c.from.includes(id) || c.to.includes(id)) {
                    c.active = !node.disabled;
                }
            });

            renderCanvasNodes();
            customContextMenu.style.display = 'none';
            showSaveIndicator("Unsaved changes");
        }
    };

    window.deleteConnection = function () {
        if (!selectedEdge) return;
        saveStateForUndo();
        const idx = connections.findIndex(c => c.from === selectedEdge.from && c.to === selectedEdge.to);
        if (idx !== -1) {
            connections.splice(idx, 1);
            selectedEdge = null;
            renderCanvasNodes();
            runLiveValidation();
            showSaveIndicator("Unsaved changes");
        }
        customContextMenu.style.display = 'none';
    };

    // 8. Visual Node Rendering (Category colors & Option Ports)
    function renderNodeOnCanvas(node) {
        const nodesContainer = document.getElementById('nodes-container');
        const nodeEl = document.createElement('div');
        nodeEl.id = node.id;
        nodeEl.className = `canvas-node`;
        nodeEl.style.left = `${node.x}px`;
        nodeEl.style.top = `${node.y}px`;

        let borderClass = 'question-node-accent';
        let typeIcon = 'fa-circle-question';

        if (node.type === 'start') {
            borderClass = 'start-node-accent';
            typeIcon = 'fa-play';
        } else if (node.type === 'message') {
            borderClass = 'message-node-accent';
            typeIcon = 'fa-message';
        } else if (node.type === 'product') {
            borderClass = 'product-node-accent';
            typeIcon = 'fa-box-open';
        } else if (['image', 'video', 'document', 'audio', 'multi_media'].includes(node.type)) {
            borderClass = 'media-node-accent';
            typeIcon = node.type === 'image' ? 'fa-image' : node.type === 'video' ? 'fa-video' : node.type === 'document' ? 'fa-file-invoice' : node.type === 'audio' ? 'fa-music' : 'fa-images';
        } else if (['condition', 'goto', 'delay', 'end'].includes(node.type)) {
            borderClass = 'logic-node-accent';
            typeIcon = node.type === 'condition' ? 'fa-code-branch' : node.type === 'goto' ? 'fa-share' : node.type === 'delay' ? 'fa-hourglass-half' : 'fa-ban';
        } else if (['create_lead', 'save_lead_field', 'assign_to_user', 'webhook'].includes(node.type)) {
            borderClass = 'integration-node-accent';
            typeIcon = node.type === 'create_lead' ? 'fa-address-card' : node.type === 'save_lead_field' ? 'fa-floppy-disk' : node.type === 'assign_to_user' ? 'fa-user-plus' : 'fa-globe';
        }

        nodeEl.classList.add(borderClass);

        if (node.id === selectedNodeId) {
            nodeEl.classList.add('selected');
        }

        if (node.disabled) {
            nodeEl.classList.add('disabled-node');
            const disabledBanner = document.createElement('div');
            disabledBanner.className = 'disabled-node-banner';
            disabledBanner.textContent = 'DISABLED';
            nodeEl.appendChild(disabledBanner);
        }

        if (node.type === 'start') {
            nodeEl.innerHTML = `
                <div class="node-header">
                    <i class="node-header-icon fa-solid ${typeIcon}"></i>
                    <span class="node-type">Start</span>
                    <button class="btn-add-next" id="btn-add-start-next" title="Create Next Node"><i class="fa-solid fa-plus"></i></button>
                </div>
                <div class="port port-out" id="port-${node.id}-out" style="right:-7px;" title="Output"></div>
            `;
            nodesContainer.appendChild(nodeEl);
            return;
        }

        const incomingCount = connections.filter(c => c.to === `port-${node.id}-in`).length;
        const portInTitle = incomingCount > 1
            ? `${incomingCount} connections — Click to disconnect all`
            : incomingCount === 1
                ? 'Input — Click to disconnect'
                : 'Input — Drag from an output port to connect';
        const portInClass = incomingCount > 1 ? 'port port-in port-in-multi' : 'port port-in';

        let portsHtml = `<div class="${portInClass}" id="port-${node.id}-in" title="${portInTitle}"></div>`;

        if (['question', 'buttons', 'list'].includes(node.type)) {
            const choices = node.config.choices || (node.config.items ? node.config.items.map(it => it.title || it) : []);
            const branchesHtml = choices.map((choice, idx) => `
                <div class="branch-row">
                    <span>${typeof choice === 'string' ? choice : (choice.title || `Choice ${idx + 1}`)}</span>
                    <button class="btn-add-next" id="btn-add-${node.id}-choice-${idx}" title="Create Next Node"><i class="fa-solid fa-plus"></i></button>
                    <div class="port port-out branch-port port-out-add" id="port-${node.id}-out-${idx}" title="Option output"></div>
                </div>
            `).join('');

            portsHtml += `
                <div class="branch-port-container">
                    ${branchesHtml}
                </div>
            `;
        } else if (node.type === 'condition') {
            portsHtml += `
                <div class="branch-port-container">
                    <div class="branch-row">
                        <span>True</span>
                        <div class="port port-out branch-port" id="port-${node.id}-out-true" title="True Output"></div>
                    </div>
                    <div class="branch-row">
                        <span>False</span>
                        <div class="port port-out branch-port" id="port-${node.id}-out-false" title="False Output"></div>
                    </div>
                </div>
            `;
        } else if (node.type !== 'end') {
            portsHtml += `
                <div class="port port-out" id="port-${node.id}-out" style="right:-7px;" title="Output"></div>
            `;
        }

        let bodyPreview = '';
        if (['question', 'buttons', 'list'].includes(node.type)) {
            const choices = node.config.choices || [];
            const pills = choices.slice(0, 3).map(c => `<span class="choice-pill-item">${c}</span>`).join('');
            bodyPreview = `
                <div class="node-preview">${node.config.question || 'Select option...'}</div>
                <div class="node-preview-choices">${pills}${choices.length > 3 ? `<span class="choice-pill-item">+${choices.length - 3}</span>` : ''}</div>
                ${node.config.saveTo ? `<div style="font-size:0.68rem; color:#6366f1; margin-top:0.25rem;">Save to: <code>{{${node.config.saveTo}}}</code></div>` : ''}
            `;
        } else if (node.type === 'message') {
            bodyPreview = `<div class="node-preview">"${node.config.message || 'Send message...'}"</div>`;
        } else if (node.type === 'product') {
            bodyPreview = `
                <div class="product-card-preview">
                    <img src="${node.config.image || 'https://images.unsplash.com/photo-1599824434955-443a02302305?w=50'}" alt="Product">
                    <div style="display:flex; flex-direction:column; gap:0.15rem; min-width:0; flex:1;">
                        <span style="font-weight:700; font-size:0.75rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${node.config.product || 'Select Product'}</span>
                        <span style="color:#f97316; font-weight:700; font-size:0.7rem;">${node.config.price || 'Price'}</span>
                    </div>
                </div>
            `;
        } else if (['image', 'video', 'document', 'audio'].includes(node.type)) {
            bodyPreview = `
                <div class="media-badge-preview">
                    <i class="fa-solid ${node.type === 'image' ? 'fa-image' : node.type === 'video' ? 'fa-video' : node.type === 'document' ? 'fa-file-invoice' : 'fa-music'}"></i>
                    <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${node.type.toUpperCase()}: ${node.config.caption || node.config.filename || 'Attached File'}</span>
                </div>
            `;
        } else if (node.type === 'multi_media') {
            bodyPreview = `
                <div class="media-badge-preview">
                    <i class="fa-solid fa-images"></i>
                    <span>Gallery (${(node.config.mediaItems || []).length} items)</span>
                </div>
            `;
        } else if (node.type === 'contact_time') {
            const slots = node.config.slots || [];
            const slotsHtml = slots.map(s => `<span class="choice-pill-item">${s}</span>`).join('');
            bodyPreview = `
                <div class="node-preview">${node.config.question || 'Select Slots'}</div>
                <div class="node-preview-choices">${slotsHtml}</div>
                ${node.config.saveTo ? `<div style="font-size:0.68rem; color:#6366f1; margin-top:0.25rem;">Save to: <code>{{${node.config.saveTo}}}</code></div>` : ''}
            `;
        } else if (node.type === 'text_input') {
            bodyPreview = `
                <div class="node-preview">Prompt: "${node.config.question || 'Input...'}"</div>
                <div style="font-size:0.68rem; color:#6366f1; margin-top:0.25rem;">Save to: <code>{{${node.config.saveTo || 'variable'}}}</code></div>
            `;
        } else if (node.type === 'number_input') {
            bodyPreview = `
                <div class="node-preview">Prompt: "${node.config.question || 'Number...'}"</div>
                <div style="font-size:0.68rem; color:#6366f1; margin-top:0.25rem;">Save to: <code>{{${node.config.saveTo || 'variable'}}}</code> (Numeric)</div>
            `;
        } else if (node.type === 'condition') {
            bodyPreview = `
                <div class="node-preview" style="color:#ec4899; font-weight:700;">If {{${node.config.variable || 'var'}}} ${node.config.operator || '=='} "${node.config.value || ''}"</div>
            `;
        } else if (node.type === 'goto') {
            const targetNode = nodes.find(n => n.id === node.config.targetNodeId);
            bodyPreview = `
                <div class="node-preview" style="color:#6366f1; font-weight:700;"><i class="fa-solid fa-share"></i> Jump to: ${targetNode ? targetNode.name : 'Unconnected'}</div>
            `;
        } else if (node.type === 'delay') {
            bodyPreview = `
                <div class="node-preview" style="color:#ec4899;"><i class="fa-solid fa-hourglass-half"></i> Wait ${node.config.duration || 5} ${node.config.unit || 'seconds'}</div>
            `;
        } else if (node.type === 'save_lead_field') {
            bodyPreview = `
                <div class="node-preview" style="color:#4f46e5;">Save: <code>${node.config.field || 'field'}</code> = "${node.config.value || ''}"</div>
            `;
        } else if (node.type === 'create_lead') {
            bodyPreview = `<div style="font-size:0.75rem; color:#6366f1; font-weight:600;"><i class="fa-solid fa-address-card"></i> Creates Lead Record in CRM</div>`;
        } else if (node.type === 'assign_to_user') {
            bodyPreview = `<div style="font-size:0.75rem; color:#6366f1; font-weight:600;"><i class="fa-solid fa-user-plus"></i> Assign to ${node.config.agentName || 'Sales Agent'}</div>`;
        } else if (node.type === 'webhook') {
            bodyPreview = `<div style="font-size:0.75rem; color:#6366f1; font-weight:600;"><i class="fa-solid fa-globe"></i> Webhook: ${node.config.method || 'POST'} API</div>`;
        } else if (node.type === 'end') {
            bodyPreview = `<div class="node-preview">Goodbye message: "${node.config.message || 'End'}"</div>`;
        } else {
            bodyPreview = `<div class="node-preview">Active Integration Block</div>`;
        }

        nodeEl.innerHTML = `
            <div class="node-header">
                <i class="node-header-icon fa-solid ${typeIcon}"></i>
                <span class="node-type">${node.name}</span>
                <span class="node-number">#${node.id.split('-').pop()}</span>
            </div>
            <div class="node-body">
                ${bodyPreview}
            </div>
            ${portsHtml}
        `;

        nodesContainer.appendChild(nodeEl);
    }

    // 9. Node Settings — Google Forms Style Inspector & Persistence
    window.saveSelectedNodeSettingsSilently = function () {
        const node = nodes.find(n => n.id === selectedNodeId);
        if (!node) return;

        const nameInput = document.getElementById('node-name-input');
        if (nameInput) {
            node.name = nameInput.value;
            const el = document.getElementById(node.id);
            if (el) {
                const headerType = el.querySelector('.node-type');
                if (headerType) headerType.textContent = node.name;
            }
        }

        if (['question', 'buttons', 'list'].includes(node.type)) {
            const qText = document.getElementById('node-q-text');
            if (qText) node.config.question = qText.value;
            if (node.type === 'question' && document.getElementById('node-q-type')) {
                node.config.responseType = document.getElementById('node-q-type').value;
            }
            if (document.getElementById('node-saveTo-var')) {
                const val = document.getElementById('node-saveTo-var').value;
                node.config.saveTo = val;
                node.config.saveResponseTo = val;
            }

            const inputs = document.querySelectorAll('.choice-title-input');
            const choices = [];
            inputs.forEach((inp, idx) => {
                choices.push(inp.value);
                const targetSelect = document.querySelector(`.choice-target-select[data-index="${idx}"]`);
                if (targetSelect) {
                    mapChoiceOutputConnection(node.id, idx, targetSelect.value);
                }
            });
            node.config.choices = choices;
        } else if (node.type === 'product') {
            const pSel = document.getElementById('node-p-select');
            if (pSel) node.config.product = pSel.value;
            const pPrice = document.getElementById('node-p-price');
            if (pPrice) node.config.price = pPrice.value;
            const pDesc = document.getElementById('node-p-desc');
            if (pDesc) node.config.desc = pDesc.value;
            const pImg = document.getElementById('node-p-image');
            if (pImg) node.config.image = pImg.value;
        } else if (node.type === 'message') {
            const msgInp = document.getElementById('node-msg-text');
            if (msgInp) node.config.message = msgInp.value;
        } else if (node.type === 'contact_time') {
            const tQ = document.getElementById('node-time-question');
            if (tQ) node.config.question = tQ.value;
            const tSave = document.getElementById('node-time-saveTo');
            if (tSave) {
                node.config.saveTo = tSave.value;
                node.config.saveResponseTo = tSave.value;
            }
            const inputs = document.querySelectorAll('.time-slot-input');
            const slots = [];
            inputs.forEach(inp => slots.push(inp.value));
            node.config.slots = slots;
        } else if (node.type === 'text_input') {
            const txtQ = document.getElementById('node-text-question');
            if (txtQ) node.config.question = txtQ.value;
            const txtSave = document.getElementById('node-text-saveTo');
            if (txtSave) {
                node.config.saveTo = txtSave.value;
                node.config.saveResponseTo = txtSave.value;
            }
            const txtPh = document.getElementById('node-text-placeholder');
            if (txtPh) node.config.placeholder = txtPh.value;
        } else if (node.type === 'number_input') {
            const numQ = document.getElementById('node-num-question');
            if (numQ) node.config.question = numQ.value;
            const numSave = document.getElementById('node-num-saveTo');
            if (numSave) {
                node.config.saveTo = numSave.value;
                node.config.saveResponseTo = numSave.value;
            }
        } else if (['image', 'video', 'document', 'audio'].includes(node.type)) {
            const mUrl = document.getElementById('node-media-url');
            if (mUrl) node.config.mediaUrl = mUrl.value;
            const mCap = document.getElementById('node-media-caption');
            if (mCap) node.config.caption = mCap.value;
        } else if (node.type === 'create_lead') {
            const mapName = document.getElementById('node-cl-map-name');
            const mapProd = document.getElementById('node-cl-map-product');
            const mapLand = document.getElementById('node-cl-map-land');
            const mapTime = document.getElementById('node-cl-map-time');
            const mapNotes = document.getElementById('node-cl-map-notes');

            node.config.fieldMappings = {
                name: mapName ? mapName.value : (node.config.fieldMappings?.name || 'name_place'),
                product: mapProd ? mapProd.value : (node.config.fieldMappings?.product || 'product_interest'),
                land: mapLand ? mapLand.value : (node.config.fieldMappings?.land || 'land_acres'),
                contactTime: mapTime ? mapTime.value : (node.config.fieldMappings?.contactTime || 'preferred_contact_time'),
                notes: mapNotes ? mapNotes.value : (node.config.fieldMappings?.notes || 'brush_cutter_type')
            };
            node.config.nameVar = node.config.fieldMappings.name;
            const stEl = document.getElementById('node-cl-status');
            if (stEl) node.config.status = stEl.value;
            const srcEl = document.getElementById('node-cl-source');
            if (srcEl) node.config.source = srcEl.value;
        }

        renderCanvasNodes();
    };

    window.saveSelectedNodeSettings = async function () {
        const node = nodes.find(n => n.id === selectedNodeId);
        if (!node) return;

        saveStateForUndo();

        const nameInput = document.getElementById('node-name-input');
        if (nameInput) node.name = nameInput.value;

        if (['question', 'buttons', 'list'].includes(node.type)) {
            node.config.question = document.getElementById('node-q-text') ? document.getElementById('node-q-text').value : node.config.question;
            if (node.type === 'question') {
                node.config.responseType = document.getElementById('node-q-type') ? document.getElementById('node-q-type').value : 'buttons';
            }
            if (node.type === 'list') {
                node.config.buttonText = document.getElementById('node-list-btntext') ? document.getElementById('node-list-btntext').value : 'View Menu';
                node.config.sectionTitle = document.getElementById('node-list-section') ? document.getElementById('node-list-section').value : 'Options';
            }
            if (document.getElementById('node-saveTo-var')) {
                const val = document.getElementById('node-saveTo-var').value;
                node.config.saveTo = val;
                node.config.saveResponseTo = val;
            }

            const inputs = document.querySelectorAll('.choice-title-input');
            const choices = [];
            inputs.forEach((inp, idx) => {
                choices.push(inp.value);
                const targetSelect = document.querySelector(`.choice-target-select[data-index="${idx}"]`);
                if (targetSelect) {
                    mapChoiceOutputConnection(node.id, idx, targetSelect.value);
                }
            });
            node.config.choices = choices;
        } else if (node.type === 'product') {
            node.config.product = document.getElementById('node-p-select').value;
            node.config.price = document.getElementById('node-p-price').value;
            node.config.desc = document.getElementById('node-p-desc').value;
            node.config.image = document.getElementById('node-p-image').value;
            const targetSel = document.getElementById('node-next-step-select');
            if (targetSel) mapSimpleOutputConnection(node.id, targetSel.value);
        } else if (node.type === 'message') {
            node.config.message = document.getElementById('node-msg-text').value;
            const targetSel = document.getElementById('node-next-step-select');
            if (targetSel) mapSimpleOutputConnection(node.id, targetSel.value);
        } else if (node.type === 'contact_time') {
            node.config.question = document.getElementById('node-time-question').value;
            const val = document.getElementById('node-time-saveTo') ? document.getElementById('node-time-saveTo').value : 'preferred_contact_time';
            node.config.saveTo = val;
            node.config.saveResponseTo = val;
            const inputs = document.querySelectorAll('.time-slot-input');
            const slots = [];
            inputs.forEach(inp => slots.push(inp.value));
            node.config.slots = slots;
            const targetSel = document.getElementById('node-next-step-select');
            if (targetSel) mapSimpleOutputConnection(node.id, targetSel.value);
        } else if (node.type === 'text_input') {
            node.config.question = document.getElementById('node-text-question').value;
            const val = document.getElementById('node-text-saveTo') ? document.getElementById('node-text-saveTo').value : '';
            node.config.saveTo = val;
            node.config.saveResponseTo = val;
            node.config.placeholder = document.getElementById('node-text-placeholder').value;
            node.config.validationType = document.getElementById('node-text-valtype') ? document.getElementById('node-text-valtype').value : 'text';
            node.config.minLength = document.getElementById('node-text-minlen') ? parseInt(document.getElementById('node-text-minlen').value) : 1;
            node.config.maxLength = document.getElementById('node-text-maxlen') ? parseInt(document.getElementById('node-text-maxlen').value) : 500;
            const targetSel = document.getElementById('node-next-step-select');
            if (targetSel) mapSimpleOutputConnection(node.id, targetSel.value);
        } else if (node.type === 'number_input') {
            node.config.question = document.getElementById('node-num-question').value;
            const val = document.getElementById('node-num-saveTo') ? document.getElementById('node-num-saveTo').value : '';
            node.config.saveTo = val;
            node.config.saveResponseTo = val;
            node.config.placeholder = document.getElementById('node-num-placeholder').value;
            node.config.minVal = document.getElementById('node-num-minval') ? parseFloat(document.getElementById('node-num-minval').value) : 0;
            node.config.maxVal = document.getElementById('node-num-maxval') ? parseFloat(document.getElementById('node-num-maxval').value) : 10000;
            node.config.integerOnly = document.getElementById('node-num-intonly') ? document.getElementById('node-num-intonly').checked : false;
            const targetSel = document.getElementById('node-next-step-select');
            if (targetSel) mapSimpleOutputConnection(node.id, targetSel.value);
        } else if (['image', 'video', 'document', 'audio'].includes(node.type)) {
            node.config.mediaUrl = document.getElementById('node-media-url').value;
            if (document.getElementById('node-media-filename')) {
                node.config.filename = document.getElementById('node-media-filename').value;
            }
            node.config.caption = document.getElementById('node-media-caption').value;
            const targetSel = document.getElementById('node-next-step-select');
            if (targetSel) mapSimpleOutputConnection(node.id, targetSel.value);
        } else if (node.type === 'multi_media') {
            node.config.caption = document.getElementById('node-mm-caption').value;
            const inputs = document.querySelectorAll('.multi-media-url-input');
            const mediaItems = [];
            inputs.forEach(inp => mediaItems.push(inp.value));
            node.config.mediaItems = mediaItems;
            const targetSel = document.getElementById('node-next-step-select');
            if (targetSel) mapSimpleOutputConnection(node.id, targetSel.value);
        } else if (node.type === 'condition') {
            node.config.variable = document.getElementById('node-cond-var').value;
            node.config.operator = document.getElementById('node-cond-op').value;
            node.config.value = document.getElementById('node-cond-val').value;
            const trueTarget = document.getElementById('node-cond-truetarget').value;
            const falseTarget = document.getElementById('node-cond-falsetarget').value;
            mapConditionOutputConnection(node.id, 'true', trueTarget);
            mapConditionOutputConnection(node.id, 'false', falseTarget);
        } else if (node.type === 'goto') {
            node.config.targetNodeId = document.getElementById('node-goto-target').value;
            mapSimpleOutputConnection(node.id, node.config.targetNodeId);
        } else if (node.type === 'delay') {
            node.config.duration = parseInt(document.getElementById('node-delay-duration').value) || 5;
            node.config.unit = document.getElementById('node-delay-unit').value;
            const targetSel = document.getElementById('node-next-step-select');
            if (targetSel) mapSimpleOutputConnection(node.id, targetSel.value);
        } else if (node.type === 'save_lead_field') {
            node.config.field = document.getElementById('node-slf-field').value;
            node.config.value = document.getElementById('node-slf-val').value;
            const targetSel = document.getElementById('node-next-step-select');
            if (targetSel) mapSimpleOutputConnection(node.id, targetSel.value);
        } else if (node.type === 'create_lead') {
            const mapName = document.getElementById('node-cl-map-name');
            const mapProd = document.getElementById('node-cl-map-product');
            const mapLand = document.getElementById('node-cl-map-land');
            const mapTime = document.getElementById('node-cl-map-time');
            const mapNotes = document.getElementById('node-cl-map-notes');

            node.config.fieldMappings = {
                name: mapName ? mapName.value : 'name_place',
                product: mapProd ? mapProd.value : 'product_interest',
                land: mapLand ? mapLand.value : 'land_acres',
                contactTime: mapTime ? mapTime.value : 'preferred_contact_time',
                notes: mapNotes ? mapNotes.value : 'brush_cutter_type'
            };
            node.config.nameVar = node.config.fieldMappings.name;
            node.config.status = document.getElementById('node-cl-status') ? document.getElementById('node-cl-status').value : 'new';
            node.config.source = document.getElementById('node-cl-source') ? document.getElementById('node-cl-source').value : 'WhatsApp Chatbot';

            const targetSel = document.getElementById('node-next-step-select');
            if (targetSel) mapSimpleOutputConnection(node.id, targetSel.value);
        } else if (node.type === 'assign_to_user') {
            node.config.agentName = document.getElementById('node-atu-agent').value;
            node.config.note = document.getElementById('node-atu-note').value;
            const targetSel = document.getElementById('node-next-step-select');
            if (targetSel) mapSimpleOutputConnection(node.id, targetSel.value);
        } else if (node.type === 'webhook') {
            node.config.webhookUrl = document.getElementById('node-wh-url').value;
            node.config.method = document.getElementById('node-wh-method').value;
            node.config.sendVariables = document.getElementById('node-wh-sendvars') ? document.getElementById('node-wh-sendvars').checked : true;
            const targetSel = document.getElementById('node-next-step-select');
            if (targetSel) mapSimpleOutputConnection(node.id, targetSel.value);
        } else if (node.type === 'end') {
            node.config.message = document.getElementById('node-end-msg').value;
        }

        renderCanvasNodes();
        runLiveValidation();
        await saveFlowDraft(false);
    };

    function mapChoiceOutputConnection(sourceNodeId, choiceIdx, targetId) {
        const sourcePortId = `port-${sourceNodeId}-out-${choiceIdx}`;
        const existIdx = connections.findIndex(c => c.from === sourcePortId);
        if (existIdx !== -1) connections.splice(existIdx, 1);

        if (targetId && targetId !== 'unconnected') {
            const alreadyExists = connections.some(c => c.from === sourcePortId && c.to === `port-${targetId}-in`);
            if (!alreadyExists) {
                connections.push({ from: sourcePortId, to: `port-${targetId}-in`, active: true });
            }
        }
    }

    function mapConditionOutputConnection(sourceNodeId, branchType, targetId) {
        const sourcePortId = `port-${sourceNodeId}-out-${branchType}`;
        const existIdx = connections.findIndex(c => c.from === sourcePortId);
        if (existIdx !== -1) connections.splice(existIdx, 1);

        if (targetId && targetId !== 'unconnected') {
            const alreadyExists = connections.some(c => c.from === sourcePortId && c.to === `port-${targetId}-in`);
            if (!alreadyExists) {
                connections.push({ from: sourcePortId, to: `port-${targetId}-in`, active: true });
            }
        }
    }

    function mapSimpleOutputConnection(sourceId, targetId) {
        const existIdx = connections.findIndex(c => c.from === `port-${sourceId}-out`);
        if (existIdx !== -1) connections.splice(existIdx, 1);

        if (targetId && targetId !== 'unconnected') {
            const alreadyExists = connections.some(c => c.from === `port-${sourceId}-out` && c.to === `port-${targetId}-in`);
            if (!alreadyExists) {
                connections.push({ from: `port-${sourceId}-out`, to: `port-${targetId}-in`, active: true });
            }
        }
    }

    // Dynamic dropdown options generation
    function getNextNodeOptionsHtml(selectedTargetPortId = '') {
        const targetNodeId = selectedTargetPortId ? selectedTargetPortId.replace('port-', '').replace('-in', '') : '';
        let optionsHtml = `<option value="unconnected" ${!targetNodeId ? 'selected' : ''}>-- Disconnected --</option>`;
        nodes.forEach(n => {
            if (n.id !== selectedNodeId && n.type !== 'start') {
                optionsHtml += `<option value="${n.id}" ${targetNodeId === n.id ? 'selected' : ''}>${n.name} (#${n.id.split('-').pop()})</option>`;
            }
        });
        return optionsHtml;
    }

    // Trigger details indicator
    function getTriggerIndicatorHtml(nodeId) {
        const parentConns = connections.filter(c => c.to === `port-${nodeId}-in`);
        if (parentConns.length === 0) {
            return `<div style="font-size:0.7rem; color:var(--text-light);"><i class="fa-solid fa-triangle-exclamation"></i> Disconnected Node (No trigger source)</div>`;
        }

        const list = parentConns.map(c => {
            const parentId = c.from.replace('port-', '').split('-out')[0];
            const parentNode = nodes.find(n => n.id === parentId);
            const parentName = parentNode ? parentNode.name : 'Unknown Node';

            // Check if Question option row trigger
            if (c.from.includes('-out-')) {
                const choiceIdx = parseInt(c.from.split('-out-').pop());
                const choiceLabel = parentNode.config.choices ? parentNode.config.choices[choiceIdx] : `Option ${choiceIdx + 1}`;
                return `<span><strong>${parentName}</strong> > Choice: <em>"${choiceLabel}"</em></span>`;
            }
            return `<span><strong>${parentName}</strong></span>`;
        }).join(', ');

        return `<div style="font-size:0.72rem; color:var(--primary-color); background:#f5f3ff; padding:0.4rem; border-radius:0.375rem; border:1px solid #ddd6fe; margin-bottom:0.75rem;"><i class="fa-solid fa-link"></i> Triggered by: ${list}</div>`;
    }

    function getConnectionTargetNodeName(sourcePortId) {
        const conn = connections.find(c => c.from === sourcePortId);
        if (!conn) return '<span style="color:var(--text-light); font-style:italic;">Disconnected (Drag arrow to connect)</span>';

        const targetNodeId = conn.to.replace('port-', '').replace('-in', '');
        const targetNode = nodes.find(n => n.id === targetNodeId);
        return targetNode ? `<span style="color:var(--primary-color); font-weight:700;">${targetNode.name}</span>` : 'Unknown Node';
    }

    function getTargetNodeIdFromPort(sourcePortId) {
        const conn = connections.find(c => c.from === sourcePortId);
        if (!conn) return '';
        return conn.to.replace('port-', '').replace('-in', '');
    }

    // Settings Forms populator overrides
    function renderNodeSettingsForm(node) {
        let fieldsHtml = '';
        const triggerHtml = getTriggerIndicatorHtml(node.id);

        if (node.type === 'start') {
            fieldsHtml = `
                ${triggerHtml}
                <div class="inspector-form-group">
                    <label>Node Name</label>
                    <input type="text" id="node-name-input" value="${node.name}">
                </div>
                <p style="font-size:0.78rem; color:var(--text-muted); margin-top:0.5rem;">This is the entry point of the chatbot workflow. Connect output handle to begin user interaction.</p>
            `;
        } else if (['question', 'buttons', 'list'].includes(node.type)) {
            const choices = node.config.choices || [];
            const choicesRowsHtml = choices.map((choice, idx) => {
                const currentTarget = getTargetNodeIdFromPort(`port-${node.id}-out-${idx}`);
                const optionsDropdown = getNextNodeOptionsHtml(currentTarget ? `port-${currentTarget}-in` : '');
                return `
                    <div style="display:flex; flex-direction:column; gap:0.35rem; background:#f8fafc; padding:0.5rem; border-radius:0.375rem; border:1px solid #e2e8f0; margin-bottom:0.5rem;">
                        <div class="inspector-choice-row">
                            <input type="text" class="choice-title-input" data-index="${idx}" value="${choice}" placeholder="Option label text...">
                            <button class="btn-icon-danger" onclick="deleteChoiceOption(${idx})" title="Delete option"><i class="fa-solid fa-trash-can"></i></button>
                        </div>
                        <div style="display:flex; align-items:center; gap:0.35rem;">
                            <span style="font-size:0.68rem; font-weight:600; color:var(--text-muted); white-space:nowrap;"><i class="fa-solid fa-arrow-turn-down" style="transform:rotate(-90deg);"></i> Leads to:</span>
                            <select class="choice-target-select" data-index="${idx}" style="font-size:0.72rem; padding:0.2rem 0.4rem; border-radius:0.25rem;">
                                ${optionsDropdown}
                            </select>
                        </div>
                    </div>
                `;
            }).join('');

            let extraOptionsHtml = '';
            if (node.type === 'question') {
                extraOptionsHtml = `
                    <div class="inspector-form-group">
                        <label>Response Type</label>
                        <select id="node-q-type">
                            <option value="buttons" ${node.config.responseType === 'buttons' ? 'selected' : ''}>Quick-Reply Buttons</option>
                            <option value="list" ${node.config.responseType === 'list' ? 'selected' : ''}>List Options menu</option>
                        </select>
                    </div>
                `;
            } else if (node.type === 'list') {
                extraOptionsHtml = `
                    <div class="inspector-form-group">
                        <label>Menu Button Title</label>
                        <input type="text" id="node-list-btntext" value="${node.config.buttonText || 'View Options'}">
                    </div>
                    <div class="inspector-form-group">
                        <label>Section Header Title</label>
                        <input type="text" id="node-list-section" value="${node.config.sectionTitle || 'Available Options'}">
                    </div>
                `;
            }

            fieldsHtml = `
                ${triggerHtml}
                <div class="inspector-form-group">
                    <label>Node Name</label>
                    <input type="text" id="node-name-input" value="${node.name}">
                </div>
                <div class="inspector-form-group">
                    <label>Question / Prompt Text</label>
                    <textarea id="node-q-text" rows="3">${node.config.question || ''}</textarea>
                </div>
                ${extraOptionsHtml}
                <div class="inspector-form-group">
                    <label>Save User Selection to Variable</label>
                    <input type="text" id="node-saveTo-var" list="crm-variables-list" value="${node.config.saveTo || node.config.saveResponseTo || ''}" placeholder="Choose or type variable (e.g. product_interest)">
                </div>
                <div class="inspector-form-group">
                    <label style="display:flex; justify-content:space-between; align-items:center;">
                        <span>Option Choices & Branches</span>
                        ${node.type === 'buttons' ? '<span style="font-size:0.65rem; color:#ea580c; font-weight:600;">(WhatsApp Max 3)</span>' : ''}
                    </label>
                    <div class="inspector-choices-editor">
                        ${choicesRowsHtml}
                        <button class="btn-add-choice" onclick="addChoiceOption()"><i class="fa-solid fa-plus"></i> Add Choice Option</button>
                    </div>
                </div>
            `;
        } else if (node.type === 'text_input') {
            const currentTarget = getTargetNodeIdFromPort(`port-${node.id}-out`);
            const optionsDropdown = getNextNodeOptionsHtml(currentTarget ? `port-${currentTarget}-in` : '');

            fieldsHtml = `
                ${triggerHtml}
                <div class="inspector-form-group">
                    <label>Node Name</label>
                    <input type="text" id="node-name-input" value="${node.name}">
                </div>
                <div class="inspector-form-group">
                    <label>Prompt Question</label>
                    <textarea id="node-text-question" rows="3">${node.config.question || ''}</textarea>
                </div>
                <div class="inspector-form-group">
                    <label>Save Response to Variable</label>
                    <input type="text" id="node-text-saveTo" list="crm-variables-list" value="${node.config.saveTo || node.config.saveResponseTo || ''}" placeholder="Choose or type variable (e.g. name_place)">
                </div>
                <div class="inspector-form-group">
                    <label>Placeholder / Hint Text</label>
                    <input type="text" id="node-text-placeholder" value="${node.config.placeholder || ''}" placeholder="e.g. Type your full address...">
                </div>
                <div class="inspector-form-group">
                    <label>Validation Type</label>
                    <select id="node-text-valtype">
                        <option value="text" ${node.config.validationType === 'text' ? 'selected' : ''}>Any Short Text</option>
                        <option value="email" ${node.config.validationType === 'email' ? 'selected' : ''}>Email Address Format</option>
                        <option value="phone" ${node.config.validationType === 'phone' ? 'selected' : ''}>Phone Number</option>
                    </select>
                </div>
                <div style="display:flex; gap:0.5rem;">
                    <div class="inspector-form-group" style="flex:1;">
                        <label>Min Length</label>
                        <input type="number" id="node-text-minlen" value="${node.config.minLength || 1}">
                    </div>
                    <div class="inspector-form-group" style="flex:1;">
                        <label>Max Length</label>
                        <input type="number" id="node-text-maxlen" value="${node.config.maxLength || 500}">
                    </div>
                </div>
                <div class="inspector-form-group">
                    <label>Next Step Target</label>
                    <select id="node-next-step-select">
                        ${optionsDropdown}
                    </select>
                </div>
            `;
        } else if (node.type === 'number_input') {
            const currentTarget = getTargetNodeIdFromPort(`port-${node.id}-out`);
            const optionsDropdown = getNextNodeOptionsHtml(currentTarget ? `port-${currentTarget}-in` : '');

            fieldsHtml = `
                ${triggerHtml}
                <div class="inspector-form-group">
                    <label>Node Name</label>
                    <input type="text" id="node-name-input" value="${node.name}">
                </div>
                <div class="inspector-form-group">
                    <label>Prompt Question</label>
                    <textarea id="node-num-question" rows="3">${node.config.question || ''}</textarea>
                </div>
                <div class="inspector-form-group">
                    <label>Save Response to Variable</label>
                    <input type="text" id="node-num-saveTo" list="crm-variables-list" value="${node.config.saveTo || node.config.saveResponseTo || ''}" placeholder="Choose or type variable (e.g. land_acres)">
                </div>
                <div class="inspector-form-group">
                    <label>Placeholder / Hint Text</label>
                    <input type="text" id="node-num-placeholder" value="${node.config.placeholder || ''}" placeholder="e.g. Enter number...">
                </div>
                <div style="display:flex; gap:0.5rem;">
                    <div class="inspector-form-group" style="flex:1;">
                        <label>Min Value</label>
                        <input type="number" id="node-num-minval" value="${node.config.minVal !== undefined ? node.config.minVal : 0}">
                    </div>
                    <div class="inspector-form-group" style="flex:1;">
                        <label>Max Value</label>
                        <input type="number" id="node-num-maxval" value="${node.config.maxVal !== undefined ? node.config.maxVal : 10000}">
                    </div>
                </div>
                <div class="inspector-form-group" style="display:flex; align-items:center; gap:0.5rem; margin-top:0.25rem;">
                    <input type="checkbox" id="node-num-intonly" ${node.config.integerOnly ? 'checked' : ''} style="width:auto;">
                    <label for="node-num-intonly" style="margin:0; font-size:0.75rem;">Allow Whole Integers Only</label>
                </div>
                <div class="inspector-form-group" style="margin-top:0.5rem;">
                    <label>Next Step Target</label>
                    <select id="node-next-step-select">
                        ${optionsDropdown}
                    </select>
                </div>
            `;
        } else if (node.type === 'contact_time') {
            const currentTarget = getTargetNodeIdFromPort(`port-${node.id}-out`);
            const optionsDropdown = getNextNodeOptionsHtml(currentTarget ? `port-${currentTarget}-in` : '');
            const slots = node.config.slots || [];
            const slotsRowsHtml = slots.map((s, idx) => `
                <div class="inspector-choice-row">
                    <input type="text" class="time-slot-input" data-index="${idx}" value="${s}">
                    <button class="btn-icon-danger" onclick="deleteTimeSlot(${idx})"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            `).join('');

            fieldsHtml = `
                ${triggerHtml}
                <div class="inspector-form-group">
                    <label>Node Name</label>
                    <input type="text" id="node-name-input" value="${node.name}">
                </div>
                <div class="inspector-form-group">
                    <label>Question / Prompt</label>
                    <textarea id="node-time-question" rows="2">${node.config.question || ''}</textarea>
                </div>
                <div class="inspector-form-group">
                    <label>Save Response to Variable</label>
                    <input type="text" id="node-time-saveTo" list="crm-variables-list" value="${node.config.saveTo || node.config.saveResponseTo || 'preferred_contact_time'}" placeholder="e.g. preferred_contact_time">
                </div>
                <div class="inspector-form-group">
                    <label>Available Time Slots</label>
                    <div class="inspector-choices-editor">
                        ${slotsRowsHtml}
                        <button class="btn-add-choice" onclick="addTimeSlot()"><i class="fa-solid fa-plus"></i> Add Time Slot</button>
                    </div>
                </div>
                <div class="inspector-form-group">
                    <label>Next Step Target</label>
                    <select id="node-next-step-select">
                        ${optionsDropdown}
                    </select>
                </div>
            `;
        } else if (['image', 'video', 'document', 'audio'].includes(node.type)) {
            const currentTarget = getTargetNodeIdFromPort(`port-${node.id}-out`);
            const optionsDropdown = getNextNodeOptionsHtml(currentTarget ? `port-${currentTarget}-in` : '');

            fieldsHtml = `
                ${triggerHtml}
                <div class="inspector-form-group">
                    <label>Node Name</label>
                    <input type="text" id="node-name-input" value="${node.name}">
                </div>
                <div class="inspector-form-group">
                    <label>${node.type.toUpperCase()} File Link / URL</label>
                    <div style="display:flex; gap:0.35rem;">
                        <input type="text" id="node-media-url" value="${node.config.mediaUrl || ''}" placeholder="https://...">
                        <button class="btn-secondary" style="padding:0 0.5rem; font-size:0.7rem; font-weight:700; white-space:nowrap;" onclick="triggerMediaPickerForNode('${node.type}')"><i class="fa-solid fa-folder-open"></i> Pick</button>
                    </div>
                </div>
                ${node.type === 'document' ? `
                <div class="inspector-form-group">
                    <label>Display Filename</label>
                    <input type="text" id="node-media-filename" value="${node.config.filename || 'Document.pdf'}">
                </div>
                ` : ''}
                <div class="inspector-form-group">
                    <label>Caption / Header Text</label>
                    <textarea id="node-media-caption" rows="2">${node.config.caption || ''}</textarea>
                </div>
                <div class="inspector-form-group">
                    <label>Next Step Target</label>
                    <select id="node-next-step-select">
                        ${optionsDropdown}
                    </select>
                </div>
            `;
        } else if (node.type === 'multi_media') {
            const currentTarget = getTargetNodeIdFromPort(`port-${node.id}-out`);
            const optionsDropdown = getNextNodeOptionsHtml(currentTarget ? `port-${currentTarget}-in` : '');
            const items = node.config.mediaItems || [];
            const itemsRowsHtml = items.map((url, idx) => `
                <div class="inspector-choice-row" style="margin-bottom:0.35rem;">
                    <input type="text" class="multi-media-url-input" data-index="${idx}" value="${url}" placeholder="https://image-url...">
                    <button class="btn-icon-danger" onclick="deleteMediaItem(${idx})"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            `).join('');

            fieldsHtml = `
                ${triggerHtml}
                <div class="inspector-form-group">
                    <label>Node Name</label>
                    <input type="text" id="node-name-input" value="${node.name}">
                </div>
                <div class="inspector-form-group">
                    <label>Gallery Caption / Message</label>
                    <textarea id="node-mm-caption" rows="2">${node.config.caption || ''}</textarea>
                </div>
                <div class="inspector-form-group">
                    <label>Media File Links</label>
                    <div class="inspector-choices-editor">
                        ${itemsRowsHtml}
                        <button class="btn-add-choice" onclick="addMediaItem()"><i class="fa-solid fa-plus"></i> Add Media Link</button>
                    </div>
                </div>
                <div class="inspector-form-group">
                    <label>Next Step Target</label>
                    <select id="node-next-step-select">
                        ${optionsDropdown}
                    </select>
                </div>
            `;
        } else if (node.type === 'product') {
            const currentTarget = getTargetNodeIdFromPort(`port-${node.id}-out`);
            const optionsDropdown = getNextNodeOptionsHtml(currentTarget ? `port-${currentTarget}-in` : '');

            // Ensure catalog products are loaded from API
            if (catalogProducts.length === 0) {
                loadCatalogProductsFromAPI().then(() => {
                    const sel = document.getElementById('node-p-select');
                    if (sel) {
                        const selectedProdName = node.config.product || '';
                        sel.innerHTML = `<option value="">-- Choose Product from Catalog --</option>` +
                            catalogProducts.map(p => {
                                const isSelected = (p.name === selectedProdName || p.id === node.config.productId);
                                const rawPrice = parseFloat(p.price || p.selling_price || 0);
                                const priceFormatted = !isNaN(rawPrice) && rawPrice > 0 ? `₹${rawPrice.toLocaleString('en-IN')}` : (p.price || '');
                                const categoryBadge = p.category ? ` [${p.category}]` : '';
                                return `<option value="${p.name}" ${isSelected ? 'selected' : ''}>${p.name}${categoryBadge} - ${priceFormatted}</option>`;
                            }).join('');
                    }
                });
            }

            // Build dynamic select options ONLY from real Products & Media catalog
            const selectedProdName = node.config.product || '';
            const productOptionsHtml = catalogProducts.length > 0 ? catalogProducts.map(p => {
                const isSelected = (p.name === selectedProdName || p.id === node.config.productId);
                const rawPrice = parseFloat(p.price || p.selling_price || 0);
                const priceFormatted = !isNaN(rawPrice) && rawPrice > 0 ? `₹${rawPrice.toLocaleString('en-IN')}` : (p.price || '');
                const categoryBadge = p.category ? ` [${p.category}]` : '';
                return `<option value="${p.name}" ${isSelected ? 'selected' : ''}>${p.name}${categoryBadge} - ${priceFormatted}</option>`;
            }).join('') : '<option value="" disabled>Loading Products from Products & Media...</option>';

            fieldsHtml = `
                ${triggerHtml}
                <div class="inspector-form-group">
                    <label>Node Name</label>
                    <input type="text" id="node-name-input" value="${node.name}">
                </div>
                <div class="inspector-form-group" style="background:#f0fdf4; border:1px solid #bbf7d0; padding:10px; border-radius:8px;">
                    <label style="color:#166534; font-weight:700; display:flex; justify-content:space-between; align-items:center;">
                        <span><i class="fa-solid fa-boxes-stacked"></i> SELECT FROM PRODUCTS & MEDIA</span>
                        <span style="font-size:0.65rem; color:#15803d; font-weight:bold; background:#dcfce7; padding:2px 6px; border-radius:4px;">Auto-Populate</span>
                    </label>
                    <select id="node-p-select" style="margin-top:6px; font-weight:600; color:#0f172a;" onchange="onCatalogProductSelectChange(this)">
                        <option value="">-- Choose Product from Catalog --</option>
                        ${productOptionsHtml}
                    </select>

                    <button type="button" id="btn-sync-catalog-prod" class="btn btn-secondary btn-sm" style="margin-top:8px; width:100%; font-size:0.75rem; display:flex; align-items:center; justify-content:center; gap:6px; background:#ffffff; border:1px solid #bbf7d0; color:#166534; font-weight:600; padding:5px 8px; border-radius:6px; cursor:pointer;" onclick="syncSelectedCatalogProductDetails()">
                        <i class="fa-solid fa-rotate"></i> Auto-fill Details from Products & Media
                    </button>
                </div>
                <div class="inspector-form-group">
                    <label>Price Display</label>
                    <input type="text" id="node-p-price" value="${node.config.price || ''}" placeholder="e.g. ₹12,000">
                </div>
                <div class="inspector-form-group">
                    <label>Product Description</label>
                    <textarea id="node-p-desc" rows="3" placeholder="Product details...">${node.config.desc || ''}</textarea>
                </div>
                <div class="inspector-form-group">
                    <label style="display:flex; justify-content:space-between; align-items:center;">
                        <span><i class="fa-solid fa-image"></i> Product Image</span>
                        <span style="font-size:0.65rem; color:var(--text-light); font-weight:normal;">Image File</span>
                    </label>
                    <div class="product-image-picker-box" style="border: 2px dashed #cbd5e1; border-radius: 8px; padding: 10px; background: #f8fafc; text-align: center; position: relative;">
                        <input type="hidden" id="node-p-image" value="${node.config.image || ''}">
                        <input type="file" id="node-p-file-input" accept="image/*" style="display: none;">

                        <div id="product-img-preview-container" style="display: ${node.config.image ? 'block' : 'none'}; position: relative; margin-bottom: 6px;">
                            <img id="product-img-preview" src="${node.config.image || 'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%201%201%22%3E%3C/svg%3E'}" crossorigin="anonymous" onerror="this.style.display='none';" style="max-width: 100%; max-height: 140px; border-radius: 6px; object-fit: contain; border: 1px solid #e2e8f0; background: #ffffff; padding: 3px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                            <button type="button" id="btn-remove-p-image" style="position: absolute; top: 4px; right: 4px; background: rgba(239, 68, 68, 0.95); color: #ffffff; border: none; border-radius: 50%; width: 22px; height: 22px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 11px;" title="Remove Image" onclick="removeProductImage(event)">&times;</button>
                        </div>

                        <div id="product-img-empty-box" style="display: ${node.config.image ? 'none' : 'block'}; padding: 10px 4px; cursor: pointer;" onclick="openProductFilePicker()">
                            <i class="fa-solid fa-cloud-arrow-up" style="font-size: 1.8rem; color: #94a3b8; margin-bottom: 4px;"></i>
                            <div style="font-size: 0.78rem; color: #475569; font-weight: 600;">Click or drag & drop image file</div>
                            <div style="font-size: 0.65rem; color: #94a3b8; margin-top: 2px;">JPG, PNG, WEBP up to 5MB</div>
                        </div>

                        <div style="display: flex; gap: 6px; margin-top: 6px;">
                            <button type="button" id="btn-browse-p-image" class="btn btn-secondary btn-sm" style="flex: 1; font-size: 0.75rem; padding: 5px 8px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; background: #ffffff; border: 1px solid #cbd5e1; color: #334155; font-weight: 600;" onclick="openProductFilePicker()">
                                <i class="fa-solid fa-folder-open"></i> <span id="btn-browse-p-text">${node.config.image ? 'Change Image' : 'Choose Image File'}</span>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="inspector-form-group">
                    <label>Next Step Target</label>
                    <select id="node-next-step-select">
                        ${optionsDropdown}
                    </select>
                </div>
            `;
        } else if (node.type === 'message') {
            const currentTarget = getTargetNodeIdFromPort(`port-${node.id}-out`);
            const optionsDropdown = getNextNodeOptionsHtml(currentTarget ? `port-${currentTarget}-in` : '');

            fieldsHtml = `
                ${triggerHtml}
                <div class="inspector-form-group">
                    <label>Node Name</label>
                    <input type="text" id="node-name-input" value="${node.name}">
                </div>
                <div class="inspector-form-group">
                    <label>Message Content</label>
                    <textarea id="node-msg-text" rows="4">${node.config.message || ''}</textarea>
                    <span style="font-size:0.65rem; color:var(--text-light); margin-top:0.25rem; display:block;">Supports variables like <code>{{name}}</code> or <code>{{land_acres}}</code></span>
                </div>
                <div class="inspector-form-group">
                    <label>Next Step Target</label>
                    <select id="node-next-step-select">
                        ${optionsDropdown}
                    </select>
                </div>
            `;
        } else if (node.type === 'condition') {
            const trueTarget = getTargetNodeIdFromPort(`port-${node.id}-out-true`);
            const falseTarget = getTargetNodeIdFromPort(`port-${node.id}-out-false`);
            const trueOptionsHtml = getNextNodeOptionsHtml(trueTarget ? `port-${trueTarget}-in` : '');
            const falseOptionsHtml = getNextNodeOptionsHtml(falseTarget ? `port-${falseTarget}-in` : '');

            fieldsHtml = `
                ${triggerHtml}
                <div class="inspector-form-group">
                    <label>Node Name</label>
                    <input type="text" id="node-name-input" value="${node.name}">
                </div>
                <div class="inspector-form-group">
                    <label>Variable to Check</label>
                    <input type="text" id="node-cond-var" value="${node.config.variable || 'land_acres'}" placeholder="e.g. land_acres">
                </div>
                <div class="inspector-form-group">
                    <label>Comparison Operator</label>
                    <select id="node-cond-op">
                        <option value="==" ${node.config.operator === '==' ? 'selected' : ''}>Equals (==)</option>
                        <option value="!=" ${node.config.operator === '!=' ? 'selected' : ''}>Not Equals (!=)</option>
                        <option value=">" ${node.config.operator === '>' ? 'selected' : ''}>Greater Than (&gt;)</option>
                        <option value="<" ${node.config.operator === '<' ? 'selected' : ''}>Less Than (&lt;)</option>
                        <option value="contains" ${node.config.operator === 'contains' ? 'selected' : ''}>Contains</option>
                    </select>
                </div>
                <div class="inspector-form-group">
                    <label>Comparison Value</label>
                    <input type="text" id="node-cond-val" value="${node.config.value || ''}" placeholder="e.g. 2">
                </div>
                <div class="inspector-form-group" style="background:#f0fdf4; border:1px solid #bbf7d0; padding:0.5rem; border-radius:0.375rem;">
                    <label style="color:#166534;"><i class="fa-solid fa-check"></i> True Branch Leads To</label>
                    <select id="node-cond-truetarget">
                        ${trueOptionsHtml}
                    </select>
                </div>
                <div class="inspector-form-group" style="background:#fef2f2; border:1px solid #fecaca; padding:0.5rem; border-radius:0.375rem; margin-top:0.5rem;">
                    <label style="color:#991b1b;"><i class="fa-solid fa-xmark"></i> False Branch Leads To</label>
                    <select id="node-cond-falsetarget">
                        ${falseOptionsHtml}
                    </select>
                </div>
            `;
        } else if (node.type === 'goto') {
            const currentTarget = node.config.targetNodeId || '';
            const optionsDropdown = getNextNodeOptionsHtml(currentTarget ? `port-${currentTarget}-in` : '');

            fieldsHtml = `
                ${triggerHtml}
                <div class="inspector-form-group">
                    <label>Node Name</label>
                    <input type="text" id="node-name-input" value="${node.name}">
                </div>
                <div class="inspector-form-group">
                    <label>Jump to Target Node</label>
                    <select id="node-goto-target">
                        ${optionsDropdown}
                    </select>
                </div>
            `;
        } else if (node.type === 'delay') {
            const currentTarget = getTargetNodeIdFromPort(`port-${node.id}-out`);
            const optionsDropdown = getNextNodeOptionsHtml(currentTarget ? `port-${currentTarget}-in` : '');

            fieldsHtml = `
                ${triggerHtml}
                <div class="inspector-form-group">
                    <label>Node Name</label>
                    <input type="text" id="node-name-input" value="${node.name}">
                </div>
                <div style="display:flex; gap:0.5rem;">
                    <div class="inspector-form-group" style="flex:1;">
                        <label>Delay Duration</label>
                        <input type="number" id="node-delay-duration" value="${node.config.duration || 5}">
                    </div>
                    <div class="inspector-form-group" style="flex:1;">
                        <label>Unit</label>
                        <select id="node-delay-unit">
                            <option value="seconds" ${node.config.unit === 'seconds' ? 'selected' : ''}>Seconds</option>
                            <option value="minutes" ${node.config.unit === 'minutes' ? 'selected' : ''}>Minutes</option>
                            <option value="hours" ${node.config.unit === 'hours' ? 'selected' : ''}>Hours</option>
                        </select>
                    </div>
                </div>
                <div class="inspector-form-group">
                    <label>Next Step Target</label>
                    <select id="node-next-step-select">
                        ${optionsDropdown}
                    </select>
                </div>
            `;
        } else if (node.type === 'save_lead_field') {
            const currentTarget = getTargetNodeIdFromPort(`port-${node.id}-out`);
            const optionsDropdown = getNextNodeOptionsHtml(currentTarget ? `port-${currentTarget}-in` : '');

            fieldsHtml = `
                ${triggerHtml}
                <div class="inspector-form-group">
                    <label>Node Name</label>
                    <input type="text" id="node-name-input" value="${node.name}">
                </div>
                <div class="inspector-form-group">
                    <label>CRM Field Name</label>
                    <input type="text" id="node-slf-field" value="${node.config.field || 'crop_type'}" placeholder="e.g. crop_type">
                </div>
                <div class="inspector-form-group">
                    <label>Field Value / Variable</label>
                    <input type="text" id="node-slf-val" value="${node.config.value || ''}" placeholder="e.g. Cotton or {{usage_purpose}}">
                </div>
                <div class="inspector-form-group">
                    <label>Next Step Target</label>
                    <select id="node-next-step-select">
                        ${optionsDropdown}
                    </select>
                </div>
            `;
        } else if (node.type === 'create_lead') {
            const currentTarget = getTargetNodeIdFromPort(`port-${node.id}-out`);
            const optionsDropdown = getNextNodeOptionsHtml(currentTarget ? `port-${currentTarget}-in` : '');

            const mappings = node.config.fieldMappings || {};
            const nameVar = mappings.name || node.config.nameVar || 'name_place';
            const productVar = mappings.product || 'product_interest';
            const landVar = mappings.land || 'land_acres';
            const contactTimeVar = mappings.contactTime || 'preferred_contact_time';
            const notesVar = mappings.notes || 'brush_cutter_type';

            fieldsHtml = `
                ${triggerHtml}
                <div class="inspector-form-group">
                    <label>Node Name</label>
                    <input type="text" id="node-name-input" value="${node.name}">
                </div>
                <div class="inspector-form-group">
                    <label>Initial Lead Status</label>
                    <select id="node-cl-status">
                        <option value="new" ${node.config.status === 'new' ? 'selected' : ''}>New Lead</option>
                        <option value="contacted" ${node.config.status === 'contacted' ? 'selected' : ''}>Contacted</option>
                        <option value="in_progress" ${node.config.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                        <option value="qualified" ${node.config.status === 'qualified' ? 'selected' : ''}>Qualified</option>
                    </select>
                </div>
                <div class="inspector-form-group">
                    <label>Lead Source Tag</label>
                    <input type="text" id="node-cl-source" value="${node.config.source || 'WhatsApp Chatbot'}">
                </div>

                <div class="inspector-form-group" style="background:#f8fafc; border:1px solid #cbd5e1; padding:12px; border-radius:8px; margin-top:10px;">
                    <label style="color:#1e293b; font-weight:700; display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span><i class="fa-solid fa-network-wired" style="color:#6366f1;"></i> CRM LEAD FIELD MAPPING</span>
                        <span style="font-size:0.65rem; color:#4338ca; font-weight:bold; background:#e0e7ff; padding:2px 6px; border-radius:4px;">Lead Management</span>
                    </label>

                    <div style="font-size:0.72rem; color:#64748b; margin-bottom:10px;">
                        Map collected chatbot variables to CRM Lead Management record fields:
                    </div>

                    <div class="inspector-form-group" style="margin-bottom:8px;">
                        <label style="font-size:0.75rem;"><i class="fa-solid fa-user"></i> Customer Name Field Variable</label>
                        <input type="text" id="node-cl-map-name" list="crm-variables-list" value="${nameVar}" placeholder="e.g. name_place">
                    </div>

                    <div class="inspector-form-group" style="margin-bottom:8px;">
                        <label style="font-size:0.75rem;"><i class="fa-solid fa-box-open"></i> Product Interest Field Variable</label>
                        <input type="text" id="node-cl-map-product" list="crm-variables-list" value="${productVar}" placeholder="e.g. product_interest">
                    </div>

                    <div class="inspector-form-group" style="margin-bottom:8px;">
                        <label style="font-size:0.75rem;"><i class="fa-solid fa-tractor"></i> Land / Farm Size Variable</label>
                        <input type="text" id="node-cl-map-land" list="crm-variables-list" value="${landVar}" placeholder="e.g. land_acres">
                    </div>

                    <div class="inspector-form-group" style="margin-bottom:8px;">
                        <label style="font-size:0.75rem;"><i class="fa-solid fa-clock"></i> Contact Time Field Variable</label>
                        <input type="text" id="node-cl-map-time" list="crm-variables-list" value="${contactTimeVar}" placeholder="e.g. preferred_contact_time">
                    </div>

                    <div class="inspector-form-group" style="margin-bottom:0;">
                        <label style="font-size:0.75rem;"><i class="fa-solid fa-note-sticky"></i> Additional Notes Variable</label>
                        <input type="text" id="node-cl-map-notes" list="crm-variables-list" value="${notesVar}" placeholder="e.g. brush_cutter_type">
                    </div>
                </div>

                <div class="inspector-form-group" style="margin-top:10px;">
                    <label>Next Step Target</label>
                    <select id="node-next-step-select">
                        ${optionsDropdown}
                    </select>
                </div>
            `;
        } else if (node.type === 'assign_to_user') {
            const currentTarget = getTargetNodeIdFromPort(`port-${node.id}-out`);
            const optionsDropdown = getNextNodeOptionsHtml(currentTarget ? `port-${currentTarget}-in` : '');

            fieldsHtml = `
                ${triggerHtml}
                <div class="inspector-form-group">
                    <label>Node Name</label>
                    <input type="text" id="node-name-input" value="${node.name}">
                </div>
                <div class="inspector-form-group">
                    <label>Select Sales Representative</label>
                    <select id="node-atu-agent">
                        <option value="Sales Representative" ${node.config.agentName === 'Sales Representative' ? 'selected' : ''}>Sales Representative (Default)</option>
                        <option value="Agriculture Expert" ${node.config.agentName === 'Agriculture Expert' ? 'selected' : ''}>Agriculture Expert</option>
                        <option value="Regional Manager" ${node.config.agentName === 'Regional Manager' ? 'selected' : ''}>Regional Manager</option>
                    </select>
                </div>
                <div class="inspector-form-group">
                    <label>Handoff Note / Message</label>
                    <textarea id="node-atu-note" rows="2">${node.config.note || ''}</textarea>
                </div>
                <div class="inspector-form-group">
                    <label>Next Step Target</label>
                    <select id="node-next-step-select">
                        ${optionsDropdown}
                    </select>
                </div>
            `;
        } else if (node.type === 'webhook') {
            const currentTarget = getTargetNodeIdFromPort(`port-${node.id}-out`);
            const optionsDropdown = getNextNodeOptionsHtml(currentTarget ? `port-${currentTarget}-in` : '');

            fieldsHtml = `
                ${triggerHtml}
                <div class="inspector-form-group">
                    <label>Node Name</label>
                    <input type="text" id="node-name-input" value="${node.name}">
                </div>
                <div class="inspector-form-group">
                    <label>Webhook URL Endpoint</label>
                    <input type="text" id="node-wh-url" value="${node.config.webhookUrl || ''}" placeholder="https://api.domain.com/endpoint">
                </div>
                <div class="inspector-form-group">
                    <label>HTTP Method</label>
                    <select id="node-wh-method">
                        <option value="POST" ${node.config.method === 'POST' ? 'selected' : ''}>POST</option>
                        <option value="GET" ${node.config.method === 'GET' ? 'selected' : ''}>GET</option>
                        <option value="PUT" ${node.config.method === 'PUT' ? 'selected' : ''}>PUT</option>
                    </select>
                </div>
                <div class="inspector-form-group" style="display:flex; align-items:center; gap:0.5rem; margin-top:0.25rem;">
                    <input type="checkbox" id="node-wh-sendvars" ${node.config.sendVariables !== false ? 'checked' : ''} style="width:auto;">
                    <label for="node-wh-sendvars" style="margin:0; font-size:0.75rem;">Send All Session Variables in Body</label>
                </div>
                <div class="inspector-form-group" style="margin-top:0.5rem;">
                    <label>Next Step Target</label>
                    <select id="node-next-step-select">
                        ${optionsDropdown}
                    </select>
                </div>
            `;
        } else if (node.type === 'end') {
            fieldsHtml = `
                ${triggerHtml}
                <div class="inspector-form-group">
                    <label>Node Name</label>
                    <input type="text" id="node-name-input" value="${node.name}">
                </div>
                <div class="inspector-form-group">
                    <label>Closing Message</label>
                    <textarea id="node-end-msg" rows="3">${node.config.message || ''}</textarea>
                </div>
            `;
        }

        const deleteBtnHtml = node.type !== 'start' ? `<button class="btn-secondary" style="color:var(--danger-color); border-color:#fee2e2; border-radius:0.375rem; font-weight:700; width:100%; display:flex; align-items:center; justify-content:center; gap:0.25rem;" onclick="deleteNode('${node.id}')"><i class="fa-solid fa-trash-can"></i> Delete Node</button>` : '';
        const duplicateBtnHtml = node.type !== 'start' ? `<button class="btn-secondary" style="border-radius:0.375rem; font-weight:700; width:100%; display:flex; align-items:center; justify-content:center; gap:0.25rem;" onclick="duplicateNode('${node.id}')"><i class="fa-solid fa-copy"></i> Duplicate Node</button>` : '';

        inspectorContent.innerHTML = `
            ${fieldsHtml}
            <div style="display:flex; flex-direction:column; gap:0.5rem; margin-top:0.75rem;">
                <button class="btn-primary" style="padding:0.5rem; width:100%; border-radius:0.375rem;" onclick="saveSelectedNodeSettings()">Save Settings</button>
                <div style="display:flex; gap:0.5rem; width:100%;">
                    ${deleteBtnHtml}
                    ${duplicateBtnHtml}
                </div>
            </div>
        `;

        bindInspectorInputs();
    }


    // 10. Live Validation Engine
    function runLiveValidation() {
        const issues = [];

        // Check Start node output
        const hasStartOut = connections.some(c => c.from === 'port-node-start-out');
        if (!hasStartOut) {
            issues.push({ nodeId: 'node-start', text: 'Flow entry point (Start node) has no output connection.' });
        }

        // Loop nodes
        nodes.forEach(node => {
            if (node.type === 'start') return;

            // Check incoming
            const hasIn = connections.some(c => c.to === `port-${node.id}-in`);
            if (!hasIn) {
                issues.push({ nodeId: node.id, text: `Node "${node.name}" is completely disconnected.` });
            }

            // Check Question unconnected options
            if (node.type === 'question') {
                const choices = node.config.choices || [];
                choices.forEach((choice, idx) => {
                    const optionConn = connections.some(c => c.from === `port-${node.id}-out-${idx}`);
                    if (!optionConn) {
                        issues.push({ nodeId: node.id, text: `Question "${node.name}" has unconnected option: "${choice}".` });
                    }
                });
            } else if (node.type !== 'end') {
                // Check simple node output
                const hasOut = connections.some(c => c.from === `port-${node.id}-out`);
                if (!hasOut) {
                    issues.push({ nodeId: node.id, text: `Node "${node.name}" has no next step connected.` });
                }
            }
        });

        // Update Validation Warning UI
        if (issues.length > 0) {
            valWarningCount.textContent = issues.length;
            btnValidationWarning.style.display = 'flex';

            // Populate dropdown list
            valIssuesDropdown.innerHTML = issues.map(iss => `
                <div class="val-issue-item" onclick="focusNodeAndHighlight('${iss.nodeId}')">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <span>${iss.text}</span>
                </div>
            `).join('');
        } else {
            btnValidationWarning.style.display = 'none';
            valIssuesDropdown.style.display = 'none';
        }
    }

    window.toggleValidationDropdown = function () {
        const isShown = valIssuesDropdown.style.display === 'block';
        valIssuesDropdown.style.display = isShown ? 'none' : 'block';
    };

    window.focusNodeAndHighlight = function (nodeId) {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
            selectNode(nodeId);

            // Center viewport on node coordinates
            const viewportWidth = canvasViewport.clientWidth;
            const viewportHeight = canvasViewport.clientHeight;

            zoomLevel = 1.0;
            panX = (viewportWidth / 2) - node.x;
            panY = (viewportHeight / 2) - node.y;

            zoomPercentageEl.textContent = '100%';
            updateCanvasTransform();
        }
    };

    // 11. Test Bot Simulator Highlights & Variables Dump
    let currentSimNodeId = 'node-start';
    let simVariables = {};

    window.toggleTestBotDrawer = function () {
        const drawer = document.getElementById('testBotDrawer');
        const isOpen = drawer.classList.toggle('active');
        if (isOpen) {
            resetTestChat();
        } else {
            // remove execution highlights when closed
            clearExecutionHighlights();
        }
    };

    window.resetTestChat = function () {
        const container = document.getElementById('chatMessageContainer');
        container.innerHTML = '';
        currentSimNodeId = 'node-start';
        simVariables = {};

        appendSystemMessage('WhatsApp Bot Simulation Started');
        clearExecutionHighlights();

        setTimeout(() => {
            proceedSimulation();
        }, 500);
    };

    function clearExecutionHighlights() {
        document.querySelectorAll('.canvas-node').forEach(n => {
            n.classList.remove('active-node');
            n.classList.remove('passed-node');
        });
        document.querySelectorAll('.connection-path').forEach(p => {
            p.classList.remove('active-edge');
        });
    }

    function proceedSimulation() {
        // Remove active node pulsing
        document.querySelectorAll('.canvas-node').forEach(n => n.classList.remove('active-node'));

        if (currentSimNodeId === 'node-start') {
            const startNode = document.getElementById('node-start');
            if (startNode) startNode.classList.add('passed-node');

            const edge = connections.find(c => c.from === 'port-node-start-out');
            if (edge) {
                // Highlight edge path
                highlightActiveEdge(edge.from, edge.to);

                currentSimNodeId = edge.to.replace('port-', '').replace('-in', '');
                executeNodeInSim();
            } else {
                appendSystemMessage('Error: Start node not connected.');
            }
            return;
        }

        const currentNode = nodes.find(n => n.id === currentSimNodeId);
        if (!currentNode) return;

        // Highlight currently active node
        const activeNodeEl = document.getElementById(currentNode.id);
        if (activeNodeEl) {
            activeNodeEl.classList.add('active-node');

            // Scroll view to focus simulated active node
            focusNodeAndHighlight(currentNode.id);
        }

        if (currentNode.disabled) {
            appendSystemMessage(`Simulation Stalled: Node "${currentNode.name}" is disabled.`);
            return;
        }

        if (currentNode.type === 'end') {
            appendBotMessage(currentNode.config.message || 'Thank you!');
            appendSystemMessage('Simulation Completed');
            if (activeNodeEl) {
                activeNodeEl.classList.remove('active-node');
                activeNodeEl.classList.add('passed-node');
            }
            return;
        }

        if (currentNode.type === 'create_lead') {
            appendSystemMessage(`System Log: Created lead record in CRM`);

            setTimeout(() => {
                if (activeNodeEl) {
                    activeNodeEl.classList.remove('active-node');
                    activeNodeEl.classList.add('passed-node');
                }

                const edge = connections.find(c => c.from === `port-${currentSimNodeId}-out`);
                if (edge) {
                    highlightActiveEdge(edge.from, edge.to);
                    currentSimNodeId = edge.to.replace('port-', '').replace('-in', '');
                    executeNodeInSim();
                }
            }, 1000);
            return;
        }

        if (currentNode.type === 'message') {
            appendBotMessage(currentNode.config.message || 'Hello');

            setTimeout(() => {
                if (activeNodeEl) {
                    activeNodeEl.classList.remove('active-node');
                    activeNodeEl.classList.add('passed-node');
                }

                const edge = connections.find(c => c.from === `port-${currentSimNodeId}-out`);
                if (edge) {
                    highlightActiveEdge(edge.from, edge.to);
                    currentSimNodeId = edge.to.replace('port-', '').replace('-in', '');
                    executeNodeInSim();
                }
            }, 1500);
            return;
        }

        if (currentNode.type === 'video' || currentNode.type === 'image' || currentNode.type === 'media' || currentNode.type === 'multi_media') {
            appendMediaCardMessage(currentNode.config, currentNode.type);

            setTimeout(() => {
                if (activeNodeEl) {
                    activeNodeEl.classList.remove('active-node');
                    activeNodeEl.classList.add('passed-node');
                }

                const edge = connections.find(c => c.from === `port-${currentSimNodeId}-out` || c.from.startsWith(`port-${currentSimNodeId}-out`));
                if (edge) {
                    highlightActiveEdge(edge.from, edge.to);
                    currentSimNodeId = edge.to.replace('port-', '').replace('-in', '');
                    executeNodeInSim();
                }
            }, 1200);
            return;
        }

        if (currentNode.type === 'product') {
            appendProductCardMessage(currentNode.config);

            setTimeout(() => {
                if (activeNodeEl) {
                    activeNodeEl.classList.remove('active-node');
                    activeNodeEl.classList.add('passed-node');
                }

                const edge = connections.find(c => c.from === `port-${currentSimNodeId}-out` || c.from.startsWith(`port-${currentSimNodeId}-out`));
                if (edge) {
                    highlightActiveEdge(edge.from, edge.to);
                    currentSimNodeId = edge.to.replace('port-', '').replace('-in', '');
                    executeNodeInSim();
                }
            }, 1200);
            return;
        }

        if (currentNode.type === 'text_input') {
            appendBotMessage(currentNode.config.question || 'Please share your details:');
            return;
        }

        if (currentNode.type === 'contact_time') {
            appendBotMessage(currentNode.config.question || 'Right time to contact you?');
            const slots = currentNode.config.slots || [];
            appendChoicesMessage(slots, (choice) => {
                appendUserMessage(choice);

                // Add variables log
                addSimVariable('Contact Time', choice);

                setTimeout(() => {
                    if (activeNodeEl) {
                        activeNodeEl.classList.remove('active-node');
                        activeNodeEl.classList.add('passed-node');
                    }

                    const edge = connections.find(c => c.from === `port-${currentSimNodeId}-out`);
                    if (edge) {
                        highlightActiveEdge(edge.from, edge.to);
                        currentSimNodeId = edge.to.replace('port-', '').replace('-in', '');
                        executeNodeInSim();
                    }
                }, 800);
            });
            return;
        }

        if (currentNode.type === 'question') {
            appendBotMessage(currentNode.config.question || 'Select an option:');
            const choices = currentNode.config.choices || [];
            appendChoicesMessage(choices, (choice, index) => {
                appendUserMessage(choice);

                // Add variables log
                addSimVariable(currentNode.config.title || 'Product Selection', choice);

                setTimeout(() => {
                    if (activeNodeEl) {
                        activeNodeEl.classList.remove('active-node');
                        activeNodeEl.classList.add('passed-node');
                    }

                    let edge = connections.find(c => c.from === `port-${currentSimNodeId}-out-${index}`);
                    if (!edge) {
                        // Check if edge connects via simple out port or target handle
                        edge = connections.find(c => c.from === `port-${currentSimNodeId}-out`);
                    }

                    if (edge) {
                        highlightActiveEdge(edge.from, edge.to);
                        currentSimNodeId = edge.to.replace('port-', '').replace('-in', '');
                        executeNodeInSim();
                    } else {
                        // Fallback connection mapping logic
                        const fallbackId = currentNode.config.nextSteps ? currentNode.config.nextSteps[choice] : null;
                        if (fallbackId) {
                            currentSimNodeId = fallbackId;
                            executeNodeInSim();
                        } else {
                            appendSystemMessage('Error: Branch connection not found.');
                        }
                    }
                }, 800);
            });
            return;
        }
    }

    function executeNodeInSim() {
        proceedSimulation();
    }

    function highlightActiveEdge(fromPortId, toPortId) {
        document.querySelectorAll('.connection-path').forEach(p => {
            if (p.dataset.from === fromPortId && p.dataset.to === toPortId) {
                p.classList.add('active-edge');
            }
        });
    }

    function addSimVariable(key, val) {
        simVariables[key] = val;

        // Render variables container inside simulator drawer if not exist
        let varBox = document.getElementById('test-bot-variables-dump');
        if (!varBox) {
            varBox = document.createElement('div');
            varBox.id = 'test-bot-variables-dump';
            varBox.className = 'test-bot-variables';
            document.querySelector('#testBotDrawer .drawer-body').appendChild(varBox);
        }

        varBox.innerHTML = `<strong>Collected Variables:</strong><br>` + Object.entries(simVariables).map(([k, v]) => `
            <span class="variable-tag">${k}: ${v}</span>
        `).join('');
    }

    // Message appenders helpers
    function appendBotMessage(text) {
        const container = document.getElementById('chatMessageContainer');
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble bot';
        bubble.innerHTML = `
            <div>${text}</div>
            <span class="chat-bubble-timestamp">${getCurrentTime()}</span>
        `;
        container.appendChild(bubble);
        container.scrollTop = container.scrollHeight;
    }

    // User message appender
    function appendUserMessage(text) {
        const container = document.getElementById('chatMessageContainer');
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble user';
        bubble.innerHTML = `
            <div>${text}</div>
            <span class="chat-bubble-timestamp">${getCurrentTime()}</span>
        `;
        container.appendChild(bubble);
        container.scrollTop = container.scrollHeight;
    }

    function appendSystemMessage(text) {
        const container = document.getElementById('chatMessageContainer');
        const bubble = document.createElement('div');
        bubble.style.alignSelf = 'center';
        bubble.style.background = '#e2e8f0';
        bubble.style.color = '#475569';
        bubble.style.fontSize = '0.68rem';
        bubble.style.padding = '0.2rem 0.5rem';
        bubble.style.borderRadius = '0.25rem';
        bubble.style.margin = '0.25rem 0';
        bubble.style.fontWeight = '600';
        bubble.style.textAlign = 'center';
        bubble.textContent = text;
        container.appendChild(bubble);
        container.scrollTop = container.scrollHeight;
    }

    function appendProductCardMessage(config) {
        const container = document.getElementById('chatMessageContainer');
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble bot';
        bubble.style.padding = '0.45rem';
        bubble.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:0.4rem; width:100%; max-width:200px;">
                <img src="${config.image || 'https://images.unsplash.com/photo-1599824434955-443a02302305?w=150'}" style="width:100%; height:120px; object-fit:cover; border-radius:0.375rem;">
                <div style="font-weight:700; font-size:0.8rem; color:var(--text-main);">${config.product || 'Product Name'}</div>
                <div style="font-size:0.75rem; color:#f97316; font-weight:700;">${config.price || 'Price'}</div>
                <div style="font-size:0.68rem; color:var(--text-muted);">${config.desc || ''}</div>
            </div>
            <span class="chat-bubble-timestamp">${getCurrentTime()}</span>
        `;
        container.appendChild(bubble);
        container.scrollTop = container.scrollHeight;
    }

    function appendMediaCardMessage(config, type) {
        const container = document.getElementById('chatMessageContainer');
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble bot';
        bubble.style.padding = '0.45rem';
        const mediaUrl = config.mediaUrl || config.file_url || config.video_url || config.image_url || 'https://images.unsplash.com/photo-1599824434955-443a02302305?w=500';
        const caption = config.caption || config.message || (type === 'video' ? 'Product Demonstration Video' : 'Media Attachment');

        if (type === 'video') {
            bubble.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:0.3rem; width:100%; max-width:220px;">
                    <div style="background:#0f172a; border-radius:6px; overflow:hidden; position:relative; text-align:center; padding:15px 5px; color:#ffffff;">
                        <i class="fa-solid fa-circle-play" style="font-size:2rem; color:#22c55e;"></i>
                        <div style="font-size:0.7rem; margin-top:4px; font-weight:600;">VIDEO DEMO</div>
                    </div>
                    <div style="font-size:0.75rem; font-weight:600; color:var(--text-main);"><i class="fa-solid fa-video" style="color:#22c55e;"></i> ${caption}</div>
                </div>
                <span class="chat-bubble-timestamp">${getCurrentTime()}</span>
            `;
        } else {
            bubble.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:0.3rem; width:100%; max-width:200px;">
                    <img src="${mediaUrl}" style="width:100%; height:110px; object-fit:cover; border-radius:0.375rem;">
                    ${caption ? `<div style="font-size:0.7rem; color:var(--text-main); font-weight:600;">${caption}</div>` : ''}
                </div>
                <span class="chat-bubble-timestamp">${getCurrentTime()}</span>
            `;
        }
        container.appendChild(bubble);
        container.scrollTop = container.scrollHeight;
    }

    function appendChoicesMessage(choices, onSelect) {
        const container = document.getElementById('chatMessageContainer');
        const div = document.createElement('div');
        div.className = 'chat-choices-container';
        div.style.alignSelf = 'stretch';

        choices.forEach((choice, idx) => {
            const btn = document.createElement('button');
            btn.className = 'chat-choice-btn';
            btn.textContent = choice;
            btn.addEventListener('click', () => {
                div.remove();
                onSelect(choice, idx);
            });
            div.appendChild(btn);
        });

        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    window.sendChatMessageSim = function () {
        const input = document.getElementById('chatInputMessage');
        const text = input.value.trim();
        if (!text) return;

        input.value = '';
        appendUserMessage(text);

        // check if text input node is active and waiting for variable answer
        const currentNode = nodes.find(n => n.id === currentSimNodeId);
        if (currentNode && currentNode.type === 'text_input') {
            addSimVariable('Name & Place', text);

            const activeNodeEl = document.getElementById(currentNode.id);
            setTimeout(() => {
                if (activeNodeEl) {
                    activeNodeEl.classList.remove('active-node');
                    activeNodeEl.classList.add('passed-node');
                }

                const edge = connections.find(c => c.from === `port-${currentSimNodeId}-out`);
                if (edge) {
                    highlightActiveEdge(edge.from, edge.to);
                    currentSimNodeId = edge.to.replace('port-', '').replace('-in', '');
                    executeNodeInSim();
                }
            }, 800);
        }
    };

    window.handleChatEnter = function (e) {
        if (e.key === 'Enter') {
            sendChatMessageSim();
        }
    };

    function getCurrentTime() {
        const now = new Date();
        let hours = now.getHours();
        let minutes = now.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        minutes = minutes < 10 ? '0' + minutes : minutes;
        return `${hours}:${minutes} ${ampm}`;
    }

    // 12. Help overlay modal
    window.openHelpPanel = function () {
        document.getElementById('helpModal').style.display = 'flex';
    };

    window.closeHelpPanel = function () {
        document.getElementById('helpModal').style.display = 'none';
    };

    // 13. Customer Preview modal
    window.triggerPreview = function () {
        const feed = document.getElementById('previewChatFeed');
        feed.innerHTML = '';
        document.getElementById('previewModal').style.display = 'flex';

        // Prepopulate preview with dialogue flow
        const previewDialog = [
            { type: 'bot', text: 'Sir, what do you need?' },
            { type: 'user', text: 'Full Set' },
            { type: 'bot', text: 'How much Acre land do you have sir?' },
            { type: 'user', text: '2 - 5 Acre' },
            { type: 'bot', text: 'Product card: Machine 16K & 21K — ₹16,000 - ₹21,000' },
            { type: 'bot', text: 'Right time to contact you?' },
            { type: 'user', text: '9:30 AM - 1:00 PM' }
        ];

        let delay = 300;
        previewDialog.forEach(msg => {
            setTimeout(() => {
                const bubble = document.createElement('div');
                bubble.className = `chat-bubble ${msg.type}`;
                bubble.innerHTML = `
                    <div>${msg.text}</div>
                    <span class="chat-bubble-timestamp">11:30 AM</span>
                `;
                feed.appendChild(bubble);
                feed.scrollTop = feed.scrollHeight;
            }, delay);
            delay += 500;
        });
    };

    window.closePreviewModal = function () {
        document.getElementById('previewModal').style.display = 'none';
    };

    window.goBackToFlows = function (e) {
        if (e) e.preventDefault();
        const targetUrl = (document.referrer && (document.referrer.includes('templates.html') || document.referrer.includes('flows.html')))
            ? document.referrer
            : 'flows.html';

        if (hasUnsavedChanges) {
            pendingNavigationTarget = targetUrl;
            openUnsavedChangesModal();
        } else {
            window.location.href = targetUrl;
        }
    };

    window.openUnsavedChangesModal = function () {
        const modal = document.getElementById('unsavedChangesModal');
        if (modal) modal.style.display = 'flex';
    };

    window.closeUnsavedChangesModal = function () {
        const modal = document.getElementById('unsavedChangesModal');
        if (modal) modal.style.display = 'none';
        pendingNavigationTarget = null;
    };

    window.confirmSaveAndLeave = async function () {
        const modal = document.getElementById('unsavedChangesModal');
        const saveBtn = modal ? modal.querySelector('.btn-primary') : null;
        let oldHtml = '';
        if (saveBtn) {
            oldHtml = saveBtn.innerHTML;
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        }
        try {
            await saveFlowDraft(true);
            hasUnsavedChanges = false;
            closeUnsavedChangesModal();
            window.location.href = pendingNavigationTarget || 'flows.html';
        } catch (err) {
            console.error('[SAVE AND LEAVE ERROR]', err);
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = oldHtml || 'Save & Leave';
            }
            window.showAlert("Save Failed", err.message || "Failed to save draft before exit.", "error");
        }
    };

    window.confirmLeaveWithoutSaving = function () {
        hasUnsavedChanges = false;
        closeUnsavedChangesModal();
        window.location.href = pendingNavigationTarget || 'flows.html';
    };

    window.toggleAutoSaveMode = function () {
        isAutoSaveEnabled = !isAutoSaveEnabled;
        const dot = document.getElementById('autoSaveBadgeDot');
        const label = document.getElementById('autoSaveToggleLabel');

        if (dot) dot.style.backgroundColor = isAutoSaveEnabled ? '#10b981' : '#94a3b8';
        if (label) label.textContent = isAutoSaveEnabled ? 'Auto-Save: ON' : 'Auto-Save: OFF';

        if (isAutoSaveEnabled) {
            showSaveIndicator("Auto-Save: ON");
            triggerAutoSave();
        } else {
            showSaveIndicator("Auto-Save: OFF");
        }
    };

    window.triggerAutoSave = function () {
        if (!isAutoSaveEnabled) return;
        if (autoSaveTimer) clearTimeout(autoSaveTimer);

        showSaveIndicator("Auto-Saving in 1s...");

        autoSaveTimer = setTimeout(async () => {
            await saveFlowDraft(true); // true = silent background auto save
        }, 1000);
    };

    window.saveFlowDraft = async function (isSilent = false) {
        const btn = document.getElementById('btn-save-draft');
        let oldHtml = '';
        if (btn && !isSilent) {
            oldHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        }
        showSaveIndicator(isSilent ? "Auto-Saving..." : "Saving...");

        // Ensure Start Node contains trigger configurations matching Flow Settings
        const startNode = nodes.find(n => n.type === 'start');
        if (startNode) {
            startNode.config.triggerType = flowSettings.triggerType || 'Keyword';
            startNode.config.keywords = flowSettings.keywords || '';
            startNode.config.language = flowSettings.language || 'English';
        }

        // Map frontend nodes to backend structure
        const mappedNodes = nodes.map(n => ({
            id: n.id,
            type: n.type,
            name: n.name,
            position: { x: Math.round(n.x), y: Math.round(n.y) },
            config: n.config || {},
            disabled: !!n.disabled
        }));

        // Map frontend connections to backend edges
        const mappedEdges = connections.map(conn => {
            const fromParts = conn.from.split('-');
            let sourceHandle = null;
            let sourceNodeId = conn.from.replace('port-', '').split('-out')[0];

            if (fromParts.length > 4 && fromParts[fromParts.length - 2] === 'out') {
                // Choice option index branch
                const choiceIndex = parseInt(fromParts[fromParts.length - 1]);
                const sourceNode = nodes.find(n => n.id === sourceNodeId);
                if (sourceNode && sourceNode.config && sourceNode.config.choices) {
                    sourceHandle = sourceNode.config.choices[choiceIndex];
                }
            }

            const targetNodeId = conn.to.replace('port-', '').split('-in')[0];

            return {
                source: sourceNodeId,
                target: targetNodeId,
                sourceHandle: sourceHandle,
                targetHandle: null
            };
        });

        // Backend expects options arrays inside Question/Contact_Time nodes to carry nextNode targets
        // Let's populate config.options automatically for backend FlowEngine compatibility
        mappedNodes.forEach(n => {
            if (n.type === 'question' && n.config.choices) {
                n.config.options = n.config.choices.map((choice, idx) => {
                    const matchedEdge = mappedEdges.find(e => e.source === n.id && e.sourceHandle === choice);
                    return {
                        label: choice,
                        value: choice.toLowerCase().trim().replace(/\s+/g, '_'),
                        nextNode: matchedEdge ? matchedEdge.target : null
                    };
                });
            }
            if (n.type === 'contact_time' && n.config.slots) {
                n.config.options = n.config.slots.map((choice, idx) => {
                    const matchedEdge = mappedEdges.find(e => e.source === n.id && e.sourceHandle === choice);
                    return {
                        label: choice,
                        value: choice.toLowerCase().trim().replace(/\s+/g, '_'),
                        nextNode: matchedEdge ? matchedEdge.target : null
                    };
                });
            }
            // Map flat saveTo field to saveResponseTo for FlowEngine database compatibility
            if (n.config && n.config.saveTo) {
                n.config.saveResponseTo = n.config.saveTo;
            }
        });

        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${window.API_URL}/chatbot/flows/${currentFlowId}/draft`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    nodes: mappedNodes,
                    edges: mappedEdges,
                    settings: {
                        name: flowSettings.name,
                        description: flowSettings.description,
                        category: 'enquiry', // default category
                        status: flowSettings.status
                    }
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || errData.error || 'Save draft request failed');
            }

            hasUnsavedChanges = false;
            showSaveIndicator(isSilent ? "Auto-Saved just now" : "Saved just now");
            if (!isSilent) {
                window.showAlert("Draft Saved", "Chatbot flow draft saved to database successfully.", "success");
            }
        } catch (err) {
            console.error('[SAVE DRAFT ERROR]', err);
            showSaveIndicator("Error saving changes");
            if (!isSilent) {
                window.showAlert("Save Failed", err.message, "error");
            }
        } finally {
            if (btn && !isSilent) {
                btn.disabled = false;
                btn.innerHTML = oldHtml;
            }
        }
    };

    window.publishActiveFlow = function () {
        // Run validation first!
        runLiveValidation();
        const warningBtn = document.getElementById('btn-validation-warning');
        if (warningBtn.style.display !== 'none') {
            window.showAlert("Validation Failed", "Cannot publish flow with disconnected or unconnected paths. Check issues dropdown.", "danger");
            return;
        }

        document.getElementById('pubModalFlowName').textContent = flowSettings.name;
        document.getElementById('pubModalVersion').textContent = '1.2.0';
        document.getElementById('publishModal').style.display = 'flex';
    };

    window.closePublishModal = function () {
        document.getElementById('publishModal').style.display = 'none';
    };

    window.confirmPublishFlow = async function () {
        const btn = document.querySelector('#publishModal .btn-primary');
        const oldText = btn.textContent;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publishing...';

        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${window.API_URL}/chatbot/flows/${currentFlowId}/publish`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || 'Publish request failed');
            }

            const data = await res.json();

            closePublishModal();
            window.showAlert("Flow Published", `Active Version is now v${data.active_version}!`, "success");

            // Reload flow details to sync latest draft version state
            await fetchFlowDetails(currentFlowId);
        } catch (err) {
            console.error('[PUBLISH FLOW ERROR]', err);
            window.showAlert("Publish Failed", err.message, "error");
        } finally {
            btn.disabled = false;
            btn.innerHTML = oldText;
        }
    };

    // Search toolbox nodes library
    const componentSearch = document.getElementById('componentSearch');
    if (componentSearch) {
        componentSearch.addEventListener('input', () => {
            const query = componentSearch.value.trim().toLowerCase();
            let matchedAny = false;

            document.querySelectorAll('.node-group').forEach(group => {
                let groupHasMatches = false;
                const items = group.querySelectorAll('.draggable-node-item');

                items.forEach(item => {
                    const name = item.querySelector('.node-item-name').textContent.toLowerCase();
                    const desc = item.querySelector('.node-item-desc').textContent.toLowerCase();
                    const matches = name.includes(query) || desc.includes(query);
                    item.style.display = matches ? 'flex' : 'none';
                    if (matches) {
                        groupHasMatches = true;
                        matchedAny = true;
                    }
                });

                group.style.display = groupHasMatches ? 'block' : 'none';
            });

            let placeholder = document.getElementById('search-empty-placeholder');
            if (!matchedAny) {
                if (!placeholder) {
                    placeholder = document.createElement('div');
                    placeholder.id = 'search-empty-placeholder';
                    placeholder.className = 'inspector-placeholder';
                    placeholder.innerHTML = `
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <p>No components found.</p>
                    `;
                    document.getElementById('nodeLibraryContainer').appendChild(placeholder);
                }
            } else {
                if (placeholder) placeholder.remove();
            }
        });
    }

    // 15. Collapsible Document Panel
    window.toggleDocPanel = function () {
        const grid = document.getElementById('docCardsGrid');
        const icon = document.getElementById('docToggleIcon');
        const isCollapsed = grid.style.display === 'none';

        grid.style.display = isCollapsed ? 'grid' : 'none';
        icon.className = isCollapsed ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down';
    };

    // 16. Keyboard controls (Undo/Redo, Delete Key)
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

            if (selectedNodeId) {
                deleteNode(selectedNodeId);
            } else if (selectedEdge) {
                deleteConnection();
            }
        } else if (e.ctrlKey && e.key === 'z') {
            triggerUndo();
        } else if (e.ctrlKey && e.key === 'y') {
            triggerRedo();
        } else if (e.key === 'Escape') {
            closeInspector();
        } else if (e.key === 'f' || e.key === 'F') {
            if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
            fitCanvasView();
        }
    });

    // History Snapshots helpers
    function saveStateForUndo() {
        hasUnsavedChanges = true;
        showSaveIndicator("Unsaved changes");
        const snap = {
            nodes: JSON.parse(JSON.stringify(nodes)),
            connections: JSON.parse(JSON.stringify(connections)),
            flowSettings: JSON.parse(JSON.stringify(flowSettings))
        };
        undoStack.push(snap);
        redoStack.length = 0; // Clear redo stack on new action
    }

    window.triggerUndo = function () {
        if (undoStack.length === 0) return;

        const currentSnap = {
            nodes: JSON.parse(JSON.stringify(nodes)),
            connections: JSON.parse(JSON.stringify(connections)),
            flowSettings: JSON.parse(JSON.stringify(flowSettings))
        };
        redoStack.push(currentSnap);

        const prev = undoStack.pop();
        nodes.length = 0;
        nodes.push(...prev.nodes);
        connections.length = 0;
        connections.push(...prev.connections);
        Object.assign(flowSettings, prev.flowSettings);

        renderCanvasNodes();
        deselectAll();
        runLiveValidation();
        showSaveIndicator("Unsaved changes");
    };

    window.triggerRedo = function () {
        if (redoStack.length === 0) return;

        const currentSnap = {
            nodes: JSON.parse(JSON.stringify(nodes)),
            connections: JSON.parse(JSON.stringify(connections)),
            flowSettings: JSON.parse(JSON.stringify(flowSettings))
        };
        undoStack.push(currentSnap);

        const next = redoStack.pop();
        nodes.length = 0;
        nodes.push(...next.nodes);
        connections.length = 0;
        connections.push(...next.connections);
        Object.assign(flowSettings, next.flowSettings);

        renderCanvasNodes();
        deselectAll();
        runLiveValidation();
        showSaveIndicator("Unsaved changes");
    };

    function showSaveIndicator(text) {
        if (saveStatusIndicator) {
            if (text.includes("Saving") || text.includes("Auto-Saving")) {
                saveStatusIndicator.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color:#3b82f6;"></i> ${text}`;
            } else if (text.includes("Unsaved")) {
                saveStatusIndicator.innerHTML = `<i class="fa-solid fa-circle-dot" style="color:#eab308;"></i> ${text}`;
            } else if (text.includes("Error")) {
                saveStatusIndicator.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#ef4444;"></i> ${text}`;
            } else {
                saveStatusIndicator.innerHTML = `<i class="fa-solid fa-cloud-check" style="color:#10b981;"></i> ${text}`;
            }
        }

        if (text === "Unsaved changes" && typeof isAutoSaveEnabled !== 'undefined' && isAutoSaveEnabled) {
            triggerAutoSave();
        }
    }

    // ─── Extra Helper Implementations ───
    function deselectAll() {
        document.querySelectorAll('.canvas-node').forEach(n => n.classList.remove('selected'));
        document.querySelectorAll('.connection-path').forEach(p => p.classList.remove('active-edge'));
        selectedNodeId = null;
        selectedEdge = null;
        inspectorContent.innerHTML = `<div class="inspector-placeholder"><i class="fa-solid fa-mouse-pointer"></i><p>Select a node to configure it</p></div>`;
    }

    window.selectNode = function (id) {
        deselectAll();
        selectedNodeId = id;
        const el = document.getElementById(id);
        if (el) el.classList.add('selected');

        const node = nodes.find(n => n.id === id);
        if (node) {
            renderNodeSettingsForm(node);
            const inspector = document.getElementById('flow-inspector');
            if (inspector) inspector.classList.add('active');
        }
    };

    // Node selection and dragging registry
    canvas.addEventListener('mousedown', (e) => {
        const nodeCard = e.target.closest('.canvas-node');
        if (nodeCard) {
            if (e.target.closest('.port, .btn-add-next')) return; // let connections handles trigger
            e.stopPropagation();

            selectNode(nodeCard.id);

            // Drag initialization
            activeDragNode = nodes.find(n => n.id === nodeCard.id);
            if (activeDragNode) {
                dragStartX = e.clientX;
                dragStartY = e.clientY;
                nodeStartX = activeDragNode.x;
                nodeStartY = activeDragNode.y;
            }
        } else {
            closeInspector();
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (activeDragNode && !isPanning && !isConnecting) {
            activeDragNode.x = nodeStartX + (e.clientX - dragStartX) / zoomLevel;
            activeDragNode.y = nodeStartY + (e.clientY - dragStartY) / zoomLevel;

            // Update DOM element position in real-time
            const el = document.getElementById(activeDragNode.id);
            if (el) {
                el.style.left = `${activeDragNode.x}px`;
                el.style.top = `${activeDragNode.y}px`;
            }
            drawConnections();
        }
    });

    document.addEventListener('mouseup', () => {
        if (activeDragNode) {
            activeDragNode = null;
            showSaveIndicator("Unsaved changes");
        }
    });

    window.deleteNode = function (id) {
        if (id === 'node-start') return;
        saveStateForUndo();

        const idx = nodes.findIndex(n => n.id === id);
        if (idx !== -1) {
            nodes.splice(idx, 1);

            // Remove connected links
            for (let i = connections.length - 1; i >= 0; i--) {
                const c = connections[i];
                if (c.from.includes(id) || c.to.includes(id)) {
                    connections.splice(i, 1);
                }
            }

            if (selectedNodeId === id) deselectAll();
            renderCanvasNodes();
            runLiveValidation();
            showSaveIndicator("Unsaved changes");
        }
        customContextMenu.style.display = 'none';
    };

    window.duplicateNode = function (id) {
        if (id === 'node-start') return;
        saveStateForUndo();

        const node = nodes.find(n => n.id === id);
        if (node) {
            const count = nodes.filter(n => n.type === node.type).length + 1;
            const newId = `node-${Date.now()}`;

            const newNode = {
                id: newId,
                type: node.type,
                name: `${node.name.split(' ')[0]} ${count}`,
                x: node.x + 40,
                y: node.y + 40,
                config: JSON.parse(JSON.stringify(node.config)),
                disabled: false
            };

            nodes.push(newNode);
            renderCanvasNodes();
            selectNode(newId);
            runLiveValidation();
            showSaveIndicator("Unsaved changes");
        }
        customContextMenu.style.display = 'none';
    };

    window.addNodeToCanvas = function (type) {
        if (type === 'start') {
            const startNode = nodes.find(n => n.type === 'start');
            if (startNode) {
                selectNode(startNode.id);
                if (typeof window.showAlert === 'function') {
                    window.showAlert("Start Node Exists", "A chatbot flow can only have one Start node. We selected the existing Start node for you.", "info");
                }
                customContextMenu.style.display = 'none';
                return;
            }
        }

        saveStateForUndo();
        const count = nodes.filter(n => n.type === type).length + 1;
        const matched = allPickerNodes.find(n => n.type === type);
        const name = matched ? matched.name : 'Node';
        const newId = type === 'start' ? 'node-start' : `node-${Date.now()}`;

        // Place near canvas center relative coordinates
        const viewportRect = canvasViewport.getBoundingClientRect();
        const centerX = (-panX + viewportRect.width / 2) / zoomLevel;
        const centerY = (-panY + viewportRect.height / 2) / zoomLevel;

        const newNode = {
            id: newId,
            type: type,
            name: type === 'start' ? 'Start' : `${name} ${count}`,
            x: centerX,
            y: centerY,
            config: getDefaultNodeConfig(type),
            disabled: false
        };

        nodes.push(newNode);
        renderCanvasNodes();
        selectNode(newId);
        runLiveValidation();
        showSaveIndicator("Unsaved changes");
        customContextMenu.style.display = 'none';
    };

    window.fitCanvasView = function () {
        if (nodes.length === 0) return;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        nodes.forEach(n => {
            if (n.x < minX) minX = n.x;
            if (n.x > maxX) maxX = n.x;
            if (n.y < minY) minY = n.y;
            if (n.y > maxY) maxY = n.y;
        });

        // Add padding
        minX -= 100;
        maxX += 250;
        minY -= 80;
        maxY += 150;

        const boundsWidth = maxX - minX;
        const boundsHeight = maxY - minY;
        const viewportWidth = canvasViewport.clientWidth || canvasViewport.offsetWidth || window.innerWidth - 300;
        const viewportHeight = canvasViewport.clientHeight || canvasViewport.offsetHeight || window.innerHeight - 120;

        // Guard: if still zero, bail and center simply
        if (!viewportWidth || !viewportHeight) {
            panX = 150;
            panY = 80;
            zoomLevel = 1.0;
            if (zoomPercentageEl) zoomPercentageEl.textContent = '100%';
            updateCanvasTransform();
            return;
        }

        // Auto calculate optimal zoom scale
        const scaleX = viewportWidth / boundsWidth;
        const scaleY = viewportHeight / boundsHeight;
        zoomLevel = Math.max(0.4, Math.min(1.2, Math.min(scaleX, scaleY)));

        // Panning offsets centering
        panX = (viewportWidth / 2) - (minX + boundsWidth / 2) * zoomLevel;
        panY = (viewportHeight / 2) - (minY + boundsHeight / 2) * zoomLevel;

        zoomPercentageEl.textContent = `${Math.round(zoomLevel * 100)}%`;
        updateCanvasTransform();
        if (customContextMenu) customContextMenu.style.display = 'none';
    };

    window.toggleCanvasGrid = function () {
        const hasGrid = canvas.classList.toggle('dot-grid');
        if (canvasViewport) {
            canvasViewport.classList.toggle('no-grid', !hasGrid);
        }
        gridToggleBtn.classList.toggle('active', hasGrid);
        if (customContextMenu) customContextMenu.style.display = 'none';
    };

    window.autoOrganizeLayout = function () {
        if (nodes.length === 0) return;
        saveStateForUndo();

        const colStartX = 80;
        const colWidth = 280;
        const startY = 180;

        const columns = [[], [], [], [], [], [], []];

        nodes.forEach(n => {
            if (n.type === 'start') {
                columns[0].push(n);
            } else if (n.id === 'node-1' || n.name.toLowerCase().includes('step 1')) {
                columns[1].push(n);
            } else if (n.type === 'question' && (n.id === 'node-2' || n.id === 'node-3' || n.name.toLowerCase().includes('step 2') || n.name.toLowerCase().includes('brush'))) {
                columns[2].push(n);
            } else if (['product', 'image', 'video', 'media', 'document', 'audio', 'multi_media', 'message'].includes(n.type)) {
                columns[3].push(n);
            } else if (['contact_time', 'text_input', 'number_input', 'buttons', 'list'].includes(n.type)) {
                columns[4].push(n);
            } else if (['create_lead', 'save_lead_field', 'assign_to_user', 'webhook', 'human_handoff'].includes(n.type)) {
                columns[5].push(n);
            } else if (n.type === 'end') {
                columns[6].push(n);
            } else {
                columns[2].push(n);
            }
        });

        columns.forEach((colNodes, colIdx) => {
            const x = colStartX + colIdx * colWidth;
            const totalHeight = colNodes.length * 150;
            const startPosY = Math.max(60, startY - (totalHeight / 4));

            colNodes.forEach((n, rowIdx) => {
                n.x = x;
                n.y = startPosY + rowIdx * 150;
            });
        });

        renderCanvasNodes();
        fitCanvasView();
        showSaveIndicator("Unsaved changes");
    };

    // Google Forms Style Choices Editor helpers
    window.addChoiceOption = function () {
        const node = nodes.find(n => n.id === selectedNodeId);
        if (node && ['question', 'buttons', 'list'].includes(node.type)) {
            saveStateForUndo();
            if (!node.config.choices) node.config.choices = [];
            node.config.choices.push(`Option ${node.config.choices.length + 1}`);

            renderNodeSettingsForm(node);
            renderCanvasNodes();
            runLiveValidation();
        }
    };

    window.deleteChoiceOption = function (index) {
        const node = nodes.find(n => n.id === selectedNodeId);
        if (node && ['question', 'buttons', 'list'].includes(node.type)) {
            saveStateForUndo();
            node.config.choices.splice(index, 1);

            // Remove connection for this choice index
            const edgeIdx = connections.findIndex(c => c.from === `port-${node.id}-out-${index}`);
            if (edgeIdx !== -1) connections.splice(edgeIdx, 1);

            // Shift connections for remaining options with index > deleted index
            connections.forEach(c => {
                if (c.from.startsWith(`port-${node.id}-out-`)) {
                    const idx = parseInt(c.from.split(`port-${node.id}-out-`)[1]);
                    if (idx > index) {
                        c.from = `port-${node.id}-out-${idx - 1}`;
                    }
                }
            });

            renderNodeSettingsForm(node);
            renderCanvasNodes();
            runLiveValidation();
        }
    };

    window.addQuestionChoice = window.addChoiceOption;
    window.deleteQuestionChoice = window.deleteChoiceOption;

    window.addTimeSlot = function () {
        const node = nodes.find(n => n.id === selectedNodeId);
        if (node && node.type === 'contact_time') {
            saveStateForUndo();
            if (!node.config.slots) node.config.slots = [];
            node.config.slots.push('10:00 AM - 1:00 PM');
            renderNodeSettingsForm(node);
            renderCanvasNodes();
        }
    };

    window.deleteTimeSlot = function (index) {
        const node = nodes.find(n => n.id === selectedNodeId);
        if (node && node.type === 'contact_time') {
            saveStateForUndo();
            node.config.slots.splice(index, 1);
            renderNodeSettingsForm(node);
            renderCanvasNodes();
        }
    };

    window.addMediaItem = function () {
        const node = nodes.find(n => n.id === selectedNodeId);
        if (node && node.type === 'multi_media') {
            saveStateForUndo();
            if (!node.config.mediaItems) node.config.mediaItems = [];
            node.config.mediaItems.push('https://images.unsplash.com/photo-1599824434955-443a02302305?w=500');
            renderNodeSettingsForm(node);
            renderCanvasNodes();
        }
    };

    window.deleteMediaItem = function (index) {
        const node = nodes.find(n => n.id === selectedNodeId);
        if (node && node.type === 'multi_media') {
            saveStateForUndo();
            node.config.mediaItems.splice(index, 1);
            renderNodeSettingsForm(node);
            renderCanvasNodes();
        }
    };

    // Catalog Products List (Loaded dynamically ONLY from Products & Media page / API)
    let catalogProducts = [];

    async function loadCatalogProductsFromAPI() {
        try {
            const token = localStorage.getItem('token');
            const baseUrl = window.API_URL || 'http://localhost:5000/api';
            const resp = await fetch(`${baseUrl}/chatbot/products`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (resp.ok) {
                const data = await resp.json();
                if (Array.isArray(data)) {
                    catalogProducts = data;
                }
            }
        } catch (err) {
            console.error('[Catalog Products Fetch Error]', err);
        }
    }
    loadCatalogProductsFromAPI();

    window.onCatalogProductSelectChange = function (selectEl) {
        const selectedVal = selectEl.value;
        if (!selectedVal) return;

        // Find catalog product
        const prod = catalogProducts.find(p => p.name === selectedVal || String(p.id) === selectedVal);
        if (!prod) return;

        // Auto fill form inputs
        const priceInput = document.getElementById('node-p-price');
        const descInput = document.getElementById('node-p-desc');
        const imageInput = document.getElementById('node-p-image');
        const previewImg = document.getElementById('product-img-preview');
        const previewContainer = document.getElementById('product-img-preview-container');
        const emptyBox = document.getElementById('product-img-empty-box');
        const browseText = document.getElementById('btn-browse-p-text');
        const nameInput = document.getElementById('node-name-input');

        const rawPrice = parseFloat(prod.price || prod.selling_price || 0);
        const formattedPrice = !isNaN(rawPrice) && rawPrice > 0 ? `₹${rawPrice.toLocaleString('en-IN')}` : (prod.price || '');
        
        let imgUrl = prod.image_url || '';
        if (!imgUrl && Array.isArray(prod.gallery_urls) && prod.gallery_urls.length > 0) {
            imgUrl = prod.gallery_urls[0];
        }

        if (priceInput) priceInput.value = formattedPrice;
        if (descInput) descInput.value = prod.description || '';
        if (imageInput) imageInput.value = imgUrl;

        if (imgUrl) {
            if (previewImg) previewImg.src = imgUrl;
            if (previewContainer) previewContainer.style.display = 'block';
            if (emptyBox) emptyBox.style.display = 'none';
            if (browseText) browseText.textContent = 'Change Image';
        } else {
            if (previewContainer) previewContainer.style.display = 'none';
            if (emptyBox) emptyBox.style.display = 'block';
            if (browseText) browseText.textContent = 'Choose Image File';
        }

        // Auto fill node title and configuration
        const node = nodes.find(n => n.id === selectedNodeId);
        if (node && node.type === 'product') {
            node.config.product = prod.name;
            node.config.productId = prod.id;
            node.config.price = formattedPrice;
            node.config.desc = prod.description || '';
            node.config.image = imgUrl;

            if (!nameInput.value || nameInput.value.startsWith('Send details') || nameInput.value.startsWith('Recommend') || nameInput.value === 'Product Node') {
                node.name = `Send details of ${prod.name}`;
                nameInput.value = node.name;
            }

            renderCanvasNodes();
            showSaveIndicator("Unsaved changes");
        }
    };

    window.syncSelectedCatalogProductDetails = function () {
        const selectEl = document.getElementById('node-p-select');
        if (selectEl) window.onCatalogProductSelectChange(selectEl);
    };

    window.openProductFilePicker = function () {
        const fileInput = document.getElementById('node-p-file-input');
        if (fileInput) fileInput.click();
    };

    window.removeProductImage = function (e) {
        if (e) e.stopPropagation();
        const hiddenInput = document.getElementById('node-p-image');
        const previewContainer = document.getElementById('product-img-preview-container');
        const emptyBox = document.getElementById('product-img-empty-box');
        const previewImg = document.getElementById('product-img-preview');
        const fileInput = document.getElementById('node-p-file-input');
        const browseText = document.getElementById('btn-browse-p-text');

        if (hiddenInput) hiddenInput.value = '';
        if (fileInput) fileInput.value = '';
        if (previewImg) previewImg.src = '';
        if (previewContainer) previewContainer.style.display = 'none';
        if (emptyBox) emptyBox.style.display = 'block';
        if (browseText) browseText.textContent = 'Choose Image File';

        const node = nodes.find(n => n.id === selectedNodeId);
        if (node && node.type === 'product') {
            node.config.image = '';
            renderCanvasNodes();
            showSaveIndicator("Unsaved changes");
        }
    };

    function bindInspectorInputs() {
        // Universal live field typing & dropdown listener for real-time Auto-Save
        const inspectorBody = document.getElementById('inspector-content');
        if (inspectorBody) {
            const handleLiveFieldChange = () => {
                const node = nodes.find(n => n.id === selectedNodeId);
                if (node) {
                    window.saveSelectedNodeSettingsSilently();
                    showSaveIndicator("Unsaved changes");
                }
            };

            inspectorBody.querySelectorAll('input, textarea, select').forEach(el => {
                el.addEventListener('input', handleLiveFieldChange);
                el.addEventListener('change', handleLiveFieldChange);
            });
        }

        // live typing listeners for Node Name
        const nameInput = document.getElementById('node-name-input');
        if (nameInput) {
            nameInput.addEventListener('input', () => {
                const node = nodes.find(n => n.id === selectedNodeId);
                if (node) {
                    node.name = nameInput.value;
                    const el = document.getElementById(node.id);
                    if (el) el.querySelector('.node-type').textContent = node.name;
                    showSaveIndicator("Unsaved changes");
                }
            });
        }

        // Product Image File Input Listener
        const pFileInput = document.getElementById('node-p-file-input');
        if (pFileInput) {
            pFileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                if (!file.type.startsWith('image/')) {
                    if (typeof window.showAlert === 'function') window.showAlert('Invalid File', 'Please select a valid image file.', 'warning');
                    return;
                }

                // Local Base64 FileReader preview
                const reader = new FileReader();
                reader.onload = function (evt) {
                    const dataUrl = evt.target.result;
                    const hiddenInput = document.getElementById('node-p-image');
                    const previewContainer = document.getElementById('product-img-preview-container');
                    const emptyBox = document.getElementById('product-img-empty-box');
                    const previewImg = document.getElementById('product-img-preview');
                    const browseText = document.getElementById('btn-browse-p-text');

                    if (hiddenInput) hiddenInput.value = dataUrl;
                    if (previewImg) previewImg.src = dataUrl;
                    if (previewContainer) previewContainer.style.display = 'block';
                    if (emptyBox) emptyBox.style.display = 'none';
                    if (browseText) browseText.textContent = 'Change Image';

                    const node = nodes.find(n => n.id === selectedNodeId);
                    if (node && node.type === 'product') {
                        node.config.image = dataUrl;
                        renderCanvasNodes();
                        showSaveIndicator("Unsaved changes");
                    }
                };
                reader.readAsDataURL(file);

                // Async upload attempt to backend API
                try {
                    const formData = new FormData();
                    formData.append('file', file);
                    const token = localStorage.getItem('token');
                    const resp = await fetch('/api/chatbot/media/upload', {
                        method: 'POST',
                        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                        body: formData
                    });
                    if (resp.ok) {
                        const data = await resp.json();
                        const uploadedUrl = Array.isArray(data) ? data[0]?.file_url : data?.file_url;
                        if (uploadedUrl) {
                            const hiddenInput = document.getElementById('node-p-image');
                            if (hiddenInput) hiddenInput.value = uploadedUrl;
                            const node = nodes.find(n => n.id === selectedNodeId);
                            if (node && node.type === 'product') {
                                node.config.image = uploadedUrl;
                                renderCanvasNodes();
                            }
                        }
                    }
                } catch (err) {
                    console.log('[Media Upload] Local DataURL preview fallback active.');
                }
            });
        }

        // Drag and drop for product-image-picker-box
        const dropBox = document.querySelector('.product-image-picker-box');
        if (dropBox) {
            ['dragenter', 'dragover'].forEach(evtName => {
                dropBox.addEventListener(evtName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropBox.style.borderColor = '#6366f1';
                    dropBox.style.background = '#eff6ff';
                });
            });
            ['dragleave', 'drop'].forEach(evtName => {
                dropBox.addEventListener(evtName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropBox.style.borderColor = '#cbd5e1';
                    dropBox.style.background = '#f8fafc';
                });
            });
            dropBox.addEventListener('drop', (e) => {
                const files = e.dataTransfer ? e.dataTransfer.files : null;
                if (files && files.length > 0) {
                    const inputEl = document.getElementById('node-p-file-input');
                    if (inputEl) {
                        inputEl.files = files;
                        inputEl.dispatchEvent(new Event('change'));
                    }
                }
            });
        }
    }

    // ─── Connection drawing implementation ───
    function drawConnections() {
        connectionSvg.innerHTML = '';

        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.innerHTML = `
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#64748b" />
            </marker>
            <marker id="arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#eab308" />
            </marker>
            <marker id="arrow-selected" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#8b5cf6" />
            </marker>
        `;
        connectionSvg.appendChild(defs);

        const canvasRect = canvas.getBoundingClientRect();

        connections.forEach(conn => {
            const startPort = document.getElementById(conn.from);
            const endPort = document.getElementById(conn.to);
            if (!startPort || !endPort) return;

            const startRect = startPort.getBoundingClientRect();
            const endRect = endPort.getBoundingClientRect();

            const x1 = (startRect.left - canvasRect.left + startRect.width / 2) / zoomLevel;
            const y1 = (startRect.top - canvasRect.top + startRect.height / 2) / zoomLevel;

            const x2 = (endRect.left - canvasRect.left + endRect.width / 2) / zoomLevel;
            const y2 = (endRect.top - canvasRect.top + endRect.height / 2) / zoomLevel;

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.dataset.from = conn.from;
            path.dataset.to = conn.to;

            const isSelected = (selectedEdge === conn);
            const pathClass = conn.active === false ? 'connection-path disabled-edge' : (isSelected ? 'connection-path active-edge' : 'connection-path');
            path.setAttribute('class', pathClass);

            const markerId = conn.active === false ? '' : (isSelected ? 'url(#arrow-selected)' : 'url(#arrow)');
            path.setAttribute('marker-end', markerId);

            const dx = x2 - x1;
            const dy = y2 - y1;
            let pathD = '';

            if (dx >= 20) {
                // Forward curve: smooth left-to-right flow
                const controlOffset = Math.min(Math.max(40, dx * 0.45), 160);
                pathD = `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;
            } else {
                // Backward curve or target node is to the left: route around node cards
                const verticalDist = Math.abs(dy);
                const controlOffset = Math.max(60, verticalDist * 0.4);
                const cury1 = y1 + (dy >= 0 ? 40 : -40);
                const cury2 = y2 + (dy >= 0 ? -40 : 40);
                pathD = `M ${x1} ${y1} C ${x1 + controlOffset} ${cury1}, ${x2 - controlOffset} ${cury2}, ${x2} ${y2}`;
            }

            path.setAttribute('d', pathD);

            path.addEventListener('click', (e) => {
                e.stopPropagation();
                deselectAll();
                selectedEdge = conn;
                path.setAttribute('class', 'connection-path active-edge');
                drawConnections(); // Redraw to highlight selection and show delete button
            });

            connectionSvg.appendChild(path);

            // Midpoint delete circle
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;

            const deleteGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            deleteGroup.setAttribute('class', 'edge-delete-btn');
            deleteGroup.style.cursor = 'pointer';
            deleteGroup.style.opacity = (selectedEdge === conn) ? '1' : '0';
            deleteGroup.style.transition = 'opacity 0.2s';

            deleteGroup.innerHTML = `
                <circle cx="${midX}" cy="${midY}" r="9" fill="#ef4444" stroke="#ffffff" stroke-width="1.5" />
                <text x="${midX}" y="${midY + 3.5}" fill="#ffffff" font-size="11" font-weight="900" text-anchor="middle">×</text>
            `;

            path.addEventListener('mouseenter', () => deleteGroup.style.opacity = '1');
            path.addEventListener('mouseleave', () => {
                if (selectedEdge !== conn) deleteGroup.style.opacity = '0';
            });
            deleteGroup.addEventListener('mouseenter', () => deleteGroup.style.opacity = '1');
            deleteGroup.addEventListener('mouseleave', () => {
                if (selectedEdge !== conn) deleteGroup.style.opacity = '0';
            });

            deleteGroup.addEventListener('click', (e) => {
                e.stopPropagation();
                saveStateForUndo();
                const idx = connections.findIndex(c => c.from === conn.from && c.to === conn.to);
                if (idx !== -1) {
                    connections.splice(idx, 1);
                    selectedEdge = null;
                    renderCanvasNodes();
                    runLiveValidation();
                    showSaveIndicator("Unsaved changes");
                }
            });

            connectionSvg.appendChild(deleteGroup);
        });
    }

    function renderCanvasNodes() {
        const container = document.getElementById('nodes-container');
        container.innerHTML = '';
        nodes.forEach(n => {
            renderNodeOnCanvas(n);
        });
        drawConnections();
    }

    // ─── Sliding Sidebar Drawer Controls ───
    window.toggleToolbox = function () {
        const toolbox = document.getElementById('flow-toolbox');
        const toggleBtn = document.getElementById('toolbox-toggle-btn');
        const toggleIcon = document.getElementById('toolbox-toggle-icon');

        const isActive = toolbox.classList.toggle('active');
        if (isActive) {
            toggleBtn.style.left = '280px';
            toggleIcon.className = 'fa-solid fa-chevron-left';
        } else {
            toggleBtn.style.left = '0';
            toggleIcon.className = 'fa-solid fa-chevron-right';
        }
    };

    window.closeInspector = function () {
        const inspector = document.getElementById('flow-inspector');
        if (inspector) inspector.classList.remove('active');

        // Remove select highlights on nodes
        document.querySelectorAll('.canvas-node').forEach(n => n.classList.remove('selected'));
        selectedNodeId = null;
    };

    window.selectInspectorTab = function (tabName) {
        currentInspectorTab = tabName;

        const tabNode = document.getElementById('tabNodeSettings');
        const tabFlow = document.getElementById('tabFlowSettings');
        if (tabNode) tabNode.classList.toggle('active', tabName === 'node');
        if (tabFlow) tabFlow.classList.toggle('active', tabName === 'flow');

        if (tabName === 'node') {
            const node = nodes.find(n => n.id === selectedNodeId);
            if (node) {
                renderNodeSettingsForm(node);
            } else {
                inspectorContent.innerHTML = `<div class="inspector-placeholder"><i class="fa-solid fa-mouse-pointer"></i><p>Select a node to configure it</p></div>`;
            }
        } else if (tabName === 'flow') {
            loadCrmCampaignsForFlowSettings().then(campaigns => {
                const campaignSelectEl = document.getElementById('flow-campaign-select');
                if (campaignSelectEl && Array.isArray(campaigns) && campaigns.length > 0) {
                    campaignSelectEl.innerHTML = campaigns.map(c => {
                        const tagLineDisplay = c.tag_line ? (c.tag_line.length > 40 ? c.tag_line.substring(0, 40) + '...' : c.tag_line) : 'No Tagline';
                        const isSelected = (flowSettings.campaignId === c.campaign_id || flowSettings.campaignId === String(c.id) || flowSettings.campaignTagline === c.tag_line) ? 'selected' : '';
                        return `<option value="${c.campaign_id}" data-tagline="${encodeURIComponent(c.tag_line || '')}" ${isSelected}>${c.campaign_id} — "${tagLineDisplay}"</option>`;
                    }).join('');
                }
            });

            const campaignOptionsHtml = (cachedCrmCampaigns.length > 0)
                ? cachedCrmCampaigns.map(c => {
                    const tagLineDisplay = c.tag_line ? (c.tag_line.length > 40 ? c.tag_line.substring(0, 40) + '...' : c.tag_line) : 'No Tagline';
                    const isSelected = (flowSettings.campaignId === c.campaign_id || flowSettings.campaignId === String(c.id) || flowSettings.campaignTagline === c.tag_line) ? 'selected' : '';
                    return `<option value="${c.campaign_id}" data-tagline="${encodeURIComponent(c.tag_line || '')}" ${isSelected}>${c.campaign_id} — "${tagLineDisplay}"</option>`;
                }).join('')
                : `<option value="">Loading Campaigns...</option>`;

            inspectorContent.innerHTML = `
                <div class="inspector-form-group">
                    <label for="flow-name-input">Flow Name</label>
                    <input type="text" id="flow-name-input" value="${flowSettings.name}">
                </div>
                <div class="inspector-form-group">
                    <label for="flow-desc-input">Description</label>
                    <textarea id="flow-desc-input">${flowSettings.description}</textarea>
                </div>
                <div class="inspector-form-group">
                    <label for="flow-status-select">Flow Status</label>
                    <select id="flow-status-select">
                        <option value="active" ${flowSettings.status === 'active' ? 'selected' : ''}>Active</option>
                        <option value="draft" ${flowSettings.status === 'draft' ? 'selected' : ''}>Draft</option>
                    </select>
                </div>
                <div class="inspector-form-group">
                    <label for="flow-trigger-type">Trigger Type</label>
                    <select id="flow-trigger-type" onchange="toggleFlowTriggerInputs()">
                        <option value="Keyword" ${flowSettings.triggerType === 'Keyword' ? 'selected' : ''}>Keyword Trigger</option>
                        <option value="Campaign" ${flowSettings.triggerType === 'Campaign' ? 'selected' : ''}>Marketing Campaign</option>
                        <option value="Default" ${flowSettings.triggerType === 'Default' ? 'selected' : ''}>Default WhatsApp Entry</option>
                    </select>
                </div>
                <div class="inspector-form-group" id="flow-trigger-keyword-wrap" style="display:${flowSettings.triggerType === 'Keyword' ? 'block' : 'none'};">
                    <label for="flow-keywords-input">Trigger Keywords (comma separated)</label>
                    <input type="text" id="flow-keywords-input" value="${flowSettings.keywords || ''}">
                </div>
                <div class="inspector-form-group" id="flow-trigger-campaign-wrap" style="display:${flowSettings.triggerType === 'Campaign' ? 'block' : 'none'};">
                    <label for="flow-campaign-select">Link to CRM Campaign (Matched by Tag Line)</label>
                    <select id="flow-campaign-select" onchange="onFlowCampaignSelectChange()">
                        ${campaignOptionsHtml}
                    </select>
                    <div id="flow-campaign-tagline-preview" style="font-size:0.75rem; color:#6366f1; font-weight:600; margin-top:4px;">
                        ${flowSettings.campaignTagline ? `Trigger Tag Line: "${flowSettings.campaignTagline}"` : ''}
                    </div>
                </div>
                <div class="inspector-form-group">
                    <label for="flow-language-select">Conversation Language</label>
                    <select id="flow-language-select">
                        <option value="English" ${flowSettings.language === 'English' ? 'selected' : ''}>English</option>
                        <option value="Kannada" ${flowSettings.language === 'Kannada' ? 'selected' : ''}>Kannada (ಕನ್ನಡ)</option>
                        <option value="Hindi" ${flowSettings.language === 'Hindi' ? 'selected' : ''}>Hindi (हिंदी)</option>
                        <option value="Tamil" ${flowSettings.language === 'Tamil' ? 'selected' : ''}>Tamil (தமிழ்)</option>
                        <option value="Telugu" ${flowSettings.language === 'Telugu' ? 'selected' : ''}>Telugu (తెలుగు)</option>
                        <option value="Marathi" ${flowSettings.language === 'Marathi' ? 'selected' : ''}>Marathi (मराठी)</option>
                        <option value="Malayalam" ${flowSettings.language === 'Malayalam' ? 'selected' : ''}>Malayalam (മലയാളം)</option>
                        <option value="None" ${flowSettings.language === 'None' ? 'selected' : ''}>None (Unassigned)</option>
                    </select>
                </div>
                <button class="btn-primary" style="padding:0.5rem; width:100%; border-radius:0.375rem; margin-top:1rem;" onclick="saveGeneralFlowSettings()">Save Flow Settings</button>
            `;
        }
    };

    let cachedCrmCampaigns = [];
    async function loadCrmCampaignsForFlowSettings() {
        if (cachedCrmCampaigns.length > 0) return cachedCrmCampaigns;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${window.API_URL}/campaigns`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                const allList = Array.isArray(data) ? data : (data.campaigns || []);
                // Include ONLY active status campaigns
                cachedCrmCampaigns = allList.filter(c => (c.status || '').toLowerCase() === 'active');
            }
        } catch (err) {
            console.error('[FLOW SETTINGS CAMPAIGNS FETCH ERROR]', err);
        }
        return cachedCrmCampaigns;
    }

    window.onFlowCampaignSelectChange = function () {
        const select = document.getElementById('flow-campaign-select');
        if (!select) return;
        const selectedOpt = select.options[select.selectedIndex];
        if (selectedOpt) {
            const rawTagLine = decodeURIComponent(selectedOpt.getAttribute('data-tagline') || '');
            flowSettings.campaignId = select.value;
            flowSettings.campaignTagline = rawTagLine;
            if (rawTagLine) {
                flowSettings.keywords = rawTagLine;
            }
            const previewEl = document.getElementById('flow-campaign-tagline-preview');
            if (previewEl) {
                previewEl.textContent = rawTagLine ? `Trigger Tag Line: "${rawTagLine}"` : '';
            }
        }
    };

    window.toggleFlowTriggerInputs = function () {
        const type = document.getElementById('flow-trigger-type').value;
        document.getElementById('flow-trigger-keyword-wrap').style.display = type === 'Keyword' ? 'block' : 'none';
        document.getElementById('flow-trigger-campaign-wrap').style.display = type === 'Campaign' ? 'block' : 'none';
    };

    window.saveGeneralFlowSettings = async function () {
        saveStateForUndo();
        flowSettings.name = document.getElementById('flow-name-input').value;
        flowSettings.description = document.getElementById('flow-desc-input').value;
        flowSettings.status = document.getElementById('flow-status-select').value;
        flowSettings.triggerType = document.getElementById('flow-trigger-type').value;

        if (flowSettings.triggerType === 'Keyword') {
            flowSettings.keywords = document.getElementById('flow-keywords-input').value;
        } else if (flowSettings.triggerType === 'Campaign') {
            const campaignSelect = document.getElementById('flow-campaign-select');
            if (campaignSelect && campaignSelect.options[campaignSelect.selectedIndex]) {
                const opt = campaignSelect.options[campaignSelect.selectedIndex];
                const rawTagLine = decodeURIComponent(opt.getAttribute('data-tagline') || '');
                flowSettings.campaignId = campaignSelect.value;
                flowSettings.campaignTagline = rawTagLine;
                flowSettings.keywords = rawTagLine || campaignSelect.value;
            }
        }

        flowSettings.language = document.getElementById('flow-language-select').value;

        // Reflect name in header breadcrumbs
        document.getElementById('headerFlowName').textContent = flowSettings.name;

        // Reflect status badge
        const badge = document.getElementById('headerFlowStatus');
        if (badge) {
            badge.className = `flow-status-badge status-${flowSettings.status}`;
            badge.textContent = flowSettings.status.charAt(0).toUpperCase() + flowSettings.status.slice(1);
        }

        await saveFlowDraft();
    };

    // ─── Canvas Startup Positioning
    setTimeout(() => {
        renderCanvasNodes();
        fitCanvasView();
        runLiveValidation();
    }, 200);
    // Browser tab close / reload protection
    window.addEventListener('beforeunload', (e) => {
        if (hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
});
