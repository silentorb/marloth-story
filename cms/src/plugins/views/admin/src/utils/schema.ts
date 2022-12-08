import { AppSchema, Model } from '../types'
import { Attribute } from '@strapi/strapi/lib/types/core/attributes'

export const getModelFullName = (key: string) =>
  key.substring(0, 5) == 'api::'
    ? key
    : `api::${key}.${key}`

export const getRecordUrlPath = (model: string, id: string | number) =>
  `/content-manager/collectionType/${getModelFullName(model)}/${id}`

export const getSchemaModel = (schema: AppSchema, key: string) =>
  schema.models.get(getModelFullName(key))

export function getModelField(model: Model, name: string): Attribute | undefined {
  return model.attributes[name]
}
