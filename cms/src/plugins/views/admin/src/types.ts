import { Schema as StrapiSchema } from '@strapi/strapi'

export type Model = StrapiSchema & { uid: string, apiId: string }

export interface AppSchema {
  models: Map<string, Model>
}

export type GetFieldValue = (data: any) => any

export type Continuity =
  'full' |
  'transient' | // Temporary data used to generate final data
  'virtual' // Dynamically calculated data derived from other data

export interface QueryFieldBase {
  name: string
  title?: string
  continuity?: Continuity
  getValue?: GetFieldValue
}

export interface QueryField extends QueryFieldBase{
  fields: QueryField[]
}

export interface InputQueryFieldObject extends QueryFieldBase{
  fields?: InputQueryField[]
}

export type InputQueryField = string | InputQueryFieldObject

export interface DataQuery {
  base: string
  fields: QueryField[]
}

export interface InputDataQuery {
  base: string
  fields: InputQueryField[]
}

export interface ReportPropsBase<T> {
  title: string
  query: T
  // dataMap: (input: any) => any[]
}

export type InputReportProps = ReportPropsBase<InputDataQuery>
export type ReportProps = ReportPropsBase<DataQuery>
