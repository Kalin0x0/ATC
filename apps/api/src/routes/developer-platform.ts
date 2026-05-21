import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import {
  createDeveloperPlatformSchema,
  registerSdkSchema,
  createPluginCompatibilitySchema,
  createExtensionRuntimeSchema,
  createContractValidationSchema,
  cleanupDeveloperPlatformSchema,
} from '@atc/operations'

export function developerPlatformRoutes(fastify: FastifyInstance, { ctx }: { ctx: AppContext }) {
  // ── Developer Platform ───────────────────────────────────────────────────────

  fastify.post('/api/v1/developer-platform', async (req, reply) => {
    if (!ctx.developerPlatformService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createDeveloperPlatformSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { platformData, ...rest } = parsed.data
    const record = await ctx.developerPlatformService.createPlatform({
      ...rest,
      ...(platformData !== undefined ? { platformData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/developer-platform/:id/activate', async (req, reply) => {
    if (!ctx.developerPlatformService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.developerPlatformService.activatePlatform(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/developer-platform/:id/deprecate', async (req, reply) => {
    if (!ctx.developerPlatformService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.developerPlatformService.deprecatePlatform(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/developer-platform/:id', async (req, reply) => {
    if (!ctx.developerPlatformService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.developerPlatformService.getPlatform(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── SDK Registry ─────────────────────────────────────────────────────────────

  fastify.post('/api/v1/developer-platform/sdk', async (req, reply) => {
    if (!ctx.runtimeSdkRegistryService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = registerSdkSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { sdkData, ...rest } = parsed.data
    const record = await ctx.runtimeSdkRegistryService.registerSdk({
      ...rest,
      ...(sdkData !== undefined ? { sdkData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/developer-platform/sdk/:sdkId/deprecate', async (req, reply) => {
    if (!ctx.runtimeSdkRegistryService) return reply.code(503).send({ error: 'Service unavailable' })
    const { sdkId } = req.params as { sdkId: string }
    const record = await ctx.runtimeSdkRegistryService.deprecateSdk(sdkId)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/developer-platform/sdk/:sdkId/retire', async (req, reply) => {
    if (!ctx.runtimeSdkRegistryService) return reply.code(503).send({ error: 'Service unavailable' })
    const { sdkId } = req.params as { sdkId: string }
    const record = await ctx.runtimeSdkRegistryService.retireSdk(sdkId)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/developer-platform/sdk/:sdkId', async (req, reply) => {
    if (!ctx.runtimeSdkRegistryService) return reply.code(503).send({ error: 'Service unavailable' })
    const { sdkId } = req.params as { sdkId: string }
    const record = await ctx.runtimeSdkRegistryService.getSdk(sdkId)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Plugin Compatibility ─────────────────────────────────────────────────────

  fastify.post('/api/v1/developer-platform/compatibility', async (req, reply) => {
    if (!ctx.pluginCompatibilityService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createPluginCompatibilitySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { compatibilityData, ...rest } = parsed.data
    const record = await ctx.pluginCompatibilityService.createCompatibilityCheck({
      ...rest,
      ...(compatibilityData !== undefined ? { compatibilityData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/developer-platform/compatibility/:id/validate', async (req, reply) => {
    if (!ctx.pluginCompatibilityService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.pluginCompatibilityService.beginValidating(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/developer-platform/compatibility/:id/pass', async (req, reply) => {
    if (!ctx.pluginCompatibilityService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.pluginCompatibilityService.passCompatibility(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/developer-platform/compatibility/:id/fail', async (req, reply) => {
    if (!ctx.pluginCompatibilityService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.pluginCompatibilityService.failCompatibility(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/developer-platform/compatibility/:id', async (req, reply) => {
    if (!ctx.pluginCompatibilityService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.pluginCompatibilityService.getCompatibility(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Extension Lifecycle ──────────────────────────────────────────────────────

  fastify.post('/api/v1/developer-platform/extension', async (req, reply) => {
    if (!ctx.extensionLifecycleService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createExtensionRuntimeSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { extensionData, ...rest } = parsed.data
    const record = await ctx.extensionLifecycleService.createExtension({
      ...rest,
      ...(extensionData !== undefined ? { extensionData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/developer-platform/extension/:id/activate', async (req, reply) => {
    if (!ctx.extensionLifecycleService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.extensionLifecycleService.activateExtension(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/developer-platform/extension/:id/suspend', async (req, reply) => {
    if (!ctx.extensionLifecycleService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.extensionLifecycleService.suspendExtension(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/developer-platform/extension/:id/deactivate', async (req, reply) => {
    if (!ctx.extensionLifecycleService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.extensionLifecycleService.deactivateExtension(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/developer-platform/extension/:id', async (req, reply) => {
    if (!ctx.extensionLifecycleService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.extensionLifecycleService.getExtension(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Contract Validation ──────────────────────────────────────────────────────

  fastify.post('/api/v1/developer-platform/contract', async (req, reply) => {
    if (!ctx.runtimeContractValidationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createContractValidationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { contractData, ...rest } = parsed.data
    const record = await ctx.runtimeContractValidationService.createContract({
      ...rest,
      ...(contractData !== undefined ? { contractData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/developer-platform/contract/:id/validate', async (req, reply) => {
    if (!ctx.runtimeContractValidationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeContractValidationService.beginValidating(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/developer-platform/contract/:id/pass', async (req, reply) => {
    if (!ctx.runtimeContractValidationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeContractValidationService.passContract(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/developer-platform/contract/:id/fail', async (req, reply) => {
    if (!ctx.runtimeContractValidationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeContractValidationService.failContract(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/developer-platform/contract/:id', async (req, reply) => {
    if (!ctx.runtimeContractValidationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeContractValidationService.getContract(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/developer-platform/cleanup', async (req, reply) => {
    if (!ctx.developerRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = cleanupDeveloperPlatformSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const result = await ctx.developerRecoveryService.cleanupStale(parsed.data.thresholdMs)
    return reply.code(200).send(result)
  })
}
