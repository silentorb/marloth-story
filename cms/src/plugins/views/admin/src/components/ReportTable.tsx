import * as React from 'react'
import { useEffect, useState } from 'react'
import { useIntl } from 'react-intl'
import { DynamicTable, Link, } from '@strapi/helper-plugin'
import { Main } from '@strapi/design-system/Main'
import { ContentLayout, HeaderLayout } from '@strapi/design-system/Layout'
import ArrowLeft from '@strapi/icons/ArrowLeft'
import axiosInstance from '../utils/axiosInstance'
import { TableRows } from './index'
import { ReportProps } from '../types'

interface Props {
  reportProps: ReportProps
}

export const ReportTable = (props: Props) => {
  const { reportProps } = props
  const { query, dataMap } = reportProps
  const [records, setRecords] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    axiosInstance.post(`/graphql`, { query })
      .then(res => {
        const data = dataMap(res.data.data)
        setRecords(data)
        setIsLoading(false)
      })
  }, [setRecords])

  const { formatMessage } = useIntl()

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
          headers={[
            { key: 'id', name: 'id', metadatas: { label: 'Id' } },
            { key: 'name', name: 'name', metadatas: { label: 'Name' } },
          ]}
          contentType={''}
          rows={records}
        >
          <TableRows/>
        </DynamicTable>
      </>
    </ContentLayout>
  </Main>
}
