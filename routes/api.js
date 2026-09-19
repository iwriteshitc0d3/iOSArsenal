const express = require('express');
const fs = require('fs');
const path = require('path');
const { CATS, DATA, JAILBREAKS, JBDETECT, SSLPIN } = require('../data.js');

const router = express.Router();

// File path for server-side persistence of reviewed state
const REVIEWED_FILE = path.join(__dirname, '..', 'data', 'reviewed.json');

// Helper to read reviewed state from file with fallback
function getStoredReviewed() {
  try {
    if (fs.existsSync(REVIEWED_FILE)) {
      const content = fs.readFileSync(REVIEWED_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.warn('Could not read reviewed state file:', err.message);
  }
  return {};
}

// Helper to save reviewed state to file
function saveStoredReviewed(state) {
  try {
    const dir = path.dirname(REVIEWED_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(REVIEWED_FILE, JSON.stringify(state, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Could not save reviewed state:', err.message);
    return false;
  }
}

/**
 * GET /api
 * API Index & Documentation
 */
router.get('/', (req, res) => {
  res.json({
    name: 'iOSArsenal API',
    version: '1.0.0',
    description: 'RESTful API engine providing structured access to iOS penetration testing playbooks, categories, deep-dive modules, and tracking state.',
    endpoints: {
      stats: { method: 'GET', path: '/api/stats', description: 'Summary statistics across all playbooks and categories' },
      categories: { method: 'GET', path: '/api/categories', description: 'List all MASVS categories with playbook counts' },
      categoryDetail: { method: 'GET', path: '/api/categories/:key', description: 'Get a category and its playbooks' },
      playbooks: {
        method: 'GET',
        path: '/api/playbooks',
        description: 'Query playbooks with optional filters: ?cat, ?sev, ?q, ?tool, ?sort, ?limit, ?offset'
      },
      playbookDetail: { method: 'GET', path: '/api/playbooks/:id', description: 'Get a single playbook by ID' },
      modules: { method: 'GET', path: '/api/modules', description: 'List available deep-dive guide modules' },
      moduleItems: { method: 'GET', path: '/api/modules/:type', description: 'Get deep-dive items for jailbreaks, jbdetect, or sslpin' },
      reviewed: {
        get: { method: 'GET', path: '/api/reviewed', description: 'Get current reviewed checks map' },
        update: { method: 'POST', path: '/api/reviewed', description: 'Set reviewed status for an ID or batch' },
        clear: { method: 'DELETE', path: '/api/reviewed', description: 'Reset all reviewed checks' }
      },
      export: { method: 'GET', path: '/api/export', description: 'Export complete dataset as JSON' }
    }
  });
});

/**
 * GET /api/stats
 * Summary stats
 */
router.get('/stats', (req, res) => {
  const reviewed = getStoredReviewed();
  const reviewedCount = Object.values(reviewed).filter(Boolean).length;
  const total = DATA.length;

  const severityCounts = {
    critical: DATA.filter(d => d.sev === 'critical').length,
    high: DATA.filter(d => d.sev === 'high').length,
    medium: DATA.filter(d => d.sev === 'medium').length,
    low: DATA.filter(d => d.sev === 'low').length
  };

  const categoryCounts = {};
  CATS.forEach(c => {
    categoryCounts[c.key] = DATA.filter(d => d.cat === c.key).length;
  });

  res.json({
    success: true,
    data: {
      playbooks: total,
      masweCatalogue: 119,
      categoriesCount: CATS.length,
      deepDiveGuides: JAILBREAKS.length + JBDETECT.length + SSLPIN.length,
      reviewed: reviewedCount,
      percentageReviewed: total > 0 ? Math.round((reviewedCount / total) * 100) : 0,
      severityCounts,
      categoryCounts
    }
  });
});

/**
 * GET /api/categories
 * List all categories with counts
 */
router.get('/categories', (req, res) => {
  const categoriesWithCounts = CATS.map(c => {
    const count = DATA.filter(d => d.cat === c.key).length;
    return {
      ...c,
      count
    };
  });

  res.json({
    success: true,
    total: categoriesWithCounts.length,
    data: categoriesWithCounts
  });
});

/**
 * GET /api/categories/:key
 * Category detail with all associated playbooks
 */
router.get('/categories/:key', (req, res) => {
  const { key } = req.params;
  const category = CATS.find(c => c.key.toLowerCase() === key.toLowerCase());

  if (!category) {
    return res.status(404).json({
      success: false,
      error: `Category '${key}' not found.`
    });
  }

  const playbooks = DATA.filter(d => d.cat.toLowerCase() === key.toLowerCase());

  res.json({
    success: true,
    data: {
      ...category,
      count: playbooks.length,
      playbooks
    }
  });
});

/**
 * GET /api/playbooks
 * Query playbooks with filtering, searching, and sorting
 */
router.get('/playbooks', (req, res) => {
  let { cat, sev, q, tool, sort, limit, offset } = req.query;
  let items = [...DATA];

  // Category filter
  if (cat) {
    const catList = cat.split(',').map(c => c.trim().toLowerCase());
    items = items.filter(d => catList.includes(d.cat.toLowerCase()));
  }

  // Severity filter
  if (sev && sev !== 'all') {
    const sevList = sev.split(',').map(s => s.trim().toLowerCase());
    items = items.filter(d => sevList.includes(d.sev.toLowerCase()));
  }

  // Tool filter
  if (tool) {
    const searchTool = tool.trim().toLowerCase();
    items = items.filter(d => (d.tools || []).some(t => t.toLowerCase().includes(searchTool)));
  }

  // Search query across all text fields
  if (q) {
    const query = q.trim().toLowerCase();
    items = items.filter(d => {
      const methodsStr = (d.methods || []).map(m => `${m.title} ${m.cmd}`).join(' ');
      const toolsStr = (d.tools || []).join(' ');
      const haystack = `${d.id} ${d.title} ${d.summary} ${d.attacker} ${d.masvs} ${d.mastg} ${d.mitigation} ${toolsStr} ${methodsStr}`.toLowerCase();
      return haystack.includes(query);
    });
  }

  // Sort
  if (sort) {
    const isDesc = sort.startsWith('-');
    const sortField = isDesc ? sort.slice(1) : sort;
    const sevOrder = { critical: 4, high: 3, medium: 2, low: 1 };

    items.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'sev') {
        comparison = (sevOrder[b.sev] || 0) - (sevOrder[a.sev] || 0);
      } else if (sortField === 'title') {
        comparison = a.title.localeCompare(b.title);
      } else if (sortField === 'cat') {
        comparison = a.cat.localeCompare(b.cat);
      } else if (sortField === 'id') {
        comparison = a.id.localeCompare(b.id);
      }
      return isDesc ? -comparison : comparison;
    });
  }

  const total = items.length;

  // Pagination
  if (offset !== undefined || limit !== undefined) {
    const start = parseInt(offset, 10) || 0;
    const max = parseInt(limit, 10) || total;
    items = items.slice(start, start + max);
  }

  res.json({
    success: true,
    total,
    count: items.length,
    data: items
  });
});

/**
 * GET /api/playbooks/:id
 * Single playbook lookup
 */
router.get('/playbooks/:id', (req, res) => {
  const { id } = req.params;
  const playbook = DATA.find(d => d.id.toLowerCase() === id.toLowerCase());

  if (!playbook) {
    return res.status(404).json({
      success: false,
      error: `Playbook with ID '${id}' not found.`
    });
  }

  const category = CATS.find(c => c.key === playbook.cat);

  res.json({
    success: true,
    data: {
      ...playbook,
      categoryMeta: category || null
    }
  });
});

/**
 * GET /api/modules
 * Summary of all deep-dive modules
 */
router.get('/modules', (req, res) => {
  res.json({
    success: true,
    data: {
      jailbreaks: {
        title: 'Jailbreaking a Test Device',
        count: JAILBREAKS.length,
        items: JAILBREAKS
      },
      jbdetect: {
        title: 'Jailbreak Detection Bypass',
        count: JBDETECT.length,
        items: JBDETECT
      },
      sslpin: {
        title: 'SSL / Certificate Pinning Bypass',
        count: SSLPIN.length,
        items: SSLPIN
      }
    }
  });
});

/**
 * GET /api/modules/:type
 * Specific module collection
 */
router.get('/modules/:type', (req, res) => {
  const type = req.params.type.toLowerCase();
  let items = null;
  let title = '';

  if (type === 'jailbreaks' || type === 'jailbreak') {
    items = JAILBREAKS;
    title = 'Jailbreaking a Test Device';
  } else if (type === 'jbdetect' || type === 'jailbreak-detection') {
    items = JBDETECT;
    title = 'Jailbreak Detection Bypass';
  } else if (type === 'sslpin' || type === 'ssl-pinning') {
    items = SSLPIN;
    title = 'SSL / Certificate Pinning Bypass';
  }

  if (!items) {
    return res.status(404).json({
      success: false,
      error: `Module type '${req.params.type}' not found. Valid types: 'jailbreaks', 'jbdetect', 'sslpin'`
    });
  }

  res.json({
    success: true,
    module: type,
    title,
    count: items.length,
    data: items
  });
});

/**
 * GET /api/reviewed
 * Get reviewed state
 */
router.get('/reviewed', (req, res) => {
  const reviewed = getStoredReviewed();
  res.json({
    success: true,
    count: Object.values(reviewed).filter(Boolean).length,
    data: reviewed
  });
});

/**
 * POST /api/reviewed
 * Update reviewed state
 * Body: { id: "stor-1", reviewed: true } OR { reviewed: { "stor-1": true, ... } }
 */
router.post('/reviewed', (req, res) => {
  const current = getStoredReviewed();
  const { id, reviewed, batch } = req.body;

  if (id !== undefined) {
    current[id] = !!reviewed;
  } else if (batch && typeof batch === 'object') {
    Object.assign(current, batch);
  } else if (req.body && typeof req.body === 'object' && !('id' in req.body)) {
    // If entire reviewed map sent
    Object.assign(current, req.body);
  }

  saveStoredReviewed(current);

  res.json({
    success: true,
    count: Object.values(current).filter(Boolean).length,
    data: current
  });
});

/**
 * DELETE /api/reviewed
 * Reset reviewed state
 */
router.delete('/reviewed', (req, res) => {
  saveStoredReviewed({});
  res.json({
    success: true,
    message: 'Reviewed state reset successfully.',
    data: {}
  });
});

/**
 * GET /api/export
 * Complete export of categories, playbooks, and modules
 */
router.get('/export', (req, res) => {
  res.json({
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    categories: CATS,
    playbooks: DATA,
    modules: {
      jailbreaks: JAILBREAKS,
      jbdetect: JBDETECT,
      sslpin: SSLPIN
    }
  });
});

module.exports = router;
