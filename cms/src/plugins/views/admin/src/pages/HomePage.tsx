import React from 'react'
import { ReportTable } from '../components'
import { useModels } from '@strapi/admin/admin/src/content-manager/pages/App/useModels'

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
  const k = useModels
  // const {models } = useModels();
  return (
    <div>
      <ReportTable reportProps={requirementsView}/>
    </div>
  )
}

export default HomePage
