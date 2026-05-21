import type { AtcGang, AtcGangMember, AtcGangMemberRank } from '@atc/shared-types'
import { ATC_CRIMINAL_EVENTS } from '@atc/shared-types'
import type { AtcEventBus } from '@atc/events'
import type { GangRepository, CreateGangParams } from './gang.repository.js'
import type { GangMemberRepository } from './gang-member.repository.js'
import type { CriminalPool } from './pool.js'
import { GangNotFoundError } from './errors.js'

export type { CreateGangParams }

export interface CriminalRuntimeDeps {
  gangRepo: GangRepository
  memberRepo: GangMemberRepository
  pool: CriminalPool
  eventBus: AtcEventBus | undefined
}

export class CriminalRuntimeService {
  private readonly gangRepo: GangRepository
  private readonly memberRepo: GangMemberRepository
  private readonly pool: CriminalPool
  private readonly eventBus: AtcEventBus | undefined

  constructor(deps: CriminalRuntimeDeps) {
    this.gangRepo   = deps.gangRepo
    this.memberRepo = deps.memberRepo
    this.pool       = deps.pool
    this.eventBus   = deps.eventBus
  }

  async createGang(params: CreateGangParams): Promise<AtcGang> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      let gang: AtcGang
      try {
        // Create the gang row
        gang = await this.gangRepo.create({
          name: params.name,
          tag: params.tag,
          leaderPrincipalId: params.leaderPrincipalId,
          territoryId: params.territoryId,
        })

        // Add the leader as a member with 'leader' rank
        await this.memberRepo.add(
          {
            gangId: gang.id,
            principalId: params.leaderPrincipalId,
            rank: 'leader',
          },
          conn,
        )

        // Increment member count
        await this.gangRepo.incrementMemberCount(gang.id, conn)

        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      // Re-fetch so member_count is accurate
      const updated = await this.gangRepo.findById(gang.id)
      if (!updated) throw new GangNotFoundError(gang.id)

      this.eventBus?.emit(ATC_CRIMINAL_EVENTS.GANG_CREATED, {
        gangId: updated.id,
        name: updated.name,
        tag: updated.tag,
        leaderPrincipalId: updated.leaderPrincipalId,
      }).catch(() => undefined)

      return updated
    } finally {
      conn.release()
    }
  }

  async disbandGang(gangId: string): Promise<AtcGang> {
    await this.gangRepo.updateStatus(gangId, 'disbanded')

    const gang = await this.gangRepo.findById(gangId)
    if (!gang) throw new GangNotFoundError(gangId)

    this.eventBus?.emit(ATC_CRIMINAL_EVENTS.GANG_DISBANDED, { gangId }).catch(() => undefined)

    return gang
  }

  async addMember(
    gangId: string,
    principalId: string,
    rank: AtcGangMemberRank,
    invitedByPrincipalId?: string,
  ): Promise<AtcGangMember> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      let member: AtcGangMember
      try {
        // Lock the gang row to prevent race conditions
        const [gangRows] = await conn.execute(
          `SELECT id FROM atc_gangs WHERE id = ? LIMIT 1 FOR UPDATE`,
          [gangId],
        ) as [Array<{ id: string }>, unknown]
        if (!gangRows[0]) throw new GangNotFoundError(gangId)

        member = await this.memberRepo.add(
          { gangId, principalId, rank, invitedByPrincipalId },
          conn,
        )

        await this.gangRepo.incrementMemberCount(gangId, conn)

        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      this.eventBus?.emit(ATC_CRIMINAL_EVENTS.GANG_MEMBER_JOINED, {
        gangId,
        principalId,
        rank,
        invitedByPrincipalId: invitedByPrincipalId ?? null,
      }).catch(() => undefined)

      return member
    } finally {
      conn.release()
    }
  }

  async removeMember(gangId: string, principalId: string): Promise<AtcGangMember> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      let member: AtcGangMember
      try {
        member = await this.memberRepo.remove(gangId, principalId, conn)
        await this.gangRepo.decrementMemberCount(gangId, conn)
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      this.eventBus?.emit(ATC_CRIMINAL_EVENTS.GANG_MEMBER_LEFT, {
        gangId,
        principalId,
      }).catch(() => undefined)

      return member
    } finally {
      conn.release()
    }
  }

  async getGang(id: string): Promise<AtcGang | null> {
    return this.gangRepo.findById(id)
  }

  async listActiveGangs(): Promise<AtcGang[]> {
    return this.gangRepo.listActive()
  }

  async getGangMembers(gangId: string): Promise<AtcGangMember[]> {
    return this.memberRepo.listActiveByGang(gangId)
  }

  async getPrincipalGangs(principalId: string): Promise<AtcGangMember[]> {
    return this.memberRepo.listActiveByPrincipal(principalId)
  }
}
