import type { AtcHttpClient } from './http-client.js'
import type {
  AtcItemDefinition,
  AtcUpsertItemDefinitionRequest,
  AtcItemDefinitionCreateRequest,
  AtcItemDefinitionUpdateRequest,
  AtcItemDefinitionBulkUpsertRequest,
  AtcItemDefinitionBulkUpsertResponse,
  AtcItemMetadataValidationRequest,
  AtcItemMetadataValidationResponse,
  AtcItemCatalogQuery,
} from '@atc/shared-types'

export class AtcItemsSDK {
  constructor(private readonly http: AtcHttpClient) {}

  // ── Existing ──────────────────────────────────────────────────────────────

  async list(): Promise<AtcItemDefinition[]> {
    const res = await this.http.get<AtcItemDefinition[]>('/api/v1/items')
    return (res.ok && res.data) ? res.data : []
  }

  async upsert(params: AtcUpsertItemDefinitionRequest): Promise<AtcItemDefinition | null> {
    const res = await this.http.post<AtcItemDefinition>('/api/v1/items', params)
    return res.ok ? res.data : null
  }

  // ── Phase 7: catalog + admin methods ─────────────────────────────────────

  async catalog(query?: AtcItemCatalogQuery): Promise<AtcItemDefinition[]> {
    const params = new URLSearchParams()
    if (query?.category) params.set('category', query.category)
    if (query?.status) params.set('status', query.status)
    if (query?.tag) params.set('tag', query.tag)
    if (query?.search) params.set('search', query.search)
    if (query?.limit !== undefined) params.set('limit', String(query.limit))
    if (query?.offset !== undefined) params.set('offset', String(query.offset))
    const qs = params.toString()
    const res = await this.http.get<AtcItemDefinition[]>(`/api/v1/items/catalog${qs ? `?${qs}` : ''}`)
    return (res.ok && res.data) ? res.data : []
  }

  async create(params: AtcItemDefinitionCreateRequest): Promise<AtcItemDefinition | null> {
    const res = await this.http.post<AtcItemDefinition>('/api/v1/items/create', params)
    return res.ok ? res.data : null
  }

  async update(itemId: string, patch: AtcItemDefinitionUpdateRequest): Promise<AtcItemDefinition | null> {
    const res = await this.http.patch<AtcItemDefinition>(`/api/v1/items/${itemId}`, patch)
    return res.ok ? res.data : null
  }

  async bulkUpsert(request: AtcItemDefinitionBulkUpsertRequest): Promise<AtcItemDefinitionBulkUpsertResponse | null> {
    const res = await this.http.post<AtcItemDefinitionBulkUpsertResponse>('/api/v1/items/bulk', request)
    return res.ok ? res.data : null
  }

  async disable(itemId: string): Promise<AtcItemDefinition | null> {
    const res = await this.http.post<AtcItemDefinition>(`/api/v1/items/${itemId}/disable`, {})
    return res.ok ? res.data : null
  }

  async deprecate(itemId: string): Promise<AtcItemDefinition | null> {
    const res = await this.http.post<AtcItemDefinition>(`/api/v1/items/${itemId}/deprecate`, {})
    return res.ok ? res.data : null
  }

  async validateMetadata(request: AtcItemMetadataValidationRequest): Promise<AtcItemMetadataValidationResponse | null> {
    const res = await this.http.post<AtcItemMetadataValidationResponse>('/api/v1/items/metadata/validate', request)
    return res.ok ? res.data : null
  }
}
