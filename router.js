/**
 * iOSArsenal Client-Side Router
 * Provides hash-based declarative routing with param extraction, query string parsing,
 * browser history support, and deep linking.
 */
class ArsenalRouter {
  constructor() {
    this.routes = [];
    this.currentRoute = null;
    this.currentParams = {};
    this.currentQuery = {};
    this.beforeHooks = [];
    this.afterHooks = [];

    window.addEventListener('hashchange', () => this.handleRoute());
    window.addEventListener('DOMContentLoaded', () => this.handleRoute());
  }

  /**
   * Register a route path with a handler
   * e.g. router.on('/category/:cat', (params, query) => { ... })
   */
  on(path, handler) {
    const paramNames = [];
    const regexPath = path.replace(/:([a-zA-Z0-9_]+)/g, (_, paramName) => {
      paramNames.push(paramName);
      return '([^\\/\\?#]+)';
    });
    const regex = new RegExp(`^${regexPath}$`);

    this.routes.push({
      path,
      regex,
      paramNames,
      handler
    });
    return this;
  }

  beforeEach(hook) {
    this.beforeHooks.push(hook);
    return this;
  }

  afterEach(hook) {
    this.afterHooks.push(hook);
    return this;
  }

  navigate(path, replace = false) {
    const targetHash = path.startsWith('#') ? path : `#${path.startsWith('/') ? path : '/' + path}`;
    if (replace) {
      const url = window.location.href.split('#')[0] + targetHash;
      window.location.replace(url);
    } else {
      window.location.hash = targetHash;
    }
  }

  parseHash() {
    const raw = window.location.hash.slice(1) || '/';
    const [pathPart, queryPart] = raw.split('?');
    const path = pathPart.startsWith('/') ? pathPart : '/' + pathPart;

    const query = {};
    if (queryPart) {
      const sp = new URLSearchParams(queryPart);
      for (const [k, v] of sp.entries()) {
        query[k] = v;
      }
    }

    return { path, query, raw };
  }

  async handleRoute() {
    const { path, query, raw } = this.parseHash();

    // Find matching route
    let match = null;
    let params = {};

    for (const route of this.routes) {
      const m = path.match(route.regex);
      if (m) {
        match = route;
        route.paramNames.forEach((name, index) => {
          params[name] = decodeURIComponent(m[index + 1]);
        });
        break;
      }
    }

    if (!match) {
      // Default to root route if no direct match
      match = this.routes.find(r => r.path === '/') || null;
    }

    this.currentRoute = match ? match.path : path;
    this.currentParams = params;
    this.currentQuery = query;

    // Run before hooks
    for (const hook of this.beforeHooks) {
      const result = await hook(this.currentRoute, params, query);
      if (result === false) return;
    }

    // Execute route handler
    if (match && match.handler) {
      await match.handler(params, query);
    }

    // Run after hooks
    for (const hook of this.afterHooks) {
      hook(this.currentRoute, params, query);
    }

    // Update active nav links
    this.updateNavLinks(path);
  }

  updateNavLinks(currentPath) {
    document.querySelectorAll('.nav-link').forEach(link => {
      const routeAttr = link.dataset.route;
      if (!routeAttr) return;

      const isExact = routeAttr === currentPath;
      const isPrefix = routeAttr !== '/' && currentPath.startsWith(routeAttr);
      link.classList.toggle('active', isExact || isPrefix);
    });
  }
}

window.ArsenalRouter = ArsenalRouter;
window.router = new ArsenalRouter();
