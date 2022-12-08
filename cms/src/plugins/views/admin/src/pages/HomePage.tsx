import React from 'react'
import { ReportTable } from '../components'

const requirementsView = {
  title: 'Requirements',
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
  return (
    <div>
      <ReportTable reportProps={requirementsView}/>
    </div>
  )
}

export default HomePage
