import { Schema as StrapiSchema } from '@strapi/strapi'

export type Model = StrapiSchema & { uid: string, apiId: string }

export interface AppSchema {
  models: Map<string, Model>
}

export interface QueryField {
  name: string
  fields: QueryField[]
  transient?: boolean
}

export interface InputQueryFieldObject {
  name: string
  fields?: InputQueryField[]
  transient?: boolean
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
  dataMap: (input: any) => any[]
}

export type InputReportProps = ReportPropsBase<InputDataQuery>
export type ReportProps = ReportPropsBase<DataQuery>
