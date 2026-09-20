/**
 * Placeholder migration runner.
 *
 * The real plain-SQL migration system (schema_migrations tracking table,
 * applying files from server/migrations in order) is implemented in LAR-20.
 * This stub exists so `npm run migrate:up` resolves once the project is
 * scaffolded, and gives a clear pointer for where that work lands.
 */
async function main(): Promise<void> {
  console.log(
    "No migrations to run yet. The migration runner will be implemented in LAR-20."
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
