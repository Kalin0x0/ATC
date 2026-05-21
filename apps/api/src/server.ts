import Fastify from 'fastify'
import type { FastifyError } from 'fastify'
import type { AppContext } from './context.js'
import { healthRoutes } from './routes/health.js'
import { accountRoutes } from './routes/accounts.js'
import { sessionRoutes } from './routes/sessions.js'
import { characterRoutes } from './routes/characters.js'
import { walletRoutes } from './routes/wallets.js'
import { itemRoutes } from './routes/items.js'
import { inventoryRoutes } from './routes/inventory.js'
import { vitalsRoutes } from './routes/vitals.js'
import { statusEffectsRoutes } from './routes/status-effects.js'
import { metricsRoutes } from './routes/metrics.js'
import { runtimeRoutes } from './routes/runtime.js'
import { opsRoutes } from './routes/ops.js'
import { securityRoutes } from './routes/security.js'
import { economyRoutes } from './routes/economy.js'
import { commerceRoutes } from './routes/commerce.js'
import { jobsRoutes } from './routes/jobs.js'
import { lawRoutes } from './routes/law.js'
import { dispatchRoutes } from './routes/dispatch.js'
import { mdtRoutes } from './routes/mdt.js'
import { medicalRoutes } from './routes/medical.js'
import { emsRoutes } from './routes/ems.js'
import { vehicleRoutes } from './routes/vehicles.js'
import { propertyRoutes } from './routes/property.js'
import { combatRoutes } from './routes/combat.js'
import { criminalRoutes } from './routes/criminal.js'
import { worldRoutes } from './routes/world.js'
import { entityRoutes } from './routes/entities.js'
import { entityIntelligenceRoutes } from './routes/entity-intelligence.js'
import { medicalIntelligenceRoutes } from './routes/medical-intelligence.js'
import { vehicleSimulationRoutes } from './routes/vehicle-simulation.js'
import { marketRoutes } from './routes/market.js'
import { factionRoutes } from './routes/factions.js'
import { housingRoutes } from './routes/housing.js'
import { npcRoutes } from './routes/npc.js'
import { cityRoutes } from './routes/city.js'
import { survivalRoutes } from './routes/survival.js'
import { craftingRoutes } from './routes/crafting.js'
import { logisticsRoutes } from './routes/logistics.js'
import { transportRoutes } from './routes/transport.js'
import { commsRoutes } from './routes/comms.js'
import { disasterRoutes } from './routes/disaster.js'
import { missionRoutes } from './routes/missions.js'
import { reputationRoutes } from './routes/reputation.js'
import { aiRoutes } from './routes/ai.js'
import { replicationRoutes } from './routes/replication.js'
import { reconciliationRoutes } from './routes/reconciliation.js'
import { orchestratorRoutes } from './routes/orchestrator.js'
import { combatSimulationRoutes } from './routes/combat-simulation.js'
import { narrativeRoutes } from './routes/narrative.js'
import { resilienceRoutes } from './routes/resilience.js'
import { observabilityRoutes } from './routes/observability.js'
import { clusterRoutes } from './routes/cluster.js'
import { persistenceRoutes } from './routes/persistence.js'
import { federationRoutes } from './routes/federation.js'
import { securityRuntimeRoutes } from './routes/security-runtime.js'
import { economyRegulationRoutes } from './routes/economy-regulation.js'
import { governanceRoutes } from './routes/governance.js'
import { ecologyRoutes } from './routes/ecology.js'
import { metaRuntimeRoutes } from './routes/meta-runtime.js'
import { runtimeProtocolRoutes } from './routes/runtime-protocol.js'
import { evolutionRoutes } from './routes/evolution.js'
import { worldIntegrityRoutes } from './routes/world-integrity.js'
import { globalGovernanceRoutes } from './routes/global-governance.js'
import { continuityRoutes } from './routes/continuity.js'
import { lockdownRoutes } from './routes/lockdown.js'
import { runtimeCertificationRoutes } from './routes/runtime-certification.js'
import { runtimeSovereigntyRoutes } from './routes/runtime-sovereignty.js'
import { coreFinalizationRoutes } from './routes/core-finalization.js'
import { runtimeGatewayRoutes } from './routes/runtime-gateway.js'
import { runtimeHardeningRoutes } from './routes/runtime-hardening.js'
import { runtimeSustainmentRoutes } from './routes/runtime-sustainment.js'
import { developerPlatformRoutes } from './routes/developer-platform.js'
import { releaseGovernanceRoutes } from './routes/release-governance.js'
import { enterpriseReadinessRoutes } from './routes/enterprise-readiness.js'
import { config } from './config.js'

const BODY_LIMIT = 64 * 1024 // 64 KB — sufficient for all current payloads

export function buildServer(ctx: AppContext) {
  const fastify = Fastify({
    logger: false,
    trustProxy: true,
    bodyLimit: BODY_LIMIT,
  })

  // Auth guard — strip query string for comparison so /health?foo=bar stays public
  fastify.addHook('onRequest', async (req, reply) => {
    const path = req.url.split('?')[0]
    if (path === '/health' || path === '/api/v1/ops/live' || path === '/api/v1/ops/ready') return

    const authHeader = req.headers['authorization']
    if (!authHeader || authHeader !== `Bearer ${config.apiToken}`) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
  })

  fastify.addHook('onRequest', (req, _reply, done) => {
    ctx.logger.info({ method: req.method, url: req.url }, 'request')
    done()
  })

  fastify.addHook('onResponse', (req, reply, done) => {
    ctx.logger.info(
      { method: req.method, url: req.url, statusCode: reply.statusCode },
      'response'
    )
    done()
  })

  fastify.register(healthRoutes, { ctx })
  fastify.register(accountRoutes, { ctx })
  fastify.register(sessionRoutes, { ctx })
  fastify.register(characterRoutes, { ctx })
  fastify.register(walletRoutes, { ctx })
  fastify.register(itemRoutes, { ctx })
  fastify.register(inventoryRoutes, { ctx })
  fastify.register(vitalsRoutes, { ctx })
  fastify.register(statusEffectsRoutes, { ctx })
  fastify.register(metricsRoutes, { ctx })
  fastify.register(runtimeRoutes, { ctx })
  fastify.register(opsRoutes, { ctx })
  fastify.register(securityRoutes, { ctx })
  fastify.register(economyRoutes, { ctx })
  fastify.register(commerceRoutes, { ctx })
  fastify.register(jobsRoutes, { ctx })
  fastify.register(lawRoutes, { ctx })
  fastify.register(dispatchRoutes, { ctx })
  fastify.register(mdtRoutes, { ctx })
  fastify.register(medicalRoutes, { ctx })
  fastify.register(emsRoutes, { ctx })
  fastify.register(vehicleRoutes, { ctx })
  fastify.register(propertyRoutes, { ctx })
  fastify.register(combatRoutes, { ctx })
  fastify.register(criminalRoutes, { ctx })
  fastify.register(worldRoutes, { ctx })
  fastify.register(entityRoutes, { ctx })
  fastify.register(entityIntelligenceRoutes, { ctx })
  fastify.register(medicalIntelligenceRoutes, { ctx })
  fastify.register(vehicleSimulationRoutes, { ctx })
  fastify.register(marketRoutes, { ctx })
  fastify.register(factionRoutes, { ctx })
  fastify.register(housingRoutes, { ctx })
  fastify.register(npcRoutes, { ctx })
  fastify.register(cityRoutes, { ctx })
  fastify.register(survivalRoutes, { ctx })
  fastify.register(craftingRoutes, { ctx })
  fastify.register(logisticsRoutes, { ctx })
  fastify.register(transportRoutes, { ctx })
  fastify.register(commsRoutes, { ctx })
  fastify.register(disasterRoutes, { ctx })
  fastify.register(missionRoutes, { ctx })
  fastify.register(reputationRoutes, { ctx })
  fastify.register(aiRoutes, { ctx })
  fastify.register(replicationRoutes, { ctx })
  fastify.register(reconciliationRoutes, { ctx })
  fastify.register(orchestratorRoutes, { ctx })
  fastify.register(combatSimulationRoutes, { ctx })
  fastify.register(narrativeRoutes, { ctx })
  fastify.register(resilienceRoutes, { ctx })
  fastify.register(observabilityRoutes, { ctx })
  fastify.register(clusterRoutes, { ctx })
  fastify.register(persistenceRoutes, { ctx })
  fastify.register(federationRoutes, { ctx })
  fastify.register(securityRuntimeRoutes, { ctx })
  fastify.register(economyRegulationRoutes, { ctx })
  fastify.register(governanceRoutes, { ctx })
  fastify.register(ecologyRoutes, { ctx })
  fastify.register(metaRuntimeRoutes, { ctx })
  fastify.register(runtimeProtocolRoutes, { ctx })
  fastify.register(evolutionRoutes, { ctx })
  fastify.register(worldIntegrityRoutes, { ctx })
  fastify.register(globalGovernanceRoutes, { ctx })
  fastify.register(continuityRoutes, { ctx })
  fastify.register(lockdownRoutes, { ctx })
  fastify.register(runtimeCertificationRoutes, { ctx })
  fastify.register(runtimeSovereigntyRoutes, { ctx })
  fastify.register(coreFinalizationRoutes, { ctx })
  fastify.register(runtimeGatewayRoutes, { ctx })
  fastify.register(runtimeHardeningRoutes, { ctx })
  fastify.register(runtimeSustainmentRoutes, { ctx })
  fastify.register(developerPlatformRoutes, { ctx })
  fastify.register(releaseGovernanceRoutes, { ctx })
  fastify.register(enterpriseReadinessRoutes, { ctx })

  // Return a clean 404 for any unknown route — no stack trace, no route details
  fastify.setNotFoundHandler((_req, reply) => {
    return reply.code(404).send({ error: 'Not found' })
  })

  // Handles JSON parse errors (400) and all unhandled throws (500)
  fastify.setErrorHandler((err: FastifyError, req, reply) => {
    const statusCode = err.statusCode ?? reply.statusCode

    // Invalid JSON body — Fastify sets 400 with code FST_ERR_CTP_INVALID_CONTENT_LENGTH or similar
    if (statusCode === 400) {
      ctx.logger.warn({ url: req.url, message: err.message }, 'bad request')
      return reply.code(400).send({ error: 'Bad request', message: err.message })
    }

    // Body too large
    if (statusCode === 413) {
      return reply.code(413).send({ error: 'Payload too large' })
    }

    // Never include stack traces or internal details in the response
    ctx.logger.error({ message: err.message, code: err.code }, 'unhandled error')
    return reply.code(500).send({ error: 'Internal server error' })
  })

  return fastify
}
