/* ==========================================================================
   FlowService - Chatbot API Client for Templates & Flow Management
   ========================================================================== */

class FlowService {
    constructor() {
        this.baseUrl = `${window.API_URL || 'http://localhost:5000/api'}/chatbot`;
    }

    getAuthHeaders() {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    /**
     * Get system predefined templates
     */
    async getTemplates() {
        try {
            const res = await fetch(`${this.baseUrl}/templates`, {
                headers: this.getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to fetch templates');
            return await res.json();
        } catch (err) {
            console.error('[FlowService.getTemplates Error]', err);
            throw err;
        }
    }

    /**
     * Get all chatbot flows from database
     */
    async getFlows() {
        try {
            const res = await fetch(`${this.baseUrl}/flows`, {
                headers: this.getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to fetch flows');
            const data = await res.json();
            
            // Format flow records to match UI expectations
            return data.map(f => ({
                id: f.flow_id,
                name: f.name,
                description: f.description || '',
                category: f.category || 'Enquiry',
                status: f.status || 'draft',
                currentVersion: f.active_version ? `v${f.active_version}` : 'v1.0 (Draft)',
                triggerType: f.triggerType || 'Keyword',
                triggerKeywords: f.triggerKeywords || [],
                lastModified: f.updated_at ? new Date(f.updated_at).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric'
                }) : 'Just now',
                createdBy: f.creator_name || 'Admin User',
                userInitials: f.creator_name ? f.creator_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'AD',
                metrics: {
                    leads: f.lead_count || 0,
                    completionRate: f.total_sessions > 0 ? Math.round((f.completed_sessions / f.total_sessions) * 100) : 0,
                    conversionRate: f.total_sessions > 0 ? Math.round((f.lead_count / f.total_sessions) * 100) : 0
                }
            }));
        } catch (err) {
            console.error('[FlowService.getFlows Error]', err);
            throw err;
        }
    }

    /**
     * Get specific flow details
     */
    async getFlow(flowId) {
        try {
            const res = await fetch(`${this.baseUrl}/flows/${flowId}`, {
                headers: this.getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to fetch flow details');
            return await res.json();
        } catch (err) {
            console.error('[FlowService.getFlow Error]', err);
            throw err;
        }
    }

    /**
     * Create a new flow
     */
    async createFlow(flowData) {
        try {
            const res = await fetch(`${this.baseUrl}/flows`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(flowData)
            });
            if (!res.ok) throw new Error('Failed to create flow');
            const data = await res.json();
            return {
                id: data.flow_id,
                name: flowData.name,
                description: flowData.description || '',
                category: flowData.category || 'Enquiry',
                status: 'draft',
                currentVersion: 'v1.0 (Draft)',
                triggerType: flowData.triggerType || 'Keyword',
                triggerKeywords: Array.isArray(flowData.keywords) ? flowData.keywords : [],
                lastModified: 'Just now',
                createdBy: 'You',
                userInitials: 'YOU',
                metrics: { leads: 0, completionRate: 0, conversionRate: 0 }
            };
        } catch (err) {
            console.error('[FlowService.createFlow Error]', err);
            throw err;
        }
    }

    /**
     * Create flow from a template
     */
    async createFlowFromTemplate(templateId, options) {
        try {
            const res = await fetch(`${this.baseUrl}/flows/from-template`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    templateId,
                    name: options.name,
                    description: options.description,
                    category: options.category,
                    keywords: options.keywords
                })
            });
            if (!res.ok) throw new Error('Failed to create flow from template');
            const data = await res.json();
            return {
                id: data.flow_id,
                name: options.name,
                description: options.description || '',
                category: options.category || 'Enquiry',
                status: 'draft',
                currentVersion: 'v1.0 (Draft)',
                triggerType: 'Keyword',
                triggerKeywords: Array.isArray(options.keywords) ? options.keywords : [],
                lastModified: 'Just now',
                createdBy: 'You',
                userInitials: 'YOU',
                metrics: { leads: 0, completionRate: 0, conversionRate: 0 }
            };
        } catch (err) {
            console.error('[FlowService.createFlowFromTemplate Error]', err);
            throw err;
        }
    }

    /**
     * Duplicate existing flow
     */
    async duplicateFlow(flowId, options) {
        try {
            const res = await fetch(`${this.baseUrl}/flows/${flowId}/duplicate`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ name: options.name })
            });
            if (!res.ok) throw new Error('Failed to duplicate flow');
            const data = await res.json();
            return {
                id: data.duplicated_flow_id,
                name: options.name,
                description: 'Duplicated flow',
                category: 'Enquiry',
                status: 'draft',
                currentVersion: 'v1.0 (Draft)',
                triggerType: 'Keyword',
                triggerKeywords: [],
                lastModified: 'Just now',
                createdBy: 'You',
                userInitials: 'YOU',
                metrics: { leads: 0, completionRate: 0, conversionRate: 0 }
            };
        } catch (err) {
            console.error('[FlowService.duplicateFlow Error]', err);
            throw err;
        }
    }

    /**
     * Delete/Archive flow
     */
    async deleteFlow(flowId) {
        try {
            const res = await fetch(`${this.baseUrl}/flows/${flowId}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to delete flow');
            return await res.json();
        } catch (err) {
            console.error('[FlowService.deleteFlow Error]', err);
            throw err;
        }
    }

    async updateFlowStatus(flowId, status) {
        try {
            const res = await fetch(`${this.baseUrl}/flows/${flowId}/status`, {
                method: 'PATCH',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ status })
            });
            if (!res.ok) throw new Error('Failed to update flow status');
            return await res.json();
        } catch (err) {
            console.error('[FlowService.updateFlowStatus Error]', err);
            throw err;
        }
    }

    /**
     * Get products catalog from Products & Media
     */
    async getProducts() {
        try {
            const res = await fetch(`${this.baseUrl}/products`, {
                headers: this.getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to fetch products');
            return await res.json();
        } catch (err) {
            console.error('[FlowService.getProducts Error]', err);
            return [];
        }
    }
}

// Attach to window object for global availability
window.FlowService = FlowService;
