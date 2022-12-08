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
import { getSchemaModel } from '../utils'

interface Props {
  reportProps: ReportProps
  schema: AppSchema
}

function capitalizeFirstLetter(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const ReportTable = (props: Props) => {
  const { reportProps, schema } = props
  const { query, dataMap } = reportProps
  const [records, setRecords] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    publicAxios.post(`/graphql`, { query: formatGraphQuery(schema, query) })
      .then(res => {
        const data = dataMap(res.data.data)
        setRecords(data)
        setIsLoading(false)
      })
  }, [setRecords])

  const model = getSchemaModel(schema, query.base)
  if (!model)
    return <></>

  const { formatMessage } = useIntl()

  const headers = query.fields
    .filter(f => !f.transient)
    .map(f => {
      const name = f.name
      return { key: name, name, metadatas: { label: capitalizeFirstLetter(name) } }
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
          <TableRows contentType={reportProps.query.base} schema={schema}/>
        </DynamicTable>
      </>
    </ContentLayout>
  </Main>
}
