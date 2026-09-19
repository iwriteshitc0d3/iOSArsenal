/**
 * iOSArsenal API Client Engine
 * Provides structured access to the iOS pentest dataset via the REST API,
 * with transparent, automatic in-memory fallback to data.js & localStorage
 * when running offline, on GitHub Pages, or via file://.
 */
class ArsenalApiClient {
  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
    this.isOnline = false;
    this.initializationPromise = this.checkHealth();
  }

  async checkHealth() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`${this.baseUrl}/stats`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        this.isOnline = true;
        return true;
      }
    } catch (err) {
      // Server not reachable, use client fallback
    }
    this.isOnline = false;
    return false;
  }

  // --- Stats ---
  async getStats() {
    if (this.isOnline) {
      try {
        const res = await fetch(`${this.baseUrl}/stats`);
        if (res.ok) {
          const json = await res.json();
          return json.data;
        }
      } catch (e) {}
    }
    // Local fallback
    const reviewed = await this.getReviewed();
    const reviewedCount = Object.values(reviewed).filter(Boolean).length;
    const total = (typeof DATA !== 'undefined') ? DATA.length : 0;
    return {
      playbooks: total,
      masweCatalogue: 119,
      categoriesCount: (typeof CATS !== 'undefined') ? CATS.length : 8,
      deepDiveGuides: ((typeof JAILBREAKS !== 'undefined' ? JAILBREAKS.length : 0) +
                       (typeof JBDETECT !== 'undefined' ? JBDETECT.length : 0) +
                       (typeof SSLPIN !== 'undefined' ? SSLPIN.length : 0)),
      reviewed: reviewedCount,
      percentageReviewed: total ? Math.round((reviewedCount / total) * 100) : 0
    };
  }

  // --- Categories ---
  async getCategories() {
    if (this.isOnline) {
      try {
        const res = await fetch(`${this.baseUrl}/categories`);
        if (res.ok) {
          const json = await res.json();
          return json.data;
        }
      } catch (e) {}
    }
    // Local fallback
    if (typeof CATS === 'undefined' || typeof DATA === 'undefined') return [];
    return CATS.map(c => ({
      ...c,
      count: DATA.filter(d => d.cat === c.key).length
    }));
  }

  async getCategory(key) {
    if (this.isOnline) {
      try {
        const res = await fetch(`${this.baseUrl}/categories/${encodeURIComponent(key)}`);
        if (res.ok) {
          const json = await res.json();
          return json.data;
        }
      } catch (e) {}
    }
    // Local fallback
    if (typeof CATS === 'undefined' || typeof DATA === 'undefined') return null;
    const cat = CATS.find(c => c.key.toLowerCase() === key.toLowerCase());
    if (!cat) return null;
    const playbooks = DATA.filter(d => d.cat.toLowerCase() === key.toLowerCase());
    return { ...cat, count: playbooks.length, playbooks };
  }

  // --- Playbooks ---
  async getPlaybooks(params = {}) {
    if (this.isOnline) {
      try {
        const qs = new URLSearchParams();
        if (params.cat) qs.set('cat', params.cat);
        if (params.sev && params.sev !== 'all') qs.set('sev', params.sev);
        if (params.q) qs.set('q', params.q);
        if (params.sort) qs.set('sort', params.sort);
        if (params.tool) qs.set('tool', params.tool);

        const url = `${this.baseUrl}/playbooks${qs.toString() ? '?' + qs.toString() : ''}`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          return json.data;
        }
      } catch (e) {}
    }

    // Local fallback
    if (typeof DATA === 'undefined') return [];
    let items = [...DATA];

    if (params.cat) {
      const catList = params.cat.toLowerCase().split(',');
      items = items.filter(d => catList.includes(d.cat.toLowerCase()));
    }
    if (params.sev && params.sev !== 'all') {
      const sevList = params.sev.toLowerCase().split(',');
      items = items.filter(d => sevList.includes(d.sev.toLowerCase()));
    }
    if (params.tool) {
      const searchTool = params.tool.toLowerCase();
      items = items.filter(d => (d.tools || []).some(t => t.toLowerCase().includes(searchTool)));
    }
    if (params.q) {
      const q = params.q.toLowerCase().trim();
      items = items.filter(d => {
        const methodsStr = (d.methods || []).map(m => `${m.title} ${m.cmd}`).join(' ');
        const toolsStr = (d.tools || []).join(' ');
        const hay = `${d.id} ${d.title} ${d.summary} ${d.attacker} ${d.masvs} ${d.mastg} ${d.mitigation} ${toolsStr} ${methodsStr}`.toLowerCase();
        return hay.includes(q);
      });
    }

    return items;
  }

  async getPlaybook(id) {
    if (this.isOnline) {
      try {
        const res = await fetch(`${this.baseUrl}/playbooks/${encodeURIComponent(id)}`);
        if (res.ok) {
          const json = await res.json();
          return json.data;
        }
      } catch (e) {}
    }
    if (typeof DATA === 'undefined') return null;
    const pb = DATA.find(d => d.id.toLowerCase() === id.toLowerCase());
    if (!pb) return null;
    const cat = (typeof CATS !== 'undefined') ? CATS.find(c => c.key === pb.cat) : null;
    return { ...pb, categoryMeta: cat };
  }

  // --- Modules ---
  async getModules(type) {
    if (type) {
      if (this.isOnline) {
        try {
          const res = await fetch(`${this.baseUrl}/modules/${encodeURIComponent(type)}`);
          if (res.ok) {
            const json = await res.json();
            return json.data;
          }
        } catch (e) {}
      }
      if (type === 'jailbreaks' && typeof JAILBREAKS !== 'undefined') return JAILBREAKS;
      if (type === 'jbdetect' && typeof JBDETECT !== 'undefined') return JBDETECT;
      if (type === 'sslpin' && typeof SSLPIN !== 'undefined') return SSLPIN;
      return [];
    }

    if (this.isOnline) {
      try {
        const res = await fetch(`${this.baseUrl}/modules`);
        if (res.ok) {
          const json = await res.json();
          return json.data;
        }
      } catch (e) {}
    }

    return {
      jailbreaks: { title: 'Jailbreaking a Test Device', items: typeof JAILBREAKS !== 'undefined' ? JAILBREAKS : [] },
      jbdetect: { title: 'Jailbreak Detection Bypass', items: typeof JBDETECT !== 'undefined' ? JBDETECT : [] },
      sslpin: { title: 'SSL / Certificate Pinning Bypass', items: typeof SSLPIN !== 'undefined' ? SSLPIN : [] }
    };
  }

  // --- Reviewed tracking ---
  async getReviewed() {
    let localReviewed = {};
    try {
      const stored = localStorage.getItem('ios-arsenal-reviewed');
      if (stored) localReviewed = JSON.parse(stored);
    } catch (e) {}

    if (this.isOnline) {
      try {
        const res = await fetch(`${this.baseUrl}/reviewed`);
        if (res.ok) {
          const json = await res.json();
          const serverReviewed = json.data || {};
          // Merge server and local
          const merged = { ...localReviewed, ...serverReviewed };
          return merged;
        }
      } catch (e) {}
    }

    return localReviewed;
  }

  async setReviewed(id, reviewed) {
    // 1. Always update local storage first
    let current = {};
    try {
      const stored = localStorage.getItem('ios-arsenal-reviewed');
      if (stored) current = JSON.parse(stored);
      current[id] = !!reviewed;
      localStorage.setItem('ios-arsenal-reviewed', JSON.stringify(current));
    } catch (e) {}

    // 2. Sync to API if online
    if (this.isOnline) {
      try {
        await fetch(`${this.baseUrl}/reviewed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, reviewed: !!reviewed })
        });
      } catch (e) {}
    }
    return current;
  }

  async clearReviewed() {
    try {
      localStorage.removeItem('ios-arsenal-reviewed');
    } catch (e) {}

    if (this.isOnline) {
      try {
        await fetch(`${this.baseUrl}/reviewed`, { method: 'DELETE' });
      } catch (e) {}
    }
    return {};
  }
}

// Attach to window
window.ArsenalApiClient = ArsenalApiClient;
window.api = new ArsenalApiClient();
