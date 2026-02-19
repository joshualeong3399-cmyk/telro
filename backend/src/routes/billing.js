import express from 'express';
import billingService from '../services/billing-service.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();
router.use(authMiddleware);

// ── Helper: derive scope filter from logged-in user ──────────────────────────
// Returns an object with { extensionId?, merchantId?, unrestricted }
// that callers can pass down to service queries.
//
//  admin / operator  → unrestricted (see everything)
//  merchant          → scoped to merchantId
//  employee          → scoped to their own extensionId
function getScopeFilter(user) {
  const role = user?.role;
  if (role === 'admin' || role === 'operator') {
    return { unrestricted: true };
  }
  if (role === 'merchant') {
    return { unrestricted: false, merchantId: user.merchantId };
  }
  // employee / default
  return { unrestricted: false, extensionId: user.extensionId };
}

// Helper: enforce that a requested extensionId/merchantId is within the
// caller's scope; throws 403 if not allowed.
function assertScope(scope, { requestedExtensionId, requestedMerchantId } = {}) {
  if (scope.unrestricted) return; // admin/operator: always allowed

  if (scope.extensionId) {
    // employee: may only query their own extension
    if (requestedExtensionId && requestedExtensionId !== scope.extensionId) {
      const err = new Error('无权查看其他分机的账单');
      err.status = 403;
      throw err;
    }
  }

  if (scope.merchantId) {
    // merchant: may filter by extensionId only if no conflicting merchantId
    if (requestedMerchantId && requestedMerchantId !== scope.merchantId) {
      const err = new Error('无权查看其他商家的账单');
      err.status = 403;
      throw err;
    }
  }
}

// Helper: merge scope into a query filter object understood by billing-service
function buildFilter(scope, overrides = {}) {
  if (scope.unrestricted) return overrides;
  if (scope.extensionId) return { ...overrides, extensionId: scope.extensionId };
  if (scope.merchantId)  return { ...overrides, merchantId: scope.merchantId };
  return overrides;
}

// ── 获取月度账单 ──────────────────────────────────────────────────────────────
router.get('/monthly', async (req, res) => {
  try {
    const scope = getScopeFilter(req.user);
    assertScope(scope, { requestedExtensionId: req.query.extensionId });
    const filter = buildFilter(scope, { year: parseInt(req.query.year), month: parseInt(req.query.month) });
    if (req.query.extensionId && scope.unrestricted) filter.extensionId = req.query.extensionId;
    res.json(await billingService.getMonthlyBilling(filter.year, filter.month, filter.extensionId, filter.merchantId));
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// ── 获取月度账单摘要 ──────────────────────────────────────────────────────────
router.get('/monthly/summary', async (req, res) => {
  try {
    const scope = getScopeFilter(req.user);
    assertScope(scope, { requestedExtensionId: req.query.extensionId });
    const filter = buildFilter(scope, { year: parseInt(req.query.year), month: parseInt(req.query.month) });
    if (req.query.extensionId && scope.unrestricted) filter.extensionId = req.query.extensionId;
    res.json(await billingService.getMonthlyBillingSummary(filter.year, filter.month, filter.extensionId, filter.merchantId));
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// ── 获取日期范围账单 ──────────────────────────────────────────────────────────
router.get('/range', async (req, res) => {
  try {
    const scope = getScopeFilter(req.user);
    assertScope(scope, { requestedExtensionId: req.query.extensionId });
    const filter = buildFilter(scope, {});
    if (req.query.extensionId && scope.unrestricted) filter.extensionId = req.query.extensionId;
    res.json(await billingService.getBillingByDateRange(req.query.startDate, req.query.endDate, filter.extensionId, filter.merchantId));
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// ── 生成月度发票 (admin / operator / merchant only) ───────────────────────────
router.post('/invoice/generate', async (req, res) => {
  try {
    const scope = getScopeFilter(req.user);
    if (!scope.unrestricted && req.user.role === 'employee') {
      return res.status(403).json({ error: '无权生成发票' });
    }
    assertScope(scope, { requestedExtensionId: req.body.extensionId });
    const filter = buildFilter(scope, { extensionId: req.body.extensionId });
    res.json(await billingService.generateMonthlyInvoice(req.body.year, req.body.month, filter.extensionId));
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// ── 消费排行 (admin / operator / merchant only) ───────────────────────────────
router.get('/top-users', async (req, res) => {
  try {
    const scope = getScopeFilter(req.user);
    if (!scope.unrestricted && req.user.role === 'employee') {
      return res.status(403).json({ error: '无权查看消费排行' });
    }
    const { year, month, limit = 10 } = req.query;
    const merchantId = scope.merchantId || null;
    res.json(await billingService.getTopExtensionsByUsage(parseInt(year), parseInt(month), parseInt(limit), merchantId));
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// ── 分机消费趋势 ──────────────────────────────────────────────────────────────
router.get('/trend/:extensionId', async (req, res) => {
  try {
    const scope = getScopeFilter(req.user);
    assertScope(scope, { requestedExtensionId: req.params.extensionId });
    res.json(await billingService.getExtensionCostTrend(req.params.extensionId, parseInt(req.query.months) || 12));
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// ── 按类型统计 ────────────────────────────────────────────────────────────────
router.get('/by-type', async (req, res) => {
  try {
    const scope = getScopeFilter(req.user);
    assertScope(scope, { requestedExtensionId: req.query.extensionId });
    const filter = buildFilter(scope, { year: parseInt(req.query.year), month: parseInt(req.query.month) });
    if (req.query.extensionId && scope.unrestricted) filter.extensionId = req.query.extensionId;
    res.json(await billingService.getCostByCallType(filter.year, filter.month, filter.extensionId, filter.merchantId));
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// ── 待付款账单 ────────────────────────────────────────────────────────────────
router.get('/pending', async (req, res) => {
  try {
    const scope = getScopeFilter(req.user);
    const filter = buildFilter(scope, {});
    if (req.query.extensionId && scope.unrestricted) filter.extensionId = req.query.extensionId;
    res.json(await billingService.getPendingBillings(filter.extensionId, filter.merchantId));
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// ── 更新账单状态 (admin / operator only) ──────────────────────────────────────
router.patch('/status/update', async (req, res) => {
  try {
    const role = req.user?.role;
    if (role !== 'admin' && role !== 'operator') {
      return res.status(403).json({ error: '仅 admin / operator 可修改账单状态' });
    }
    const count = await billingService.updateBillingStatus(req.body.billingIds, req.body.status);
    res.json({ message: `Updated ${count} billing records`, count });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;

