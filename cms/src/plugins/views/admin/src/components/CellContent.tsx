import * as React from 'react'
import { AppSchema, QueryField } from '../types'
import { Link } from '@strapi/design-system/Link'
import { getRecordUrlPath, getSchemaModel } from '../utils'

interface Props {
  data: any
  contentType: string
  fieldName: string
  schema: AppSchema
  queryField: QueryField
}

export const CellContent = (props: Props) => {
  const { data, contentType, fieldName, schema } = props
  const value = data[fieldName]
  const model = getSchemaModel(schema, contentType)
  if (!model)
    return <></>

  const field = model.attributes[fieldName]
  return field?.type == 'relation'
    ? (
      <Link to={''}>{value}</Link>
    )
    : (
      <Link to={getRecordUrlPath(contentType, data.id)}>{value}</Link>
    )
}
