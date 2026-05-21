export type AtcPluginCapability =
  | 'inventory.read'
  | 'inventory.write'
  | 'vitals.read'
  | 'vitals.write'
  | 'status.read'
  | 'status.write'
  | 'wallet.read'
  | 'wallet.write'
  | 'events.publish'
  | 'events.subscribe'
  | 'telemetry.write'
  | 'admin.read'
  | 'admin.write'
  | 'tasks.enqueue'
  | 'tasks.schedule'
  | 'ops.read'
  | 'ops.write'
  | 'cluster.read'
  | 'cluster.write'
  | 'plugin.reload'
  | 'economy.read'
  | 'economy.write'
  | 'organization.manage'
  | 'invoice.issue'
  | 'invoice.pay'
  | 'commerce.read'
  | 'commerce.write'
  | 'jobs.read'
  | 'jobs.write'
  | 'jobs.assign'
  | 'jobs.manage'
  | 'payroll.run'

export interface AtcPluginMetrics {
  pluginId: string
  eventsPublished: number
  eventsSubscribed: number
  permissionDeniedCount: number
  registeredAt: string
}
