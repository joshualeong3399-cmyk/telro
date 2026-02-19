import OutboundRoute from '../db/models/outbound-route.js';
import SIPTrunk from '../db/models/sip-trunk.js';
import logger from '../utils/logger.js';
import asteriskConfigService from './asterisk-config-service.js';

class OutboundRouteService {
  async createRoute(data) {
    const route = await OutboundRoute.create(data);
    logger.info(`✅ Outbound route created: ${route.name}`);
    asteriskConfigService.syncAll().catch(e => logger.warn('Asterisk sync failed:', e.message));
    return route;
  }

  async updateRoute(routeId, data) {
    const route = await OutboundRoute.findByPk(routeId);
    if (!route) throw new Error(`Outbound route not found: ${routeId}`);
    await route.update(data);
    asteriskConfigService.syncAll().catch(e => logger.warn('Asterisk sync failed:', e.message));
    return route;
  }

  async deleteRoute(routeId) {
    const route = await OutboundRoute.findByPk(routeId);
    if (!route) throw new Error(`Outbound route not found: ${routeId}`);
    await route.destroy();
    asteriskConfigService.syncAll().catch(e => logger.warn('Asterisk sync failed:', e.message));
    return route;
  }

  async getRoutes(limit = 100, offset = 0) {
    return OutboundRoute.findAndCountAll({
      limit,
      offset,
      order: [['priority', 'ASC']],
      include: [{ model: SIPTrunk, as: 'sipTrunk', attributes: ['id', 'name', 'host', 'status'] }],
    });
  }

  async getRouteDetail(routeId) {
    const route = await OutboundRoute.findByPk(routeId, {
      include: [{ model: SIPTrunk, as: 'sipTrunk' }],
    });
    if (!route) throw new Error(`Outbound route not found: ${routeId}`);
    return route;
  }

  /**
   * 根据拨号号码匹配路由，返回 { route, trunk, dialNumber }
   * dialPatterns 格式：
   *   "9."   → 9开头任意长度，去掉第一位
   *   "NXXNXXXXXX" → 标准10位美国号码
   *   "_0086." → 0086开头
   *   支持直接数字串精确匹配
   */
  async matchRoute(dialNumber) {
    const routes = await OutboundRoute.findAll({
      where: { enabled: true },
      order: [['priority', 'ASC']],
      include: [{ model: SIPTrunk, as: 'sipTrunk' }],
    });

    for (const route of routes) {
      const patterns = route.dialPatterns || [];
      for (const pattern of patterns) {
        const matched = this._matchPattern(pattern, dialNumber);
        if (matched) {
          // 处理号码变换
          let finalNumber = dialNumber;
          if (route.stripDigits > 0) {
            finalNumber = finalNumber.slice(route.stripDigits);
          }
          if (route.prepend) {
            finalNumber = route.prepend + finalNumber;
          }
          return { route, trunk: route.sipTrunk, dialNumber: finalNumber };
        }
      }
    }
    return null;
  }

  _matchPattern(pattern, number) {
    // 简化的拨号规则匹配
    if (!pattern || pattern === '_any_') return true;
    // 去掉 _ 前缀（FreePBX 风格）
    const p = pattern.startsWith('_') ? pattern.slice(1) : pattern;
    // 转换为正则
    const regex = p
      .replace(/\./g, '.*')       // . = 任意字符
      .replace(/X/g, '[0-9]')     // X = 0-9
      .replace(/N/g, '[2-9]')     // N = 2-9
      .replace(/Z/g, '[1-9]')     // Z = 1-9
      .replace(/\[/g, '[')
      .replace(/\]/g, ']');
    return new RegExp(`^${regex}$`).test(number);
  }

  async setEnabled(routeId, enabled) {
    const route = await OutboundRoute.findByPk(routeId);
    if (!route) throw new Error(`Outbound route not found: ${routeId}`);
    await route.update({ enabled });
    return route;
  }
}

export default new OutboundRouteService();
