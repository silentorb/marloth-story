import { DataQuery, InputDataQuery, InputQueryField, InputReportProps, QueryField, ReportProps } from '../types'

export function normalizeInputQueryField(field: InputQueryField): QueryField {
  if (typeof field === 'string')
    return { name: field, fields: [] }

  const { fields } = field

  return {
    ...field,
    fields: fields ? fields.map(normalizeInputQueryField) : [],
  }
}

export function normalizeInputDataQuery(query: InputDataQuery): DataQuery {
  return {
    ...query,
    fields: query.fields.map(normalizeInputQueryField),
  }
}

export function normalizeInputReportProps(props: InputReportProps): ReportProps {
  return {
    ...props,
    query: normalizeInputDataQuery(props.query),
  }
}
