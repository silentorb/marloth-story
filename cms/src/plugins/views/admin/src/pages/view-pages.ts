import { ReportProps } from '../types'
import { normalizeInputReportProps } from '../utils'

export const viewPages: ReportProps[] = [
  {
    title: 'Requirements',
    query: {
      base: 'requirement',
      fields: [
        'id',
        'name',
        {
          name: 'solutions',
          transient: true,
          fields: [
            'id',
            'name',
            {
              name: 'scenes',
              fields: ['id'],
            }
          ]
        }
      ]
    },
    dataMap: data => data.requirements.data.map(r => ({
      id: r.id,
      name: r.attributes.name,
    }))
  }
]
  .map(normalizeInputReportProps)
