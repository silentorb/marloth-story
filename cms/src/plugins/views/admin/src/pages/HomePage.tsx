import React from 'react'
import { ReportTable } from '../components'
import { useSchema } from '../utils/use-schema'

const requirementsView = {
  title: 'Requirements',
  baseModel: 'requirement',
  query: `query {
  requirements {
    data {
      id
      attributes {
        name
        solutions {
            data {
                id
                attributes {
                    name
                    scenes {
                        data {
                            id
                        }
                    }
                }
            }
        }
      }
    }
  }
}
`,
  dataMap: data => data.requirements.data.map(r => ({
    id: r.id,
    name: r.attributes.name,
  }))
}

const HomePage: React.VoidFunctionComponent = () => {
  const schema = useSchema()
  return schema ? (
    <ReportTable reportProps={requirementsView} schema={schema}/>
  ) : (<></>)
}

export default HomePage
