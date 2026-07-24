import mongoose from 'mongoose'

async function seedAll() {
  console.log(JSON.stringify({
    skipped: true,
    reason: 'Legacy seed-all is disabled. The current catalog keeps only Tai Mui Hong specialty and Tai Mui Hong services.',
  }, null, 2))

  await mongoose.disconnect().catch(() => {})
}

seedAll().catch(async (error) => {
  console.error(error)
  await mongoose.disconnect().catch(() => {})
  process.exit(1)
})
