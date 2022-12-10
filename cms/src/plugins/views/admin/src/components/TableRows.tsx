import * as React from 'react'
import { Link, useHistory } from 'react-router-dom'
import { useIntl } from 'react-intl'
import { BaseCheckbox } from '@strapi/design-system/BaseCheckbox'
import { Box } from '@strapi/design-system/Box'
import { IconButton } from '@strapi/design-system/IconButton'
import { Tbody, Td, Tr } from '@strapi/design-system/Table'
import { Flex } from '@strapi/design-system/Flex'
import Trash from '@strapi/icons/Trash'
import Duplicate from '@strapi/icons/Duplicate'
import Pencil from '@strapi/icons/Pencil'
import { useTracking, stopPropagation, onRowClick } from '@strapi/helper-plugin'
import { AppSchema, QueryField } from '../types'
import { CellContent } from './CellContent'

// import { usePluginsQueryParams } from '../../../hooks'

interface Props {
  canCreate?
  canDelete?
  contentType?
  headers?
  entriesToDelete?
  onClickDelete?
  onSelectRow?
  withMainAction?
  withBulkActions?
  columns: QueryField[]
  rows?
  schema: AppSchema
}

export const TableRows = ({
                            canCreate,
                            canDelete,
                            contentType,
                            headers,
                            entriesToDelete,
                            onClickDelete,
                            onSelectRow,
                            withMainAction,
                            withBulkActions,
  columns,
                            rows,
                            schema,
                          }: Props) => {
  const {
    push,
    location: { pathname },
  } = useHistory()
  const { formatMessage } = useIntl()

  const { trackUsage } = useTracking()
  // const pluginsQueryParams = usePluginsQueryParams()

  return (
    <Tbody>
      {rows.map((data, index) => {
        const isChecked = entriesToDelete.findIndex((id) => id === data.id) !== -1
        const itemLineText = formatMessage(
          {
            id: 'content-manager.components.DynamicTable.row-line',
            defaultMessage: 'item line {number}',
          },
          { number: index }
        )

        return (
          <Tr
            key={data.id}
            {...onRowClick({
              fn() {
                trackUsage('willEditEntryFromList')
                push({
                  pathname: `${pathname}/${data.id}`,
                  state: { from: pathname },
                  // search: pluginsQueryParams,
                })
              },
              condition: withBulkActions,
            })}
          >
            {withMainAction && (
              <Td {...stopPropagation}>
                <BaseCheckbox
                  aria-label={formatMessage(
                    {
                      id: 'app.component.table.select.one-entry',
                      defaultMessage: `Select {target}`,
                    },
                    { target: 'Foo' }
                  )}
                  checked={isChecked}
                  onChange={() => {
                    onSelectRow({ name: data.id, value: !isChecked })
                  }}
                />
              </Td>
            )}
            {headers.map(({ key, cellFormatter, name, ...rest }) => {
              const queryField = columns.filter(f => f.name == name)[0]
              return (
                <Td key={key}>
                  {typeof cellFormatter === 'function' ? (
                    cellFormatter(data, { key, name, ...rest })
                  ) : (
                    <CellContent schema={schema} data={data} contentType={contentType} fieldName={name} queryField={queryField}/>
                  )}
                </Td>
              )
            })}

            {withBulkActions && (
              <Td>
                <Flex justifyContent="end" {...stopPropagation}>
                  <IconButton
                    forwardedAs={Link}
                    onClick={() => {
                      trackUsage('willEditEntryFromButton')
                    }}
                    to={{
                      pathname: `${pathname}/${data.id}`,
                      state: { from: pathname },
                      // search: pluginsQueryParams,
                    }}
                    label={formatMessage(
                      { id: 'app.component.table.edit', defaultMessage: 'Edit {target}' },
                      { target: itemLineText }
                    )}
                    noBorder
                    icon={<Pencil/>}
                  />

                  {canCreate && (
                    <Box paddingLeft={1}>
                      <IconButton
                        forwardedAs={Link}
                        to={{
                          pathname: `${pathname}/create/clone/${data.id}`,
                          state: { from: pathname },
                          // search: pluginsQueryParams,
                        }}
                        label={formatMessage(
                          {
                            id: 'app.component.table.duplicate',
                            defaultMessage: 'Duplicate {target}',
                          },
                          { target: itemLineText }
                        )}
                        noBorder
                        icon={<Duplicate/>}
                      />
                    </Box>
                  )}

                  {canDelete && (
                    <Box paddingLeft={1}>
                      <IconButton
                        onClick={() => {
                          trackUsage('willDeleteEntryFromList')
                          onClickDelete(data.id)
                        }}
                        label={formatMessage(
                          { id: 'global.delete-target', defaultMessage: 'Delete {target}' },
                          { target: itemLineText }
                        )}
                        noBorder
                        icon={<Trash/>}
                      />
                    </Box>
                  )}
                </Flex>
              </Td>
            )}
          </Tr>
        )
      })}
    </Tbody>
  )
}

