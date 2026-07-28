import { runMigration } from './_migrationRunner.js'

function toSlug(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

function makeUniqueUrlSlug(source, used) {
  const base = (toSlug(source) || 'tin-tuc').slice(0, 220).replace(/-+$/g, '') || 'tin-tuc'
  let nextSlug = base
  let suffix = 2

  while (used.has(nextSlug)) {
    const suffixText = `-${suffix}`
    const trimmedBase = base.slice(0, 220 - suffixText.length).replace(/-+$/g, '') || 'tin-tuc'
    nextSlug = `${trimmedBase}${suffixText}`
    suffix += 1
  }

  used.add(nextSlug)
  return nextSlug
}

const result = await runMigration({
  name: '012-news-short-title-url-slug',
  rollbackable: false,
  async up({ connection }) {
    const collection = connection.collection('tin_tuc')
    const indexes = await collection.indexes()
    let affected = 0

    for (const index of indexes) {
      if (index.name === 'slug_1' && index.unique) {
        await collection.dropIndex(index.name)
        affected += 1
      }

      if (index.name.includes('text')) {
        await collection.dropIndex(index.name)
        affected += 1
      }
    }

    const documents = await collection.find({}).sort({ _id: 1 }).toArray()
    const usedUrlSlugs = new Set()

    for (const doc of documents) {
      const nextUrlSlug = makeUniqueUrlSlug(doc.url_slug || doc.title || doc.slug, usedUrlSlugs)

      if (doc.url_slug !== nextUrlSlug) {
        await collection.updateOne({ _id: doc._id }, { $set: { url_slug: nextUrlSlug } })
        affected += 1
      }
    }

    await collection.createIndex({ url_slug: 1 }, { unique: true })
    await collection.createIndex({ status: 1, created_at: -1 })
    await collection.createIndex({ title: 'text', slug: 'text', content: 'text' })

    return affected
  },
})

console.log(JSON.stringify(result))
