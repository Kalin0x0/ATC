import type {
  AtcEntityNode,
  AtcEntityType,
  AtcEntityAlias,
} from '@atc/shared-types'
import type {
  EntityRegistryRepository,
  RegisterEntityParams,
  AddAliasParams,
  ListEntitiesParams,
  EntityPage,
} from './registry.repository.js'

export interface EntityRegistryServiceOptions {
  repository: EntityRegistryRepository
}

/**
 * EntityRegistryService — orchestrates entity directory operations.
 *
 * Indexing / write methods (register, addAlias) operate on the entity-graph
 * tables ONLY. They do not mutate gameplay state.
 */
export class EntityRegistryService {
  private readonly repo: EntityRegistryRepository

  constructor(opts: EntityRegistryServiceOptions) {
    this.repo = opts.repository
  }

  register(params: RegisterEntityParams): Promise<AtcEntityNode> {
    return this.repo.register(params)
  }

  addAlias(params: AddAliasParams): Promise<AtcEntityAlias> {
    return this.repo.addAlias(params)
  }

  getById(id: string): Promise<AtcEntityNode | null> {
    return this.repo.findById(id)
  }

  getByTypeAndExternalId(type: AtcEntityType, externalId: string): Promise<AtcEntityNode | null> {
    return this.repo.findByTypeAndExternalId(type, externalId)
  }

  list(params: ListEntitiesParams = {}): Promise<EntityPage> {
    return this.repo.list(params)
  }

  listAliases(entityId: string): Promise<AtcEntityAlias[]> {
    return this.repo.listAliases(entityId)
  }
}
