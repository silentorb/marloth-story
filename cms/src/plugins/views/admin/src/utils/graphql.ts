import { AppSchema, DataQuery, QueryField } from '../types'
import { getSchemaModel } from './schema'

export type IndentFormatter = (depth: number) => string

export function queryLine(content: string): IndentFormatter {
  return depth => {
    let result = content
    for (let i = 0; i < depth; ++i) {
      result = '  ' + result
    }

    return result
  }
}

export function joinLines(formatters: IndentFormatter[]): IndentFormatter {
  return depth => formatters
    .map(f => f(depth))
    .filter(s => s.length > 0)
    .join('\n')
}

export function queryBlock(heading: string, content: IndentFormatter): IndentFormatter {
  return depth => queryLine(heading + ' {\n')(depth)
    + content(depth + 1) + '\n'
    + queryLine('}')(depth)
}

const block = queryBlock
const line = queryLine
const join = joinLines

export function formatGraphSubQuery(schema: AppSchema, modelName: string, query: QueryField): IndentFormatter {
  // const model = getSchemaModel(schema, modelName)
  const { fields } = query
  const nameClause = query.name

  if (!fields || fields.length == 0)
    return queryLine(nameClause)

  const rootFieldClause = fields.some(f => f.name == 'id')
    ? 'id'
    : ''

  const attributes = fields
    .filter(f => f.name !== 'id' && f.continuity !== 'virtual')

  return block(nameClause,
    block('data',
      join([
        line(rootFieldClause),
        attributes.length > 0 ? block('attributes',
            join(attributes.map(f => formatGraphSubQuery(schema, modelName, f)))
          )
          : () => ''
      ])
    )
  )
}

export function formatGraphQuery(schema: AppSchema, query: DataQuery): string {
  const model = getSchemaModel(schema, query.base)
  if (!model)
    throw new Error(`Could not find model ${query.base}`)

  const result = block('query',
    formatGraphSubQuery(schema, query.base, {
      name: model.info.pluralName!,
      fields: query.fields,
    })
  )(0)

  console.log(result)
  return result
}
