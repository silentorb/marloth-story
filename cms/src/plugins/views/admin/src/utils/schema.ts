import { AppSchema } from '../types'

export const getModelFullName = (key: string) =>
  key.substring(0, 5) == 'api::'
    ? key
    : `api::${key}.${key}`

export const getRecordUrlPath = (model: string, id: string | number) =>
  `/content-manager/collectionType/${getModelFullName(model)}/${id}`

export const getSchemaModel = (schema: AppSchema, key: string) =>
  schema.models.get(getModelFullName(key))
