import { AppSchema, Model, QueryField } from '../types'
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

export function flattenAttributes(data: { id?: string, attributes?: any[], data?: any[] }) {
  const result: any = {}

  if (typeof data !== 'object')
    return data

  if (Array.isArray(data.data))
    return data.data.map(flattenAttributes)

  if (data.id) {
    result.id = data.id
  }

  if (data.attributes) {
    for (let key in data.attributes) {
      const value = data.attributes[key]
      result[key] = flattenAttributes(value)
    }
  }

  return result
}

export function getFieldValue(field: QueryField, data: any): any {
  return field.getValue
    ? field.getValue(data)
    : data[field.name]
}
