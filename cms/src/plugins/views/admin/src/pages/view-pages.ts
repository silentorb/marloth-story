import { InputReportProps, ReportProps } from '../types'
import { normalizeInputReportProps } from '../utils'

const data: InputReportProps[] = [
  {
    title: 'Requirements',
    query: {
      base: 'requirement',
      fields: [
        'id',
        'name',
        {
          name: 'solutions',
          continuity: 'transient',
          fields: [
            'id',
            'name',
            {
              name: 'scenes',
              fields: ['id'],
            }
          ]
        },
        {
          name: 'sceneCount',
          title: 'Scene Count',
          continuity: 'virtual',
          getValue: data => new Set(
            data.solutions
              .reduce((a, b) => a.concat(b.scenes.map(s => s.id)), [])
          )
            .size
        },
      ]
    }
  }
]

export const viewPages: ReportProps[] = data.map(normalizeInputReportProps)
