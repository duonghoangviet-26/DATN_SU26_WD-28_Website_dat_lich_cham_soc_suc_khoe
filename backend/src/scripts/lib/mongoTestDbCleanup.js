export const SAFE_TEST_DB_PATTERN = /^vf_t\d+[a-z]?_[0-9a-f]+$/i
export const BACKUP_CHECK_DB_PATTERN = /^vf_bakchk_/i
export const MONGODB_SYSTEM_DATABASES = new Set(['admin', 'config', 'local'])

export function maskMongoUri(uri) {
  return uri.replace(/:([^:@]+)@/, ':***@')
}

export function classifyDatabaseName(name, { productionDbName } = {}) {
  if (name === productionDbName) {
    return {
      category: 'keep',
      reason: 'current_application_database',
    }
  }

  if (MONGODB_SYSTEM_DATABASES.has(name)) {
    return {
      category: 'keep',
      reason: 'mongodb_system_database',
    }
  }

  if (SAFE_TEST_DB_PATTERN.test(name)) {
    return {
      category: 'safe_delete',
      reason: 'matches_backend_test_database_pattern',
    }
  }

  if (BACKUP_CHECK_DB_PATTERN.test(name)) {
    return {
      category: 'review',
      reason: 'backup_validation_database_review_before_delete',
    }
  }

  if (/^vf_/i.test(name)) {
    return {
      category: 'review',
      reason: 'project_prefixed_database_but_not_known_test_pattern',
    }
  }

  return {
    category: 'keep',
    reason: 'unrelated_or_external_database',
  }
}

export function buildDatabaseRows(databases, options = {}) {
  return databases
    .map((database) => {
      const classification = classifyDatabaseName(database.name, options)
      return {
        name: database.name,
        sizeOnDisk: Number(database.sizeOnDisk || 0),
        empty: Boolean(database.empty),
        ...classification,
      }
    })
    .sort((left, right) => left.name.localeCompare(right.name))
}

export function summarizeRows(rows) {
  const summary = {
    keep: 0,
    safe_delete: 0,
    review: 0,
  }

  for (const row of rows) {
    summary[row.category] += 1
  }

  return summary
}

export function formatTextReport(rows, context = {}) {
  const lines = []
  const summary = summarizeRows(rows)

  lines.push('MONGO_DB_CLEANUP_AUDIT_START')
  if (context.host) lines.push(`HOST=${context.host}`)
  if (context.productionDbName) lines.push(`PRODUCTION_DB=${context.productionDbName}`)
  lines.push(`KEEP_COUNT=${summary.keep}`)
  lines.push(`SAFE_DELETE_COUNT=${summary.safe_delete}`)
  lines.push(`REVIEW_COUNT=${summary.review}`)

  for (const category of ['keep', 'safe_delete', 'review']) {
    lines.push(`CATEGORY=${category.toUpperCase()}`)
    for (const row of rows.filter((entry) => entry.category === category)) {
      lines.push(
        [
          'DB',
          `name=${row.name}`,
          `category=${row.category}`,
          `reason=${row.reason}`,
          `empty=${row.empty}`,
          `sizeOnDisk=${row.sizeOnDisk}`,
        ].join(' | ')
      )
    }
  }

  lines.push('MONGO_DB_CLEANUP_AUDIT_DONE')
  return lines.join('\n') + '\n'
}
