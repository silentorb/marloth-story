import { AppSchema, Model } from '../types'
import { useEffect, useState } from 'react'
import { authorizedAxios } from './axiosInstance'

export function organizeSchema(allSchemas: Model[]): Map<string, Model> {
  const schemas = allSchemas.filter(s => s.uid.substring(0, 3) == 'api')
  return new Map(schemas.map(s => [s.uid, s]))
}

export const useSchema: () => AppSchema | undefined = () => {
  const [schema, setSchema] = useState<AppSchema | undefined>(undefined)
  useEffect(() => {
    authorizedAxios.get(`/content-manager/content-types`)
      .then(response => {
        setSchema({
          models: organizeSchema(response.data.data),
        })
      })
  }, [setSchema])
  return schema
}
