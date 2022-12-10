import * as React from 'react'
import { useEffect, useState } from 'react'
import { useIntl } from 'react-intl'
import { DynamicTable, Link, } from '@strapi/helper-plugin'
import { Main } from '@strapi/design-system/Main'
import { ContentLayout, HeaderLayout } from '@strapi/design-system/Layout'
import ArrowLeft from '@strapi/icons/ArrowLeft'
import { TableRows } from './index'
import { AppSchema, ReportProps } from '../types'
import { publicAxios } from '../utils/axiosInstance'
import { formatGraphQuery } from '../utils/graphql'
import { flattenAttributes, getFieldValue, getSchemaModel } from '../utils'

interface Props {
  reportProps: ReportProps
  schema: AppSchema
}

function capitalizeFirstLetter(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const ReportTable = (props: Props) => {
  const { reportProps, schema } = props
  const { query } = reportProps
  const [records, setRecords] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const model = getSchemaModel(schema, query.base)

  const columns = query.fields
    .filter(f => f.continuity != 'transient')

  useEffect(() => {
    if (!model)
      return

    publicAxios.post(`/graphql`, { query: formatGraphQuery(schema, query) })
      .then(res => {
        const data = res.data.data[model.info.pluralName!].data
          .map(flattenAttributes)
          .map(r =>
            columns.reduce((a, f) => ({ ...a, [f.name]: getFieldValue(f, r) }), {})
          )

        setRecords(data)
        setIsLoading(false)
      })
  }, [setRecords])

  if (!model)
    return <></>

  const { formatMessage } = useIntl()

  const headers = columns
    .map(f => {
      const name = f.name
      return { key: name, name, metadatas: { label: f.title || capitalizeFirstLetter(name), sortable: true } }
    })

  return <Main aria-busy={false}>
    <HeaderLayout
      title={reportProps.title}
      navigationAction={
        <Link startIcon={<ArrowLeft/>} to="/content-manager/">
          {formatMessage({
            id: 'global.back',
            defaultMessage: 'Back',
          })}
        </Link>
      }
    />
    <ContentLayout>
      <>
        <DynamicTable
          isLoading={isLoading}
          headers={headers}
          contentType={''}
          rows={records}
        >
          <TableRows contentType={reportProps.query.base} schema={schema} columns={columns}/>
        </DynamicTable>
      </>
    </ContentLayout>
  </Main>
}
