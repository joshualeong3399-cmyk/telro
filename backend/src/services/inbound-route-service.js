import InboundRoute from '../db/models/inbound-route.js';
import logger from '../utils/logger.js';
import asteriskConfigService from './asterisk-config-service.js';

class InboundRouteService {
  async createRoute(data) {
    const route = await InboundRoute.create(data);
    logger.info(`✅ Inbound route created: ${route.name}`);
    asteriskConfigService.syncAll().catch(e => logger.warn('Asterisk sync failed:', e.message));
    return route;
  }

  async updateRoute(routeId, data) {
    const route = await InboundRoute.findByPk(routeId);
    if (!route) throw new Error(`Inbound route not found: ${routeId}`);
    await route.update(data);
    asteriskConfigService.syncAll().catch(e => logger.warn('Asterisk sync failed:', e.message));
    return route;
  }

  async deleteRoute(routeId) {
    const route = await InboundRoute.findByPk(routeId);
    if (!route) throw new Error(`Inbound route not found: ${routeId}`);
    await route.destroy();
    asteriskConfigService.syncAll().catch(e => logger.warn('Asterisk sync failed:', e.message));
    return route;
  }

  async getRoutes(limit = 100, offset = 0) {
    return InboundRoute.findAndCountAll({
      limit,
      offset,
      order: [['priority', 'ASC'], ['createdAt', 'DESC']],
    });
  }

  async getRouteDetail(routeId) {
    const route = await InboundRoute.findByPk(routeId);
    if (!route) throw new Error(`Inbound route not found: ${routeId}`);
    return route;
  }

  // 根据来电 DID 查找匹配路由（按优先级）
  async matchRoute(did, callerId = '') {
    const routes = await InboundRoute.findAll({
      where: { enabled: true },
      order: [['priority', 'ASC']],
    });

    for (const route of routes) {
      const didMatch = !route.did || route.did === '' || did.includes(route.did) || route.did === '_any_';
      const clidMatch = !route.callerIdMatch || route.callerIdMatch === '' || callerId.startsWith(route.callerIdMatch);
      if (didMatch && clidMatch) return route;
    }
    return null;
  }

  async setEnabled(routeId, enabled) {
    const route = await InboundRoute.findByPk(routeId);
    if (!route) throw new Error(`Inbound route not found: ${routeId}`);
    await route.update({ enabled });
    return route;
  }
}

export default new InboundRouteService();
