import { Schema as StrapiSchema } from '@strapi/strapi'

export type Model = StrapiSchema & { uid: string, apiId: string }

export interface AppSchema {
  models: Map<string, Model>
}

export interface ReportProps {
  title: string
  baseModel: string
  query: string
  dataMap: (input: any) => any[]
}
