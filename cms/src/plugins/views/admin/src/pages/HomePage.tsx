import React from 'react'
import { ReportTable } from '../components'
import { useSchema } from '../utils'
import { viewPages } from './view-pages'

const HomePage: React.VoidFunctionComponent = () => {
  const schema = useSchema()
  return schema ? (
    <ReportTable reportProps={viewPages[0]} schema={schema}/>
  ) : (<></>)
}

export default HomePage
