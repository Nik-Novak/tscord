import { Entity, PrimaryKey, Property, EntityRepositoryType } from '@mikro-orm/core'
import { EntityRepository } from '@mikro-orm/sqlite'
import { singleton } from 'tsyringe'

import { CustomBaseEntity } from './BaseEntity'

@Entity({ customRepository: () => ImageRepository })
export class Image extends CustomBaseEntity {

    [EntityRepositoryType]?: ImageRepository

    @PrimaryKey()
    id: number

    @Property()
    fileName: string

    @Property()
    url: string

    @Property()
    hash: string
}

@singleton()
export class ImageRepository extends EntityRepository<Image> { 

}