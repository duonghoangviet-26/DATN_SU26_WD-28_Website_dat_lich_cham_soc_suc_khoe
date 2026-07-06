import { runMigration } from './_migrationRunner.js'

const result = await runMigration({
  name: '000-empty-migration',
  rollbackable: true,
  async up() {
    return 0
  },
})

console.log(JSON.stringify(result))
